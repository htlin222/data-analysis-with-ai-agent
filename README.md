# 用終端機與 AI 做臨床資料分析

兩小時課程。對象為無終端機使用經驗的臨床醫師。
範圍自 `pwd` 至 Kaplan–Meier 與 forest plot。

課程網站有三個入口：

| 入口 | 內容 |
|---|---|
| **投影片** | 33 張。指令分組、處理決定的依據、輸出的判讀範圍。 |
| **終端機錄影** | 6 段 asciinema 實錄，含一段完整的 Claude Code session。播放在每個輸入點暫停。 |

錄影頁不套 16:9 舞台，播放器撐滿整個瀏覽器視窗。
三層說明預設隱藏，滑鼠靠近該側邊緣才浮現，靜止 2.6 秒後淡出：

| 位置 | 內容 | 觸發區 |
|---|---|---|
| 上 | 回首頁、段落標題、播放位置 | 上緣 96px |
| 左 | 六段軌、鍵盤說明 | 左緣 232px，且限視窗上半 |
| 右 | 輸入點清單，可點擊跳至該點 | 右緣 340px，且限視窗上半 |

兩個限制的理由：

- **觸發區寬度必須大於等於該層面板本身**，否則游標移到面板上會讓它消失。
  已展開的側欄另以 `:hover` 維持，因此在欄內往下移不會自己收起。
- **側邊只在上半部觸發**：游標往下移去按播放列時會經過側邊，
  若整條邊都是觸發區，側欄會在按到按鈕前彈出來擋住。

側欄的下緣不是寫死的數字，而是量 `.ap-bar` 的實際位置後扣掉——
`fit: "both"` 會把終端機置中，控制列跟著終端機盒子的底緣，不一定在視窗底部。
量測在載入後與 `ResizeObserver` 觸發時各做一次。

`?hud=1` 可將三層釘住。

兩者的觀看進度分別存在瀏覽器的 localStorage。

```bash
make serve          # http://localhost:8080
```

---

## 數值來源

網站上出現的每一段 console 輸出，均為 `scripts/` 下三支 R 腳本的實際執行結果。
原始輸出在 `reference-run/console/`，產出的 checksum 在 `reference-run/MANIFEST.tsv`。

驗證方式：

```bash
make clean && make      # 約 9 秒
```

## 錄影

兩支錄製器，都在 tmux 中啟動 `asciinema rec`，以 `send-keys` 輸入，
錄完後把 marker 事件寫入 `.cast`。

| 錄製器 | 對象 | 做法 | 段落 |
|---|---|---|---|
| `scripts/record_cast.py` | shell 與 Rscript | tmux + asciinema | `01_cli` `04_r_style` `05_table1` `06_survival` `07_rebuild` |
| `scripts/record_claude.py` | Claude Code TUI | 自行開 PTY | `02_claude` |

```bash
python3 scripts/record_cast.py              # shell 段全部重錄
python3 scripts/record_cast.py 01_cli       # 單段重錄
python3 scripts/record_claude.py            # Claude Code 段重錄
```

shell 段的定義在 `scripts/segments.py`，每個 step 為
`("cmd", 指令, marker 標籤, 執行後等待秒數)`。
Claude Code 段的提示詞在 `record_claude.py` 的 `PROMPTS`。

### TUI 不能透過 tmux 錄

第一版的 `record_claude.py` 走 tmux，播放時中文與 emoji 會疊在舊字上，
越到後面越髒。原因不是欄數（`.cast` 標頭本來就固定 100），也不是播放器
（`agg` 用同一顆模擬器渲染，結果一樣）：

tmux 會把 claude 的輸出重排進自己的格子，再送出「只重畫有變動的格子」的
最佳化序列，那些序列內含 tmux 的字寬假設。模擬器對 emoji、`⎿`、`✳`
算出的寬度不同，欄位一旦錯開，舊字就永遠不會被覆蓋。

改成自己 `openpty()` 直接跑 claude，錄的是 claude 本人吐出的序列，
中間沒有第二套排版邏輯，殘影消失。純 shell 的段落不受影響，
因為那是往下追加的輸出，不做游標定位重畫。

### 其他實作上的限制

- **marker 不能用牆鐘時間定位。** `asciinema --idle-time-limit` 在錄製當下即壓縮
  時間軸，驅動端的偏移與 cast 內部時間不成線性對應。改為在輸出串流中搜尋
  指令回顯（shell）或提示詞在輸入框的渲染（TUI）。
- **TUI 的回合結束不能用「連續 N 秒沒有輸出」判斷**：游標一直在閃，
  輸出永遠不會完全停。改看輸出速率——2 秒窗內少於 220 bytes 才算閒置。
- **等輸入框就緒還不夠**。`-- INSERT --` 出現之後，SessionStart hook
  的訊息才姍姍來遲，那次重繪會把已經打進去的字清掉。所以還要再等一次靜止，
  而且送出前要比對回顯、確認提示詞真的在輸入框裡，沒收到就 `Ctrl-U` 清行重打。
  這是唯一可靠的作法：不管畫面為什麼被重繪，字沒進去就不按 Enter。
- **錄到 `.cast.part`，六輪都完成才換上去。** 直接寫目標檔的話，
  中途失敗會把上一份完整錄影截斷，且無法復原。

驗證方式：`site/casts/02_claude.json` 的第一個與第二個 marker 若只差十秒左右，
就代表第一個提示詞被吃掉了——正常的一輪要幾十秒，而且兩個 marker 之間
應該找得到提示詞本身的回顯。
- **`tmux send-keys -l ";"` 的分號會被 tmux 自己的參數解析吃掉**，需送 `\;`。

Claude Code 段的工作目錄是 `$TMPDIR/dawa-claude-demo`，開始時只有 `raw/`，
其餘檔案全部由該 session 產生，不影響本專案。
本專案 `scripts/` 下的三支 R 腳本是該 session 產出後整理過的版本。

播放端為 asciinema-player 3.8.0（已 vendored 至 `site/assets/vendor/`），
設定 `pauseOnMarkers: true`。

---

## 部署

推到 `main` 且 `site/**` 有變動時，`.github/workflows/pages.yml` 會：

1. 跑 `scripts/check_site.py` 檢查資產引用完整性
2. 把 `?v=` 快取破解參數對齊當次 commit 的短 SHA
3. 上傳 `site/` 並部署到 GitHub Pages

站台：<https://htlin222.github.io/data-analysis-with-ai-agent/>

repo 是私有的，但 **Pages 站台是公開的**——私有 Pages 需要 Enterprise Cloud 方案。

`check_site.py` 會比對 `git ls-files` 而不只是工作目錄。這很重要：
全域 gitignore 的 `vendor/` 曾讓 `site/assets/vendor/` 的 asciinema-player
沒進版控，本機一切正常而線上整個錄影頁掛掉。

## 資料

`raw/` 下三份 CSV，來源為 [htlin222/learn-r-with-ai](https://github.com/htlin222/learn-r-with-ai)，權限設為唯讀。

| 檔案 | 列數 | 欄位 |
|---|---|---|
| `patient_data_for_survival.csv` | 100 | treatment · age · gender · stage · time · status |
| `patient_data.csv` | 100 | treatment · age · gender · los |
| `patient_data_meta.csv` | 8 | 文獻整合分析用 |

資料含兩個不產生警告的陷阱：

1. 兩份主檔的 `patient_id` 皆為 1–100。以 `age` 交叉比對，100 筆中僅 4 筆吻合，
   兩者並非同一批個案。執行 `left_join(by = "patient_id")` 會輸出 100 列、
   不產生警告，而全部欄位對應錯誤。
2. 同一 `treatment` 變項，一份檔案編碼為 `Drug_A`/`Drug_B`，另一份為 `A`/`B`。

## 執行結果

| 項目 | 值 |
|---|---|
| 個案數 / 死亡 / 設限 | 100 / 69 / 31 |
| 中位追蹤（reverse KM） | 36.0 月，對應行政設限 |
| 中位存活 | 17.5 月 |
| KM by stage | advanced 10.6 月，early 28.3 月，log-rank p = 0.0004 |
| KM by treatment | 17.5 月，17.7 月，log-rank p = 0.83 |
| Cox（4 個共變項，EPV ≈ 17） | stage early HR 0.39 (0.23–0.64)；age HR 1.035 |
| 次族群 by age | interaction p = 0.219；組內 p 為 0.0007 與 0.107 |

治療組無差異、分期有差異、次族群的組間對比為雜訊——三項構成本課程後半的判讀內容。

---

## 檔案結構

```
.github/workflows/pages.yml   推到 main 就部署 site/ 到 GitHub Pages
raw/            原始資料，唯讀
scripts/        01_clean.R → 02_describe.R → 03_survival.R
                record_cast.py · segments.py（shell 錄影）
                record_claude.py（Claude Code 錄影）
                serve.py（本機伺服器＋編輯寫檔端點）
                make_reference_run.py（產出快照）
                check_site.py（部署前的資產完整性檢查）
output/         清洗後資料與表格（可刪，由 make 重建）
figs/           圖檔（可刪，由 make 重建）
docs/           cleaning_log.md — 每項處理決定的依據
reference-run/  實際執行的 console 輸出與 checksum
site/
  index.html      首頁：兩個入口與觀看進度
  slides/         33 張投影片
  cast/           6 段 asciinema 錄影
  casts/          .cast 與 marker 定義
  assets/         共用 CSS/JS、產出的 PNG、vendored player
                  overrides.js — 就地編輯的定版結果
```

## 網站操作

| 鍵 | 投影片 | 終端機錄影 |
|---|---|---|
| `→` / `空白` | 下一步 | 繼續播放（在輸入點暫停後） |
| `←` | 上一步 | 倒退 |
| `↓` `↑` | 換張 | 換段 |
| `E` | 就地編輯 | — |
| `F` | 全螢幕 | 全螢幕 |
| `Esc` / `H` | 回首頁 | 回首頁 |

### 就地編輯

投影片按 `E` 進入編輯模式，所有含文字的元素可直接點擊修改。

修改先存在 localStorage（瀏覽器本機，**不是檔案，git 看不到**）。
按 `X` 存檔：`make serve` 啟動的伺服器有 `POST /_save` 端點，會把結果寫成
`site/assets/overrides.js`，該檔案由 git 追蹤。
以 `python3 -m http.server` 之類的靜態伺服器開啟時沒有該端點，`X` 會退回複製到剪貼簿，
需手動貼進同一個檔案。

`overrides.js` 在載入時作為基底，覆蓋 `slides.js` 的原始文字，
原始檔不需修改。清空該檔案即回到原始文字。

### 深層連結

```
slides/?s=25            第 25 張，完整顯示
slides/?s=25&edit=1     第 25 張並進入編輯模式
cast/?seg=3             第 3 段錄影
cast/?seg=3&play=1      第 3 段並自動播放
cast/?seg=3&hud=1       第 3 段並釘住說明層
```

## 授課節奏

| 時間 | 段落 | 錄影 |
|---|---|---|
| 0:00–0:08 | 概述：兩種操作模式與流程圖 | — |
| 0:08–0:35 | CLI 基本功 | `01_cli` |
| 0:35–1:05 | Claude Code：診斷、驗證、切點、寫腳本 | `02_claude` |
| 1:05–1:15 | R 語言紀律 | `04_r_style` |
| 1:15–1:40 | 描述性與 Table 1 | `05_table1` |
| 1:40–2:05 | 存活分析與次族群 | `06_survival` |
| 2:05–2:10 | 刪除後重建 | `07_rebuild` |

兩小時為壓縮後的配置。若逐項展開，實際約需 2.5 小時；
將次族群段降為預告可收在兩小時內。

## 依賴

R ≥ 4.5，套件：`tidyverse` `here` `gtsummary` `gt` `survival` `survminer` `broom`。
錄影需要 `tmux` 與 `asciinema` 2.x。網站為靜態檔案，無執行期依賴。
