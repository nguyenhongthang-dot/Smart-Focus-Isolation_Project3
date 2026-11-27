/* Trang chủ: Timer / Stopwatch */
(function () {
  "use strict";
  var S = window.SFIT;
  var h = S.h,
    fmt = S.fmt,
    ICONS = S.ICONS,
    PRESETS = S.PRESETS,
    state = S.state;

  /* ---------- Timer ---------- */
  var T = state.timer;
  T.started = false; // MỚI: đã bấm Start và chưa Reset (kể cả đang Pause)
  /* MỚI: chế độ hiển thị + danh sách task */
  T.task = null; // tên task đang chọn
  T.tasks = []; // SỬA: danh sách trống, không còn Study/Work/Read mặc định
  var menuOpen = false;
  var CHEVRON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  /* MỚI: icon sửa (bút chì) và xóa (thùng) cho từng task */
  var EDIT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/></svg>';
  var DEL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M12 11v5M9.5 13.5L12 16l2.5-2.5"/></svg>';
  var tick = null;
  var finishTimer = null; // MỚI: chờ 1,5s sau khi hết giờ rồi mới reset về mặc định
  // THÊM HÀM NÀY ĐỂ GỌI BACKEND
  async function triggerBackend(action) {
    try {
      await fetch("http://127.0.0.1:8010/api/collector/" + action, {
        method: "POST",
      });
    } catch (e) {
      console.log("Lỗi kết nối Backend:", e);
    }
  }
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>';

  /* "005000" -> 3000 giây. Trả null nếu sai định dạng */
  function parseHMS(str) {
    if (!/^\d{6}$/.test(str)) return null; // bắt buộc đúng 6 chữ số
    var hh = parseInt(str.slice(0, 2), 10);
    var mm = parseInt(str.slice(2, 4), 10);
    var ss = parseInt(str.slice(4, 6), 10);
    if (mm > 59 || ss > 59) return null; // phút/giây phải < 60
    var sec = hh * 3600 + mm * 60 + ss;
    return sec > 0 ? sec : null; // không cho 000000
  }

  function total() {
    if (T.customSeconds !== undefined && T.customSeconds !== null) {
      return T.customSeconds;
    }
    return PRESETS[T.pi] * 60;
  }

  /* MỚI: nếu đang chờ reset sau khi hết giờ thì reset ngay về 00:25:00 */
  function finishNow() {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
      T.el = 0;
      T.customSeconds = null;
    }
  }

  function startTick() {
    if (tick) return;

    // THÊM DÒNG NÀY: Lưu mốc thời gian lúc bắt đầu chạy dựa trên thời gian hệ thống,
    // trừ đi thời gian đã trôi qua (T.el) để xử lý đúng khi Pause/Continue
    var startTime = Date.now() - T.el * 1000;

    tick = setInterval(function () {
      // SỬA DÒNG NÀY: Tính số giây thực tế trôi qua thay vì dùng T.el += 1
      T.el = Math.floor((Date.now() - startTime) / 1000);

      if (T.mode === "timer" && T.el >= total()) {
        /* MỚI: hết giờ -> vòng tròn đủ 1 vòng, giữ 1,5s rồi reset về mặc định */
        T.run = false;

        // Gọi cho Backend biết là phiên tập trung đã kết thúc (Timer về 0)
        if (T.started) {
          triggerBackend("stop");
        }

        T.started = false; // MỚI: hết giờ -> về trạng thái ban đầu
        T.el = total();
        finishTimer = setTimeout(function () {
          finishTimer = null;
          T.el = 0;
          T.customSeconds = null; // về 00:25:00 mặc định
          paintTimer();
        }, 1500);
      }
      if (!T.run) stopTick();
      paintTimer();
    }, 1000);
  }

  function stopTick() {
    if (tick) {
      clearInterval(tick);
      tick = null;
    }
  }

  function setRun(v) {
    if (v) finishNow(); // MỚI: bấm Start lúc đang chờ reset thì reset luôn rồi chạy
    // THÊM ĐOẠN NÀY: Nếu là lần đầu tiên bật (chưa started) thì gọi API bật quét tin nhắn
    if (v && !T.started) {
      triggerBackend("start");
    }
    if (v) {
      closeTimeModal();
      T.started = true;
    }
    T.run = v;
    if (v) startTick();
    else stopTick();
    paintTimer();
  }

  function reset() {
    if (T.started) {
      triggerBackend("stop");
    }
    finishNow(); // MỚI
    T.el = 0;
    T.started = false; // MỚI: Reset -> về Start focus, Reset mờ lại
    setRun(false);
  }

  /* ---------- Hộp nhập giờ (Set time) ---------- */
  function openTimeModal() {
    if (T.run || T.started || T.mode !== "timer" || !S.ui.modal) return;
    finishNow(); // MỚI: tránh bị reset đè lên giờ vừa nhập
    S.ui.tmInput.value = "";
    S.ui.tmHint.textContent = "";
    S.ui.modal.classList.remove("err");
    S.ui.modal.classList.add("show");
    S.ui.tmInput.focus();
  }

  function closeTimeModal() {
    if (!S.ui.modal) return;
    S.ui.modal.classList.remove("show");
    S.ui.tmInput.blur();
  }

  function onTimeInput() {
    var inp = S.ui.tmInput;
    var v = inp.value.replace(/\D/g, "").slice(0, 6); // chỉ giữ số, tối đa 6
    inp.value = v;
    S.ui.modal.classList.remove("err");
    S.ui.tmHint.textContent = "";
    if (v.length < 6) return; // chưa đủ 6 ký tự -> chưa làm gì

    var sec = parseHMS(v);
    if (sec === null) {
      void S.ui.modal.offsetWidth; // restart animation rung
      S.ui.modal.classList.add("err");
      S.ui.tmHint.textContent =
        "Error: Minutes and seconds cannot exceed 59, and time cannot be 00:00:00";
      return;
    }
    T.customSeconds = sec;
    T.el = 0;
    closeTimeModal();
    paintTimer(); // hiện số lên màn hình, bấm Start focus để đếm ngược
  }

  /* ---------- MỚI: Select a task (giống Select a tag của StudyFoc.us) ---------- */
  function setMenu(v) {
    menuOpen = v;
    S.ui.taskWrap.classList.toggle("open", v);
    if (v) renderTaskMenu();
  }

  function renderTaskMenu() {
    var m = S.ui.taskMenu;
    m.innerHTML = "";

    T.tasks.forEach(function (name, idx) {
      var row = document.createElement("div");
      row.className = "task-item" + (T.task === name ? " on" : "");

      var label = document.createElement("span");
      label.className = "task-name";
      label.textContent = name;

      var edit = document.createElement("button");
      edit.className = "task-act";
      edit.title = "Edit";
      edit.innerHTML = EDIT_ICON;

      var del = document.createElement("button");
      del.className = "task-act";
      del.title = "Delete";
      del.innerHTML = DEL_ICON;

      /* chọn task */
      row.onclick = function (e) {
        e.stopPropagation();
        T.task = name;
        setMenu(false);
        paintTimer();
      };

      /* sửa tên task */
      edit.onclick = function (e) {
        e.stopPropagation();
        var inp = document.createElement("input");
        inp.className = "task-new";
        inp.maxLength = 100;
        inp.value = name;
        inp.onclick = function (ev) {
          ev.stopPropagation();
        };
        inp.onkeydown = function (ev) {
          if (ev.key === "Enter") {
            var n = inp.value.trim();
            if (!n || (n !== name && T.tasks.indexOf(n) !== -1)) return;
            if (T.task === name) T.task = n;
            T.tasks[idx] = n;
            renderTaskMenu();
            paintTimer();
          } else if (ev.key === "Escape") {
            renderTaskMenu();
          }
        };
        m.replaceChild(inp, row);
        inp.focus();
        inp.select();
      };

      /* xóa task */
      del.onclick = function (e) {
        e.stopPropagation();
        T.tasks.splice(idx, 1);
        if (T.task === name) T.task = null;
        renderTaskMenu();
        paintTimer();
      };

      row.appendChild(label);
      row.appendChild(edit);
      row.appendChild(del);
      m.appendChild(row);
    });

    /* thêm task mới */
    var add = document.createElement("button");
    add.className = "task-add";
    add.textContent = "+ Add task";
    add.onclick = function (e) {
      e.stopPropagation();
      var inp = document.createElement("input");
      inp.className = "task-new";
      inp.maxLength = 100;
      inp.placeholder = "Task name...";
      inp.onclick = function (ev) {
        ev.stopPropagation();
      };
      inp.onkeydown = function (ev) {
        if (ev.key === "Enter") {
          var n = inp.value.trim();
          if (!n || T.tasks.indexOf(n) !== -1) return;
          T.tasks.push(n);
          T.task = n;
          setMenu(false);
          paintTimer();
        } else if (ev.key === "Escape") {
          setMenu(false);
        }
      };
      m.replaceChild(inp, add);
      inp.focus();
    };
    m.appendChild(add);
  }

  function buildTimer() {
    var R = 330,
      C = 350;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "ring");
    svg.setAttribute("viewBox", "0 0 700 700");
    svg.innerHTML =
      '<circle cx="' +
      C +
      '" cy="' +
      C +
      '" r="' +
      R +
      '" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="10"/>' +
      '<circle id="arc" cx="' +
      C +
      '" cy="' +
      C +
      '" r="' +
      R +
      '" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="10" pathLength="100" transform="rotate(-90 ' +
      C +
      " " +
      C +
      ')"/>' +
      '<circle id="dot" r="14" fill="#fff"/>';

    S.ui.btnTimer = h("button", {
      text: "Timer",
      onclick: function () {
        switchMode("timer");
      },
    });
    S.ui.btnStop = h("button", {
      text: "Stopwatch",
      onclick: function () {
        switchMode("stop");
      },
    });
    S.ui.time = document.createTextNode("");
    S.ui.hg = h("button", {
      class: "hg",
      html: '<img src="assets/hourglass.png" alt="">',
      title: "Nhấp để nhập thời gian",
      "aria-label": "Nhấp để nhập thời gian",
      onclick: openTimeModal, // chỉ icon đồng hồ cát mở hộp nhập
    });

    // KHÔNG gắn onclick cho .clock nữa (tránh gọi 2 lần do bubbling)
    S.ui.clock = h("div", { class: "clock" }, [S.ui.time, S.ui.hg]);

    S.ui.start = h("button", {
      class: "start",
      onclick: function () {
        setRun(!T.run);
        if (T.run) {
          // chỉ nhún khi vừa bấm sang trạng thái chạy (Start/Continue)
          S.ui.start.classList.remove("pop");
          void S.ui.start.offsetWidth; // trigger lại animation
          S.ui.start.classList.add("pop");
        }
      },
    });
    S.ui.reset = h("button", {
      class: "reset",
      html: ICONS.rs,
      "aria-label": "Reset",
      onclick: reset,
    });

    /* MỚI: ô Select a task */
    S.ui.taskLabel = h("span", { class: "task-label", text: "Select a task" });
    S.ui.taskBtn = h(
      "button",
      {
        class: "task-btn",
        onclick: function (e) {
          e.stopPropagation();
          setMenu(!menuOpen);
        },
      },
      [S.ui.taskLabel, h("span", { class: "task-chev", html: CHEVRON_ICON })],
    );
    S.ui.taskMenu = h("div", { class: "task-menu" });
    S.ui.taskWrap = h("div", { class: "task-wrap" }, [
      S.ui.taskBtn,
      S.ui.taskMenu,
    ]);

    /* bấm ra ngoài thì đóng menu */
    document.addEventListener("click", function (e) {
      if (menuOpen && !S.ui.taskWrap.contains(e.target)) setMenu(false);
    });

    var inner = h("div", { class: "in" }, [
      h("div", { class: "seg" }, [S.ui.btnTimer, S.ui.btnStop]),
      S.ui.taskWrap, // MỚI
      S.ui.clock,
      S.ui.start,
      S.ui.reset,
    ]);

    /* Hộp nhập giờ */
    S.ui.tmInput = h("input", {
      class: "tm-input",
      type: "text",
      inputmode: "numeric",
      maxlength: "6",
      autocomplete: "off",
      placeholder: "Ex: 005000 → 00:50:00, 001249 → 00:12:49, ....",
      "aria-label": "Nhập thời gian dạng hhmmss (6 chữ số)",
      oninput: onTimeInput,
      onkeydown: function (e) {
        if (e.key === "Escape") closeTimeModal();
      },
    });
    S.ui.tmHint = h("p", { class: "tm-hint" });
    S.ui.modal = h(
      "div",
      { class: "tm-modal", role: "dialog", "aria-label": "Set timer" },
      [
        h("div", { class: "tm-head" }, [
          h("span", { class: "tm-tag", text: "Set timer" }),
          h("button", {
            class: "tm-close",
            html: CLOSE_ICON,
            "aria-label": "Đóng",
            onclick: closeTimeModal,
          }),
        ]),
        S.ui.tmInput,
        S.ui.tmHint,
      ],
    );

    var dial = h("div", { class: "dial" }, [svg, inner, S.ui.modal]);
    S.ui.arc = svg.querySelector("#arc");
    S.ui.dot = svg.querySelector("#dot");
    S.ui.stage = h("div", { class: "stage" }, [dial]);
    paintTimer();
    return S.ui.stage;
  }

  function switchMode(m) {
    if (m === T.mode || T.started) return;
    finishNow(); // MỚI
    closeTimeModal();
    T.mode = m;
    T.customSeconds = null;
    T.el = 0;
    T.started = false; // MỚI
    setRun(false);
  }

  /* Icon khung tròn góc phải: fire.png (chưa Start) <-> fire2.png (đã Start) */
  function paintFocusIcon() {
    var ico = document.getElementById("ico-fire");
    if (!ico) return;
    var theme = document.documentElement.getAttribute("data-theme");
    var img = "fire2";
    if (theme == "pond") img = "fire3";
    var key = T.started ? img : "fire";
    if (ico.getAttribute("data-k") === key) return;
    ico.setAttribute("data-k", key);
    ico.innerHTML = '<img src="assets/' + key + '.png" alt="">';
  }

  function paintTimer() {
    paintFocusIcon();
    if (!S.ui.stage) return;
    var shown = T.mode === "timer" ? total() - T.el : T.el;

    /* MỚI: tính phần vòng tròn đã đi (0 -> 1), 0 = chấm ở trên cùng */
    var frac = 0;
    if (T.mode === "timer") {
      // Timer: đi hết 1 vòng khi về 0
      frac = total() > 0 ? T.el / total() : 0;
    } else if (T.el > 0) {
      // Stopwatch: 1 giờ = 1 vòng. Đủ mỗi giờ thì hiện đủ vòng, rồi về đỉnh chạy tiếp
      frac = T.el % 3600 === 0 ? 1 : (T.el % 3600) / 3600;
    }
    frac = Math.min(frac, 1);

    var f = Math.max(frac, 0.002),
      R = 330,
      C = 350;
    var a = -Math.PI / 2 + f * 2 * Math.PI;

    S.ui.arc.setAttribute("stroke-dasharray", f * 100 + " 100");
    S.ui.dot.setAttribute("cx", C + R * Math.cos(a));
    S.ui.dot.setAttribute("cy", C + R * Math.sin(a));

    S.ui.btnTimer.classList.toggle("on", T.mode === "timer");
    S.ui.btnStop.classList.toggle("on", T.mode === "stop");
    S.ui.taskLabel.textContent = T.task || "Select a task";
    S.ui.time.nodeValue = fmt(shown);
    S.ui.hg.style.display = T.mode === "timer" ? "" : "none";
    S.ui.hg.disabled = T.started; // chìm khi đang chạy HOẶC đang Pause
    S.ui.reset.disabled = !T.started; // MỚI: chưa Start thì Reset mờ, không bấm được
    S.ui.btnTimer.disabled = T.started && T.mode !== "timer";
    S.ui.btnStop.disabled = T.started && T.mode !== "stop";
    S.ui.start.textContent = T.run
      ? "Pause"
      : T.started
        ? "Continue"
        : "Start focus";
    S.ui.start.classList.toggle("on", T.run);
  }

  S.buildTimer = buildTimer;
})();
