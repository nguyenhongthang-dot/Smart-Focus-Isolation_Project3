
# BAN CAP NHAT

from pycaw.pycaw import AudioUtilities

sessions = AudioUtilities.GetAllSessions()
for session in sessions:
    if session.Process and session.Process.name().lower() == "zalo.exe":
        session.SimpleAudioVolume.SetMute(0, None) # 0 là Unmute
        print("Đã khôi phục âm thanh Zalo!")