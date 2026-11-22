import os
import sys
import time
import winsound
import multiprocessing
import socket
import json
import threading
import queue
from database import save_message

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
SOUND_PATH = os.path.join(ASSETS_DIR, "alert.wav")

if not os.path.exists(ASSETS_DIR):
    os.makedirs(ASSETS_DIR)

# ==== CHỈNH KÍCH THƯỚC POPUP Ở ĐÂY: 1.0 = gốc, 0.8 = nhỏ hơn 20%, 0.7 = nhỏ hơn 30% ====
POPUP_SCALE = 0.8

# Biến toàn cục quản lý Tiến trình hiển thị Popup
_popup_process = None

# ----------------------------------------------------
# 1. TIẾN TRÌNH QUẢN LÝ POPUP XẾP CHỒNG (PYQT5)
# ----------------------------------------------------
def _popup_manager_process():
    """
    Tiến trình chạy ứng dụng PyQt5 duy nhất.
    Nhận dữ liệu từ TCP Socket (để hỗ trợ đa tiến trình đồng bộ) và quản lý xếp chồng (stacking) các Popup.
    """
    try:
        from PyQt5.QtWidgets import QApplication, QWidget, QLabel, QPushButton, QVBoxLayout, QHBoxLayout, QFrame, QGraphicsOpacityEffect
        from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QPoint, QRect, QSize, QPointF, QParallelAnimationGroup, QSequentialAnimationGroup
        from PyQt5.QtGui import QPainter, QPixmap, QIcon, QPen, QColor, QPainterPath
    except ImportError:
        print("\n❌ LỖI: Vui lòng cài đặt PyQt5 (Lệnh: pip install PyQt5)")
        return

    app = QApplication.instance()
    if not app:
        app = QApplication(sys.argv)

    # Danh sách lưu trữ các Popup đang hiển thị trên màn hình
    active_popups = []
    local_queue = queue.Queue()

    # Khởi tạo Socket Server lắng nghe tin nhắn từ mọi tiến trình
    def socket_listener():
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        try:
            server.bind(('127.0.0.1', 54321))
            server.listen(10)
        except Exception as e:
            # Nếu port 54321 đã bị một tiến trình PyQt5 khác chiếm, lập tức tự hủy tiến trình dư thừa này
            os._exit(0)
            return
            
        while True:
            try:
                conn, addr = server.accept()
                data = conn.recv(8192).decode('utf-8')
                if data:
                    payload = json.loads(data)
                    local_queue.put(payload)
                conn.close()
            except Exception:
                pass

    listener_thread = threading.Thread(target=socket_listener, daemon=True)
    listener_thread.start()

    class BellIcon(QWidget):
        """Biểu tượng chuông đen (có chấm thông báo) vẽ bằng QPainter."""
        def __init__(self, size=22):
            super().__init__()
            self.setFixedSize(size, size)
            self.setAttribute(Qt.WA_TransparentForMouseEvents)

        def paintEvent(self, event):
            p = QPainter(self)
            p.setRenderHint(QPainter.Antialiasing)
            p.scale(self.width() / 20.0, self.height() / 20.0)
            color = QColor("#1A1A1A")

            bell = QPainterPath()
            bell.moveTo(10, 2.2)
            bell.cubicTo(6.6, 2.2, 5, 4.9, 5, 8.0)
            bell.lineTo(5, 11.2)
            bell.lineTo(3.0, 13.8)
            bell.lineTo(17.0, 13.8)
            bell.lineTo(15, 11.2)
            bell.lineTo(15, 8.0)
            bell.cubicTo(15, 4.9, 13.4, 2.2, 10, 2.2)
            bell.closeSubpath()

            clapper = QPainterPath()
            clapper.addEllipse(QPointF(10, 16.4), 2.0, 1.6)

            cut = QPainterPath()
            cut.addEllipse(QPointF(15.2, 4.6), 3.9, 3.9)

            shape = bell.united(clapper).subtracted(cut)
            p.setPen(QPen(color, 1.0, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
            p.setBrush(color)
            p.drawPath(shape)
            p.setPen(Qt.NoPen)
            p.drawEllipse(QPointF(15.2, 4.6), 2.6, 2.6)

    def make_close_icon():
        """Dấu X vàng nét dày, đầu bo tròn."""
        pm = QPixmap(48, 48)
        pm.fill(Qt.transparent)
        painter = QPainter(pm)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setPen(QPen(QColor("#FFD93B"), 7, Qt.SolidLine, Qt.RoundCap))
        painter.drawLine(9, 9, 39, 39)
        painter.drawLine(39, 9, 9, 39)
        painter.end()
        return QIcon(pm)

    class CustomGradientPopup(QWidget):
        def __init__(self, title, sender_name, message, deep_link, manager_list):
            super().__init__()
            self.manager_list = manager_list
            self.source_app = title          
            self.sender_name = sender_name   
            self.deep_link = deep_link       
            self._is_clicking = False        
            
            self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
            self.setAttribute(Qt.WA_TranslucentBackground)
            self.setCursor(Qt.PointingHandCursor)
            
            k = POPUP_SCALE
            S = lambda v: max(1, int(round(v * k)))
            self.popup_w = S(660)
            self.popup_h = S(105)
            self.gap = 10              
            self.margin_bottom = 45    
            self.margin_right = 20     
            
            self.setFixedSize(self.popup_w, self.popup_h)

            self.setStyleSheet(f"""
                #Outer {{
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                                                stop:0.27 #FFBE19,
                                                stop:1.0 #FFF08C);
                    border: 2px solid #FFFFFF;
                    border-radius: {S(52)}px;
                }}
                #Inner {{
                    background-color: transparent;
                    border-radius: 8px;
                }}
                #Title {{
                    color: #111111;
                    font-size: {S(19)}px;
                    font-weight: bold;
                    font-family: 'Segoe UI', Arial, sans-serif;
                }}
                #Message {{
                    color: #111111;
                    font-size: {S(16)}px;
                    font-weight: normal;
                    font-family: 'Segoe UI', Arial, sans-serif;
                }}
                #CloseBtn {{
                    background: #C3B45F;
                    border: none;
                    border-radius: {S(25)}px;
                }}
                #CloseBtn:hover {{
                    background: #B0A150;
                }}
            """)

            outer = QFrame(self)
            outer.setObjectName("Outer")
            outer.setGeometry(0, 0, self.popup_w, self.popup_h)
            self.outer = outer
            outer_layout = QVBoxLayout(outer)
            outer_layout.setContentsMargins(4, 4, 4, 4)

            inner = QFrame(outer)
            inner.setObjectName("Inner")
            self.inner = inner
            inner_layout = QHBoxLayout(inner)
            inner_layout.setContentsMargins(S(37), S(8), S(33), S(8))
            inner_layout.setSpacing(S(16))

            text_layout = QVBoxLayout()
            text_layout.setSpacing(S(3))

            top_layout = QHBoxLayout()
            top_layout.setSpacing(S(8))
            title_label = QLabel(f"{title}")
            title_label.setObjectName("Title")
            bell_icon = BellIcon(S(22))

            close_btn = QPushButton()
            close_btn.setObjectName("CloseBtn")
            close_btn.setFixedSize(S(50), S(50))
            close_btn.setIcon(make_close_icon())
            close_btn.setIconSize(QSize(S(24), S(24)))
            close_btn.clicked.connect(self.close_and_reposition)

            top_layout.addWidget(title_label)
            top_layout.addWidget(bell_icon)
            top_layout.addStretch()

            msg_label = QLabel(message)
            msg_label.setObjectName("Message")
            msg_label.setWordWrap(True)
            msg_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
            
            msg_label.setAttribute(Qt.WA_TransparentForMouseEvents)
            title_label.setAttribute(Qt.WA_TransparentForMouseEvents)

            text_layout.addStretch()
            text_layout.addLayout(top_layout)
            text_layout.addWidget(msg_label)
            text_layout.addStretch()

            inner_layout.addLayout(text_layout, 1)
            inner_layout.addWidget(close_btn, 0, Qt.AlignVCenter)
            outer_layout.addWidget(inner)

        def _make_anim(self, obj, prop, ms, start, end, curve, overshoot=None):
            """Hàm phụ tạo 1 animation (dùng cho cả xuất hiện và biến mất)."""
            an = QPropertyAnimation(obj, prop)
            an.setDuration(ms)
            an.setStartValue(start)
            an.setEndValue(end)
            ec = QEasingCurve(curve)
            if overshoot is not None:
                ec.setOvershoot(overshoot)
            an.setEasingCurve(ec)
            return an

        def show_with_slide_animation(self):
            desktop = QApplication.desktop().availableGeometry()
            index = self.manager_list.index(self) if self in self.manager_list else 0
            
            target_x = desktop.width() - self.popup_w - self.margin_right
            target_y = desktop.height() - self.popup_h - self.margin_bottom - (index * (self.popup_h + self.gap))
            
            if target_y < 10:
                target_y = 10

            W, H = self.popup_w, self.popup_h
            cx = W // 2
            drop = max(1, int(round(24 * POPUP_SCALE)))
            small = H
            start_small = QRect(cx - small // 2, (H - small) // 2, small, small)
            circle = QRect(cx - H // 2, 0, H, H)
            pill = QRect(0, 0, W, H)

            # Trạng thái ban đầu: viên tròn nhỏ, mờ hẳn, chữ ẩn (đặt TRƯỚC khi show để không bị nháy)
            self.move(target_x, target_y - drop)
            self.setWindowOpacity(0.0)
            self.outer.setGeometry(start_small)
            fx = QGraphicsOpacityEffect(self.inner)
            fx.setOpacity(0.0)
            self.inner.setGraphicsEffect(fx)
            self.show()

            # 1) Mờ dần hiện ra + rơi nhẹ xuống
            fade_in = self._make_anim(self, b"windowOpacity", 350, 0.0, 1.0, QEasingCurve.OutCubic)
            drop_in = self._make_anim(self, b"pos", 600, QPoint(target_x, target_y - drop),
                                      QPoint(target_x, target_y), QEasingCurve.OutBack, 1.0)

            # 2) Viên tròn phóng to, rồi giãn ngang ra thành viên thuốc
            geo = QSequentialAnimationGroup()
            geo.addAnimation(self._make_anim(self.outer, b"geometry", 250, start_small, circle,
                                             QEasingCurve.OutBack, 1.0))
            geo.addAnimation(self._make_anim(self.outer, b"geometry", 700, circle, pill,
                                             QEasingCurve.OutQuint))

            # 3) Giãn xong mới hiện chữ + nút X
            text_in = QSequentialAnimationGroup()
            text_in.addPause(550)
            text_in.addAnimation(self._make_anim(fx, b"opacity", 300, 0.0, 1.0, QEasingCurve.OutCubic))

            self.appear_anim = QParallelAnimationGroup()
            self.appear_anim.addAnimation(fade_in)
            self.appear_anim.addAnimation(drop_in)
            self.appear_anim.addAnimation(geo)
            self.appear_anim.addAnimation(text_in)
            self.appear_anim.finished.connect(lambda: self.inner.setGraphicsEffect(None))
            self.appear_anim.start()

        def mousePressEvent(self, event):
            if event.button() == Qt.LeftButton:
                if self._is_clicking:
                    return
                self._is_clicking = True

                curr_geo = self.geometry()
                shrunken_geo = curr_geo.adjusted(3, 3, -3, -3)

                self.bounce_anim = QPropertyAnimation(self, b"geometry")
                self.bounce_anim.setDuration(120)
                self.bounce_anim.setStartValue(curr_geo)
                self.bounce_anim.setKeyValueAt(0.5, shrunken_geo)
                self.bounce_anim.setEndValue(curr_geo)
                self.bounce_anim.setEasingCurve(QEasingCurve.OutQuad)

                def on_bounce_finished():
                    if self.deep_link:
                        import webbrowser
                        import os
                        try:
                            if self.deep_link.startswith("http"):
                                webbrowser.open(self.deep_link)
                            else:
                                os.startfile(self.deep_link) 
                        except Exception as e:
                            print(f"Lỗi mở link: {e}")
                    else:
                        self.open_and_search_application()
                    
                    self.close_and_reposition()

                self.bounce_anim.finished.connect(on_bounce_finished)
                self.bounce_anim.start()

        def open_and_search_application(self):

            # --- THÊM ĐOẠN NÀY ĐỂ CHẶN TÌM KIẾM VỚI POPUP HỆ THỐNG ---
            if self.source_app == "Smart focus isolation":
                return
            # ---------------------------------------------------------

            import os
            import webbrowser
            try:
                import win32gui
                import win32con
                import win32com.client 
            except ImportError:
                print("Lỗi: Thiếu thư viện pywin32.")
                return

            source = self.source_app.lower()
            # ... (phần code còn lại bên dưới giữ nguyên) ...
            
            import os
            import webbrowser
            try:
                import win32gui
                import win32con
                import win32com.client 
            except ImportError:
                print("Lỗi: Thiếu thư viện pywin32.")
                return

            source = self.source_app.lower()

            try:
                if "zalo" in source:
                    os.startfile("zalo://")
                    return
                elif "messenger" in source:
                    try:
                        os.startfile("messenger://")
                    except Exception:
                        webbrowser.open("https://www.messenger.com")
                    return
                elif "facebook" in source:
                    webbrowser.open("https://www.facebook.com/messages")
                    return
                elif "teams" in source:
                    os.startfile("msteams://")
                    return
                elif "discord" in source:
                    os.startfile("discord://")
                    return
            except Exception as e:
                print(f"URI Scheme fallback: {e}")

            found_hwnds = []

            def enum_windows_callback(hwnd, _):
                if not win32gui.IsWindowVisible(hwnd):
                    return True
                
                title_text = win32gui.GetWindowText(hwnd).lower()
                if not title_text:
                    return True

                search_term = source
                if "chrome" in search_term:
                    search_term = "google chrome"

                if search_term in title_text:
                    found_hwnds.append(hwnd)
                return True

            try:
                win32gui.EnumWindows(enum_windows_callback, None)
                if found_hwnds:
                    hwnd = found_hwnds[0]
                    shell = win32com.client.Dispatch("WScript.Shell")
                    shell.SendKeys('%')
                    
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    win32gui.SetForegroundWindow(hwnd)
            except Exception as e:
                print(f"Lỗi khi focus cửa sổ: {e}")

        def reposition(self):
            desktop = QApplication.desktop().availableGeometry()
            index = self.manager_list.index(self) if self in self.manager_list else 0
            
            target_x = desktop.width() - self.popup_w - self.margin_right
            target_y = desktop.height() - self.popup_h - self.margin_bottom - (index * (self.popup_h + self.gap))
            
            if target_y < 10:
                target_y = 10
            
            self.repos_anim = QPropertyAnimation(self, b"pos")
            self.repos_anim.setDuration(150)
            self.repos_anim.setStartValue(self.pos())
            self.repos_anim.setEndValue(QPoint(target_x, target_y))
            self.repos_anim.setEasingCurve(QEasingCurve.OutCubic)
            self.repos_anim.start()

        def close_and_reposition(self):
            if getattr(self, "_closing", False):
                return
            self._closing = True

            if hasattr(self, "appear_anim"):
                self.appear_anim.stop()

            W, H = self.popup_w, self.popup_h
            cx = W // 2
            drop = max(1, int(round(24 * POPUP_SCALE)))
            small = H
            pill = QRect(0, 0, W, H)
            circle = QRect(cx - H // 2, 0, H, H)
            end_small = QRect(cx - small // 2, (H - small) // 2, small, small)
            pos0 = self.pos()

            fx = QGraphicsOpacityEffect(self.inner)
            fx.setOpacity(1.0)
            self.inner.setGraphicsEffect(fx)

            # 1) Chữ + nút X mờ đi
            text_out = self._make_anim(fx, b"opacity", 300, 1.0, 0.0, QEasingCurve.OutCubic)

            # 2) Viên thuốc co lại thành viên tròn, rồi thu nhỏ
            geo = QSequentialAnimationGroup()
            geo.addAnimation(self._make_anim(self.outer, b"geometry", 500, pill, circle,
                                             QEasingCurve.OutQuint))
            geo.addAnimation(self._make_anim(self.outer, b"geometry", 350, circle, end_small,
                                             QEasingCurve.InCubic))

            # 3) Viên tròn mờ dần và bay nhẹ lên
            fade_par = QParallelAnimationGroup()
            fade_par.addAnimation(self._make_anim(self, b"windowOpacity", 350, 1.0, 0.0, QEasingCurve.InQuad))
            fade_par.addAnimation(self._make_anim(self, b"pos", 350, pos0,
                                                  QPoint(pos0.x(), pos0.y() - drop), QEasingCurve.InQuad))
            fade_out = QSequentialAnimationGroup()
            fade_out.addPause(450)
            fade_out.addAnimation(fade_par)

            # Logic cũ giữ nguyên, chỉ chuyển sang chạy SAU khi animation biến mất kết thúc
            def finish():
                if self in self.manager_list:
                    self.manager_list.remove(self)
                self.close()
                
                for popup in list(self.manager_list):
                    popup.reposition()

            self.exit_anim = QParallelAnimationGroup()
            self.exit_anim.addAnimation(text_out)
            self.exit_anim.addAnimation(geo)
            self.exit_anim.addAnimation(fade_out)
            self.exit_anim.finished.connect(finish)
            self.exit_anim.start()

    def check_queue():
        while not local_queue.empty():
            try:
                payload = local_queue.get_nowait()
                title = payload.get("title")
                sender_name = payload.get("sender_name")
                msg = payload.get("msg")
                deep_link = payload.get("deep_link")
                
                popup = CustomGradientPopup(title, sender_name, msg, deep_link, active_popups)
                active_popups.append(popup)
                
                popup.show_with_slide_animation()
            except Exception:
                break

    timer = QTimer()
    timer.timeout.connect(check_queue)
    timer.start(10)

    app.exec_()

def send_to_popup_server(payload):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            s.connect(('127.0.0.1', 54321))
            s.sendall(json.dumps(payload).encode('utf-8'))
        return True
    except Exception:
        return False

def _ensure_popup_manager_running(payload):
    global _popup_process
    
    # 1. Thử gửi ngay dữ liệu (Nửa sau tin nhắn đầu hoặc từ tin nhắn thứ 2 trở đi)
    if send_to_popup_server(payload):
        return
        
    # 2. Khởi tạo quy trình mới nếu bị chặn hoặc mất kết nối
    if _popup_process is None or not _popup_process.is_alive():
        _popup_process = multiprocessing.Process(
            target=_popup_manager_process,
            daemon=True
        )
        _popup_process.start()
        
    # 3. CHỈNH SỬA Ở ĐÂY: Vòng lặp chờ Socket sẵn sàng (Giải quyết trễ khởi tạo trên Windows)
    max_retries = 10
    for _ in range(max_retries):
        time.sleep(0.5)
        if send_to_popup_server(payload):
            return
            
    print("❌ LỖI: Trình quản lý Popup Server không phản hồi sau 5 giây.")

# ----------------------------------------------------
# 2. HÀM TRUNG TÂM XỬ LÝ KHI AI CÓ KẾT QUẢ
# ----------------------------------------------------
def trigger_alert(source: str, sender: str, content: str, is_urgent: int, reason: str = "", deep_link: str = "",display_sender: str = None):
    save_message(source, sender, content, is_urgent, reason)

    popup_name = display_sender if display_sender else sender

    if is_urgent == 0:
        print(f"ℹ️ [{source}] Tin nhắn từ {sender} KHÔNG GẤP. Đã lưu âm thầm vào DB.")
        return

    print(f"🚨 [{source} - GẤP] Kích hoạt Popup cảnh báo cho: {popup_name}")

    if os.path.exists(SOUND_PATH):
        winsound.PlaySound(SOUND_PATH, winsound.SND_FILENAME | winsound.SND_ASYNC)
    else:  
        winsound.PlaySound("SystemNotification", winsound.SND_ALIAS | winsound.SND_ASYNC)

    message_display = f"<b>{popup_name}</b> : {content}"
    
    payload = {
        "title": source,
        "sender_name": popup_name,
        "msg": message_display,
        "deep_link": deep_link
    }
    _ensure_popup_manager_running(payload)