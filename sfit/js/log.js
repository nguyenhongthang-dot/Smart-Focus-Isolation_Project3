/* Trang Log (thông báo khẩn) */
(function () {
  "use strict";
  var S = window.SFIT;
  var h = S.h;

  /* Bảng ảnh theo tên nguồn ứng dụng */
  var LOG_ICON = {
    zalo: "assets/zalo.png",
    messenger: "assets/messenger.png",
    gmail: "assets/gmail.png",
    discord: "assets/discord.png",
    facebook: "assets/facebook.png",
  };

  function buildLog() {
    var head = h(
      "div",
      {
        class: "top",
        style:
          "align-items:center;padding-bottom:2vh;border-bottom:1px solid rgba(255,255,255,.4)",
      },
      [
        h("b", {
          text: "Recent emergency notification log (last 2 days)",
          style: "font-size:clamp(16px,2.8vh,24px)",
        }),
        h("button", {
          class: "btn",
          text: "▶ Back to focus mode",
          onclick: function () {
            S.go("home");
          },
        }),
      ],
    );

    /* Khởi tạo panel và một container chứa danh sách để append dữ liệu bất đồng bộ */
    var panel = h("div", { class: "panel" }, [head]);
    var listContainer = h("div", { class: "log-list" });
    panel.appendChild(listContainer);

    /* Fetch dữ liệu thực tế từ Backend API (cổng 8001) */
    fetch("http://127.0.0.1:8001/api/recent-urgent")
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || data.length === 0) {
          listContainer.appendChild(
            h("p", {
              text: "Không có thông báo khẩn cấp nào.",
              style: "padding: 15px; text-align: center;",
            }),
          );
          return;
        }

        data.forEach(function (msg) {
          var sourceKey = msg.source.toLowerCase();
          var icon = LOG_ICON[sourceKey] || "";

          // Thay đổi đoạn code tạo biến av hiện tại thành:
          var imgStyle =
            sourceKey === "facebook" ? "transform: scale(1.4);" : "";

          var av = icon
            ? h("img", { class: "av", src: icon, alt: "", style: imgStyle })
            : h("div", {
                class: "av",
                text: msg.source.charAt(0),
                style: "background: #2F5BE8",
              });

          var title = msg.source + " • " + msg.sender;

          listContainer.appendChild(
            h("div", { class: "log" }, [
              av,
              h("div", null, [
                h("b", { text: title, style: "font-size:14px" }),
                h("small", { text: msg.time_str }),
                h("p", { text: msg.content }),
              ]),
              h("span", { class: "ur", title: msg.reason }, [
                h("img", { src: "assets/warning.png", alt: "" }),
                "Urgent",
              ]),
            ]),
          );
        });
      })
      .catch(function (error) {
        console.error("Lỗi lấy dữ liệu từ server:", error);
        listContainer.appendChild(
          h("p", {
            text: "Lỗi kết nối tới máy chủ.",
            style: "padding: 15px; color: red;",
          }),
        );
      });

    return panel;
  }

  S.buildLog = buildLog;
})();
