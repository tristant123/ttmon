"""Tiny procedural chiptune sound effects.

Everything is synthesised at start-up from square and noise waves, so the game
still ships as pure source with no audio files. Every call is defensive: a
machine with no sound device simply plays nothing.
"""

import array
import math

try:
    import pygame
except ImportError:      # pragma: no cover
    pygame = None

RATE = 32000
_enabled = False
_sounds = {}
_volume = 0.35


def _square(freq, ms, vol=0.25, duty=0.5, decay=True):
    n = int(RATE * ms / 1000.0)
    buf = array.array("h")
    period = RATE / max(1.0, freq)
    for i in range(n):
        phase = (i % period) / period
        amp = vol * (1.0 - i / float(n)) if decay else vol
        val = amp if phase < duty else -amp
        buf.append(int(max(-1.0, min(1.0, val)) * 32767))
    return buf


def _noise(ms, vol=0.2, decay=True):
    n = int(RATE * ms / 1000.0)
    buf = array.array("h")
    seed = 0x2545F491
    for i in range(n):
        seed ^= (seed << 13) & 0xFFFFFFFF
        seed ^= seed >> 17
        seed ^= (seed << 5) & 0xFFFFFFFF
        amp = vol * (1.0 - i / float(n)) if decay else vol
        val = ((seed & 0xFFFF) / 32768.0 - 1.0) * amp
        buf.append(int(max(-1.0, min(1.0, val)) * 32767))
    return buf


def _sweep(f0, f1, ms, vol=0.25, duty=0.5):
    n = int(RATE * ms / 1000.0)
    buf = array.array("h")
    phase = 0.0
    for i in range(n):
        t = i / float(n)
        freq = f0 + (f1 - f0) * t
        phase += freq / RATE
        amp = vol * (1.0 - t)
        val = amp if (phase % 1.0) < duty else -amp
        buf.append(int(max(-1.0, min(1.0, val)) * 32767))
    return buf


def _join(*bufs):
    out = array.array("h")
    for b in bufs:
        out.extend(b)
    return out


def _stereo(buf):
    out = array.array("h")
    for v in buf:
        out.append(v)
        out.append(v)
    return out


def init():
    """Build the sound bank. Safe to call when there is no audio device."""
    global _enabled
    if pygame is None:
        return
    try:
        pygame.mixer.pre_init(RATE, -16, 2, 512)
        pygame.mixer.init(RATE, -16, 2, 512)
    except pygame.error:
        _enabled = False
        return
    bank = {
        "cursor": _square(660, 40, 0.16, 0.25),
        "confirm": _join(_square(784, 45, 0.18), _square(1047, 70, 0.16)),
        "cancel": _join(_square(392, 50, 0.16), _square(262, 70, 0.14)),
        "hit": _join(_noise(70, 0.22), _square(180, 40, 0.14)),
        "weak": _join(_square(523, 45, 0.22), _square(784, 45, 0.22),
                      _square(1047, 90, 0.2)),
        "crit": _join(_noise(50, 0.26), _square(988, 60, 0.22),
                      _square(1319, 90, 0.2)),
        "null": _join(_square(220, 60, 0.2, 0.125), _square(165, 110, 0.18, 0.125)),
        "repel": _join(_sweep(880, 180, 180, 0.24), _noise(80, 0.2)),
        "magic": _sweep(440, 1200, 180, 0.18, 0.25),
        "heal": _join(_square(659, 60, 0.16), _square(880, 60, 0.16),
                      _square(1175, 110, 0.15)),
        "faint": _sweep(500, 90, 320, 0.2),
        "catch_throw": _sweep(300, 900, 140, 0.18),
        "catch_ok": _join(_square(784, 70, 0.2), _square(988, 70, 0.2),
                          _square(1319, 70, 0.2), _square(1568, 160, 0.2)),
        "catch_no": _join(_square(392, 90, 0.18), _square(294, 140, 0.16)),
        "encounter": _join(_sweep(200, 700, 120, 0.2), _sweep(700, 200, 120, 0.2),
                           _sweep(200, 900, 200, 0.22)),
        "level": _join(_square(523, 70, 0.18), _square(659, 70, 0.18),
                       _square(784, 70, 0.18), _square(1047, 200, 0.2)),
        "victory": _join(_square(523, 90, 0.2), _square(659, 90, 0.2),
                         _square(784, 90, 0.2), _square(1047, 120, 0.2),
                         _square(784, 60, 0.18), _square(1047, 300, 0.2)),
        "defeat": _join(_square(392, 140, 0.18), _square(330, 140, 0.18),
                        _square(262, 400, 0.18)),
        "step": _noise(28, 0.05),
        "warp": _sweep(900, 200, 260, 0.16),
        "turn": _square(880, 35, 0.14, 0.125),
    }
    for key, buf in bank.items():
        try:
            _sounds[key] = pygame.mixer.Sound(buffer=_stereo(buf).tobytes())
            _sounds[key].set_volume(_volume)
        except pygame.error:
            pass
    _enabled = bool(_sounds)


def play(key):
    if not _enabled:
        return
    snd = _sounds.get(key)
    if snd is not None:
        try:
            snd.play()
        except pygame.error:
            pass


def set_volume(v):
    global _volume
    _volume = max(0.0, min(1.0, v))
    for s in _sounds.values():
        s.set_volume(_volume)


def enabled():
    return _enabled
