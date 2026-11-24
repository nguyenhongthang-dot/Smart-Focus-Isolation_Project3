# api_server.py
import asyncio
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from analyzer import load_config, CONFIG_PATH
from collector import start_listener
from database import get_blocked_count, get_recent_urgent_logs, increment_blocked
from dnd_manager import is_dnd_enabled
from notifier import trigger_alert

collector_task = None
subscribers = set()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/stats")
def get_stats():
    """Chỉ trả số tin chặn + số nguồn đang bật cho 2 pill.
    Giữ tên key cũ (today.blocked / all_time.blocked) để frontend khỏi sửa."""
    sources = load_config().get("sources", {})
    main_sources = ["Zalo", "Messenger", "Gmail", "Discord"]
    active = 4 if not sources else sum(1 for s in main_sources if sources.get(s, True))
    blocked = get_blocked_count()
    return {
        "today": {"blocked": blocked},
        "all_time": {"blocked": blocked},
        "active_sources_count": active,
    }


@app.get("/api/recent-urgent")
def get_logs():
    return get_recent_urgent_logs()


@app.get("/api/config")
def get_config():
    return load_config()


@app.post("/api/config")
def update_config(new_config: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(new_config, f, indent=2, ensure_ascii=False)
    return {"message": "Success"}


@app.post("/api/collector/start")
async def start_collector():
    global collector_task
    if collector_task is None or collector_task.done():
        collector_task = asyncio.create_task(start_listener())
        trigger_alert(
            source="Smart focus isolation",
            sender="SFIT",
            content="Hệ thống đã bắt đầu hoạt động, chúc bạn một phiên tập trung hiệu quả",
            is_urgent=1,
            reason="Khởi động phiên",
        )
        return {"status": "started", "message": "Đã bật Collector"}
    return {"status": "already_running"}


@app.post("/api/collector/stop")
async def stop_collector():
    global collector_task
    if collector_task is not None and not collector_task.done():
        collector_task.cancel()
        try:
            await collector_task
        except asyncio.CancelledError:
            pass
        collector_task = None

        if is_dnd_enabled() is True:
            msg = "Chúc mừng bạn đã hoàn thành phiên tập trung ! Hãy nhấn vào popup để tắt chế độ DND."
            link = "ms-settings:notifications"
        else:
            msg = "Chúc mừng bạn đã hoàn thành phiên tập trung !."
            link = ""

        trigger_alert(
            source="Smart focus isolation",
            sender="SFIT",
            content=msg,
            is_urgent=1,
            reason="Kết thúc phiên",
            deep_link=link,
        )
        return {"status": "stopped", "message": "Đã tắt hoàn toàn Collector và hiện Popup."}

    return {"status": "already_stopped", "message": "Collector đã dừng từ trước."}


@app.post("/api/internal/blocked")
async def notify_blocked():
    increment_blocked()
    for q in list(subscribers):
        q.put_nowait("blocked")
    return {"ok": True}


@app.get("/api/events")
async def events():
    q = asyncio.Queue()
    subscribers.add(q)

    async def gen():
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=25)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            subscribers.discard(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8009, log_level="info", timeout_graceful_shutdown=1)
