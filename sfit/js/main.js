/* Điểm khởi động */
(async function () {
  "use strict";
  var S = window.SFIT;

  try {
    // 1. Lấy dữ liệu từ Backend
    const response = await fetch("http://127.0.0.1:8009/api/config");
    if (response.ok) {
      const data = await response.json();

      // 2. Ghi đè vào state hiện tại
      if (data.sources) S.state.sources = data.sources;
      if (data.keywords) S.state.kws = data.keywords; // map keywords backend -> kws frontend
    }
  } catch (e) {
    console.warn("Không thể kết nối Backend lúc khởi động, dùng mặc định.", e);
  }

  // 3. Cập nhật số nguồn đã kết nối
  S.updateConnected();

  // 4. Pill Blocked: nghe backend đẩy sự kiện, tự +1 khi có tin bị chặn
  var es = new EventSource("http://127.0.0.1:8009/api/events");
  es.onopen = S.syncBlocked; // lấy số gốc lúc kết nối (và cả khi tự kết nối lại)
  es.onmessage = function (e) {
    if (e.data === "blocked") {
      S.blockedCount++;
      S.paintBlocked();
    }
  };

  // 5. Render giao diện
  S.go("home");
})();
