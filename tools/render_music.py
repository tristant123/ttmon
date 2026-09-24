"""Render every track to a .wav so it can be listened to outside the game."""
import os, sys, time, wave, array
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import game.music as M
M.pygame = None                      # render to raw arrays, not mixer Sounds

OUT = sys.argv[1] if len(sys.argv) > 1 else "music"
os.makedirs(OUT, exist_ok=True)

total = time.perf_counter()
for name, song in M.SONGS.items():
    t = time.perf_counter()
    buf = M.render(song)
    peak = max(abs(v) for v in buf) / 32767.0
    path = os.path.join(OUT, "%s.wav" % name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(M.RATE)
        w.writeframes(buf.tobytes())
    secs = len(buf) / 2.0 / M.RATE
    print("%-8s %5.1fs loop   peak %.2f   rendered in %4.0f ms"
          % (name, secs, peak, (time.perf_counter() - t) * 1000))
print("total %.1f s -> %s/" % (time.perf_counter() - total, OUT))
