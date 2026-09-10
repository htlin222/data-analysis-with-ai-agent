#!/usr/bin/env Rscript
# 裝一層套件來源。由 install-r-packages.sh 逐層呼叫。
#
#   用法：install-packages.R <bspm|p3m|cran> <pkg>...
#   離開碼：0 = 全部就緒
#           1 = 這一層沒裝完，可能是暫時的（呼叫端可以重試）
#           2 = 用法錯誤
#           3 = 這一層在這台機器上根本不存在，重試沒有意義
#
# 為什麼要分層：三個來源的失敗方式不一樣，不會同時壞。
#   bspm/r2u   apt 二進位，最快，但 r2u 是單一站台
#   p3m        Posit 的定日快照，二進位，內容永遠不變
#   cran       原始碼，最慢但不依賴任何鏡像的二進位建置

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2L) {
  message("用法：install-packages.R <bspm|p3m|cran> <pkg>...")
  quit(status = 2)
}
tier <- args[[1]]
pkgs <- args[-1]

# 「裝好了」的判準是「載得動」，不是「出現在 installed.packages() 裡」。
# 實測過一個裝得起來卻載不動的狀況：survival 在清單上，但它相依的 Matrix
# 不在（r-base-core 沒帶 r-recommended），library(survival) 直接失敗。
# 只比對清單的話，這一層會回報成功，然後由學員在課堂上發現。
#
# 用另一個行程去載：在正要覆寫的行程裡把 namespace 載進來，
# 之後重裝同一個套件容易出狀況。
missing_pkgs <- function() {
  code <- paste(
    'a <- commandArgs(TRUE)',
    'bad <- a[!vapply(a, function(p) requireNamespace(p, quietly = TRUE), logical(1))]',
    'cat(bad, sep = "\n")',
    sep = "; ")
  out <- suppressWarnings(system2("Rscript", c("-e", shQuote(code), shQuote(pkgs)),
                                  stdout = TRUE, stderr = FALSE))
  out[nzchar(out)]
}

miss <- missing_pkgs()
if (!length(miss)) {
  message("套件都在，跳過安裝")
  quit(status = 0)
}

# P3M 的 __linux__ 路徑靠 User-Agent 決定給哪一種建置：沒有 R 的版本與平台
# 資訊就退回原始碼。實測同一個 URL 帶與不帶此標頭——帶了拿到的 DESCRIPTION
# 有 Built: 欄位（已編譯），沒帶就沒有。
r_user_agent <- function() {
  sprintf("R/%s R (%s)", getRversion(),
          paste(getRversion(), R.version$platform, R.version$arch, R.version$os))
}

disable_bspm <- function() {
  if (requireNamespace("bspm", quietly = TRUE)) try(bspm::disable(), silent = TRUE)
}

switch(tier,
  bspm = {
    # r-apt feature 的 Rprofile.site 已經 bspm::enable()，這一層不必再設定。
    if (!requireNamespace("bspm", quietly = TRUE)) {
      message("[bspm] bspm 不在，跳過這一層")
      quit(status = 3)
    }
  },
  p3m = {
    disable_bspm()
    options(repos = c(P3M = Sys.getenv("P3M_URL")), HTTPUserAgent = r_user_agent())
  },
  cran = {
    disable_bspm()
    options(repos = c(CRAN = Sys.getenv("CRAN_URL")))
  },
  {
    message("未知的來源：", tier)
    quit(status = 2)
  }
)

# 只有回退到原始碼編譯時才用得到。
options(Ncpus = max(1L, parallel::detectCores()))

message("[", tier, "] 要裝：", paste(miss, collapse = " "))
message("[", tier, "] repos = ", paste(getOption("repos"), collapse = " "))
# install.packages() 裝不起來時只發 warning，不設離開碼，所以包在 try() 裡，
# 由下面的比對決定這一層算不算成功。
try(install.packages(miss))

still <- missing_pkgs()
if (length(still)) {
  message("[", tier, "] 仍然缺少：", paste(still, collapse = " "))
  quit(status = 1)
}
message("[", tier, "] 完成")
