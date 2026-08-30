/* cast.js — 真實錄影播放器
   .cast 由 scripts/record_cast.py（shell）與 scripts/record_claude.py（TUI）錄製，
   marker 落在每個輸入點。pauseOnMarkers 讓播放在每個 marker 停下。

   說明層預設隱藏：滑鼠靠近哪一側，那一層才浮現。 */
(function () {
  "use strict";

  var rec   = document.getElementById("rec");
  var rail  = document.getElementById("rail");
  var mount = document.getElementById("player");
  var marks = document.getElementById("marks");
  var marksH = document.getElementById("marks-h");
  var titleEl = document.getElementById("seg-title");
  var metaEl  = document.getElementById("seg-meta");
  var noteEl  = document.getElementById("seg-note");
  var cnt   = document.getElementById("counter");
  var fill  = document.getElementById("fill");
  var store = Stage.Progress("cast");

  var OV = {
    top:    document.getElementById("ov-top"),
    left:   document.getElementById("ov-left"),
    right:  document.getElementById("ov-right"),
    chrome: document.getElementById("ov-chrome")
  };

  var segI = 0, player = null, meta = null, poll = null;

  /* ---------- 側欄下緣：讓開播放控制列 ------------------------------------
     fit:"both" 會把終端機置中，控制列跟著終端機盒子的底緣，
     不一定在視窗底部。所以量它的實際位置，而不是寫死一個數字。 */
  function fitSides() {
    var bar = mount.querySelector(".ap-bar");
    var gap = 8;
    var bottom = bar
      ? Math.max(0, innerHeight - bar.getBoundingClientRect().top + gap)
      : 56;
    rec.style.setProperty("--side-bottom", Math.round(bottom) + "px");
  }
  addEventListener("resize", fitSides);

  // 播放器尺寸一變（載入、全螢幕切換）就重量一次，不用輪詢
  var sizeWatch = window.ResizeObserver ? new ResizeObserver(fitSides) : null;

  /* ---------- 說明層的顯隱 ----------------------------------------------
     播放器撐滿整個視窗，游標座標直接就是視窗座標。

     左右兩側只在上半部觸發：游標往下移去按播放列時會經過側邊，
     若整條邊都是觸發區，側欄會在按鈕前彈出來擋住。
     已經展開的側欄則以 :hover 維持，否則在欄內往下移會讓它自己收起。 */
  var EDGE = { top: 96, left: 232, right: 340 };
  var SIDE_ZONE = 0.5;          // 側邊觸發區只佔視窗上半
  var PINNED = new URLSearchParams(location.search).has("hud");
  var hideTimer = null;

  function show(which, on) { OV[which].classList.toggle("on", on); }

  function onMove(e) {
    var w = innerWidth, h = innerHeight;
    var upper = e.clientY < h * SIDE_ZONE;

    show("chrome", true);
    show("top",   e.clientY < EDGE.top);
    show("left",  (e.clientX < EDGE.left && upper) || OV.left.matches(":hover"));
    show("right", (e.clientX > w - EDGE.right && upper) || OV.right.matches(":hover"));

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideAll, 2600);
  }

  function hideAll() {
    if (PINNED) return;
    // 滑鼠停在說明層上時不收起
    ["top", "left", "right"].forEach(function (k) {
      if (!OV[k].matches(":hover")) show(k, false);
    });
    show("chrome", false);
  }

  function flash() {
    if (PINNED) return;
    // 鍵盤操作後短暫顯示，讓使用者看到換了哪一段
    ["top", "left", "chrome"].forEach(function (k) { show(k, true); });
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideAll, 2200);
  }

  // ?hud 把三層釘住，供截圖與教學說明使用
  if (PINNED) {
    Object.keys(OV).forEach(function (k) { show(k, true); });
  } else {
    rec.addEventListener("mousemove", onMove);
    rec.addEventListener("mouseleave", hideAll);
  }

  /* ---------- 播放器 ---------- */
  function posterAt(seg, m) {
    if (typeof seg.poster === "number") return seg.poster;
    if (!m.markers.length) return 3;
    // TUI 錄影不能往中間 seek：捲動區與游標移動無法從中途重建，會疊字。
    // 因此 TUI 段用第一個 marker（仍在啟動畫面），shell 段用第二個。
    return m.markers.length > 1 ? m.markers[1].at - 0.3 : m.markers[0].at;
  }

  function fmt(s) {
    if (!isFinite(s)) return "--:--";
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" +
           String(s % 60).padStart(2, "0");
  }

  function dispose() {
    if (poll) { clearInterval(poll); poll = null; }
    if (player) { try { player.dispose(); } catch (e) {} player = null; }
    mount.innerHTML = "";
  }

  function load(i, autoplay) {
    segI = Math.max(0, Math.min(CASTS.length - 1, i));
    var s = CASTS[segI];
    dispose();
    paintRail();

    titleEl.textContent = s.title;
    metaEl.textContent  = s.id + "  ·  " + s.time;
    noteEl.textContent  = s.note || "";

    fetch("../casts/" + s.id + ".json")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (m) { meta = m; mountPlayer(s, m, autoplay); })
      .catch(function () { meta = null; showMissing(s); });
  }

  function showMissing(s) {
    marks.innerHTML = ""; marksH.textContent = "";
    mount.innerHTML =
      '<div class="missing"><div>尚未錄製 ' + s.id +
      "<br>執行 <code>python3 scripts/record_cast.py " + s.id + "</code> 後重新載入</div></div>";
    cnt.innerHTML = "<b>" + s.id + "</b>";
  }

  function mountPlayer(s, m, autoplay) {
    player = AsciinemaPlayer.create("../casts/" + s.id + ".cast", mount, {
      theme: "dawa",
      fit: "both",
      terminalFontFamily: '"SF Mono","JetBrains Mono",Menlo,ui-monospace,monospace',
      terminalLineHeight: 1.35,
      idleTimeLimit: 2,
      pauseOnMarkers: true,
      markers: m.markers.map(function (x) { return [x.at, x.label]; }),
      poster: "npt:" + posterAt(s, m),
      autoPlay: autoplay === true,
      controls: true
    });

    paintMarks(m);
    // 控制列要等播放器渲染完才量得到
    requestAnimationFrame(function () { requestAnimationFrame(fitSides); });
    setTimeout(fitSides, 400);
    if (sizeWatch) {
      sizeWatch.disconnect();
      var box = mount.querySelector(".ap-player") || mount;
      sizeWatch.observe(box);
    }

    // asciinema-player 沒有 marker 事件，用輪詢對照目前時間
    poll = setInterval(function () {
      if (!player) return;
      var t = player.getCurrentTime ? player.getCurrentTime() : 0;
      var d = player.getDuration ? player.getDuration() : 0;
      var k = -1;
      m.markers.forEach(function (x, i) { if (t >= x.at - 0.15) k = i; });
      highlight(k);
      fill.style.width = (((segI + (d ? t / d : 0)) / CASTS.length) * 100).toFixed(2) + "%";
      cnt.innerHTML = "<b>" + fmt(t) + "</b> / " + fmt(d) +
                      " · 輸入點 " + Math.max(0, k + 1) + " / " + m.markers.length;
      store.write(segI, Math.max(0, k));
    }, 250);
  }

  function paintMarks(m) {
    marksH.innerHTML = m.markers.length + " 個輸入點<br>播放在每個點暫停 · 點擊可跳至該點";
    marks.innerHTML = "";
    m.markers.forEach(function (x) {
      var li = document.createElement("li");
      li.innerHTML = '<span class="t">' + fmt(x.at) + "</span><span>" + x.label + "</span>";
      li.addEventListener("click", function () {
        if (player && player.seek) player.seek(x.at + 0.05);
      });
      marks.appendChild(li);
    });
  }

  function highlight(k) {
    Array.prototype.forEach.call(marks.children, function (el, i) {
      el.classList.toggle("on", i === k);
      el.classList.toggle("done", i < k);
    });
    var cur = marks.children[k];
    if (cur && OV.right.classList.contains("on")) {
      var ct = cur.offsetTop, ch = cur.offsetHeight;
      var st = marks.scrollTop, sh = marks.clientHeight;
      if (ct < st || ct + ch > st + sh) marks.scrollTop = ct - sh / 2 + ch / 2;
    }
  }

  function paintRail() {
    Array.prototype.forEach.call(rail.querySelectorAll(".seg"), function (el, i) {
      el.classList.toggle("on", i === segI);
      el.classList.toggle("done", i < segI);
    });
  }

  CASTS.forEach(function (s, i) {
    var b = document.createElement("button");
    b.className = "seg";
    b.innerHTML = '<div class="n">' + s.id.split("_")[0] + "</div>" +
                  '<div class="t">' + s.title + "</div>" +
                  '<div class="k">' + s.time + "</div>";
    b.addEventListener("click", function () { load(i); });
    rail.appendChild(b);
  });

  var qs = new URLSearchParams(location.search);
  var qSeg = qs.has("seg") ? parseInt(qs.get("seg"), 10) - 1 : NaN;
  var saved = isNaN(qSeg) ? store.read() : { i: qSeg };
  load(saved && saved.i ? saved.i : 0, qs.has("play"));
  flash();

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); load(segI + 1); flash(); break;
      case "ArrowUp":   e.preventDefault(); load(segI - 1); flash(); break;
      case "h": case "H": case "Escape": location.href = "../"; break;
      case "f": case "F":
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        break;
    }
    // → ← 空白 交給 asciinema-player：繼續播放、前後跳
  });

})();
