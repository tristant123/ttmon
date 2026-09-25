"""The score: eight pieces, written as lead sheets.

Each piece has an intro that plays once and a loop body of several sections
(A, A', B, bridge...) so that a map's theme runs a minute and a half or more
before it repeats, and every repeat of a phrase changes something - who
plays it, what harmonises it, how the drums fill into the next section.

The models are the GBA Pokemon games and Undertale, specifically:

* A town theme built like Littleroot's: a flute tune over off-beat chord
  stabs and a walking bass, with a quieter piano bridge for the evening.
* A route theme like Route 101's: a square lead that marches, arpeggios
  underneath, a counter-melody a third below on the repeat.
* A battle theme on the wild-battle template: a chromatic run down into a
  pumping octave bass, a lead that climbs through the harmonic minor, and a
  half-time bridge before it loops.
* Undertale's habit of one tune in many clothes. The motif A-C-E-D-C-B-A
  (scale degrees 1 3 5 4 3 2 1) opens the title theme, turns up major in the
  town, and comes back as the boss theme's B section with its fifth raised
  into the Egyptian-sounding phrygian dominant.

Notation and styles are documented in music.py.
"""


def P(inst, notes=None, style=None, **kw):
    """A part: an instrument playing written notes or a generated figure."""
    d = dict(inst=inst, **kw)
    if notes is not None:
        d["notes"] = notes
    if style is not None:
        d["style"] = style
    return d


def S(bars, chords, *parts, **kw):
    """A section: a number of bars over a chord progression."""
    return dict(bars=bars, chords=chords, parts=list(parts), **kw)


def vary(section, *parts, **kw):
    """The same section with different players, or different drums."""
    out = dict(section)
    if parts:
        out["parts"] = list(parts)
    out.update(kw)
    return out


# ===========================================================================
# Title - "Tabula Mythos". A minor, a music box over a broken piano figure.
# ===========================================================================

_TITLE_A = ("a4/4 c5/8 e5 e5/4. d5/8 | c5/4 a4/8 c5 f5/4. e5/8 | "
            "e5/4. d5/8 c5/4 e5 | d5/2. r/4 | "
            "a4/4 c5/8 e5 a5/4. g5/8 | f5/4 e5/8 d5 c5/4 a4 | "
            "d5/4 f5 a5 f5/8 e5 | b4/2 g#4/4 e4 |")
_TITLE_B = ("a5/4. g5/8 f5/4 c5 | d5/4. e5/8 d5/4 b4 | "
            "g5/4. f5/8 e5/4 b4 | c5/2 a4/4 e5 | "
            "f5/4. e5/8 d5/4 a4 | b4/4 d5 g5 f5 | "
            "e5/4. d5/8 c5/4 g4 | g#4/4 b4 d5 e5 |")
_TITLE_CH_A = "Am | F | C | G | Am | F | Dm | E"
_TITLE_CH_B = "F | G | Em | Am | Dm | G | C | E7"

TITLE = {
    "name": "title", "bpm": 84, "reverb": 1.3, "room": 2.2,
    "intro": [
        S(2, "Am | F",
          P("piano", style="broken", oct=3, vol=0.55, pan=-0.15),
          P("bass", style="half", oct=2, vol=0.5)),
    ],
    "loop": [
        S(8, _TITLE_CH_A,
          P("musicbox", _TITLE_A, vol=0.95, pan=0.15),
          P("piano", style="broken", oct=3, vol=0.5, pan=-0.15),
          P("bass", style="half", oct=2, vol=0.5)),
        S(8, _TITLE_CH_B,
          P("celesta", _TITLE_B, vol=0.9, pan=0.15),
          P("piano", style="broken", oct=3, vol=0.45, pan=-0.2),
          P("slowstrings", style="pad", oct=3, vol=0.38),
          P("bass", style="half", oct=2, vol=0.55)),
        S(8, _TITLE_CH_A,
          P("piano", _TITLE_A, vol=0.9, pan=0.05),
          P("musicbox", _TITLE_A, vol=0.35, pan=0.4,
            harmony=("A", "harmonic"), transpose=12),
          P("slowstrings", style="pad", oct=3, vol=0.42, pan=-0.2),
          P("bass", style="half", oct=2, vol=0.55)),
        S(4, "Am | F | Dm | E",
          P("celesta", "a4/1 | c5/1 | f5/2 d5 | e5/1 |", vol=0.8, pan=0.15),
          P("piano", style="broken", oct=3, vol=0.45, pan=-0.15),
          P("slowstrings", style="pad", oct=3, vol=0.35),
          P("bass", style="half", oct=2, vol=0.5)),
    ],
}


# ===========================================================================
# Lantern Hollow - the village. C major, a town theme.
# ===========================================================================

_VIL_A = ("g4/8 c5 e5/4 d5/8 c5 d5/4 | e5/4. c5/8 a4/2 | "
          "a4/8 c5 f5/4 e5/8 d5 c5/4 | d5/4. b4/8 g4/2 | "
          "g4/8 c5 e5/4 d5/8 c5 g5/4 | a5/4. g5/8 e5/2 | "
          "f5/8 e5 d5/4 d5/8 e5 f5/4 | ")
_VIL_A_END1 = "e5/2 c5/4 r/4 |"
_VIL_A_END2 = "c5/2. r/4 |"
_VIL_B = ("c5/4 f5/8 g5 a5/4 f5 | d5/4 g5/8 a5 b5/4 g5 | "
          "e5/4 g5/8 a5 b5/4. a5/8 | c6/4 b5/8 a5 e5/2 | "
          "f5/4 a5/8 g5 f5/4 d5 | e5/4 g5/8 f5 e5/4 b4 | "
          "c5/4 d5/8 e5 f5/4 a5 | g5/2 f5/4 d5 |")
_VIL_C = ("e5/4. d5/8 c5/4 a4 | b4/4. c5/8 b4/4 g4 | "
          "a4/4. c5/8 f5/4 e5/8 d5 | e5/2. r/4 | "
          "d5/4. e5/8 f5/4 a5 | e5/4. c5/8 a4/2 | "
          "bb4/4 d5 f5 d5 | d5/2 b4/4 g4 |")
_VIL_CH_A = "C | Am | F | G | C | Am | Dm G | C"


def _vil_a(lead, end, harmony=False):
    parts = [P(lead, _VIL_A + end, vol=0.9, pan=0.1),
             P("chipstab", style="stab", oct=4, vol=0.32, pan=-0.3),
             P("wavebass", style="walk", oct=2, vol=0.75)]
    if harmony:
        parts.append(P("thin", _VIL_A + end, vol=0.3, pan=-0.4,
                       harmony=("C", "major")))
    return S(8, _VIL_CH_A, *parts, drums="town", fill="fill")


VILLAGE = {
    "name": "village", "bpm": 104, "reverb": 0.9,
    "intro": [
        S(2, "C | G7",
          P("pulse", "e5/8 d5 c5 d5 e5 g5 e5 d5 | d5/2 b4/4 g4 |", vol=0.75, pan=0.1),
          P("chipstab", style="stab", oct=4, vol=0.3, pan=-0.3),
          P("wavebass", style="rootfifth", oct=2, vol=0.7), drums="town", crash=False),
    ],
    "loop": [
        _vil_a("flute", _VIL_A_END1),
        _vil_a("pulse", _VIL_A_END2, harmony=True),
        S(8, "F | G | Em | Am | Dm | Em | F | G7",
          P("flute", _VIL_B, vol=0.9, pan=0.1),
          P("strings", style="pad", oct=3, vol=0.28, pan=-0.2),
          P("chipstab", style="stab", oct=4, vol=0.26, pan=-0.35),
          P("wavebass", style="walk", oct=2, vol=0.75), drums="town", fill="fill"),
        _vil_a("flute", _VIL_A_END2, harmony=True),
        # the evening: piano, the chords go minor, the drums nearly stop
        S(8, "Am | Em | F | C | Dm | Am | Bb | G",
          P("piano", _VIL_C, vol=0.9, pan=0.05),
          P("strings", style="pad", oct=3, vol=0.32, pan=-0.2),
          P("bass", style="half", oct=2, vol=0.6), drums="soft", drum_vol=0.6),
    ],
}


# ===========================================================================
# Mistgrass Road - the route. D major, a march.
# ===========================================================================

_ROUTE_A = ("a4/8 d5 f#5/4 a5/4. f#5/8 | f#5/4 e5/8 d5 b4/2 | "
            "d5/8 g5 b5/4 a5/8 g5 d5/4 | e5/4. f#5/8 e5/4 c#5 | "
            "a4/8 d5 f#5/4 a5/4. d6/8 | c#6/4 b5/8 a5 f#5/2 | "
            "g5/8 f#5 e5/4 e5/8 f#5 g5/4 | ")
_ROUTE_A_END1 = "f#5/4 d5 d5 r |"
_ROUTE_A_END2 = "f#5/4 d5 d5/2 |"
_ROUTE_B = ("b4/4 d5/8 g5 g5/4. f#5/8 | e5/4 c#5/8 e5 a5/2 | "
            "a5/4. f#5/8 c#5/4 f#5 | d5/2 b4/4 d5 | "
            "g5/4. f#5/8 e5/4 b4 | c#5/4 e5/8 f#5 g5/4 a5 | "
            "f#5/2 a5/4 d6 | c#6/4 a5/8 g5 e5/4 c#5 |")
_ROUTE_C = ("f#4/4 b4 d5 c#5/8 b4 | d5/4. b4/8 g4/2 | "
            "a4/4 d5 f#5 e5/8 d5 | e5/2. r/4 | "
            "f#5/4 e5/8 d5 b4/2 | d5/4 b4/8 d5 g5/2 | "
            "g5/4 f#5/8 e5 b4/4 e5 | c#5/4 e5 g5 a5 |")
_ROUTE_CH_A = "D | Bm | G | A | D | Bm | Em A | D"


def _route_a(end, harmony=False):
    parts = [P("square", _ROUTE_A + end, vol=0.75, pan=0.15),
             P("chiparp", style="arp16", oct=4, vol=0.22, pan=-0.35),
             P("wavebass", style="root8", oct=2, vol=0.7)]
    if harmony:
        parts.append(P("thin", _ROUTE_A + end, vol=0.32, pan=-0.3,
                       harmony=("D", "major")))
    return S(8, _ROUTE_CH_A, *parts, drums="route", fill="fill")


ROUTE = {
    "name": "route", "bpm": 138, "reverb": 0.8,
    "intro": [
        S(2, "D | A7",
          P("square", "d5/8 r d5 r d5/4 a4 | c#5/8 d5 e5 f#5 g5/4 a5 |", vol=0.75),
          P("brass", style="pad3", oct=3, vol=0.3),
          P("wavebass", style="pump", oct=2, vol=0.7), drums="march", fill="fill"),
    ],
    "loop": [
        _route_a(_ROUTE_A_END1),
        _route_a(_ROUTE_A_END2, harmony=True),
        S(8, "G | A | F#m | Bm | Em | A | D | A7",
          P("pulse", _ROUTE_B, vol=0.8, pan=0.15),
          P("strings", style="pad", oct=3, vol=0.24, pan=-0.2),
          P("chiparp", style="arp16", oct=4, vol=0.2, pan=-0.35),
          P("wavebass", style="walk", oct=2, vol=0.75), drums="route", fill="fill"),
        S(8, "Bm | G | D | A | Bm | G | Em | A7",
          P("brass", _ROUTE_C, vol=0.62, pan=0.1),
          P("flute", _ROUTE_C, vol=0.3, pan=0.35, transpose=12),
          P("strings", style="pad", oct=3, vol=0.26, pan=-0.2),
          P("wavebass", style="rootfifth", oct=2, vol=0.75), drums="march", fill="fill"),
        _route_a(_ROUTE_A_END2, harmony=True),
    ],
}


# ===========================================================================
# The Marble Steps - the Greek ruin. D dorian, in three: a harp and a flute.
# ===========================================================================

_RUIN_A = ("a4/4 d5 f5 | e5/4. d5/8 c5/4 | d5/2 c5/4 | e5/2. | "
           "a4/4 d5 f5 | b4/4 d5 g5 | f5/4. e5/8 d5/4 | e5/2. |")
_RUIN_B = ("c6/4 a5 f5 | g5/4. e5/8 c5/4 | d5/4 f5 a5 | e5/2 c5/4 | "
           "d5/4. f5/8 bb5/4 | a5/4. g5/8 f5/4 | g5/4 bb5 d6 | c#6/2. |")
_RUIN_CH_A = "Dm | C | Bb | C | Dm | G | Bb | A"
_RUIN_CH_B = "F | C | Dm | Am | Bb | F | Gm | A"

RUINS = {
    "name": "ruins", "bpm": 104, "beats": 3, "reverb": 1.3, "room": 2.0,
    "intro": [
        S(2, "Dm | C",
          P("harp", style="harp3", oct=3, vol=0.6, pan=-0.2),
          P("bass", style="waltz", oct=2, vol=0.55)),
    ],
    "loop": [
        S(8, _RUIN_CH_A,
          P("flute", _RUIN_A, vol=0.9, pan=0.1),
          P("harp", style="harp3", oct=3, vol=0.55, pan=-0.25),
          P("bass", style="waltz", oct=2, vol=0.55), drums="frame3", drum_vol=0.4),
        S(8, _RUIN_CH_B,
          P("flute", _RUIN_B, vol=0.9, pan=0.1),
          P("harp", style="harp3", oct=3, vol=0.5, pan=-0.25),
          P("strings", style="pad", oct=3, vol=0.26),
          P("bass", style="waltz", oct=2, vol=0.55), drums="frame3", drum_vol=0.4),
        S(8, _RUIN_CH_A,
          P("piano", _RUIN_A, vol=0.85, pan=0.0),
          P("flute", _RUIN_A, vol=0.35, pan=0.4, harmony=("D", "dorian"),
            transpose=12),
          P("harp", style="harp3", oct=3, vol=0.45, pan=-0.3),
          P("bass", style="waltz", oct=2, vol=0.55), drums="frame3", drum_vol=0.35),
        S(8, _RUIN_CH_B,
          P("strings", _RUIN_B, vol=0.62, pan=-0.1, transpose=-12),
          P("celesta", _RUIN_B, vol=0.35, pan=0.35),
          P("harp", style="harp3", oct=3, vol=0.5, pan=-0.3),
          P("bass", style="waltz", oct=2, vol=0.55), drums="frame3", drum_vol=0.4),
        S(8, _RUIN_CH_A,
          P("flute", _RUIN_A, vol=0.9, pan=0.1),
          P("harp", style="harp3", oct=3, vol=0.55, pan=-0.25),
          P("slowstrings", style="pad", oct=3, vol=0.22),
          P("bass", style="waltz", oct=2, vol=0.55), drums="frame3", drum_vol=0.4),
    ],
}


# ===========================================================================
# Shrine of the Scale - A phrygian dominant, the scale of the desert: slow,
# a reed over a drone, a frame drum, and bells in the dark.
# ===========================================================================

_SHR_A = ("e5/4. f5/16 e5 c#5/4 a4 | bb4/4. a4/8 bb4/4 d5 | "
          "c#5/4. d5/16 c#5 bb4/4 a4 | g4/2. r/4 | "
          "a4/4 d5 f5/4. e5/8 | f5/4. e5/8 d5/4 bb4 | "
          "c#5/2 e5/4 f5/8 e5 | a4/1 |")
_SHR_B = ("f5/4 e5/8 d5 a5/2 | bb5/4. a5/8 g5/4 d5 | "
          "f5/4 d5/8 f5 bb5/4. a5/8 | a5/2 e5/4 c#5 | "
          "d5/4. e5/8 f5/4 a5 | bb5/4 a5/8 g5 f5/4 d5 | "
          "g5/4. f5/8 e5/4 d5 | c#5/2. r/4 |")
_SHR_CH_A = "A | Bb | A | Gm | Dm | Bb | A | A"
_SHR_CH_B = "Dm | Gm | Bb | A | Dm | Bb | Gm | A"

SHRINE = {
    "name": "shrine", "bpm": 76, "reverb": 1.5, "room": 2.6,
    "intro": [
        S(2, "A | Bb",
          P("choir", style="pad3", oct=3, vol=0.45),
          P("bass", style="drone", oct=2, vol=0.45), drums="frame", drum_vol=0.5,
          crash=False),
    ],
    "loop": [
        S(8, _SHR_CH_A,
          P("reed", _SHR_A, vol=0.85, pan=0.1),
          P("harp", style="arp8", oct=3, vol=0.42, pan=-0.3),
          P("choir", style="pad3", oct=3, vol=0.28),
          P("bass", style="drone", oct=2, vol=0.45), drums="frame", drum_vol=0.55,
          crash=False),
        S(8, _SHR_CH_B,
          P("ocarina", _SHR_B, vol=0.85, pan=0.1),
          P("harp", style="arp8", oct=3, vol=0.4, pan=-0.3),
          P("slowstrings", style="pad", oct=3, vol=0.3),
          P("bass", style="drone", oct=2, vol=0.45), drums="frame", drum_vol=0.55,
          crash=False),
        S(4, "A | Bb | A | A",
          P("bell", "e6/2 r/2 | f6/2 r/2 | c#6/1 | a5/1 |", vol=0.5, pan=0.2),
          P("choir", style="pad3", oct=3, vol=0.35),
          P("bass", style="drone", oct=2, vol=0.4)),
        S(8, _SHR_CH_A,
          P("reed", _SHR_A, vol=0.8, pan=0.1),
          P("bell", _SHR_A, vol=0.22, pan=0.4, transpose=12),
          P("harp", style="arp8", oct=3, vol=0.42, pan=-0.3),
          P("choir", style="pad3", oct=3, vol=0.3),
          P("bass", style="drone", oct=2, vol=0.45), drums="frame", drum_vol=0.55,
          crash=False),
        S(8, _SHR_CH_B,
          P("reed", _SHR_B, vol=0.8, pan=0.1),
          P("ocarina", _SHR_B, vol=0.3, pan=-0.35, harmony=("A", "phrygdom")),
          P("harp", style="arp8", oct=3, vol=0.4, pan=-0.3),
          P("slowstrings", style="pad", oct=3, vol=0.3),
          P("bass", style="drone", oct=2, vol=0.45), drums="frame", drum_vol=0.55,
          crash=False),
    ],
}


# ===========================================================================
# Wild battle - E minor, 172 bpm.
# ===========================================================================

_BAT_A = ("b4/8 e5 g5 b5/4. a5/8 g5 | a5/8 g5 e5/4 g5/8 e5 c5/4 | "
          "f#5/4. e5/8 d5/4 a4 | b4/8 c5 d#5 f#5 a5/2 | "
          "b4/8 e5 g5 b5/4. c6/8 b5 | g5/4 e5/8 g5 c6/4 b5 | "
          "a5/8 g5 f#5 e5 c5/4 e5 | ")
_BAT_A_END1 = "d#5/4 f#5 b5 a5 |"
_BAT_A_END2 = "d#5/8 e5 f#5 g5 a5 b5 c6 d#6 |"
_BAT_B = ("d6/4 b5/8 g5 d5/4 g5 | f#5/4. e5/8 d5/2 | "
          "e5/8 f#5 g5 a5 b5/4 g5 | c6/4. b5/8 a5/4 g5 | "
          "b5/4 d6/8 b5 g5/4 d5 | a5/4. f#5/8 d5/4 f#5 | "
          "e5/8 g5 c6 b5 a5/4 g5 | f#5/2 d#5/4 b4 |")
_BAT_C = ("e5/2 c5 | b4/1 | c5/2 e5 | d#5/1 | "
          "g5/2 e5 | d5/1 | c5/2 e5 | f#5/2 d#5/4 b4 |")
_BAT_CH_A = "Em | C | D | B7 | Em | C | Am | B7"
_BAT_CH_B = "G | D | Em | C | G | D | C | B7"


def _bat_a(end, harmony=False):
    parts = [P("square", _BAT_A + end, vol=0.72, pan=0.12),
             P("wavebass", style="pump", oct=2, vol=0.9),
             P("chipstab", style="stab16", oct=4, vol=0.2, pan=-0.3)]
    if harmony:
        parts.append(P("pulse", _BAT_A + end, vol=0.32, pan=-0.35,
                       harmony=("E", "harmonic")))
    return S(8, _BAT_CH_A, *parts, drums="battle", fill="fill_battle")


BATTLE = {
    "name": "battle", "bpm": 172, "reverb": 0.6, "drum_vol": 0.7,
    "intro": [
        S(2, "Em | Em",
          P("square", "e6/16 d#6 d6 c#6 c6 b5 a#5 a5 g#5 g5 f#5 f5 e5 d#5 d5 c#5 | "
                      "c5/16 b4 a#4 a4 g#4 g4 f#4 f4 e4/8 r e4 r |", vol=0.7),
          P("wavebass", "r/1 | r/2 e2/8 r e2 r |", vol=0.9), drums="none"),
        S(2, "Em | B7",
          P("square", "e4/8 e4 g4 e4 a4 e4 bb4 a4 | b4/8 b4 a4 g4 f#4 e4 d#4 f#4 |",
            vol=0.7),
          P("brass", "(e3 g3 b3)/4 r/2. | (d#3 f#3 b3)/4 r/2. |", vol=0.5),
          P("wavebass", style="pump", oct=2, vol=0.9), drums="battle", fill="fill_battle"),
    ],
    "loop": [
        _bat_a(_BAT_A_END1),
        _bat_a(_BAT_A_END2, harmony=True),
        S(8, _BAT_CH_B,
          P("lead", _BAT_B, vol=0.72, pan=0.12),
          P("chiparp", style="arp16", oct=4, vol=0.2, pan=-0.3),
          P("wavebass", style="pump", oct=2, vol=0.9), drums="battle"),
        S(8, _BAT_CH_B,
          P("square", _BAT_B, vol=0.7, pan=0.12),
          P("thin", _BAT_B, vol=0.3, pan=-0.35, harmony=("E", "harmonic")),
          P("brass", style="pad3", oct=3, vol=0.28),
          P("wavebass", style="pump", oct=2, vol=0.9), drums="battle", fill="fill_battle"),
        # half time: strings hold the line while the arpeggio keeps running
        S(8, "Am | Em | Am | B7 | C | G | Am | B7",
          P("strings", _BAT_C, vol=0.62, pan=0.1),
          P("chiparp", style="arp16", oct=4, vol=0.3, pan=-0.3),
          P("wavebass", style="root8", oct=2, vol=0.8), drums="half", fill="fill_battle"),
    ],
}


# ===========================================================================
# Anubis - E phrygian dominant, 150 bpm. Brass, a galloping bass, and the
# title's motif, turned Egyptian, as the B section.
# ===========================================================================

_BOSS_RIFF = ("e2/8 e2 f2 e2 g#2 e2 a2 g#2 | f2/8 f2 g#2 f2 a2 f2 b2 a2 | "
              "e2/8 e2 f2 e2 g#2 e2 a2 g#2 | f2/8 f2 g#2 f2 a2 f2 b2 a2 |")
_BOSS_A = ("e5/8 f5 g#5 b5/4. a5/8 g#5 | a5/4 f5/8 a5 c6/4 a5 | "
           "g#5/4. f5/8 e5/4 b4 | d5/8 e5 f5 a5 d6/2 | "
           "c6/4. b5/8 a5/4 e5 | f5/8 a5 c6 a5 f5/4 c5 | "
           "d5/4 f5/8 a5 d6/4 c6 | b5/2 g#5/4 e5 |")
_BOSS_B = ("a4/4 c5 e5 d5/8 c5 | b4/2 g#4/4 e4 | "
           "a4/4 c5 f5 e5/8 d5 | e5/2. r/4 | "
           "a5/4 c6 e6 d6/8 c6 | b5/4. g#5/8 e5/4 f5/8 g#5 | "
           "a5/4 c6 f6 e6/8 d6 | e6/1 |")
_BOSS_C = ("e5/2. f5/8 e5 | c5/1 | b4/2. c5/8 b4 | a4/1 | "
           "d5/2 f5 | g#5/1 | a5/2 c6 | b5/2 g#5 |")
_BOSS_CH_A = "E | F | E | Dm | Am | F | Dm | E"
_BOSS_CH_B = "Am | E | F | E | Am | E | F | E"

BOSS = {
    "name": "boss", "bpm": 150, "reverb": 0.8, "drum_vol": 0.75,
    "intro": [
        S(4, "E | F | E | F",
          P("sawbass", _BOSS_RIFF, vol=0.8),
          P("brass", "(e4 g#4 b4)/4 r/2. | (f4 a4 c5)/4 r/2. | "
                     "(e4 g#4 b4)/4 r/2. | (f4 a4 c5)/8 (f4 a4 c5) r/4 (f4 a4 c5)/8 "
                     "(f4 a4 c5) (g#4 b4 d5)/4 |", vol=0.55),
          drums="boss", fill="fill_battle"),
    ],
    "loop": [
        S(8, _BOSS_CH_A,
          P("lead", _BOSS_A, vol=0.75, pan=0.1),
          P("sawbass", style="pump", oct=2, vol=0.8),
          P("brass", style="stab", oct=3, vol=0.5, pan=-0.25), drums="boss"),
        S(8, _BOSS_CH_B,
          P("square", _BOSS_B, vol=0.72, pan=0.1),
          P("brass", _BOSS_B, vol=0.42, pan=-0.2, transpose=-12),
          P("chiparp", style="arp16", oct=4, vol=0.2, pan=-0.35),
          P("sawbass", style="gallop", oct=2, vol=0.8), drums="boss", fill="fill_battle"),
        S(8, _BOSS_CH_A,
          P("lead", _BOSS_A, vol=0.72, pan=0.1),
          P("thin", _BOSS_A, vol=0.32, pan=-0.35, harmony=("E", "phrygdom")),
          P("sawbass", style="pump", oct=2, vol=0.8),
          P("brass", style="stab", oct=3, vol=0.5, pan=-0.25), drums="boss"),
        # the breakdown: toms and a reed, the scale laid bare
        S(8, "E | F | E | F | Dm | E | F | E",
          P("reed", _BOSS_C, vol=0.8, pan=0.1),
          P("choir", style="pad3", oct=3, vol=0.34),
          P("sawbass", style="drone", oct=1, vol=0.55), drums="breakdown",
          fill="fill_battle"),
        S(8, _BOSS_CH_B,
          P("lead", _BOSS_B, vol=0.75, pan=0.1),
          P("brass", _BOSS_B, vol=0.42, pan=-0.2, transpose=-12),
          P("chiparp", style="arp16", oct=4, vol=0.2, pan=-0.35),
          P("sawbass", style="gallop", oct=2, vol=0.8), drums="boss", fill="fill_battle"),
    ],
}


# ===========================================================================
# Victory - a fanfare, then a bright little tune that loops until you leave.
# ===========================================================================

_VIC = ("e5/4 g5/8 e5 c5/4 g4 | a4/8 c5 e5 a5 g5/4 e5 | "
        "f5/4 a5/8 f5 c5/4 a4 | b4/8 d5 g5/4 f5 d5 | "
        "e5/4 g5/8 e5 c6/4 g5 | a5/8 g5 e5 c5 a4/4 c5 | "
        "d5/8 f5 a5/4 g5/8 f5 d5/4 | c5/2 r/2 |")
_VIC_CH = "C | Am | F | G | C | Am | Dm G | C"

VICTORY = {
    "name": "victory", "bpm": 140, "reverb": 0.8,
    "intro": [
        S(2, "C | G",
          P("square", "g4/8 c5 e5 g5 c6/4. g5/8 | b5/8 a5 g5 f5 d5/4 g4 |", vol=0.75),
          P("brass", style="pad3", oct=4, vol=0.35),
          P("bass", style="root4", oct=2, vol=0.7), drums="fanfare"),
    ],
    "loop": [
        S(8, _VIC_CH,
          P("square", _VIC, vol=0.72, pan=0.1),
          P("thin", _VIC, vol=0.3, pan=-0.35, harmony=("C", "major")),
          P("chipstab", style="stab", oct=4, vol=0.28, pan=-0.2),
          P("wavebass", style="walk", oct=2, vol=0.75), drums="town"),
        S(8, _VIC_CH,
          P("flute", _VIC, vol=0.85, pan=0.1),
          P("chiparp", style="arp16", oct=4, vol=0.22, pan=-0.3),
          P("wavebass", style="walk", oct=2, vol=0.75), drums="town", fill="fill"),
    ],
}


SONGS = {
    "title": TITLE,
    "village": VILLAGE,
    "route": ROUTE,
    "ruins": RUINS,
    "shrine": SHRINE,
    "battle": BATTLE,
    "boss": BOSS,
    "victory": VICTORY,
}
