"""Monster sprites: 64x64 material maps, composed from parts.

House style: cute first, with enough anatomy - claws, cloth, feathers,
irises - to hold up at the size a battle draws them. Each species is drawn
from world mythology and kept endearing, so the brutal combat system lands
as a contrast rather than a warning.

The art is authored as material maps rather than finished pixels; shading.py
lights them. The helpers below exist because hand-counting 64-character rows
does not work: silhouettes are built from outlines (spans, ellipse, plume),
limbs and tails are swept along paths (tube), symmetric parts are written
half-width (sym), and parts are placed by anchor (pin) or corner (stamp).
"""

from . import shading
from .shading import M

# The one shared material: the catch-light in an eye. Flat, because light
# must not bevel it.
GLINT = M((255, 255, 255), "gem", flat=True)


def canvas(w=64, h=64):
    """A blank grid to stamp parts onto.

    Placing wings, tails and limbs as separate pieces at chosen coordinates is
    far less error-prone than writing one 64-character line per row and
    counting dots, and it makes a part reusable between creatures."""
    return [["."] * w for _ in range(h)]


def stamp(cv, x, y, rows, onto=False):
    """Paint a part onto the canvas; '.' in the part leaves what was there.

    With `onto`, the part only paints where the canvas already has something:
    markings, rings and stripes can be drawn loosely and clip to the body."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == "." or not (0 <= y + j < len(cv)):
                continue
            if 0 <= x + i < len(cv[0]) and not (onto and cv[y + j][x + i] == "."):
                cv[y + j][x + i] = ch
    return cv


def spans(w, rows, fill, edge=None):
    """Build a part from per-row (start, end) inclusive spans.

    Organic silhouettes - wings, fins, tails, manes - are the one thing that
    is genuinely harder to author as literal rows than as an outline, because
    a single miscounted dot bends the whole curve. Giving the outline and
    letting this fill it keeps those shapes smooth. `edge` traces the first
    and last pixel of every run, which is where a membrane wants its rib.
    A width of None fits the part to its widest span.
    """
    if w is None:
        w = max(s[1] for s in rows if s is not None) + 1
    out = []
    for span in rows:
        line = ["."] * w
        if span is not None:
            x0, x1 = span
            for x in range(x0, x1 + 1):
                line[x] = fill
            if edge:
                line[x0] = line[x1] = edge
        out.append("".join(line))
    return out


def vein(rows, a, b, ch):
    """Draw a line onto a part, for wing ribs and similar tracery.

    Only paints where the part already has something, so a rib can be aimed
    past the rim without spilling into the transparent surround."""
    grid = [list(r) for r in rows]
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        t = i / n if n else 0.0
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t)
        if 0 <= y < len(grid) and 0 <= x < len(grid[y]) and grid[y][x] != ".":
            grid[y][x] = ch
    return ["".join(r) for r in grid]


def rows_of(w, *lines):
    """Literal rows for a part, checked for width so a miscount fails loudly
    at import instead of shearing the sprite."""
    for ln in lines:
        if len(ln) != w:
            raise ValueError("part row is %d wide, expected %d: %r" % (len(ln), w, ln))
    return list(lines)


def sym(*halves):
    """Rows mirrored about the centre: author the left half, get both.

    Faces and bodies are symmetric, and half the characters is half the
    chances to miscount. Anything that must not mirror - the glint in each
    eye sits on the same side, because the light does - is patched after."""
    return [h + h[::-1] for h in halves]


def plume(h, x0, x1, bow, w_max, w_base=2, w_tip=1, peak=0.55):
    """Spans for a curved plume - a tail, a feather, a flame - base at the
    bottom row and tip at the top.

    The centre line runs from x0 at the base to x1 at the tip and bows out by
    `bow`; the width swells from `w_base` to `w_max` at `peak` of the way up
    and closes to `w_tip`. Feed the result to spans()."""
    import math
    out = []
    for y in range(h):
        t = 1 - y / (h - 1)
        cx = x0 + (x1 - x0) * t + bow * math.sin(math.pi * t)
        if t < peak:
            w = w_base + (w_max - w_base) * math.sin(0.5 * math.pi * t / peak)
        else:
            w = w_tip + (w_max - w_tip) * math.cos(
                0.5 * math.pi * (t - peak) / (1 - peak))
        out.append((max(0, int(round(cx - w / 2))), int(round(cx + w / 2))))
    return out


def recolour(rows, band, frm, to):
    """Swap one material for another within a range of rows."""
    out = list(rows)
    for y in range(*band):
        if 0 <= y < len(out):
            out[y] = out[y].replace(frm, to)
    return out


def inset(rows, frm, to, by=1):
    """Recolour the interior of a region, leaving a border `by` pixels wide.

    Used for the inside of an ear, the belly of a shell, the pale core of a
    flame: anything that is the same shape as its container, but smaller."""
    grid = [list(r) for r in rows]
    h, w = len(grid), max(len(r) for r in grid)
    def at(x, y):
        return rows[y][x] if 0 <= y < h and 0 <= x < len(rows[y]) else "."
    for y in range(h):
        for x in range(len(grid[y])):
            if rows[y][x] != frm:
                continue
            if all(at(x + dx, y + dy) == frm
                   for dx in range(-by, by + 1) for dy in range(-by, by + 1)):
                grid[y][x] = to
    return ["".join(r) for r in grid]


def turn(rows):
    """Rotate a part a quarter-turn anticlockwise: what pointed up now points
    left. plume() only grows vertically; this lays one on its side."""
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    return ["".join(rows[j][w - 1 - i] for j in range(len(rows)))
            for i in range(w)]


def pin(cv, rows, anchor, at, flip=False):
    """Stamp a part so that its `anchor` pixel lands on canvas point `at`.

    Composing by anchor - the base of a leaf goes on the crown, the root of a
    tail on the hip - survives resizing a part, and `flip` mirrors it with the
    anchor mirrored too, so a pair of limbs is one call each."""
    ax, ay = anchor
    if flip:
        rows = mirror(rows)
        ax = max(len(r) for r in rows) - 1 - ax
    return stamp(cv, at[0] - ax, at[1] - ay, rows)


def base_of(rows):
    """The anchor at the middle of a part's bottom row: where a plume grows
    from."""
    last = rows[-1]
    xs = [i for i, c in enumerate(last) if c != "."]
    return ((xs[0] + xs[-1]) // 2, len(rows) - 1)


def ellipse(w, h):
    """Spans filling a w x h ellipse: bodies, heads, shells, dishes."""
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    out = []
    for y in range(h):
        t = (y - cy) / (h / 2.0)
        half = (w / 2.0) * max(0.0, 1.0 - t * t) ** 0.5
        a, b = int(round(cx - half + 0.5)), int(round(cx + half - 0.5))
        out.append((a, b) if b >= a else None)
    return out


def tube(cv, path, fill, belly=None, steps=6):
    """Sweep a disc along a path of (x, y, radius) points: serpents, tails,
    tentacles, necks. The radius is interpolated between points, so a body
    can thicken and taper along its length.

    `belly` paints a narrower stripe offset toward the viewer - the pale
    underside of a snake - after the whole body is down, so a coil passing
    in front of itself keeps its underside on the near side."""
    pts = []
    for (x0, y0, r0), (x1, y1, r1) in zip(path, path[1:]):
        n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * steps / 4))
        for i in range(n):
            t = i / n
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t,
                        r0 + (r1 - r0) * t))
    pts.append(path[-1])

    def disc(cx, cy, r, ch, onto=False):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if not (0 <= y < len(cv) and 0 <= x < len(cv[0])):
                    continue
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    if not onto or cv[y][x] != ".":
                        cv[y][x] = ch

    for cx, cy, r in pts:
        disc(cx, cy, r, fill)
    if belly:
        for cx, cy, r in pts:
            if r >= 2.5:
                disc(cx, cy + r * 0.5, r * 0.42, belly, onto=True)
    return cv


def scales(cv, frm, to, period=5, box=None):
    """Draw a diamond scale lattice over one material. Snakes really are
    patterned like this; it is drawn, not a shader texture, so it can be
    confined to the back and kept off the belly."""
    x0, y0, x1, y1 = box or (0, 0, len(cv[0]), len(cv))
    for y in range(y0, y1):
        for x in range(x0, x1):
            if cv[y][x] == frm and ((x + y) % period == 0 or (x - y) % period == 0):
                cv[y][x] = to
    return cv


def feather(length, width, fill, edge="N"):
    """A flight feather pointing right, for stacking into a wing. Its long
    edges are traced in `N`, the wing's crease colour."""
    sp = plume(length, 2, 3, 1, width, w_base=2, peak=0.6)
    return mirror(turn(spans(None, sp, fill, edge=edge)))


def wing(lengths, tones, gap=3, edge="N"):
    """Feathers stacked top to bottom, all rooted at the left edge. The lower
    feather is laid over the one above, and neighbours alternate tone, so
    each one reads on its own instead of the wing fusing into a paddle."""
    cv = canvas(max(lengths) + 2, gap * len(lengths) + 6)
    for i, n in enumerate(lengths):
        fill, tip = tones[i % len(tones)]
        f = feather(n, 6, fill, edge)
        f = [r[:n - 5] + r[n - 5:].replace(fill, tip) for r in f]
        stamp(cv, 0, i * gap, f)
    return finish(cv)


def mirror(rows):
    return ["".join(reversed(r)) for r in rows]


def finish(cv):
    return ["".join(r) for r in cv]


# ===========================================================================
# THE ROSTER
#
# Each creature is a block of parts and a function that stamps them onto a
# 64x64 canvas back to front. Letters are materials, and each block has its
# own material table, so the same letter means different things in
# different creatures - but never two things within one.
# ===========================================================================

_PIXIE_UP = [(8,14),(6,17),(5,19),(4,20),(3,21),(2,21),(2,21),(1,21),(1,21),(1,21),
      (0,21),(0,21),(0,20),(0,20),(0,19),(0,19),(0,18),(0,18),(0,17),(0,17),
      (0,16),(0,15),(0,14),(0,13),(0,12),(0,11),(0,9),(0,7),(0,5),(0,3)]
_PIXIE_WING = spans(22, _PIXIE_UP, "w", "c")
for end in ((13,2),(21,10),(15,22)):
    _PIXIE_WING = vein(_PIXIE_WING, (2,28), end, "v")

_PIXIE_LO = [(0,4),(0,6),(0,9),(0,11),(0,12),(0,13),(0,14),(0,14),(0,15),(0,15),
      (0,14),(1,14),(1,13),(2,12),(3,11),(4,9),(5,8),(6,7)]
_PIXIE_HIND = spans(16, _PIXIE_LO, "w", "c")
for end in ((14,7),(9,16)):
    _PIXIE_HIND = vein(_PIXIE_HIND, (2,1), end, "v")

_PIXIE_HEAD = rows_of(22,
    ".......hhhhhhhh.......",
    ".....hhhhhhhhhhhh.....",
    "...hhHHHHhhhhhhhhh....",
    "..hHHHHHHhhhhhhhhhhh..",
    ".hHHHHHHhhhhhhhhhhhhh.",
    ".hhHHHHhhhhhhhhhhhhhh.",
    "hhhhHHhhhhhhhhhhhhhhhh",
    "hhhhhhhhhhhhhhhhhhhhhh",
    "jhhhaahhhaaaahhhaahhhj",
    "jhhaaaaaaaaaaaaaaaahhj",
    "jhhaaaaaaaaaaaaaaaahhj",
    "jhhakkkkkaaaakkkkkahhj",
    "jhhak+iikaaaak+iikahhj",
    "jhhakiiikaaaakiiikahhj",
    "jhhakiIikaaaakiIikahhj",
    "jhhaakkkaaaaaakkkaahhj",
    "jhhappaaaaaaaaaappahhj",
    "jhhaaaaaaammaaaaaaahhj",
    "jhhhaaaaaaaaaaaaaahhhj",
    "jhhhhaaaaaaaaaaaahhhhj",
    ".jhhhhaaaaaaaaaahhhhj.",
    "..jhhh.aaaaaaaa.hhhj..",
    "...jhj..........jhj...",
)

_PIXIE_SPROUT = rows_of(12,
    "..eE....Ee..",
    ".eEEe..eEEe.",
    ".eEEe..eEEe.",
    "..eee..eee..",
    "....eeee....",
    ".....ee.....",
)

_PIXIE_DRESS = [(12,15),(12,15),(10,17),(10,17),(10,17),(10,17),(10,17),(10,17),
                (10,17),(9,18),(8,19),(7,20),(6,21),(5,22),(4,23),(3,24),(2,25),
                (2,25),(2,25)]
_PIXIE_BODY = spans(28, _PIXIE_DRESS, "d")
_PIXIE_BODY[0] = _PIXIE_BODY[0].replace("d", "a")
_PIXIE_BODY[1] = _PIXIE_BODY[1].replace("d", "a")
_PIXIE_BODY[2] = "..........gggggggg.........."
_PIXIE_BODY[8] = "..........gggggggg.........."
# the hem breaks into petal tips
_PIXIE_BODY[16] = ".." + "g" * 24 + ".."
_PIXIE_BODY[17] = "..ggggg.ggggg..ggggg.ggggg.."
_PIXIE_BODY[18] = "...ggg...ggg....ggg...ggg..."
_PIXIE_BODY = rows_of(28, *_PIXIE_BODY)

_PIXIE_ARM = rows_of(3, "ggg","ggg","ggg","aaa","aaa","aaa",".aa",".aa",".aa","aaa","aaa",".a.")
_PIXIE_LEG = rows_of(4, "aaaa","aaaa","aaaa",".aaa",".aaa",".aaa",".aaa",".aaa",".aaa","bbbb","ssss","ssss","ssss",".sss")


def _pixie():
    cv = canvas(64, 64)
    # back to front: wings, dress and legs, arms, head
    stamp(cv, 38, 2, _PIXIE_WING)
    stamp(cv, 4, 2, mirror(_PIXIE_WING))
    stamp(cv, 40, 30, _PIXIE_HIND)
    stamp(cv, 8, 30, mirror(_PIXIE_HIND))
    stamp(cv, 18, 28, _PIXIE_BODY)
    stamp(cv, 27, 47, _PIXIE_LEG)
    stamp(cv, 33, 47, mirror(_PIXIE_LEG))
    stamp(cv, 36, 31, _PIXIE_ARM)
    stamp(cv, 25, 31, mirror(_PIXIE_ARM))
    stamp(cv, 21, 7, _PIXIE_HEAD)
    stamp(cv, 26, 2, _PIXIE_SPROUT)
    return finish(cv)


PIXIE64 = _pixie()
PIXIE64_MAT = {
    "a": M((250, 222, 196), "skin"), "b": M((226, 188, 162), "skin"),
    "p": M((248, 168, 172), "skin"), "m": M((196, 110, 120), "skin", flat=True),
    "h": M((96, 190, 116), "fur"), "H": M((164, 232, 160), "fur"),
    "j": M((46, 118, 80), "fur"),
    "e": M((70, 160, 96), "plant"), "E": M((132, 214, 120), "plant"),
    "d": M((246, 248, 240), "cloth"), "g": M((92, 176, 120), "cloth"),
    "s": M((84, 150, 110), "cloth"),
    # Wings glow faintly and carry their ribs in a deeper tone of the same
    # hue, so they read as membrane rather than as a second outline.
    "w": M((150, 232, 222), "gem", emissive=0.35),
    "c": M((70, 170, 176), "gem", emissive=0.20),
    "v": M((96, 196, 200), "gem", emissive=0.25),
    "k": M((44, 40, 62), "gem", flat=True),
    "i": M((96, 178, 214), "gem", flat=True),
    "I": M((170, 230, 240), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# KITSUNE (64) - a fox kit sitting up, two brushes swept out behind it with
# the tips already alight. It wears a shrine collar and a bell, because
# something once tried to keep it.
# --------------------------------------------------------------------------
def _brush(h, x0, x1, bow, w_max, w_base, burn):
    """A tail that burns down from its tip: fur, then ember, then flame."""
    sp = plume(h, x0, x1, bow, w_max, w_base=w_base)
    rows = spans(max(b for _, b in sp) + 1, sp, "t")
    rows = inset(rows, "t", "u", 2)
    rows = recolour(rows, (0, burn + 4), "u", "F")
    rows = recolour(rows, (0, burn), "t", "F")
    rows = recolour(rows, (0, burn), "F", "f")
    return recolour(rows, (0, burn // 2), "f", "W")


# One brush curls up behind; the other is wrapped round the front paws, as a
# cat does. Two matching tails either side read as raised arms.
_KITSUNE_TAIL = _brush(42, 2, 12, 9, 16, 5, 9)
_KITSUNE_WRAP = turn(_brush(28, 2, 7, 4, 11, 4, 7))

_KITSUNE_FLAME = rows_of(9,
    "..f......",
    "..ff...f.",
    ".fWf..ff.",
    ".fWf.fWf.",
    "fWWffWWf.",
    "fWWWWWWf.",
    "fWWWWWWff",
    ".fWWWWWf.",
    ".ffWWWff.",
    "..fffff..",
)
_KITSUNE_WISP = rows_of(6, "..f...", ".fWf..", ".fWWf.", "fWWWf.", "fWWWff", ".ffff.")

_KITSUNE_EAR = spans(11, [(8, 8), (7, 9), (6, 9), (5, 10), (5, 10), (4, 10),
                          (3, 10), (3, 10), (2, 10), (1, 10), (1, 10), (0, 10),
                          (0, 10), (0, 10), (0, 10)], "a")
_KITSUNE_EAR = inset(_KITSUNE_EAR, "a", "i", 1)
_KITSUNE_EAR = recolour(_KITSUNE_EAR, (0, 4), "a", "b")
_KITSUNE_EAR = recolour(_KITSUNE_EAR, (0, 4), "i", "b")

_KITSUNE_HEAD = sym(
    "..........aaaaa",
    ".......aaaaaaaa",
    ".....aaaaaaaaar",
    "....aaaaaaaaarR",
    "...aaaaaaaaaaar",
    "..aaaaaaaaaaaaa",
    ".aaaaaaaaaaaaaa",
    ".aaaaaaaaaaaaaa",
    "aaaaakkkkaaaaaa",
    "aaaak++yykaaaaa",
    "aaaak++yykaaaaa",
    "maaakyyyykaaaaa",
    "mmaakyIIykaaaaa",
    "mmaaaakkkkaaaaa",
    "mmmaaaaaaaammmn",
    "mmaaapppaammmmm",
    ".maaaaaaammmmmq",
    "..maaaaaammmmmm",
    "...aaaaaammmmmm",
    ".....aaaammmmmm",
    "......aaammmmmm",
    "........aammmmm",
    "..........ammmm",
)
for _y in (9, 10):
    _KITSUNE_HEAD[_y] = _KITSUNE_HEAD[_y][:20] + "k++yyk" + _KITSUNE_HEAD[_y][26:]
_KITSUNE_HEAD = rows_of(30, *_KITSUNE_HEAD)

_KITSUNE_COLLAR = sym(
    "cccccccc",
    ".ccccccc",
    "......gg",
    ".....ggG",
    ".....ggg",
    "......gk",
)

_KITSUNE_BODY = spans(28, [(8, 19), (7, 20), (6, 21), (5, 22), (5, 22), (4, 23),
                           (4, 23), (3, 24), (3, 24), (3, 24), (2, 25), (2, 25),
                           (2, 25), (2, 25), (2, 25), (2, 25), (3, 24), (3, 24),
                           (4, 23), (5, 22)], "a")
_KITSUNE_RUFF = spans(28, [None, None, (10, 17), (9, 18), (9, 18), (9, 18),
                           (10, 17), (10, 17), (11, 16), (11, 16), (12, 15),
                           (12, 15), (13, 14)], "m")

_KITSUNE_LEG = rows_of(5,
    ".lll.", "lllll", "lllll", "lllll", "lllll", "lllll", "lllll", "lllll",
    "lllll", "lllll", "mmmmm", "mmmmm", "mmmmm", ".m.m.",
)
_KITSUNE_HAUNCH = rows_of(9,
    "...bbb...", ".bbbbbbb.", "bbbbbbbbb", "bbbbbbbbb", "bbbbbbbbb",
    "bbbbbbbbb", "bbbbbbbbb", ".bbbbbbbb", "..mmmmmmm", "...mmmmm.",
)


def _kitsune():
    cv = canvas(64, 64)
    stamp(cv, 38, 12, _KITSUNE_TAIL)
    stamp(cv, 46, 3, _KITSUNE_FLAME)
    stamp(cv, 16, 50, _KITSUNE_HAUNCH)
    stamp(cv, 39, 50, mirror(_KITSUNE_HAUNCH))
    stamp(cv, 18, 38, _KITSUNE_BODY)
    stamp(cv, 18, 38, _KITSUNE_RUFF)
    stamp(cv, 24, 46, _KITSUNE_LEG)
    stamp(cv, 35, 46, mirror(_KITSUNE_LEG))
    stamp(cv, 35, 3, _KITSUNE_EAR)
    stamp(cv, 18, 3, mirror(_KITSUNE_EAR))
    stamp(cv, 17, 14, _KITSUNE_HEAD)
    stamp(cv, 24, 36, _KITSUNE_COLLAR)
    stamp(cv, 1, 48, _KITSUNE_WRAP)
    stamp(cv, 2, 43, _KITSUNE_WISP)
    return finish(cv)


KITSUNE64 = _kitsune()
KITSUNE64_MAT = {
    "a": M((244, 146, 62), "fur"), "b": M((206, 98, 46), "fur"),
    "l": M((240, 140, 60), "fur"),
    "t": M((232, 124, 52), "fur"), "u": M((250, 176, 96), "fur"),
    "m": M((252, 244, 232), "fur", over="a"), "i": M((246, 176, 180), "skin"),
    "p": M((250, 128, 110), "skin", over="a"),
    "n": M((58, 36, 40), "gem", flat=True),
    "q": M((150, 70, 60), "skin", flat=True),
    "r": M((232, 58, 44), "gem", emissive=0.55),
    "R": M((255, 190, 90), "gem", emissive=0.9),
    "f": M((255, 150, 60), "gem", emissive=0.85),
    "F": M((255, 104, 44), "gem", emissive=0.7),
    "W": M((255, 244, 200), "gem", emissive=1.0),
    "c": M((204, 44, 52), "cloth"),
    "g": M((236, 190, 70), "metal"), "G": M((255, 244, 190), "metal"),
    "k": M((52, 30, 34), "gem", flat=True),
    "y": M((236, 150, 40), "gem", flat=True),
    "I": M((255, 214, 120), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# MANDRAKE (64) - pulled up mid-scream: eyes screwed shut, arms flung up,
# leaves standing on end. The rings round its middle are how old it is.
# --------------------------------------------------------------------------
def _leaf(h, x0, x1, bow, w, fill, rib):
    sp = plume(h, x0, x1, bow, w, w_base=2, peak=0.45)
    rows = spans(max(b for _, b in sp) + 1, sp, fill)
    return vein(rows, (sp[-1][0] + (sp[-1][1] - sp[-1][0]) // 2, h - 1),
                (sp[1][0] + (sp[1][1] - sp[1][0]) // 2, 1), rib)


# Neighbouring leaves alternate tone, or the crown fuses into one green blob.
_MANDRAKE_LEAF_MID = _leaf(22, 4, 5, 0, 8, "g", "v")
_MANDRAKE_LEAF_IN = _leaf(20, 3, 12, 2, 8, "G", "V")
_MANDRAKE_LEAF_OUT = _leaf(15, 2, 16, 1, 7, "g", "v")

_MANDRAKE_ROOT = spans(32, [
    (12, 19), (9, 22), (7, 24), (5, 26), (4, 27), (3, 28), (2, 29), (1, 30),
    (1, 30), (1, 30), (1, 30), (1, 30), (1, 30), (1, 30), (1, 30), (1, 30),
    (2, 29), (2, 29), (3, 28), (4, 27), (5, 26), (6, 25), (7, 24), (8, 23),
    (9, 22), (10, 21), (11, 20), (12, 19)], "a")

_MANDRAKE_FACE = sym(
    "................",
    "....kk..........",
    ".....kkk........",
    ".......kkk......",
    ".....kkk........",
    "....kk..........",
    "...ppp.....qqqqq",
    "..pppp...qqqqqqq",
    "........qqqqqqqq",
    "........qqqqqqqq",
    "........qqqqqqqq",
    "........qqqqttTT",
    ".........qqttttt",
    "..........qqqttt",
    "............qqqq",
)
# growth rings, drawn as arcs that follow the root's curve
_MANDRAKE_RINGS = sym(
    "................",
    "..rr............",
    "....rrrr........",
    "........rrrrrrrr",
    "................",
    "................",
    "......rr........",
    "........rrrrrrrr",
)
_MANDRAKE_ARM = spans(9, plume(12, 1, 6, 1, 4, w_base=3), "a")
_MANDRAKE_FINGERS = rows_of(7, "a..a..a", ".a.a.a.", "..aaa..")
_MANDRAKE_LEG = spans(10, [(4, 9), (4, 9), (3, 8), (3, 8), (2, 7), (2, 7),
                           (2, 6), (1, 6), (1, 5), (1, 5), (0, 4), (0, 3),
                           (0, 2), (0, 1)], "b")
_MANDRAKE_HAIR = rows_of(4, "h...", ".h..", "..hh")


def _mandrake():
    cv = canvas(64, 64)
    crown = (31, 23)
    for part, dx in ((_MANDRAKE_LEAF_OUT, 3), (_MANDRAKE_LEAF_IN, 2)):
        pin(cv, part, base_of(part), (crown[0] + dx, crown[1]))
        pin(cv, part, base_of(part), (crown[0] + 1 - dx, crown[1]), flip=True)
    pin(cv, _MANDRAKE_LEAF_MID, base_of(_MANDRAKE_LEAF_MID), crown)
    pin(cv, _MANDRAKE_ARM, base_of(_MANDRAKE_ARM), (46, 36))
    pin(cv, _MANDRAKE_ARM, base_of(_MANDRAKE_ARM), (17, 36), flip=True)
    stamp(cv, 48, 22, _MANDRAKE_FINGERS)
    stamp(cv, 9, 22, mirror(_MANDRAKE_FINGERS))
    stamp(cv, 22, 46, _MANDRAKE_LEG)
    stamp(cv, 32, 46, mirror(_MANDRAKE_LEG))
    stamp(cv, 16, 20, _MANDRAKE_ROOT)
    stamp(cv, 16, 26, _MANDRAKE_FACE)
    stamp(cv, 16, 40, _MANDRAKE_RINGS, onto=True)
    stamp(cv, 15, 34, _MANDRAKE_HAIR)
    stamp(cv, 43, 36, mirror(_MANDRAKE_HAIR))
    stamp(cv, 29, 20, rows_of(6, "nnnnnn", ".nnnn."))
    return finish(cv)


MANDRAKE64 = _mandrake()
MANDRAKE64_MAT = {
    "a": M((238, 214, 160), "plant"), "b": M((214, 184, 124), "plant"),
    "r": M((196, 160, 104), "plant", over="a"),
    "h": M((176, 146, 96), "plant"),
    "n": M((112, 150, 70), "plant"),
    "g": M((70, 152, 76), "plant"), "v": M((136, 200, 104), "plant", over="g"),
    "G": M((122, 194, 88), "plant"), "V": M((186, 230, 136), "plant", over="G"),
    "k": M((66, 44, 38), "gem", flat=True),
    "q": M((70, 30, 40), "gem", flat=True),
    "t": M((230, 104, 118), "skin"), "T": M((250, 150, 160), "skin"),
    "p": M((246, 160, 150), "skin", over="a"),
}

# --------------------------------------------------------------------------
# KAPPA (64) - a river imp holding up a cucumber like a prize. The water in
# the dish on its head has frozen over; spill it and a kappa loses its
# strength, which is why it never bows.
# --------------------------------------------------------------------------
_KAPPA_DISH = rows_of(18,
    "....dddddddddd....",
    "..ddwwwwwwwwwwdd..",
    ".dwwWWwwwwwfwwwwd.",
    "dwwWWwwwwwwwwwwwwd",
    "ddwwwwwwfwwwwwwwdd",
    ".dddwwwwwwwwwwddd.",
    "...dddddddddddd...",
)
_KAPPA_HEAD = sym(
    "........hhhhhh",
    ".....hhhhhhhhh",
    "...hhhhhhhhhhh",
    "..hhhhhhhhhhhh",
    ".hhhhhhhhhhhhh",
    ".hhhhhhhhhhhhh",
    ".hhhhhhhhhhhhh",
    "hhhahhhahhhahh",
    "hhaaahaaahaaaa",
    "hhaaaaaaaaaaaa",
    "hhaaaaaaaaaaaa",
    "hhaakkkkaaaaaa",
    "hhak++iikaaaaa",
    "hhak++iikaaaaa",
    "hhakiiiikaaaaa",
    "hhakiIIikaaaaa",
    "hhaakkkkaaaaaa",
    "hhapppaaaaaayy",
    "hhaaaaaaaaayYy",
    ".haaaaaaaaaqqq",
    "..aaaaaaaaaayy",
    "...aaaaaaaaaaa",
    "....aaaaaaaaaa",
    "......aaaaaaaa",
    ".........aaaaa",
)
for _y in (12, 13):
    _KAPPA_HEAD[_y] = _KAPPA_HEAD[_y][:19] + "k++iik" + _KAPPA_HEAD[_y][25:]
_KAPPA_HEAD = rows_of(28, *_KAPPA_HEAD)

_KAPPA_SHELL = spans(34, [(8, 25), (5, 28), (3, 30), (2, 31), (1, 32), (1, 32)]
                     + [(0, 33)] * 12 + [(1, 32), (3, 30)], "s")
_KAPPA_SCUTES = rows_of(34,
    "..................................",
    "......S....................S......",
    ".....S......................S.....",
    "SSSSS........................SSSSS",
    "....S........................S....",
    "....S........................S....",
    "....S........................S....",
    "...S..........................S...",
    "SSS............................SSS",
    "...S..........................S...",
    "....S........................S....",
    "....S........................S....",
    "....S........................S....",
    "SSSSS........................SSSSS",
    ".....S......................S.....",
)
_KAPPA_TORSO = spans(22, [(6, 15), (4, 17), (3, 18), (2, 19), (2, 19)]
                     + [(1, 20)] * 10 + [(2, 19), (3, 18), (4, 17), (6, 15)], "a")
_KAPPA_PLASTRON = spans(22, [None, (7, 14), (6, 15), (5, 16), (5, 16), (5, 16),
                             (5, 16), (5, 16), (5, 16), (5, 16), (5, 16), (5, 16),
                             (5, 16), (5, 16), (6, 15), (7, 14), (8, 13)], "p")
for _y in (5, 9, 13):
    _KAPPA_PLASTRON[_y] = _KAPPA_PLASTRON[_y].replace("p", "P")
_KAPPA_PLASTRON[3] = _KAPPA_PLASTRON[3][:10] + "PP" + _KAPPA_PLASTRON[3][12:]

# raised up and out to the side, clear of the head
_KAPPA_ARM_UP = spans(None, [(i * 5 // 4, i * 5 // 4 + 4) for i in range(10)], "l")
_KAPPA_ARM_DOWN = rows_of(5,
    ".lll.", "lllll", "lllll", "lllll", ".llll", ".llll", ".llll", ".llll",
    ".llll", ".llll", "bbbbb", "b.b.b",
)
_KAPPA_HAND_UP = rows_of(6, "b.b.b.", "bbbbbb", ".bbbbb", "..bbb.")
_KAPPA_CUCUMBER = rows_of(7,
    "..nn...",
    ".cccc..",
    "cCcccc.",
    "ccccCc.",
    "cCcccc.",
    "cccccc.",
    "ccCccc.",
    "cccccC.",
    "cCcccc.",
    "ccccCc.",
    "cccccc.",
    "cCcccc.",
    ".cccc..",
    "..cc...",
)
_KAPPA_LEG = rows_of(8,
    ".aaaaa..", ".aaaaa..", ".aaaaa..", ".aaaaa..", "..aaaa..",
    "..aaaa..", ".bbbbbb.", "bbbbbbbb", "b.bb.bb.",
)


def _kappa():
    cv = canvas(64, 64)
    stamp(cv, 15, 30, _KAPPA_SHELL)
    stamp(cv, 15, 31, _KAPPA_SCUTES, onto=True)
    stamp(cv, 22, 49, _KAPPA_LEG)
    stamp(cv, 34, 49, mirror(_KAPPA_LEG))
    stamp(cv, 11, 24, _KAPPA_ARM_UP)
    stamp(cv, 21, 31, _KAPPA_TORSO)
    stamp(cv, 21, 31, _KAPPA_PLASTRON, onto=True)
    stamp(cv, 42, 34, _KAPPA_ARM_DOWN)
    stamp(cv, 7, 7, _KAPPA_CUCUMBER)
    stamp(cv, 8, 20, _KAPPA_HAND_UP)
    stamp(cv, 18, 7, _KAPPA_HEAD)
    stamp(cv, 23, 3, _KAPPA_DISH)
    return finish(cv)


KAPPA64 = _kappa()
KAPPA64_MAT = {
    "a": M((132, 200, 124), "scale"), "b": M((104, 176, 110), "scale"),
    "l": M((126, 194, 120), "scale"),
    "h": M((52, 118, 104), "fur"),
    "s": M((112, 120, 64), "scale"), "S": M((78, 84, 46), "scale", over="s"),
    "p": M((236, 222, 150), "scale", over="a"),
    "P": M((196, 178, 108), "scale", over="a"),
    "y": M((244, 206, 96), "scale"), "Y": M((255, 238, 170), "scale"),
    "q": M((140, 96, 52), "scale", flat=True),
    "d": M((228, 222, 206), "stone"),
    "w": M((150, 214, 246), "gem", emissive=0.3),
    "W": M((226, 248, 255), "gem", emissive=0.6),
    "f": M((255, 255, 255), "gem", emissive=0.7),
    "c": M((62, 138, 66), "plant"), "C": M((150, 206, 110), "plant", over="c"),
    "n": M((240, 212, 80), "plant"),
    "k": M((30, 40, 52), "gem", flat=True),
    "i": M((70, 150, 210), "gem", flat=True),
    "I": M((150, 214, 246), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# WISP (64) - a grave-light: fire burning violet at the edges and white at
# the heart, trailing the tail a hitodama leaves when it moves. The face is
# the hollow in the middle where something used to be.
# --------------------------------------------------------------------------
def _flame(sp, *layers):
    """Concentric flame: each layer is the last one shrunk by `by` pixels."""
    rows = spans(None, sp, layers[0][0])
    for (prev, _), (mat, by) in zip(layers, layers[1:]):
        rows = inset(rows, prev, mat, by)
    return rows


_WISP_BODY = _flame(plume(44, 15, 16, 2, 30, w_base=8, peak=0.32),
                    ("o", 0), ("f", 2), ("y", 3), ("W", 2))
_WISP_TONGUE = _flame(plume(20, 2, 9, 2, 8, w_base=4), ("o", 0), ("f", 1), ("y", 2))
_WISP_TAIL = _flame(plume(18, 3, 11, 3, 9, w_base=6), ("o", 0), ("f", 2), ("y", 2))[::-1]
_WISP_FACE = rows_of(18,
    "....aaaaaaaaaa....",
    "..aaaaaaaaaaaaaa..",
    ".aaaaaaaaaaaaaaaa.",
    ".aaakkkaaaakkkaaa.",
    "aaakkkkkaakkkkkaaa",
    "aaakkKkkaakkKkkaaa",
    "aaaakkkaaaakkkaaaa",
    "aaaaaaaaaaaaaaaaaa",
    "aakaaaaaaaaaaaakaa",
    "aakkaaaaaaaaaakkaa",
    "aaakkkkkkkkkkkkaaa",
    ".aaakkkkkkkkkkaaa.",
    "..aaaakkkkkkaaaa..",
    "....aaaaaaaaaa....",
)
_WISP_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _wisp():
    cv = canvas(64, 64)
    pin(cv, _WISP_TONGUE, base_of(_WISP_TONGUE), (43, 26))
    pin(cv, _WISP_TONGUE, base_of(_WISP_TONGUE), (20, 26), flip=True)
    stamp(cv, 26, 42, _WISP_TAIL)
    pin(cv, _WISP_BODY, base_of(_WISP_BODY), (31, 47))
    stamp(cv, 23, 22, _WISP_FACE)
    for x, y in ((4, 20), (56, 6), (6, 40), (55, 44), (47, 56)):
        stamp(cv, x, y, _WISP_SPARK)
    return finish(cv)


WISP64 = _wisp()
WISP64_MAT = {
    "o": M((150, 60, 170), "flame", emissive=0.45),
    "f": M((240, 96, 120), "flame", emissive=0.6),
    "y": M((255, 178, 84), "flame", emissive=0.8),
    "W": M((255, 240, 196), "flame", emissive=1.0),
    "a": M((52, 26, 70), "cloth"),
    "k": M((255, 226, 150), "gem", flat=True),
    "K": M((255, 255, 240), "gem", flat=True),
    "s": M((255, 170, 110), "gem", flat=True, outline=False),
    "S": M((255, 250, 220), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# THUNDERBIRD (64) - a storm chick, far too pleased with itself: one wing
# flexed higher than the other, eyes half-shut, one brow up. The crest is
# not a feather.
# --------------------------------------------------------------------------
_TBIRD_WING = wing([19, 22, 21, 18, 15], [("b", "n"), ("d", "N")])
_TBIRD_COVERT = spans(None, ellipse(9, 11), "B")
_TBIRD_BODY = spans(32, ellipse(32, 30), "a")
_TBIRD_CHEST = spans(32, [None] * 16 + [(9, 22), (8, 23), (7, 24), (7, 24),
                                        (7, 24), (8, 23), (9, 22), (10, 21),
                                        (12, 19)], "c")
_TBIRD_FACE = rows_of(32,
    "....................kkkk........",
    "........kkkk....................",
    "................................",
    ".......kkkkkk......kkkkkk.......",
    ".......kiiiik......kiiiik.......",
    ".......k+iiik......k+iiik.......",
    "........kkkk........kkkk........",
    "......ppp..............ppp......",
    "..............yyyy..............",
    ".............yYyyyy.............",
    "..............yyyq..............",
)
_TBIRD_BOLT = rows_of(8,
    "....zzzz",
    "...zzzz.",
    "..zZzz..",
    ".zzZzzzz",
    "....zZz.",
    "...zzz..",
    "..zzz...",
    ".zz.....",
    "z.......",
)
_TBIRD_TAIL = rows_of(12,
    "b.....b.....",
    "bb...bb...b.",
    ".bb.bbb..bb.",
    "..bbbbbbbb..",
    "...bbbbbb...",
)
_TBIRD_FOOT = rows_of(7, "..oo...", "..oo...", ".oooo..", "o.o.o..")
_TBIRD_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _thunderbird():
    cv = canvas(64, 64)
    stamp(cv, 26, 52, _TBIRD_TAIL)
    # the right wing is flexed up; the left hangs lower and more relaxed
    stamp(cv, 40, 14, _TBIRD_WING)
    stamp(cv, 40, 24, _TBIRD_COVERT)
    left = mirror(_TBIRD_WING)
    stamp(cv, 24 - len(left[0]), 26, left)
    stamp(cv, 15, 32, mirror(_TBIRD_COVERT))
    stamp(cv, 24, 55, _TBIRD_FOOT)
    stamp(cv, 34, 55, mirror(_TBIRD_FOOT))
    stamp(cv, 16, 24, _TBIRD_BODY)
    stamp(cv, 16, 24, _TBIRD_CHEST, onto=True)
    stamp(cv, 16, 30, _TBIRD_FACE, onto=True)
    stamp(cv, 29, 16, _TBIRD_BOLT)
    for x, y in ((24, 12), (40, 9), (37, 19)):
        stamp(cv, x, y, _TBIRD_SPARK)
    return finish(cv)


THUNDERBIRD64 = _thunderbird()
THUNDERBIRD64_MAT = {
    "a": M((252, 222, 110), "fur"), "c": M((255, 244, 200), "fur", over="a"),
    "b": M((64, 106, 200), "fur"), "B": M((110, 160, 240), "fur"),
    "n": M((40, 60, 140), "fur"),
    "d": M((84, 130, 224), "fur"), "N": M((52, 78, 166), "fur"),
    "y": M((250, 150, 50), "scale", over="a"),
    "Y": M((255, 206, 120), "scale", over="a"),
    "q": M((150, 80, 30), "scale", flat=True),
    "o": M((250, 150, 50), "scale"),
    "z": M((255, 250, 170), "gem", emissive=0.9),
    "Z": M((255, 255, 255), "gem", emissive=1.0),
    "p": M((250, 160, 120), "skin", over="a"),
    "k": M((50, 36, 30), "gem", flat=True),
    "i": M((80, 140, 230), "gem", flat=True),
    "+": GLINT,
    "s": M((200, 230, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# ANUBIS (64) - the boss. Jackal-headed, sun at his back, sceptre in one
# hand and the scales in the other. The heart in the low pan is yours; it
# weighs more than the feather, and so the fight begins.
# --------------------------------------------------------------------------
_ANUBIS_HALO = inset(spans(None, ellipse(32, 32), "h"), "h", ".", 2)

# jackal ears: tall, narrow and upright - short ones read as a cat
_ANUBIS_EAR = spans(None, [(3, 3), (3, 3), (2, 4), (2, 4), (2, 4), (2, 5),
                           (1, 5), (1, 5), (1, 5), (1, 6), (1, 6), (0, 6),
                           (0, 6), (0, 6), (0, 6), (0, 6), (0, 6)], "a")
_ANUBIS_EAR = inset(_ANUBIS_EAR, "a", "i", 1)

_ANUBIS_HEAD = sym(
    "...aaaaaa",
    "..aaaaaaa",
    ".aaaaaaaa",
    ".aaaaaaaa",
    "aaaaaaaaa",
    "aakkkkaaa",
    "kkeeEkaaa",
    "akeeekaaa",
    "aakkkaaaa",
    "aaaaaaaaa",
    ".aaaaaaAA",
    ".aaaaaaAA",
    "..aaaaaAA",
    "...aaaaAA",
    "...aaaaAA",
    "....aaaAA",
    "....aaaAn",
    ".....aaAq",
    ".....aaAA",
    "......aaa",
)
_ANUBIS_HEAD = rows_of(18, *_ANUBIS_HEAD)

# striped lappets hang from behind the ears to frame the face
_ANUBIS_LAPPET = rows_of(4, *[("gggg" if (y // 2) % 2 == 0 else "llll")
                              for y in range(18)])

# the usekh: a crescent collar in bands of gold, turquoise and lapis
_ANUBIS_COLLAR = spans(28, ellipse(28, 18)[9:], "g")
_ANUBIS_COLLAR = [r.replace("g", "gttlggtt."[min(y, 8)]) for y, r in
                  enumerate(_ANUBIS_COLLAR)]

_ANUBIS_TORSO = spans(22, [(2, 19)] * 3 + [(3, 18)] * 5 + [(4, 17)] * 6
                      + [(5, 16)] * 3, "a")
_ANUBIS_KILT = spans(24, [(4, 19), (4, 19), (3, 20), (3, 20), (2, 21), (2, 21),
                          (1, 22), (1, 22), (1, 22), (0, 23), (0, 23)], "w")
_ANUBIS_KILT[0] = _ANUBIS_KILT[1] = "...." + "g" * 16 + "...."
_ANUBIS_KILT = [r[:8] + r[8:16].replace("w", "W") + r[16:] if 2 <= y else r
                for y, r in enumerate(_ANUBIS_KILT)]
_ANUBIS_KILT = [r[:11] + r[11:13].replace("W", "g") + r[13:] for r in _ANUBIS_KILT]
_ANUBIS_LEG = rows_of(5,
    "aaaaa", "aaaaa", "aaaaa", ".aaaa", ".aaaa", ".aaaa", ".gggg", ".aaaa",
    "ggggg", "ggggg",
)
_ANUBIS_ARM_R = rows_of(5,
    "bbbb.", "bbbbb", "bbbbb", "bbbbb", ".bbbb", ".bbbb", ".gggg", ".gggg",
    ".bbbb", ".bbbb", "bbbbb", "bbbbb",
)
# the scale arm reaches out and down to the side
_ANUBIS_ARM_L = spans(None, [(9, 13), (8, 13), (6, 12), (5, 11), (4, 10),
                             (3, 9), (2, 7), (1, 6), (1, 6), (0, 5)], "b")
_ANUBIS_ARM_L = recolour(_ANUBIS_ARM_L, (6, 8), "b", "g")
_ANUBIS_SCALES = rows_of(21,
    "..........g..........",
    "..........g..........",
    "..........G..........",
    ".ggggggggggggggggggg.",
    "..c...............c..",
    "..c..............c...",
    "..c.............c....",
    "..c............c.....",
    "..c..........ffc.....",
    "..c.........fFfcc....",
    "..c........ggffggg...",
    "..c.........ggggg....",
    ".rrc.................",
    "rrrrr................",
    "grrrgg...............",
    "gggggg...............",
    ".gggg................",
)
_ANUBIS_STAFF = rows_of(7,
    "ggggg..",
    "gGgggg.",
    "...ggg.",
    "...gg..",
    "...gg..",
) + ["...gg.."] * 50 + ["..gggg.", "..g..g.", "..g..g."]


def _anubis():
    cv = canvas(64, 64)
    stamp(cv, 16, 1, _ANUBIS_HALO)
    stamp(cv, 23, 0, _ANUBIS_EAR)
    stamp(cv, 34, 0, mirror(_ANUBIS_EAR))
    stamp(cv, 22, 49, _ANUBIS_LEG)
    stamp(cv, 37, 49, mirror(_ANUBIS_LEG))
    stamp(cv, 21, 31, _ANUBIS_TORSO)
    stamp(cv, 20, 42, _ANUBIS_KILT)
    stamp(cv, 42, 32, _ANUBIS_ARM_R)
    stamp(cv, 43, 1, _ANUBIS_STAFF)
    stamp(cv, 9, 31, _ANUBIS_ARM_L)
    stamp(cv, 19, 13, _ANUBIS_LAPPET)
    stamp(cv, 41, 13, _ANUBIS_LAPPET)
    stamp(cv, 18, 28, _ANUBIS_COLLAR)
    stamp(cv, 23, 11, _ANUBIS_HEAD)
    stamp(cv, 0, 38, _ANUBIS_SCALES)
    return finish(cv)


ANUBIS64 = _anubis()
ANUBIS64_MAT = {
    "a": M((46, 40, 58), "fur"), "A": M((64, 56, 78), "fur"),
    "b": M((52, 46, 66), "fur"),
    "n": M((20, 16, 26), "gem", flat=True), "q": M((120, 60, 70), "skin", flat=True),
    # gold takes a brown outline; derived, it shifts toward blue and turns green
    "g": M((232, 186, 76), "metal", outline=(84, 54, 26)),
    "G": M((255, 238, 170), "metal", outline=(84, 54, 26)),
    "i": M((150, 110, 60), "fur"),
    "l": M((42, 70, 168), "cloth", outline=(20, 24, 60)),
    "t": M((70, 186, 178), "gem", outline=(20, 50, 56)),
    "w": M((238, 234, 218), "cloth"), "W": M((214, 208, 190), "cloth", over="w"),
    "k": M((16, 14, 22), "gem", flat=True),
    "e": M((255, 214, 100), "gem", flat=True), "E": M((255, 255, 230), "gem", flat=True),
    "h": M((255, 222, 140), "gem", flat=True, outline=False),
    "c": M((200, 160, 70), "metal", outline=False),
    "r": M((210, 50, 60), "skin"), "f": M((250, 250, 244), "cloth"),
    "F": M((210, 220, 236), "cloth"),
}

# --------------------------------------------------------------------------
# GOLEM (64) - a temple guardian of stacked riverstone, knuckles down like
# a gorilla, head sunk between its shoulders. Moss has had a long time to
# settle on it, and something has taken root on top.
# --------------------------------------------------------------------------
def _stone(w, h, fill):
    return spans(w, ellipse(w, h), fill)


_GOLEM_TORSO = _stone(34, 30, "a")
_GOLEM_RUNE = rows_of(10,
    "....rr....",
    "...rRRr...",
    "..rr..rr..",
    ".rr.rr.rr.",
    "rr.rRRr.rr",
    ".rr.rr.rr.",
    "..rr..rr..",
    "...rRRr...",
    "....rr....",
)
_GOLEM_HEAD = spans(16, [(3, 12), (1, 14), (0, 15), (0, 15), (0, 15), (0, 15),
                         (0, 15), (0, 15), (0, 15), (1, 14), (2, 13), (4, 11)], "h")
_GOLEM_HEAD[4] = "hheeeeehheeeeehh"
_GOLEM_HEAD[5] = "hhhEeeehheeeEhhh"
_GOLEM_HEAD = rows_of(16, *_GOLEM_HEAD)
_GOLEM_SHOULDER = _stone(15, 13, "b")
_GOLEM_MOSS = rows_of(15,
    "....mmmmmm.....",
    "..mmMmmmmMmm...",
    ".mmmmmMmmmmmm..",
    "mm.mm..mmm.mmm.",
    "m...m...m...m..",
)
_GOLEM_UPPER = _stone(10, 14, "d")
_GOLEM_FORE = _stone(11, 11, "b")
_GOLEM_FIST = _stone(17, 13, "a")
_GOLEM_KNUCKLES = rows_of(17,
    ".................",
    ".................",
    "...c...c...c.....",
    "...c...c...c.....",
    "....c...c...c....",
)
_GOLEM_LEG = spans(12, [(2, 9), (1, 10), (0, 11), (0, 11), (0, 11), (0, 11),
                        (0, 11), (0, 11), (0, 11), (0, 11), (0, 11)], "d")
_GOLEM_SPROUT = rows_of(9,
    ".gg...gg.",
    "gGGg.gGGg",
    ".gGgggGg.",
    "...gng...",
    "....n....",
    "....n....",
)


def _golem():
    cv = canvas(64, 64)
    stamp(cv, 19, 47, _GOLEM_LEG)
    stamp(cv, 33, 47, _GOLEM_LEG)
    stamp(cv, 15, 17, _GOLEM_TORSO)
    stamp(cv, 26, 27, _GOLEM_RUNE, onto=True)
    # cracks in the stone; vein() only marks pixels that are already body
    for a, b in (((18, 24), (23, 30)), ((23, 30), (21, 36)),
                 ((44, 34), (40, 40)), ((40, 40), (42, 44))):
        for y, row in enumerate(vein(finish(cv), a, b, "c")):
            cv[y][:] = row
    stamp(cv, 5, 24, _GOLEM_UPPER)
    stamp(cv, 49, 24, _GOLEM_UPPER)
    stamp(cv, 3, 34, _GOLEM_FORE)
    stamp(cv, 50, 34, _GOLEM_FORE)
    stamp(cv, 0, 43, _GOLEM_FIST)
    stamp(cv, 47, 43, mirror(_GOLEM_FIST))
    stamp(cv, 0, 43, _GOLEM_KNUCKLES, onto=True)
    stamp(cv, 47, 43, mirror(_GOLEM_KNUCKLES), onto=True)
    stamp(cv, 6, 15, _GOLEM_SHOULDER)
    stamp(cv, 43, 15, _GOLEM_SHOULDER)
    stamp(cv, 6, 14, _GOLEM_MOSS)
    stamp(cv, 43, 14, mirror(_GOLEM_MOSS))
    stamp(cv, 24, 11, _GOLEM_HEAD)
    stamp(cv, 27, 5, _GOLEM_SPROUT)
    return finish(cv)


GOLEM64 = _golem()
GOLEM64_MAT = {
    # riverstones are never one grey: each piece a slightly different rock
    "a": M((126, 138, 154), "stone"), "b": M((158, 150, 138), "stone"),
    "d": M((108, 114, 128), "stone"), "h": M((146, 154, 150), "stone"),
    "c": M((80, 86, 100), "stone", over="a"),
    "r": M((110, 230, 220), "gem", emissive=0.7, over="a"),
    "R": M((220, 255, 250), "gem", emissive=0.9, over="a"),
    "e": M((120, 240, 230), "gem", flat=True), "E": M((240, 255, 255), "gem", flat=True),
    "m": M((96, 150, 72), "plant"), "M": M((150, 196, 96), "plant"),
    "g": M((100, 180, 80), "plant"), "G": M((170, 220, 120), "plant"),
    "n": M((110, 130, 60), "plant"),
}

# --------------------------------------------------------------------------
# NAGA (64) - serpent priestess of the cold springs, risen out of her own
# coils with a cobra's hood spread behind her. She keeps the spring's
# frost in a bead of ice between her hands.
# --------------------------------------------------------------------------
# The hood flares wider than the hair, or it vanishes behind it.
def _hood():
    """An ellipse whose lower half narrows to the neck: a spade, not a disc."""
    out = []
    for y, sp in enumerate(ellipse(40, 32)):
        if sp and y > 12:
            t = (y - 12) / 19.0
            a, b = sp
            pull = int(round((b - a - 12) * 0.5 * t * t))
            sp = (a + pull, b - pull)
        out.append(sp)
    return spans(40, out, "o")


_NAGA_HOOD = _hood()
_NAGA_HOOD = inset(_NAGA_HOOD, "o", "O", 2)
# the spectacle marking, where it shows either side of the hair
_NAGA_MARK = [h + "." * 28 + h[::-1] for h in
              ("...qq.", "..qQQq", "..qQQq", "...qq.")]
_NAGA_HAIR = spans(26, ellipse(26, 24), "h")
_NAGA_HAIR = [r[:5] + r[5:12].replace("h", "H") + r[12:] if 3 <= y <= 8 else r
              for y, r in enumerate(_NAGA_HAIR)]
# long locks falling over the shoulders, in front of the hood
_NAGA_LOCK = spans(None, [(1, 4), (1, 4), (0, 4), (0, 4), (0, 4), (0, 4), (0, 4),
                          (0, 4), (0, 4), (0, 4), (1, 4), (1, 4), (1, 4), (1, 3),
                          (1, 3), (2, 3), (2, 3), (2, 2)], "h")
_NAGA_FACE = sym(
    "....aaaa",
    "...aaaaa",
    "..aaaaaa",
    "..aaaaaa",
    "..kkkkaa",
    ".k++iika",
    ".k++iika",
    ".kiiiika",
    ".kiIIika",
    "..kkkkaa",
    "..ppaaaa",
    "..aaaamm",
    "...aaaaa",
    "....aaaa",
    "......aa",
)
for _y in (5, 6):
    _NAGA_FACE[_y] = _NAGA_FACE[_y][:9] + "k++iik" + _NAGA_FACE[_y][15:]
_NAGA_FACE = rows_of(16, *_NAGA_FACE)
_NAGA_FRINGE = rows_of(18,
    "..hhhhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhhhh.",
    "hhhhhhhhhhhhhhhhhh",
    "hhh.hhhhh.hhhh.hhh",
    "hh...hhh...hh...hh",
    "h.....h..........h",
)
_NAGA_TIARA = rows_of(12,
    "....jjjj....",
    "ggggjJJjgggg",
    ".....jj.....",
)
_NAGA_TORSO = spans(16, [(4, 11), (3, 12), (2, 13), (1, 14), (1, 14), (1, 14),
                         (2, 13), (2, 13), (3, 12), (3, 12), (3, 12), (3, 12)], "a")
_NAGA_WRAP = spans(16, [None, None, None, (1, 14), (1, 14), (2, 13), (2, 13),
                        None, None, None, (3, 12), (3, 12)], "w")
_NAGA_ARM = rows_of(10,
    "aaa.......", "aaaa......", ".aaaa.....", "..aaaa....", "...aaaaa..",
    "....aaaaaa", ".....aaaaa",
)
_NAGA_ORB = rows_of(8,
    "..cccc..",
    ".cCCccc.",
    "cCCccccc",
    "cCcccccc",
    "cccccccc",
    ".cccccc.",
    "..cccc..",
)
_NAGA_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _naga():
    cv = canvas(64, 64)
    stamp(cv, 12, 2, _NAGA_HOOD)
    stamp(cv, 12, 13, _NAGA_MARK, onto=True)
    stamp(cv, 19, 7, _NAGA_HAIR)
    # the tail: down from the waist, round the front, tip curling back up
    tube(cv, [(31, 40, 6), (35, 46, 7), (43, 51, 6.5), (42, 56, 6),
              (30, 57, 5.5), (18, 54, 5), (12, 48, 4), (14, 42, 3),
              (19, 39, 2), (21, 41, 1)], "b", belly="v")
    scales(cv, "b", "B", 6)
    stamp(cv, 24, 29, _NAGA_TORSO)
    stamp(cv, 24, 29, _NAGA_WRAP, onto=True)
    stamp(cv, 17, 30, _NAGA_ARM)
    stamp(cv, 37, 30, mirror(_NAGA_ARM))
    stamp(cv, 28, 34, _NAGA_ORB)
    stamp(cv, 23, 13, _NAGA_FACE)
    stamp(cv, 22, 10, _NAGA_FRINGE)
    stamp(cv, 18, 21, _NAGA_LOCK)
    stamp(cv, 41, 21, mirror(_NAGA_LOCK))
    stamp(cv, 26, 10, _NAGA_TIARA)
    for x, y in ((8, 20), (52, 14), (54, 36), (5, 34)):
        stamp(cv, x, y, _NAGA_SPARK)
    return finish(cv)


NAGA64 = _naga()
NAGA64_MAT = {
    "a": M((210, 222, 242), "skin"), "p": M((200, 176, 226), "skin", over="a"),
    "m": M((150, 110, 160), "skin", flat=True),
    "h": M((58, 66, 136), "fur"), "H": M((100, 120, 196), "fur", over="h"),
    "o": M((40, 104, 112), "scale"), "O": M((70, 150, 146), "scale"),
    "q": M((22, 46, 56), "scale", over="O"), "Q": M((196, 236, 226), "scale", over="O"),
    "b": M((64, 146, 152), "scale"), "B": M((44, 110, 126), "scale", over="b"),
    "v": M((220, 234, 206), "scale", over="b"),
    "w": M((70, 110, 190), "cloth"),
    "g": M((232, 190, 90), "metal", outline=(84, 54, 26)),
    "j": M((80, 200, 240), "gem", outline=(20, 50, 80)), "J": M((220, 250, 255), "gem"),
    "c": M((170, 230, 250), "gem", emissive=0.5), "C": M((250, 255, 255), "gem", emissive=0.8),
    "k": M((30, 36, 60), "gem", flat=True),
    "i": M((70, 170, 230), "gem", flat=True), "I": M((170, 230, 250), "gem", flat=True),
    "+": GLINT,
    "s": M((200, 240, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# TENGU (64) - a mountain goblin in a yamabushi's robes, turned three-
# quarters so the nose can point at you while it explains why you are
# wrong. The feather fan is for emphasis. Also for hurricanes.
# --------------------------------------------------------------------------
_TENGU_WING = wing([16, 19, 18, 15, 12], [("b", "e"), ("d", "e")], edge="e")
_TENGU_HEAD = rows_of(24,
    "......wwwwwwwwww........",
    "....wwwwwwwwwwwwww......",
    "...wwwwwwwwwwwwwwww.....",
    "..wwwwwaaaaaaaaaaaww....",
    ".wwwwaaaaaaaaaaaaaaaw...",
    ".wwwaaaaaaaaaaaaaaaaa...",
    "wwwaaaaWWWWaaaaaWWWWa...",
    "wwwaaaWWWWWaaaaWWWWWaa..",
    "wwwaaaaakkkaaaaakkkaaa..",
    "wwaaaaakk+kaaaakk+kaaa..",
    "wwaaaaaakkkaaaaakkkaaa..",
    "wwaaaaaaaaaaaaaaaaaaaaa.",
    "wwaaappaaaaaaaaaaaappaa.",
    "wwaaaaaaaaaaaaaaaaaaaa..",
    "wwwaaaaawwwwwwwwwwaaaa..",
    ".wwwaaawwwwwwwwwwwwaaa..",
    ".wwwwwwwwwwwwwwwwwwwa...",
    "..wwwwwwwwwwwwwwwwwww...",
    "...wwwwwwwwwwwwwwwww....",
    "....wwwwwwwwwwwwwww.....",
    ".....wwwwwwwwwwwwww.....",
    "......wwwwwwwwwww.......",
    "........wwwwwww.........",
)
# the nose: long, red, and pointed straight at whoever is listening
_TENGU_NOSE = spans(None, [(0, 4), (0, 9), (0, 14), (0, 17), (0, 16), (0, 12),
                           (0, 6)], "n")
_TENGU_NOSE[1] = _TENGU_NOSE[1][:2] + _TENGU_NOSE[1][2:8].replace("n", "m") + _TENGU_NOSE[1][8:]
_TENGU_NOSE[2] = _TENGU_NOSE[2][:3] + _TENGU_NOSE[2][3:12].replace("n", "m") + _TENGU_NOSE[2][12:]
_TENGU_TOKIN = rows_of(10,
    "...tttt...",
    "..tTTttt..",
    ".tttttttt.",
    "tttttttttt",
    ".c......c.",
    "..c....c..",
)
_TENGU_ROBE = spans(26, [(8, 17), (6, 19), (5, 20), (4, 21), (4, 21), (3, 22),
                         (3, 22), (3, 22), (3, 22), (3, 22), (2, 23), (2, 23),
                         (2, 23), (2, 23)], "r")
# the kesa: a sash across the chest, strung with the fuzzy bonten
_TENGU_KESA = rows_of(26,
    "........qq....qq..........",
    ".......qq......qq.........",
    "......qq..oo....qq........",
    ".....qq..oOOo....qq.......",
    "....qq...oooo.....qq......",
    "...qq.....oo.......qq.....",
    "..qq.......qq......qq.....",
    "..q.......oOOo.....qq.....",
    "..........oooo............",
    "...........oo.............",
    "..qqqqqqqqqqqqqqqqqqqqqq..",
    "..qqqqqqqqqqqqqqqqqqqqqq..",
)
_TENGU_LEGS = rows_of(26,
    "..hhhhhhhhhhhhhhhhhhhhhhh.",
    "..hhhhhhhhhhhhhhhhhhhhhhh.",
    "..hhhhhhhhhhhhhhhhhhhhhhh.",
    "..hhhhhhhhhhh.hhhhhhhhhhh.",
    "..hhhhhhhhhh...hhhhhhhhhh.",
    "..hhhhhhhhhh...hhhhhhhhhh.",
    "..hhhhhhhhhh...hhhhhhhhhh.",
    "...hhhhhhhh.....hhhhhhhh..",
    "....llllll.......llllll...",
    "..gggggggggg...gggggggggg.",
    ".....gg.............gg....",
    ".....gg.............gg....",
)
_TENGU_ARM_FAN = spans(None, [(8, 12), (7, 12), (6, 11), (5, 10), (4, 9),
                              (3, 8), (2, 7), (1, 6), (0, 5)], "R")
_TENGU_FAN = rows_of(13,
    "....FFFFF....",
    "..FFvFFFvFF..",
    ".FFFvFFFvFFF.",
    "FFFFFvFvFFFFF",
    "FFFFFvFvFFFFF",
    ".FFFFFvFFFFF.",
    "..FFFFvFFFF..",
    "....FFvFF....",
    "......y......",
    "......y......",
    "......y......",
)
_TENGU_ARM_HIP = rows_of(6,
    "RRRR..", "RRRRR.", ".RRRRR", "..RRRR", "..aaa.", ".aaa..",
)


def _tengu():
    cv = canvas(64, 64)
    dy = 6
    stamp(cv, 38, 12 + dy, _TENGU_WING)
    left = mirror(_TENGU_WING)
    stamp(cv, 26 - len(left[0]), 14 + dy, left)
    stamp(cv, 19, 44 + dy, _TENGU_LEGS)
    stamp(cv, 19, 30 + dy, _TENGU_ROBE)
    stamp(cv, 19, 30 + dy, _TENGU_KESA, onto=True)
    stamp(cv, 41, 32 + dy, _TENGU_ARM_HIP)
    stamp(cv, 12, 24 + dy, _TENGU_ARM_FAN)
    stamp(cv, 5, 6 + dy, _TENGU_FAN)
    stamp(cv, 18, 7 + dy, _TENGU_HEAD)
    stamp(cv, 39, 19 + dy, _TENGU_NOSE)
    stamp(cv, 26, 5 + dy, _TENGU_TOKIN)
    return finish(cv)


TENGU64 = _tengu()
TENGU64_MAT = {
    "a": M((222, 72, 60), "skin"), "p": M((250, 120, 110), "skin", over="a"),
    "n": M((226, 76, 62), "skin"),
    "w": M((244, 242, 236), "fur"), "W": M((250, 250, 248), "fur"),
    "k": M((40, 26, 26), "gem", flat=True), "+": GLINT,
    "t": M((40, 40, 52), "cloth"), "T": M((90, 90, 110), "cloth", over="t"),
    "c": M((240, 220, 150), "cloth", outline=False),
    # the robe is kept off white so the beard reads against it
    "r": M((196, 208, 226), "cloth"), "R": M((184, 198, 218), "cloth"),
    "q": M((240, 170, 60), "cloth"),
    "o": M((250, 150, 60), "fur"), "O": M((255, 200, 120), "fur", over="o"),
    "h": M((110, 110, 134), "cloth"),
    "g": M((150, 110, 70), "matte"),
    "b": M((40, 40, 56), "fur"), "d": M((62, 60, 82), "fur"),
    "e": M((24, 24, 36), "fur"), "m": M((252, 140, 120), "skin", over="n"),
    "l": M((244, 242, 236), "cloth"), "v": M((90, 120, 60), "plant", over="F"),
    "F": M((120, 150, 80), "plant"), "y": M((150, 110, 70), "matte"),
}

# --------------------------------------------------------------------------
# CERBERUS (64) - three heads, one very small dog brain, shared badly: the
# middle one is delighted to see you, the left one would like to set you
# on fire, and the right one is asleep.
# --------------------------------------------------------------------------
def _pup(w, h, face, ears, fur="a"):
    """A head: skull, ears behind it, face on top. Each head has its own fur
    material so the three separate instead of fusing into one lump."""
    head = canvas(w + 8, h + 12)
    skull = spans(w, ellipse(w, h), fur)
    for part, x, y in ears:
        stamp(head, x, y, [r.replace("a", fur) for r in part])
    stamp(head, 4, 8, skull)
    stamp(head, 4, 8, face)
    return finish(head)


_CERB_EAR_UP = spans(None, [(4, 4), (3, 5), (3, 5), (2, 6), (2, 6), (1, 7),
                            (1, 7), (0, 7), (0, 7)], "a")
_CERB_EAR_UP = inset(_CERB_EAR_UP, "a", "i", 1)
_CERB_EAR_FLOP = spans(None, [(0, 4), (0, 5), (0, 5), (0, 5), (0, 5), (1, 5),
                              (1, 5), (1, 4), (2, 4), (2, 3)], "e")

_CERB_FACE_HAPPY = sym(
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    "....kkkk.....",
    "...k++ook....",
    "...k++ook....",
    "...kooook....",
    "....kkkk.....",
    "..........mmm",
    "..pp....mmmnn",
    ".......mmmmnn",
    "......mmmmmmm",
    "......mmmmmqq",
    "......mmmmqqq",
    ".......mmmqtt",
    "........mmqtt",
    "...........tt",
    "...........tt",
    "............t",
)
for _y in (7, 8):
    _CERB_FACE_HAPPY[_y] = _CERB_FACE_HAPPY[_y][:17] + "k++ook" + _CERB_FACE_HAPPY[_y][23:]

_CERB_FACE_FIERCE = sym(
    "..........",
    "..........",
    "..........",
    "..........",
    "..kk......",
    "...kkk....",
    "..kkkkk...",
    "..kyyyk...",
    "..kyYyk...",
    "...kkk....",
    ".......mmm",
    "......mmnn",
    ".....mmmnn",
    ".....mmmmm",
    ".....mqqqq",
    ".....mqTqT",
    "......mmmm",
)

_CERB_FACE_SLEEPY = sym(
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..k....k..",
    "...kkkk...",
    "..........",
    ".......mmm",
    "......mmnn",
    ".....mmmnn",
    ".....mmmmm",
    "......mmmm",
    ".......mmq",
    "........mm",
)

_CERB_HEAD_MID = _pup(26, 22, _CERB_FACE_HAPPY,
                      [(_CERB_EAR_UP, 3, 0), (mirror(_CERB_EAR_UP), 23, 0)])
_CERB_HEAD_L = _pup(20, 17, _CERB_FACE_FIERCE,
                    [(_CERB_EAR_UP, 2, 1), (mirror(_CERB_EAR_UP), 18, 1)], "b")
_CERB_HEAD_R = _pup(20, 17, _CERB_FACE_SLEEPY,
                    [(_CERB_EAR_FLOP, 1, 10), (mirror(_CERB_EAR_FLOP), 22, 10)], "d")

_CERB_BREATH = rows_of(12,
    ".......ff...",
    "....fffFFf..",
    "..ffFFWWFff.",
    "fFFWWWWWWFf.",
    ".fFFWWWWFFf.",
    "..ffFFWFff..",
    "....fff.....",
)
_CERB_ZZ = rows_of(6, "..zzzz", "....z.", "...z..", "..zzzz", "zzz...", ".z....", "zzz...")

_CERB_BODY = spans(34, ellipse(34, 28), "a")
_CERB_CHEST = spans(34, [None] * 3 + [(12, 21), (11, 22), (11, 22), (12, 21),
                                       (12, 21), (13, 20), (14, 19), (15, 18)], "c")
_CERB_COLLAR = rows_of(34,
    "....s.....s.....s.....s.....s.....",
    "...sSs...sSs...sSs...sSs...sSs....",
    "..llllllllllllllllllllllllllllll..",
    ".llllllllllllllllllllllllllllllll.",
    "..llllllllllllllllllllllllllllll..",
)
_CERB_LEG = rows_of(7,
    ".ggggg.", "ggggggg", "ggggggg", "ggggggg", "ggggggg", "ggggggg", "ggggggg",
    "ggggggg", "ggggggg", "ggggggg", "ggggggg", "PPPPPPP", "PPPPPPP", "P.P.P.P",
)
_CERB_TAIL = spans(None, plume(17, 2, 9, 2, 7, w_base=4), "g")
_CERB_TAIL = recolour(_CERB_TAIL, (0, 7), "g", "f")
_CERB_TAIL = recolour(_CERB_TAIL, (0, 3), "f", "W")


def _cerberus():
    cv = canvas(64, 64)
    stamp(cv, 47, 37, _CERB_TAIL)
    stamp(cv, 15, 30, _CERB_BODY)
    stamp(cv, 15, 30, _CERB_CHEST, onto=True)
    stamp(cv, 20, 46, _CERB_LEG)
    stamp(cv, 37, 46, mirror(_CERB_LEG))
    stamp(cv, -3, 12, _CERB_HEAD_L)
    stamp(cv, 39, 12, _CERB_HEAD_R)
    stamp(cv, 15, 30, _CERB_COLLAR)
    stamp(cv, 15, 2, _CERB_HEAD_MID)
    stamp(cv, 0, 26, mirror(_CERB_BREATH))
    stamp(cv, 57, 5, _CERB_ZZ)
    return finish(cv)


CERBERUS64 = _cerberus()
CERBERUS64_MAT = {
    "a": M((112, 66, 66), "fur"), "b": M((94, 56, 60), "fur"),
    "d": M((124, 78, 74), "fur"), "e": M((100, 60, 62), "fur"),
    "i": M((200, 110, 110), "skin"),
    "m": M((214, 170, 150), "fur"), "c": M((240, 130, 70), "fur", over="a"),
    "p": M((230, 120, 120), "skin", over="a"),
    "n": M((30, 22, 28), "gem", flat=True), "q": M((80, 26, 36), "skin", flat=True),
    "t": M((240, 110, 130), "skin"), "T": M((250, 246, 236), "gem", flat=True),
    "k": M((26, 18, 24), "gem", flat=True), "+": GLINT,
    "o": M((120, 60, 40), "gem", flat=True),
    "y": M((255, 170, 60), "gem", flat=True), "Y": M((255, 240, 180), "gem", flat=True),
    "l": M((200, 40, 50), "matte"),
    "g": M((126, 80, 78), "fur"), "P": M((240, 130, 70), "fur"),
    "s": M((200, 206, 220), "metal"), "S": M((250, 252, 255), "metal"),
    "f": M((255, 140, 50), "gem", emissive=0.8), "F": M((255, 90, 40), "gem", emissive=0.7),
    "W": M((255, 244, 200), "gem", emissive=1.0),
    "z": M((220, 226, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# BAKU (64) - the dream-eater, shaped like a tapir. Where a real tapir has
# a pale saddle, this one has a strip of night sky. It is drinking a dream
# through its trunk and does not much care whose it was.
# --------------------------------------------------------------------------
_BAKU_BODY = spans(40, ellipse(40, 26), "a")
_BAKU_SADDLE = spans(40, [(13, 27)] * 26, "n")
_BAKU_HEAD = spans(22, ellipse(22, 20), "h")
_BAKU_FACE = rows_of(22,
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "........kkkkk.........",
    ".......k.kkkkk........",
    "........yyyyy.........",
    ".........yyy..........",
    "......................",
    "....pp................",
    "...ppp................",
)
_BAKU_EAR = rows_of(6, ".hhhh.", "hhiihh", "hiiiih", "hiiiih", ".hhhh.")
_BAKU_LEG = rows_of(6,
    "llllll", "llllll", "llllll", "llllll", "llllll", "llllll", "llllll",
    "oooooo", "o.oo.o",
)
_BAKU_LEG_FAR = [r.replace("l", "L") for r in _BAKU_LEG]
_BAKU_TAIL = rows_of(5, "..aa.", ".aa..", "aa...", "ttt..", "tt...")
_BAKU_DREAM = rows_of(18,
    ".....dddd.........",
    "...ddddddd..ddd...",
    "..dddDDddddddddd..",
    ".ddDDDDddddddmmdd.",
    "dddDDddddddddmmddd",
    "ddddddddddddmmdddd",
    ".dddddddddmmmddd..",
    "..dddd.ddddddd....",
    "......dd..........",
    ".....dd...........",
)
_BAKU_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _baku():
    cv = canvas(64, 64)
    stamp(cv, 49, 28, _BAKU_TAIL)
    stamp(cv, 23, 42, _BAKU_LEG_FAR)
    stamp(cv, 48, 42, _BAKU_LEG_FAR)
    stamp(cv, 16, 22, _BAKU_BODY)
    stamp(cv, 16, 22, _BAKU_SADDLE, onto=True)
    for x, y in ((31, 27), (37, 31), (34, 36), (40, 26), (30, 41), (39, 43),
                 (33, 32), (41, 37)):
        if cv[y][x] == "n":
            cv[y][x] = "s"
    for x, y in ((35, 29), (37, 38)):
        stamp(cv, x - 1, y - 1, rows_of(3, ".s.", "sSs", ".s."), onto=True)
    stamp(cv, 17, 44, _BAKU_LEG)
    stamp(cv, 41, 44, _BAKU_LEG)
    stamp(cv, 17, 13, _BAKU_EAR)
    stamp(cv, 5, 17, _BAKU_HEAD)
    stamp(cv, 5, 17, _BAKU_FACE, onto=True)
    # the trunk curls down, then up to the dream it is drinking
    stamp(cv, 0, 4, _BAKU_DREAM)
    tube(cv, [(9, 30, 3.5), (5, 32, 3), (2, 28, 2.5), (2, 22, 2),
              (4, 17, 1.6), (6, 14, 1.4)], "r")
    for x, y in ((3, 30), (2, 26), (3, 21)):
        cv[y][x] = "R"
    for x, y in ((22, 4), (30, 10), (56, 18)):
        stamp(cv, x, y, _BAKU_SPARK)
    return finish(cv)


BAKU64 = _baku()
BAKU64_MAT = {
    "a": M((70, 60, 110), "fur"), "h": M((82, 70, 124), "fur"),
    "r": M((104, 88, 148), "fur"), "R": M((74, 62, 112), "fur", over="r"),
    "n": M((30, 34, 76), "fur", over="a"),
    "i": M((210, 150, 190), "skin"),
    "l": M((78, 66, 118), "fur"), "L": M((58, 50, 92), "fur"),
    "o": M((200, 190, 220), "stone"),
    "t": M((240, 220, 255), "fur"),
    "k": M((24, 20, 40), "gem", flat=True),
    "y": M((250, 220, 130), "gem", flat=True),
    "p": M((220, 140, 190), "skin", over="h"),
    "d": M((250, 190, 226), "cloth", emissive=0.4),
    "D": M((255, 236, 248), "cloth", emissive=0.6),
    "m": M((255, 246, 180), "gem", emissive=0.7),
    "s": M((230, 230, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# MINOTAUR (64) - furious, cornered, and not sure why. Snorting, brows
# down, a labrys too big for it braced in one fist. The nose ring is gold;
# someone once thought it could be led.
# --------------------------------------------------------------------------
_MINO_HEAD = spans(24, ellipse(24, 20), "a")
_MINO_MUZZLE = spans(18, ellipse(18, 10), "m")
_MINO_FACE = rows_of(24,
    "........................",
    "........................",
    "........................",
    "........................",
    "..kkkk............kkkk..",
    "....kkkk........kkkk....",
    "....kkrrk......krrkk....",
    ".....kErk......krEk.....",
    "......kk........kk......",
)
_MINO_SNOUT = rows_of(18,
    "..................",
    "..................",
    "....nnn....nnn....",
    "....nnn....nnn....",
    "..................",
    "......gggggg......",
    ".....g......g.....",
    ".....g......g.....",
    "......gggggg......",
)
_MINO_EAR = rows_of(7, "..eeee.", "eeeiiie", ".eeeeee", "...ee..")
_MINO_TUFT = rows_of(10, "..d..d.d..", ".ddddddddd", "dddddddddd", ".dddddddd.")
_MINO_STEAM = rows_of(7, "..vv...", ".vVVv..", "vVVVvv.", ".vvvVv.", "...vv..")
_MINO_TORSO = spans(30, [(6, 23), (3, 26), (1, 28), (0, 29), (0, 29), (0, 29),
                         (0, 29), (1, 28), (2, 27), (3, 26), (4, 25), (5, 24),
                         (6, 23), (7, 22), (7, 22), (8, 21)], "a")
_MINO_CHEST = rows_of(30,
    "..............................",
    "..............................",
    "..............................",
    ".......qqqqqq....qqqqqq.......",
    "......q......qqqq......q......",
    "..............qq..............",
    "..............................",
    "..........qq......qq..........",
    "..........qq......qq..........",
    "..........qq......qq..........",
    "..........qq......qq..........",
)
_MINO_ARM = rows_of(8,
    ".bbbbb..", "bbbbbbb.", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", ".bbbbbbb",
    ".bbbbbbb", "..GGGGGG", "..GGGGGG", "..bbbbbb", "..bbbbbb", "..bbbbbb",
    "..bbbbbb", "..bbbbb.",
)
_MINO_LOIN = spans(22, [(0, 21), (0, 21), (1, 20), (1, 20), (2, 19), (2, 19),
                        (3, 18), (5, 16), (7, 14)], "c")
_MINO_LOIN[0] = _MINO_LOIN[1] = "G" * 22
_MINO_LEG = rows_of(7,
    "aaaaaaa", "aaaaaaa", "aaaaaaa", ".aaaaaa", ".aaaaa.", ".aaaaa.",
    ".aaaaa.", ".ddddd.", "hhhhhhh", "hhh.hhh",
)
_MINO_AXE = rows_of(16,
    ".....x....x.....",
    "..xxxx....xxxx..",
    ".xXXxx....xxXXx.",
    "xXXxxxyyyyxxxXXx",
    "xXxxxxyyyyxxxxXx",
    "xXxxxxyyyyxxxxXx",
    "xXXxxxyyyyxxxXXx",
    ".xXXxx.yy.xxXXx.",
    "..xxxx.yy.xxxx..",
    ".....x.yy.x.....",
) + [".......yy......."] * 34


def _minotaur():
    cv = canvas(64, 64)
    # horns sweep out, then up and in at the tips
    tube(cv, [(22, 14, 3), (15, 12, 2.6), (10, 7, 2.1), (10, 2, 1.5), (12, 0, 1)], "w")
    tube(cv, [(41, 14, 3), (48, 12, 2.6), (53, 7, 2.1), (53, 2, 1.5), (51, 0, 1)], "w")
    for x, y in ((10, 2), (11, 1), (53, 2), (52, 1), (10, 3), (53, 3)):
        cv[y][x] = "W"
    stamp(cv, 49, 45, _MINO_LEG)
    stamp(cv, 16, 30, _MINO_TORSO)
    stamp(cv, 16, 30, _MINO_CHEST, onto=True)
    stamp(cv, 21, 45, _MINO_LEG)
    stamp(cv, 35, 45, _MINO_LEG)
    stamp(cv, 20, 44, _MINO_LOIN)
    stamp(cv, 9, 32, mirror(_MINO_ARM))
    stamp(cv, 48, 16, _MINO_AXE)
    stamp(cv, 47, 32, _MINO_ARM)
    stamp(cv, 13, 17, _MINO_EAR)
    stamp(cv, 44, 17, mirror(_MINO_EAR))
    stamp(cv, 20, 11, _MINO_HEAD)
    stamp(cv, 20, 11, _MINO_FACE, onto=True)
    stamp(cv, 23, 21, _MINO_MUZZLE)
    stamp(cv, 23, 21, _MINO_SNOUT)
    stamp(cv, 27, 9, _MINO_TUFT)
    stamp(cv, 20, 28, mirror(_MINO_STEAM))
    stamp(cv, 38, 28, _MINO_STEAM)
    return finish(cv)


MINOTAUR64 = _minotaur()
MINOTAUR64_MAT = {
    "a": M((150, 92, 60), "fur"), "b": M((140, 86, 56), "fur"),
    "d": M((70, 44, 36), "fur"), "e": M((136, 82, 54), "fur"),
    "i": M((210, 140, 120), "skin"),
    "m": M((222, 180, 150), "fur"), "n": M((60, 30, 30), "gem", flat=True),
    "c": M((180, 50, 44), "cloth"), "q": M((110, 64, 44), "fur", over="a"),
    "g": M((240, 196, 80), "metal", outline=(84, 54, 26)),
    "G": M((220, 176, 70), "metal", outline=(84, 54, 26)),
    "w": M((236, 226, 196), "stone"), "W": M((140, 120, 100), "stone"),
    "k": M((40, 20, 20), "gem", flat=True),
    "y": M((130, 90, 56), "matte"),
    "r": M((255, 90, 60), "gem", flat=True), "E": M((255, 220, 180), "gem", flat=True),
    "h": M((60, 50, 50), "stone"),
    "x": M((170, 176, 190), "metal"), "X": M((236, 240, 250), "metal"),
    "v": M((236, 240, 248), "cloth", outline=False),
    "V": M((255, 255, 255), "cloth", outline=False),
}

# --------------------------------------------------------------------------
# MEDUSA (64) - her hair is friendlier than she is. Seven small snakes, all
# delighted to meet you; one gorgon underneath them, arms folded, who would
# rather you had not come.
# --------------------------------------------------------------------------
_MEDUSA_HEAD = spans(20, ellipse(20, 18), "a")
_MEDUSA_FACE = sym(
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..kk......",
    "...kkk....",
    "..kyyk....",
    "..kyrk....",
    "...kk.....",
    "..........",
    "..pp......",
    "..........",
    "........mm",
    ".......m..",
)
# (the frown is drawn as a downturned line, the corners lower than the middle)
_MEDUSA_CHITON = spans(26, [(6, 19), (5, 20), (4, 21), (4, 21), (4, 21), (4, 21),
                            (4, 21), (5, 20), (5, 20), (5, 20), (4, 21), (4, 21),
                            (3, 22), (3, 22), (2, 23), (2, 23), (1, 24), (1, 24),
                            (0, 25), (0, 25)], "c")
_MEDUSA_CHITON[8] = _MEDUSA_CHITON[9] = "....." + "o" * 16 + "....."
_MEDUSA_FOLDS = rows_of(26,
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    "..........................",
    ".......C.....C....C.......",
    ".......C.....C....C.......",
    "......C......C.....C......",
    "......C......C.....C......",
    ".....C.......C......C.....",
    ".....C.......C......C.....",
    "....C........C.......C....",
    "....C........C.......C....",
    "...C.........C........C...",
    "...C.........C........C...",
)
# arms folded across the chest
_MEDUSA_ARMS = rows_of(24,
    "bb....................bb",
    "bbb..................bbb",
    "bbbb................bbbb",
    ".bbbbbbbbbbbbbbbbbbbbbb.",
    "..bbbbbbbbbbbbbbbbbbbb..",
    "..OOObbbbbbbbbbbbbbOOO..",
    "...bbbbbbbbbbbbbbbbbb...",
)
_MEDUSA_LEG = rows_of(4, "aaaa", "aaaa", "aaaa", "aaaa", "oooo", "aaaa", "oooo", "ssss")


_MEDUSA_SNAKE_HEAD = rows_of(9,
    "..hhhhh..",
    ".hhhhhhh.",
    "hhhWkhhhh",
    "hhhkkhhhh",
    "uuuuuhhh.",
    ".uuuuuh..",
)
_MEDUSA_TONGUE = rows_of(4, "tt..", "..tt", "tt..")


def _snake(cv, path, body, face_right):
    """A snake: a scaled tube with a pale belly, and a proper head - wider
    than its neck, with an eye and a tongue - so it reads as an animal and
    not as a strand of weed."""
    tube(cv, path, body, belly="u")
    x, y, _ = path[-1]
    x, y = int(round(x)), int(round(y))
    head = [r.replace("h", body) for r in _MEDUSA_SNAKE_HEAD]
    if not face_right:
        head = mirror(head)
    stamp(cv, x - 4, y - 3, head)
    tongue = _MEDUSA_TONGUE if face_right else mirror(_MEDUSA_TONGUE)
    stamp(cv, x + 5 if face_right else x - 8, y, tongue)


def _medusa():
    cv = canvas(64, 64)
    # seven snakes rooted along the scalp, curling up and out
    snakes = [
        ([(27, 17, 3.0), (18, 16, 2.7), (12, 19, 2.4), (8, 17, 2.2)], "g", False),
        ([(28, 15, 3.0), (22, 9, 2.7), (15, 8, 2.4), (11, 6, 2.2)], "G", False),
        ([(32, 14, 3.0), (31, 7, 2.6), (27, 4, 2.3)], "g", False),
        ([(35, 15, 3.0), (41, 9, 2.7), (48, 8, 2.4), (52, 6, 2.2)], "G", True),
        ([(36, 17, 3.0), (45, 16, 2.7), (51, 19, 2.4), (55, 17, 2.2)], "g", True),
    ]
    for path, body, right in snakes:
        _snake(cv, path, body, right)
    stamp(cv, 26, 50, _MEDUSA_LEG)
    stamp(cv, 34, 50, _MEDUSA_LEG)
    stamp(cv, 19, 31, _MEDUSA_CHITON)
    stamp(cv, 19, 31, _MEDUSA_FOLDS, onto=True)
    stamp(cv, 20, 32, _MEDUSA_ARMS)
    stamp(cv, 22, 14, _MEDUSA_HEAD)
    stamp(cv, 22, 14, _MEDUSA_FACE, onto=True)
    return finish(cv)


MEDUSA64 = _medusa()
MEDUSA64_MAT = {
    # grey-lilac skin, so the emerald snakes stand clear of her
    "a": M((214, 206, 226), "skin"), "b": M((204, 196, 218), "skin"),
    "p": M((220, 170, 170), "skin", over="a"),
    "m": M((110, 70, 90), "skin", flat=True),
    "g": M((52, 150, 104), "scale"), "G": M((80, 176, 96), "scale"),
    "u": M((236, 226, 150), "scale", over="g"),
    "W": M((255, 255, 255), "gem", flat=True),
    "t": M((230, 60, 80), "skin", flat=True),
    "c": M((110, 70, 160), "cloth"), "C": M((84, 50, 130), "cloth", over="c"),
    "o": M((236, 190, 80), "metal", outline=(84, 54, 26)),
    "O": M((236, 190, 80), "metal", outline=(84, 54, 26)),
    "s": M((150, 110, 70), "matte"),
    "k": M((24, 20, 30), "gem", flat=True),
    "y": M((230, 240, 90), "gem", flat=True), "r": M((30, 30, 20), "gem", flat=True),
}

# --------------------------------------------------------------------------
# HARPY (64) - shrieks first, considers later. Wings where her arms should
# be, talons where her feet should be, and her mouth already open.
# --------------------------------------------------------------------------
_HARPY_WING = wing([22, 25, 24, 21, 18, 14], [("b", "d"), ("B", "d")], gap=3, edge="e")
_HARPY_HAIR = spans(24, ellipse(24, 22), "h")
_HARPY_CREST = rows_of(24,
    "......h....h....h.......",
    ".....hh...hh...hh.......",
    "....hhh..hhh..hhh..h....",
    "...hhhh.hhhh.hhhh.hh....",
)
_HARPY_FACE = sym(
    "............",
    "............",
    "............",
    "............",
    "............",
    ".....aaaaaaa",
    "....aaaaaaaa",
    "...aaaaaaaaa",
    "...kkaaaaaaa",
    "...akkkaaaaa",
    "...kyyykaaaa",
    "...kyykaaaaa",
    "....kkaaaaaa",
    "...ppaaaaqqq",
    "....aaaaqqqq",
    "....aaaaqqrr",
    ".....aaaaqqq",
    "......aaaaaa",
    "........aaaa",
)
_HARPY_BODY = spans(16, [(4, 11), (3, 12), (2, 13), (2, 13), (2, 13), (2, 13),
                         (3, 12), (3, 12), (4, 11), (4, 11), (5, 10)], "c")
_HARPY_TAIL = rows_of(18,
    "......bbbbbb......",
    "....bbBBbbBBbb....",
    "..bbBBbbBBbbBBbb..",
    ".bBBbb.bBBb.bbBBb.",
    "bBBb...bBBb...bBBb",
    "bBb....bBBb....bBb",
    "bb.....bBBb.....bb",
    "........bb........",
)
_HARPY_LEG = rows_of(8,
    "..bbbb..", "..bbbb..", "...ll...", "...ll...", "...ll...", "...ll...",
    "..llll..", ".l.ll.l.", "t..ll..t", "t..tt..t",
)


def _harpy():
    cv = canvas(64, 64)
    stamp(cv, 23, 42, _HARPY_TAIL)
    stamp(cv, 37, 12, _HARPY_WING)
    left = mirror(_HARPY_WING)
    stamp(cv, 27 - len(left[0]), 12, left)
    stamp(cv, 22, 50, _HARPY_LEG)
    stamp(cv, 34, 50, _HARPY_LEG)
    stamp(cv, 24, 32, _HARPY_BODY)
    stamp(cv, 20, 9, _HARPY_HAIR)
    stamp(cv, 20, 6, _HARPY_CREST)
    stamp(cv, 20, 11, _HARPY_FACE)
    # shout lines above the head: the wings leave no room beside the mouth
    for a, b in (((20, 1), (23, 5)), ((31, 0), (31, 4)), ((43, 1), (40, 5))):
        (x0, y0), (x1, y1) = a, b
        for i in range(5):
            x = round(x0 + (x1 - x0) * i / 4.0)
            y = round(y0 + (y1 - y0) * i / 4.0)
            cv[y][x] = "v"
    return finish(cv)


HARPY64 = _harpy()
HARPY64_MAT = {
    "a": M((246, 214, 190), "skin"), "p": M((246, 150, 140), "skin", over="a"),
    "h": M((150, 84, 50), "fur"),
    "b": M((168, 98, 56), "fur"), "B": M((210, 146, 84), "fur"),
    "d": M((90, 50, 36), "fur"), "e": M((70, 40, 30), "fur"),
    "c": M((244, 226, 190), "fur"),
    "l": M((236, 186, 70), "scale"), "t": M((50, 40, 40), "gem", flat=True),
    "k": M((40, 24, 20), "gem", flat=True),
    "y": M((250, 200, 60), "gem", flat=True),
    "q": M((110, 30, 40), "gem", flat=True), "r": M((230, 100, 110), "skin", flat=True),
    "v": M((255, 250, 230), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# CYCLOPS (64) - one eye, and a blind side to match: the eye is always
# looking the other way. A shepherd's fleece over one shoulder and a club
# that was, until recently, a tree.
# --------------------------------------------------------------------------
_CYC_HEAD = spans(26, ellipse(26, 22), "a")
_CYC_HAIR = rows_of(26,
    ".......hhhhhhhhhhhh.......",
    ".....hhhhhhhhhhhhhhhh.....",
    "...hhhhhhhhhhhhhhhhhhhh...",
    "..hhhhhhhhhhhhhhhhhhhhhh..",
    ".hhhhhhh.hhhhhhhh.hhhhhhh.",
    ".hhhh.h...hh..hh...h.hhhh.",
    "hhhh...............h..hhhh",
    "hhh....................hhh",
    "hh......................hh",
    "h........................h",
)
_CYC_EYE = rows_of(12,
    "...kkkkkk...",
    ".kkkkkkkkkk.",
    "kkwwwwwwwwkk",
    "kwwwwwwwiiik",
    "kwwwwwwiIiik",
    "kwwwwwwi+iik",
    "kwwwwwwiiiik",
    ".kwwwwwwiiw.",
    "..kkwwwwkk..",
    "....kkkk....",
)
_CYC_MOUTH = rows_of(14,
    "q............q",
    ".qqqqqqqqqqqq.",
    "..qqqTqqqqqq..",
    "...qqqqqqqq...",
)
_CYC_EAR = rows_of(4, ".aa.", "aaaa", "aapa", "aaaa", ".aa.")
_CYC_BODY = spans(32, ellipse(32, 26), "a")
_CYC_FLEECE = spans(32, [(18, 31), (16, 31), (14, 31), (12, 30), (10, 29),
                         (9, 28), (8, 27), (7, 26), (6, 25), (6, 24), (5, 22),
                         (5, 20), (5, 18), (6, 16), (7, 14)], "f")
_CYC_LEG = rows_of(9,
    "aaaaaaaaa", "aaaaaaaaa", "aaaaaaaaa", ".aaaaaaa.", ".aaaaaaa.",
    ".sssssss.", "sssssssss", "sssssssss",
)


def _cyclops():
    cv = canvas(64, 64)
    # the club over one shoulder, knots and all
    tube(cv, [(48, 52, 2.5), (51, 36, 3.2), (55, 18, 4.5), (57, 7, 5.5)], "y")
    for x, y in ((52, 30), (55, 16), (50, 42), (57, 8), (54, 23)):
        cv[y][x] = "Y"
    stamp(cv, 19, 53, _CYC_LEG)
    stamp(cv, 36, 53, _CYC_LEG)
    stamp(cv, 16, 30, _CYC_BODY)
    stamp(cv, 16, 30, _CYC_FLEECE, onto=True)
    for x, y in ((34, 32), (38, 35), (42, 33), (31, 38), (36, 40), (27, 42), (40, 38),
                 (45, 36), (33, 44), (24, 45)):
        if cv[y][x] == "f":
            cv[y][x] = "F"
    # arms as limbs, shoulder to fist; the right one has the club
    tube(cv, [(20, 35, 4.5), (13, 42, 4), (12, 48, 4.2)], "b")
    tube(cv, [(44, 35, 4.5), (50, 40, 4), (50, 45, 4.2)], "b")
    stamp(cv, 16, 16, _CYC_EAR)
    stamp(cv, 44, 16, _CYC_EAR)
    stamp(cv, 19, 9, _CYC_HEAD)
    stamp(cv, 19, 9, _CYC_HAIR, onto=True)
    stamp(cv, 26, 13, _CYC_EYE)
    stamp(cv, 25, 11, rows_of(14, "..kkkkkkkkkk..", ".kkkkkkkkkkkk."))
    stamp(cv, 25, 25, _CYC_MOUTH)
    # a stub of a horn, pushing up through the hair
    stamp(cv, 30, 5, rows_of(4, ".ww.", ".ww.", "wwww", "wwww"))
    return finish(cv)


CYCLOPS64 = _cyclops()
CYCLOPS64_MAT = {
    "a": M((226, 170, 130), "skin"), "b": M((214, 160, 122), "skin"),
    "p": M((196, 130, 110), "skin"),
    "h": M((90, 60, 44), "fur"),
    "k": M((50, 30, 30), "gem", flat=True), "w": M((250, 248, 240), "gem", flat=True),
    "i": M((70, 140, 200), "gem", flat=True), "I": M((150, 200, 240), "gem", flat=True),
    "+": GLINT,
    "q": M((110, 40, 40), "gem", flat=True), "T": M((250, 246, 230), "gem", flat=True),
    "f": M((240, 232, 210), "fur"), "F": M((210, 200, 176), "fur", over="f"),
    "s": M((130, 90, 60), "matte"),
    "y": M((140, 96, 60), "plant"), "Y": M((100, 66, 42), "plant", over="y"),
}

# --------------------------------------------------------------------------
# PEGASUS (64) - insufferably graceful. A foal in profile, one hoof raised
# mid-prance, nose in the air and eyes closed, as if you were not worth
# opening them for.
# --------------------------------------------------------------------------
_PEG_WING_NEAR = turn(wing([20, 23, 22, 19, 16, 12], [("w", "c"), ("W", "c")], edge="e"))
_PEG_WING_FAR = [r.replace("w", "f").replace("W", "F").replace("c", "C").replace("e", "E")
                 for r in _PEG_WING_NEAR]
_PEG_HEAD = spans(17, ellipse(17, 14), "a")
_PEG_MUZZLE = spans(12, ellipse(12, 10), "u")
_PEG_EYE = rows_of(6, "k....k", ".kkkk.", "k.k...")
_PEG_LEG = rows_of(3, "aaa", "aaa", "aaa", "aaa", "aaa", "aaa", "aaa", "aaa",
                   "aaa", "aaa", "hhh", "hhh")
_PEG_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _pegasus():
    cv = canvas(64, 64)
    stamp(cv, 35, 0, _PEG_WING_FAR)
    # far legs first, a shade darker
    stamp(cv, 23, 42, [r.replace("a", "b") for r in _PEG_LEG])
    stamp(cv, 44, 42, [r.replace("a", "b") for r in _PEG_LEG])
    # the tail streams back and down
    tube(cv, [(48, 32, 3), (55, 34, 3.5), (59, 41, 3.2), (58, 49, 2.5), (61, 54, 1.5)], "m")
    tube(cv, [(49, 33, 1.5), (55, 37, 2), (57, 44, 1.6)], "M")
    stamp(cv, 18, 28, spans(32, ellipse(32, 18), "a"))
    stamp(cv, 29, 43, _PEG_LEG)
    stamp(cv, 49, 43, _PEG_LEG)
    # the near foreleg, raised and folded at the knee
    tube(cv, [(22, 40, 2.2), (17, 44, 2), (18, 49, 1.8)], "l")
    stamp(cv, 16, 49, rows_of(4, "hhhh", "hhhh"))
    # neck up to a head held too high
    tube(cv, [(25, 34, 6), (21, 27, 5.5), (18, 22, 5)], "a")
    stamp(cv, 8, 10, _PEG_HEAD)
    stamp(cv, 1, 9, _PEG_MUZZLE)
    for x, y in ((3, 12), (4, 13)):
        cv[y][x] = "n"
    cv[16][5] = "n"; cv[16][6] = "n"
    stamp(cv, 11, 14, _PEG_EYE)
    stamp(cv, 18, 5, rows_of(4, "..a.", ".aa.", "aaa.", "aaaa", "aaaa"))
    # the mane falls from the crown down the back of the neck
    tube(cv, [(19, 9, 3), (23, 14, 3.5), (26, 20, 3.5), (28, 27, 3), (29, 32, 2)], "m")
    tube(cv, [(20, 10, 1.4), (24, 16, 1.8), (27, 25, 1.4)], "M")
    stamp(cv, 27, 5, _PEG_WING_NEAR)
    for x, y in ((6, 24), (60, 4), (4, 40)):
        stamp(cv, x, y, _PEG_SPARK)
    return finish(cv)


PEGASUS64 = _pegasus()
PEGASUS64_MAT = {
    "a": M((248, 246, 252), "fur"), "b": M((214, 212, 230), "fur"),
    "h": M((200, 170, 110), "metal", outline=(84, 60, 30)),
    "n": M((180, 160, 180), "skin", flat=True),
    "k": M((70, 60, 100), "gem", flat=True),
    "m": M((150, 180, 250), "fur"), "M": M((220, 180, 250), "fur"),
    "u": M((250, 240, 246), "fur"), "l": M((238, 236, 248), "fur"),
    # the wings are tinted, and blue at the tips, or they vanish into the body
    "w": M((222, 226, 252), "fur"), "W": M((204, 212, 248), "fur"),
    "c": M((150, 170, 240), "fur"), "e": M((120, 130, 200), "fur"),
    "f": M((196, 200, 236), "fur"), "F": M((182, 188, 228), "fur"),
    "C": M((130, 146, 214), "fur"), "E": M((104, 112, 180), "fur"),
    "s": M((230, 240, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# CHIMERA (64) - three animals, one very bad mood. The lion is furious, the
# goat on its back is bored of the lion being furious, and the snake it has
# for a tail is taking it out on you.
# --------------------------------------------------------------------------
def _chimera_mane():
    """A ragged ring of flame-coloured mane, darker at the rim."""
    rows = inset(spans(30, ellipse(30, 28), "r"), "r", "R", 4)
    rows = [list(r) for r in rows]
    # notch the rim so it reads as tufts, not a disc
    for y, x in ((0, 13), (0, 16), (2, 6), (2, 23), (6, 1), (6, 28), (13, 0),
                 (13, 29), (20, 1), (20, 28), (25, 5), (25, 24), (1, 9), (1, 20),
                 (4, 3), (4, 26), (9, 0), (9, 29), (17, 0), (17, 29)):
        rows[y][x] = "."
    return ["".join(r) for r in rows]


_CHIM_MANE = _chimera_mane()
_CHIM_FACE = spans(18, ellipse(18, 16), "a")
_CHIM_FEATURES = sym(
    ".........",
    ".........",
    ".........",
    ".kk......",
    "..kkk....",
    ".kkyyk...",
    ".kyyYk...",
    "..kkk....",
    ".........",
    "......mmm",
    ".....mmmn",
    "..pp.mmmm",
    "....mqqqq",
    "....mqTqq",
    ".....mmmm",
)
_CHIM_EAR = rows_of(6, ".rrrr.", "rraarr", "raaaar", ".rrrr.")
_CHIM_GOAT = spans(11, ellipse(11, 13), "g")
_CHIM_GOAT_FACE = rows_of(11,
    "...........",
    "...........",
    "...........",
    "...........",
    ".kkk...kkk.",
    ".koo...ook.",
    "...........",
    "...........",
    "....nnn....",
    ".....n.....",
    "...........",
    "...........",
    ".....bb....",
)
_CHIM_SNAKE_HEAD = rows_of(9,
    "..sssss..",
    ".sssssss.",
    "sssWkssss",
    "sssskssss",
    ".uuuusss.",
    "..uuus...",
)
_CHIM_LEG = rows_of(6, "llllll", "llllll", "llllll", "llllll", "llllll",
                    "llllll", "PPPPPP", "P.PP.P")
_CHIM_BREATH = rows_of(10,
    "......ff..",
    "...fffFFf.",
    ".ffFFWWFf.",
    "fFFWWWWFf.",
    ".ffFFWFf..",
    "...ffff...",
)


def _chimera():
    cv = canvas(64, 64)
    stamp(cv, 27, 44, [r.replace("l", "L") for r in _CHIM_LEG])
    stamp(cv, 46, 44, [r.replace("l", "L") for r in _CHIM_LEG])
    # the snake tail, rising from the rump
    tube(cv, [(50, 40, 3), (57, 38, 2.8), (60, 30, 2.4), (57, 22, 2.2), (55, 17, 2.2)],
         "s", belly="u")
    stamp(cv, 50, 12, mirror(_CHIM_SNAKE_HEAD))
    cv[15][48] = cv[15][47] = "t"
    cv[14][46] = cv[16][46] = "t"
    # the goat, rising from the back on its own neck
    tube(cv, [(40, 36, 4), (42, 28, 3.5), (43, 22, 3.2)], "g")
    tube(cv, [(40, 13, 2), (37, 10, 1.8), (36, 6, 1.4), (38, 3, 1)], "h")
    tube(cv, [(46, 13, 2), (49, 10, 1.8), (50, 6, 1.4), (48, 3, 1)], "h")
    stamp(cv, 38, 12, _CHIM_GOAT)
    stamp(cv, 38, 12, _CHIM_GOAT_FACE, onto=True)
    stamp(cv, 22, 31, spans(32, ellipse(32, 19), "a"))
    stamp(cv, 23, 45, _CHIM_LEG)
    stamp(cv, 42, 45, _CHIM_LEG)
    stamp(cv, 4, 12, _CHIM_MANE)
    stamp(cv, 5, 12, _CHIM_EAR)
    stamp(cv, 25, 12, _CHIM_EAR)
    stamp(cv, 10, 19, _CHIM_FACE)
    stamp(cv, 10, 19, _CHIM_FEATURES, onto=True)
    stamp(cv, 0, 37, mirror(_CHIM_BREATH))
    return finish(cv)


CHIMERA64 = _chimera()
CHIMERA64_MAT = {
    "a": M((232, 176, 100), "fur"), "l": M((222, 164, 92), "fur"),
    "L": M((190, 136, 76), "fur"), "P": M((170, 112, 70), "fur"),
    "r": M((200, 70, 44), "fur"), "R": M((244, 124, 56), "fur", over="r"),
    "m": M((250, 226, 190), "fur", over="a"),
    "p": M((240, 140, 110), "skin", over="a"),
    "n": M((70, 40, 40), "gem", flat=True),
    "q": M((110, 36, 40), "gem", flat=True), "T": M((255, 252, 240), "gem", flat=True),
    "k": M((50, 30, 26), "gem", flat=True),
    "y": M((255, 200, 60), "gem", flat=True), "Y": M((255, 244, 180), "gem", flat=True),
    "g": M((214, 208, 200), "fur"), "h": M((120, 100, 90), "stone"),
    "o": M((220, 180, 70), "gem", flat=True), "b": M((170, 150, 140), "fur"),
    "s": M((90, 150, 80), "scale"), "u": M((230, 220, 150), "scale", over="s"),
    "W": M((255, 255, 255), "gem", flat=True), "t": M((230, 60, 80), "skin", flat=True),
    "f": M((255, 140, 50), "gem", emissive=0.8), "F": M((255, 90, 40), "gem", emissive=0.7),
}

# --------------------------------------------------------------------------
# SATYR (64) - plays the pipes. Will not stop playing the pipes. Eyes shut,
# one hoof up, lost in a tune it has been playing for six hundred years.
# --------------------------------------------------------------------------
_SATYR_HEAD = spans(20, ellipse(20, 18), "a")
_SATYR_CURLS = rows_of(23,
    "......cc..cc..cc.......",
    "....ccCCccCCccCCcc.....",
    "...cCCccCCccCCccCCc....",
    "..ccccccccccccccccccc..",
    ".cccCcccccCccccCccccc..",
    ".ccccc.c..c...c..ccccc.",
    "ccccc.............cccc.",
    "cccc...............ccc.",
    "ccc.................cc.",
    "cc...................c.",
)
_SATYR_FACE = sym(
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..k...k...",
    "...kkk....",
    "..........",
    "..qq......",
)
_SATYR_EAR = rows_of(5, "a....", "aa...", "aaa..", "aaaa.", ".aaa.")
_SATYR_PIPES = rows_of(13,
    "ppppppppppppp",
    "PPPPPPPPPPPPP",
    "p.p.p.p.p.p.p",
    "p.p.p.p.p.p..",
    "p.p.p.p.p....",
    "p.p.p.p......",
    "p.p.p........",
    "p.p..........",
    "p............",
)
_SATYR_TORSO = spans(16, [(4, 11), (3, 12), (2, 13), (2, 13), (2, 13), (2, 13),
                          (3, 12), (3, 12), (3, 12), (3, 12), (3, 12), (4, 11),
                          (4, 11)], "a")
_SATYR_SASH = rows_of(16,
    "..........gg....",
    ".........gGg....",
    "........ggg.....",
    ".......gGg......",
    "......ggg.......",
    ".....gGg........",
    "....ggg.........",
    "...gGg..........",
)
_SATYR_NOTE = rows_of(4, "...n", "..nn", "..n.", "..n.", "nnn.", "nnn.")


def _satyr():
    cv = canvas(64, 64)
    # goat legs: thigh forward, hock back, the right one kicked up
    tube(cv, [(28, 44, 4.5), (25, 51, 3.5), (28, 56, 2.5), (27, 60, 2)], "f")
    tube(cv, [(36, 44, 4.5), (43, 47, 3.5), (44, 53, 2.5), (47, 55, 2)], "f")
    stamp(cv, 24, 59, rows_of(6, "hhhhhh", "hh.hhh"))
    stamp(cv, 46, 54, rows_of(4, "hhh.", "hhhh", "hhhh"))
    stamp(cv, 22, 38, spans(20, ellipse(20, 11), "F"))
    stamp(cv, 24, 26, _SATYR_TORSO)
    stamp(cv, 24, 26, _SATYR_SASH, onto=True)
    # both arms up to the pipes
    tube(cv, [(26, 28, 2.2), (21, 26, 2), (23, 21, 1.8)], "b")
    tube(cv, [(38, 28, 2.2), (43, 26, 2), (40, 21, 1.8)], "b")
    stamp(cv, 17, 14, _SATYR_EAR)
    stamp(cv, 42, 14, mirror(_SATYR_EAR))
    stamp(cv, 22, 7, _SATYR_HEAD)
    stamp(cv, 20, 5, _SATYR_CURLS)
    stamp(cv, 22, 7, _SATYR_FACE, onto=True)
    tube(cv, [(24, 6, 2), (20, 4, 1.6), (19, 1, 1.2)], "w")
    tube(cv, [(39, 6, 2), (43, 4, 1.6), (44, 1, 1.2)], "w")
    stamp(cv, 26, 20, _SATYR_PIPES)
    for x, y in ((6, 10), (54, 12), (3, 30), (56, 30), (50, 2)):
        stamp(cv, x, y, _SATYR_NOTE)
    return finish(cv)


SATYR64 = _satyr()
SATYR64_MAT = {
    "a": M((244, 206, 170), "skin"), "b": M((236, 198, 162), "skin"),
    "p": M((236, 190, 90), "plant", outline=(90, 60, 30)),
    "P": M((150, 110, 60), "plant", outline=(90, 60, 30)),
    "c": M((140, 70, 44), "fur"), "C": M((190, 110, 64), "fur", over="c"),
    "k": M((70, 40, 30), "gem", flat=True),
    "w": M((236, 226, 200), "stone"),
    "f": M((150, 100, 64), "fur"), "F": M((130, 86, 56), "fur"),
    "h": M((60, 44, 40), "stone"),
    "g": M((90, 160, 70), "plant"), "G": M((150, 206, 100), "plant", over="g"),
    "n": M((255, 246, 200), "gem", flat=True, outline=False),
}
SATYR64_MAT["q"] = M((246, 150, 140), "skin", over="a")

# --------------------------------------------------------------------------
# NEMEAN LION (64) - its hide has never once been cut. Seated and serene,
# coat shining like beaten gold, the heads of the arrows that tried lying
# snapped at its paws.
# --------------------------------------------------------------------------
def _nemean_mane():
    """A heavy mane, darker at the rim, notched into tufts."""
    rows = inset(spans(40, ellipse(40, 36), "r"), "r", "R", 5)
    rows = [list(r) for r in rows]
    for y, x in ((0, 16), (0, 23), (1, 10), (1, 29), (3, 5), (3, 34), (6, 2),
                 (6, 37), (10, 0), (10, 39), (15, 0), (15, 39), (21, 0),
                 (21, 39), (26, 1), (26, 38), (30, 4), (30, 35), (33, 9),
                 (33, 30), (35, 15), (35, 24)):
        rows[y][x] = "."
    return ["".join(r) for r in rows]


_NEM_MANE = _nemean_mane()
_NEM_FACE = spans(24, ellipse(24, 22), "a")
_NEM_FEATURES = sym(
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....kkkk....",
    "...kyyyyk...",
    "....kYyk....",
    "............",
    "..........mm",
    ".........mnn",
    "........mmnn",
    ".......mmmmm",
    ".......mmmmq",
    "........mmqm",
    ".........mmm",
)
_NEM_EAR = rows_of(7, "..rrr..", ".rrrrr.", "rraaarr", "raaaaar", ".rrrrr.")
_NEM_BODY = spans(30, ellipse(30, 28), "a")
_NEM_CHEST = spans(30, [None] * 2 + [(10, 19), (9, 20), (9, 20), (9, 20), (10, 19),
                                      (10, 19), (11, 18), (12, 17), (13, 16)], "m")
_NEM_LEG = rows_of(9,
    ".lllllll.", "lllllllll", "lllllllll", "lllllllll", "lllllllll", "lllllllll",
    "lllllllll", "lllllllll", "lllllllll", "lllllllll", "lllllllll", "PPPPPPPPP",
    "PPPPPPPPP", "P.PP.PP.P",
)
_NEM_ARROW_L = rows_of(14,
    "..............",
    "ss............",
    "sss...........",
    "sswwwwwww.....",
    "sss...........",
    "ss............",
)
_NEM_ARROW_R = rows_of(12,
    "..........ww",
    "........www.",
    "......www...",
    "....ww......",
    "..ss........",
    ".sss........",
    "sss.........",
)


def _nemean():
    cv = canvas(64, 64)
    tube(cv, [(44, 52, 2.5), (53, 50, 2.3), (57, 43, 2), (55, 37, 2)], "l")
    stamp(cv, 51, 32, spans(8, ellipse(8, 7), "r"))
    stamp(cv, 17, 31, _NEM_BODY)
    stamp(cv, 17, 31, _NEM_CHEST, onto=True)
    stamp(cv, 12, 2, _NEM_MANE)
    stamp(cv, 16, 4, _NEM_EAR)
    stamp(cv, 41, 4, _NEM_EAR)
    stamp(cv, 20, 9, _NEM_FACE)
    stamp(cv, 20, 9, _NEM_FEATURES, onto=True)
    stamp(cv, 20, 46, _NEM_LEG)
    stamp(cv, 35, 46, _NEM_LEG)
    stamp(cv, 2, 55, _NEM_ARROW_L)
    stamp(cv, 50, 53, _NEM_ARROW_R)
    return finish(cv)


NEMEAN64 = _nemean()
NEMEAN64_MAT = {
    # the hide is lit as metal: it has never been cut because it is not fur
    "a": M((236, 190, 84), "metal", outline=(96, 60, 24)),
    "l": M((226, 178, 76), "metal", outline=(96, 60, 24)),
    "P": M((200, 150, 66), "metal", outline=(96, 60, 24)),
    "m": M((252, 236, 190), "metal", over="a"),
    "r": M((150, 84, 40), "fur"), "R": M((190, 116, 54), "fur", over="r"),
    "n": M((80, 44, 36), "gem", flat=True), "q": M((120, 60, 40), "gem", flat=True),
    "k": M((70, 40, 24), "gem", flat=True),
    "y": M((120, 190, 110), "gem", flat=True), "Y": M((210, 250, 200), "gem", flat=True),
    "s": M((170, 176, 190), "metal"), "w": M((150, 110, 70), "matte"),
}

# --------------------------------------------------------------------------
# SIREN (64) - the song is the dangerous part. She sits on a floe with her
# tail over the edge, eyes shut, mid-verse; the notes that come off her go
# cold as they leave.
# --------------------------------------------------------------------------
_SIREN_HEAD = spans(20, ellipse(20, 18), "a")
_SIREN_FACE = sym(
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..kkk.....",
    ".k...k....",
    "..........",
    "..pp......",
    ".........q",
    "........qq",
    ".........q",
)
_SIREN_FRINGE = rows_of(22,
    "....hhhhhhhhhhhhhh....",
    "..hhhhhhhhhhhhhhhhhh..",
    ".hhhhHHhhhhhhhhhhhhhh.",
    "hhhHHHHhhhhhhhhhhhhhhh",
    "hhhHHhhhhhhhhhhhhhhhhh",
    "hhhhhhhh.hhhhhhhhhhhhh",
    "hhhhhh.....h.....hhhhh",
    "hhhh...............hhh",
    "hhh.................hh",
    "hh...................h",
)
_SIREN_TORSO = spans(16, [(4, 11), (3, 12), (2, 13), (2, 13), (2, 13), (2, 13),
                          (3, 12), (3, 12), (3, 12), (4, 11), (4, 11), (4, 11)], "a")
_SIREN_SHELL = [r.ljust(16, ".") for r in (
    "",
    "",
    "",
    "...cCc..cCc",
    "..cCcCccCcCc",
    "..ccccc.cccc",
)]
_SIREN_FIN = rows_of(12,
    "ff........ff",
    "fFf......fFf",
    ".fFff..ffFf.",
    ".ffFFffFFff.",
    "..ffFFFFff..",
    "...ffFFff...",
    "....ffff....",
)
_SIREN_ROCK = spans(44, ellipse(44, 16), "i")
_SIREN_ROCK = inset(_SIREN_ROCK, "i", "I", 3)
_SIREN_NOTE = rows_of(4, "...n", "..nn", "..n.", "..n.", "nnn.", "nnn.")
_SIREN_NOTE2 = rows_of(6, ".nnnnn", ".n...n", ".n...n", "nn..nn", "nn..nn")


def _siren():
    cv = canvas(64, 64)
    # hair streams back and down behind her
    tube(cv, [(24, 14, 6), (18, 24, 6), (15, 34, 5), (12, 43, 4), (14, 50, 2.5)], "h")
    tube(cv, [(22, 18, 2), (17, 28, 2.4), (14, 40, 1.8)], "H")
    stamp(cv, 10, 48, _SIREN_ROCK)
    # the tail curls over the rock's lip, fin trailing in the water
    tube(cv, [(32, 40, 6), (34, 47, 6), (42, 51, 5), (50, 50, 3.5), (55, 45, 2)], "b")
    scales(cv, "b", "B", 4)
    stamp(cv, 50, 36, _SIREN_FIN)
    stamp(cv, 24, 28, _SIREN_TORSO)
    stamp(cv, 24, 28, _SIREN_SHELL, onto=True)
    # one hand to her chest; the other braced on the rock
    tube(cv, [(37, 30, 2.2), (39, 35, 2), (34, 34, 1.8)], "a")
    tube(cv, [(26, 30, 2.2), (21, 38, 2), (19, 46, 1.8), (18, 50, 1.8)], "a")
    stamp(cv, 22, 11, _SIREN_HEAD)
    stamp(cv, 22, 11, _SIREN_FACE, onto=True)
    stamp(cv, 21, 7, _SIREN_FRINGE)
    stamp(cv, 22, 7, rows_of(6, ".sss..", "sSSsss", ".ssss."))
    for x, y, note in ((46, 12, _SIREN_NOTE), (54, 22, _SIREN_NOTE2),
                       (50, 2, _SIREN_NOTE2), (58, 8, _SIREN_NOTE)):
        stamp(cv, x, y, note)
    return finish(cv)


SIREN64 = _siren()
SIREN64_MAT = {
    "a": M((248, 218, 206), "skin"), "p": M((246, 160, 170), "skin", over="a"),
    "q": M((140, 70, 100), "gem", flat=True), "k": M((60, 40, 80), "gem", flat=True),
    "h": M((74, 186, 196), "fur"), "H": M((150, 226, 226), "fur", over="h"),
    "b": M((96, 150, 214), "scale"), "B": M((70, 116, 190), "scale", over="b"),
    "f": M((140, 200, 240), "gem"), "F": M((210, 240, 255), "gem"),
    "c": M((246, 170, 190), "stone"), "C": M((255, 220, 230), "stone", over="c"),
    "i": M((196, 222, 240), "stone"), "I": M((226, 242, 255), "stone"),
    "s": M((246, 220, 230), "stone"), "S": M((255, 250, 250), "stone"),
    "n": M((200, 230, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# TALOS (64) - bronze, tireless, and slightly leaking. The one vein of ichor
# that keeps him going runs from his neck to a nail in his ankle, and the
# nail was never quite tight.
# --------------------------------------------------------------------------
_TALOS_HELM = spans(20, ellipse(20, 20), "a")
_TALOS_VISOR = rows_of(20,
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "...kkkkkkkkkkkkkk...",
    "...keeekkkkkeeek....",
    "...kkkkkkkkkkkkkk...",
    ".......kkkkkk.......",
    "........kkkk........",
    "........kkkk........",
    "........kkkk........",
    "........kkkk........",
    ".........kk.........",
)
_TALOS_CUIRASS = spans(28, [(8, 19), (4, 23), (2, 25), (1, 26), (1, 26), (1, 26),
                            (1, 26), (2, 25), (2, 25), (3, 24), (3, 24), (4, 23),
                            (4, 23), (5, 22), (5, 22), (5, 22), (5, 22), (6, 21),
                            (6, 21)], "a")
_TALOS_MUSCLE = rows_of(28,
    "............................",
    "............................",
    "............................",
    "......qqqqqq....qqqqqq......",
    ".....q..v...qqqq...v..q.....",
    "............................",
    "............................",
    "..........qq....qq..........",
    "..........qq....qq..........",
    "............................",
    "..........qq....qq..........",
    "..........qq....qq..........",
    "............................",
    "..........qq....qq..........",
)
_TALOS_SHIELD = spans(22, ellipse(22, 22), "b")
_TALOS_SHIELD = inset(_TALOS_SHIELD, "b", "c", 2)
_TALOS_BOLT = rows_of(10,
    "......eeee",
    ".....eeee.",
    "....eeee..",
    "...eeEeeee",
    "......eee.",
    ".....eee..",
    "....eee...",
    "...ee.....",
    "..e.......",
)
_TALOS_SKIRT = rows_of(22,
    "pp.pp.pp.pp.pp.pp.pp.p",
    "pp.pp.pp.pp.pp.pp.pp.p",
    "pp.pp.pp.pp.pp.pp.pp.p",
    "pp.pp.pp.pp.pp.pp.pp.p",
    "PP.PP.PP.PP.PP.PP.PP.P",
)
_TALOS_LEG = rows_of(7,
    "aaaaaaa", "aaaaaaa", "aaaaaaa", ".aaaaa.", ".ggggg.", ".ggggg.", ".ggggg.",
    ".ggggg.", ".ggggg.", ".ggggg.", ".aaaaa.", "aaaaaaa", "aaaaaaa",
)
_TALOS_SPARK = rows_of(5, "..s..", ".sSs.", "sSSSs", ".sSs.", "..s..")


def _talos():
    cv = canvas(64, 64)
    # spear, upright in the right hand
    for y in range(8, 63):
        cv[y][52] = cv[y][53] = "w"
    stamp(cv, 50, 0, rows_of(6, "..xx..", ".xXXx.", ".xXXx.", "xXXXxx",
                             "xxxxxx", "..xx..", "..xx..", "..xx.."))
    # the horsehair crest, front to back over the helmet
    tube(cv, [(24, 6, 1.8), (27, 2, 2.2), (32, 0.5, 2.4), (37, 2, 2.2), (40, 6, 1.8)], "r")
    stamp(cv, 22, 46, _TALOS_LEG)
    stamp(cv, 35, 46, _TALOS_LEG)
    stamp(cv, 18, 22, _TALOS_CUIRASS)
    stamp(cv, 18, 22, _TALOS_MUSCLE, onto=True)
    stamp(cv, 21, 40, _TALOS_SKIRT)
    # arms: one up to the spear, one braced behind the shield
    tube(cv, [(44, 26, 3.5), (50, 32, 3.2), (52, 38, 3)], "a")
    tube(cv, [(20, 26, 3.5), (14, 32, 3.2), (12, 36, 3)], "a")
    stamp(cv, 49, 36, rows_of(6, "aaaaaa", "aaaaaa", "aaaaaa"))
    stamp(cv, 0, 26, _TALOS_SHIELD)
    stamp(cv, 6, 32, _TALOS_BOLT)
    stamp(cv, 22, 6, _TALOS_HELM)
    stamp(cv, 22, 6, _TALOS_VISOR, onto=True)
    # the ichor vein, and the nail in the ankle where it leaks
    for x, y in ((32, 26), (32, 27), (31, 28), (31, 29), (31, 30), (32, 31),
                 (32, 32), (32, 33), (33, 34), (33, 35), (33, 36), (34, 37),
                 (34, 38), (35, 39), (37, 46), (37, 47), (38, 48), (38, 49),
                 (38, 50), (38, 51), (38, 52), (38, 53), (38, 54)):
        if cv[y][x] != ".":
            cv[y][x] = "i"
    # what says "statue" rather than "sunburn": verdigris in the hollows,
    # rivets along the plates, a seam at every joint
    for cx, cy, r in ((6, 40, 3.5), (15, 29, 2.5), (40, 20, 2.5), (25, 21, 2),
                      (24, 56, 2.5), (40, 50, 2), (47, 30, 2), (21, 37, 2)):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and cv[y][x] in "abcg":
                    cv[y][x] = "z" if (x + y) % 3 else "Z"
    for x, y in ((21, 25), (24, 24), (39, 24), (42, 25), (19, 29), (44, 29),
                 (23, 49), (28, 49), (36, 49), (41, 49), (2, 37), (11, 28), (19, 37)):
        if cv[y][x] != ".":
            cv[y][x] = "v"
    for x, y in ((47, 30), (48, 31), (49, 32), (16, 30), (15, 31), (14, 32),
                 (22, 52), (23, 52), (24, 52), (25, 52), (26, 52), (27, 52), (28, 52),
                 (35, 52), (36, 52), (37, 52), (39, 52), (40, 52), (41, 52)):
        if cv[y][x] in "abgzZ":
            cv[y][x] = "q"
    stamp(cv, 37, 55, rows_of(3, "nnn", "nNn", "nnn"))
    stamp(cv, 41, 57, rows_of(2, "i.", "ii", "ii", ".i"))
    for x, y in ((56, 14), (4, 12), (58, 44)):
        stamp(cv, x, y, _TALOS_SPARK)
    return finish(cv)


TALOS64 = _talos()
TALOS64_MAT = {
    "a": M((210, 136, 70), "metal", outline=(80, 40, 20)),
    "b": M((196, 124, 64), "metal", outline=(80, 40, 20)),
    "c": M((222, 160, 90), "metal", outline=(80, 40, 20)),
    "g": M((230, 170, 90), "metal", outline=(80, 40, 20)),
    "q": M((130, 72, 40), "metal", over="a"), "v": M((255, 226, 170), "metal", over="a"),
    "z": M((96, 170, 140), "stone", over="a"), "Z": M((130, 196, 160), "stone", over="a"),
    "k": M((40, 24, 20), "gem", flat=True),
    "e": M((140, 240, 255), "gem", emissive=0.9), "E": M((255, 255, 255), "gem", emissive=1.0),
    "r": M((200, 50, 50), "fur"),
    "p": M((120, 70, 44), "matte"), "P": M((230, 170, 90), "metal"),
    "w": M((130, 90, 60), "matte"),
    "x": M((200, 206, 220), "metal"), "X": M((250, 252, 255), "metal"),
    "i": M((255, 214, 90), "gem", emissive=0.9),
    "n": M((110, 110, 120), "metal"), "N": M((200, 200, 210), "metal"),
    "s": M((180, 240, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# ---------------------------------------------------------------------------
ART = {
    "pixie": (PIXIE64, PIXIE64_MAT),
    "kitsune": (KITSUNE64, KITSUNE64_MAT),
    "kappa": (KAPPA64, KAPPA64_MAT),
    "thunderbird": (THUNDERBIRD64, THUNDERBIRD64_MAT),
    "golem": (GOLEM64, GOLEM64_MAT),
    "wisp": (WISP64, WISP64_MAT),
    "naga": (NAGA64, NAGA64_MAT),
    "tengu": (TENGU64, TENGU64_MAT),
    "mandrake": (MANDRAKE64, MANDRAKE64_MAT),
    "cerberus": (CERBERUS64, CERBERUS64_MAT),
    "baku": (BAKU64, BAKU64_MAT),
    "anubis": (ANUBIS64, ANUBIS64_MAT),
    "minotaur": (MINOTAUR64, MINOTAUR64_MAT),
    "medusa": (MEDUSA64, MEDUSA64_MAT),
    "harpy": (HARPY64, HARPY64_MAT),
    "cyclops": (CYCLOPS64, CYCLOPS64_MAT),
    "pegasus": (PEGASUS64, PEGASUS64_MAT),
    "chimera": (CHIMERA64, CHIMERA64_MAT),
    "satyr": (SATYR64, SATYR64_MAT),
    "nemean": (NEMEAN64, NEMEAN64_MAT),
    "siren": (SIREN64, SIREN64_MAT),
    "talos": (TALOS64, TALOS64_MAT),
}

_cache = {}
_icons = {}


# Sprites authored at this width or more are already at their display size,
# so they skip the EPX upscale and are lit at their own resolution.
NATIVE_WIDTH = 48


def sprite(key):
    """The lit battle sprite. Art authored at 32x32 is doubled to 64x64;
    art authored at 64x64 is lit as it stands."""
    if key not in _cache:
        rows, mats = ART[key]
        native = max(len(r) for r in rows) >= NATIVE_WIDTH
        # Native art has its detail drawn in; the procedural texture is only
        # for keeping upscaled 32x32 forms from looking like poured plastic.
        _cache[key] = shading.render(rows, mats, upscale=not native,
                                     detail=not native)
    return _cache[key]


def icon(key, size=32):
    """A small version for menus and the bestiary."""
    k = (key, size)
    if k not in _icons:
        import pygame
        _icons[k] = pygame.transform.smoothscale(sprite(key), (size, size))
    return _icons[k]


def prebuild():
    """Light every sprite up front so no battle stutters on first sight."""
    for key in ART:
        sprite(key)
