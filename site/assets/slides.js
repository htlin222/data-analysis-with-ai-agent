/* slides.js — 投影片內容
   數值全部取自 reference-run/console/*.txt，
   即 scripts/01_clean.R … 03_survival.R 的實際執行輸出。

   設計原則：投影片只放圖、數字、指令。
   論述放在 notes（按 N 展開，只有講者看得到）。 */
(function (root) {
  "use strict";

  var S = [];
  function push(act, title, cls, html, notes) {
    S.push({ act: act, title: title, cls: cls || "", html: html, notes: notes || "" });
  }

  /* ===================== 0:00–0:08　開場 ============================== */

  push("開場", "標題", "", `
    <div class="eyebrow">90 分鐘 · 終端機 · Claude Code · R</div>
    <h1 class="display">一份資料<br>一份存活分析</h1>
    <p class="lede">給沒有用過終端機的臨床醫師。</p>
    <div class="title-meta">
      <div><div class="k">資料</div><div class="v">100 人（模擬）</div></div>
      <div><div class="k">終點</div><div class="v">Overall survival</div></div>
      <div><div class="k">工具</div><div class="v">Claude Code · R</div></div>
      <div><div class="k">長度</div><div class="v">90 分鐘</div></div>
    </div>`,
    `<div class="say">「今天結束的時候，你會有一份可以按一個鍵重跑的存活分析。」</div>
     <ul>
       <li>開場先問：<b>有誰真的打開過終端機？</b>通常舉手的沒幾個——那正好，這堂課就是為這些人設計的。</li>
       <li>先講清楚範圍：資料只有一份，要背的指令只有七個，其他交給 AI。</li>
       <li>先不要解釋什麼是 CLI。留到第 4 張再講。</li>
     </ul>`);

  push("開場", "今天的路線", "", `
    <h2 class="head">今天走這條線</h2>
    <div class="pipe" style="margin-top:36px">
      <div class="node" data-step="1"><div class="t">cohort.csv</div><div class="d">原始資料</div></div>
      <div class="ar" data-step="1">→</div>
      <div class="node" data-step="2"><div class="t">清洗</div><div class="d">01_clean.R</div></div>
      <div class="ar" data-step="2">→</div>
      <div class="node" data-step="3"><div class="t">Table 1</div><div class="d">02_describe.R</div></div>
      <div class="ar" data-step="3">→</div>
      <div class="node" data-step="4"><div class="t">KM · Cox</div><div class="d">03_survival.R</div></div>
      <div class="ar" data-step="4">→</div>
      <div class="node" data-step="5"><div class="t">次族群</div><div class="d">forest plot</div></div>
    </div>
    <div class="kv" style="margin-top:48px" data-step="6">
      <span>四個步驟</span><span><b>三個檔案</b></span><span>一份資料</span>
    </div>`,
    `<div class="say">「這條線的每一個箭頭，都是一段可以再跑一次的程式碼。」</div>
     <ul>
       <li>重點在：<b>每一步都留下一個檔案</b>。中斷了就從上一個檔案接著做，不必整條重來。</li>
       <li>這跟在 Excel 裡改一改、另存新檔的差別，就是三個月後你還說得出來自己做了什麼。</li>
       <li>可以先預告最後一張：我們會把產出全部刪掉，再用三個指令長回來。</li>
     </ul>`);

  push("開場", "資料", "top", `
    <h2 class="head">資料就這一份</h2>
    <pre class="term" data-step="1" style="max-width:760px;margin-top:8px"><span class="p">$</span> <span class="k">head -3 raw/cohort.csv</span>
patient_id,age,sex,stage,treatment,time,status
1,64,F,III,Drug_A,7.8,1
2,45,F,III,Drug_B,16.9,1</pre>
    <div class="kv" style="margin-top:36px" data-step="2">
      <span><b>100</b> 人</span>
      <span><b>7</b> 欄</span>
      <span><b>69</b> 死亡</span>
      <span><b>31</b> 設限</span>
      <span>追蹤上限 <b>36</b> 個月</span>
    </div>
    <p class="lede" style="margin-top:40px;text-align:center" data-step="3">
      一列一個病人。<code>status</code> 1 是死亡，0 是設限。</p>`,
    `<div class="say">「存活分析的資料，長相就是這麼樸素——每個人一列，一個時間，一個結局。」</div>
     <ul>
       <li>先解釋 <b>time 和 status 這對</b>：time 是追蹤了多久，status 是這段時間結束時人怎麼了。
           這是整個存活分析唯一需要的東西。</li>
       <li>「設限」＝到研究結束還活著，或是失去追蹤。<b>不是遺漏，不是失敗</b>，是一種正常的結局。</li>
       <li>如果有人問為什麼不用 Excel 打開看：可以現場示範 head 一秒就出來，而且不會動到檔案。</li>
     </ul>`);

  /* ===================== 0:08–0:22　終端機 =========================== */

  push("終端機", "為什麼是終端機", "", `
    <div class="eyebrow">0:08 – 0:22</div>
    <div class="claim" data-step="1">滑鼠幫你找檔案。<br>終端機由你自己說它在哪。</div>
    <p class="lede" style="margin-top:38px;text-align:center" data-step="2">
      差別不在難不難，而在於<b>終端機的每一步都能寫下來，再跑一次</b>。</p>`,
    `<div class="say">「用滑鼠做的事，做完就沒了。在終端機打的字，是可以留下來的。」</div>
     <ul>
       <li>這是全課最重要的一張，但只講一句話就好，不要展開。</li>
       <li>可以舉例：期刊回信問「你那 12 個人是怎麼排除的」，
           滑鼠點過的路徑沒有紀錄，打過的指令有。</li>
       <li>不用說服他們終端機比較好用。只要說<b>它會留下紀錄</b>。</li>
     </ul>`);

  push("終端機", "七個指令", "top", `
    <h2 class="head">要背的指令就七個</h2>
    <div class="cmds" style="margin-top:20px">
      <div class="c" data-step="1">pwd</div>   <div class="d" data-step="1">我在哪</div>
      <div class="c" data-step="2">ls</div>    <div class="d" data-step="2">這裡有什麼</div>
      <div class="c" data-step="3">cd raw</div><div class="d" data-step="3">進去 raw</div>
      <div class="c" data-step="4">cd ..</div> <div class="d" data-step="4">退回上一層</div>
      <div class="sep" data-step="5"></div>
      <div class="c" data-step="5">head -3 raw/cohort.csv</div><div class="d" data-step="5">看前三行</div>
      <div class="c" data-step="6">tail -3 raw/cohort.csv</div><div class="d" data-step="6">看最後三行</div>
      <div class="c" data-step="7">tree -L 1</div><div class="d" data-step="7">看目錄長相</div>
    </div>
    <p class="lede" style="margin-top:38px" data-step="8">
      其他的都可以問 AI。<b>這七個要能不用想就打出來</b>。</p>`,
    `<div class="say">「這七個不是要你變成工程師，是為了讓你看得懂 AI 在你的電腦裡做了什麼。」</div>
     <ul>
       <li>建議現場帶著做一遍 <code>pwd → cd raw → pwd → cd .. → pwd</code>，
           讓他們親眼看到位置真的變了。這一段不要用講的。</li>
       <li><code>..</code> 是這裡唯一需要特別說明的符號：<b>上一層</b>。</li>
       <li>留意最容易卡的地方：路徑打錯、大小寫、忘記自己在哪。
           遇到就示範 <code>pwd</code> 是怎麼救回來的。</li>
     </ul>`);

  push("終端機", "專案長相", "top", `
    <h2 class="head">先把架子搭好</h2>
    <pre class="term" data-step="1" style="max-width:700px"><span class="p">$</span> <span class="k">mkdir -p project/{raw,scripts,output,figs,docs}</span></pre>
    <div class="two" style="margin-top:32px" data-step="2">
      <div>
        <table class="dt">
          <tr><td class="hl">raw/</td><td>原始資料。<b>唯讀</b></td></tr>
          <tr><td>scripts/</td><td>程式</td></tr>
          <tr><td>output/</td><td>表格與清洗後的資料</td></tr>
          <tr><td>figs/</td><td>圖</td></tr>
          <tr><td>docs/</td><td>做了什麼決定</td></tr>
        </table>
      </div>
      <div>
        <div class="claim sm" style="margin-bottom:18px">
          <code>output/</code> 和 <code>figs/</code><br><b>隨時可以整個刪掉。</b></div>
        <p class="lede" style="font-size:15px">
          刪掉之後長不回來，<br>就表示流程有洞。</p>
      </div>
    </div>`,
    `<div class="say">「raw 這個資料夾，我們設成唯讀。你等一下會發現這件事救了你。」</div>
     <ul>
       <li>五個資料夾，一個指令。<code>-p</code> 的意思是中間層不存在就順便建。</li>
       <li><b>raw 唯讀</b>是這門課唯一的硬規定：原始資料一旦被改過，就沒有東西可以對照了。</li>
       <li>「刪掉長不回來就表示有洞」——這句話會在最後一張兌現，可以先埋下去。</li>
     </ul>`);

  /* ===================== 0:22–0:40　Claude Code ====================== */

  push("Claude Code", "三件事", "top", `
    <div class="eyebrow">0:22 – 0:40</div>
    <h2 class="head">開始之前，先知道三件事</h2>
    <ul class="bul" style="margin-top:30px">
      <li data-step="1"><b>它只看得到你所在的資料夾。</b>在哪裡打 <code>claude</code>，它就在哪裡工作。</li>
      <li data-step="2"><b>它會真的寫檔案。</b>它說「已建立 01_clean.R」，那個檔案就在你的硬碟上。</li>
      <li data-step="3"><b>臨床的事它不知道。</b>你沒講，它就自己挑一個常見做法給你。</li>
    </ul>`,
    `<div class="say">「前面兩件決定它能做什麼。第三件決定你要怎麼跟它講話。」</div>
     <ul>
       <li>第一點呼應剛剛的 <code>cd</code>：那不是白學的，它決定 AI 的工作範圍。</li>
       <li>第二點要講重一點。<b>這不是聊天視窗</b>，它動的是真的檔案。所以 raw 才要唯讀。</li>
       <li>第三點是下一張的引子——先不要展開。</li>
     </ul>`);

  push("Claude Code", "第一個指示", "", `
    <h2 class="head">第一個指示</h2>
    <div class="prompt" data-step="1"><span class="lbl">你打的字</span>讀 raw/cohort.csv，幫我做清洗，
存成 output/cohort_clean.csv。
做了什麼決定寫在 docs/cleaning_log.md。</div>
    <p class="lede" style="margin-top:36px;text-align:center" data-step="2">
      用中文講就可以。<b>重點是最後一句。</b></p>`,
    `<div class="say">「你不用學怎麼寫 R。你要學的是怎麼交代清楚。」</div>
     <ul>
       <li>示範時就用中文打，讓他們看到真的不需要英文、不需要語法。</li>
       <li><b>最後一句是關鍵</b>：要求它把決定寫下來。
           沒有這句，它一樣會做完，但你事後說不出它做了什麼。</li>
       <li>可以問全場：你覺得它接下來會遇到幾個需要「決定」的地方？下一張揭曉。</li>
     </ul>`);

  push("Claude Code", "三個決定", "top", `
    <h2 class="head">這份資料有三個地方要你決定</h2>
    <div class="three">
      <div class="card" data-step="1">
        <div class="q">4 筆年齡是空的<br>怎麼辦？</div>
        <div class="a">補值？整列丟掉？<br>還是留著、讓模型自己排除？</div>
      </div>
      <div class="card" data-step="2">
        <div class="q">早期跟晚期<br>怎麼分？</div>
        <div class="a">I、II 算早期，<br>III、IV 算晚期——真的嗎？</div>
      </div>
      <div class="card" data-step="3">
        <div class="q">年齡切在<br>幾歲？</div>
        <div class="a">60？65？<br>還是照中位數切？</div>
      </div>
    </div>
    <div class="claim" style="margin-top:40px" data-step="4">
      它不會問你。<br>它會挑一個常見的做法，然後繼續往下做。</div>`,
    `<div class="say">「這三個問題，沒有一個是統計問題。全都是臨床問題。」</div>
     <ul>
       <li>這是全課的核心。慢慢講，這一張值得停久一點。</li>
       <li>第二個最值得展開：I/II 對 III/IV 是最常見的分法，
           但如果你的 protocol 對 <b>IIB、bulky disease、extranodal</b> 另有定義，這個分法就是錯的。
           而 AI 給你的版本，看起來跟正確答案一模一樣。</li>
       <li>第三個要點出來：<b>切點是事後才決定的</b>，所以等一下的次族群分析只能算探索性。</li>
       <li>結論句：AI 不會攔你，它只會照做。所以要你先想清楚。</li>
     </ul>`);

  push("Claude Code", "清洗結果", "top", `
    <h2 class="head">它跑完了</h2>
    <pre class="term" data-step="1" style="max-width:780px"><span class="p">$</span> <span class="k">Rscript scripts/01_clean.R</span>

== 檢查一：缺失 ==
  age 缺失 <span class="k">4</span> 筆。不插補；Cox model 會整列排除。

== 檢查三：設限型態 ==
  死亡 69　設限 31
  設限中有 <span class="k">25</span> 筆 time = 36（最長追蹤），屬行政設限

== 產出 ==
  output/cohort_clean.csv : 100 列 x 9 欄</pre>
    <p class="lede" style="margin-top:32px" data-step="2">
      同時產生 <code>docs/cleaning_log.md</code>——<b>每個決定的書面依據</b>。</p>`,
    `<div class="say">「注意它自己講出來的兩件事，等一下都會回來找我們。」</div>
     <ul>
       <li><b>4 筆缺失</b>——第 12 張會看到它怎麼影響模型的 n。</li>
       <li><b>25 筆設限剛好在 36 個月</b>——這叫行政設限，第 14 張會講它為什麼重要。</li>
       <li>打開 cleaning_log.md 給他們看一眼就好。重點是：
           <b>被審查問到的時候，這份檔案就是你的答案</b>。</li>
     </ul>`);

  /* ===================== 0:40–0:55　Table 1 ========================== */

  push("Table 1", "先看每個變項", "top", `
    <div class="eyebrow">0:40 – 0:55</div>
    <h2 class="head">先一個一個看</h2>
    <div class="two" style="margin-top:26px" data-step="1">
      <div>
        <div class="col-h">連續變項</div>
        <pre class="term"> 變項   n 缺失     median (IQR)
  age  96    4 57.5 (48.8-67.2)
 time 100    0  16.2 (5.7-35.8)</pre>
      </div>
      <div>
        <div class="col-h">類別變項</div>
        <pre class="term">treatment  Drug_A 52  Drug_B 48
sex        女 48  男 52
stage      I 17  II 32  III 32  IV 19</pre>
      </div>
    </div>
    <p class="lede" style="margin-top:34px;text-align:center" data-step="2">
      先看清楚每個變項自己長什麼樣，<b>再談它們之間的關係</b>。</p>`,
    `<div class="say">「這一步很無聊，但跳過它你會在後面付出代價。」</div>
     <ul>
       <li>指著 age 那行的 <b>n=96 和缺失 4</b>：這兩個數字現在還只是報告，下一張就會變成問題。</li>
       <li>順口提醒：<b>median (IQR) 是預設，不是 mean (SD)</b>。存活資料通常是偏的。</li>
       <li>如果現場有人問 stage 為什麼不合併——回答：等一下 Table 1 就是用合併後的分組。</li>
     </ul>`);

  push("Table 1", "缺失值", "", `
    <h2 class="head">4 筆空白，模型少了 4 個人</h2>
    <div class="big" data-step="1">
      <div class="n"><i>100</i><span>世代人數</span></div>
      <div class="to">→</div>
      <div class="n"><i class="acc">96</i><span>Cox 實際用到</span></div>
    </div>
    <div class="kv" style="margin-top:34px" data-step="2">
      <span>events 也從 <b>69</b> 掉到 <em>66</em></span>
    </div>
    <p class="lede" style="margin-top:40px;text-align:center" data-step="3">
      模型不會警告你。<b>它就是安靜地少算四個人。</b></p>`,
    `<div class="say">「你論文裡寫的 n 是 100，但模型其實只看了 96 個人。」</div>
     <ul>
       <li>這是缺失值最實際的後果：<b>Cox 遇到任何一個變項是空的，就把整列丟掉</b>。</li>
       <li>沒有錯誤訊息，沒有警告。輸出的表格看起來完全正常。</li>
       <li>所以 <code>03_survival.R</code> 裡我們自己把它印出來——第 15 張會看到那一行。</li>
       <li>真實資料常常不是 4%，是 20%。那時候 100 人可能只剩 70 幾人進模型。</li>
     </ul>`);

  push("Table 1", "Table 1", "top", `
    <h2 class="head">Table 1</h2>
    <div style="margin-top:20px" data-step="1">
      <table class="dt" style="font-size:13px">
        <tr><th>變項</th><th>N</th><th class="hl">advanced (51)</th><th class="hl">early (49)</th><th>p</th></tr>
        <tr><td>年齡</td><td class="hl">96</td><td>56 (49-64)</td><td>59 (49-68)</td><td>0.3</td></tr>
        <tr><td style="padding-left:22px;color:var(--ink-3)">Unknown</td><td></td><td>3</td><td>1</td><td></td></tr>
        <tr><td>性別 女</td><td>100</td><td>26 (51%)</td><td>22 (45%)</td><td>0.5</td></tr>
        <tr><td>治療組 Drug_A</td><td>100</td><td>25 (49%)</td><td>27 (55%)</td><td>0.5</td></tr>
        <tr><td>追蹤時間（月）</td><td>100</td><td>10 (4-26)</td><td>24 (7-36)</td><td>0.012</td></tr>
        <tr><td class="hl">死亡</td><td>100</td><td class="hl">44 (86%)</td><td class="hl">25 (51%)</td><td class="hl">&lt;0.001</td></tr>
      </table>
    </div>
    <p class="lede" style="margin-top:28px;text-align:center" data-step="2">
      死亡率 <b>86% 對 51%</b>。<br>接下來的曲線和模型，講的都是同一件事。</p>`,
    `<div class="say">「這張表最值得看的，其實是那個 96 和那行 Unknown。」</div>
     <ul>
       <li>gtsummary 很老實：<b>年齡的 N 是 96，而且它自己列出 Unknown 那一行</b>（3 和 1）。
           不是每個工具都會這樣，這也是我們用它的理由。</li>
       <li><b>沒有把分期放進這張表</b>——分組本來就是用分期定義的，放進去只會得到 0% 對 100%，
           那是同義反覆。分組的來源變項不進 Table 1。</li>
       <li>p value 的部分：這裡是描述兩組長得像不像，不是假設檢定。
           隨機分派試驗裡，有些期刊根本要求拿掉。觀察性研究比較常看 SMD。</li>
     </ul>`);

  /* ===================== 0:55–1:15　存活分析 ========================= */

  push("存活分析", "先看數字", "top", `
    <div class="eyebrow">0:55 – 1:15</div>
    <h2 class="head">畫圖之前，先把數字看過</h2>
    <pre class="term" data-step="1" style="max-width:640px;margin-top:10px">== 整體存活 ==
  病人數       : 100
  死亡 (event) : <span class="k">69</span>
  設限 (censor): 31
  中位追蹤時間 : <span class="k">36.0</span> 個月（reverse KM）
  中位存活     : 17.5 個月</pre>
    <p class="lede" style="margin-top:34px" data-step="2">
      <b>中位追蹤 36 個月，剛好等於最長追蹤時間。</b>
      這代表還活著的人，全部在第 36 個月被一起設限。</p>`,
    `<div class="say">「先看數字再畫圖。圖很漂亮，但錯的圖也一樣漂亮。」</div>
     <ul>
       <li><b>reverse KM</b>：算中位追蹤時間要把設限當成事件、反過來算。
           不是把 time 欄位取中位數——那個算出來會嚴重低估。</li>
       <li>36 這個數字就是第 10 張說的<b>行政設限</b>：研究在第 36 個月喊停，
           當時還活著的人全部設限在那一天。</li>
       <li>這不是資料有問題，是研究設計。但你解讀曲線尾巴的時候必須知道。</li>
     </ul>`);

  push("存活分析", "分期分得開", "top", `
    <h2 class="head">分期分得開</h2>
    <div class="two wide-l" style="margin-top:6px">
      <div class="figwrap" data-step="1">
        <img src="../assets/figs/km_by_stage.png" alt="KM curve by stage group">
      </div>
      <div data-step="2">
        <div class="big" style="gap:24px;margin-top:40px">
          <div class="n"><i>10.6</i><span>advanced</span></div>
          <div class="vs">vs</div>
          <div class="n"><i class="acc">28.3</i><span>early</span></div>
        </div>
        <div class="kv" style="margin-top:30px"><span>中位存活（月）</span></div>
      </div>
    </div>`,
    `<div class="say">「兩條線分得很開，這就是我們今天想看到的東西。」</div>
     <ul>
       <li>log-rank <b>p = 0.0004</b>。</li>
       <li>early 那組的 CI 上界是 <b>NA</b>——不是壞掉。
           是因為追蹤結束的時候，這組還有超過一半的人活著，所以「中位數的上界」根本估不出來。
           <b>這是正常輸出</b>，新手看到 NA 很容易以為出錯。</li>
       <li>記得提醒：<b>投稿要附 risk table</b>。曲線尾巴看起來的大變化，
           常常只是剩下三五個人而已。</li>
     </ul>`);

  push("存活分析", "治療組分不開", "top", `
    <h2 class="head">同一份資料，換成治療組</h2>
    <div class="two wide-l" style="margin-top:6px">
      <div class="figwrap" data-step="1">
        <img src="../assets/figs/km_by_treatment.png" alt="KM curve by treatment">
      </div>
      <div data-step="2">
        <div class="big" style="gap:24px;margin-top:40px">
          <div class="n"><i>17.5</i><span>Drug_A</span></div>
          <div class="vs">vs</div>
          <div class="n"><i>17.7</i><span>Drug_B</span></div>
        </div>
        <div class="kv" style="margin-top:30px"><span>log-rank <b>p = 0.83</b></span></div>
        <div class="claim sm" style="margin-top:30px">兩條線疊在一起。</div>
      </div>
    </div>`,
    `<div class="say">「這張是陰性結果。陰性結果也是結果，不是分析失敗。」</div>
     <ul>
       <li>17.5 對 17.7，<b>p = 0.83</b>。分期有差、治療組沒差。</li>
       <li>這一張特別重要的理由：<b>如果你只畫了依分期分組的那一張</b>，
           就會漏掉「你真正想問的那個變項其實沒有差異」這件事。</li>
       <li>可以問全場：如果你是這個研究的 PI，你會怎麼寫討論？</li>
     </ul>`);

  push("存活分析", "Cox", "top", `
    <h2 class="head">把年齡、性別一起考慮進來</h2>
    <pre class="term" data-step="1" style="max-width:820px">世代 100 人 69 events；模型實際使用 <span class="k">96 人 66 events</span>（age 缺失 4 筆整列排除）</pre>
    <div style="margin-top:22px" data-step="2">
      <table class="dt" style="max-width:660px">
        <tr><th>term</th><th>HR</th><th>95% CI</th><th>p</th></tr>
        <tr><td>age</td><td>1.036</td><td>1.01–1.06</td><td>0.0013</td></tr>
        <tr><td>sex 男</td><td>0.960</td><td>0.57–1.63</td><td>0.88</td></tr>
        <tr><td class="hl">stage_group early</td><td class="hl">0.404</td><td class="hl">0.24–0.67</td><td class="hl">0.0005</td></tr>
        <tr><td>treatment Drug_B</td><td>0.786</td><td>0.46–1.34</td><td>0.375</td></tr>
      </table>
    </div>
    <p class="lede" style="margin-top:26px" data-step="3">
      早期組的死亡風險，大約是晚期組的 <b>四成</b>。</p>`,
    `<div class="say">「第一行就是我們剛剛講的：模型只用了 96 個人。」</div>
     <ul>
       <li><b>HR 0.404</b>：調整年齡、性別、治療組之後，early 組的死亡風險約為 advanced 的四成。</li>
       <li><b>age HR 1.036</b>：每老一歲風險多 3.6%。十歲就是 1.036 的十次方，大約 1.42 倍。
           用十歲來講比較有感覺。</li>
       <li><b>treatment 的 CI 是 0.46–1.34</b>，跨過 1 而且很寬。
           這叫「看不出差別」，<b>不等於「兩種藥一樣好」</b>。這兩句話在論文裡差很多。</li>
     </ul>`);

  push("存活分析", "能放幾個變項", "", `
    <h2 class="head">模型裡能放幾個變項？</h2>
    <div class="big" data-step="1">
      <div class="n"><i>66</i><span>events</span></div>
      <div class="vs">÷ 10 =</div>
      <div class="n"><i class="acc">6</i><span>變項上限</span></div>
    </div>
    <div class="kv" style="margin-top:38px" data-step="2">
      <span>我們用了 <b>4</b> 個：age · sex · stage_group · treatment</span>
    </div>
    <p class="lede" style="margin-top:36px;text-align:center" data-step="3">
      看的是 <b>event 數</b>，不是病人數。</p>`,
    `<div class="say">「這是投稿前你可以自己在紙上算出來的一件事。」</div>
     <ul>
       <li>規則叫 <b>EPV（events per variable）≈ 10</b>：每 10 個 event 撐得起 1 個共變項。</li>
       <li><b>關鍵是分子用 event 數，不是總人數</b>。100 個人但只有 12 個死亡，
           那你最多只能放 1 個變項——這是最常見的誤用。</li>
       <li>我們有 66 個 event、放了 4 個，EPV 16.5，很安全。</li>
       <li>EPV 10 是慣例不是鐵律，可以提一句近年有人主張更寬鬆，但別展開。</li>
     </ul>`);

  /* ===================== 1:15–1:25　次族群 =========================== */

  push("次族群", "forest plot", "top", `
    <div class="eyebrow">1:15 – 1:25</div>
    <h2 class="head">年輕人是不是差比較多？</h2>
    <div class="figwrap" data-step="1" style="margin-top:6px">
      <img src="../assets/figs/forest_subgroup.png" alt="Subgroup forest plot" style="max-height:210px">
    </div>
    <div style="margin-top:22px" data-step="2">
      <table class="dt" style="max-width:700px;font-size:13px">
        <tr><th>次族群</th><th>n</th><th>events</th><th>HR</th><th>95% CI</th><th>組內 p</th></tr>
        <tr><td>Age &lt;60</td><td>58</td><td>34</td><td>0.30</td><td>0.14–0.63</td><td>0.0014</td></tr>
        <tr><td>Age ≥60</td><td>38</td><td>32</td><td>0.55</td><td>0.26–1.14</td><td>0.107</td></tr>
      </table>
    </div>
    <p class="lede" style="margin-top:20px;font-size:15px" data-step="3">
      另有 <b>4 筆</b>年齡缺失，無法分層，這個分析排除。</p>`,
    `<div class="say">「先讓他們自己看。看起來像不像『年輕人有效、老人無效』？」</div>
     <ul>
       <li>刻意讓大家先掉進陷阱：組內 p 一個 <b>0.0014</b>、一個 <b>0.107</b>，
           看起來就是「年輕組有差、老人組沒差」。</li>
       <li>先不要揭曉。停一下，問他們會怎麼寫這段結果。下一張再打破。</li>
       <li>順帶指出那 4 筆缺失又出現了——這次是整個排除，而且我們把它印出來，
           不讓它默默消失。</li>
     </ul>`);

  push("次族群", "不能這樣說", "", `
    <h2 class="head">但是不能這樣說</h2>
    <div class="big" data-step="1">
      <div class="n"><i class="acc">0.246</i><span>interaction p</span></div>
    </div>
    <p class="lede" style="margin-top:34px;text-align:center" data-step="2">
      該看的是這個數字，<b>不是各組自己的 p</b>。</p>
    <div class="claim" style="margin-top:38px" data-step="3">
      「這個治療對年輕人比較有效」<br>這份資料撐不起這句話。</div>`,
    `<div class="say">「兩組看起來不一樣，跟兩組真的不一樣，是兩件事。」</div>
     <ul>
       <li><b>interaction p = 0.246</b>：沒有證據支持兩組的效應不同。
           組內 p 一個顯著一個不顯著，常常只是因為<b>其中一組人比較少</b>（38 對 58）。</li>
       <li>再加一個提醒：<b>切點是我們事後才決定的</b>（60 歲），
           沒有寫在 protocol 裡，所以這整個分析只能算探索性、當作下一個研究的假設。</li>
       <li>分組越多偽陽性越多：α = 0.05 之下分 20 組，期望值就有 1 組是假的。</li>
     </ul>`);

  /* ===================== 1:25–1:30　收尾 ============================= */

  push("收尾", "刪掉重建", "top", `
    <div class="eyebrow">1:25 – 1:30</div>
    <h2 class="head">全部刪掉，再長回來</h2>
    <pre class="term" data-step="1" style="max-width:660px;margin-top:8px"><span class="p">$</span> <span class="k">rm -rf output figs</span>
<span class="p">$</span> <span class="k">ls</span>
docs  raw  scripts

<span class="p">$</span> <span class="k">Rscript scripts/01_clean.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/02_describe.R</span>
<span class="p">$</span> <span class="k">Rscript scripts/03_survival.R</span></pre>
    <div class="kv" style="margin-top:34px" data-step="2">
      <span>全部回來了</span><span><b>5.8</b> 秒</span><span><code>raw/</code> 和 <code>scripts/</code> 沒動過</span>
    </div>`,
    `<div class="say">「這就是第 6 張講的那件事：刪掉之後長得回來，表示流程沒有洞。」</div>
     <ul>
       <li>這一段一定要現場真的跑，不要只放截圖。刪檔的那一刻大家會倒抽一口氣。</li>
       <li>之所以敢刪，是因為 <b>raw 唯讀、產出全都由 scripts 生成</b>。</li>
       <li>這也是驗收標準：<b>三個月後資料更新了，你能不能按一個鍵重跑？</b>
           如果不行，就是中間有某一步是用滑鼠做的。</li>
     </ul>`);

  push("收尾", "帶走什麼", "", `
    <div class="claim" data-step="1" style="font-size:30px;max-width:34ch">
      今天的產出不是那幾張圖，<br>是一條可以再跑一次的流程。</div>
    <div class="title-meta" data-step="2" style="margin-top:50px">
      <div><div class="k">指令</div><div class="v">pwd ls cd head tail tree mkdir</div></div>
      <div><div class="k">規矩</div><div class="v">raw 唯讀 · 腳本編號 · 產出可刪</div></div>
      <div><div class="k">你的工作</div><div class="v">替 AI 做臨床判斷</div></div>
      <div><div class="k">驗收</div><div class="v">按一個鍵能重跑</div></div>
    </div>`,
    `<div class="say">「AI 可以幫你寫程式。但那三個決定，只有你能做。」</div>
     <ul>
       <li>回扣第 9 張的三個決定：缺失怎麼處理、早晚期怎麼分、年齡切在哪。
           <b>這三個問題今天沒有一個是 AI 回答的</b>。</li>
       <li>留一個可以帶回去的作業：把自己手上的一份資料放進 raw/，走一次同樣的流程。</li>
       <li>結尾不要拖。講完這句就可以進 Q&amp;A。</li>
     </ul>`);

  root.SLIDES = S;
})(window);
