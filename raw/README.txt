raw/ — 原始資料，唯讀。不修改此目錄下的檔案。

cohort.csv
  100 筆存活分析資料。一列一個病人。
  欄位：patient_id, age, sex (F/M), stage (I-IV),
        treatment (Drug_A/Drug_B), time (月), status (1=死亡, 0=設限)

已知性質（分析時必須處理，不是錯誤）：
  age 有 4 筆缺失。Cox model 會整列排除，實際 n 低於 100。
  追蹤上限為 36 個月。31 筆設限中有 25 筆 time 剛好等於 36，
  屬行政設限。中位追蹤時間需以 reverse KM 估計。

資料為模擬產生。
來源：github.com/htlin222/learn-r-with-ai
