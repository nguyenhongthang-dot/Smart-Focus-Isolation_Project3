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
  S.ui = {}; // tham chiếu tới phần tử timer đang hiển thị
})();
