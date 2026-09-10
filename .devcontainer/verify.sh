#!/usr/bin/env bash
# 環境驗收。建置的最後一步跑，壞掉就讓建置失敗——
# 現場才發現 claude 不在 PATH 或套件載不動，就沒有時間補救了。
#
# 學員也可以自己重跑，從任何目錄都行：
#   bash .devcontainer/verify.sh
set -uo pipefail

# 路徑一律以本檔位置為準，不靠當下的工作目錄。
# 學員多半是 cd 進 demo/ 之後才想到要檢查。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PKGS=(tidyverse here gtsummary gt survival survminer broom)
fail=0

check() {  # check <名稱> <指令...>
  local name="$1"; shift
  local out
  # 標籤一律用 ASCII：printf 的 %-12s 以位元組計寬，中文會讓欄位錯開。
  if out=$("$@" 2>&1); then
    printf '  ok    %-12s %s\n' "$name" "$(head -1 <<<"$out")"
  else
    printf '  FAIL  %-12s %s\n' "$name" "$(head -3 <<<"$out")"
    fail=1
  fi
}

echo "== 環境驗收 =="

# claude 由 claude-code feature 裝到 /usr/local/bin，dotfiles prewarm 另外
# 裝一份到 ~/.local/bin。remoteEnv 把 ~/.local/bin 排在前面，所以實際跑到的
# 是 prewarm 那份。兩份都在是刻意的：prewarm 來自另一個 repo，它掛掉的時候
# feature 那份還在 PATH 上，課還是上得下去。
# 印出實際解析到的路徑——PATH 出問題時，這一行就是線索。
check claude   bash -c 'echo "$(command -v claude)  $(claude --version)"'
check Rscript  Rscript --version

# 套件裝起來了但載不動（缺系統相依）只會在第一次 library() 時才爆。
check "R packages" Rscript -e '
  pkgs <- commandArgs(TRUE)
  # 不抑制的話，tidyverse 的載入橫幅會佔掉輸出的第一行，蓋住下面這句。
  invisible(lapply(pkgs, function(p)
    suppressPackageStartupMessages(library(p, character.only = TRUE))))
  cat(sprintf("%d 個套件皆可載入", length(pkgs)))
' "${PKGS[@]}"

# 課程的 R 腳本用中文當欄名。locale 不是 UTF-8 的話，R 連 parse 都過不了
# （invalid multibyte character in parser），而錯誤訊息完全看不出是 locale
# 的問題。devcontainer.json 的 containerEnv 設了 LANG/LC_ALL，這裡確認它生效。
check "UTF-8" Rscript -e 'x <- c(變項 = 1); cat("可解析中文識別字：", names(x))'

# 端到端：真的讀 demo 的資料、真的配一次 KM。跑得動而且數字對，
# 才表示這個環境接得住整堂課。17.5 是 reference-run 的中位存活。
check "KM smoke" bash -c '
  Rscript -e "
    suppressPackageStartupMessages(library(survival))
    d <- read.csv(file.path(commandArgs(TRUE)[1], \"demo/raw/cohort.csv\"))
    m <- summary(survfit(Surv(time, status) ~ 1, data = d))\$table[[\"median\"]]
    if (abs(m - 17.5) > 0.05) { cat(sprintf(\"中位存活 %.1f，應為 17.5\", m)); quit(status = 1) }
    cat(sprintf(\"中位存活 %.1f 月，與 reference-run 相同\", m))
  " "$1"
' _ "$ROOT"

# 資料要在，而且要是完整的 100 列——半份資料跑得動，但數字全錯。
check "demo/raw" bash -c '
  f="$1/demo/raw/cohort.csv"
  [ -r "$f" ] || { echo "讀不到 $f"; exit 1; }
  n=$(($(wc -l < "$f") - 1))
  [ "$n" -eq 100 ] || { echo "應為 100 列，實際 $n 列"; exit 1; }
  echo "100 列"
' _ "$ROOT"

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'EOF'

環境沒有就緒，請看上面的 FAIL。常見原因：
  claude      PATH 有問題，或 claude-code feature 沒裝成功
  Rscript     r-apt feature 沒裝成功
  R packages  套件沒裝完，重跑 bash .devcontainer/install-r-packages.sh
EOF
  exit 1
fi

cat <<'EOF'

環境就緒。第一次使用 claude 需要登入：

  cd demo
  claude          # 照畫面完成登入，之後不用再登

練習說明在 demo/README.md，提示詞在 demo/PROMPTS.md。
EOF
