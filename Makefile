# 一個鍵重跑整條分析流程。
# 判準：三個月後資料更新了，你能不能按一個鍵重跑？

RSCRIPT := Rscript
PORT    := 8080

.PHONY: all clean serve check cast cast-claude snapshot site-figs

## all: 從 raw/ 重建所有產出（含同步網站用的圖）
all: output/cohort_clean.csv output/table1.html figs/km_by_stage.png site-figs

## site-figs: 網站用的是 figs/ 的複本，重跑分析後要同步過去
site-figs: figs/km_by_stage.png
	@command cp figs/*.png site/assets/figs/
	@echo "figs/ → site/assets/figs/ 已同步"

output/cohort_clean.csv: scripts/01_clean.R raw/cohort.csv
	$(RSCRIPT) scripts/01_clean.R

output/table1.html: scripts/02_describe.R output/cohort_clean.csv
	$(RSCRIPT) scripts/02_describe.R

figs/km_by_stage.png: scripts/03_survival.R output/cohort_clean.csv
	$(RSCRIPT) scripts/03_survival.R

## clean: 刪掉所有產出。raw/ 與 scripts/ 不動。
clean:
	rm -rf output figs Rplots.pdf

## check: 確認沒有 setwd() 或 rm(list=ls())，以及 site/ 的資產引用完整
check:
	@! grep -n 'setwd\|rm(list' scripts/*.R || (echo "找到禁用寫法" && exit 1)
	@echo "scripts/ 乾淨"
	@python3 scripts/check_slides.py
	@python3 scripts/check_casts.py
	@for f in figs/*.png; do \
	  cmp -s "$$f" "site/assets/$$f" || \
	    (echo "site/assets/$$f 與 $$f 不同步，請跑 make site-figs" && exit 1); \
	done
	@echo "figs/ 與 site/assets/figs/ 同步"
	@python3 scripts/check_site.py

## serve: 在本機預覽課程網站
serve:
	python3 scripts/serve.py $(PORT)

## cast: 重錄 shell 段的終端機影片（需要 tmux 與 asciinema）
cast:
	python3 scripts/record_cast.py

## cast-claude: 重錄 Claude Code 段（會實際跑一次 claude session）
cast-claude:
	python3 scripts/record_claude.py

## snapshot: 把目前的產出做成 reference-run 快照
snapshot:
	python3 scripts/make_reference_run.py
