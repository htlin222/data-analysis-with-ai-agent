/* deck.js — 投影片播放器
   → 逐步揭露；↓ 直接跳下一張；進度存在 localStorage。 */
(function () {
  "use strict";

  var deck    = document.getElementById("deck");
  var counter = document.getElementById("counter");
  var fill    = document.getElementById("fill");
  var actEl   = document.getElementById("act");
  var toast   = document.getElementById("toast");
  var notesEl = document.getElementById("notes");
  var notesBd = notesEl.querySelector(".nb");
  var store   = Stage.Progress("slides");
  var editor  = Editor({ key: "slides", root: deck, scope: function () { return cur; } });
  var total   = SLIDES.length;
  var cur = 0, step = 0;
  // 備忘稿的開關狀態跨場次記住，講者不必每次重開。
  var notesOn = localStorage.getItem("slides.notes") === "1";

  /* ---- 建立所有投影片 ---- */
  SLIDES.forEach(function (s, i) {
    var el = document.createElement("section");
    el.className = "slide " + s.cls;
    el.innerHTML = s.html;
    deck.appendChild(el);
  });
  var els = Array.prototype.slice.call(deck.children);

  function maxStep(el) {
    var m = 0;
    el.querySelectorAll("[data-step]").forEach(function (n) {
      m = Math.max(m, +n.dataset.step || 0);
    });
    return m;
  }

  function applyStep(el, s) {
    el.querySelectorAll("[data-step]").forEach(function (n) {
      n.classList.toggle("on", (+n.dataset.step || 0) <= s);
    });
  }

  function render(save) {
    els.forEach(function (el, i) { el.classList.toggle("on", i === cur); });
    applyStep(els[cur], step);
    var m = maxStep(els[cur]);
    counter.innerHTML = "<b>" + String(cur + 1).padStart(2, "0") + "</b> / " + total;
    actEl.textContent = SLIDES[cur].act + " · " + SLIDES[cur].title;
    fill.style.width = (((cur + (m ? step / m : 1)) / total) * 100).toFixed(2) + "%";
    editor.apply(els[cur]);
    notesBd.innerHTML = SLIDES[cur].notes || "<span style='color:var(--ink-3)'>（這張沒有備忘稿）</span>";
    if (save !== false) store.write(cur, step);
  }

  function go(i, atEnd) {
    cur = Math.max(0, Math.min(total - 1, i));
    step = atEnd ? maxStep(els[cur]) : 0;
    render();
  }

  function next() {
    if (step < maxStep(els[cur])) { step++; render(); }
    else if (cur < total - 1) go(cur + 1);
  }

  function prev() {
    if (step > 0) { step--; render(); }
    else if (cur > 0) go(cur - 1, true);
  }

  /* ---- 深層連結 ?s=N 優先於續看 ---- */
  var qs = new URLSearchParams(location.search);
  var jump = qs.has("s") ? parseInt(qs.get("s"), 10) - 1 : NaN;
  var saved = isNaN(jump) ? store.read() : { i: jump, step: -1, t: Date.now() };
  if (saved && saved.i >= 0 && saved.i < total) {
    cur = saved.i;
    // step = -1 代表深層連結：直接顯示整張
    step = saved.step === -1 ? maxStep(els[cur]) : (saved.step || 0);
    toast.textContent = (saved.step === -1 ? "直接跳到第 " : "從第 ") + (cur + 1) +
                        " 張" + (saved.step === -1 ? "" : "繼續") + " · 按 Home 回到開頭";
    toast.classList.add("on");
    setTimeout(function () { toast.classList.remove("on"); }, 3200);
  }
  render(false);
  notesEl.classList.toggle("on", notesOn);
  if (qs.has("edit")) editor.toggle(els[cur]);

  /* ---- 鍵盤 ---- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // 匯出視窗開著時只吃 Escape
    var box = document.getElementById("export-box");
    if (box.classList.contains("on")) {
      if (e.key === "Escape") { e.preventDefault(); editor.closeExport(); }
      return;
    }
    // 編輯模式：方向鍵與空白鍵交給游標，只保留 E 與 X
    if (editor.isOn()) {
      if (e.key === "e" && !e.target.isContentEditable) { editor.toggle(els[cur]); }
      else if (e.key === "Escape") { e.preventDefault(); editor.toggle(els[cur]); }
      else if (e.key === "x" && !e.target.isContentEditable) { editor.exportJSON(); }
      else if (e.key === "X") { e.preventDefault(); editor.exportJSON(); }
      else if (e.key === "E") { e.preventDefault(); editor.toggle(els[cur]); }
      return;
    }

    switch (e.key) {
      case "e": case "E": e.preventDefault(); editor.toggle(els[cur]); break;
      case "n": case "N":
        e.preventDefault();
        notesOn = !notesOn;
        notesEl.classList.toggle("on", notesOn);
        localStorage.setItem("slides.notes", notesOn ? "1" : "0");
        break;
      case "ArrowRight": case " ": case "PageDown": e.preventDefault(); next(); break;
      case "ArrowLeft":  case "PageUp":            e.preventDefault(); prev(); break;
      case "ArrowDown":  e.preventDefault(); go(cur + 1); break;
      case "ArrowUp":    e.preventDefault(); go(cur - 1); break;
      case "Home":       e.preventDefault(); go(0); break;
      case "End":        e.preventDefault(); go(total - 1, true); break;
      case "f": case "F":
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        break;
      case "h": case "H": case "Escape": location.href = "../"; break;
    }
  });

  /* ---- 點擊翻頁：右 2/3 前進，左 1/3 後退 ---- */
  document.getElementById("stage").addEventListener("click", function (e) {
    if (editor.isOn() || e.target.closest("a, button, img")) return;
    var r = this.getBoundingClientRect();
    ((e.clientX - r.left) / r.width < 0.33 ? prev : next)();
  });

  document.getElementById("export-box").addEventListener("click", function (e) {
    var a = e.target.dataset.act;
    if (a === "close") editor.closeExport();
    if (a === "reset" && confirm("清除所有文字修改？")) editor.reset();
  });

  Stage.fit(document.getElementById("stage"));
})();
