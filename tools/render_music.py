"""Render every track to .wav files so they can be listened to outside the game.

    python tools/render_music.py out/          # all tracks
    python tools/render_music.py out/ battle   # one

Each track is written as <name>.wav: the intro once, then the loop body
twice, so you can hear the loop point.
"""
import os, sys, time, wave
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import numpy as np
import game.music as M
from game.score import SONGS

OUT = sys.argv[1] if len(sys.argv) > 1 else "music"
ONLY = sys.argv[2:] or list(SONGS)
os.makedirs(OUT, exist_ok=True)

total = time.perf_counter()
for name in ONLY:
    t = time.perf_counter()
    intro, body = M.render(SONGS[name])
    parts = ([intro] if intro is not None else []) + [body, body]
    pcm = np.concatenate(parts)
    path = os.path.join(OUT, "%s.wav" % name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(M.RATE)
        w.writeframes(pcm.tobytes())
    ilen = 0 if intro is None else len(intro) / M.RATE
    print("%-8s intro %4.1fs  loop %5.1fs   rendered in %4.1f s"
          % (name, ilen, len(body) / M.RATE, time.perf_counter() - t))
print("total %.1f s -> %s/" % (time.perf_counter() - total, OUT))
