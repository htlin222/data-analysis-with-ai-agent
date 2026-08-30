raw/ — 原始資料，唯讀。不修改此目錄下的檔案。

patient_data.csv
  100 筆住院天數資料。欄位：patient_id, treatment (A/B), age, gender, los
  los = length of stay，單位為天。

patient_data_for_survival.csv
  100 筆存活資料。欄位：patient_id, treatment (Drug_A/Drug_B),
  age, gender, stage (I-IV), time (月), status (1=死亡, 0=設限)

patient_data_meta.csv
  文獻整合分析用的摘要資料。

已知限制：
  上述兩份主檔的 patient_id 皆為 1-100，但並非同一批個案。
  以 age 交叉比對，100 筆中僅 4 筆吻合。不可用 patient_id 合併。

來源：github.com/htlin222/learn-r-with-ai
