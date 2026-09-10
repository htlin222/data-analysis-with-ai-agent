# 提示詞清單

複製、貼上、按 Enter。**一次一個，等它做完再貼下一個。**

P1–P5 與課程錄影中那一段真實 session 使用的提示詞逐字相同。
其餘各段依同一原則寫成：先看、再講、你決定、才動手。

> 開始前確認位置：`cd demo && pwd`，結尾要是 `/demo`。
> 提示詞裡所有路徑都相對於 `demo/`。

---

## P0 · 只有在沒有 R 的環境才需要

Codespace 已經內建 R 與課程用的七個套件（見 `.devcontainer/`），**上課時跳過這一段**。
在自己的電腦上練習、而 `Rscript --version` 沒有反應時才用。

```
這台機器沒有 R。請幫我裝 R 以及這些套件：tidyverse、here、gtsummary、gt、survival、survminer、broom。

這是 Ubuntu 的 Codespace，請用預先編譯好的二進位套件（例如 Posit Public Package Manager 對應本機 Ubuntu 版本的 repo），不要從原始碼編譯——從原始碼編譯 survminer 這一串會跑很久。

裝完跑一次 Rscript -e 'library(survminer); sessionInfo()' 確認，把結果貼給我看。
```

---

## 第 1 段 · 七個指令（不用 AI）

這七個指令請自己打。它們決定了 AI 等一下看得到什麼。

```bash
pwd                       # 我在哪
ls                        # 這裡有什麼
cd raw                    # 進去
pwd                       # 位置真的變了
cd ..                     # 退回上一層
head -3 raw/cohort.csv    # 看前三行與欄位名
tail -3 raw/cohort.csv    # 看最後三行
cat raw/README.txt        # 讀完整份說明
mkdir -p scripts output figs docs   # 搭好架子（raw 已經有了）
ls
```

`cd` 不是白學的：**它決定 AI 的工作範圍。** 確認自己在 `demo/` 裡面，再打 `claude`。

---

## 第 2 段 · 先讓它看，還不下指令

### P1 — 先讓它看

```
請看一下這個資料夾，告訴我裡面有什麼。
```

### P2 — 先看清楚資料，還是不要它動手

```
讀 raw/cohort.csv，用中文告訴我這份資料長什麼樣：幾個人、幾個欄位、有沒有缺失、追蹤時間到哪裡。先不要做任何修改。
```

> 最後一句是重點。這不是聊天視窗，它動的是你硬碟上真的檔案——
> 不講「先不要修改」，它可能已經開始寫了。

---

## 第 3 段 · 三個決定

### P3 — 讓它先說，不要讓它自己選

```
我要做存活分析。在你動手之前，先告訴我三件事你打算怎麼做：age 的缺失怎麼處理、stage 怎麼分成 early 和 advanced、年齡要切在幾歲。請直接用文字說明，不要給我選單。
```

> 這三個問題沒有一個是統計問題，全都是臨床問題。
> 它不會問你，它會挑一個常見的做法然後繼續往下做。看它挑了什麼，再決定接不接受。

### P4 — 你決定完了，才輪到它動手

```
缺失不要補值，讓模型自己排除。stage 用 I/II vs III/IV。年齡切 60。把清洗寫成 scripts/01_clean.R，要用 here::here() 不要用 setwd()，也不要 rm(list=ls())。所有決定寫成 docs/cleaning_log.md，清洗後的資料存成 output/cohort_clean.csv。
```

> 最後一句（把決定寫下來）沒有的話，它一樣會做完，但你三個月後說不出它做了什麼。

### P5 — 執行並確認產出

```
執行 scripts/01_clean.R，把輸出貼給我看。
```

**對答案**：100 列 × 7 欄讀入 → age 缺失 4 筆 → 死亡 69 / 設限 31，其中 25 筆 `time = 36` →
產出 `output/cohort_clean.csv`，100 列 × 9 欄。

---

## 第 4 段 · 描述性與 Table 1

### P6 — 寫 02_describe.R

```
寫 scripts/02_describe.R，從 output/cohort_clean.csv 讀進來，不要重跑清洗。

先印出三塊：各變項的缺失數與比例、連續變項的 median (IQR)（n 要算「有值」的筆數，不是總列數）、類別變項的 n (%)。

再用 gtsummary 做 Table 1，依 stage_group 分組，存成 output/table1.html 和 output/table1.csv。

stage 不要放進 Table 1：分組變項 stage_group 就是由它定義的，放進去只會得到 0% / 100% 的同義反覆。

一樣用 here::here()。
```

### P7 — 執行，然後問它一個問題

```
執行 scripts/02_describe.R。然後告訴我：Table 1 裡「年齡」那一列的 N 是 96，其他列都是 100，為什麼？這件事對接下來的 Cox model 有什麼影響？
```

> 這一問是刻意的。答案（96 人 66 events）等一下會在 Cox 那裡再出現一次，
> 而 R **不會為此發出任何警告**。

---

## 第 5 段 · 存活分析

### P8 — 寫 03_survival.R

```
寫 scripts/03_survival.R，一樣從 output/cohort_clean.csv 讀。數字印到 console，圖存到 figs/。

1. 整體存活：病人數、死亡數、設限數、中位存活。中位追蹤時間請用 reverse Kaplan-Meier 估計，不要取 time 的中位數——設限裡有一大批剛好等於 36 的行政設限。
2. KM by stage_group，以及 KM by treatment。兩張都要 log-rank p、信賴區間、risk table，存成 figs/km_by_stage.png 與 figs/km_by_treatment.png。
3. Cox model：age + sex + stage_group + treatment，輸出 HR 與 95% CI，存成 output/cox.csv。

Cox 那段請明確印出模型「實際使用」的 n 與 events，以及被整列排除了幾筆——這個數字不會出現在 HR 的表格裡。

一樣用 here::here()，不要 setwd()，不要 rm(list=ls())。
```

### P9 — 執行

```
執行 scripts/03_survival.R，把 console 輸出全部貼給我看。
```

**對答案**：中位追蹤 36.0 月 · 中位存活 17.5 月 · stage p = 0.0004 · treatment p = 0.83 ·
Cox 實際 96 人 66 events，stage early HR 0.404（0.24–0.67）。

### P10 — 判讀，不是產生

```
treatment 的 log-rank p = 0.83，Cox 裡 Drug_B 的 HR 是 0.79（0.46–1.34）。我可以在報告裡寫「兩種藥療效相當」嗎？請直接講你的理由，包括這個樣本數能偵測到多大的差異。
```

---

## 第 6 段 · 次族群與 interaction

### P11 — 加上次族群

```
在 scripts/03_survival.R 後面加一段次族群分析：依年齡分層（>=60 vs <60），各自估 stage advanced vs early 的 HR，畫成 forest plot 存到 figs/forest_subgroup.png，數字存成 output/subgroup.csv。

必須印出 interaction p。另外，age 缺失的那幾筆無法分層，請把排除的筆數明確印出來，不要讓它默默消失。

圖的副標題請標明這是探索性分析。
```

### P12 — 這一題才是重點

```
兩個次族群的 p，一個是 0.0014，一個是 0.107，但 interaction p = 0.246。我可以說「年輕病人從早期診斷得到的好處比較大」嗎？
```

> 不行。組內各自檢定不能拿來做組間比較，而年齡切點是我們事後才定的。
> 讓它把這兩個理由講清楚，你才知道它是真的懂，還是在附和你。

---

## 第 7 段 · 刪掉重建

先自己刪：

```bash
ls
rm -rf output figs
ls                        # output/ 與 figs/ 不見了
```

### P13 — 讓它變成一個鍵

```
幫我寫一個 Makefile 放在這個資料夾，讓我可以：

- make        依序跑 01_clean.R → 02_describe.R → 03_survival.R，重建 output/ 與 figs/
- make clean  刪掉 output/ figs/ 與 Rplots.pdf，但絕對不動 raw/ 和 scripts/

用檔案相依性寫（例如 output/cohort_clean.csv 相依於 scripts/01_clean.R 和 raw/cohort.csv），不要每次都全部重跑。
```

然後驗收：

```bash
make clean && make
ls output figs
```

**長得回來，流程才算完整。長不回來，就表示中間有一步只存在你的記憶裡。**

---

## 附錄 · 卡住時的救援提示詞

### P-救援 1 — 它報錯了

```
執行時出現這段錯誤，請先告訴我是哪一行、為什麼，再修：

（把整段錯誤訊息原封不動貼在這裡）
```

> 不要自己轉述錯誤訊息。原文貼上，它才看得到行號與呼叫堆疊。

### P-救援 2 — 它動了原始資料

```
raw/ 是唯讀的，任何情況下都不要修改或覆蓋 raw/cohort.csv。請檢查你剛剛有沒有動到它，有的話告訴我。之後所有產出一律寫到 output/ 或 figs/。
```

還原（在 `demo/` 裡執行）：`git checkout raw/`

### P-救援 3 — 它寫了不該寫的東西

```
請檢查 scripts/ 下的所有 .R，把 setwd() 改成 here::here()，並移除 rm(list = ls())。改完把你動過哪幾行列給我看。
```

自己驗：`grep -n 'setwd\|rm(list' scripts/*.R`（沒有輸出就是乾淨的）

### P-救援 4 — 你不知道它剛剛做了什麼

```
把你到目前為止做過的每一個處理決定，逐條寫進 docs/cleaning_log.md。每一條要有：原始狀態、處理方式、影響幾筆、為什麼這樣做。不要只寫「已完成清洗」。
```

### P-救援 5 — 它給你一大串選單

```
請直接用文字說明你的建議和理由，不要給我選項清單，也不要問我要選哪一個。
```
