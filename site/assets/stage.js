/* stage.js — 16:9 舞台縮放 + localStorage 進度記憶（slides 與 demo 共用） */
(function (root) {
  "use strict";

  /* ---- 舞台縮放：把 1280x720 貼合視窗，留一點邊 ---- */
  function fitStage(el, pad) {
    pad = pad == null ? 48 : pad;
    function fit() {
      var s = Math.min(
        (innerWidth - pad) / 1280,
        (innerHeight - pad) / 720
      );
      el.style.setProperty("--scale", s.toFixed(4));
    }
    fit();
    addEventListener("resize", fit);
    return fit;
  }

  /* ---- 進度記憶 ----
     每個播放器有自己的 key。存 {i, step, t}，t 用來顯示「上次看到」。 */
  function Progress(key) {
    var K = "dawa:" + key;
    return {
      read: function () {
        try {
          var v = JSON.parse(localStorage.getItem(K) || "null");
          return v && typeof v.i === "number" ? v : null;
        } catch (e) { return null; }
      },
      write: function (i, step, extra) {
        try {
          var v = { i: i, step: step || 0, t: Date.now() };
          if (extra) for (var k in extra) v[k] = extra[k];
          localStorage.setItem(K, JSON.stringify(v));
        } catch (e) { /* 無痕視窗會丟例外，忽略即可 */ }
      },
      clear: function () {
        try { localStorage.removeItem(K); } catch (e) {}
      }
    };
  }

  /* ---- 相對時間，給首頁的「上次看到」用 ---- */
  function ago(ts) {
    var d = (Date.now() - ts) / 1000;
    if (d < 90) return "剛剛";
    if (d < 3600) return Math.round(d / 60) + " 分鐘前";
    if (d < 86400) return Math.round(d / 3600) + " 小時前";
    return Math.round(d / 86400) + " 天前";
  }

  root.Stage = { fit: fitStage, Progress: Progress, ago: ago };
})(window);
