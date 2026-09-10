#!/usr/bin/env bash
# 課程用的 R 套件。R 本身由 r-apt feature 裝好，這裡只補套件。
#
# 三層來源，前一層失敗就換下一層。任何一層成功就結束：
#
#   1. bspm/r2u   r-apt feature 開的 apt 二進位，最快（一兩分鐘）
#   2. p3m        Posit 的定日快照，二進位，內容永遠不變
#   3. cran       原始碼，最慢（十幾分鐘）但不依賴任何鏡像的二進位建置
#
# 為什麼不是只挑最快的：從原始碼編譯 survminer 這一串在 2 core 的
# Codespace 要十幾分鐘，上課前才發現就來不及了。但 r2u 是單一站台，
# 它掛掉的那天也還是要上課——所以三層都留著。
#
# 只跑某一層（除錯用）：
#   bash .devcontainer/install-r-packages.sh p3m
#
# 驗收在 .devcontainer/verify.sh（postCreateCommand）。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKGS=(tidyverse here gtsummary gt survival survminer broom)

if ! command -v Rscript >/dev/null 2>&1; then
  echo "找不到 Rscript——r-apt feature 沒有裝成功，先看建置紀錄的 features 那一段。" >&2
  exit 1
fi

# 定日快照。不寫 latest：課程要能在任何一天重現同一組版本，
# 而 latest 會隨 CRAN 一起往前走。
#
# 但快照的日期不能寫死一個：套件版本與 R 版本是綁在一起的。實測過
# ——R 4.3.3 配 2026-09-01 的快照，survminer 那條相依鏈沒有對應的二進位，
# 退回原始碼後編譯失敗（`R_ClosureFormals` was not declared，那是 R 4.4
# 之後才有的 API）。同一台機器換成 2024-06-01 的快照，全部走二進位，12 秒。
#
# 所以按 R 的版本挑對應年代的快照。要升級就改這裡，然後重建一次。
snapshot_for_r() {
  local v
  v="$(Rscript -e 'cat(as.integer(R.version$major) * 100 + as.integer(sub("\\..*", "", R.version$minor)))')"
  if   [ "$v" -ge 405 ]; then echo "2026-09-01"
  elif [ "$v" -ge 404 ]; then echo "2025-02-01"
  elif [ "$v" -ge 403 ]; then echo "2024-06-01"
  else                        echo "2023-06-01"
  fi
}

SNAPSHOT="${P3M_SNAPSHOT:-$(snapshot_for_r)}"
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-noble}")"
export P3M_URL="https://packagemanager.posit.co/cran/__linux__/${CODENAME}/${SNAPSHOT}"
export CRAN_URL="https://cloud.r-project.org"
echo "R $(Rscript -e 'cat(as.character(getRversion()))') · ${CODENAME} · P3M 快照 ${SNAPSHOT}"

# apt 要 root。feature 裝好的環境裡這個腳本以 remoteUser 身分跑，本機測試
# 可能已經是 root——兩種都要能動。
as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

# survival、Matrix、MASS 這些是 R 的 recommended 套件，隨 R 一起發行，由
# apt 的 r-recommended 提供（r-apt feature 裝的是 r-base 這個 metapackage，
# 已經含它）。不要交給下面的階梯：實測 R 4.3.3 從 CRAN 抓 Matrix 會被版本
# 條件擋掉（最新版要 R >= 4.4），連帶 survival 裝不起來——而 survival
# 正是這門課的主角。
if ! Rscript -e 'quit(status = as.integer(!(requireNamespace("Matrix", quietly = TRUE) &&
                                            requireNamespace("survival", quietly = TRUE))))' 2>/dev/null; then
  echo "recommended 套件不全（Matrix / survival），補 r-recommended。" >&2
  as_root apt-get update -qq && as_root apt-get install -y --no-install-recommends r-recommended \
    || echo "補不到 r-recommended，下面的階梯會再試一次。" >&2
fi

TIERS=(bspm p3m cran)
if [ "$#" -gt 0 ]; then
  TIERS=("$@")
fi

for tier in "${TIERS[@]}"; do
  # cran 那層是原始碼，沒有編譯器就不可能成功。前兩層走二進位，用不到。
  if [ "$tier" = cran ] && ! command -v gcc >/dev/null 2>&1; then
    echo "[cran] 沒有編譯器，先補 build-essential。" >&2
    as_root apt-get update -qq && as_root apt-get install -y --no-install-recommends build-essential \
      || echo "[cran] 補不到編譯器，這一層大概會失敗。" >&2
  fi

  # 同一層試兩次：外部服務偶爾會有一次性的連線失敗。
  # 但離開碼 2（用法錯）與 3（這一層根本不存在）是確定性的，重試只是浪費時間。
  for attempt in 1 2; do
    set +e
    Rscript "$HERE/install-packages.R" "$tier" "${PKGS[@]}"
    rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then
      echo "R 套件就緒（來源：${tier}）"
      exit 0
    fi
    if [ "$rc" -ge 2 ]; then
      break
    fi
    if [ "$attempt" -lt 2 ]; then
      echo "[${tier}] 第 ${attempt} 次未完成，等 10 秒再試一次。" >&2
      sleep 10
    fi
  done
  echo "[${tier}] 這一層沒有成功，換下一層。" >&2
done

cat >&2 <<'EOF'
三層來源都失敗了。可能是這台機器連不出去。

課還是上得下去，見 demo/README.md 的「環境壞掉時」：
Claude Code 那半段（讀資料、決定、寫腳本）完全不需要 R，
要對數字時用 reference-run/console/ 裡三支腳本的實際輸出。
EOF
exit 1
