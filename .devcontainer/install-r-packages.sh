#!/usr/bin/env bash
# 課程用的 R 套件。R 本身由 r-apt feature 裝好，這裡只補套件。
#
# 為什麼不用 install.packages() 的預設路徑：從原始碼編譯 survminer
# 這一串在 2 core 的 Codespace 要跑十幾分鐘，上課前才發現就來不及了。
# r-apt feature 開了 bspm（installBspm），install.packages() 會轉去抓
# r2u 的二進位 .deb，同一組套件約一兩分鐘。
#
# 驗收在 .devcontainer/verify.sh（postCreateCommand）。
set -euo pipefail

PKGS=(tidyverse here gtsummary gt survival survminer broom)

if ! command -v Rscript >/dev/null 2>&1; then
  echo "找不到 Rscript——r-apt feature 沒有裝成功，先看建置紀錄的 features 那一段。" >&2
  exit 1
fi

# install.packages() 裝不起來時只發 warning，不設離開碼。不自己回頭檢查的話，
# 這個腳本會在套件根本沒裝上的情況下回報成功，然後由學員在課堂上發現。
install_once() {
  Rscript -e '
    pkgs <- commandArgs(TRUE)
    # bspm 沒生效而回退到原始碼編譯時，這行才有意義。
    options(Ncpus = max(1L, parallel::detectCores()))
    miss <- setdiff(pkgs, rownames(installed.packages()))
    if (!length(miss)) { message("套件都在，跳過安裝"); quit(status = 0) }
    message("要裝：", paste(miss, collapse = " "))
    install.packages(miss)
    still <- setdiff(pkgs, rownames(installed.packages()))
    if (length(still)) {
      message("仍然缺少：", paste(still, collapse = " "))
      quit(status = 1)
    }
    message("安裝完成")
  ' "${PKGS[@]}"
}

# r2u 與 CRAN 都是外部服務，偶爾會抓不到。三次，間隔拉長。
for attempt in 1 2 3; do
  if install_once; then
    exit 0
  fi
  if [ "$attempt" -lt 3 ]; then
    echo "第 ${attempt} 次未完成，等 $((attempt * 15)) 秒再試。" >&2
    sleep $((attempt * 15))
  fi
done

echo "R 套件連續三次裝不起來。網路或 r2u 有問題，請看上面的訊息。" >&2
exit 1
