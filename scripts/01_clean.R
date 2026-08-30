# 01_clean.R ---------------------------------------------------------------
# 目的：把 raw/ 底下兩份原始 CSV 讀進來，檢查、標準化，產出分析資料集。
# 紀律：raw/ 唯讀，本檔只讀不寫；所有產出都落在 output/。
# 執行：Rscript scripts/01_clean.R

suppressPackageStartupMessages({
  library(tidyverse)
  library(here)
})

raw_surv <- here("raw", "patient_data_for_survival.csv")
raw_los  <- here("raw", "patient_data.csv")

cat("== 讀入 ==\n")
surv <- read_csv(raw_surv, show_col_types = FALSE)
los  <- read_csv(raw_los,  show_col_types = FALSE)
cat(sprintf("  patient_data_for_survival.csv : %d 列 x %d 欄\n", nrow(surv), ncol(surv)))
cat(sprintf("  patient_data.csv              : %d 列 x %d 欄\n", nrow(los),  ncol(los)))

# --- 檢查一：唯一鍵 -------------------------------------------------------
# patient_id 在各自檔案裡都唯一，但兩份檔案「不是同一批病人」。
# 用 age 交叉比對：若真是同一批，同 id 的 age 應該幾乎全數吻合。
cat("\n== 檢查一：唯一鍵 ==\n")
cat(sprintf("  surv 重複 id : %d\n", sum(duplicated(surv$patient_id))))
cat(sprintf("  los  重複 id : %d\n", sum(duplicated(los$patient_id))))
agree <- sum(surv$age == los$age[match(surv$patient_id, los$patient_id)], na.rm = TRUE)
cat(sprintf("  同 id 年齡吻合 : %d / %d\n", agree, nrow(surv)))
if (agree < nrow(surv) * 0.9) {
  cat("  !! 兩份檔案的 patient_id 指向不同的人，不可 join。分開處理。\n")
}

# --- 檢查二：類別編碼 -----------------------------------------------------
cat("\n== 檢查二：類別編碼 ==\n")
cat("  surv$treatment :", paste(sort(unique(surv$treatment)), collapse = " / "), "\n")
cat("  los$treatment  :", paste(sort(unique(los$treatment)),  collapse = " / "), "\n")
cat("  surv$stage     :", paste(sort(unique(surv$stage)),     collapse = " / "), "\n")

# --- 檢查三：缺失與範圍 ---------------------------------------------------
cat("\n== 檢查三：缺失與範圍 ==\n")
miss <- map_int(surv, ~ sum(is.na(.x)))
cat("  缺失值 :", paste(sprintf("%s=%d", names(miss), miss), collapse = "  "), "\n")
cat(sprintf("  age    : %d - %d\n",       min(surv$age),  max(surv$age)))
cat(sprintf("  time   : %.1f - %.1f 個月\n", min(surv$time), max(surv$time)))
stopifnot(all(surv$time > 0), all(surv$status %in% c(0, 1)))
cat("  邏輯檢查通過：time 皆為正、status 僅 0/1\n")

# --- 標準化 ---------------------------------------------------------------
# 決定（臨床判斷，不是 AI 決定的）：
#   1. treatment 統一成 Drug_A / Drug_B
#   2. stage I/II = early，III/IV = advanced
#   3. 年齡切點 60 歲，供次族群分析使用
cohort <- surv |>
  mutate(
    treatment   = factor(treatment, levels = c("Drug_A", "Drug_B")),
    sex         = factor(gender, levels = c("F", "M"), labels = c("女", "男")),
    stage       = factor(stage, levels = c("I", "II", "III", "IV")),
    stage_group = factor(if_else(stage %in% c("I", "II"), "early", "advanced"),
                         levels = c("early", "advanced")),
    age_group   = factor(if_else(age >= 60, ">=60", "<60"),
                         levels = c("<60", ">=60"))
  ) |>
  select(patient_id, treatment, age, age_group, sex, stage, stage_group, time, status)

los_clean <- los |>
  mutate(
    treatment = factor(treatment, levels = c("A", "B"), labels = c("Drug_A", "Drug_B")),
    sex       = factor(gender, levels = c("F", "M"), labels = c("女", "男"))
  ) |>
  select(patient_id, treatment, age, sex, los)

dir.create(here("output"), showWarnings = FALSE)
write_csv(cohort,    here("output", "cohort_clean.csv"))
write_csv(los_clean, here("output", "los_clean.csv"))

cat("\n== 產出 ==\n")
cat(sprintf("  output/cohort_clean.csv : %d 列 x %d 欄\n", nrow(cohort), ncol(cohort)))
cat(sprintf("  output/los_clean.csv    : %d 列 x %d 欄\n", nrow(los_clean), ncol(los_clean)))
cat("\n分組後人數：\n")
print(table(cohort$treatment, cohort$stage_group))
