/* casts.js — 錄影段落索引。
   .cast 由 scripts/record_cast.py（shell 段）與 scripts/record_claude.py
   （Claude Code 段）錄製，同名 .json 存 marker 定義。 */
window.CASTS = [
  { id: "01_cli",      title: "終端機七個指令",  time: "0:08 – 0:22",
    note: "我在哪、這裡有什麼、看檔案、搭架子。" },
  { id: "02_claude",   title: "交給 Claude Code", time: "0:22 – 0:40",
    // TUI 錄影不能 seek 到中段，預覽固定在啟動畫面
    poster: 11.5,
    note: "從看資料夾到寫出 01_clean.R。工作目錄只有 raw/cohort.csv，其餘檔案都由這段 session 產生。" },
  { id: "03_analysis", title: "跑分析",          time: "0:40 – 1:15",
    note: "清洗、Table 1、KM、Cox、次族群。數字先出來，圖再出來。" },
  { id: "04_rebuild",  title: "刪掉重建",        time: "1:25 – 1:30",
    note: "把產出全部刪掉，用三個指令長回來。" }
];
