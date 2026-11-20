import sqlite3
import pandas as pd
import os
from datetime import datetime


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "focus_guard.db")


def get_connection():
    if not os.path.exists(DB_PATH):
        return None
    return sqlite3.connect(DB_PATH)


def get_overview_stats() -> dict:
    conn = get_connection()
    default_stats = {
        "all_time": {"total": 0, "blocked": 0, "urgent": 0},
        "today": {"total": 0, "blocked": 0, "urgent": 0},
        "yesterday_total": 0,
        "growth_rate": 0.0,
        "saved_minutes": 0,
        "focus_points": 0,
        "focus_points_today": 0
    }
    
    if not conn:
        return default_stats

    try:
        query_all = "SELECT is_urgent, COUNT(*) as count FROM message_logs GROUP BY is_urgent"
        df_all = pd.read_sql_query(query_all, conn)
        
        query_today = """
            SELECT is_urgent, COUNT(*) as count
            FROM message_logs
            WHERE date(received_at) = date('now', 'localtime')
            GROUP BY is_urgent
        """
        df_today = pd.read_sql_query(query_today, conn)
        
        query_yesterday = """
            SELECT COUNT(*) as count
            FROM message_logs
            WHERE date(received_at) = date('now', '-1 day', 'localtime')
        """
        df_yesterday = pd.read_sql_query(query_yesterday, conn)

        # --- ĐÃ XÓA TOÀN BỘ CODE TÍNH THỜI GIAN/ĐIỂM TẬP TRUNG TẠI ĐÂY ---

        stats = default_stats.copy()

        for _, row in df_all.iterrows():
            if row['is_urgent'] == 1:
                stats['all_time']['urgent'] = int(row['count'])
            else:
                stats['all_time']['blocked'] = int(row['count'])
        stats['all_time']['total'] = stats['all_time']['blocked'] + stats['all_time']['urgent']

        for _, row in df_today.iterrows():
            if row['is_urgent'] == 1:
                stats['today']['urgent'] = int(row['count'])
            else:
                stats['today']['blocked'] = int(row['count'])
        stats['today']['total'] = stats['today']['blocked'] + stats['today']['urgent']

        yesterday_count = int(df_yesterday['count'].iloc[0]) if not df_yesterday.empty else 0
        stats['yesterday_total'] = yesterday_count
        if yesterday_count > 0:
            stats['growth_rate'] = round(((stats['today']['total'] - yesterday_count) / yesterday_count) * 100, 1)
        else:
            stats['growth_rate'] = 0.0

        stats['saved_minutes'] = int(stats['today']['blocked'] * 1.5)
        stats['focus_points'] = 0       # Gán cứng bằng 0
        stats['focus_points_today'] = 0 # Gán cứng bằng 0

        return stats
    except Exception as e:
        print(f"[LỖI ANALYTICS OVERVIEW]: {e}")
        return default_stats
    finally:
        conn.close()
        
def get_hourly_distribution() -> list:
    conn = get_connection()
    hourly_template = []
    for i in range(24):
        start_str = f"{i:02d}:00"
        end_str = f"{(i+1)%24:02d}:00"
        label = f"{start_str}\n{end_str}"
        hourly_template.append({
            "hour": label,
            "raw_hour": start_str,
            "blocked_count": 0,
            "urgent_count": 0
        })

    if not conn:
        return hourly_template

    try:
        query = """
            SELECT
                strftime('%H:00', received_at) as hour_key,
                SUM(CASE WHEN is_urgent = 0 THEN 1 ELSE 0 END) as blocked_count,
                SUM(CASE WHEN is_urgent = 1 THEN 1 ELSE 0 END) as urgent_count
            FROM message_logs
            WHERE date(received_at) = date('now', 'localtime')
            GROUP BY hour_key
        """
        df = pd.read_sql_query(query, conn)
        
        data_map = {}
        for _, row in df.iterrows():
            h_key = str(row['hour_key'])
            data_map[h_key] = {
                "blocked_count": int(row['blocked_count']),
                "urgent_count": int(row['urgent_count'])
            }

        result = []
        for item in hourly_template:
            h = item["raw_hour"]
            if h in data_map:
                result.append({
                    "hour": item["hour"],
                    "blocked_count": data_map[h]["blocked_count"],
                    "urgent_count": data_map[h]["urgent_count"]
                })
            else:
                result.append({
                    "hour": item["hour"],
                    "blocked_count": 0,
                    "urgent_count": 0
                })
                
        return result
    except Exception as e:
        print(f"[LỖI ANALYTICS HOURLY]: {e}")
        return hourly_template
    finally:
        conn.close()

def get_recent_urgent_logs(limit: int = 10) -> list:
    conn = get_connection()
    if not conn:
        return []
    try:
        query = """
            SELECT id, source, sender, content, reason,
                   strftime('%H:%M', received_at) as time_str,
                   received_at
            FROM message_logs
            WHERE is_urgent = 1
              AND date(received_at) >= date('now', '-2 days', 'localtime')
            ORDER BY id DESC
            LIMIT ?
        """
        cursor = conn.cursor()
        cursor.execute(query, (limit,))
        rows = cursor.fetchall()
        
        logs = []
        for r in rows:
            logs.append({
                "id": r[0],
                "source": r[1],
                "sender": r[2],
                "content": r[3],
                "reason": r[4],
                "time_str": r[5],
                "received_at": r[6]
            })
        return logs
    except Exception as e:
        print(f"[LỖI GET RECENT URGENT LOGS]: {e}")
        return []
    finally:
        conn.close()