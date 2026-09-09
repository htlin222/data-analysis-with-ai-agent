# -*- coding: utf-8 -*-
"""shell 段落的錄影定義。Claude Code 段見 scripts/record_claude.py。

每個 step 為 ("cmd", 指令, marker 標籤, 執行後等待秒數) 或 ("pause", 秒數)。
marker 標籤會顯示在 asciinema-player 的時間軸上，播放時在該點暫停。
"""

SEGMENTS = [
    {
        "id": "01_cli",
        "title": "終端機七個指令",
        "time": "0:08 – 0:22",
        "note": "我在哪、這裡有什麼、看檔案、搭架子。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "pwd", "pwd — 我在哪", 1.4),
            ("cmd", "ls", "ls — 這裡有什麼", 1.6),
            ("pause", 1.2),
            ("cmd", "cd raw", "cd — 進去 raw", 0.8),
            ("cmd", "pwd", "位置真的變了", 1.4),
            ("cmd", "cd ..", "cd .. — 退回上一層", 0.8),
            ("cmd", "pwd", "回到專案根目錄", 1.6),
            ("pause", 1.4),
            ("cmd", "head -3 raw/cohort.csv", "head -3 — 看前三行與欄位名", 2.6),
            ("cmd", "tail -3 raw/cohort.csv", "tail -3 — 看最後三行", 2.4),
            ("cmd", "cat raw/README.txt", "cat — 讀完整份說明", 3.6),
            ("pause", 1.4),
            ("cmd", "mkdir -p /tmp/demo/{raw,scripts,output,figs,docs}",
             "mkdir -p — 一次搭好五個資料夾", 1.2),
            ("cmd", "tree /tmp/demo", "tree — 確認架子搭好了", 2.6),
        ],
    },
    {
        "id": "03_analysis",
        "title": "跑分析",
        "time": "0:40 – 1:15",
        "note": "清洗、Table 1、KM、Cox、次族群。數字先出來，圖再出來。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "Rscript scripts/01_clean.R",
             "清洗：注意 4 筆缺失與 25 筆行政設限", 16.0),
            ("pause", 2.5),
            ("cmd", "Rscript scripts/02_describe.R",
             "描述性與 Table 1", 16.0),
            ("pause", 2.5),
            ("cmd", "head -3 output/table1.csv", "Table 1 的 N 是 96，不是 100", 3.0),
            ("pause", 1.5),
            ("cmd", "Rscript scripts/03_survival.R",
             "存活分析：先數值，後繪圖", 22.0),
            ("pause", 3.0),
            ("cmd", "cat output/cox.csv", "Cox 的 HR 與區間", 3.0),
            ("cmd", "cat output/subgroup.csv", "次族群：該看 interaction p", 3.0),
            ("cmd", "ls figs/", "圖已產生，另開視窗看", 2.6),
        ],
    },
    {
        "id": "04_rebuild",
        "title": "刪掉重建",
        "time": "1:25 – 1:30",
        "note": "把產出全部刪掉，用三個指令長回來。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "ls", "重建前", 1.8),
            ("cmd", "rm -rf output figs", "把產出全部刪掉", 1.4),
            ("cmd", "ls", "output/ 與 figs/ 不見了", 2.0),
            ("pause", 1.4),
            ("cmd", "time (Rscript scripts/01_clean.R > /dev/null 2>&1 && "
                    "Rscript scripts/02_describe.R > /dev/null 2>&1 && "
                    "Rscript scripts/03_survival.R > /dev/null 2>&1)",
             "三個指令，全部長回來", 20.0),
            ("pause", 2.0),
            ("cmd", "ls output figs", "產出回來了。raw/ 和 scripts/ 沒動過", 3.2),
        ],
    },
]
