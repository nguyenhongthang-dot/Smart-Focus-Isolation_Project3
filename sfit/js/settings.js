/* Trang Setting (nguồn thông báo, từ khóa, ngôn ngữ) */
(function () {
  "use strict";
  var S = window.SFIT;
  var h = S.h,
    state = S.state;

  /* Áp theme (chỉ đổi màu/ảnh nền qua biến CSS) */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t || "desert");
  }
  S.applyTheme = applyTheme;
  /* Mở app lên: áp theme đã lưu */
  try {
    var savedCfg = JSON.parse(localStorage.getItem("sfit-settings") || "{}");
    applyTheme(savedCfg.theme);
  } catch (e) {}

  var SUB = {
    Zalo: "Messaging application",
    "Messenger/facebook": "Social network",
    Gmail: "Email box",
    Discord: "Chat community",
  };

  var SRC_ICON = {
    Zalo: "assets/zalo.png",
    "Messenger/facebook": "assets/messenger.png",
    Gmail: "assets/gmail.png",
    Discord: "assets/discord.png",
  };

  function buildSettings() {
    var tabh = h("div", { class: "tabh", text: "Setting" });

    /* language buttons */
    var bVi = h("button", {
      text: "Tiếng Việt",
      onclick: function () {
        if (state.lang === "vi") return;
        state.lang = "vi";
        paintLang();
        autoSave();
      },
    });
    var bEn = h("button", {
      text: "English",
      onclick: function () {
        if (state.lang === "en") return;
        state.lang = "en";
        paintLang();
        autoSave();
      },
    });
    function paintLang() {
      bVi.classList.toggle("on", state.lang === "vi");
      bEn.classList.toggle("on", state.lang === "en");
    }
    paintLang();

    /* theme buttons (chỉ giao diện, chưa đổi chủ đề thật) */
    if (!state.theme) state.theme = "desert";
    var THEMES = [
      ["desert", "Desert"],
      ["pond", "Pond"],
      ["summit", "Summit"],
    ];
    var themeBox = h("div", { class: "theme" });
    var themeBtns = THEMES.map(function (t) {
      var b = h("button", {
        text: t[1],
        onclick: function () {
          if (state.theme === t[0]) return;
          state.theme = t[0];
          paintTheme();
          autoSave();
        },
      });
      themeBox.appendChild(b);
      return b;
    });
    function paintTheme() {
      THEMES.forEach(function (t, i) {
        themeBtns[i].classList.toggle("on", state.theme === t[0]);
      });
    }
    paintTheme();

    /* Trạng thái tự lưu (thay cho nút Save) */
    var status = h("span", { class: "save-status", text: "" });
    var statusTimer = null;
    function showStatus(msg) {
      status.textContent = msg;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        status.textContent = "";
      }, 1600);
    }

    /* Xếp hàng: lần lưu sau luôn chạy sau lần trước, không bị đảo thứ tự */
    var queue = Promise.resolve();
    function autoSave() {
      queue = queue.then(doSave);
    }

    async function doSave() {
      try {
        localStorage.setItem(
          "sfit-settings",
          JSON.stringify({
            sources: state.sources,
            kws: state.kws,
            lang: state.lang,
            theme: state.theme,
          }),
        );
        S.applyTheme(state.theme);
        var ico = document.getElementById("ico-fire");
        if (ico) ico.removeAttribute("data-k");

        const response = await fetch("http://127.0.0.1:8010/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: state.sources, keywords: state.kws }),
        });

        if (response.ok) {
          S.updateConnected();
          S.activeLang = state.lang;
          S.applyLang();
        } else {
          console.error("API Error", response.status);
        }
      } catch (e) {
        console.error(e);
      }
    }

    var top = h("div", { class: "top" }, [
      h("div", null, [
        h("b", {
          text: "App notification source",
          style: "font-size:18px",
        }),
        h("p", { text: "Toggle AI listening and analysis per app." }),
      ]),
      h("div", { class: "acts" }, [
        themeBox,
        h("div", { class: "lang" }, [bEn, bVi]),
      ]),
    ]);

    /* sources grid */
    var grid = h("div", { class: "grid" });
    Object.keys(SRC_ICON).forEach(function (k) {
      var sw = h("button", {
        class: "sw",
        role: "switch",
        "aria-label": k,
      });
      var card = h("div", { class: "src" }, [
        h("img", { class: "src-ico", src: SRC_ICON[k], alt: "" }),
        h("div", { class: "src-txt" }, [
          k === "GMAIL" ? "Gmail" : k,
          h("small", { text: SUB[k] || "" }),
        ]),
        sw,
      ]);
      function paint() {
        var on = !!state.sources[k];
        card.classList.toggle("on", on);
        sw.classList.toggle("on", on);
        sw.setAttribute("aria-checked", on);
      }
      sw.addEventListener("click", function () {
        state.sources[k] = !state.sources[k];
        autoSave();
        paint();
      });
      paint();
      grid.appendChild(card);
    });

    /* keywords */
    var input = h("input", {
      placeholder: "+ Add keywords (App will prioritize your keywords)",
      "aria-label": "Add keyword",
    });
    var kw = h("div", { class: "kw" }, [input]);
    function paintChips() {
      Array.prototype.slice
        .call(kw.querySelectorAll(".chip"))
        .forEach(function (c) {
          c.remove();
        });
      state.kws.forEach(function (k) {
        var x = h("span", {
          class: "x",
          text: "×",
          role: "button",
          "aria-label": "Remove " + k,
        });
        x.addEventListener("click", function () {
          state.kws = state.kws.filter(function (v) {
            return v !== k;
          });
          autoSave();
          paintChips();
        });
        kw.insertBefore(h("span", { class: "chip" }, [k + " ", x]), input);
      });
    }
    input.addEventListener("keydown", function (e) {
      var v = input.value.trim();
      if (e.key === "Enter" && v) {
        if (state.kws.indexOf(v) === -1) {
          state.kws.push(v);
          autoSave();
        }
        input.value = "";
        paintChips();
      }
    });
    paintChips();

    var panel = h("div", { class: "panel" }, [
      top,
      grid,
      h("div", { class: "divider" }),
      h("b", {
        text: "AI brain configuration",
        style: "font-size:18px",
      }),
      h("p", { text: "Your emergency keyword:" }),
      kw,
    ]);
    return [tabh, panel];
  }

  S.buildSettings = buildSettings;
})();
