# 01_clean.R ---------------------------------------------------------------
# 目的：讀 raw/cohort.csv，檢查，標準化，產出分析資料集。
# 紀律：raw/ 唯讀，本檔只讀不寫；所有產出都落在 output/。
# 執行：Rscript scripts/01_clean.R

suppressPackageStartupMessages({
  library(tidyverse)
  library(here)
})

raw_file <- here("raw", "cohort.csv")

cat("== 讀入 ==\n")
raw <- read_csv(raw_file, show_col_types = FALSE)
cat(sprintf("  raw/cohort.csv : %d 列 x %d 欄\n", nrow(raw), ncol(raw)))

# --- 檢查一：缺失 ---------------------------------------------------------
# 缺失不是錯誤，但必須知道有多少、落在哪個變項。
cat("\n== 檢查一：缺失 ==\n")
miss <- map_int(raw, ~ sum(is.na(.x)))
cat("  ", paste(sprintf("%s=%d", names(miss), miss), collapse = "  "), "\n")
if (any(miss > 0)) {
  cat(sprintf("  age 缺失 %d 筆。不插補；Cox model 會整列排除，實際 n 因此低於 %d。\n",
              miss[["age"]], nrow(raw)))
}

# --- 檢查二：範圍與邏輯 ---------------------------------------------------
cat("\n== 檢查二：範圍與邏輯 ==\n")
cat(sprintf("  age  : %d - %d 歲\n",       min(raw$age, na.rm = TRUE), max(raw$age, na.rm = TRUE)))
cat(sprintf("  time : %.1f - %.1f 個月\n", min(raw$time), max(raw$time)))
stopifnot(all(raw$time > 0), all(raw$status %in% c(0, 1)))
cat("  通過：time 皆為正、status 僅 0/1\n")

# --- 檢查三：設限型態 -----------------------------------------------------
# 設限若大量堆在最長追蹤時間，屬行政設限。
# 影響：中位追蹤時間不能用 time 的中位數，需以 reverse KM 估計。
cat("\n== 檢查三：設限型態 ==\n")
n_cens <- sum(raw$status == 0)
n_admin <- sum(raw$status == 0 & raw$time == max(raw$time))
cat(sprintf("  死亡 %d　設限 %d\n", sum(raw$status == 1), n_cens))
cat(sprintf("  設限中有 %d 筆 time = %.0f（最長追蹤），屬行政設限\n",
            n_admin, max(raw$time)))

# --- 標準化 ---------------------------------------------------------------
# 以下三項為決定，不是資料本身帶有的資訊：
#   1. 缺失不插補
#   2. stage I/II = early，III/IV = advanced　<- 臨床判斷
#   3. 年齡切點 60 歲，供次族群分析使用　　　 <- 事後決定，故該分析屬探索性
cohort <- raw |>
  mutate(
    treatment   = factor(treatment, levels = c("Drug_A", "Drug_B")),
    sex         = factor(sex, levels = c("F", "M"), labels = c("女", "男")),
    stage       = factor(stage, levels = c("I", "II", "III", "IV")),
    stage_group = factor(if_else(stage %in% c("I", "II"), "early", "advanced"),
                         levels = c("early", "advanced")),
    age_group   = factor(if_else(age >= 60, ">=60", "<60"),
                         levels = c("<60", ">=60"))
  ) |>
  select(patient_id, treatment, age, age_group, sex, stage, stage_group, time, status)

dir.create(here("output"), showWarnings = FALSE)
write_csv(cohort, here("output", "cohort_clean.csv"))

cat("\n== 產出 ==\n")
cat(sprintf("  output/cohort_clean.csv : %d 列 x %d 欄\n", nrow(cohort), ncol(cohort)))
cat(sprintf("  age_group 缺失 %d 筆（源自 age）\n", sum(is.na(cohort$age_group))))
cat("\n分組後人數：\n")
print(table(cohort$treatment, cohort$stage_group))
