"""The synthesiser, the sequencer, and playback. The score is in score.py.

Everything is synthesised at load from Python source; no audio files ship
with the game. Tracks are rendered once, on a background thread, into an
intro that plays once and a loop body that repeats seamlessly.

The synth is built for the sound of the GBA Pokemon games and Undertale
rather than for raw NES beeps:

* **Band-limited oscillators.** Pulse, saw and triangle waves are read from
  wavetables with harmonics cut at the Nyquist limit, so a square lead is
  bright without the fizz of aliasing that made the first score harsh.
* **Real instruments.** Alongside the chip voices there is a piano (decaying
  partials, higher ones dying first), a celesta and a music box (FM), a
  breathy flute, detuned strings, a swelling brass, a harp, a reed with slow
  vibrato, and a drum kit built from pitched sine sweeps and shaped noise.
* **Space.** Voices are panned across the stereo field and sent to a
  convolution reverb, which is most of the difference between a tune that
  sits in a room and one that sits in a speaker.
* **Composition in the open.** Melodies are written note by note in a small
  text notation; bass lines, arpeggios, pads and drums are generated from the
  chord symbols of each section, the way a band reads a lead sheet.
"""

import math
import re
import threading

try:
    import numpy as np
except ImportError:                                   # pragma: no cover
    np = None

try:
    import pygame
except ImportError:                                   # pragma: no cover
    pygame = None

from .sfx import RATE

# ---------------------------------------------------------------------------
# pitch
# ---------------------------------------------------------------------------

_LETTER = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def midi_of(name):
    """'a4' -> 69, 'c#5' -> 73, 'bb3' -> 58."""
    m = re.fullmatch(r"([a-g])([#b]?)(-?\d)", name)
    if not m:
        raise ValueError("bad pitch %r" % name)
    semi = _LETTER[m.group(1)] + {"#": 1, "b": -1, "": 0}[m.group(2)]
    return (int(m.group(3)) + 1) * 12 + semi


def hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


# ---------------------------------------------------------------------------
# chords
# ---------------------------------------------------------------------------

QUALITIES = {
    "": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "m7": (0, 3, 7, 10),
    "maj7": (0, 4, 7, 11), "dim": (0, 3, 6), "dim7": (0, 3, 6, 9),
    "aug": (0, 4, 8), "sus4": (0, 5, 7), "sus2": (0, 2, 7),
    "add9": (0, 4, 7, 14), "m9": (0, 3, 7, 10, 14), "5": (0, 7),
    "6": (0, 4, 7, 9), "m6": (0, 3, 7, 9),
}


class Chord:
    def __init__(self, symbol):
        m = re.fullmatch(r"([A-G])([#b]?)([a-z0-9]*)(?:/([A-G])([#b]?))?", symbol)
        if not m or m.group(3) not in QUALITIES:
            raise ValueError("bad chord %r" % symbol)
        acc = {"#": 1, "b": -1, "": 0}
        self.root = (_LETTER[m.group(1).lower()] + acc[m.group(2)]) % 12
        self.intervals = QUALITIES[m.group(3)]
        self.bass = self.root
        if m.group(4):
            self.bass = (_LETTER[m.group(4).lower()] + acc[m.group(5)]) % 12
        self.symbol = symbol

    def tones(self, octave, count=8):
        """Chord tones rising from the root in `octave`, extended upward."""
        base = (octave + 1) * 12 + self.root
        out = []
        k = 0
        while len(out) < count:
            for iv in self.intervals:
                if iv >= 12:
                    iv -= 12
                out.append(base + iv + 12 * k)
            k += 1
        return sorted(set(out))[:count]

    def bass_note(self, octave):
        return (octave + 1) * 12 + self.bass


def parse_chords(text, beats):
    """'C | Am | Dm G | C' -> [(start_beat, length, Chord)]."""
    out = []
    t = 0.0
    for bar in text.split("|"):
        names = bar.replace(",", " ").split()
        if not names:
            continue
        slot = beats / len(names)
        for n in names:
            out.append((t, slot, Chord(n)))
            t += slot
    return out


# ---------------------------------------------------------------------------
# the note notation
#
#   e5/8      E in octave 5, an eighth note. Lengths are note values:
#   g4/4.     1 whole, 2 half, 4 quarter, 8, 16, 32; 3, 6, 12 for triplets;
#   a4/2+8    a dot adds half again, and +N ties more on.
#   c5        no length: the previous one is reused.
#   r/4       a rest.
#   (c4 e4 g4)/8   a chord, struck together.
#   v0.6      velocity for the notes that follow, 0..1.
#   |         a bar line. It is checked: a bar that does not add up is an
#             error at load, not a wrong note found by ear.
#   [ ... ]x2 a repeat.
# ---------------------------------------------------------------------------

_TOKEN = re.compile(r"\[|\]x\d+|\||v[\d.]+|\([^)]*\)(?:/\d+\.?(?:\+\d+\.?)*)?|"
                    r"(?:[a-g][#b]?-?\d|r)(?:/\d+\.?(?:\+\d+\.?)*)?")


def _length(spec):
    """'/4.+16' -> beats (quarter note = 1)."""
    total = 0.0
    for part in re.findall(r"(\d+)(\.?)", spec):
        n, dot = int(part[0]), part[1]
        b = 4.0 / n
        total += b * (1.5 if dot else 1.0)
    return total


def _expand(tokens):
    out, stack = [], [[]]
    for tok in tokens:
        if tok == "[":
            stack.append([])
        elif tok.startswith("]x"):
            body = stack.pop()
            stack[-1].extend(body * int(tok[2:]))
        else:
            stack[-1].append(tok)
    return stack[0]


def parse_notes(text, beats_per_bar=4, where=""):
    """Notation -> [(beat, length, [midi...], velocity)]."""
    raw = _TOKEN.findall(text)
    rest = _TOKEN.sub("", text).split()
    if rest:
        raise ValueError("%s: can't read %r" % (where, rest[:4]))
    events = []
    t = 0.0
    length = 1.0
    vel = 0.8
    bar_start = 0.0
    bar_no = 1
    for tok in _expand(raw):
        if tok == "|":
            if abs((t - bar_start) - beats_per_bar) > 1e-6:
                raise ValueError("%s: bar %d has %.3f beats, not %d"
                                 % (where, bar_no, t - bar_start, beats_per_bar))
            bar_start = t
            bar_no += 1
            continue
        if tok.startswith("v"):
            vel = float(tok[1:])
            continue
        if "/" in tok:
            body, spec = tok.split("/", 1)
            length = _length(spec)
        else:
            body = tok
        if body.startswith("("):
            pitches = [midi_of(p) for p in body[1:-1].split()]
        elif body == "r":
            pitches = []
        else:
            pitches = [midi_of(body)]
        if pitches:
            events.append((t, length, pitches, vel))
        t += length
    return events, t


def shift_in_scale(events, steps, tonic, mode="major"):
    """Move a line up or down the scale: steps=-2 is a third below, the
    parallel harmony a second pulse channel plays in so many GBA scores."""
    shapes = {"major": (0, 2, 4, 5, 7, 9, 11), "minor": (0, 2, 3, 5, 7, 8, 10),
              "harmonic": (0, 2, 3, 5, 7, 8, 11), "dorian": (0, 2, 3, 5, 7, 9, 10),
              "phrygdom": (0, 1, 4, 5, 7, 8, 10)}
    shape = shapes[mode]
    t0 = _LETTER[tonic[0].lower()] + {"#": 1, "b": -1}.get(tonic[1:2], 0)
    scale = [p for p in range(0, 128) if (p - t0) % 12 in shape]

    def move(p):
        # nearest scale degree at or below, then walk
        i = max(j for j, s in enumerate(scale) if s <= p)
        chrom = p - scale[i]
        j = min(len(scale) - 1, max(0, i + steps))
        return scale[j] + chrom

    return [(t, d, [move(p) for p in ps], v) for t, d, ps, v in events]


def harmonize(events, chords, tonic, mode="major"):
    """A second line under the tune: the nearest chord tone a third or a
    fourth below each note, so the pair always agrees with the harmony. Only
    where there is none does it fall back to a third down the scale."""
    passing = shift_in_scale(events, -2, tonic, mode)
    out = []
    for (t, d, ps, v), (_, _, qs, _) in zip(events, passing):
        ch, _, _ = _chord_at(chords, t)
        pcs = {(ch.root + iv) % 12 for iv in ch.intervals}
        line = []
        for p, q in zip(ps, qs):
            below = [c for c in range(p - 5, p - 2) if c % 12 in pcs]
            line.append(max(below) if below else q)
        out.append((t, d, line, v))
    return out


# ---------------------------------------------------------------------------
# accompaniment from chord symbols
# ---------------------------------------------------------------------------

def _chord_at(chords, t):
    for start, length, ch in chords:
        if start <= t + 1e-6 < start + length:
            return ch, start, length
    return chords[-1][2], chords[-1][0], chords[-1][1]


def accompany(style, chords, total, beats, octave=3, vel=0.7):
    """Generate a part from a lead sheet. Styles are the handful of figures
    a GBA-era town, route or battle theme is actually built from."""
    ev = []

    def each(step):
        t = 0.0
        while t < total - 1e-6:
            yield t
            t += step

    if style == "pad":
        for start, length, ch in chords:
            ev.append((start, length, ch.tones(octave, 4), vel))
    elif style == "pad3":
        for start, length, ch in chords:
            ev.append((start, length, ch.tones(octave, 3), vel))
    elif style == "stab":                       # off-beat chords, town style
        for t in each(1.0):
            ch, _, _ = _chord_at(chords, t)
            ev.append((t + 0.5, 0.35, ch.tones(octave, 3), vel))
    elif style == "stab16":                      # a battle's pushing chords
        for t in each(0.5):
            ch, _, _ = _chord_at(chords, t)
            ev.append((t, 0.22, ch.tones(octave, 3), vel * (1.0 if t % 1 == 0 else 0.7)))
    elif style in ("arp16", "arp16ud", "arp8", "broken", "harp3", "arp12"):
        figs = {"arp16": ((0, 1, 2, 3), 0.25), "arp16ud": ((0, 1, 2, 3, 4, 3, 2, 1), 0.25),
                "arp8": ((0, 2, 3, 2), 0.5), "broken": ((0, 2, 3, 4, 2, 3, 4, 2), 0.5),
                "harp3": ((0, 2, 3, 4, 3, 2), 0.5), "arp12": ((0, 1, 2, 3, 2, 1), 1 / 3.0)}
        fig, step = figs[style]
        i = 0
        prev = None
        for t in each(step):
            ch, start, _ = _chord_at(chords, t)
            if ch is not prev:
                i = 0
                prev = ch
            tones = ch.tones(octave, 6)
            p = tones[fig[i % len(fig)] % len(tones)]
            accent = 1.0 if abs(t - round(t)) < 1e-6 else 0.78
            ev.append((t, step * (2.2 if style in ("broken", "harp3") else 0.9),
                       [p], vel * accent))
            i += 1
    elif style in ("root4", "root8", "pump", "rootfifth", "walk", "half",
                   "drone", "gallop", "waltz"):
        for start, length, ch in chords:
            root = ch.bass_note(octave)
            fifth = root + 7 if root + 7 < (octave + 2) * 12 + 2 else root - 5
            nxt, _, _ = _chord_at(chords, start + length)
            nroot = nxt.bass_note(octave)
            if style == "drone":
                ev.append((start, length, [root, root + 7], vel * 0.6))
                continue
            if style == "half":
                t = start
                k = 0
                while t < start + length - 1e-6:
                    d = min(2.0, start + length - t)
                    ev.append((t, d * 0.95, [root if k % 2 == 0 else fifth], vel))
                    t += 2.0
                    k += 1
                continue
            if style == "waltz":
                ev.append((start, length * 0.95, [root], vel))
                continue
            step = {"root4": 1.0, "rootfifth": 1.0, "walk": 1.0, "root8": 0.5,
                    "pump": 0.5, "gallop": 1.0}[style]
            n = int(round(length / step))
            for k in range(n):
                t = start + k * step
                if style in ("root4", "root8"):
                    ev.append((t, step * 0.85, [root], vel))
                elif style == "pump":
                    ev.append((t, step * 0.8, [root + (12 if k % 2 else 0)],
                               vel * (1.0 if k % 2 == 0 else 0.8)))
                elif style == "rootfifth":
                    ev.append((t, step * 0.9, [root if k % 2 == 0 else fifth], vel))
                elif style == "gallop":
                    ev.append((t, 0.45, [root], vel))
                    ev.append((t + 0.5, 0.22, [root], vel * 0.8))
                    ev.append((t + 0.75, 0.22, [root + 12], vel * 0.8))
                elif style == "walk":
                    third = root + (ch.intervals[1] if len(ch.intervals) > 1 else 7)
                    line = [root, third, root + 7]
                    if k == n - 1 and n > 1:
                        # approach the next chord from a semitone away
                        target = nroot
                        while target - root > 7:
                            target -= 12
                        while root - target > 7:
                            target += 12
                        p = target + (1 if target < root else -1)
                    else:
                        p = line[k % 3]
                    ev.append((t, step * 0.9, [p], vel))
    else:
        raise ValueError("unknown style %r" % style)
    return ev


# Drum patterns: one string per bar, one character per sixteenth (twelve in
# a bar of three). k kick, s snare, g ghost snare, h hat, o open hat,
# c crash, t high tom, l low tom, d frame drum, x rim tick, . nothing.
DRUMS = {
    "none": [""],
    "town": ["k...h.x.k.k.h.x.", "k...h.x.k...h.xh"],
    "march": ["k.h.s.h.k.hks.h.", "k.h.s.h.k.h.s.hs"],
    "route": ["k.h.s.hkk.h.s.h.", "k.h.s.hkk.hks.hg"],
    "battle": ["k.hks.hkk.hks.hk", "k.hks.hkk.hksgss"],
    "half": ["k.......s.......", "k.....k.s......."],
    "boss": ["k.kks.hkk.kks.hk", "k.kks.hkk.kksgsg"],
    "breakdown": ["l.......t.l.....", "l.....l.t...t.t."],
    "frame": ["d.....x.d.x.....", "d.....x.d.x.x.x."],
    "frame3": ["d...x.x.x...", "d...x...x.x."],
    "harp3": ["", ""],
    "waltz": ["k...x...x...", "k...x...x.x."],
    "soft": ["....x.......x...", "....x.......x.x."],
    "fill": ["k.s.s.s.ssssssss"],
    "fill_battle": ["k.ss.ss.tttllllc"],
    "fill3": ["k.s.s.ssssss"],
    "roll": ["ssssssssssssssss"],
    "fanfare": ["c...............", "s.s.s.s.ssssssss"],
}


def drum_events(name, bars, beats, fill=None, crash=True):
    pat = DRUMS[name]
    steps = beats * 4
    ev = []
    for b in range(bars):
        row = pat[b % len(pat)]
        if fill and b == bars - 1:
            row = DRUMS[fill][0]
        if crash and b == 0 and name not in ("none", "harp3"):
            row = "c" + row[1:] if row else "c"
        for i, ch in enumerate(row[:steps]):
            if ch != ".":
                ev.append((b * beats + i * 0.25, ch))
    return ev


# ---------------------------------------------------------------------------
# instruments
# ---------------------------------------------------------------------------

_TABLE_N = 2048
_tables = {}
_HARM_STEPS = (1, 2, 3, 4, 6, 8, 11, 16, 23, 32, 45, 64, 90, 128, 181, 256, 362, 511)


def _table(shape, harmonics):
    key = (shape, harmonics)
    tbl = _tables.get(key)
    if tbl is None:
        x = np.arange(_TABLE_N) / _TABLE_N
        if shape.startswith("pulse"):
            duty = {"pulse50": 0.5, "pulse25": 0.25, "pulse12": 0.125}[shape]
            raw = np.where(x < duty, 1.0, -1.0)
        elif shape == "saw":
            raw = 1.0 - 2.0 * x
        elif shape == "tri":
            raw = 1.0 - 4.0 * np.abs(x - 0.5)
        elif shape == "wave":
            # a Game Boy wave-channel shape: a lopsided sine in 16 levels
            s = np.sin(2 * np.pi * x) + 0.45 * np.sin(4 * np.pi * x + 0.6)
            raw = np.round(s * 7.5) / 7.5
        else:
            raw = np.sin(2 * np.pi * x)
        spec = np.fft.rfft(raw - raw.mean())
        spec[harmonics + 1:] = 0
        tbl = np.fft.irfft(spec, _TABLE_N)
        tbl /= max(1e-9, np.abs(tbl).max())
        tbl = tbl.astype(np.float32)
        _tables[key] = tbl
    return tbl


def _osc(shape, freq, n, vib=0.0, vib_rate=5.5, vib_delay=0.18, slide=0.0,
         detune=0.0, cap=None):
    """A band-limited oscillator with delayed vibrato and an optional
    pitch slide from `slide` semitones away."""
    t = np.arange(n, dtype=np.float32) / RATE
    f = np.full(n, freq * (1.0 + detune), dtype=np.float32)
    if vib:
        ramp = np.clip((t - vib_delay) / 0.25, 0.0, 1.0)
        f *= 1.0 + vib * ramp * np.sin(2 * np.pi * vib_rate * t)
    if slide:
        f *= 2.0 ** (slide * np.exp(-t * 40.0) / 12.0)
    k = int(RATE * 0.45 / max(20.0, freq))
    if cap:
        k = min(k, cap)
    k = max([h for h in _HARM_STEPS if h <= max(1, k)])
    tbl = _table(shape, k)
    phase = np.cumsum(f / RATE) % 1.0
    idx = phase * _TABLE_N
    i0 = idx.astype(np.int32) % _TABLE_N
    frac = idx - np.floor(idx)
    return tbl[i0] * (1 - frac) + tbl[(i0 + 1) % _TABLE_N] * frac


def _adsr(n, gate, a, d, s, r):
    """Attack, decay, sustain, release, in seconds; gate in samples."""
    env = np.zeros(n, dtype=np.float32)
    ta, td, tr = int(a * RATE) + 1, int(d * RATE) + 1, int(r * RATE) + 1
    g = min(gate, n)
    i = np.arange(g, dtype=np.float32)
    seg = np.where(i < ta, i / ta,
                   np.where(i < ta + td, 1.0 - (1.0 - s) * (i - ta) / td, s))
    env[:g] = seg
    level = seg[-1] if g else 0.0
    rel = min(tr, n - g)
    if rel > 0:
        env[g:g + rel] = level * (1.0 - np.arange(rel) / tr)
    return env


def _noise(n, seed):
    rng = np.random.default_rng(seed)
    return rng.uniform(-1.0, 1.0, n).astype(np.float32)


class Instrument:
    """A voice: how a note of a given pitch and length is turned into sound.
    `release` is how long it rings after the note ends."""

    def __init__(self, render, release=0.1, pan=0.0, send=0.25, gain=1.0):
        self.render = render
        self.release = release
        self.pan = pan
        self.send = send
        self.gain = gain


def _chip(shape, vib=0.006, a=0.004, d=0.12, s=0.72, r=0.06, slide=0.0, cap=None):
    def render(freq, gate):
        n = gate + int(r * RATE) + 1
        return _osc(shape, freq, n, vib=vib, slide=slide, cap=cap) * \
            _adsr(n, gate, a, d, s, r)
    return render, r


def _piano(bright=1.0, decay=1.0):
    parts = ((1, 1.0), (2, 0.55), (3, 0.30), (4, 0.18), (5, 0.10), (6, 0.06), (8, 0.03))

    def render(freq, gate):
        rel = 0.12
        n = gate + int(rel * RATE)
        t = np.arange(n, dtype=np.float32) / RATE
        out = np.zeros(n, dtype=np.float32)
        low = 1.0 + max(0.0, (440.0 - freq) / 440.0)       # low notes ring on
        for k, amp in parts:
            fk = freq * k * (1.0 + 0.0004 * k * k)          # slight stretch
            if fk > RATE * 0.45:
                break
            dk = (1.1 + 0.9 * k) * decay / low
            out += (amp * bright ** (k - 1)) * np.sin(2 * np.pi * fk * t) * np.exp(-t * dk)
        att = np.minimum(1.0, t / 0.003)
        damp = np.ones(n, dtype=np.float32)
        damp[gate:] = np.linspace(1.0, 0.0, n - gate)
        hammer = _noise(n, int(freq)) * np.exp(-t * 180.0) * 0.08
        return (out * att + hammer) * damp * 0.55
    return render, 0.12


def _fm_bell(ratio=3.5, index=2.2, decay=2.6, fast=6.0):
    def render(freq, gate):
        n = max(gate, int(RATE * 1.4))
        t = np.arange(n, dtype=np.float32) / RATE
        idx = index * np.exp(-t * fast)
        mod = np.sin(2 * np.pi * freq * ratio * t)
        out = np.sin(2 * np.pi * freq * t + idx * mod) * np.exp(-t * decay)
        out *= np.minimum(1.0, t / 0.002)
        return out * 0.6
    return render, 1.4


def _flute(breath=0.08, vib=0.007):
    def render(freq, gate):
        rel = 0.12
        n = gate + int(rel * RATE)
        t = np.arange(n, dtype=np.float32) / RATE
        ramp = np.clip((t - 0.22) / 0.3, 0.0, 1.0)
        f = freq * (1.0 + vib * ramp * np.sin(2 * np.pi * 5.2 * t))
        ph = np.cumsum(f / RATE) * 2 * np.pi
        out = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
        env = _adsr(n, gate, 0.05, 0.1, 0.85, rel)
        chiff = _noise(n, int(freq) + 7) * np.exp(-t * 30.0) * 0.3
        air = _noise(n, int(freq) + 3) * breath
        return (out * 0.8 + air) * env + chiff * env
    return render, 0.12


def _strings(a=0.22, r=0.45):
    def render(freq, gate):
        n = gate + int(r * RATE)
        out = (_osc("saw", freq, n, vib=0.004, vib_delay=0.3, detune=-0.004, cap=24) +
               _osc("saw", freq, n, vib=0.005, vib_rate=5.9, vib_delay=0.3,
                    detune=0.004, cap=24) +
               0.6 * _osc("saw", freq * 0.5, n, cap=16)) * 0.36
        return out * _adsr(n, gate, a, 0.2, 0.85, r)
    return render, r


def _brass():
    def render(freq, gate):
        r = 0.09
        n = gate + int(r * RATE)
        t = np.arange(n, dtype=np.float32) / RATE
        # the swell: a bright layer that fades into a mellow one, which is
        # what a filter envelope would do on a real synth
        bright = _osc("saw", freq, n, vib=0.004, cap=40)
        mellow = _osc("saw", freq, n, vib=0.004, cap=6)
        mix = np.exp(-t * 7.0)
        out = bright * mix + mellow * (1 - mix)
        return out * _adsr(n, gate, 0.02, 0.15, 0.8, r) * 0.7
    return render, 0.09


def _harp():
    parts = ((1, 1.0), (2, 0.4), (3, 0.18), (4, 0.08))

    def render(freq, gate):
        n = int(RATE * 1.3)
        t = np.arange(n, dtype=np.float32) / RATE
        out = np.zeros(n, dtype=np.float32)
        for k, amp in parts:
            out += amp * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (2.2 + 2.4 * k))
        return out * np.minimum(1.0, t / 0.002) * 0.7
    return render, 1.3


def _reed():
    def render(freq, gate):
        r = 0.14
        n = gate + int(r * RATE)
        out = _osc("pulse12", freq, n, vib=0.010, vib_rate=4.8, vib_delay=0.3, cap=14)
        out += 0.5 * _osc("pulse25", freq, n, vib=0.010, vib_rate=4.8, vib_delay=0.3, cap=8)
        return out * _adsr(n, gate, 0.06, 0.2, 0.8, r) * 0.6
    return render, 0.14


def _choir():
    def render(freq, gate):
        r = 0.6
        n = gate + int(r * RATE)
        out = (_osc("tri", freq, n, vib=0.004, detune=-0.003) +
               _osc("tri", freq, n, vib=0.005, vib_rate=4.6, detune=0.003) +
               0.35 * _osc("sine", freq * 2, n)) * 0.45
        return out * _adsr(n, gate, 0.5, 0.3, 0.9, r)
    return render, 0.6


def _bass(shape="tri", cap=None, r=0.04, a=0.003, s=0.9):
    def render(freq, gate):
        n = gate + int(r * RATE)
        return _osc(shape, freq, n, cap=cap) * _adsr(n, gate, a, 0.1, s, r)
    return render, r


def _drum(kind):
    def render(freq, gate):
        if kind == "k":
            n = int(RATE * 0.32)
            t = np.arange(n, dtype=np.float32) / RATE
            f = 48.0 + 110.0 * np.exp(-t * 32.0)
            body = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t * 11.0)
            click = _noise(n, 1) * np.exp(-t * 400.0) * 0.4
            return (body + click) * 1.1
        if kind in ("s", "g"):
            n = int(RATE * 0.22)
            t = np.arange(n, dtype=np.float32) / RATE
            nz = _noise(n, 2)
            nz = np.diff(nz, prepend=0.0) * 0.6 + nz * 0.4
            tone = np.sin(2 * np.pi * 185.0 * t) * np.exp(-t * 28.0)
            out = nz * np.exp(-t * 17.0) * 0.8 + tone * 0.6
            return out * (0.35 if kind == "g" else 0.9)
        if kind in ("h", "o", "c"):
            dur = {"h": 0.05, "o": 0.3, "c": 1.6}[kind]
            n = int(RATE * dur)
            t = np.arange(n, dtype=np.float32) / RATE
            raw = _noise(n + 1, 3)
            nz = np.diff(raw) * 0.7 + raw[1:] * 0.15
            dk = {"h": 60.0, "o": 11.0, "c": 2.4}[kind]
            return nz * np.exp(-t * dk) * {"h": 0.26, "o": 0.24, "c": 0.3}[kind]
        if kind in ("t", "l", "d"):
            n = int(RATE * 0.4)
            t = np.arange(n, dtype=np.float32) / RATE
            f0, f1 = {"t": (190, 130), "l": (120, 80), "d": (95, 62)}[kind]
            f = f1 + (f0 - f1) * np.exp(-t * 14.0)
            body = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t * 7.0)
            skin = _noise(n, 4) * np.exp(-t * 60.0) * 0.25
            return (body + skin) * (1.0 if kind != "d" else 1.1)
        if kind == "x":
            n = int(RATE * 0.04)
            t = np.arange(n, dtype=np.float32) / RATE
            return (np.sin(2 * np.pi * 1700 * t) * 0.5 + _noise(n, 5) * 0.5) * \
                np.exp(-t * 110.0) * 0.45
        return np.zeros(1, dtype=np.float32)
    return render


def _make(render_release, **kw):
    render, release = render_release
    return Instrument(render, release, **kw)


INSTRUMENTS = None


def _instruments():
    global INSTRUMENTS
    if INSTRUMENTS is None:
        INSTRUMENTS = {
            "square": _make(_chip("pulse50", vib=0.006), send=0.22),
            "pulse": _make(_chip("pulse25", vib=0.006), send=0.22),
            "thin": _make(_chip("pulse12", vib=0.005, d=0.1, s=0.6), send=0.2),
            "chipstab": _make(_chip("pulse25", vib=0.0, d=0.08, s=0.35, r=0.04), send=0.15,
                              gain=1.6),
            "chiparp": _make(_chip("pulse12", vib=0.0, d=0.06, s=0.4, r=0.03), send=0.25,
                             gain=2.6),
            "lead": _make(_chip("pulse50", vib=0.008, slide=-0.25), send=0.25),
            "piano": _make(_piano(), send=0.3),
            "epiano": _make(_piano(bright=0.6, decay=0.7), send=0.3),
            "celesta": _make(_fm_bell(ratio=4.0, index=1.4, decay=2.2), send=0.4),
            "musicbox": _make(_fm_bell(ratio=5.0, index=0.8, decay=1.6, fast=9.0), send=0.45),
            "bell": _make(_fm_bell(ratio=3.5, index=2.4, decay=1.2), send=0.45),
            "flute": _make(_flute(), send=0.32),
            "ocarina": _make(_flute(breath=0.03, vib=0.009), send=0.35),
            "strings": _make(_strings(), send=0.4),
            "slowstrings": _make(_strings(a=0.6, r=0.8), send=0.45),
            "brass": _make(_brass(), send=0.25),
            "harp": _make(_harp(), send=0.35, gain=1.25),
            "reed": _make(_reed(), send=0.3),
            "choir": _make(_choir(), send=0.5),
            "bass": _make(_bass("tri"), send=0.05, gain=0.8),
            "wavebass": _make(_bass("wave"), send=0.05, gain=0.85),
            "sawbass": _make(_bass("saw", cap=10, s=0.8), send=0.05, gain=0.9),
            "pluckbass": _make(_bass("tri", r=0.03, s=0.35), send=0.05),
        }
    return INSTRUMENTS


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------

def _pan_gains(pan):
    a = (pan + 1.0) * math.pi / 4.0
    return math.cos(a), math.sin(a)


def _reverb_ir(seconds=1.6, seed=11):
    n = int(RATE * seconds)
    t = np.arange(n, dtype=np.float32) / RATE
    irs = []
    for s in (seed, seed + 1):
        nz = _noise(n, s)
        # darker as it decays: average neighbours more as time goes on
        dark = np.convolve(nz, np.ones(6, dtype=np.float32) / 6, mode="same")
        mix = np.clip(t / seconds * 2.0, 0.0, 1.0)
        ir = (nz * (1 - mix) + dark * mix) * np.exp(-t * 4.2)
        ir[: int(RATE * 0.012)] *= np.linspace(0, 1, int(RATE * 0.012))
        irs.append(ir * 0.12)
    return irs


def _convolve(x, ir, block=1 << 16):
    """Overlap-add FFT convolution, so a two-minute track does not need one
    enormous transform."""
    m = len(ir)
    size = 1
    while size < block + m:
        size <<= 1
    H = np.fft.rfft(ir, size)
    out = np.zeros(len(x) + m, dtype=np.float32)
    for i in range(0, len(x), block):
        seg = x[i:i + block]
        y = np.fft.irfft(np.fft.rfft(seg, size) * H, size)[: len(seg) + m]
        out[i:i + len(y)] += y.astype(np.float32)
    return out


def render_song(song, sections):
    """Render a list of sections to stereo float arrays, with ring-out."""
    inst = _instruments()
    bpm = song["bpm"]
    beats = song.get("beats", 4)
    spb = 60.0 / bpm
    total_beats = sum(sec["bars"] * beats for sec in sections)
    tail = 2.2
    n = int((total_beats * spb + tail) * RATE)
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    send = np.zeros(n, dtype=np.float32)
    cache = {}

    def place(buf, start, wave, gl, gr, sendv):
        i = int(start * RATE)
        if i >= n:
            return
        w = wave[: n - i]
        left[i:i + len(w)] += w * gl
        right[i:i + len(w)] += w * gr
        if sendv:
            send[i:i + len(w)] += w * sendv

    beat0 = 0.0
    for si, sec in enumerate(sections):
        length = sec["bars"] * beats
        chords = parse_chords(sec["chords"], beats) if sec.get("chords") else None
        where = "%s section %d" % (song.get("name", "?"), si + 1)
        for part in sec.get("parts", ()):
            name = part["inst"]
            ins = inst[name]
            if "notes" in part:
                ev, used = parse_notes(part["notes"], beats, "%s %s" % (where, name))
                if used > length + 1e-6:
                    raise ValueError("%s %s runs %.2f beats past the section"
                                     % (where, name, used - length))
            else:
                ev = accompany(part["style"], chords, length, beats,
                               part.get("oct", 3), part.get("vel", 0.7))
            if part.get("harmony"):
                ev = harmonize(ev, chords, *part["harmony"])
            tr = part.get("transpose", 0)
            pan = part.get("pan", ins.pan)
            gl, gr = _pan_gains(pan)
            vol = part.get("vol", 1.0) * ins.gain
            sendv = part.get("send", ins.send)
            for t, d, pitches, v in ev:
                gate = int(d * spb * RATE * part.get("legato", 0.94))
                for p in pitches:
                    key = (name, p + tr, gate)
                    w = cache.get(key)
                    if w is None:
                        w = ins.render(hz(p + tr), max(1, gate)).astype(np.float32)
                        cache[key] = w
                    place(left, (beat0 + t) * spb, w * (v * vol), gl, gr, sendv)
        dname = sec.get("drums")
        if dname:
            dvol = sec.get("drum_vol", song.get("drum_vol", 0.8))
            for t, kind in drum_events(dname, sec["bars"], beats, sec.get("fill"),
                                       sec.get("crash", True)):
                key = ("drum", kind)
                w = cache.get(key)
                if w is None:
                    w = _drum(kind)(0, 0).astype(np.float32)
                    cache[key] = w
                pan = {"h": 0.3, "o": 0.3, "t": -0.3, "l": 0.25, "x": 0.35}.get(kind, 0.0)
                gl, gr = _pan_gains(pan)
                place(left, (beat0 + t) * spb, w * dvol, gl, gr,
                      0.12 if kind in "sgtlcd" else 0.0)
        beat0 += length

    wet = song.get("reverb", 1.0)
    if wet:
        irl, irr = _reverb_ir(song.get("room", 1.6))
        left += _convolve(send, irl)[:n] * wet
        right += _convolve(send, irr)[:n] * wet
    return left, right, int(total_beats * spb * RATE)


def _master(stereo, peak, drive=1.6):
    out = stereo / peak
    out = np.tanh(out * drive) / math.tanh(drive)       # gentle glue
    return (out * 0.88 * 32767).astype(np.int16)


def render(song):
    """Render a song to (intro, loop) int16 stereo arrays. The loop has its
    own reverb tail folded back onto its start, so it repeats without a seam.
    The intro is None for a song without one."""
    intro = song.get("intro", [])
    loop = song.get("loop", [])
    left, right, _ = render_song(song, intro + loop)
    beats = song.get("beats", 4)
    spb = 60.0 / song["bpm"]
    i_len = int(sum(s["bars"] * beats for s in intro) * spb * RATE)
    l_len = int(sum(s["bars"] * beats for s in loop) * spb * RATE)
    mix = np.stack([left, right], axis=1)
    first = mix[:i_len]
    if song.get("loops", True):
        # fold the ring-out back onto the start, so the seam is inaudible
        body = mix[i_len:i_len + l_len].copy()
        spill = mix[i_len + l_len:]
        k = min(len(spill), len(body))
        body[:k] += spill[:k]
    else:
        body = mix[i_len:]                       # a jingle: let it ring out
    peak = max(1e-6, float(np.abs(body).max()),
               float(np.abs(first).max()) if len(first) else 0.0)
    return (_master(first, peak) if intro else None), _master(body, peak)


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
_loop_sound = None


def _sound(arr):
    return pygame.mixer.Sound(buffer=np.ascontiguousarray(arr).tobytes())


def init(threaded=True):
    """Synthesise the score. Threaded by default so start-up is not blocked;
    the title theme is rendered first so it is ready soonest."""
    global _enabled, _channel
    if pygame is None or np is None or not pygame.mixer.get_init():
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
    from .score import SONGS
    order = ["title"] + [k for k in SONGS if k != "title"]
    for name in order:
        try:
            intro, body = render(SONGS[name])
            _tracks[name] = (_sound(intro) if intro is not None else None,
                             _sound(body), SONGS[name].get("loops", True))
        except Exception as exc:                         # pragma: no cover
            print("music: could not render %s: %s" % (name, exc))
        if name == _pending and _current != name:
            play(name, restart=True)
    _ready.set()


def play(name, restart=False):
    """Start a track, or remember it if it is still being rendered."""
    global _current, _pending, _loop_sound
    if not _enabled:
        return
    if name == _current and not restart:
        return
    _pending = name
    track = _tracks.get(name)
    if track is None:
        return
    intro, body, loops = track
    _current = name
    for s in (intro, body):
        if s is not None:
            s.set_volume(_volume)
    try:
        if intro is not None:
            _channel.play(intro, fade_ms=120)
            _channel.queue(body)
            _loop_sound = body if loops else None
        else:
            _channel.play(body, loops=-1 if loops else 0, fade_ms=420)
            _loop_sound = None
    except pygame.error:
        pass


def update():
    """Keep an intro-then-loop track going: once the loop body is playing,
    queue it again behind itself. Called once a frame."""
    if not _enabled or _loop_sound is None or _channel is None:
        return
    try:
        if _channel.get_queue() is None:
            _channel.queue(_loop_sound)
    except pygame.error:
        pass


def stop(fade_ms=400):
    global _current, _pending, _loop_sound
    _current = None
    _pending = None
    _loop_sound = None
    if _enabled and _channel:
        _channel.fadeout(fade_ms)


def set_volume(v):
    global _volume
    _volume = max(0.0, min(1.0, v))
    if _enabled and _channel:
        _channel.set_volume(_volume)


def enabled():
    return _enabled
