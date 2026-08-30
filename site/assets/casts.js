/* casts.js — 錄影段落索引。
   .cast 由 scripts/record_cast.py（shell 段）與 scripts/record_claude.py
   （Claude Code 段）錄製，同名 .json 存 marker 定義。 */
window.CASTS = [
  { id: "01_cli",      title: "CLI 基本功",       time: "0:08 – 0:35",
    note: "定位、檢視、建立目錄結構。九個指令。" },
  { id: "02_claude",   title: "Claude Code",      time: "0:35 – 1:05",
    // TUI 錄影不能 seek 到中段，預覽固定在啟動畫面
    poster: 11.5,
    note: "從觀察資料夾到寫出 01_clean.R。工作目錄只有 raw/，其餘檔案由這段 session 產生。" },
  { id: "04_r_style",  title: "R 語言紀律",       time: "1:05 – 1:15",
    note: "編號檔名、here()、禁用寫法的檢查。" },
  { id: "05_table1",   title: "描述性與 Table 1", time: "1:15 – 1:40",
    note: "缺失值、單變項分布、gtsummary Table 1。" },
  { id: "06_survival", title: "存活分析",         time: "1:40 – 2:05",
    note: "event 數、EPV、KM、Cox、次族群。圖輸出到 figs/。" },
  { id: "07_rebuild",  title: "刪除後重建",       time: "2:05 – 2:10",
    note: "刪除全部產出，以三個指令重建。" }
];
