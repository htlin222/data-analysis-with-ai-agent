#!/usr/bin/env bash
# 課程用的 R 套件。R 本身由 r-apt feature 裝好，這裡只補套件。
#
# 為什麼不用 install.packages() 的預設路徑：從原始碼編譯 survminer
# 這一串在 2 core 的 Codespace 要跑十幾分鐘，上課前才發現就來不及了。
# r-apt feature 開了 bspm（installBspm），install.packages() 會轉去抓
# r2u 的二進位 .deb，同一組套件約一兩分鐘。
set -euo pipefail

PKGS=(tidyverse here gtsummary gt survival survminer broom)

Rscript -e '
  pkgs <- commandArgs(TRUE)
  miss <- setdiff(pkgs, rownames(installed.packages()))
  if (length(miss)) install.packages(miss) else message("套件都在，跳過安裝")
' "${PKGS[@]}"

# 驗收：裝起來了但載不動（缺系統相依）是常見狀況，
# 而它只會在第一次 library() 時才爆——那時候學員已經坐在螢幕前了。
Rscript -e '
  pkgs <- commandArgs(TRUE)
  invisible(lapply(pkgs, function(p) library(p, character.only = TRUE)))
  cat(sprintf("R %s：%d 個套件皆可載入\n", getRversion(), length(pkgs)))
' "${PKGS[@]}"
