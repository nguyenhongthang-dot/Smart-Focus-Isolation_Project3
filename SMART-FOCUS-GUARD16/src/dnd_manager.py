import ctypes
import os
import sys
import threading
import time
from ctypes import byref, c_long, c_uint32, c_void_p, POINTER


# ---------------------------------------------------------------------------
# 1. ĐỌC TRẠNG THÁI DO NOT DISTURB (Windows 10/11)
# ---------------------------------------------------------------------------
# Windows không có API công khai cho DND. Cách đáng tin nhất là đọc WNF state
# WNF_SHEL_QUIETHOURS_ACTIVE_PROFILE_CHANGED - chính là nơi Shell của Windows
# dùng để biết DND đang bật hay tắt (không cần mở Settings, không cần UI).
#   0 = Tắt | 1 = Bật (Priority only) | 2 = Bật (Alarms only)

class WNF_STATE_NAME(ctypes.Structure):
    _fields_ = [("Data", c_uint32 * 2)]


# 0x0D83063EA3BF1C75 -> chia thành 2 DWORD (thấp, cao)
_WNF_QUIETHOURS = (0xA3BF1C75, 0x0D83063E)


def is_dnd_enabled():
    """
    Trả về:
      True  -> DND đang BẬT
      False -> DND đang TẮT
      None  -> Không đọc được (không phải Windows / API bị đổi) -> coi là "không rõ"
    """
    if sys.platform != "win32":
        return None
    try:
        fn = ctypes.WinDLL("ntdll").NtQueryWnfStateData
        fn.argtypes = [
            POINTER(WNF_STATE_NAME), c_void_p, c_void_p,
            POINTER(c_uint32), c_void_p, POINTER(c_uint32),
        ]
        fn.restype = c_long  # NTSTATUS

        state = WNF_STATE_NAME(_WNF_QUIETHOURS)
        stamp = c_uint32(0)
        buf = c_uint32(0)
        size = c_uint32(ctypes.sizeof(buf))

        status = fn(byref(state), None, None, byref(stamp), byref(buf), byref(size))
        if status < 0:  # NT_SUCCESS(status) == status >= 0
            return None
        return buf.value != 0
    except Exception as e:
        print(f"[DND] Không đọc được trạng thái: {e}")
        return None


# ---------------------------------------------------------------------------
# 2. MỞ CÀI ĐẶT VÀ ĐƯA LÊN TRƯỚC
# ---------------------------------------------------------------------------

def _bring_settings_to_front():
    time.sleep(0.5)
    try:
        import win32con
        import win32gui

        def cb(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return True
            if win32gui.GetWindowText(hwnd).lower() in ("settings", "cài đặt"):
                try:
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    flags = win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW
                    win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0, flags)
                    win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0, flags)
                    win32gui.SetForegroundWindow(hwnd)
                    return False
                except Exception:
                    pass
            return True

        win32gui.EnumWindows(cb, None)
    except Exception as e:
        print(f"[DND Focus Error]: {e}")


def open_dnd_settings() -> bool:
    """Mở trang Notifications (có công tắc Do not disturb) và đưa lên trước."""
    try:
        os.startfile("ms-settings:notifications")  # Windows 11
        threading.Thread(target=_bring_settings_to_front, daemon=True).start()
        return True
    except Exception as e:
        print(f"[DND LỖI]: Không thể mở Cài đặt Windows: {e}")
        return False


# ---------------------------------------------------------------------------
# 3. LOGIC "CHỈ HIỆN KHI CẦN"
# ---------------------------------------------------------------------------

def prompt_enable_dnd() -> bool:
    """Gọi khi bấm START. Chỉ mở Settings nếu DND CHƯA bật."""
    state = is_dnd_enabled()
    if state is True:
        print("[DND] Đã bật sẵn -> không cần hiện Settings.")
        return False
    # state là False (chưa bật) hoặc None (không rõ -> an toàn là vẫn nhắc)
    return open_dnd_settings()


def prompt_disable_dnd() -> bool:
    """Gọi khi bấm STOP/kết thúc. Chỉ mở Settings nếu DND CHƯA tắt."""
    state = is_dnd_enabled()
    if state is False:
        print("[DND] Đã tắt sẵn -> không cần hiện Settings.")
        return False
    return open_dnd_settings()


def wait_for_dnd(target: bool, timeout: float = 60.0, interval: float = 0.5) -> bool:
    """(Tuỳ chọn) Chờ người dùng gạt công tắc tới trạng thái `target`."""
    end = time.time() + timeout
    while time.time() < end:
        if is_dnd_enabled() == target:
            return True
        time.sleep(interval)
    return False


if __name__ == "__main__":
    print("DND hiện tại:", is_dnd_enabled())
    prompt_enable_dnd()
