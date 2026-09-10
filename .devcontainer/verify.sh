#!/usr/bin/env bash
# 環境驗收。建置的最後一步跑，壞掉就讓建置失敗——
# 現場才發現 claude 不在 PATH 或套件載不動，就沒有時間補救了。
set -uo pipefail

PKGS=(tidyverse here gtsummary gt survival survminer broom)
fail=0

check() {  # check <名稱> <指令...>
  local name="$1"; shift
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
# feature 那份還在 PATH 上，課還是上得下去。這裡驗的是「打 claude 有東西」。
check claude   claude --version
check Rscript  Rscript --version

# 套件裝起來了但載不動（缺系統相依）只會在第一次 library() 時才爆。
check "R packages" Rscript -e '
  pkgs <- commandArgs(TRUE)
  invisible(lapply(pkgs, function(p) library(p, character.only = TRUE)))
  cat(sprintf("%d 個套件皆可載入", length(pkgs)))
' "${PKGS[@]}"

check "demo/raw" test -r demo/raw/cohort.csv

if [ "$fail" -ne 0 ]; then
  echo "環境沒有就緒，請看上面的 FAIL。" >&2
  exit 1
fi

cat <<'EOF'

環境就緒。第一次使用 claude 需要登入：

  cd demo
  claude          # 照畫面完成登入，之後不用再登

練習說明在 demo/README.md，提示詞在 demo/PROMPTS.md。
EOF
