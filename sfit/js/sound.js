/* Phát tiếng từ assets/alert.wav khi bấm nút loa (.vol-left) */
(function () {
  "use strict";

  var audio = new Audio("assets/alert.wav");
  audio.preload = "auto";

  function playAlert() {
    // Tua về đầu để bấm liên tiếp vẫn phát lại ngay
    audio.currentTime = 0;

    // Bắt Promise của .play() để tránh lỗi nếu file chưa tải xong hoặc trình duyệt chặn
    var p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function (err) {
        console.warn("Không phát được âm thanh:", err);
      });
    }
  }

  // Bắt sự kiện click trên document (event delegation) để nút .vol-left luôn ăn dù view được render lại
  document.addEventListener("click", function (e) {
    var volBtn = e.target.closest(".vol-left");
    if (!volBtn) return;
    playAlert();
  });
})();
