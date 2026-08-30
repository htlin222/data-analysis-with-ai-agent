# 03_survival.R ------------------------------------------------------------
# 目的：整體存活、KM 曲線、Cox model、次族群 forest plot。
# 圖存到 figs/，數字印到 console。終端機負責生產，看圖用別的視窗。
# 執行：Rscript scripts/03_survival.R

suppressPackageStartupMessages({
  library(tidyverse)
  library(here)
  library(survival)
  library(survminer)
  library(broom)
})

cohort <- read_csv(here("output", "cohort_clean.csv"), show_col_types = FALSE) |>
  mutate(across(c(treatment, age_group, sex, stage, stage_group), as.factor))

dir.create(here("figs"), showWarnings = FALSE)
# Rscript 會開一個預設裝置並留下 Rplots.pdf；導到 null 裝置擋掉。
if (!interactive()) pdf(NULL)

# --- 先報數字，確認沒問題再畫圖 -------------------------------------------
n_event  <- sum(cohort$status == 1)
n_censor <- sum(cohort$status == 0)
# 中位追蹤時間用 reverse Kaplan-Meier（把 censor 當成事件）
rev_km <- survfit(Surv(time, 1 - status) ~ 1, data = cohort)
med_fu <- summary(rev_km)$table[["median"]]

cat("== 整體存活 ==\n")
cat(sprintf("  病人數       : %d\n", nrow(cohort)))
cat(sprintf("  死亡 (event) : %d\n", n_event))
cat(sprintf("  設限 (censor): %d\n", n_censor))
cat(sprintf("  中位追蹤時間 : %.1f 個月（reverse KM）\n", med_fu))
cat(sprintf("  EPV 上限     : %d events 大約撐得起 %d 個共變項\n",
            n_event, floor(n_event / 10)))

fit_all <- survfit(Surv(time, status) ~ 1, data = cohort)
med_os  <- summary(fit_all)$table[["median"]]
cat(sprintf("  中位存活     : %.1f 個月\n", med_os))

# --- KM by stage_group ----------------------------------------------------
fit_stage <- survfit(Surv(time, status) ~ stage_group, data = cohort)
lr_stage  <- survdiff(Surv(time, status) ~ stage_group, data = cohort)
p_stage   <- 1 - pchisq(lr_stage$chisq, length(lr_stage$n) - 1)

cat("\n== KM by stage ==\n")
print(fit_stage)
cat(sprintf("  log-rank p = %.4g\n", p_stage))

g1 <- suppressWarnings(suppressMessages(ggsurvplot(
  fit_stage, data = cohort, risk.table = TRUE, pval = TRUE, conf.int = TRUE,
  legend.labs = c("advanced", "early"), legend.title = "Stage",
  xlab = "Months from enrollment", ylab = "Overall survival",
  palette = c("#c8663a", "#7b8794"), ggtheme = theme_minimal(base_size = 12),
  risk.table.height = 0.28
)))
suppressWarnings(suppressMessages(
  ggsave(here("figs", "km_by_stage.png"), plot = survminer:::.build_ggsurvplot(g1),
         width = 8, height = 6, dpi = 150)))

# --- KM by treatment ------------------------------------------------------
fit_tx <- survfit(Surv(time, status) ~ treatment, data = cohort)
lr_tx  <- survdiff(Surv(time, status) ~ treatment, data = cohort)
p_tx   <- 1 - pchisq(lr_tx$chisq, length(lr_tx$n) - 1)

cat("\n== KM by treatment ==\n")
print(fit_tx)
cat(sprintf("  log-rank p = %.4g\n", p_tx))

g2 <- suppressWarnings(suppressMessages(ggsurvplot(
  fit_tx, data = cohort, risk.table = TRUE, pval = TRUE, conf.int = TRUE,
  legend.labs = c("Drug_A", "Drug_B"), legend.title = "Treatment",
  xlab = "Months from enrollment", ylab = "Overall survival",
  palette = c("#c8663a", "#7b8794"), ggtheme = theme_minimal(base_size = 12),
  risk.table.height = 0.28
)))
suppressWarnings(suppressMessages(
  ggsave(here("figs", "km_by_treatment.png"), plot = survminer:::.build_ggsurvplot(g2),
         width = 8, height = 6, dpi = 150)))

# --- Cox model ------------------------------------------------------------
# 4 個共變項，69 events → EPV 約 17，站得住腳。
cox <- coxph(Surv(time, status) ~ age + sex + stage_group + treatment, data = cohort)
cox_tidy <- tidy(cox, exponentiate = TRUE, conf.int = TRUE) |>
  transmute(term,
            HR = round(estimate, 3),
            `95% CI` = sprintf("%.2f-%.2f", conf.low, conf.high),
            p = signif(p.value, 3))

cat("\n== Cox model ==\n")
print(as.data.frame(cox_tidy), row.names = FALSE)
write_csv(cox_tidy, here("output", "cox.csv"))

# --- 次族群：年齡 >=60 vs <60 ---------------------------------------------
# 探索性質。該看的是 interaction p，不是各組各自的 p。
sub <- cohort |>
  group_by(age_group) |>
  group_modify(~ {
    m <- coxph(Surv(time, status) ~ stage_group, data = .x)
    s <- summary(m)
    tibble(n = nrow(.x), events = sum(.x$status),
           HR = s$conf.int[1, 1],
           lo = s$conf.int[1, 3], hi = s$conf.int[1, 4],
           p  = s$coefficients[1, 5])
  }) |>
  ungroup()

cox_int <- coxph(Surv(time, status) ~ stage_group * age_group, data = cohort)
p_int   <- anova(cox_int)[["Pr(>|Chi|)"]][4]

cat("\n== 次族群（stage advanced vs early，依年齡分層）==\n")
print(as.data.frame(sub |> mutate(across(c(HR, lo, hi), ~ round(.x, 2)),
                                  p = signif(p, 3))), row.names = FALSE)
cat(sprintf("  interaction p = %.3f\n", p_int))
write_csv(sub, here("output", "subgroup.csv"))

forest <- sub |>
  mutate(label = sprintf("Age %s  (n=%d, %d events)", age_group, n, events))
p_forest <- ggplot(forest, aes(x = HR, y = label)) +
  geom_vline(xintercept = 1, linetype = "dashed", colour = "grey60") +
  geom_errorbar(aes(xmin = lo, xmax = hi), orientation = "y", width = 0.12, colour = "#7b8794") +
  geom_point(size = 3, colour = "#c8663a") +
  scale_x_log10() +
  labs(x = "Hazard ratio (advanced vs early), log scale", y = NULL,
       title = "Subgroup analysis by age",
       subtitle = sprintf("interaction p = %.3f  -  exploratory only", p_int)) +
  theme_minimal(base_size = 12)
suppressWarnings(suppressMessages(
  ggsave(here("figs", "forest_subgroup.png"), p_forest, width = 8, height = 3.2, dpi = 150)))

cat("\n== 產出 ==\n")
for (f in c("figs/km_by_stage.png", "figs/km_by_treatment.png",
            "figs/forest_subgroup.png", "output/cox.csv", "output/subgroup.csv")) {
  cat(sprintf("  %s\n", f))
}
