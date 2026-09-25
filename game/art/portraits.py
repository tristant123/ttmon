"""Dialogue portraits, after the GBA Fire Emblems.

What makes those portraits read the way they do, and what this module copies:

* **The frame.** 96x80 pixels on a 240x160 screen - the same space this
  game's UI is laid out in - so a portrait is authored at that size and
  doubled like the rest of the UI. Every pixel is a deliberate cluster, not
  a smoothed curve.
* **Five tones, not two.** Each material has a deep shadow, a shadow, a
  base, a light and a highlight. Form shadows are hard-edged bands down the
  side away from the light, with the deep tone packed against the outline;
  hair gets a jagged band of gloss across its clumps; metal gets a bright
  edge and a dark core.
* **Dark outlines everywhere**, inside as well as out: between clumps of
  hair, along a collar, round a pauldron. They are hue-tinted, never black.
* **A face per character.** The head is built from a base - brow, cheek,
  jaw, chin - with shapes for youth, age, a sharp jaw, a round one.
* **They talk.** A Fire Emblem portrait blinks and moves its mouth while its
  text is printing. Each portrait is built in frames: eyes open, half and
  shut; mouth closed and open.

Faces are drawn turned to the viewer's right, looking across at whoever
they are speaking to; one shown on the right of the box is mirrored.
"""

import pygame

from .shading import COOL_HUE, WARM_HUE, _shift

W, H = 96, 80           # in UI pixels; shown at 2x
CLEAR = "."

# tone indices
DEEP, SHADE, BASE, LIGHT, SHINE = range(5)


class Ink:
    """One portrait material and its five tones.

    `of` makes an ink a tone of another: painting "s" with of="a", tone=SHADE
    places a hand-drawn shadow that belongs to the skin's region for lines
    and form. `layer` decides which side of a join draws the line: the one in
    front. `casts` lists (group, dx, dy) this ink throws its shape onto.
    """

    def __init__(self, base, deep=None, shadow=None, light=None, shine=None,
                 line=None, inner=None, layer=0, form=(2, 1), rim=True,
                 flat=False, of=None, tone=None, casts=(), deep_band=True):
        self.base = base
        self.shadow = shadow or _shift(base, COOL_HUE, 0.14, 1.10, 0.80)
        self.deep = deep or _shift(self.shadow, COOL_HUE, 0.14, 1.10, 0.78)
        self.light = light or _shift(base, WARM_HUE, 0.10, 0.86, 1.10)
        self.shine = shine or _shift(self.light, WARM_HUE, 0.10, 0.6, 1.12)
        self.line = line or _shift(self.deep, COOL_HUE, 0.2, 1.1, 0.42)
        self.inner = inner or _shift(self.deep, COOL_HUE, 0.1, 1.05, 0.7)
        self.layer = layer
        self.form = form
        self.rim = rim
        self.flat = flat
        self.of = of
        self.tone = tone
        self.casts = casts
        self.deep_band = deep_band

    def tones(self):
        return (self.deep, self.shadow, self.base, self.light, self.shine)


def I(base, **kw):
    return Ink(base, **kw)


def tone_of(of, tone):
    return Ink((0, 0, 0), of=of, tone=tone)


# -- drawing helpers --------------------------------------------------------

def canvas(w=W, h=H):
    return [[CLEAR] * w for _ in range(h)]


def put(cv, x, y, ch, onto=None):
    if 0 <= y < len(cv) and 0 <= x < len(cv[0]):
        if onto is None or cv[y][x] in onto:
            cv[y][x] = ch


def poly(cv, pts, ch, onto=None):
    """Even-odd scanline fill. `onto` limits the paint to those characters."""
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(len(cv), int(max(ys)) + 1)):
        yc = y + 0.5
        xs = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(max(0, int(a + 0.5)), min(len(cv[0]), int(b + 0.5))):
                if onto is None or cv[y][x] in onto:
                    cv[y][x] = ch


def oval(cv, cx, cy, rx, ry, ch, onto=None):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                put(cv, x, y, ch, onto)


def _bez(p0, c, p1, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])


def lock(cv, p0, c, p1, r0, r1, ch, onto=None):
    """A tapered strand along a quadratic curve: a clump of hair ending in a
    point, a fold of cloth, a tail."""
    n = int(max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1])) * 3) + 4
    for i in range(n + 1):
        t = i / n
        x, y = _bez(p0, c, p1, t)
        r = r0 + (r1 - r0) * t
        if r < 0.75:
            put(cv, int(x), int(y), ch, onto)
        else:
            oval(cv, x, y, r, r, ch, onto)


def line(cv, pts, ch, onto=None):
    """A one-pixel polyline."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            put(cv, round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n),
                ch, onto)


def curve(cv, p0, c, p1, ch, onto=None):
    """A one-pixel quadratic curve."""
    n = int(max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1])) * 2) + 2
    for i in range(n + 1):
        x, y = _bez(p0, c, p1, i / n)
        put(cv, round(x), round(y), ch, onto)


def stamp(cv, x, y, rows, onto=None):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != CLEAR:
                put(cv, x + i, y + j, ch, onto)


def shifted(pts, dx=0, dy=0):
    return [(x + dx, y + dy) for x, y in pts]


# -- rendering --------------------------------------------------------------

def render(cv, inks):
    h, w = len(cv), len(cv[0])

    def group(ch):
        ink = inks[ch]
        return ink.of or ch

    grid = [[group(ch) if ch != CLEAR else None for ch in row] for row in cv]
    # Flat marks - eyes, mouths, scars - are painted on a surface, not shapes
    # of their own: for lines and form they count as whatever is around them.
    # Without this the skin outlines every mark and a mouth becomes a pout.
    for y in range(h):
        for x in range(w):
            ch = cv[y][x]
            if ch != CLEAR and inks[ch].flat:
                around = [grid[y + j][x + i] for i, j in ((-1, 0), (1, 0), (0, -1), (0, 1),
                                                         (-2, 0), (2, 0), (0, -2), (0, 2))
                          if 0 <= x + i < w and 0 <= y + j < h and cv[y + j][x + i] != CLEAR
                          and not inks[cv[y + j][x + i]].flat]
                if around:
                    grid[y][x] = max(set(around), key=around.count)

    def g_at(x, y):
        if 0 <= x < w and 0 <= y < h:
            return grid[y][x]
        return None

    casts = {}
    for key, ink in inks.items():
        for target, dx, dy in ink.casts:
            casts.setdefault(target, []).append((key, dx, dy))

    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    for y in range(h):
        for x in range(w):
            ch = cv[y][x]
            if ch == CLEAR:
                continue
            ink = inks[ch]
            if ink.flat:
                surf.set_at((x, y), ink.base)
                continue
            g = grid[y][x]
            host = inks[g]
            n4 = ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            if any(g_at(nx, ny) is None for nx, ny in n4):
                surf.set_at((x, y), host.line)
                continue
            front = False
            for nx, ny in n4:
                other = g_at(nx, ny)
                if other != g and inks[other].layer < host.layer:
                    front = True
                    break
            if front:
                surf.set_at((x, y), host.inner)
                continue
            if ink.tone is not None:
                tone = ink.tone
            else:
                tone = BASE
                fx, fy = host.form
                if (fx or fy) and g_at(x + fx, y + fy) != g:
                    tone = SHADE
                    if host.deep_band and g_at(x + (fx > 0), y + (fy > 0)) != g:
                        tone = DEEP
                for caster, dx, dy in casts.get(g, ()):
                    if g_at(x - dx, y - dy) == caster:
                        tone = DEEP if tone == SHADE else SHADE
                        break
                if tone == BASE and host.rim and g_at(x - 1, y - 1) != g \
                        and g_at(x - 1, y) != g:
                    tone = LIGHT
            surf.set_at((x, y), host.tones()[tone])
    return surf


# -- the head -----------------------------------------------------------------
#
# Turned to the viewer's right. The near cheek is on the left with the ear
# behind it; the far side of the face runs brow, eye socket, cheekbone, jaw.
# Coordinates are for the default head; `dx`, `dy` move a whole head.

FACES = {
    # a young, clean jaw with a pointed chin
    "young": [(32, 21), (31, 30), (32, 36), (35, 42), (40, 47), (45, 50), (49, 51),
              (52, 49), (55, 45), (58, 40), (59, 36), (60, 31), (61, 26), (60, 19),
              (52, 14), (40, 15)],
    # the same, narrower and harder at the jaw
    "sharp": [(33, 21), (32, 30), (33, 36), (36, 42), (41, 47), (46, 50), (49, 51),
              (52, 49), (55, 45), (57, 40), (58, 36), (59, 31), (60, 26), (59, 19),
              (52, 14), (40, 15)],
    # a child: round cheek, short chin, the eyes further down the face
    "round": [(32, 23), (31, 32), (32, 38), (35, 43), (40, 47), (45, 49), (49, 49),
              (53, 47), (57, 43), (59, 38), (60, 33), (61, 27), (60, 20),
              (52, 16), (40, 17)],
    # an old man's long face, hollow under the cheekbone
    "old": [(32, 20), (31, 30), (33, 37), (36, 43), (40, 48), (45, 51), (49, 52),
            (52, 50), (55, 46), (57, 42), (57, 38), (59, 34), (60, 28), (60, 19),
            (52, 13), (40, 14)],
}
EAR = [(33, 29), (29, 27), (28, 32), (30, 38), (34, 39)]
NECK = [(38, 44), (37, 58), (45, 62), (53, 57), (53, 47)]


def head(cv, face="young", dx=0, dy=0, ear=True, neck=True):
    if neck:
        poly(cv, shifted(NECK, dx, dy), "n")
    if ear:
        poly(cv, shifted(EAR, dx, dy), "e")
        put(cv, 30 + dx, 32 + dy, "u")                   # the ear's hollow
        put(cv, 31 + dx, 33 + dy, "u")
    poly(cv, shifted(FACES[face], dx, dy), "a")
    # the shadow the chin throws down the neck: with the band down the far
    # side of the face, the shape that turns a disc into a head
    poly(cv, shifted([(38, 47), (53, 49), (51, 53), (44, 54), (38, 51)], dx, dy), "S",
         onto="n")


def uncover(cv, below, face="young", dx=0, dy=0):
    """Put the face back below a hairline after the hair mass has gone over
    the whole skull; the fringe is then laid over it lock by lock."""
    tmp = canvas(len(cv[0]), len(cv))
    poly(tmp, shifted(FACES[face], dx, dy), "a")
    for y in range(below + dy, len(cv)):
        for x in range(len(cv[0])):
            if tmp[y][x] != CLEAR:
                cv[y][x] = tmp[y][x]


# Eyes, in Fire Emblem's construction: a heavy upper lash that thickens to
# the outer corner, an iris that fills most of the eye with its dark at the
# top, a single glint, and white only at the corners.
#   K lash  W white  D iris dark  I iris  L iris light  P pupil  G glint
#   k lower lid
EYES = {
    "open": ([
        "..KKKKK.",
        ".KKKKKKK",
        "KKWDDDDK",
        "..WDGPDW",
        "..WIPPIW",
        "..WLIIL.",
        "...kkk..",
    ], [
        "KKKKK.",
        "KKKKKK",
        "DDDDWK",
        "DGPW..",
        "IPIW..",
        "LIL...",
        ".kk...",
    ]),
    "half": ([
        "........",
        "........",
        "..KKKKK.",
        "KKKKKKKK",
        "..WIPPIW",
        "..WLIIL.",
        "...kkk..",
    ], [
        "......",
        "......",
        "KKKKK.",
        "KKKKKK",
        "IPIW..",
        "LIL...",
        ".kk...",
    ]),
    "shut": ([
        "........",
        "........",
        "........",
        "........",
        "KKKKKKK.",
        "..kKKKk.",
        "........",
    ], [
        "......",
        "......",
        "......",
        "......",
        "KKKKK.",
        ".KKk..",
        "......",
    ]),
}
EYES_AT = ((36, 29), (50, 29))


def eyes(cv, state="open", dx=0, dy=0, shapes=None, at=EYES_AT):
    near, far = (shapes or EYES)[state]
    stamp(cv, at[0][0] + dx, at[0][1] + dy, near)
    stamp(cv, at[1][0] + dx, at[1][1] + dy, far)


def eye_inks(iris, lash=(38, 24, 30)):
    return {
        "K": I(lash, flat=True),
        "k": I(_shift(lash, WARM_HUE, 0.0, 0.7, 2.6), flat=True),
        "W": I((248, 244, 236), flat=True),
        "D": I(_shift(iris, COOL_HUE, 0.10, 1.1, 0.55), flat=True),
        "I": I(iris, flat=True),
        "L": I(_shift(iris, WARM_HUE, 0.05, 0.85, 1.25), flat=True),
        "P": I(_shift(iris, COOL_HUE, 0.25, 1.2, 0.26), flat=True),
        "G": I((255, 255, 255), flat=True),
    }


MOUTHS = {
    "shut": ["mmm"],
    "open": ["mmmm", "mttm", ".mm."],
}


def mouth(cv, state="shut", dx=0, dy=0, at=(47, 44), shapes=None):
    stamp(cv, at[0] + dx, at[1] + dy, (shapes or MOUTHS)[state])


def nose(cv, dx=0, dy=0, at=(54, 38)):
    """The nose is two marks: the shadow under the tip and a lit bridge."""
    put(cv, at[0] + dx, at[1] + dy, "q")
    put(cv, at[0] + 1 + dx, at[1] - 1 + dy, "q")
    put(cv, at[0] - 1 + dx, at[1] - 3 + dy, "l", onto="a")


def skin_inks(base=(250, 212, 172), line=(96, 44, 40)):
    """A Fire Emblem skin ramp: warm, the shadows toward rose, not grey."""
    light = _shift(base, WARM_HUE, 0.1, 0.7, 1.05)
    shadow = _shift(base, 0.99, 0.35, 1.45, 0.88)
    deep = _shift(base, 0.98, 0.45, 1.8, 0.70)
    common = dict(deep=deep, shadow=shadow, light=light, line=line,
                  inner=_shift(deep, 0.98, 0.2, 1.1, 0.72))
    return {
        "a": I(base, layer=2, form=(1, 0), rim=False, deep_band=False, **common),
        "s": tone_of("a", SHADE),
        "l": tone_of("a", LIGHT),
        "e": I(base, layer=1, form=(2, 0), rim=False, **common),
        "u": tone_of("e", DEEP),
        "n": I(base, layer=1, form=(3, 0), rim=False, **common),
        "S": tone_of("n", DEEP),
        "m": I(_shift(base, 0.98, 0.3, 1.5, 0.50), flat=True),
        "t": I(_shift(base, 0.98, 0.3, 1.4, 0.80), flat=True),
        "q": I(shadow, flat=True),
    }


# -- the cast -----------------------------------------------------------------

def _hero(eye="open", talk="shut"):
    """The binder: a travelling coat with a raised collar, a satchel strap,
    green hair worn long enough to blow about."""
    cv = canvas()
    # the coat: the near shoulder is lower and nearer, the far one turned away
    poly(cv, [(2, 80), (4, 70), (12, 62), (26, 57), (37, 55), (54, 55), (66, 57),
              (80, 62), (90, 70), (94, 80)], "c")
    # the arms: a seam from each armpit, the near arm's side in shadow
    curve(cv, (18, 64), (22, 72), (21, 80), "x")
    curve(cv, (76, 64), (72, 72), (73, 80), "x")
    poly(cv, [(2, 80), (4, 72), (12, 64), (17, 66), (20, 80)], "x", onto="c")
    poly(cv, [(76, 66), (84, 64), (92, 72), (94, 80), (80, 80)], "X", onto="c")
    poly(cv, [(36, 52), (31, 64), (41, 72), (44, 58)], "C")            # collar
    poly(cv, [(53, 52), (61, 63), (51, 72), (50, 58)], "C")
    poly(cv, [(43, 58), (51, 58), (50, 74), (44, 74)], "i")            # shirt
    poly(cv, [(64, 57), (71, 58), (46, 80), (38, 80)], "b")            # strap
    stamp(cv, 55, 66, ["gg", "gG", "gg"])                                # buckle
    head(cv)
    # hair: the mass, the face back under the hairline, then the clumps
    oval(cv, 46, 21, 18, 14, "h")
    poly(cv, [(30, 20), (29, 36), (32, 42), (35, 26)], "h")            # sideburn
    uncover(cv, 24)
    for p0, c, p1, r in (
            ((34, 16), (26, 26), (29, 40), 3.6),     # behind the ear
            ((38, 17), (32, 26), (34, 36), 3.4),
            ((43, 18), (39, 26), (40, 31), 3.2),     # fringe
            ((48, 18), (47, 26), (45, 33), 3.0),     # the lock between the eyes
            ((53, 18), (55, 24), (53, 29), 2.8),
            ((58, 18), (61, 23), (60, 29), 2.4),
            ((61, 20), (65, 26), (63, 33), 2.0),
            ((46, 10), (38, 2), (24, 4), 3.6),       # swept back, spiked
            ((40, 12), (28, 8), (16, 14), 3.6),
            ((35, 17), (23, 18), (13, 26), 3.2),
            ((33, 24), (22, 30), (18, 40), 2.6),
            ((54, 10), (54, 5), (47, 2), 2.2)):
        lock(cv, p0, c, p1, r, 0.5, "h")
    # clefts between the clumps, and the gloss across the crown
    for p0, c, p1 in (((41, 21), (38, 27), (38, 32)), ((46, 21), (45, 27), (43, 31)),
                      ((51, 21), (52, 25), (51, 28)), ((56, 21), (58, 24), (57, 28)),
                      ((32, 12), (26, 14), (20, 20)), ((38, 8), (30, 6), (26, 8))):
        curve(cv, p0, c, p1, "j", onto="hH")
    for p0, c, p1 in (((34, 12), (44, 7), (56, 11)),):
        lock(cv, p0, c, p1, 1.2, 0.5, "H", onto="h")
    eyes(cv, eye)
    line(cv, [(35, 27), (40, 26), (44, 28)], "B", onto="a")             # brows
    line(cv, [(50, 28), (53, 26), (57, 26)], "B", onto="a")
    nose(cv)
    mouth(cv, talk)
    inks = {
        "h": I((72, 160, 108), deep=(22, 70, 66), shadow=(40, 110, 88),
               light=(124, 204, 138), shine=(200, 244, 196), line=(12, 36, 36),
               inner=(18, 56, 52), layer=4, form=(2, 2),
               casts=(("a", 1, 2), ("e", 1, 1), ("n", 1, 2))),
        "H": tone_of("h", SHINE),
        "j": tone_of("h", DEEP),
        "B": I((30, 74, 60), flat=True),
        "c": I((220, 222, 214), deep=(116, 116, 144), shadow=(166, 168, 184),
               light=(244, 246, 240), line=(40, 40, 62), layer=0, form=(4, 3)),
        "C": I((238, 240, 234), deep=(130, 132, 158), shadow=(184, 186, 204),
               line=(40, 40, 62), inner=(92, 92, 120), layer=1, form=(2, 2)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "i": I((64, 74, 110), line=(20, 22, 44), layer=0, form=(2, 1)),
        "b": I((156, 108, 56), line=(52, 30, 16), inner=(84, 52, 26), layer=2,
               form=(0, 2)),
        "g": I((222, 186, 92), line=(80, 52, 16), inner=(120, 80, 28), layer=3,
               form=(1, 1)),
        "G": tone_of("g", SHINE),
    }
    inks.update(skin_inks())
    inks.update(eye_inks((64, 156, 112)))
    return cv, inks


# Narrowed, lidded and wide eye sets, in the same construction.
EYES_OLD = {
    "open": ([
        "........", "........", "..KKKKK.", "KKKKKKKK", "..WDPDW.", "...kkk..",
        "........"], [
        "......", "......", "KKKKK.", "KKKKKK", "DPDW..", ".kk...", "......"]),
    "half": ([
        "........", "........", "........", "..KKKKK.", "KKKKKKKK", "...kkk..",
        "........"], [
        "......", "......", "......", "KKKKK.", "KKKKKK", ".kk...", "......"]),
    "shut": EYES["shut"],
}
EYES_LID = {
    "open": ([
        "........", "..KKKKK.", "KKKKKKKK", "..KWDPDW", "..WIPPIW", "...LIL..",
        "...kkk.."], [
        "......", "KKKKK.", "KKKKKK", "KDPW..", "IPIW..", "LIL...", ".kk..."]),
    "half": ([
        "........", "........", "..KKKKK.", "KKKKKKKK", "..KIPPIW", "...LIL..",
        "...kkk.."], [
        "......", "......", "KKKKK.", "KKKKKK", "KPIW..", "LIL...", ".kk..."]),
    "shut": EYES["shut"],
}
EYES_SHARP = {
    "open": ([
        "....KKK.", "..KKKKKK", "KKKDDDDK", "..WDGPDW", "..WIPPIW", "...LIIL.",
        "....kk.."], [
        "KKKK..", "KKKKKK", "DDDDKK", "DGPW..", "IPIW..", "LIL...", ".k...."]),
    "half": EYES["half"],
    "shut": EYES["shut"],
}
EYES_BIG = {
    "open": ([
        "..KKKKK.", ".KKKKKKK", "KKWDDDDK", "..WGDPDW", "..WDPPIW", "..WLIGL.",
        "...kkk.."], [
        "KKKKK.", "KKKKKK", "DDDDWK", "GDPW..", "DPIW..", "LGL...", ".kk..."]),
    "half": EYES["half"],
    "shut": EYES["shut"],
}


def _body(cv, ch="c", narrow=0, drop=0):
    """Shoulders turned three-quarters: the near one lower and nearer."""
    n, d = narrow, drop
    poly(cv, [(2 + n, 80), (4 + n, 70 + d), (12 + n, 62 + d), (26 + n, 57 + d),
              (37, 55 + d), (54, 55 + d), (66 - n, 57 + d), (80 - n, 62 + d),
              (90 - n, 70 + d), (94 - n, 80)], ch)


def _arms(cv, ch="c", shade="x", light="X", narrow=0, drop=0):
    n, d = narrow, drop
    curve(cv, (18 + n, 64 + d), (22 + n, 72 + d), (21 + n, 80), shade)
    curve(cv, (76 - n, 64 + d), (72 - n, 72 + d), (73 - n, 80), shade)
    poly(cv, [(2 + n, 80), (4 + n, 72 + d), (12 + n, 64 + d), (17 + n, 66 + d),
              (20 + n, 80)], shade, onto=ch)
    poly(cv, [(76 - n, 66 + d), (84 - n, 64 + d), (92 - n, 72 + d), (94 - n, 80),
              (80 - n, 80)], light, onto=ch)


def _elder(eye="open", talk="shut"):
    """Elder Maru: a white topknot, brows that have outlived their colour, a
    beard to the chest, and the staff the Hollow's elders carry."""
    cv = canvas()
    line(cv, [(84, 8), (84, 80)], "w")                                 # the staff
    line(cv, [(85, 8), (85, 80)], "w")
    oval(cv, 84.5, 7, 5, 5, "y")
    oval(cv, 86, 6, 3.6, 3.6, CLEAR, onto="y")                       # its crescent
    _body(cv, narrow=4, drop=1)
    _arms(cv, narrow=4, drop=1)
    poly(cv, [(40, 55), (46, 78), (52, 55)], "v")                      # under-robe
    line(cv, [(39, 55), (46, 80)], "y")
    line(cv, [(53, 55), (46, 80)], "y")
    head(cv, "old")
    oval(cv, 46, 20, 17, 12, "h")
    uncover(cv, 19, "old")
    poly(cv, [(30, 19), (29, 34), (32, 38), (34, 23)], "h")            # side hair
    oval(cv, 40, 7, 5, 4, "h")                                         # topknot
    lock(cv, (40, 4), (37, 0), (33, 0), 2.0, 0.6, "h")
    poly(cv, [(36, 10), (44, 10), (44, 12), (36, 12)], "r")           # its cord
    lock(cv, (34, 12), (44, 8), (56, 12), 1.0, 0.5, "H", onto="h")
    # the beard from the cheeks to the chest, and the moustache over it
    poly(cv, [(33, 38), (36, 45), (41, 50), (46, 53), (51, 52), (55, 47), (58, 42),
              (57, 56), (53, 66), (47, 72), (42, 64), (37, 54)], "h")
    for p0, c, p1 in (((40, 50), (41, 58), (44, 66)), ((46, 54), (47, 62), (47, 70)),
                      ((52, 53), (53, 60), (51, 66)), ((36, 46), (37, 52), (40, 58))):
        curve(cv, p0, c, p1, "j", onto="hH")
    lock(cv, (42, 45), (48, 42), (56, 44), 1.5, 0.8, "h")
    lock(cv, (43, 45), (39, 48), (38, 53), 1.2, 0.5, "h")
    lock(cv, (54, 45), (57, 48), (57, 53), 1.0, 0.5, "h")
    eyes(cv, eye, shapes=EYES_OLD)
    lock(cv, (45, 28), (39, 25), (33, 29), 1.6, 0.5, "h")              # brows
    lock(cv, (50, 28), (54, 25), (59, 27), 1.2, 0.5, "h")
    for pts in ([(38, 21), (46, 20), (54, 21)], [(40, 23), (52, 23)],
                [(34, 31), (33, 34)], [(37, 37), (42, 38)], [(52, 37), (55, 37)]):
        line(cv, pts, "z", onto="a")                                    # the years
    nose(cv, at=(55, 39))
    if talk == "open":
        stamp(cv, 46, 47, ["mmm"])
    inks = {
        "h": I((230, 230, 238), deep=(118, 118, 150), shadow=(178, 178, 200),
               light=(248, 248, 252), shine=(255, 255, 255), line=(58, 58, 84),
               inner=(110, 110, 140), layer=4, form=(2, 2),
               casts=(("a", 1, 2), ("n", 0, 3))),
        "H": tone_of("h", SHINE),
        "j": tone_of("h", SHADE),
        "r": I((176, 56, 64), line=(64, 18, 28), layer=5, form=(0, 1)),
        "c": I((124, 98, 170), deep=(54, 40, 98), shadow=(88, 68, 138),
               light=(160, 136, 208), line=(28, 20, 54), layer=0, form=(4, 3)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "v": I((70, 54, 104), line=(24, 16, 42), layer=1, form=(0, 0)),
        "y": I((232, 192, 96), flat=True),
        "w": I((150, 104, 60), line=(60, 36, 20), layer=0, form=(1, 0)),
        "z": tone_of("a", SHADE),
    }
    inks.update(skin_inks((238, 196, 160), line=(90, 44, 38)))
    inks.update(eye_inks((112, 122, 162), lash=(64, 52, 70)))
    return cv, inks


def _kid(eye="open", talk="shut"):
    """Nen: a cowlick that will not lie down, a plaster on one cheek, and the
    round eyes of someone who knows everything that matters."""
    cv = canvas()
    _body(cv, "c", narrow=8, drop=2)
    _arms(cv, "c", narrow=8, drop=2)
    oval(cv, 46, 57, 15, 5, "C")                                       # the hood, down
    poly(cv, [(40, 56), (52, 56), (46, 66)], "i")
    line(cv, [(42, 60), (41, 72)], "y")                                # drawstrings
    line(cv, [(50, 60), (51, 70)], "y")
    head(cv, "round")
    oval(cv, 46, 22, 18, 14, "h")
    uncover(cv, 25, "round")
    for p0, c, p1, r in (
            ((34, 17), (27, 26), (29, 38), 3.4),
            ((39, 18), (34, 26), (36, 32), 3.2),
            ((44, 19), (41, 26), (41, 30), 3.0),
            ((49, 19), (49, 26), (47, 30), 2.8),
            ((54, 19), (56, 25), (55, 29), 2.6),
            ((59, 19), (62, 24), (61, 30), 2.2),
            ((46, 9), (46, 1), (54, 0), 2.0),        # the cowlick
            ((38, 11), (30, 5), (22, 9), 3.0),
            ((33, 17), (22, 17), (17, 24), 2.8),
            ((32, 25), (24, 30), (22, 38), 2.2)):
        lock(cv, p0, c, p1, r, 0.5, "h")
    for p0, c, p1 in (((42, 22), (39, 27), (39, 31)), ((47, 22), (46, 27), (45, 30)),
                      ((52, 22), (53, 26), (52, 29)), ((57, 22), (59, 25), (58, 28))):
        curve(cv, p0, c, p1, "j", onto="hH")
    lock(cv, (34, 13), (44, 8), (56, 12), 1.2, 0.5, "H", onto="h")
    eyes(cv, eye, shapes=EYES_BIG, dy=1)
    line(cv, [(36, 28), (40, 27), (44, 28)], "B", onto="a")
    line(cv, [(50, 28), (53, 27), (57, 27)], "B", onto="a")
    nose(cv, at=(54, 39))
    mouth(cv, talk, at=(47, 43), shapes={"shut": ["m.m", ".m."],
                                         "open": ["mmm", "mtm", ".m."]})
    stamp(cv, 35, 38, ["pppp", "pPpP"])                                # plaster
    inks = {
        "h": I((116, 104, 186), deep=(46, 38, 104), shadow=(78, 66, 150),
               light=(160, 150, 222), shine=(214, 208, 246), line=(26, 20, 58),
               inner=(44, 36, 96), layer=4, form=(2, 2),
               casts=(("a", 1, 2), ("e", 1, 1), ("n", 1, 2))),
        "H": tone_of("h", SHINE),
        "j": tone_of("h", DEEP),
        "B": I((56, 46, 110), flat=True),
        "c": I((226, 128, 148), deep=(124, 50, 92), shadow=(176, 84, 118),
               light=(248, 170, 180), line=(60, 20, 40), layer=0, form=(4, 3)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "C": I((246, 182, 192), deep=(150, 80, 110), shadow=(206, 128, 152),
               line=(60, 20, 40), inner=(120, 60, 84), layer=1, form=(2, 2)),
        "i": I((96, 72, 108), line=(30, 20, 36), layer=0, form=(0, 0)),
        "y": I((250, 242, 232), flat=True),
        "p": I((242, 228, 204), flat=True),
        "P": I((196, 172, 152), flat=True),
    }
    inks.update(skin_inks((252, 218, 186)))
    inks.update(eye_inks((154, 112, 214), lash=(44, 28, 60)))
    return cv, inks


def _trader(eye="open", talk="shut"):
    """Pell the Trader: a crimson head-wrap with a tail, a gold hoop, eyes
    half closed as if pricing you, and the corner of a smile about it."""
    cv = canvas()
    lock(cv, (30, 20), (18, 36), (20, 64), 4.2, 2.0, "r")              # wrap's tail
    _body(cv)
    _arms(cv)
    poly(cv, [(37, 53), (30, 70), (38, 80), (44, 60)], "d")            # lapels
    poly(cv, [(54, 53), (64, 68), (56, 80), (50, 60)], "d")
    poly(cv, [(44, 58), (50, 58), (50, 80), (44, 80)], "i")
    for k in range(7):                                                  # coin string
        x = 38 + k * 3
        y = 60 + int(((x - 47) / 9.0) ** 2 * 4)
        stamp(cv, x, y, ["yY"])
    head(cv, "sharp")
    poly(cv, [(30, 20), (29, 34), (32, 40), (34, 24)], "h")            # sideburn
    oval(cv, 46, 17, 19, 11, "r")                                      # the wrap
    poly(cv, [(27, 16), (65, 16), (64, 24), (28, 24)], "r")
    uncover(cv, 24, "sharp")
    for p0, c, p1 in (((29, 13), (46, 18), (64, 10)), ((29, 19), (46, 23), (64, 17)),
                      ((33, 8), (46, 12), (60, 6))):
        curve(cv, p0, c, p1, "z", onto="rR")                             # its folds
    lock(cv, (32, 9), (42, 4), (54, 6), 1.0, 0.5, "R", onto="r")
    line(cv, [(28, 23), (46, 25), (64, 22)], "g", onto="r")            # gold band
    for p0, c, p1, r in (((38, 24), (37, 27), (38, 31), 1.8),      # hair under it
                         ((43, 24), (42, 27), (43, 29), 1.5),
                         ((59, 24), (61, 27), (60, 31), 1.4)):
        lock(cv, p0, c, p1, r, 0.5, "h")
    eyes(cv, eye, shapes=EYES_LID)
    line(cv, [(35, 28), (40, 27), (44, 28)], "B", onto="a")
    line(cv, [(50, 27), (53, 25), (57, 25)], "B", onto="a")             # one raised
    nose(cv)
    mouth(cv, talk, at=(46, 44), shapes={"shut": ["...m", "mmm."],
                                         "open": ["mmmm", "mttm", ".mm."]})
    stamp(cv, 29, 38, ["gg", "gG", ".g"])                               # earring
    inks = {
        "r": I((176, 52, 60), deep=(84, 16, 40), shadow=(128, 30, 52),
               light=(220, 96, 92), shine=(250, 160, 140), line=(44, 8, 20),
               inner=(80, 16, 32), layer=5, form=(2, 2),
               casts=(("a", 1, 2), ("h", 0, 2))),
        "R": tone_of("r", SHINE),
        "z": tone_of("r", SHADE),
        "h": I((146, 94, 56), line=(40, 22, 14), inner=(80, 44, 28), layer=4,
               form=(1, 1), casts=(("a", 1, 1),)),
        "B": I((74, 42, 28), flat=True),
        "c": I((216, 164, 88), deep=(122, 70, 44), shadow=(168, 112, 64),
               light=(240, 202, 132), line=(56, 32, 18), layer=0, form=(4, 3)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "d": I((112, 70, 46), line=(38, 20, 12), inner=(60, 34, 20), layer=1, form=(2, 2)),
        "i": I((238, 226, 198), line=(90, 80, 64), layer=0, form=(0, 0)),
        "g": I((236, 196, 88), line=(84, 52, 14), inner=(120, 80, 24), layer=6,
               form=(1, 1)),
        "G": tone_of("g", SHINE),
        "y": I((244, 206, 96), flat=True),
        "Y": I((150, 104, 40), flat=True),
    }
    inks.update(skin_inks((228, 180, 138), line=(86, 42, 28)))
    inks.update(eye_inks((200, 148, 58), lash=(44, 26, 20)))
    return cv, inks


def _warden(eye="open", talk="shut"):
    """Warden Isa: blue-black hair tied high, a scar across the cheek, a
    steel pauldron, a gorget and a red cape - the Hollow's one soldier."""
    cv = canvas()
    poly(cv, [(58, 56), (88, 58), (96, 80), (64, 80)], "r")            # the cape
    lock(cv, (33, 14), (14, 20), (16, 62), 5.0, 1.6, "h")              # the tail
    _body(cv)
    _arms(cv)
    poly(cv, [(35, 52), (57, 52), (61, 61), (31, 61)], "g")            # gorget
    line(cv, [(32, 57), (60, 57)], "z", onto="g")
    # the pauldron: a domed cap over two lames, each rimmed in gold
    for cx, cy, rx, ry in ((12, 76, 13, 5.5), (14, 71, 14, 5.5)):
        oval(cv, cx, cy, rx, ry, "y")
        oval(cv, cx + 0.5, cy - 0.8, rx - 1, ry - 1.2, "o")
    oval(cv, 17, 64, 14, 7.5, "y")
    oval(cv, 17.5, 63.2, 13, 6.4, "p")
    curve(cv, (7, 62), (15, 58), (27, 61), "Z", onto="p")
    stamp(cv, 16, 60, ["N"])
    head(cv, "sharp")
    oval(cv, 46, 21, 18, 14, "h")
    uncover(cv, 24, "sharp")
    poly(cv, [(30, 19), (29, 36), (32, 42), (35, 25)], "h")
    lock(cv, (32, 20), (27, 36), (33, 56), 2.8, 0.8, "h")              # framing locks
    lock(cv, (61, 20), (66, 34), (61, 50), 2.2, 0.6, "h")
    for p0, c, p1, r in (
            ((38, 17), (33, 25), (35, 33), 3.2),
            ((44, 18), (40, 25), (41, 30), 2.8),
            ((49, 18), (49, 25), (47, 29), 2.4),     # parted here
            ((55, 18), (58, 24), (58, 31), 2.6),
            ((60, 19), (64, 25), (63, 33), 2.0)):
        lock(cv, p0, c, p1, r, 0.5, "h")
    for p0, c, p1 in (((41, 21), (38, 26), (38, 31)), ((46, 21), (45, 26), (44, 29)),
                      ((57, 21), (59, 25), (59, 29)), ((31, 26), (29, 38), (32, 50))):
        curve(cv, p0, c, p1, "j", onto="hH")
    lock(cv, (34, 12), (46, 7), (58, 11), 1.2, 0.5, "H", onto="h")
    stamp(cv, 31, 12, ["rr", "rr"])                                    # the tie
    eyes(cv, eye, shapes=EYES_SHARP)
    line(cv, [(35, 27), (40, 26), (44, 28)], "B", onto="a")
    line(cv, [(50, 28), (53, 26), (57, 26)], "B", onto="a")
    line(cv, [(37, 39), (40, 36)], "v", onto="a")                       # scar
    nose(cv)
    mouth(cv, talk)
    inks = {
        "h": I((56, 60, 100), deep=(16, 16, 40), shadow=(32, 34, 70),
               light=(96, 104, 160), shine=(160, 172, 220), line=(8, 8, 24),
               inner=(18, 18, 44), layer=4, form=(2, 2),
               casts=(("a", 1, 2), ("e", 1, 1), ("n", 1, 2))),
        "H": tone_of("h", SHINE),
        "j": tone_of("h", DEEP),
        "r": I((188, 46, 52), deep=(84, 12, 30), shadow=(132, 26, 44),
               light=(226, 88, 84), line=(44, 6, 16), layer=0, form=(3, 2)),
        "B": I((20, 20, 44), flat=True),
        "c": I((78, 118, 196), deep=(30, 44, 104), shadow=(50, 76, 150),
               light=(120, 160, 230), line=(14, 20, 52), layer=0, form=(4, 3)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "g": I((176, 184, 202), deep=(80, 86, 110), shadow=(122, 128, 152),
               light=(226, 232, 244), shine=(255, 255, 255), line=(32, 36, 54),
               inner=(60, 64, 86), layer=2, form=(2, 2)),
        "z": tone_of("g", DEEP),
        "p": I((184, 192, 210), deep=(84, 90, 116), shadow=(128, 134, 160),
               light=(232, 238, 248), shine=(255, 255, 255), line=(32, 36, 54),
               inner=(64, 68, 90), layer=3, form=(3, 3)),
        "Z": tone_of("p", SHINE),
        "o": I((158, 166, 188), deep=(70, 76, 102), shadow=(110, 116, 144),
               light=(212, 218, 234), line=(32, 36, 54), inner=(56, 60, 84),
               layer=2, form=(2, 2)),
        "N": I((255, 255, 255), flat=True),
        "y": I((226, 186, 92), deep=(120, 80, 28), shadow=(176, 128, 52),
               light=(250, 222, 140), line=(72, 46, 14), layer=3, form=(1, 1)),
        "v": I((252, 232, 214), flat=True),
    }
    inks.update(skin_inks((246, 210, 178)))
    inks.update(eye_inks((88, 132, 204), lash=(18, 18, 38)))
    return cv, inks


def _pilgrim(eye="open", talk="shut"):
    """Pilgrim Sefa: a hood the road has bleached, a veil against the desert
    wind, and eyes that have already seen the scale."""
    cv = canvas()
    _body(cv)
    _arms(cv)
    for k in range(8):                                                  # beads
        x = 34 + k * 4
        y = 62 + int(((x - 48) / 14.0) ** 2 * 6)
        oval(cv, x, y, 1.3, 1.3, "b")
    # the hood: peaked, falling in folds to the shoulders
    poly(cv, [(14, 60), (18, 40), (22, 24), (30, 12), (42, 5), (52, 5), (62, 10),
              (70, 22), (74, 38), (80, 60)], "r")
    oval(cv, 47, 35, 15, 19, "Z", onto="r")                            # its lining
    head(cv, ear=False, neck=False)
    lock(cv, (32, 14), (27, 34), (34, 54), 2.6, 2.2, "r")              # hood rim
    lock(cv, (60, 14), (67, 30), (62, 50), 1.8, 1.6, "r")
    lock(cv, (30, 12), (42, 5), (56, 8), 1.2, 0.5, "R", onto="r")
    for p0, c, p1 in (((22, 30), (18, 44), (17, 58)), ((26, 20), (22, 36), (24, 58)),
                      ((70, 30), (74, 44), (76, 58)), ((36, 8), (28, 14), (24, 24))):
        curve(cv, p0, c, p1, "z", onto="r")
    # the veil, from the bridge of the nose down
    poly(cv, [(32, 37), (46, 39), (61, 36), (60, 44), (53, 52), (44, 55), (35, 50)], "v")
    for p0, c, p1 in (((39, 41), (43, 47), (43, 54)), ((52, 40), (55, 46), (53, 51))):
        curve(cv, p0, c, p1, "V", onto="v")
    if talk == "open":                                                  # the veil stirs
        curve(cv, (44, 45), (47, 47), (50, 45), "V", onto="v")
    eyes(cv, eye, shapes=EYES_LID)
    line(cv, [(35, 27), (40, 26), (44, 27)], "B", onto="a")
    line(cv, [(50, 27), (53, 26), (57, 27)], "B", onto="a")
    inks = {
        "r": I((178, 136, 88), deep=(92, 60, 42), shadow=(132, 94, 64),
               light=(214, 180, 128), shine=(240, 214, 166), line=(48, 30, 18),
               inner=(90, 60, 40), layer=5, form=(3, 3),
               casts=(("a", 1, 4), ("v", 1, 2))),
        "R": tone_of("r", SHINE),
        "z": tone_of("r", SHADE),
        "Z": I((88, 60, 46), line=(40, 24, 18), inner=(40, 24, 18), layer=2,
               form=(0, 0), rim=False),
        "h": I((138, 118, 102), line=(50, 40, 34), inner=(90, 76, 66), layer=4,
               form=(1, 1), casts=(("a", 1, 1),)),
        "B": I((86, 66, 52), flat=True),
        "c": I((150, 110, 74), deep=(72, 46, 34), shadow=(108, 76, 54),
               light=(186, 146, 104), line=(44, 26, 16), layer=1, form=(4, 3)),
        "x": tone_of("c", SHADE),
        "X": tone_of("c", LIGHT),
        "b": I((110, 176, 176), deep=(34, 80, 92), shadow=(60, 120, 130),
               light=(170, 220, 214), line=(20, 42, 48), layer=6, form=(1, 1)),
        "v": I((228, 218, 194), deep=(124, 112, 104), shadow=(176, 164, 152),
               light=(246, 240, 224), line=(78, 68, 58), inner=(120, 108, 96),
               layer=3, form=(2, 2)),
        "V": tone_of("v", SHADE),
    }
    inks.update(skin_inks((216, 172, 134), line=(80, 42, 28)))
    inks.update(eye_inks((152, 108, 70), lash=(42, 28, 22)))
    return cv, inks


def _anubis(eye="open", talk="shut"):
    """Anubis: a black jackal with gold-rimmed eyes, the striped headcloth
    and the broad collar of the weigher of hearts. When he speaks the jaw
    drops; when he blinks the gold goes out."""
    cv = canvas()
    poly(cv, [(0, 80), (2, 68), (12, 60), (28, 56), (64, 56), (80, 60), (92, 68),
              (96, 80)], "f")
    for rx, ry, ch in ((40, 17, "y"), (35, 14, "t"), (30, 11, "y"), (25, 8, "u"),
                       (20, 5, "y")):
        oval(cv, 46, 62, rx, ry, ch, onto="fytu")
    poly(cv, [(16, 24), (30, 16), (38, 26), (36, 44), (34, 64), (14, 66), (12, 40)], "y")
    for y in range(18, 70, 5):                                          # its stripes
        for x in range(0, 40):
            for d in range(2):
                put(cv, x, y + d, "u", onto="y")
    poly(cv, [(34, 38), (30, 62), (58, 62), (56, 44)], "f")            # neck
    oval(cv, 44, 26, 14, 12, "f")                                      # skull
    poly(cv, [(50, 20), (80, 30), (85, 34), (85, 38), (80, 41), (58, 44), (50, 38)], "f")
    jaw = [(36, 32), (58, 44), (52, 50), (38, 46)]
    if talk == "open":
        poly(cv, [(56, 42), (80, 42), (78, 46), (60, 48)], "o")        # the mouth open
        jaw = [(36, 32), (58, 46), (76, 46), (60, 50), (52, 52), (38, 46)]
    poly(cv, jaw, "f")
    poly(cv, [(36, 20), (32, 0), (46, 16)], "f")                       # ears
    poly(cv, [(46, 16), (55, 0), (58, 20)], "f")
    poly(cv, [(37, 16), (34, 5), (43, 15)], "i")
    poly(cv, [(49, 15), (54, 5), (56, 17)], "i")
    oval(cv, 83, 36, 2.4, 2, "o")                                      # nose
    line(cv, [(58, 42), (70, 41), (80, 40)], "l")                       # lip line
    line(cv, [(50, 22), (64, 27), (78, 31)], "F", onto="f")            # muzzle ridge
    if eye == "shut":
        stamp(cv, 50, 24, ["KKKKKKKKKK"])
    else:
        stamp(cv, 50, 22, [
            "..KKKK....",
            "KKggggKK..",
            ".KgGggKKKK" if eye == "open" else ".KKKKKKKKK",
            "..KKKK....",
        ])
    inks = {
        "f": I((54, 50, 70), deep=(18, 16, 28), shadow=(32, 28, 46),
               light=(100, 96, 136), shine=(150, 146, 190), line=(8, 6, 14),
               inner=(18, 16, 28), layer=3, form=(2, 2), casts=(("y", 0, 3),)),
        "F": tone_of("f", LIGHT),
        "i": I((160, 76, 64), deep=(80, 30, 34), shadow=(120, 50, 48),
               line=(220, 180, 92), inner=(220, 180, 92), layer=4, form=(1, 1)),
        "o": I((20, 16, 26), line=(8, 6, 12), inner=(8, 6, 12), layer=5, form=(0, 0)),
        "l": I((12, 8, 18), flat=True),
        "y": I((230, 188, 90), deep=(120, 72, 30), shadow=(176, 118, 54),
               light=(252, 226, 150), shine=(255, 246, 210), line=(70, 42, 14),
               inner=(120, 80, 28), layer=1, form=(2, 2)),
        "u": I((52, 72, 156), deep=(18, 24, 70), shadow=(32, 42, 108),
               light=(92, 114, 196), line=(10, 14, 40), inner=(20, 26, 74),
               layer=1, form=(2, 2)),
        "t": I((78, 190, 180), deep=(24, 90, 96), shadow=(44, 130, 132),
               light=(150, 226, 210), line=(12, 44, 46), layer=1, form=(2, 2)),
        "K": I((10, 8, 16), flat=True),
        "g": I((255, 204, 84), flat=True),
        "G": I((255, 252, 226), flat=True),
    }
    return cv, inks


CAST = {
    "hero": _hero,
    "elder": _elder,
    "kid": _kid,
    "shop": _trader,
    "ward": _warden,
    "pilgrim": _pilgrim,
    "anubis": _anubis,
}

# Who wears which face. Dialogue looks the speaker's name up here.
SPEAKERS = {
    "Elder Maru": "elder",
    "Nen": "kid",
    "Pell the Trader": "shop",
    "Warden Isa": "ward",
    "Pilgrim Sefa": "pilgrim",
    "Anubis": "anubis",
}

# Nen is a head shorter than everyone, and Anubis speaks from the right.
DROP = {"kid": 6}
RIGHT = {"anubis"}

_cache = {}


def portrait(key, eye="open", talk="shut", scale=2):
    """The lit portrait for one character in one frame, cached. Faces are
    authored turned right; one shown on the right is mirrored."""
    ck = (key, eye, talk, scale)
    if ck not in _cache:
        cv, inks = CAST[key](eye, talk)
        surf = render(cv, inks)
        drop = DROP.get(key, 0)
        if drop:
            out = pygame.Surface(surf.get_size(), pygame.SRCALPHA)
            out.blit(surf, (0, drop))
            surf = out
        if key in RIGHT:
            surf = pygame.transform.flip(surf, True, False)
        if scale != 1:
            surf = pygame.transform.scale(surf, (W * scale, H * scale))
        _cache[ck] = surf
    return _cache[ck]
