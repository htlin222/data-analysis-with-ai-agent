#!/usr/bin/env bash
# dotfiles prewarm（zsh、tmux、neovim、fzf 那些）。
#
# 兩件事跟原本的寫法不同：
#
# 1. 原本是 onCreateCommand 直接 `curl -fsSL ... | bash`。curl 失敗時
#    管線的離開碼取自右邊的 bash——空的 stdin 跑完是 0，等於什麼都沒裝
#    卻回報成功。改成先下載到檔案、確認有內容，再執行。
# 2. 這個腳本失敗不讓建置失敗。課程真正需要的 claude 與 R 由 features
#    提供，dotfiles 是「有更好」的東西；為了它讓整個 Codespace 建不起來
#    不划算。但失敗要吵，不能無聲無息。
set -uo pipefail

URL="https://raw.githubusercontent.com/htlin222/dotfiles/main/start/codespace_prewarm.sh"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! curl -fsSL --retry 3 --retry-delay 5 --max-time 180 -o "$TMP" "$URL"; then
  echo "警告：抓不到 dotfiles prewarm，略過。課程需要的 claude 與 R 由 features 提供。" >&2
  exit 0
fi

if [ ! -s "$TMP" ]; then
  echo "警告：dotfiles prewarm 下載到空檔案，略過。" >&2
  exit 0
fi

bash "$TMP" || echo "警告：dotfiles prewarm 中途失敗，略過。不影響課程流程。" >&2
exit 0
