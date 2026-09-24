"""A tiny tracker, and the game's score.

Everything here is synthesised at load: pulse, triangle and noise channels
with per-note envelopes and vibrato, sequenced from patterns written as text.
No audio files ship with the game.

The writing takes after Toby Fox's soundtracks in three specific ways rather
than in vague spirit:

* **One motif, many moods.** A single seven-note phrase - degrees 1 3 5 4 3 2 1
  of the minor scale - is the spine of nearly every track. The village states
  it warmly in the relative major, the road turns it into a walking bassline,
  the battle plays it at double speed, and the boss plays it flattened and
  slow. Hearing the same tune keep turning up is most of why those scores feel
  like one place.
* **Plain, singable melodies** over a small harmonic vocabulary: i-VI-III-VII
  and its relatives, which is the progression under half of Undertale.
* **Expressive detuning.** Held notes get vibrato and a slight pitch drift, so
  a square wave sounds sung rather than beeped.
"""

import array
import math
import threading

try:
    import pygame
except ImportError:                                   # pragma: no cover
    pygame = None

RATE = 22050
CHANNELS = 2

_SEMITONE = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def note_freq(token):
    """'a4' -> 440.0, 'c#5' -> 554.37. Returns None for a rest."""
    if not token or token in (".", "-"):
        return None
    name = token[0].lower()
    i = 1
    semi = _SEMITONE[name]
    if len(token) > i and token[i] in "#b":
        semi += 1 if token[i] == "#" else -1
        i += 1
    octave = int(token[i:])
    midi = (octave + 1) * 12 + semi
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


# ---------------------------------------------------------------------------
# voices
# ---------------------------------------------------------------------------

def _pulse(buf, start, count, freq, vol, duty, vib, drift, decay):
    period = RATE / freq
    for i in range(count):
        t = i / RATE
        env = vol
        if i < 60:                                     # short attack
            env *= i / 60.0
        env *= math.exp(-decay * t)
        f = freq
        if vib:
            f *= 1.0 + vib * math.sin(t * 34.0) * min(1.0, t * 6.0)
        if drift:
            f *= 1.0 + drift * t
        period = RATE / f
        phase = (i % period) / period
        s = env if phase < duty else -env
        j = start + i
        if j < len(buf):
            buf[j] += s


def _triangle(buf, start, count, freq, vol, decay):
    for i in range(count):
        t = i / RATE
        env = vol * math.exp(-decay * t)
        if i < 120:
            env *= i / 120.0
        period = RATE / freq
        phase = (i % period) / period
        s = (4.0 * abs(phase - 0.5) - 1.0) * env
        j = start + i
        if j < len(buf):
            buf[j] += s


_NOISE_SEED = 0x1234567


def _noise(buf, start, count, vol, decay, tone=0):
    global _NOISE_SEED
    seed = _NOISE_SEED
    hold = 0.0
    step = max(1, int(RATE / (1800 + tone * 5200)))
    for i in range(count):
        if i % step == 0:
            seed ^= (seed << 13) & 0xFFFFFFFF
            seed ^= seed >> 17
            seed ^= (seed << 5) & 0xFFFFFFFF
            hold = (seed & 0xFFFF) / 32768.0 - 1.0
        env = vol * math.exp(-decay * (i / RATE))
        j = start + i
        if j < len(buf):
            buf[j] += hold * env
    _NOISE_SEED = seed


# ---------------------------------------------------------------------------
# sequencing
# ---------------------------------------------------------------------------

DRUMS = {"k": (0.9, 26.0, 0), "s": (0.55, 30.0, 3), "h": (0.22, 70.0, 6)}


def _render_channel(buf, spec, step_samples):
    pattern = spec["pattern"].split()
    vol = spec.get("vol", 0.2)
    wave = spec.get("wave", "pulse")
    duty = spec.get("duty", 0.5)
    vib = spec.get("vib", 0.0)
    drift = spec.get("drift", 0.0)
    decay = spec.get("decay", 1.4)
    legato = spec.get("legato", 0.92)

    i = 0
    while i < len(pattern):
        token = pattern[i]
        if token == ".":
            i += 1
            continue
        length = 1
        while i + length < len(pattern) and pattern[i + length] == "-":
            length += 1
        start = int(i * step_samples)
        count = int(step_samples * length * legato)
        if wave == "noise":
            hit = DRUMS.get(token)
            if hit:
                v, dk, tone = hit
                _noise(buf, start, min(count, int(step_samples * 1.4)),
                       v * vol, dk, tone)
        else:
            f = note_freq(token)
            if f:
                if wave == "triangle":
                    _triangle(buf, start, count, f, vol, decay)
                else:
                    _pulse(buf, start, count, f, vol, duty, vib, drift, decay)
        i += length


def render(song):
    """Turn a song dict into a stereo pygame Sound."""
    bpm = song.get("bpm", 110)
    per_beat = song.get("steps_per_beat", 4)
    step_samples = RATE * 60.0 / (bpm * per_beat)
    steps = max(len(c["pattern"].split()) for c in song["channels"])
    total = int(step_samples * steps) + RATE // 4

    mix = [0.0] * total
    for spec in song["channels"]:
        _render_channel(mix, spec, step_samples)

    peak = max(1e-6, max(abs(v) for v in mix))
    gain = min(1.0, 0.86 / peak)
    out = array.array("h")
    for v in mix:
        s = int(max(-1.0, min(1.0, v * gain)) * 32767)
        out.append(s)
        out.append(s)
    if pygame is None:
        return out
    return pygame.mixer.Sound(buffer=out.tobytes())


# ---------------------------------------------------------------------------
# the score
#
# Patterns are 16 steps to the bar. "." is a rest, "-" holds the note before
# it. The motif is degrees 1 3 5 4 3 2 1 - in A minor that is a c e d c b a.
# ---------------------------------------------------------------------------

def bars(*rows):
    return " ".join(" ".join(r.split()) for r in rows)


SONGS = {

    # Slow statement of the motif over open fifths. Am - F - C - E.
    "title": {
        "bpm": 76, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.20, "vib": 0.010,
             "decay": 0.55, "pattern": bars(
                 "a4 -  -  -  -  -  c5 -  -  -  e5 -  -  -  -  -",
                 "d5 -  -  -  -  -  c5 -  -  -  b4 -  -  -  -  -",
                 "a4 -  -  -  -  -  g4 -  -  -  e4 -  -  -  -  -",
                 "a4 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
            {"wave": "pulse", "duty": 0.25, "vol": 0.09, "decay": 0.5,
             "pattern": bars(
                 "c5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "a4 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "g4 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "b4 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
            {"wave": "triangle", "vol": 0.26, "decay": 0.35,
             "pattern": bars(
                 "a2 -  -  -  -  -  -  -  e3 -  -  -  -  -  -  -",
                 "f2 -  -  -  -  -  -  -  c3 -  -  -  -  -  -  -",
                 "c3 -  -  -  -  -  -  -  g2 -  -  -  -  -  -  -",
                 "e2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
        ]},

    # The motif warmed into the relative major and given a bounce. C-Am-F-G.
    "village": {
        "bpm": 112, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.19, "vib": 0.008,
             "decay": 1.1, "pattern": bars(
                 "e5 -  -  .  g5 -  -  .  a5 -  -  -  -  -  -  .",
                 "g5 -  -  .  e5 -  -  .  d5 -  -  -  -  -  -  .",
                 "f5 -  -  .  a5 -  -  .  g5 -  -  -  -  -  -  .",
                 "e5 -  -  .  d5 -  -  .  c5 -  -  -  -  -  -  .")},
            {"wave": "pulse", "duty": 0.125, "vol": 0.07, "decay": 2.2,
             "pattern": bars(
                 "g4 .  .  .  e4 .  .  .  g4 .  .  .  e4 .  .  .",
                 "e4 .  .  .  c4 .  .  .  e4 .  .  .  c4 .  .  .",
                 "a4 .  .  .  f4 .  .  .  a4 .  .  .  f4 .  .  .",
                 "b4 .  .  .  g4 .  .  .  b4 .  .  .  d5 .  .  .")},
            {"wave": "triangle", "vol": 0.30, "decay": 2.4,
             "pattern": bars(
                 "c3 .  g2 .  c3 .  g2 .  c3 .  g2 .  c3 .  g2 .",
                 "a2 .  e2 .  a2 .  e2 .  a2 .  e2 .  a2 .  e2 .",
                 "f2 .  c3 .  f2 .  c3 .  f2 .  c3 .  f2 .  c3 .",
                 "g2 .  d3 .  g2 .  d3 .  g2 .  d3 .  g2 .  d3 .")},
            {"wave": "noise", "vol": 0.30, "pattern": bars(
                 "k  .  .  h  s  .  .  .  k  .  .  h  s  .  .  h",
                 "k  .  .  h  s  .  .  .  k  .  .  h  s  .  .  h",
                 "k  .  .  h  s  .  .  .  k  .  .  h  s  .  .  h",
                 "k  .  .  h  s  .  .  .  k  .  h  .  s  .  s  h")},
        ]},

    # The motif as a travelling tune. Am - Am - F - G.
    "route": {
        "bpm": 128, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.19, "vib": 0.007,
             "decay": 1.2, "pattern": bars(
                 "a4 .  c5 .  e5 -  -  .  d5 .  c5 .  b4 -  -  .",
                 "a4 .  b4 .  c5 -  -  .  e5 .  d5 .  c5 -  -  .",
                 "f4 .  a4 .  c5 -  -  .  d5 .  c5 .  a4 -  -  .",
                 "g4 .  b4 .  d5 -  -  .  g5 -  -  -  -  -  -  .")},
            {"wave": "pulse", "duty": 0.25, "vol": 0.06, "decay": 3.0,
             "pattern": bars(
                 "e4 .  .  .  a4 .  .  .  e4 .  .  .  a4 .  .  .",
                 "e4 .  .  .  a4 .  .  .  e4 .  .  .  a4 .  .  .",
                 "c4 .  .  .  f4 .  .  .  c4 .  .  .  f4 .  .  .",
                 "d4 .  .  .  g4 .  .  .  d4 .  .  .  b4 .  .  .")},
            {"wave": "triangle", "vol": 0.30, "decay": 3.2,
             "pattern": bars(
                 "a2 .  a2 .  a2 .  a2 .  a2 .  a2 .  e3 .  e3 .",
                 "a2 .  a2 .  a2 .  a2 .  c3 .  c3 .  e3 .  e3 .",
                 "f2 .  f2 .  f2 .  f2 .  f2 .  f2 .  c3 .  c3 .",
                 "g2 .  g2 .  g2 .  g2 .  g2 .  b2 .  d3 .  d3 .")},
            {"wave": "noise", "vol": 0.26, "pattern": bars(
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  .",
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h",
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  .",
                 "k  .  h  .  s  .  h  .  k  .  s  .  s  h  s  h")},
        ]},

    # Dorian, sparse, with the motif answering itself an octave down.
    "ruins": {
        "bpm": 96, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.25, "vol": 0.17, "vib": 0.012,
             "decay": 0.7, "pattern": bars(
                 "a4 -  -  -  c5 -  -  -  e5 -  -  -  -  -  -  -",
                 ".  .  .  .  a3 -  -  -  c4 -  -  -  e4 -  -  -",
                 "f#4 - -  -  d5 -  -  -  c5 -  -  -  -  -  -  -",
                 ".  .  .  .  b4 -  -  -  a4 -  -  -  -  -  -  -")},
            {"wave": "triangle", "vol": 0.24, "decay": 0.5,
             "pattern": bars(
                 "a2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "a2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "d3 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "e2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
            {"wave": "noise", "vol": 0.14, "pattern": bars(
                 ".  .  .  .  .  .  .  .  h  .  .  .  .  .  .  .",
                 ".  .  .  .  .  .  .  .  h  .  .  .  .  .  .  .",
                 ".  .  .  .  .  .  .  .  h  .  .  .  .  .  .  .",
                 ".  .  .  .  h  .  .  .  h  .  .  .  h  .  .  .")},
        ]},

    # Cold and slow. The motif never resolves - it stops on the fifth.
    "shrine": {
        "bpm": 66, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.125, "vol": 0.15, "vib": 0.016,
             "decay": 0.45, "pattern": bars(
                 "a4 -  -  -  -  -  -  -  c5 -  -  -  -  -  -  -",
                 "e5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "d5 -  -  -  -  -  -  -  b4 -  -  -  -  -  -  -",
                 "e5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
            {"wave": "triangle", "vol": 0.22, "decay": 0.3,
             "pattern": bars(
                 "a2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "f2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "g2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -",
                 "e2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  -")},
        ]},

    # The motif at double speed, which is the whole trick.
    "battle": {
        "bpm": 154, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.20, "vib": 0.006,
             "decay": 2.0, "pattern": bars(
                 "a4 c5 e5 d5 c5 b4 a4 .  a4 c5 e5 g5 f5 e5 d5 .",
                 "c5 e5 a5 g5 e5 d5 c5 .  b4 d5 g5 f5 d5 c5 b4 .",
                 "a4 c5 e5 d5 c5 b4 a4 .  f4 a4 c5 e5 d5 c5 a4 .",
                 "g4 b4 d5 f5 e5 d5 b4 .  e5 -  -  -  -  -  -  .")},
            {"wave": "pulse", "duty": 0.125, "vol": 0.07, "decay": 3.4,
             "pattern": bars(
                 "e4 .  e4 .  e4 .  e4 .  e4 .  e4 .  e4 .  e4 .",
                 "e4 .  e4 .  e4 .  e4 .  d4 .  d4 .  d4 .  d4 .",
                 "c4 .  c4 .  c4 .  c4 .  c4 .  c4 .  c4 .  c4 .",
                 "d4 .  d4 .  d4 .  d4 .  b3 .  b3 .  b3 .  b3 .")},
            {"wave": "triangle", "vol": 0.32, "decay": 4.0,
             "pattern": bars(
                 "a2 a2 .  a2 a2 .  a2 .  a2 a2 .  a2 a2 .  a2 .",
                 "a2 a2 .  a2 a2 .  a2 .  g2 g2 .  g2 g2 .  g2 .",
                 "f2 f2 .  f2 f2 .  f2 .  f2 f2 .  f2 f2 .  f2 .",
                 "g2 g2 .  g2 g2 .  g2 .  e2 e2 .  e2 e2 .  e2 .")},
            {"wave": "noise", "vol": 0.30, "pattern": bars(
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h",
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h",
                 "k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  h",
                 "k  .  h  .  s  .  h  .  k  s  k  s  s  h  s  h")},
        ]},

    # The same motif flattened: the third drops, the fifth becomes a tritone.
    "boss": {
        "bpm": 132, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.20, "vib": 0.020,
             "drift": -0.004, "decay": 1.0, "pattern": bars(
                 "a4 -  c5 -  d#5 - -  -  d5 -  c5 -  a4 -  -  -",
                 "g#4 - c5 -  d#5 - -  -  d5 -  c5 -  g#4 - -  -",
                 "f4 -  a4 -  c5 -  -  -  d#5 - d5 -  c5 -  -  -",
                 "e5 -  -  -  d#5 - -  -  d5 -  -  -  a4 -  -  -")},
            {"wave": "pulse", "duty": 0.25, "vol": 0.08, "decay": 1.6,
             "pattern": bars(
                 "d#4 - -  -  -  -  -  -  a3 -  -  -  -  -  -  -",
                 "d4 -  -  -  -  -  -  -  g#3 - -  -  -  -  -  -",
                 "c4 -  -  -  -  -  -  -  f#3 - -  -  -  -  -  -",
                 "b3 -  -  -  -  -  -  -  e4 -  -  -  -  -  -  -")},
            {"wave": "triangle", "vol": 0.34, "decay": 2.6,
             "pattern": bars(
                 "a2 .  a2 .  a2 a2 .  a2 d#2 . d#2 . d#2 . .  .",
                 "g#2 . g#2 . g#2 g#2 . g#2 d2 . d2 .  d2 .  .  .",
                 "f2 .  f2 .  f2 f2 .  f2 c2 .  c2 .  c2 .  .  .",
                 "e2 .  e2 .  e2 e2 .  e2 e2 .  e2 .  e2 e2 e2 .")},
            {"wave": "noise", "vol": 0.32, "pattern": bars(
                 "k  .  .  k  s  .  .  .  k  .  .  k  s  .  s  .",
                 "k  .  .  k  s  .  .  .  k  .  .  k  s  .  s  .",
                 "k  .  .  k  s  .  .  .  k  .  .  k  s  .  s  .",
                 "k  k  .  k  s  .  s  .  k  k  .  k  s  s  s  s")},
        ]},

    # Two bars, and it resolves where nothing else does.
    "victory": {
        "bpm": 132, "steps_per_beat": 4,
        "channels": [
            {"wave": "pulse", "duty": 0.5, "vol": 0.22, "decay": 1.6,
             "pattern": bars(
                 "a4 .  c5 .  e5 .  a5 -  -  .  g5 .  a5 -  -  -",
                 "e5 .  a5 .  c6 -  -  -  -  -  -  -  -  -  -  -")},
            {"wave": "triangle", "vol": 0.30, "decay": 2.0,
             "pattern": bars(
                 "a2 .  .  .  e3 .  .  .  f2 .  .  .  g2 .  .  .",
                 "a2 .  .  .  e3 .  .  .  a3 -  -  -  -  -  -  -")},
        ]},
}

LOOPING = {k: k != "victory" for k in SONGS}


# ---------------------------------------------------------------------------
# playback
# ---------------------------------------------------------------------------

_tracks = {}
_current = None
_pending = None
_channel = None
_volume = 0.55
_ready = threading.Event()
_enabled = False


def init(threaded=True):
    """Synthesise the score. Threaded by default so start-up is not blocked."""
    global _enabled, _channel
    if pygame is None or not pygame.mixer.get_init():
        return
    _enabled = True
    try:
        pygame.mixer.set_reserved(1)
        _channel = pygame.mixer.Channel(0)
    except pygame.error:
        _enabled = False
        return
    if threaded:
        threading.Thread(target=_build, daemon=True).start()
    else:
        _build()


def _build():
    for name, song in SONGS.items():
        try:
            _tracks[name] = render(song)
        except Exception:
            pass
    _ready.set()
    if _pending:
        play(_pending)


def play(name, restart=False):
    """Start a track, or remember it if the score is still rendering."""
    global _current, _pending
    if not _enabled:
        return
    if name == _current and not restart:
        return
    _pending = name
    if not _ready.is_set():
        return
    snd = _tracks.get(name)
    if snd is None:
        return
    _current = name
    snd.set_volume(_volume)
    try:
        _channel.play(snd, loops=-1 if LOOPING.get(name, True) else 0,
                      fade_ms=420)
    except pygame.error:
        pass


def stop(fade_ms=400):
    global _current, _pending
    _current = None
    _pending = None
    if _enabled and _channel:
        _channel.fadeout(fade_ms)


def set_volume(v):
    global _volume
    _volume = max(0.0, min(1.0, v))
    if _enabled and _channel:
        _channel.set_volume(_volume)


def enabled():
    return _enabled
