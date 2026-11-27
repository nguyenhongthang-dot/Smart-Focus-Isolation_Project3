/* Dịch toàn bộ giao diện Anh -> Việt (chỉ khi đã bấm Save) */
(function () {
  "use strict";
  var S = window.SFIT;

  /* Chữ đang hiển thị thật sự (khác state.lang: state.lang đổi ngay khi bấm nút,
     còn activeLang chỉ đổi sau khi Save) */
  S.activeLang = S.state.lang;

  var VI = {
    /* Pill bên trái (sửa lại cho khớp chữ trong index.html nếu khác) */
    "Model AI :": "Mô hình AI :",
    "Connected :": "Đã kết nối :",
    "Blocked :": "Đã chặn :",

    /* Timer */
    Timer: "Hẹn giờ",
    Stopwatch: "Bấm giờ",
    "Start focus": "Bắt đầu tập trung",
    Pause: "Tạm dừng",
    Continue: "Tiếp tục",
    "Select a task": "Chọn một nhiệm vụ",
    "+ Add task": "+ Thêm nhiệm vụ",
    "Task name...": "Tên nhiệm vụ...",
    "Set timer": "Đặt giờ",
    Edit: "Sửa",
    Delete: "Xóa",
    "Ex: 005000 → 00:50:00, 001249 → 00:12:49, ....":
      "Ví dụ: 005000 → 00:50:00, 001249 → 00:12:49, ....",
    "Error: Minutes and seconds cannot exceed 59, and time cannot be 00:00:00":
      "Lỗi: Phút và giây không được vượt quá 59, và thời gian không được là 00:00:00",

    /* Setting */
    Setting: "Cài đặt",
    "Data sources and AI configuration": "Nguồn và cấu hình AI",
    "App notification source": "Nguồn thông báo ứng dụng",
    "Toggle AI listening and analysis per app.":
      "Bật/tắt AI theo từng ứng dụng.",
    "Save AI configuration": "Lưu cấu hình AI",
    Saved: "Đã lưu",
    "API Error": "Lỗi API",
    "Cannot save": "Không thể lưu",
    Desert: "Sa mạc",
    Pond: "Ao hồ",
    Summit: "Đỉnh núi",
    "Messaging application": "Ứng dụng nhắn tin",
    "Social network": "Mạng xã hội",
    "Email box": "Hộp thư",
    "Chat community": "Cộng đồng chat",
    "AI brain configuration": "Cấu hình bộ não AI",
    "Your emergency keyword:": "Từ khóa khẩn cấp của bạn:",
    "+ Add keywords (App will prioritize your keywords)":
      "+ Thêm từ khóa (App sẽ ưu tiên từ khóa của bạn)",

    /* Log */
    "Recent emergency notification log (last 2 days)":
      "Nhật ký thông báo khẩn cấp gần đây (2 ngày qua)",
    "▶ Back to focus mode": "▶ Quay lại chế độ tập trung",
    Urgent: "Khẩn cấp",

    /* Introduce */
    Introduce: "Giới thiệu",
    "+ Your feedback": "+ Góp ý của bạn",
    Send: "Gửi",
    "Sending...": "Đang gửi...",
    "Processing Rules:": "Quy tắc xử lý:",
    "• Non-urgent: System remains silent and auto-saves.":
      "• Không khẩn cấp: Hệ thống im lặng và tự động lưu lại.",
    "• Urgent: Activates sound and pushes a priority alert.":
      "• Khẩn cấp: Bật âm thanh và đẩy thông báo ưu tiên.",
    'Managing computer notifications is a constant dilemma: turning on "Do Not Disturb" blocks everything—risking missed emergencies or deadlines—while leaving it off invites endless distractions. We need a smart filter that silences everyday noise while letting urgent, time-sensitive messages through.':
      'Quản lý thông báo mạng từ xã hội luôn là bài toán khó: Bật "Do Not Disturb" trên Windows thì dễ lỡ việc gấp hay deadline, còn tắt đi lại liên tục bị tin nhắn không quan trọng làm phiền. Vì vậy, ta cần một bộ lọc thông minh để chặn thông báo thường ngày và chỉ cho phép tin khẩn cấp đi qua.',
    "This is an AI-integrated software running in the background on Windows to protect your deep work space. By using AI to analyze the context of every incoming message, the application completely suppresses unnecessary, distracting messages. It only triggers a sound and pop-up alert when it detects truly urgent information or deadlines, helping users eliminate the fear of missing important messages during their focus sessions.":
      "Đây là phần mềm tích hợp AI chạy nền trên Windows được ẩn dưới hình thức của một ứng dụng Pomodoro Timer. Bằng cách dùng AI phân tích ngữ cảnh của từng tin nhắn đến, ứng dụng loại bỏ hoàn toàn những tin không cần thiết, gây xao nhãng. Chỉ khi phát hiện thông tin hoặc deadline thật sự khẩn cấp, ứng dụng mới phát âm thanh và hiện cảnh báo, giúp người dùng không còn lo bỏ lỡ tin quan trọng trong lúc tập trung.",
  };

  /* Chữ có số (đếm động) */
  function rule(s) {
    var m;
    if ((m = s.match(/^(\d+) resources?$/))) return m[1] + " nguồn";
    if ((m = s.match(/^(\d+) messages?$/))) return m[1] + " tin nhắn";
    return null;
  }

  var missing = {};
  function tr(s) {
    var t = s.trim();
    if (!t) return null;
    var v = VI[t] || rule(t);
    if (!v) {
      if (/[A-Za-z]{3}/.test(t)) missing[t] = 1; // ghi lại chữ chưa có trong bảng
      return null;
    }
    return s.replace(t, function () {
      return v;
    });
  }
  /* Gõ SFIT.untranslated() trong Console để xem chữ nào chưa dịch */
  S.untranslated = function () {
    return Object.keys(missing);
  };

  var textStore = new WeakMap(); // text node -> {en, vi}
  var attrStore = new WeakMap(); // element -> {attr: {en, vi}}
  var ATTRS = ["placeholder", "title", "aria-label"];

  function doText(node) {
    var rec = textStore.get(node),
      cur = node.nodeValue;
    if (rec && cur === rec.vi) {
      // đây là bản dịch do mình đặt
      if (S.activeLang !== "vi") {
        node.nodeValue = rec.en;
        textStore.delete(node);
      }
      return;
    }
    if (S.activeLang === "vi") {
      // chữ gốc mới -> dịch
      var v = tr(cur);
      if (v !== null) {
        textStore.set(node, { en: cur, vi: v });
        node.nodeValue = v;
      } else textStore.delete(node);
    } else if (rec) textStore.delete(node);
  }

  function doAttr(el, a) {
    var cur = el.getAttribute(a);
    if (cur == null) return;
    var m = attrStore.get(el) || {},
      rec = m[a];
    if (rec && cur === rec.vi) {
      if (S.activeLang !== "vi") {
        el.setAttribute(a, rec.en);
        delete m[a];
      }
      return;
    }
    if (S.activeLang === "vi") {
      var v = tr(cur);
      if (v !== null) {
        m[a] = { en: cur, vi: v };
        el.setAttribute(a, v);
      } else delete m[a];
    } else delete m[a];
    attrStore.set(el, m);
  }

  function walk(n) {
    if (n.nodeType === 3) return doText(n);
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.tagName)) return;
    ATTRS.forEach(function (a) {
      doAttr(n, a);
    });
    for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
  }

  S.applyLang = function () {
    document.documentElement.lang = S.activeLang;
    walk(document.body);
  };

  /* Tự dịch mọi thứ được vẽ thêm / cập nhật sau này */
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(walk);
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });

  S.applyLang(); // lần đầu (nếu lần trước đã lưu tiếng Việt thì mở app lên là tiếng Việt luôn)
})();
