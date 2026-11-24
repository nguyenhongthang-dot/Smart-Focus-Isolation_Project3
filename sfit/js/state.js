/* Trạng thái chung của app (giữ nguyên khi chuyển tab) + đọc cài đặt đã lưu */
(function () {
  "use strict";
  var S = window.SFIT;

  /* ---------- State (kept while switching tabs) ---------- */
  var PRESETS = [15, 25, 45, 60, 90];
  var state = {
    tab: "home",
    timer: { mode: "timer", cat: "Study", run: false, el: 0, pi: 1 },
    sources: {
      Zalo: true,
      "Messenger/facebook": false,
      Gmail: false,
      Discord: false,
    },
    kws: ["deadline"],
    lang: "en",
  };
  try {
    var saved = JSON.parse(localStorage.getItem("sfit-settings") || "null");
    if (saved) {
      // Chỉ giữ lại việc tải ngôn ngữ và chủ đề từ localStorage
      if (saved.lang) state.lang = saved.lang;
      if (saved.theme) state.theme = saved.theme;
    }
  } catch (e) {
    /* localStorage may be unavailable */
  }

  S.PRESETS = PRESETS;
  S.state = state;
  S.view = document.getElementById("view");
  /* Đếm số nguồn đang bật và hiện lên pill "Connected" */
  S.updateConnected = function () {
    var el = document.getElementById("connected-count");
    if (!el) return;
    var n = Object.keys(state.sources).filter(function (k) {
      return state.sources[k];
    }).length;
    el.textContent = n + (n === 1 ? " resource" : " resources");
  };

  /* Pill "Blocked": giữ số đếm, chỉ hỏi backend 1 lần để lấy số gốc */
  S.blockedCount = 0;

  S.paintBlocked = function () {
    var el = document.getElementById("blocked-count");
    if (!el) return;
    var n = S.blockedCount;
    el.textContent = n + (n === 1 ? " message" : " messages");
  };

  S.syncBlocked = async function () {
    try {
      var res = await fetch("http://127.0.0.1:8009/api/stats");
      if (!res.ok) return;
      var data = await res.json();
      S.blockedCount = data.today.blocked;
      S.paintBlocked();
    } catch (e) {}
  };

  S.ui = {}; // tham chiếu tới phần tử timer đang hiển thị
})();
