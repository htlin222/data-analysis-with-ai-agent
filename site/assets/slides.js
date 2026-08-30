/* slides.js — 投影片內容
   所有數值取自 reference-run/console/*.txt，
   即 scripts/01_clean.R … 03_survival.R 的實際執行輸出。 */
(function (root) {
  "use strict";

  var S = [];
  function push(act, title, cls, html) { S.push({ act: act, title: title, cls: cls || "", html: html }); }

  /* ===================== 0:00–0:08　概述 ============================== */

  push("概述", "標題", "", `
    <div class="eyebrow">兩小時 · shell · Claude Code · R</div>
    <h1 class="display">用終端機與 AI<br>做臨床資料分析</h1>
    <p class="lede">對象為無終端機使用經驗的臨床醫師。課程產出為一組可以單一指令重跑的分析流程。</p>
    <div class="title-meta">
      <div><div class="k">資料</div><div class="v">100 人存活世代（模擬）</div></div>
      <div><div class="k">終點</div><div class="v">Overall survival</div></div>
      <div><div class="k">工具</div><div class="v">shell · Claude Code · R</div></div>
      <div><div class="k">長度</div><div class="v">約 2 小時</div></div>
    </div>`);

  push("概述", "兩種操作模式", "", `
    <div class="claim" data-step="1">GUI 由介面代為定位檔案。<br>
      CLI 由操作者直接指定路徑。</div>
    <p class="lede" style="margin-top:34px" data-step="2">
      差別不在難易，而在於 <b>CLI 的每一步都可寫成文字並重複執行</b>。</p>
    <div class="claim sm" data-step="3" style="border-color:var(--hair-2)">本課程的全部內容由此展開。</div>`);

  push("概述", "分析流程", "top", `
    <h2 class="head">分析流程共七步</h2>
    <p class="lede">每個箭頭對應一段程式碼，而非一次介面操作。</p>
    <div class="pipe">
      <div class="node" data-step="1"><div class="t">原始資料</div><div class="d">raw/ · 唯讀</div></div>
      <div class="ar" data-step="1">→</div>
      <div class="node" data-step="2"><div class="t">檢查</div><div class="d">唯一鍵 · 編碼 · 缺失</div></div>
      <div class="ar" data-step="2">→</div>
      <div class="node" data-step="3"><div class="t">分析資料集</div><div class="d">cohort_clean.csv</div></div>
      <div class="ar" data-step="3">→</div>
      <div class="node" data-step="4"><div class="t">描述性</div><div class="d">median (IQR) · n (%)</div></div>
      <div class="ar" data-step="4">→</div>
      <div class="node" data-step="5"><div class="t">Table 1</div><div class="d">gtsummary</div></div>
      <div class="ar" data-step="5">→</div>
      <div class="node" data-step="6"><div class="t">存活</div><div class="d">KM · Cox</div></div>
      <div class="ar" data-step="6">→</div>
      <div class="node" data-step="7"><div class="t">次族群</div><div class="d">forest plot</div></div>
    </div>
    <p class="lede" style="margin-top:36px" data-step="8">
      每一步產生一個檔案。<b>檔案即流程的存檔點</b>：中斷後由上一個檔案接續，不需整條重跑。</p>`);

  push("概述", "資料規格", "top", `
    <h2 class="head">資料規格</h2>
    <div class="two wide-l">
      <div>
        <div class="col-h">raw/ 目錄內容</div>
        <table class="dt">
          <tr><th>檔案</th><th>列數</th><th>欄位</th></tr>
          <tr><td class="hl">patient_data_for_survival.csv</td><td>100</td><td>treatment · age · gender · stage · time · status</td></tr>
          <tr><td>patient_data.csv</td><td>100</td><td>treatment · age · gender · los</td></tr>
          <tr><td>patient_data_meta.csv</td><td>8</td><td>文獻整合分析用</td></tr>
        </table>
        <p class="lede" style="font-size:15px;margin-top:22px" data-step="1">
          兩份主檔的 <code>patient_id</code> 皆為 <code>1–100</code>。<br>
          <em class="hl">兩者並非同一批個案。</em></p>
      </div>
      <div data-step="2">
        <div class="col-h">用途分配</div>
        <ul class="bul tight">
          <li>分析主檔為 <b>patient_data_for_survival.csv</b>，含 time 與 status 欄位，可供存活分析。</li>
          <li><b>patient_data.csv</b> 用於指令練習，並示範共用鍵的誤用情境。</li>
          <li>資料為模擬產生，其中的編碼不一致與鍵值衝突則對應真實資料的常見狀況。</li>
        </ul>
      </div>
    </div>`);

  /* ===================== 0:08–0:35　CLI 基本功 ======================== */

  push("CLI 基本功", "指令分組", "", `
    <div class="eyebrow">0:08 – 0:35</div>
    <h2 class="head">指令依用途分為三組</h2>
    <div class="two" style="margin-top:26px">
      <div data-step="1">
        <div class="col-h">操作順序</div>
        <ul class="bul">
          <li><b>確認位置</b><br>取得目前所在目錄。</li>
          <li><b>列出內容</b><br>取得該目錄下的項目。</li>
          <li><b>檢視檔案</b><br>在不開啟編輯器的情況下讀取內容。</li>
        </ul>
      </div>
      <div data-step="2">
        <div class="col-h">對應指令</div>
        <ul class="bul">
          <li><code>pwd</code> · <code>cd</code></li>
          <li><code>ls</code> · <code>tree</code></li>
          <li><code>head</code> · <code>tail</code> · <code>wc</code> · <code>cat</code></li>
        </ul>
        <p class="lede" style="font-size:15px;margin-top:26px">
          三組共九個指令，涵蓋本課程的全部終端機操作。</p>
      </div>
    </div>`);

  push("CLI 基本功", "第一組：定位", "top", `
    <h2 class="head">第一組 · 定位</h2>
    <div class="cmds">
      <div class="c" data-step="1">pwd</div>         <div class="d" data-step="1">輸出目前所在目錄。print working directory。</div>
      <div class="c" data-step="2">ls</div>          <div class="d" data-step="2">列出目前目錄的項目。</div>
      <div class="c" data-step="3">ls -l</div>       <div class="d" data-step="3">加上權限、大小、修改時間。</div>
      <div class="c" data-step="4">ls -lh</div>      <div class="d" data-step="4">-h 將位元組換算為 K/M/G。</div>
      <div class="sep" data-step="5"></div>
      <div class="c" data-step="5">cd raw</div>      <div class="d" data-step="5">切換到子目錄 raw。</div>
      <div class="c" data-step="6">cd ..</div>       <div class="d" data-step="6"><em class="hl">.. 代表上一層目錄。</em></div>
      <div class="c" data-step="7">cd ~</div>        <div class="d" data-step="7">~ 代表家目錄。</div>
    </div>
    <p class="lede" style="margin-top:34px" data-step="8">
      <b>路徑操作是後續所有步驟的前提。</b>
      建議反覆執行 <code>cd</code> 進出目錄，直到不需思考即可判斷所在位置。</p>`);

  push("CLI 基本功", "第二組：檢視", "top", `
    <h2 class="head">第二組 · 檢視檔案</h2>
    <div class="cmds">
      <div class="c" data-step="1">head raw/patient_data_for_survival.csv</div><div class="d" data-step="1">輸出前 10 行。</div>
      <div class="c" data-step="2">head -5 raw/patient_data_for_survival.csv</div><div class="d" data-step="2">輸出前 5 行。用於確認欄位名稱。</div>
      <div class="c" data-step="3">tail -3 raw/patient_data_for_survival.csv</div><div class="d" data-step="3">輸出最後 3 行。用於確認檔案結尾。</div>
      <div class="c" data-step="4">wc -l raw/*.csv</div><div class="d" data-step="4">計算行數。<code>*</code> 為萬用字元。</div>
      <div class="c" data-step="5">cat raw/README.txt</div><div class="d" data-step="5">輸出整份檔案。適用於小檔案。</div>
      <div class="c" data-step="6">tree -L 2</div><div class="d" data-step="6">以樹狀顯示目錄，深度限制兩層。</div>
    </div>
    <div style="margin-top:30px" data-step="7">
      <pre class="term"><span class="p">$</span> <span class="k">head -5 raw/patient_data_for_survival.csv</span>
"patient_id","treatment","age","gender","stage","time","status"
1,"Drug_A",64,"F","III",7.8,1
2,"Drug_B",45,"F","III",16.9,1
3,"Drug_B",58,"M","II",17.7,1
4,"Drug_B",73,"M","I",32.2,1</pre>
    </div>
    <p class="lede" style="margin-top:22px;font-size:16px" data-step="8">
      <b>head 直接輸出檔案開頭數行，不需啟動試算表軟體，也不受檔案大小影響。</b></p>`);

  push("CLI 基本功", "wc -l 的計數", "", `
    <h2 class="head">wc -l 計的是換行符號，不是資料筆數</h2>
    <pre class="term" data-step="1" style="max-width:640px"><span class="p">$</span> <span class="k">wc -l raw/*.csv</span>
     101 raw/patient_data_for_survival.csv
       9 raw/patient_data_meta.csv
     100 raw/patient_data.csv
     210 total</pre>
    <ul class="bul" style="margin-top:28px" data-step="2">
      <li>兩份主檔各含 <b>100 筆資料</b>，輸出卻分別為 101 與 100。</li>
      <li>101 = 100 筆資料 + 1 列標題。另一份檔案<b>結尾缺少換行符號</b>，因此少計一行。</li>
      <li><code>wc -l</code> 的用途是<em class="hl">確認量級</em>，不能用來取得<em class="hl">個案數</em>。個案數由後續讀檔步驟輸出。</li>
    </ul>`);

  push("CLI 基本功", "第三組：目錄結構", "top", `
    <h2 class="head">第三組 · 建立目錄結構</h2>
    <div class="cmds">
      <div class="c" data-step="1">mkdir -p project/{raw,scripts,output,figs,docs}</div>
      <div class="d" data-step="1">一次建立整組目錄。<code>-p</code> 表示中間層不存在時一併建立。</div>
      <div class="c" data-step="2">tree project</div>
      <div class="d" data-step="2">確認結構。</div>
    </div>
    <div class="two" style="margin-top:36px" data-step="3">
      <div>
        <div class="col-h">目錄職責</div>
        <table class="dt">
          <tr><td class="hl">raw/</td><td>原始資料。<b>唯讀，不修改。</b></td></tr>
          <tr><td>scripts/</td><td>程式。唯一需要手動維護的目錄。</td></tr>
          <tr><td>output/</td><td>清洗後資料與表格。</td></tr>
          <tr><td>figs/</td><td>圖檔。</td></tr>
          <tr><td>docs/</td><td>處理決定的紀錄。</td></tr>
        </table>
      </div>
      <div>
        <div class="col-h">設計判準</div>
        <div class="claim sm" style="margin-bottom:20px">
          <code>output/</code> 與 <code>figs/</code> <b>可隨時整個刪除</b>。</div>
        <p class="lede" style="font-size:15px">
          刪除後若無法由 <code>scripts/</code> 重新產生，表示流程有缺口。<br><br>
          <code>raw/</code> 設為唯讀屬於資料管理要求：原始資料一經修改，即失去比對基準。</p>
      </div>
    </div>`);

  /* ===================== 0:35–0:45　Claude Code ======================= */

  push("Claude Code", "三項前提", "top", `
    <div class="eyebrow">0:35 – 0:45</div>
    <h2 class="head">啟動前的三項前提</h2>
    <ul class="bul" style="margin-top:24px">
      <li data-step="1"><b>作用範圍是啟動時所在的目錄。</b>在哪個目錄執行 <code>claude</code>，該目錄即為其工作範圍。前一段的 <code>cd</code> 操作在此生效。</li>
      <li data-step="2"><b>它會寫入檔案。</b>回覆中提到「已建立 01_clean.R」時，該檔案實際存在於磁碟上，並非僅為文字說明。</li>
      <li data-step="3"><b>臨床定義不在其知識範圍內。</b>未提供時它會採用一般性做法，而該做法在輸出中與確定的事實形式相同。</li>
    </ul>
    <div class="claim sm" style="margin-top:34px" data-step="4">
      前兩項決定它能做什麼，第三項決定操作方式。後續內容集中在第三項。</div>`);

  push("Claude Code", "提示詞：先診斷", "", `
    <h2 class="head">第一個提示詞</h2>
    <div class="prompt" data-step="1"><span class="lbl">輸入內容</span>先不要做任何修改。
請讀 raw/ 底下的兩份 CSV，用中文列出你發現的所有資料品質問題，
每一項告訴我：問題是什麼、影響幾筆、你建議怎麼處理。</div>
    <ul class="bul" style="margin-top:30px" data-step="2">
      <li><b>「先不要做任何修改」</b>是本句的功能所在。</li>
      <li>其作用是把<em class="hl">診斷</em>與<em class="hl">處置</em>拆成兩個步驟。</li>
      <li>診斷結果為清單，可逐項核可；處置在核可之後才發生。</li>
    </ul>`);

  push("Claude Code", "兩種提示方式", "", `
    <div class="two">
      <div data-step="1">
        <div class="col-h">直接要求處置</div>
        <ul class="bul tight">
          <li>執行順利，過程不中斷。</li>
          <li>過程中包含十餘項未經確認的決定。</li>
          <li>這些決定不會出現在最終輸出裡。</li>
          <li>後續無法回答「為何排除這 12 個個案」。</li>
        </ul>
      </div>
      <div data-step="2">
        <div class="col-h">先要求診斷</div>
        <ul class="bul tight">
          <li>輸出為一份問題清單。</li>
          <li>清單中多數項目為機械性處理。</li>
          <li>其餘項目需要臨床判斷。</li>
          <li>核可後才執行，決定紀錄在核可者這一側。</li>
        </ul>
      </div>
    </div>
    <div class="claim" style="margin-top:44px" data-step="3">
      模型不會攔阻不當的指示，<br>只會照指示執行。</div>`);

  push("Claude Code", "清單需要核對", "top", `
    <h2 class="head">診斷清單是待核項目，不是待辦事項</h2>
    <p class="lede">實際執行時，六項診斷中有五項屬實，一項不成立。</p>
    <div style="margin-top:18px" data-step="1">
      <table class="dt" style="font-size:12.5px">
        <tr><th>診斷項目</th><th>核對方式</th><th>結果</th></tr>
        <tr><td>奇數 ID 全為 A，偶數全為 B</td><td>交叉表</td><td>50 / 50，成立</td></tr>
        <tr><td>兩組 LOS 完全無重疊</td><td>各組 min–max</td><td>A 3–7，B 8–17，成立</td></tr>
        <tr><td>兩組年齡有系統性差異</td><td>各組中位數</td><td>41 對 56，成立</td></tr>
        <tr><td class="hl">檔案結尾有一列空行</td><td class="hl">od -c 看結尾位元組</td><td class="hl">結尾為 1\\n，不成立</td></tr>
        <tr><td>31 筆設限中 25 筆 time = 36</td><td>次數統計</td><td>25 / 31，成立</td></tr>
        <tr><td>三筆極早期設限</td><td>篩 time &lt; 3</td><td>1.3、1.9、2.0 月，成立</td></tr>
      </table>
    </div>
    <ul class="bul" style="margin-top:26px" data-step="2">
      <li>不成立的那一項，<b>措辭、格式、確信程度與其他五項完全相同</b>——從輸出本身分不出來。</li>
      <li>它同時指出了兩件人工檢視容易漏掉的事：<b>奇偶交替分組</b>與<b>兩組住院天數零重疊</b>。</li>
      <li>能分辨的只有一個動作：<em class="hl">把它講的話拿去對資料</em>。</li>
    </ul>
    <div class="claim" style="margin-top:26px" data-step="3">
      清單的價值在於指出該查什麼，<br>不在於代替查證。</div>`);

  /* ===================== 0:45–1:05　檢查與驗證 ======================== */

  push("檢查與驗證", "逐項處理", "top", `
    <div class="eyebrow">0:45 – 1:05</div>
    <h2 class="head">診斷清單逐項處理</h2>
    <div class="prompt" data-step="1"><span class="lbl">輸入內容</span>好，我們一項一項來。先確認一件事：
這兩份檔案的 patient_id 都是 1 到 100，
請告訴我它們是不是同一批病人。先列證據給我看，不要自己合併。</div>
    <p class="lede" style="margin-top:28px" data-step="2">
      句尾的 <b>「先列證據給我看，不要自己合併」</b> 在每一輪都重複，
      直到該項目確認為止。</p>`);

  push("檢查與驗證", "唯一鍵", "top", `
    <h2 class="head">兩份檔案都有 patient_id，但不是同一批人</h2>
    <pre class="term" data-step="1" style="max-width:720px">== 檢查一：唯一鍵 ==
  surv 重複 id : 0
  los  重複 id : 0
  同 id 年齡吻合 : <span class="k">4 / 100</span>
  !! 兩份檔案的 patient_id 指向不同的人，不可 join。分開處理。</pre>
    <div style="margin-top:24px" data-step="2">
      <table class="dt" style="max-width:560px">
        <tr><th>共有欄位</th><th>同 id 吻合筆數</th><th>同一批人應為</th></tr>
        <tr><td>age</td><td class="hl">4 / 100</td><td>100</td></tr>
        <tr><td>gender</td><td class="hl">60 / 100</td><td>100</td></tr>
        <tr><td>treatment</td><td class="hl">52 / 100</td><td>100</td></tr>
      </table>
    </div>
    <ul class="bul" style="margin-top:24px" data-step="3">
      <li>兩份檔案的 id 各自唯一，無重複。三個共有欄位<b>全部對不上</b>，且各自獨立指向同一結論。</li>
      <li>gender 的 60% 與 treatment 的 52% 都接近隨機配對的期望值。</li>
      <li>執行 <code>left_join(by = "patient_id")</code> 會輸出 100 列，不產生警告，而<em class="hl">全部欄位對應錯誤</em>。</li>
    </ul>
    <div class="claim sm" style="margin-top:26px" data-step="4">
      不產生警告的錯誤無法由執行結果察覺。<br>合併前需以其他欄位交叉驗證。</div>`);

  push("檢查與驗證", "類別編碼", "top", `
    <h2 class="head">同一變項的兩套編碼</h2>
    <pre class="term" data-step="1" style="max-width:720px">== 檢查二：類別編碼 ==
  surv$treatment : <span class="k">Drug_A / Drug_B</span>
  los$treatment  : <span class="k">A / B</span>
  surv$stage     : I / II / III / IV</pre>
    <ul class="bul" style="margin-top:30px" data-step="2">
      <li>同一變項在不同檔案採用不同寫法，屬真實資料的常見狀況。</li>
      <li>常見的擴大情形為單一欄位內同時存在 <code>M</code> / <code>F</code> / <code>男</code> / <code>女</code> / <code>1</code> / <code>2</code> 與空值。</li>
      <li>轉換為機械性工作；<b>轉換的目標編碼</b>屬決定事項。</li>
    </ul>
    <div class="prompt" style="margin-top:26px" data-step="3"><span class="lbl">輸入內容</span>兩份檔案的 treatment 統一成 Drug_A / Drug_B。
gender 的 M/F 轉成 男/女。轉完印出交叉表讓我確認筆數沒跑掉。</div>`);

  push("檢查與驗證", "切點的決定", "", `
    <h2 class="head">在動作之前先取得說明</h2>
    <div class="prompt" data-step="1"><span class="lbl">輸入內容</span>接下來處理分期。但在你動手之前，
請告訴我你打算怎麼把 stage 分成 early 和 advanced，
以及你用什麼理由選這個切點。</div>
    <ul class="bul" style="margin-top:30px" data-step="2">
      <li>回覆為 I/II 歸 early、III/IV 歸 advanced，屬一般性做法。</li>
      <li>該做法未針對特定疾病、protocol 或世代，<em class="hl">屬推定而非依據</em>。</li>
      <li>bulky disease 是否納入、IIB 的歸屬等問題不會主動提出。</li>
    </ul>
    <div class="claim" style="margin-top:34px" data-step="3">
      ETL 中的 T 需要臨床判斷，<br>不能由工具代為決定。</div>`);

  push("檢查與驗證", "處理紀錄", "top", `
    <h2 class="head">處理紀錄的產生</h2>
    <div class="prompt" data-step="1"><span class="lbl">輸入內容</span>把剛才所有決定寫成 docs/cleaning_log.md，
每一條包含：原始狀態、處理方式、影響筆數、理由。
清洗後的資料存成 output/cohort_clean.csv。</div>
    <div class="two" style="margin-top:32px" data-step="2">
      <div>
        <div class="col-h">輸出</div>
        <pre class="term">== 產出 ==
  output/cohort_clean.csv : 100 列 x 9 欄
  output/los_clean.csv    : 100 列 x 5 欄

分組後人數：
         early advanced
  Drug_A    27       25
  Drug_B    22       26</pre>
      </div>
      <div>
        <div class="col-h">用途</div>
        <p class="lede" style="font-size:16px">
          審查意見詢問排除條件或切點依據時，<br>
          <b>該檔案即為對應的書面依據</b>。<br><br>
          內容在處理當下寫入，不依賴事後回溯。</p>
      </div>
    </div>`);

  /* ===================== 1:05–1:15　R 語言紀律 ======================== */

  push("R 紀律", "五項規範", "top", `
    <div class="eyebrow">1:05 – 1:15</div>
    <h2 class="head">腳本檔的五項規範</h2>
    <ul class="bul" style="margin-top:22px">
      <li data-step="1"><b>檔名以數字開頭</b>　<code>01_clean.R</code> · <code>02_describe.R</code> · <code>03_survival.R</code><br>
        <span class="muted">執行順序由檔名決定，不需額外文件說明。</span></li>
      <li data-step="2"><b>使用 <code>here::here()</code>，不使用 <code>setwd()</code></b><br>
        <span class="muted"><code>setwd()</code> 內含絕對路徑，換機器即失效。<code>here()</code> 由專案根目錄起算。</span></li>
      <li data-step="3"><b>不使用 <code>rm(list=ls())</code></b><br>
        <span class="muted">該指令僅清除物件，已載入的套件與已設定的 options 仍在。重新啟動 R session 才是完整重置。</span></li>
      <li data-step="4"><b>原始檔唯讀</b><br>
        <span class="muted">允許 <code>read_csv("raw/...")</code>，不允許任何寫入 <code>raw/</code> 的操作。</span></li>
      <li data-step="5"><b>保留中間檔</b><br>
        <span class="muted">清洗結果寫出一次。後續分析由該檔案讀入，不重複前段運算。</span></li>
    </ul>`);

  push("R 紀律", "驗收判準", "", `
    <div class="claim" data-step="1" style="font-size:34px;max-width:30ch">
      資料更新後，<br>流程能否<b>以單一指令重跑</b>。</div>
    <p class="lede" style="margin-top:38px" data-step="2">
      此為前述五項規範的共同判準。<br>
      不成立時，五項中至少有一項未落實。</p>
    <div class="two" style="margin-top:34px" data-step="3">
      <div>
        <div class="col-h">不成立的徵兆</div>
        <ul class="bul tight">
          <li>流程中包含手動修改儲存格的步驟。</li>
          <li>存在來源不明的中間檔。</li>
          <li>執行順序未記錄在檔案結構中。</li>
        </ul>
      </div>
      <div>
        <div class="col-h">成立的形式</div>
        <pre class="term"><span class="p">$</span> <span class="k">Rscript scripts/01_clean.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/02_describe.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/03_survival.R</span></pre>
      </div>
    </div>`);

  /* ===================== 1:15–1:40　描述性 + Table 1 ================== */

  push("描述性 · Table 1", "單變項描述", "top", `
    <div class="eyebrow">1:15 – 1:25</div>
    <h2 class="head">先取得單變項分布</h2>
    <div class="prompt" data-step="1"><span class="lbl">輸入內容</span>讀 output/cohort_clean.csv，給我每一個變項的描述性統計。
連續變項給 median (IQR)，類別變項給 n (%)，
並且告訴我每個變項有多少缺失值。</div>
    <div class="two" style="margin-top:30px" data-step="2">
      <div>
        <div class="col-h">連續變項</div>
        <pre class="term"> 變項   n     median (IQR)
  age 100 57.0 (48.8-66.2)
 time 100  16.2 (5.7-35.8)</pre>
      </div>
      <div>
        <div class="col-h">類別變項</div>
        <pre class="term">treatment: Drug_A 52 (52%)  Drug_B 48 (48%)
sex:       女 48 (48%)     男 52 (52%)
stage:     I 17  II 32  III 32  IV 19
age_group: &lt;60 62 (62%)    &gt;=60 38 (38%)</pre>
      </div>
    </div>
    <p class="lede" style="margin-top:26px;font-size:16px" data-step="3">
      單變項分布先於變項間關係。<b>此步驟決定後續模型可納入哪些變項。</b></p>`);

  push("描述性 · Table 1", "缺失值", "", `
    <h2 class="head">缺失比例決定變項可用性</h2>
    <pre class="term" data-step="1" style="max-width:520px">== 缺失值 ==
   patient_id      0     0.0%
    treatment      0     0.0%
          age      0     0.0%
          sex      0     0.0%
        stage      0     0.0%
         time      0     0.0%
       status      0     0.0%</pre>
    <ul class="bul" style="margin-top:28px" data-step="2">
      <li>本資料為模擬產生，缺失比例<b>全數為 0%</b>。真實資料通常不是。</li>
      <li>此步驟為固定程序，不因輸出為 0 而省略。</li>
      <li>參考值：缺失 <b>20%</b> 的變項納入 Cox model 時，該變項的缺失個案會被整列排除，模型的實際 n 隨之下降。</li>
    </ul>
    <div class="claim sm" style="margin-top:30px" data-step="3">
      排除發生在模型內部，不出現在輸出摘要中。</div>`);

  push("描述性 · Table 1", "Table 1", "top", `
    <div class="eyebrow">1:25 – 1:40</div>
    <h2 class="head">Table 1</h2>
    <div class="prompt" data-step="1" style="font-size:14px"><span class="lbl">輸入內容</span>用 gtsummary 做 Table 1，以 stage_group (early vs advanced) 分組，
連續變項用 median (IQR)、類別變項用 n (%)，加上 p value，
存成 output/table1.html 和 output/table1.csv。</div>
    <div style="margin-top:24px" data-step="2">
      <table class="dt" style="font-size:12.5px">
        <tr><th>變項</th><th>N</th><th class="hl">advanced (N=51)</th><th class="hl">early (N=49)</th><th>p</th></tr>
        <tr><td>年齡</td><td>100</td><td>55 (48-64)</td><td>59 (49-68)</td><td>0.3</td></tr>
        <tr><td>性別 女</td><td>100</td><td>26 (51%)</td><td>22 (45%)</td><td>0.5</td></tr>
        <tr><td>治療組 Drug_A</td><td>100</td><td>25 (49%)</td><td>27 (55%)</td><td>0.5</td></tr>
        <tr><td>追蹤時間（月）</td><td>100</td><td>10 (4-26)</td><td>24 (7-36)</td><td>0.012</td></tr>
        <tr><td class="hl">死亡</td><td>100</td><td class="hl">44 (86%)</td><td class="hl">25 (51%)</td><td class="hl">&lt;0.001</td></tr>
      </table>
    </div>
    <p class="lede" style="margin-top:24px;font-size:16px" data-step="3">
      死亡欄的組間差異為 <b>86% 對 51%</b>。後續的 KM 與 Cox 針對同一差異提供時間維度與調整後的估計。</p>`);

  push("描述性 · Table 1", "Table 1 的 p value", "", `
    <h2 class="head">Table 1 的 p value 的適用範圍</h2>
    <ul class="bul" style="margin-top:20px">
      <li data-step="1">用途為描述兩組基線的差異，非假設檢定。</li>
      <li data-step="2">在隨機分派試驗中，分派為隨機，任何不平衡依定義即為機遇。<b>部分期刊要求移除。</b></li>
      <li data-step="3">在觀察性研究中，對應指標為 <b>standardized mean difference</b>。p 隨 n 增大而下降，在大樣本下失去區辨力。</li>
      <li data-step="4">上表仍保留 p 欄，因提示詞中要求了該欄位。</li>
    </ul>
    <div class="claim" style="margin-top:36px" data-step="5">
      工具依提示詞產出欄位，<br>不判斷該欄位是否適用。</div>`);

  /* ===================== 1:40–1:55　存活分析 ========================== */

  push("存活分析", "先輸出數值", "top", `
    <div class="eyebrow">1:40 – 1:55</div>
    <h2 class="head">繪圖前先輸出數值</h2>
    <div class="prompt" data-step="1" style="font-size:14px"><span class="lbl">輸入內容</span>用 output/cohort_clean.csv 做整體存活分析。
先告訴我：中位追蹤時間、event 數、censor 數。
確認沒問題我再叫你畫圖。</div>
    <div class="two" style="margin-top:26px" data-step="2">
      <div>
        <pre class="term">== 整體存活 ==
  病人數       : 100
  死亡 (event) : <span class="k">69</span>
  設限 (censor): 31
  中位追蹤時間 : 36.0 個月（reverse KM）
  中位存活     : 17.5 個月</pre>
      </div>
      <div>
        <ul class="bul tight">
          <li><b>reverse KM</b>：中位追蹤時間以設限為事件反向估計，不等於 time 欄位的中位數。</li>
          <li>36.0 等於最長追蹤時間，對應<b>行政設限</b>：存活個案在第 36 個月一律設限。</li>
        </ul>
      </div>
    </div>
    <div class="claim sm" style="margin-top:28px" data-step="3">
      先輸出數值再繪圖，可在繪圖前攔下資料層級的錯誤。</div>`);

  push("存活分析", "EPV", "", `
    <h2 class="head">共變項數量的上限</h2>
    <div class="claim" data-step="1">常見的設定錯誤：<br>18 個 event 搭配 6 個共變項。</div>
    <ul class="bul" style="margin-top:34px" data-step="2">
      <li>參考規則為 <b>EPV ≈ 10</b>：每 10 個 event 支持 1 個共變項。</li>
      <li>本資料為 <b>69 個 event</b>，上限約 <b>6 個</b>共變項。</li>
      <li>本課程的模型使用 4 個：age、sex、stage_group、treatment。</li>
    </ul>
    <pre class="term" style="margin-top:26px;max-width:600px" data-step="3">  EPV 上限 : 69 events 大約撐得起 6 個共變項</pre>
    <p class="lede" style="margin-top:26px;font-size:16px" data-step="4">
      計算方式為 event 數除以 10，可在投稿前自行核算。</p>`);

  push("存活分析", "KM by stage", "top", `
    <h2 class="head">Kaplan–Meier · 依分期</h2>
    <div class="two wide-l" style="margin-top:8px">
      <div class="figwrap" data-step="1">
        <img src="../assets/figs/km_by_stage.png" alt="KM curve by stage group">
        <div class="cap">figs/km_by_stage.png</div>
      </div>
      <div data-step="2">
        <pre class="term" style="font-size:11.5px">                      n events median 0.95LCL 0.95UCL
stage_group=advanced 51     44   10.6     8.7    22.2
stage_group=early    49     25   28.3    15.5      NA
  log-rank p = 0.0003947</pre>
        <ul class="bul tight" style="margin-top:22px">
          <li>中位存活 <b>10.6 對 28.3 個月</b>。</li>
          <li>early 組上界為 <code>NA</code>：追蹤結束時存活率仍高於 50%，該界限無法估計。此為預期輸出。</li>
          <li>圖需附 <b>risk table</b>。曲線末段的斜率變化可能對應極少的剩餘個案數。</li>
        </ul>
      </div>
    </div>`);

  push("存活分析", "KM by treatment", "top", `
    <h2 class="head">同一資料 · 改依治療組</h2>
    <div class="two wide-l" style="margin-top:8px">
      <div class="figwrap" data-step="1">
        <img src="../assets/figs/km_by_treatment.png" alt="KM curve by treatment">
        <div class="cap">figs/km_by_treatment.png</div>
      </div>
      <div data-step="2">
        <pre class="term" style="font-size:11.5px">                  n events median 0.95LCL 0.95UCL
treatment=Drug_A 52     36   17.5    12.1    27.9
treatment=Drug_B 48     33   17.7     9.0    32.2
  log-rank p = 0.8319</pre>
        <div class="claim sm" style="margin-top:24px">
          17.5 對 17.7 個月，<b>p = 0.83</b>。兩條曲線重疊。</div>
        <ul class="bul tight" style="margin-top:22px">
          <li>治療組無差異，分期有差異。</li>
          <li>陰性結果為一項結果，非分析失敗。</li>
          <li>僅輸出依分期分組的曲線，會遺漏本資料中主要變項的檢定結果。</li>
        </ul>
      </div>
    </div>`);

  push("存活分析", "Cox model", "top", `
    <h2 class="head">Cox model · 調整後估計</h2>
    <div style="margin-top:14px" data-step="1">
      <table class="dt" style="max-width:700px">
        <tr><th>term</th><th>HR</th><th>95% CI</th><th>p</th></tr>
        <tr><td>age</td><td>1.035</td><td>1.01–1.06</td><td>0.0011</td></tr>
        <tr><td>sex 男</td><td>1.053</td><td>0.63–1.76</td><td>0.844</td></tr>
        <tr><td class="hl">stage_group early</td><td class="hl">0.388</td><td class="hl">0.23–0.64</td><td class="hl">0.00024</td></tr>
        <tr><td>treatment Drug_B</td><td>0.890</td><td>0.53–1.49</td><td>0.657</td></tr>
      </table>
    </div>
    <ul class="bul" style="margin-top:28px" data-step="2">
      <li><b>stage_group early：HR 0.39</b>。調整年齡、性別、治療組後，early 組的死亡風險為 advanced 組的約四成。</li>
      <li><b>age：HR 1.035</b>。每增加一歲風險上升 3.5%；十歲對應 1.035<sup>10</sup> ≈ 1.41。</li>
      <li><b>treatment：CI 0.53–1.49</b>，區間涵蓋 1 且寬度大。<em class="hl">對應「無法區辨」，不對應「等效」。</em></li>
    </ul>`);

  /* ===================== 1:55–2:05　次族群 ============================ */

  push("次族群", "forest plot", "top", `
    <div class="eyebrow">1:55 – 2:05</div>
    <h2 class="head">次族群分析 · 依年齡分層</h2>
    <div class="figwrap" data-step="1" style="margin-top:6px">
      <img src="../assets/figs/forest_subgroup.png" alt="Subgroup forest plot" style="max-height:230px">
    </div>
    <div style="margin-top:20px" data-step="2">
      <table class="dt" style="max-width:760px;font-size:12.5px">
        <tr><th>次族群</th><th>n</th><th>events</th><th>HR (early vs advanced)</th><th>95% CI</th><th>組內 p</th></tr>
        <tr><td>Age &lt;60</td><td>62</td><td>37</td><td>0.28</td><td>0.14–0.58</td><td>0.00066</td></tr>
        <tr><td>Age ≥60</td><td>38</td><td>32</td><td>0.55</td><td>0.26–1.14</td><td>0.107</td></tr>
        <tr><td class="hl" colspan="5">interaction p</td><td class="hl">0.219</td></tr>
      </table>
    </div>`);

  push("次族群", "三項限制", "", `
    <h2 class="head">次族群分析的三項限制</h2>
    <ul class="bul" style="margin-top:24px">
      <li data-step="1"><b>未事先寫入 protocol 的次族群屬探索性</b>。輸出為後續假設，非本研究的結論。</li>
      <li data-step="2"><b>判讀依據為 interaction p，非各組的組內 p。</b>本例組內 p 為 0.0007 與 0.107，形式上構成「僅年輕組有差異」；
        <em class="hl">interaction p = 0.219</em>，對應「無證據支持兩組的效應不同」。</li>
      <li data-step="3"><b>分組數量與偽陽性成正比。</b>在 α = 0.05 下，分 20 組的期望偽陽性數為 1。</li>
    </ul>
    <div class="claim" style="margin-top:34px" data-step="4">
      「該治療對年輕族群有效」<br>不在本資料的支持範圍內。</div>`);

  /* ===================== 2:05–2:10　重建驗證 ========================== */

  push("重建驗證", "刪除後重建", "top", `
    <div class="eyebrow">2:05 – 2:10</div>
    <h2 class="head">刪除全部產出後重建</h2>
    <pre class="term" data-step="1" style="max-width:640px;margin-top:10px"><span class="p">$</span> <span class="k">rm -rf output figs</span>
<span class="p">$</span> <span class="k">ls</span>
docs  raw  scripts

<span class="p">$</span> <span class="k">Rscript scripts/01_clean.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/02_describe.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/03_survival.R</span>

<span class="p">$</span> <span class="k">ls output figs</span>
figs:    forest_subgroup.png  km_by_stage.png  km_by_treatment.png
output:  cohort_clean.csv  cox.csv  los_clean.csv
         subgroup.csv  table1.csv  table1.html</pre>
    <p class="lede" style="margin-top:26px" data-step="2">
      <code>raw/</code> 與 <code>scripts/</code> 未變動。<b>其餘檔案全部由腳本重新產生，耗時 9.2 秒。</b></p>`);

  push("重建驗證", "課程範圍", "", `
    <div class="claim" data-step="1" style="font-size:30px;max-width:36ch">
      課程的產出不是一組指令，<br>而是一份可重複執行的流程。</div>
    <div class="title-meta" data-step="2" style="margin-top:52px">
      <div><div class="k">指令</div><div class="v">pwd ls cd head tail wc cat mkdir tree</div></div>
      <div><div class="k">結構規範</div><div class="v">raw 唯讀 · 編號腳本 · here() · 保留中間檔</div></div>
      <div><div class="k">提示方式</div><div class="v">診斷與處置分開</div></div>
      <div><div class="k">驗收判準</div><div class="v">資料更新後能以單一指令重跑</div></div>
    </div>`);

  root.SLIDES = S;
})(window);
