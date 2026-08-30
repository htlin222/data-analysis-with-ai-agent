# -*- coding: utf-8 -*-
"""shell 段落的錄影定義。Claude Code 段見 scripts/record_claude.py。

每個 step 為 ("cmd", 指令, marker 標籤, 執行後等待秒數) 或 ("pause", 秒數)。
marker 標籤會顯示在 asciinema-player 的時間軸上，播放時在該點暫停。
"""

SEGMENTS = [
    {
        "id": "01_cli",
        "title": "CLI 基本功",
        "time": "0:08 – 0:35",
        "note": "定位、檢視、建立目錄結構。九個指令。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "pwd", "pwd — 目前所在目錄", 1.2),
            ("cmd", "ls", "ls — 列出目錄內容", 1.4),
            ("cmd", "ls -lh raw/", "ls -lh — 權限與大小", 2.2),
            ("pause", 1.5),
            ("cmd", "cd raw", "cd — 進入子目錄", 0.8),
            ("cmd", "pwd", "確認位置已改變", 1.2),
            ("cmd", "cd ..", "cd .. — 回上一層", 0.8),
            ("cmd", "pwd", "確認回到專案根目錄", 1.4),
            ("pause", 1.2),
            ("cmd", "head -5 raw/patient_data_for_survival.csv",
             "head -5 — 檔案開頭與欄位名", 2.4),
            ("cmd", "tail -3 raw/patient_data_for_survival.csv",
             "tail -3 — 檔案結尾", 2.2),
            ("cmd", "wc -l raw/*.csv", "wc -l — 行數，不等於個案數", 2.6),
            ("pause", 1.5),
            ("cmd", "cat raw/README.txt", "cat — 輸出整份檔案", 3.4),
            ("cmd", "tree -L 1", "tree — 目錄結構", 2.2),
        ],
    },
    {
        "id": "04_r_style",
        "title": "R 語言紀律",
        "time": "1:05 – 1:15",
        "note": "編號檔名、here()、禁用寫法的檢查。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "ls scripts/", "編號檔名即執行順序", 1.8),
            ("cmd", "grep -n 'here(' scripts/01_clean.R | head -5",
             "here() 取代 setwd()", 2.6),
            ("cmd", "grep -n 'setwd\\|rm(list' scripts/*.R",
             "檢查禁用寫法：無輸出即通過", 2.4),
            ("cmd", "make check", "把該檢查納入 Makefile", 2.4),
        ],
    },
    {
        "id": "05_table1",
        "title": "描述性與 Table 1",
        "time": "1:15 – 1:40",
        "note": "缺失值、單變項分布、gtsummary Table 1。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "Rscript scripts/02_describe.R",
             "執行描述性腳本", 14.0),
            ("pause", 2.5),
            ("cmd", "ls -lh output/", "確認產出檔案", 2.4),
            ("cmd", "head -4 output/table1.csv", "Table 1 的 CSV 版本", 2.6),
        ],
    },
    {
        "id": "06_survival",
        "title": "存活分析",
        "time": "1:40 – 2:05",
        "note": "event 數、EPV、KM、Cox、次族群。圖輸出到 figs/。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "Rscript scripts/03_survival.R",
             "執行存活分析：先數值後繪圖", 20.0),
            ("pause", 3.0),
            ("cmd", "ls -lh figs/", "圖檔已產生，另開視窗檢視", 2.4),
            ("cmd", "cat output/cox.csv", "Cox model 的估計值", 2.6),
            ("cmd", "cat output/subgroup.csv", "次族群的 HR 與區間", 2.6),
        ],
    },
    {
        "id": "07_rebuild",
        "title": "刪除後重建",
        "time": "2:05 – 2:10",
        "note": "刪除全部產出，以三個指令重建。",
        "steps": [
            ("pause", 1.2),
            ("cmd", "ls", "重建前的目錄", 1.6),
            ("cmd", "rm -rf output figs", "刪除全部產出", 1.2),
            ("cmd", "ls", "output/ 與 figs/ 已不存在", 1.8),
            ("pause", 1.2),
            ("cmd", "time (Rscript scripts/01_clean.R > /dev/null 2>&1 && "
                    "Rscript scripts/02_describe.R > /dev/null 2>&1 && "
                    "Rscript scripts/03_survival.R > /dev/null 2>&1)",
             "三個指令重建全部產出", 18.0),
            ("pause", 2.0),
            ("cmd", "ls output figs", "產出已全部回復", 3.0),
        ],
    },
]
