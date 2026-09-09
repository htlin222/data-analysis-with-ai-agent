# 02_describe.R ------------------------------------------------------------
# 目的：描述性統計 + Table 1。從 output/cohort_clean.csv 開始，不重跑清洗。
# 執行：Rscript scripts/02_describe.R

suppressPackageStartupMessages({
  library(tidyverse)
  library(here)
  library(gtsummary)
})

cohort <- read_csv(here("output", "cohort_clean.csv"), show_col_types = FALSE) |>
  mutate(across(c(treatment, age_group, sex, stage, stage_group), as.factor))

# --- 先看每個變項自己長什麼樣 ---------------------------------------------
cat("== 缺失值 ==\n")
miss <- cohort |>
  summarise(across(everything(), ~ sum(is.na(.x)))) |>
  pivot_longer(everything(), names_to = "變項", values_to = "缺失數") |>
  mutate(缺失比例 = sprintf("%.1f%%", 缺失數 / nrow(cohort) * 100))
print(as.data.frame(miss), row.names = FALSE)

cat("\n== 連續變項 median (IQR) ==\n")
cont <- cohort |>
  select(age, time) |>
  pivot_longer(everything(), names_to = "變項", values_to = "值") |>
  group_by(變項) |>
  summarise(
    # n 為「有值」的筆數，不是總列數。age 有缺失，兩者不相等。
    n      = sum(!is.na(值)),
    缺失   = sum(is.na(值)),
    median = median(值, na.rm = TRUE),
    q1     = quantile(值, .25, na.rm = TRUE),
    q3     = quantile(值, .75, na.rm = TRUE),
    .groups = "drop"
  ) |>
  mutate(`median (IQR)` = sprintf("%.1f (%.1f-%.1f)", median, q1, q3)) |>
  select(變項, n, 缺失, `median (IQR)`)
print(as.data.frame(cont), row.names = FALSE)

cat("\n== 類別變項 n (%) ==\n")
for (v in c("treatment", "sex", "stage", "stage_group", "age_group")) {
  tb <- table(cohort[[v]])
  na_n <- sum(is.na(cohort[[v]]))
  cat(sprintf("%s: %s%s\n", v,
      paste(sprintf("%s %d (%.0f%%)", names(tb), tb, tb / sum(tb) * 100),
            collapse = "  "),
      if (na_n > 0) sprintf("   [缺失 %d，百分比以有值者為分母]", na_n) else ""))
}

# --- Table 1 --------------------------------------------------------------
# 依 stage_group 分組。p value 只是描述兩組本來就長不一樣，不是假設檢定。
tbl1 <- cohort |>
  # 不放 stage：分組變項 stage_group 就是由它定義的，放進去只會得到
  # 0% / 100% 的同義反覆。分組的來源變項不進 Table 1。
  select(age, sex, treatment, time, status, stage_group) |>
  tbl_summary(
    by = stage_group,
    statistic = list(all_continuous() ~ "{median} ({p25}-{p75})",
                     all_categorical() ~ "{n} ({p}%)"),
    label = list(age ~ "年齡", sex ~ "性別", treatment ~ "治療組",
                 time ~ "追蹤時間（月）", status ~ "死亡")
  ) |>
  add_p() |>
  add_n() |>
  modify_header(label ~ "**變項**")

gt::gtsave(gtsummary::as_gt(tbl1), here("output", "table1.html"))
write_csv(as_tibble(tbl1), here("output", "table1.csv"))

cat("\n== Table 1 ==\n")
print(as_tibble(tbl1), n = 30, width = 120)
