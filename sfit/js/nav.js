/* Thanh bên + chuyển trang */
(function () {
  "use strict";
  var S = window.SFIT;
  var h = S.h,
    ICONS = S.ICONS,
    state = S.state,
    view = S.view;

  /* ---------- Static icons ---------- */
  document.getElementById("ico-fire").innerHTML =
    '<img src="assets/fire.png" alt="">';
  document.getElementById("ico-vol").innerHTML = ICONS.vol;

  /* ---------- Sidebar ---------- */
  var NAV = [
    ["home", "home", "Trang chủ"],
    ["log", "hist", "Log"],
    ["set", "gear", "Setting"],
    ["intro", "bulb", "Introduce"],
  ];

  var NAV_IMG = {
    gear: "assets/setting.png",
    bulb: "assets/bulb.png",
  };

  var side = document.getElementById("side");
  NAV.forEach(function (n) {
    var b = h("button", {
      html: NAV_IMG[n[1]]
        ? '<img src="' + NAV_IMG[n[1]] + '" alt="">'
        : ICONS[n[1]],
      "aria-label": n[2],
      title: n[2],
      "data-tab": n[0],
      onclick: function () {
        go(n[0]);
      },
    });
    side.appendChild(b);
  });
  function paintNav() {
    Array.prototype.forEach.call(side.children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === state.tab);
    });
  }

  function go(tab) {
    // Nếu có thay đổi chưa lưu
    if (window.SFIT.hasUnsavedSettings) {
      // 1. Tìm nút Save
      var saveBtn = document.querySelector(".btn.unsaved");
      if (saveBtn) {
        // 2. Kích hoạt hiệu ứng rung lắc
        saveBtn.classList.remove("shake");
        void saveBtn.offsetWidth; // Mẹo trigger lại animation
        saveBtn.classList.add("shake");
      }
      // 3. Chặn thoát (return luôn không chạy code đổi màn hình bên dưới)
      return;
    }

    state.tab = tab;
    paintNav();
    view.textContent = "";
    S.ui = {};
    if (tab === "home") view.appendChild(S.buildTimer());
    else if (tab === "set")
      S.buildSettings().forEach(function (n) {
        view.appendChild(n);
      });
    else if (tab === "intro")
      S.buildIntro().forEach(function (n) {
        view.appendChild(n);
      });
    else if (tab === "log") view.appendChild(S.buildLog());
  }

  S.go = go;
})();
