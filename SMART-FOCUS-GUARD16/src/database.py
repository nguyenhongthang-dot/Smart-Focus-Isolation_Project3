"""SQLite chỉ để lưu TIN KHẨN CẤP (popup) trong 2 ngày gần nhất.
Tin cũ hơn 2 ngày tự bị xóa. Lịch sử 5 tin cho AI chỉ nằm trong RAM.
Số tin bị chặn chỉ là MỘT CON SỐ lưu trong bảng counters (không lưu nội dung tin),
nên tắt/bật app vẫn giữ nguyên và cộng dồn tiếp.
Giữ nguyên tên save_message / get_recent_history nên analyzer.py, notifier.py không cần sửa.
"""
import os
import sqlite3
import threading
import urllib.request
from collections import deque
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "focus_guard.db")
KEEP_DAYS = 2

_lock = threading.Lock()
_history = {}          # RAM: 5 tin gần nhất của mỗi người gửi, làm ngữ cảnh cho AI


def get_connection():
    """Mở DB và TỰ TẠO LẠI bảng nếu thiếu (kể cả khi file .db bị xóa lúc backend đang chạy)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS urgent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            reason TEXT,
            received_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS counters (
            name TEXT PRIMARY KEY,
            value INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("INSERT OR IGNORE INTO counters (name, value) VALUES ('blocked', 0)")
    conn.commit()
    return conn


def purge_old():
    """Xóa tin khẩn cấp quá KEEP_DAYS ngày."""
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM urgent_logs WHERE received_at < datetime('now', ?, 'localtime')",
            (f"-{KEEP_DAYS} days",),
        )
        conn.commit()


def init_db():
    purge_old()   # get_connection đã tự tạo bảng; ở đây chỉ dọn tin cũ mỗi lần mở app


init_db()


def _shift(name: str) -> str:
    """Giống encrypt_sender_name ở analyzer.py, để lịch sử khớp với tên mã hóa analyzer tra."""
    return "".join(c if c.isspace() else chr(ord(c) + 1) for c in name)


def _notify_blocked():
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8009/api/internal/blocked", data=b"", method="POST"
        )
        urllib.request.urlopen(req, timeout=1).read()
    except Exception:
        pass


def save_message(source: str, sender: str, content: str, is_urgent: int,
                 reason: str = "", session_id: int = None):  # session_id giữ cho tương thích
    if sender == "SFIT" and source == "Smart focus isolation":
        return

    with _lock:
        _history.setdefault(_shift(sender), deque(maxlen=5)).append(content)

    if is_urgent:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO urgent_logs (source, sender, content, reason) VALUES (?, ?, ?, ?)",
                (source, sender, content, reason),
            )
            conn.commit()
        purge_old()
    else:
        threading.Thread(target=_notify_blocked, daemon=True).start()

    print(f"[Saved] {source} | Từ: {sender} | Gấp: {is_urgent}")


def increment_blocked() -> int:
    """Cộng 1 vào số tin chặn, trả về giá trị mới."""
    with get_connection() as conn:
        conn.execute("UPDATE counters SET value = value + 1 WHERE name = 'blocked'")
        conn.commit()
        return conn.execute("SELECT value FROM counters WHERE name = 'blocked'").fetchone()[0]


def get_blocked_count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT value FROM counters WHERE name = 'blocked'").fetchone()[0]


def get_recent_history(sender: str, limit: int = 5) -> str:
    with _lock:
        msgs = list(_history.get(sender, []))[-limit:]
    if not msgs:
        return "Không có lịch sử trò chuyện trước đó."
    return "\n".join(f"- {m}" for m in msgs)


def get_recent_urgent_logs(limit: int = 10) -> list:
    purge_old()
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT id, source, sender, content, reason,
                      strftime('%H:%M', received_at), received_at
               FROM urgent_logs ORDER BY id DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    return [
        {"id": r[0], "source": r[1], "sender": r[2], "content": r[3],
         "reason": r[4], "time_str": r[5], "received_at": r[6]}
        for r in rows
    ]
