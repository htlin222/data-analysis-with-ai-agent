# 用終端機與 AI 做臨床資料分析

90 分鐘課程。對象為無終端機使用經驗的臨床醫師。
一份 `raw/cohort.csv`，走到 Kaplan–Meier 與 forest plot。

課程網站有三個入口：

| 入口 | 內容 |
|---|---|
| **投影片** | 22 張。圖與數字為主，論述在講者備忘稿（按 `N` 展開）。 |
| **終端機錄影** | 4 段 asciinema 實錄，含一段完整的 Claude Code session。播放在每個輸入點暫停。 |

錄影頁不套 16:9 舞台，播放器撐滿整個瀏覽器視窗。
三層說明預設隱藏，滑鼠靠近該側邊緣才浮現，靜止 2.6 秒後淡出：

| 位置 | 內容 | 觸發區 |
|---|---|---|
| 上 | 回首頁、段落標題、播放位置 | 上緣 96px |
| 左 | 四段軌、鍵盤說明 | 左緣 232px，且限視窗上半 |
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
make clean && make      # 約 6 秒
```

## 錄影

兩支錄製器，都在 tmux 中啟動 `asciinema rec`，以 `send-keys` 輸入，
錄完後把 marker 事件寫入 `.cast`。

| 錄製器 | 對象 | 做法 | 段落 |
|---|---|---|---|
| `scripts/record_cast.py` | shell 與 Rscript | tmux + asciinema | `01_cli` `03_analysis` `04_rebuild` |
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
- **錄到 `.cast.part`，五輪都完成才換上去。** 直接寫目標檔的話，
  中途失敗會把上一份完整錄影截斷，且無法復原。

驗證方式：`site/casts/02_claude.json` 的第一個與第二個 marker 若只差十秒左右，
就代表第一個提示詞被吃掉了——正常的一輪要幾十秒，而且兩個 marker 之間
應該找得到提示詞本身的回顯。
- **`tmux send-keys -l ";"` 的分號會被 tmux 自己的參數解析吃掉**，需送 `\;`。

### 錄製環境必須與操作者的環境隔離

直接錄會把操作者本人的環境一起錄進去：全域 hooks 的輸出、statusLine 的
模型與額度、`~/.claude/CLAUDE.md` 的內容。這不只是美觀問題——
`SessionStart` 的輸出比輸入框就緒還晚，那次重繪會把已經打進去的提示詞清掉，
前幾輪因此空轉，而錄影看起來完全正常。

`record_claude.py` 因此以 `CLAUDE_CONFIG_DIR` 指向 `$TMPDIR/dawa-claude-config`，
只帶登入狀態，不帶 hooks、statusLine 與全域 CLAUDE.md。過程中的三個坑：

| 症狀 | 原因 |
|---|---|
| 停在主題選擇畫面 | 全新設定目錄被當成第一次啟動。需預寫 `hasCompletedOnboarding` |
| 停在信任對話框 | macOS 的 `$TMPDIR` 是 `/var/…` 的符號連結，claude 記的是解析後的 `/private/var/…`。兩個路徑都要寫進 `projects` |
| `Not logged in` | 登入狀態綁在設定目錄上。改以 `security find-generic-password -s "Claude Code-credentials"` 從 Keychain 取出 `claudeAiOauth` 寫入隔離目錄 |

`--bare` 看似對症（跳過 hooks 與 CLAUDE.md），但它同時停用 OAuth 與 keychain，
只認 `ANTHROPIC_API_KEY`，訂閱制登入無法使用。

### 驗收必須真的被呼叫

`verify()` 原本寫好了卻沒有接上 `record()`，換檔的條件只有「marker 數量足夠」。
但提示詞沒送出時 marker 一樣會被記下來——結果是用一份空轉的錄影，
蓋掉上一份完整的。現在換檔前會檢查每一輪是否都有回答、且耗時超過 20 秒，
未通過就保留原檔。`scripts/check_casts.py` 以同樣的判準在 `make check` 時再驗一次，
並掃描錄影裡是否含個人環境的字串。

Claude Code 段的工作目錄是 `$TMPDIR/dawa-claude-demo`，開始時只有 `raw/`，
其餘檔案全部由該 session 產生，不影響本專案。
本專案 `scripts/` 下的三支 R 腳本是該 session 產出後整理過的版本。

播放端為 asciinema-player 3.8.0（已 vendored 至 `site/assets/vendor/`），
設定 `pauseOnMarkers: true`。

---

## 部署

站台：<https://data-analysis-with-ai-agent.hsieh-ting-lin.workers.dev>

```bash
./tools/deploy.sh        # 讀 .env，把 site/ 送上去
```

憑證放在 `.env`（不進版控，範本見 `.env.example`）。本機跑過 `wrangler login`
的話 token 可以留空，`deploy.sh` 會改用該 OAuth session。

Cloudflare 已把 Pages 併入 Workers，`wrangler pages` 的指令會委派過去，
因此設定寫在 `wrangler.jsonc`，以 Workers Static Assets 送出 `site/`——
沒有 Worker 程式碼，只宣告要送哪個目錄。

### 為什麼不是 GitHub Pages

`.github/workflows/pages.yml` 仍留著，但目前不會執行：private repo 的
GitHub Actions 分鐘數要計費，額度中斷時 job 根本不啟動（`The job was not
started because recent account payments have failed`），推上去也不會部署。

改成公開 repo 可以解決計費，但 `a5fb6a9` 的歷史裡有一份舊錄影，
含操作者的 hooks 輸出與全域 CLAUDE.md 片段——那正是後來重錄的原因。
公開之前要先清掉那個 blob。Cloudflare 這條路兩者都不需要。

`check_site.py` 會比對 `git ls-files` 而不只是工作目錄。這很重要：
全域 gitignore 的 `vendor/` 曾讓 `site/assets/vendor/` 的 asciinema-player
沒進版控，本機一切正常而線上整個錄影頁掛掉。

## 資料

`raw/cohort.csv` 一份，來源為 [htlin222/learn-r-with-ai](https://github.com/htlin222/learn-r-with-ai)，權限設為唯讀。
單一檔案即 single source of truth，課程全程不做跨檔合併。

| 欄位 | 內容 |
|---|---|
| `patient_id` | 1–100，唯一 |
| `age` | 31–81，**含 4 筆缺失** |
| `sex` · `stage` · `treatment` | F/M · I–IV · Drug_A/Drug_B |
| `time` · `status` | 追蹤月數（上限 36）· 1 = 死亡，0 = 設限 |

資料含兩項既有性質。它們不是錯誤，是分析途中必然遇到、且必須在報告裡解釋的東西：

1. **`age` 有 4 筆缺失。** Cox model 會整列排除，實際 n 為 96、events 66，
   而且不產生任何警告——因此 `03_survival.R` 明確印出模型實際的 n。
2. **行政設限。** 31 筆設限中有 25 筆 `time` 剛好等於 36（最長追蹤）。
   中位追蹤時間因此需以 reverse KM 估計，不能取 `time` 的中位數。

## 執行結果

| 項目 | 值 |
|---|---|
| 個案數 / 死亡 / 設限 | 100 / 69 / 31 |
| 中位追蹤（reverse KM） | 36.0 月，對應行政設限 |
| 中位存活 | 17.5 月 |
| KM by stage | advanced 10.6 月，early 28.3 月，log-rank p = 0.0004 |
| KM by treatment | 17.5 月，17.7 月，log-rank p = 0.83 |
| Cox（實際 96 人 66 events，EPV 16.5） | stage early HR 0.404 (0.24–0.67)；age HR 1.036 |
| 次族群 by age | interaction p = 0.246；組內 p 為 0.0014 與 0.107 |

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
                make_reference_run.py（重跑腳本並產出快照）
                check_site.py（部署前的資產完整性檢查）
                check_slides.py（投影片結構與數字出處檢查）
output/         清洗後資料與表格（可刪，由 make 重建）
figs/           圖檔（可刪，由 make 重建）
docs/           cleaning_log.md — 每項處理決定的依據
reference-run/  實際執行的 console 輸出與 checksum
demo/           學員練習資料夾：README.md、PROMPTS.md、raw/ 的複本
                學員產生的 scripts/ output/ figs/ docs/ 不進版控
site/
  index.html      首頁：兩個入口與觀看進度
  slides/         22 張投影片
  cast/           4 段 asciinema 錄影
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
| `N` | 講者備忘稿 | — |
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

## 學員練習

`demo/` 是學員自己動手的地方，內含 `raw/cohort.csv` 的複本與全部提示詞。

```bash
cd demo        # 整堂課都待在這裡
```

`claude` 在哪裡啟動就只看得到那裡——在專案根目錄啟動的話，它會看到 `scripts/`
底下的成品直接照抄一份，練習就沒了。因此 `demo/` 自帶一份資料，
且不含任何 `.R`。學員產生的四個資料夾由 `.gitignore` 擋掉，隨時可以 `rm -rf` 重來。

| 檔案 | 內容 |
|---|---|
| `demo/README.md` | 流程、對答案的數字、卡住時的處理 |
| `demo/PROMPTS.md` | 可直接複製貼上。P1–P5 與 `record_claude.py` 的 `PROMPTS` 逐字相同，其餘各段依同一原則寫成 |

`claude`、R 與課程用的七個套件由 devcontainer 備妥，開機即可用：

| 位置 | 做的事 | 失敗時 |
|---|---|---|
| `claude-code` feature | 裝 Claude Code CLI 到 `/usr/local/bin` | 建置失敗 |
| `r-apt` feature（`installBspm`） | 裝 R，並開啟 bspm——`install.packages()` 因此走 r2u 的二進位 .deb | 建置失敗 |
| `prewarm.sh`（`onCreateCommand`） | dotfiles：zsh、tmux、neovim | **警告後繼續** |
| `install-r-packages.sh`（`updateContentCommand`） | 裝七個套件，失敗重試三次 | 建置失敗 |
| `verify.sh`（`postCreateCommand`） | 逐項驗收 | 建置失敗 |

只有 dotfiles 那一層是「有更好、沒有也能上課」，因此它是唯一不擋建置的。
課程真正需要的東西全部硬失敗——寧可 Codespace 建不起來，也不要學員坐下來才發現。

三個決定的理由：

- **`installBspm` 不是可選的細節。** 從原始碼編譯 `survminer` 這一串在 2 core 的 Codespace
  要十幾分鐘，走 r2u 約一兩分鐘。`vscodeRSupport` 設 `none`，這門課只用終端機。
- **`claude` 有兩份是刻意的。** feature 裝的在 `/usr/local/bin`，dotfiles prewarm 另外裝一份
  到 `~/.local/bin`；`remoteEnv` 把後者排在前面，所以實際跑到的是 prewarm 那份。
  prewarm 來自另一個 repo，它掛掉的時候 feature 那份還在 PATH 上，課還是上得下去。
- **驗收放在建置的最後一步。** 套件裝起來卻載不動（缺系統相依）只會在第一次 `library()`
  時才爆，`claude` 不在 PATH 也一樣——那時候學員已經坐在螢幕前了。
  `verify.sh` 失敗會讓 Codespace 建置失敗，並印出下一步該做什麼。

三個沉默的失敗，都是實際驗證過才改的：

| 原本的寫法 | 為什麼會無聲無息地成功 |
|---|---|
| `curl -fsSL ... \| bash` | 管線的離開碼取自右邊的 `bash`。curl 404 時 stdin 是空的，`bash` 跑完回 0——什麼都沒裝，卻回報成功 |
| `install.packages(miss)` | 裝不起來時只發 warning，不設離開碼。要自己回頭比對 `installed.packages()` 才知道 |
| `verify.sh` 用相對路徑找資料 | 學員多半是 `cd demo` 之後才想到要檢查，那時相對路徑指到不存在的地方。改以 `BASH_SOURCE` 定位 |

`verify.sh` 從任何目錄跑都可以，學員自己重跑也行。

`demo/PROMPTS.md` 的 **P0** 是給不在 Codespace 練習的人用的安裝提示詞。

## 授課節奏

| 時間 | 段落 | 投影片 | 錄影 |
|---|---|---|---|
| 0:00–0:08 | 開場：路線與資料 | 1–3 | — |
| 0:08–0:22 | 終端機七個指令 | 4–6 | `01_cli` |
| 0:22–0:40 | 交給 Claude Code：三個決定 | 7–10 | `02_claude` |
| 0:40–0:55 | 描述性與 Table 1 | 11–13 | `03_analysis` |
| 0:55–1:15 | 存活分析：KM 與 Cox | 14–18 | `03_analysis` |
| 1:15–1:25 | 次族群與 interaction | 19–20 | — |
| 1:25–1:30 | 刪掉重建 | 21–22 | `04_rebuild` |

投影片刻意寫得少：一張一個圖或一組數字，論述放在講者備忘稿（按 `N`）。
時間分配可依現場調整——0:22–0:40 那段（三個決定）是全課核心，不建議壓縮。

## 依賴

R ≥ 4.5，套件：`tidyverse` `here` `gtsummary` `gt` `survival` `survminer` `broom`。
錄影需要 `tmux` 與 `asciinema` 2.x。網站為靜態檔案，無執行期依賴。
