/* edit.js — 就地編輯
   E 進入／離開編輯模式。編輯模式下所有含文字的元素可直接點擊修改。
   修改存在 localStorage，與觀看進度分開。X 匯出成 JSON。 */
(function (root) {
  "use strict";

  // 可編輯的元素。父層若包含另一個可編輯元素，則父層不掛。
  var SEL = [
    "h1", "h2", "p", "li", "td", "th", "figcaption",
    ".claim", ".eyebrow", ".col-h", ".cmds .c", ".cmds .d",
    ".pipe .t", ".pipe .d", ".title-meta .k", ".title-meta .v",
    ".cap", ".figcap", ".say", ".asst", ".endcard", ".tool .det"
  ].join(",");

  function Editor(opts) {
    var sel = SEL;
    var KEY   = "dawa:" + opts.key + ":edits";
    var root_ = opts.root;                 // 掛載編輯的容器
    var scope = opts.scope;                // 回傳目前的 scope id（張／段）
    var badge, on = false;
    // 基底為 assets/overrides.json（可選），localStorage 的修改覆蓋其上
    var base  = (root.OVERRIDES && root.OVERRIDES[opts.key]) || {};
    var store = Object.assign({}, base, read());

    function read() {
      try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
      catch (e) { return {}; }
    }
    function save() {
      // 只把與基底不同的部分寫進 localStorage
      var diff = {};
      Object.keys(store).forEach(function (k) {
        if (store[k] !== base[k]) diff[k] = store[k];
      });
      try { localStorage.setItem(KEY, JSON.stringify(diff)); } catch (e) {}
      paintBadge();
    }

    // 在容器內收集可編輯元素；巢狀時只取最內層
    function targets(container) {
      var all = Array.prototype.slice.call(container.querySelectorAll(sel));
      return all.filter(function (el) {
        if (!el.textContent.trim()) return false;
        return !all.some(function (o) { return o !== el && el.contains(o); });
      });
    }

    // 套用已存的修改。每次 render 後呼叫。
    function apply(container) {
      var id = scope(), t = targets(container);
      t.forEach(function (el, i) {
        var v = store[id + "/" + i];
        if (v != null) el.innerHTML = v;
      });
      if (on) arm(container);
    }

    function arm(container) {
      targets(container).forEach(function (el, i) {
        var k = scope() + "/" + i;
        el.setAttribute("contenteditable", "true");
        el.dataset.editKey = k;
        el.classList.add("editable");
      });
    }
    function disarm(container) {
      container.querySelectorAll("[contenteditable]").forEach(function (el) {
        el.removeAttribute("contenteditable");
        el.classList.remove("editable");
      });
    }

    function onInput(e) {
      var el = e.target.closest("[data-edit-key]");
      if (!el || !on) return;
      store[el.dataset.editKey] = el.innerHTML;
      save();
    }

    function paintBadge() {
      if (!badge) return;
      var n = Object.keys(store).length;
      badge.innerHTML = on
        ? '編輯中 · ' + n + ' 處修改 <span class="k">X 存檔</span> <span class="k">E 離開</span>'
        : "";
      badge.classList.toggle("on", on);
    }

    function toggle(container) {
      on = !on;
      if (on) { arm(container); document.body.classList.add("editing"); }
      else    { disarm(container); document.body.classList.remove("editing"); }
      paintBadge();
      return on;
    }

    // 存檔：優先寫入 site/assets/overrides.js（需由 scripts/serve.py 提供），
    // 沒有寫檔端點時退回剪貼簿與手動貼上。
    function exportJSON() {
      var all = Object.assign({}, root.OVERRIDES || {});
      all[opts.key] = store;
      var txt = JSON.stringify(all, null, 2);
      var box = document.getElementById("export-box");
      var ta = box.querySelector("textarea");
      var msg = box.querySelector(".status");

      ta.value = txt;
      box.classList.add("on");
      msg.textContent = "寫入中…";
      msg.className = "status";

      fetch("/_save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: txt
      })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          msg.textContent = "已寫入 " + d.path + "（" + d.keys + " 處）。git 可追蹤此檔案。";
          msg.className = "status ok";
        })
        .catch(function () {
          msg.textContent = "沒有寫檔端點（請用 make serve）。內容已複製到剪貼簿，" +
                            "手動貼進 site/assets/overrides.js。";
          msg.className = "status warn";
          try { navigator.clipboard.writeText(txt); } catch (e) {}
          ta.select();
        });
    }
    function closeExport() { document.getElementById("export-box").classList.remove("on"); }
    function reset() {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    }

    badge = document.getElementById("edit-badge");
    document.addEventListener("input", onInput, true);

    return {
      apply: apply, toggle: toggle, exportJSON: exportJSON,
      closeExport: closeExport, reset: reset,
      isOn: function () { return on; },
      count: function () { return Object.keys(store).length; }
    };
  }

  root.Editor = Editor;
})(window);
