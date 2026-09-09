# 重新設計：單一資料檔 · 90 分鐘 · end-to-end 存活分析

日期：2026-09-09
狀態：已完成

## 為什麼改

現況有三份 raw 檔，其中兩份的 `patient_id` 都是 1–100 但指向不同的人，
第三份（文獻整合分析）整門課沒用到。這個「撞號」是刻意設的坑，
用來撐起 0:35–1:05 的「診斷清單逐項核對」戲碼。

代價是：課程的前三分之一在教「怎麼發現資料有問題」，
而不是「怎麼做完一份存活分析」。決定拿掉這條線。

## 一、資料層

`raw/cohort.csv` 一份，取代現有三份。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `patient_id` | int | 1–100，唯一 |
| `age` | int | 31–81，**含少量 NA** |
| `sex` | chr | `F` / `M` |
| `stage` | chr | `I` / `II` / `III` / `IV` |
| `treatment` | chr | `Drug_A` / `Drug_B` |
| `time` | num | 追蹤月數，上限 36 |
| `status` | int | 1 = 死亡，0 = 設限 |

資料內容沿用現有 `patient_data_for_survival.csv`——它的統計性質已經驗證過，
而且對教學有利：**分期有明顯差異、治療組沒有差異、交互作用不顯著**。
三個結論各自對應一個教學點（有效果、陰性結果也是結果、次族群不能過度解讀）。

只做兩處改動：

1. `gender` 更名為 `sex`，清洗階段才轉中文標籤
2. `age` 植入 4 筆 `NA`

保留的兩項資料性質，它們不是「診斷題」，是分析途中必然遇到、
**必須在報告裡解釋**的東西：

- **`age` 缺失**：Cox model 會整列排除，實際 n 低於 100。若不看，模型的 n 是錯的。
- **行政設限**：31 筆設限中 25 筆 `time` 剛好等於 36。
  直接影響中位追蹤時間要用 reverse KM 估、不能用 `time` 的中位數。

刪除：`raw/patient_data.csv`、`raw/patient_data_meta.csv`。改寫 `raw/README.txt`。

## 二、腳本層

| 檔案 | 改動 |
|---|---|
| `01_clean.R` | 大幅簡化。移除跨檔 join 檢查與 `los_clean.csv`。保留缺失/範圍檢查、factor 標準化、`stage_group`、`age_group` |
| `02_describe.R` | 移除 los 相關，數字重跑 |
| `03_survival.R` | 不變，數字重跑 |
| `Makefile` | 相依改為單一 raw 檔 |

`stage_group`（I/II = early，III/IV = advanced）與 60 歲切點**維持為明示的臨床判斷**。
這是課程裡唯一保留的「AI 不能替你決定」的點，也是真的重要的那一個。

## 三、課程骨幹（90 分鐘）

| 時間 | 段落 | 內容 | 錄影 |
|---|---|---|---|
| 0:00–0:08 | 概述 | 為什麼是終端機、流程五步、資料規格 | — |
| 0:08–0:22 | CLI 最小集 | `pwd` `ls` `cd` `head` `tail` `mkdir` `tree`。定位為**監督 agent 所需的最小集**，不是終端機教學 | `01_cli` |
| 0:22–0:40 | 交給 Claude Code | 作用範圍、它會寫檔、臨床定義要你給。任務：讀 `cohort.csv` → 處理缺失 → 產出 `cohort_clean.csv` + `cleaning_log.md` | `02_claude` |
| 0:40–0:55 | Table 1 | 單變項分布、缺失值的實際影響、gtsummary、p value 的適用範圍 | `03_analysis` |
| 0:55–1:15 | 存活分析 | event/censor 數、行政設限、EPV、KM、Cox | `03_analysis` |
| 1:15–1:25 | 次族群 | forest plot、interaction p 的判讀 | — |
| 1:25–1:30 | 重建驗證 | `rm -rf output figs` → 三個指令重建 | `04_rebuild` |

## 四、投影片（33 → 約 20 張）

**刪除**（診斷戲碼相關，資料已不存在）：

- `wc -l 的計數` — shell trivia，與教 agent 無關
- `清單需要核對` — 六項診斷的核對表
- `唯一鍵` — 跨檔撞號
- `類別編碼` — 兩套編碼的坑
- `逐項處理` — 診斷清單的處理迴圈

**改寫**：

- `資料規格` — 改為單一檔
- `兩種提示方式` — 現有「過程中包含十餘項未經確認的決定」是空的斷言，
  沒有列出是哪些項目，聽眾無從得知指什麼。改為列出**這份資料裡實際的三項決定**：
  缺失值怎麼處理、`stage_group` 怎麼分、年齡切點取在哪
- `切點的決定` — 保留，這是課程唯一的臨床判斷點
- CLI 四張壓成兩張

**新增**：

- `缺失值的實際影響` — 從空談（現在缺失全為 0%）改為真的示範 Cox 的 n 下降

## 五、錄影（6 → 4 段）

`segments.py` 的 `01_cli` 移除 `wc -l` 與 `cat README.txt`，改為單一檔的 `head`/`tail`。
`04_r_style` 與 `05_table1` 合併進 `03_analysis`。
`02_claude` 需重跑一次真實 claude session（`make cast-claude`）。

## 六、執行順序

1. 產生 `raw/cohort.csv`，刪除另外兩份
2. 改寫 `01_clean.R`，重跑三個腳本
3. `make snapshot` 更新 reference-run
4. 依新數字改寫 `slides.js`
5. 改寫 `segments.py`，`make cast` 重錄 shell 段
6. `make cast-claude` 重錄 Claude Code 段
7. `make check` 驗證

第 6 步需要互動式授權，會實際跑一次 claude session。


---

## 實作結果

全部完成，`make check` 通過。與原設計的差異：

| 項目 | 設計 | 實際 |
|---|---|---|
| 投影片 | 約 20 張 | 22 張，全部配講者備忘稿（按 `N`） |
| 錄影 | 4 段 | 4 段，全部重錄 |
| 課程長度 | 90 分鐘 | 90 分鐘 |

設計階段沒預料到、實作時才處理的事：

1. **投影片密度**。原本每張三四條完整句子，講者只能照唸。改為一張一個圖或
   一組數字，論述移到備忘稿——`deck.js` 因此新增 notes 機制。
2. **Table 1 的同義反覆**。`stage` 與分組變項 `stage_group` 同時放進表裡，
   得到 0% / 100%。已從 `02_describe.R` 移除。
3. **`02_describe.R` 遇缺失即崩潰**。原腳本隱含假設無缺失，`quantile()`
   沒有 `na.rm`。引入 4 筆 NA 後才暴露出來。
4. **`figs/` 與 `site/assets/figs/` 不同步**。網站用的是複本，重跑分析後
   沒有同步機制，會顯示舊圖。已加 `make site-figs` 並納入 `make check`。
5. **`reference-run/console/` 是手動維護的**。資料改了卻不會更新，
   而投影片聲稱數字取自那裡。`make_reference_run.py` 改為一律重跑。
6. **`verify()` 從未被呼叫**。`record_claude.py` 寫好了驗收函式卻沒接上，
   換檔條件只有「marker 數量足夠」——結果是用空轉的錄影蓋掉完整的那份。
7. **錄影會錄進操作者的個人環境**。hooks 的輸出、statusLine 的模型與額度、
   全域 CLAUDE.md 的內容。而且 `SessionStart` 的輸出比輸入框就緒晚，
   那次重繪會把提示詞清掉，前幾輪因此空轉。詳見 README 的錄影章節。

新增三道檢查，都納入 `make check` 與 CI：

| 檢查 | 內容 |
|---|---|
| `check_slides.py` | 標籤閉合、圖檔存在、`data-step` 連續、備忘稿非空、**結果數字可回溯到 `reference-run/`** |
| `check_casts.py` | 錄影不含個人環境字串、每一輪都真的跑過模型 |
| `make check` 內 | `figs/` 與 `site/assets/figs/` 同步 |
