/* Điểm khởi động */
(async function () {
  "use strict";
  var S = window.SFIT;

  try {
    // 1. Lấy dữ liệu từ Backend
    const response = await fetch("http://127.0.0.1:8001/api/config");
    if (response.ok) {
      const data = await response.json();

      // 2. Ghi đè vào state hiện tại
      if (data.sources) S.state.sources = data.sources;
      if (data.keywords) S.state.kws = data.keywords; // map keywords backend -> kws frontend
    }
  } catch (e) {
    console.warn("Không thể kết nối Backend lúc khởi động, dùng mặc định.", e);
  }

  // 3. Render giao diện
  S.go("home");
})();
