"""Dialogue portraits, in the Fire Emblem idiom.

The GBA Fire Emblems put a large bust beside the text box: a face in
three-quarter view, a sharp fringe, eyes that carry the character, and
shoulders cut off by the box. Shading is cel, not modelled: a lit tone, a
shadow tone, and the shadows are *shapes* - under the fringe, down the far
side of the jaw, beneath the chin - rather than a bevel following the edge.

Portraits are drawn at the world's full resolution (480x320), not the
doubled UI layer, so a face has the same pixel density as the monsters.

Like the sprites, a portrait is a material map. The renderer here is its own
thing, though, because the lighting it wants is the opposite of shading.py's:

* Each ink has a flat base, one shadow and one light; there is no gradient.
* Form shadow: a pixel is in shadow when stepping `form` pixels away from the
  key light leaves its region. That paints a crisp band down the lower right
  of every shape, the way an animator would.
* Cast shadow: an ink can name a caster (hair onto skin, a chin onto a neck)
  and an offset; the caster's silhouette, shifted, darkens what it covers.
* Lines: the outer silhouette gets a dark, hue-shifted line; where one shape
  lies over another, the front one draws a softer line along the join.
* Features - eyes, mouth, glints - are stamped with explicit colours and
  take no shading at all.
"""

import pygame

from .shading import COOL_HUE, WARM_HUE, _shift

W, H = 128, 144
CLEAR = "."


class Ink:
    """One portrait material.

    `of` makes an ink a tone of another: painting "s" with of="a", tone=0
    puts a hand-placed shadow on skin that joins the skin's region for the
    automatic shading and lines. `layer` decides which side of a join draws
    the line - the higher one is in front. `casts` lists (group, dx, dy) this
    ink throws its silhouette onto.
    """

    def __init__(self, base, shadow=None, light=None, line=None, layer=0,
                 form=(3, 2), rim=True, flat=False, of=None, tone=None,
                 casts=(), inner=None):
        self.base = base
        self.shadow = shadow or _shift(base, COOL_HUE, 0.16, 1.12, 0.80)
        self.light = light or _shift(base, WARM_HUE, 0.12, 0.84, 1.10)
        self.line = line or _shift(base, COOL_HUE, 0.28, 1.25, 0.30)
        self.inner = inner or _shift(base, COOL_HUE, 0.22, 1.20, 0.56)
        self.layer = layer
        self.form = form
        self.rim = rim
        self.flat = flat
        self.of = of
        self.tone = tone
        self.casts = casts

    def tones(self):
        return (self.shadow, self.base, self.light)


def I(base, **kw):
    return Ink(base, **kw)


# -- drawing helpers --------------------------------------------------------

def canvas(w=W, h=H):
    return [[CLEAR] * w for _ in range(h)]


def put(cv, x, y, ch):
    if 0 <= y < len(cv) and 0 <= x < len(cv[0]):
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
                if 0 <= y < len(cv) and 0 <= x < len(cv[0]):
                    if onto is None or cv[y][x] in onto:
                        cv[y][x] = ch


def _bez(p0, c, p1, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])


def lock(cv, p0, c, p1, r0, r1, ch, onto=None):
    """A tapered strand along a quadratic curve: a lock of hair, a spike,
    a fold of cloth. Anime hair is a bundle of these, each ending in a point."""
    n = int(max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1])) * 2) + 4
    for i in range(n + 1):
        t = i / n
        x, y = _bez(p0, c, p1, t)
        r = r0 + (r1 - r0) * t
        oval(cv, x, y, max(0.5, r), max(0.5, r), ch, onto)


def line(cv, pts, ch, onto=None):
    """A one-pixel polyline, for creases, brows and seams."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            if 0 <= y < len(cv) and 0 <= x < len(cv[0]):
                if onto is None or cv[y][x] in onto:
                    cv[y][x] = ch


def stamp(cv, x, y, rows):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != CLEAR:
                put(cv, x + i, y + j, ch)


def flipped(rows):
    return [r[::-1] for r in rows]


# -- rendering --------------------------------------------------------------

def render(cv, inks):
    h, w = len(cv), len(cv[0])

    def group(ch):
        ink = inks.get(ch)
        if ink is None:
            return None
        return ink.of or ch

    grid = [[group(ch) if ch != CLEAR else None for ch in row] for row in cv]

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
            if ink.tone is not None:
                tone = ink.tone
            else:
                tone = 1
                fx, fy = host.form
                if (fx or fy) and g_at(x + fx, y + fy) != g:
                    tone = 0
                for caster, dx, dy in casts.get(g, ()):
                    if g_at(x - dx, y - dy) == caster:
                        tone = 0
                        break
                if tone == 1 and host.rim and g_at(x - 1, y - 1) != g \
                        and g_at(x - 1, y) != g:
                    tone = 2
            colour = host.tones()[tone]
            # lines: the silhouette, then joins where this shape is in front
            n4 = ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            if any(g_at(nx, ny) is None for nx, ny in n4):
                colour = host.line
            else:
                for nx, ny in n4:
                    other = g_at(nx, ny)
                    if other != g and inks[other].layer < host.layer:
                        colour = host.inner
                        break
            surf.set_at((x, y), colour)
    return surf


# -- shared anatomy -----------------------------------------------------------
#
# Every face is in three-quarter view, turned to the viewer's right, so it
# looks across at whoever it is talking to. The near cheek is on the left;
# the far eye is narrower and the far cheek cuts in under the cheekbone.

FACE = [(40, 46), (40, 60), (42, 68), (47, 75), (53, 80), (59, 83), (63, 83),
        (69, 79), (75, 72), (79, 65), (81, 58), (82, 50), (83, 42), (78, 32),
        (60, 28), (46, 32)]
EAR = [(38, 56), (34, 54), (33, 60), (35, 67), (40, 70)]
NECK = [(49, 76), (49, 98), (57, 103), (66, 99), (66, 82)]


def face(cv, skin="a", ear=True, jaw=FACE):
    poly(cv, NECK, "n")
    if ear:
        poly(cv, EAR, "e")
    poly(cv, jaw, skin)


def uncover(cv, below, ch="a", jaw=FACE):
    """Put the face back below a hairline, after the hair mass has gone
    down over the whole skull. The fringe is then drawn over it lock by
    lock, which is what lets skin show between the strands."""
    tmp = canvas(len(cv[0]), len(cv))
    poly(tmp, jaw, ch)
    for y in range(below, len(cv)):
        for x in range(len(cv[0])):
            if tmp[y][x] != CLEAR:
                cv[y][x] = ch


# Anime eyes. The upper lash is the heaviest line in the drawing, the iris
# is a tall oval with the dark at the top, and the glint sits upper-left
# where the key light is. The far eye is foreshortened, not just smaller.
#   K lash  W white  D iris dark  L iris light  P pupil  G glint  k lower lid
EYE_NEAR = [
    "....KKKKKKK..",
    "..KKKKKKKKKKK",
    "KKK.WDDDDDDKK",
    "....WDGGPDDDK",
    "....WDGPPPDLW",
    "....WDPPPPDLW",
    "....WLDPPDLLW",
    ".....WLLLLLW.",
    "......kkkkk..",
]
EYE_FAR = [
    "KKKKKKK..",
    "KKKKKKKKK",
    ".WDDDDDKK",
    ".WGGPDDD.",
    ".WGPPPDL.",
    ".WPPPPDL.",
    ".WDPPDLL.",
    "..WLLLL..",
    "...kkk...",
]
EYES_AT = ((44, 55), (67, 55))


def eyes(cv, near=EYE_NEAR, far=EYE_FAR, at=EYES_AT):
    stamp(cv, at[0][0], at[0][1], near)
    stamp(cv, at[1][0], at[1][1], far)


def eye_inks(iris, lash=(30, 22, 30)):
    """The flat inks an eye is stamped in, for a given iris colour."""
    return {
        "K": I(lash, flat=True),
        "k": I(_shift(lash, WARM_HUE, 0.0, 0.8, 2.4), flat=True),
        "W": I((250, 246, 240), flat=True),
        "D": I(_shift(iris, COOL_HUE, 0.10, 1.1, 0.55), flat=True),
        "L": I(_shift(iris, WARM_HUE, 0.05, 0.9, 1.15), flat=True),
        "P": I(_shift(iris, COOL_HUE, 0.25, 1.2, 0.28), flat=True),
        "G": I((255, 255, 255), flat=True),
    }


def skin_inks(tone=(250, 214, 184), line=(96, 46, 40)):
    shadow = _shift(tone, 0.98, 0.35, 1.30, 0.86)
    return {
        "a": I(tone, shadow=shadow, line=line, layer=2, form=(3, 0), rim=False,
               casts=(("n", 0, 7),)),
        "s": I(tone, of="a", tone=0),
        "e": I(tone, shadow=shadow, line=line, layer=1, form=(2, 0), rim=False),
        "n": I(tone, shadow=shadow, line=line, layer=1, form=(4, 0), rim=False),
        # the mouth and the nose are flat marks drawn in the skin's own dark
        "m": I(_shift(tone, 0.98, 0.3, 1.5, 0.46), flat=True),
        "q": I(_shift(tone, 0.98, 0.3, 1.4, 0.74), flat=True),
    }


# -- the cast -----------------------------------------------------------------

def _hero():
    """The binder: a travelling coat, a satchel strap, green hair worn long
    enough to blow about, and the look of someone who has decided."""
    cv = canvas()
    # shoulders and coat: a high collar open at the throat
    poly(cv, [(2, 144), (6, 122), (20, 108), (40, 100), (50, 95), (66, 95),
              (78, 100), (100, 108), (118, 120), (126, 144)], "c")
    for pts in ([(28, 114), (33, 128), (31, 144)], [(98, 114), (104, 144)],
                [(16, 128), (14, 144)]):
        line(cv, pts, "x")                                              # folds
    poly(cv, [(48, 90), (42, 112), (56, 122), (58, 100)], "C")        # collar L
    poly(cv, [(68, 90), (80, 110), (65, 122), (64, 100)], "C")        # collar R
    poly(cv, [(56, 100), (66, 100), (64, 124), (58, 124)], "t")        # shirt
    poly(cv, [(86, 102), (96, 104), (62, 144), (50, 144)], "b")        # strap
    stamp(cv, 74, 114, ["gggg", "gGGg", "gGGg", "gggg"])                # buckle
    face(cv)
    # hair: the mass over the skull, then the face uncovered below the
    # hairline, then the fringe as separate tapered locks
    oval(cv, 61, 38, 27, 21, "h")
    poly(cv, [(35, 38), (34, 62), (39, 72), (44, 48)], "h")            # sideburn
    uncover(cv, 45)
    for p0, c, p1, r in (
            ((44, 30), (32, 46), (35, 70), 5.0),     # back lock, near side
            ((50, 32), (43, 44), (44, 58), 5.0),
            ((57, 34), (53, 44), (55, 54), 4.4),     # fringe
            ((64, 34), (64, 48), (61, 60), 4.0),     # the lock between the eyes
            ((70, 34), (73, 44), (71, 52), 3.8),
            ((77, 34), (81, 42), (80, 52), 3.4),
            ((82, 36), (87, 46), (85, 60), 3.0),     # far side
            ((62, 20), (50, 6), (30, 8), 5.4),       # spikes swept back
            ((52, 22), (36, 14), (18, 22), 5.2),
            ((44, 30), (28, 28), (14, 40), 4.8),
            ((42, 40), (28, 46), (20, 60), 4.2),
            ((72, 20), (70, 12), (60, 8), 3.6)):
        lock(cv, p0, c, p1, r, 0.6, "h")
    # clefts between the locks, dark toward the tips
    for p0, c, p1 in (((53, 38), (50, 46), (49, 54)), ((61, 38), (60, 46), (58, 52)),
                      ((68, 38), (69, 44), (67, 50)), ((75, 38), (77, 44), (76, 50)),
                      ((46, 36), (40, 46), (40, 58))):
        lock(cv, p0, c, p1, 0.6, 0.9, "j", onto="hH")
    # the sheen, an arc of light across the crown
    for p0, c, p1 in (((42, 28), (56, 19), (72, 24)),):
        lock(cv, p0, c, p1, 1.6, 0.6, "H", onto="h")
    # the fringe throws its shadow onto the brow
    eyes(cv)
    # brows drawn down toward the nose: the difference between tired
    # and set on something
    line(cv, [(44, 51), (51, 50), (58, 53)], "B", onto="a")
    line(cv, [(46, 50), (52, 49), (57, 51)], "B", onto="a")
    line(cv, [(66, 53), (71, 50), (77, 50)], "B", onto="a")
    stamp(cv, 76, 66, ["q", ".q"])                                      # nose
    line(cv, [(62, 75), (65, 75)], "m")                                  # mouth
    inks = {
        "h": I((70, 150, 104), shadow=(34, 92, 84), light=(140, 206, 150),
               line=(16, 40, 44), inner=(26, 70, 64), layer=4, form=(3, 3),
               casts=(("a", 1, 3), ("e", 2, 2), ("n", 2, 3))),
        "H": I((150, 214, 160), of="h", tone=2),
        "j": I((0, 0, 0), of="h", tone=0),
        "B": I((26, 64, 58), flat=True),
        "c": I((214, 216, 208), shadow=(150, 150, 170), line=(40, 42, 58),
               layer=0, form=(6, 4)),
        "C": I((236, 238, 232), shadow=(170, 172, 190), line=(40, 42, 58),
               layer=1, form=(3, 3)),
        "x": I((0, 0, 0), of="c", tone=0),
        "t": I((60, 70, 100), line=(20, 24, 40), layer=0),
        "g": I((200, 170, 90), line=(70, 50, 20), layer=3, form=(0, 0)),
        "G": I((250, 230, 150), of="g", tone=2),
        "b": I((150, 108, 54), line=(52, 32, 18), layer=2, form=(0, 3)),
    }
    inks.update(skin_inks())
    inks.update(eye_inks((70, 150, 110)))
    return cv, inks


# Narrowed and lidded eye sets. The same construction; a lower lid line
# does more for age, calm or cunning than any change of colour.
EYE_OLD = ([
    "..KKKKKKKKK..",
    "KKKKKKKKKKKKK",
    "....WDDDDDKK.",
    ".....WDPDDW..",
    "......kkkk...",
], [
    "KKKKKKK.",
    "KKKKKKKK",
    ".WDDDKK.",
    "..WDDW..",
    "...kk...",
])
EYE_LIDDED = ([
    "..KKKKKKKKKK.",
    "KKKKKKKKKKKKK",
    "...KWDDDDDKK.",
    "....WDGPPDDLW",
    "....WLDPPDLLW",
    ".....WLLLLLW.",
    "......kkkkk..",
], [
    "KKKKKKKK.",
    "KKKKKKKKK",
    ".KWDDDDKK",
    ".WGPPDDL.",
    ".WDPPDLL.",
    "..WLLLL..",
    "...kkk...",
])
EYE_SHARP = ([
    "......KKKKK..",
    "...KKKKKKKKKK",
    "KKKKWDDDDDDKK",
    "....WDGPPDDDK",
    "....WDPPPPDLW",
    "....WLDPPDLLW",
    ".....WLLLLLW.",
    "......kkkkk..",
], [
    "..KKKKKK.",
    "KKKKKKKKK",
    ".WDDDDDKK",
    ".WGPPDDD.",
    ".WPPPPDL.",
    ".WDPPDLL.",
    "..WLLLL..",
    "...kkk...",
])
EYE_BIG = ([
    "....KKKKKKK..",
    "..KKKKKKKKKKK",
    "KKK.WDDDDDDKK",
    "....WDGGDDDDK",
    "....WDGGPPDLW",
    "....WDPPPPDLW",
    "....WLDPPDLLW",
    "....WLLDDLGLW",
    ".....WLLLLLW.",
    "......kkkkk..",
], [
    "KKKKKKK..",
    "KKKKKKKKK",
    ".WDDDDDKK",
    ".WGGDDDD.",
    ".WGGPPDL.",
    ".WPPPPDL.",
    ".WDPPDLL.",
    ".WLDDLGL.",
    "..WLLLL..",
    "...kkk...",
])


def _elder():
    """Elder Maru: a white topknot, brows that have outlived their colour,
    and a beard the Hollow's children are not allowed to pull."""
    cv = canvas()
    poly(cv, [(6, 144), (10, 120), (24, 108), (44, 100), (52, 95), (64, 95),
              (76, 100), (96, 108), (112, 120), (120, 144)], "c")
    poly(cv, [(50, 96), (60, 136), (72, 96)], "u")                     # under-robe
    line(cv, [(49, 96), (60, 138), (73, 96)], "y")                     # gold trim
    line(cv, [(48, 96), (59, 138)], "y")
    for pts in ([(30, 114), (34, 144)], [(96, 114), (100, 144)], [(18, 126), (20, 144)]):
        line(cv, pts, "x")
    face(cv, jaw=FACE)
    oval(cv, 61, 38, 26, 19, "h")
    uncover(cv, 41)
    poly(cv, [(36, 42), (35, 62), (40, 68), (43, 48)], "h")            # side hair
    oval(cv, 50, 17, 8, 7, "h")                                        # topknot
    lock(cv, (50, 12), (46, 4), (40, 2), 3.0, 0.8, "h")
    poly(cv, [(46, 22), (56, 22), (57, 25), (45, 25)], "r")           # its cord
    for p0, c, p1 in (((46, 26), (54, 22), (64, 24)), ((40, 34), (44, 28), (50, 26))):
        lock(cv, p0, c, p1, 0.6, 0.6, "j", onto="h")
    lock(cv, (48, 22), (58, 18), (70, 24), 1.4, 0.6, "H", onto="h")
    # the beard, from the cheeks to the chest, and the moustache over it
    poly(cv, [(42, 66), (47, 76), (53, 82), (60, 85), (66, 84), (72, 79), (78, 70),
              (76, 94), (70, 112), (62, 124), (54, 112), (47, 96)], "h")
    for p0, c, p1 in (((52, 88), (54, 100), (58, 116)), ((62, 88), (64, 102), (62, 118)),
                      ((70, 86), (72, 96), (68, 106)), ((46, 80), (48, 90), (52, 100))):
        lock(cv, p0, c, p1, 0.6, 0.6, "j", onto="h")
    lock(cv, (54, 76), (62, 72), (72, 74), 2.2, 1.2, "h")
    lock(cv, (56, 76), (50, 80), (48, 88), 1.8, 0.6, "h")
    lock(cv, (70, 75), (74, 78), (75, 86), 1.6, 0.6, "h")
    near, far = EYE_OLD
    eyes(cv, near, far, ((45, 57), (67, 57)))
    lock(cv, (57, 53), (50, 50), (41, 55), 2.2, 0.8, "h")              # brows
    lock(cv, (66, 53), (72, 50), (80, 53), 1.6, 0.6, "h")
    for pts in ([(50, 44), (58, 43), (68, 44)], [(53, 47), (64, 47)],
                [(46, 64), (53, 65)], [(69, 64), (74, 64)], [(41, 58), (39, 61)],
                [(72, 68), (70, 73)]):
        line(cv, pts, "w", onto="a")                                    # the years
    stamp(cv, 76, 66, ["q", ".q"])
    inks = {
        "h": I((226, 226, 234), shadow=(164, 164, 190), light=(250, 250, 252),
               line=(70, 70, 96), inner=(130, 130, 158), layer=4, form=(3, 3),
               casts=(("a", 1, 3), ("n", 0, 4))),
        "H": I((255, 255, 255), of="h", tone=2),
        "j": I((0, 0, 0), of="h", tone=0),
        "r": I((170, 60, 70), line=(60, 20, 30), layer=5, form=(0, 2)),
        "c": I((118, 96, 164), shadow=(76, 60, 124), line=(30, 22, 52), layer=0,
               form=(6, 4)),
        "x": I((0, 0, 0), of="c", tone=0),
        "u": I((70, 56, 100), line=(24, 18, 40), layer=1, form=(0, 0)),
        "y": I((222, 186, 96), flat=True),
        "w": I((0, 0, 0), of="a", tone=0),
    }
    inks.update(skin_inks((236, 196, 164)))
    inks.update(eye_inks((110, 116, 150), lash=(60, 50, 66)))
    return cv, inks


def _kid():
    """Nen: a cowlick that will not lie down, a plaster on one cheek, and
    the round eyes of someone who knows everything that matters."""
    cv = canvas()
    poly(cv, [(10, 144), (14, 118), (28, 104), (46, 94), (54, 90), (64, 90),
              (74, 94), (92, 104), (106, 116), (112, 144)], "c")
    oval(cv, 58, 93, 24, 8, "C")                                       # hood, down
    poly(cv, [(52, 93), (66, 93), (60, 105)], "t")
    line(cv, [(56, 97), (54, 117)], "y")                               # drawstrings
    line(cv, [(64, 97), (66, 115)], "y")
    face(cv, jaw=FACE_ROUND)
    oval(cv, 61, 38, 27, 20, "h")
    uncover(cv, 46, jaw=FACE_ROUND)
    for p0, c, p1, r in (
            ((44, 30), (34, 44), (36, 62), 5.0),
            ((50, 32), (44, 44), (46, 56), 4.6),
            ((56, 34), (52, 44), (53, 52), 4.0),
            ((63, 34), (62, 46), (60, 54), 3.8),
            ((69, 34), (71, 44), (69, 52), 3.6),
            ((76, 34), (80, 42), (79, 52), 3.4),
            ((82, 36), (86, 44), (85, 56), 2.8),
            ((58, 20), (58, 6), (70, 4), 3.4),       # the cowlick
            ((50, 22), (40, 12), (30, 16), 3.8),
            ((42, 32), (28, 30), (22, 40), 3.8)):
        lock(cv, p0, c, p1, r, 0.6, "h")
    for p0, c, p1 in (((53, 38), (50, 46), (49, 52)), ((60, 38), (60, 46), (58, 51)),
                      ((67, 38), (68, 44), (67, 50)), ((74, 38), (76, 44), (76, 50))):
        lock(cv, p0, c, p1, 0.6, 0.9, "j", onto="hH")
    lock(cv, (42, 28), (56, 19), (72, 24), 1.6, 0.6, "H", onto="h")
    near, far = EYE_BIG
    eyes(cv, near, far, ((44, 54), (67, 54)))
    line(cv, [(46, 51), (52, 49), (57, 50)], "B", onto="a")
    line(cv, [(67, 50), (72, 49), (77, 50)], "B", onto="a")
    stamp(cv, 75, 66, ["q"])
    line(cv, [(61, 73), (65, 73)], "m")
    put(cv, 63, 74, "m")
    stamp(cv, 45, 66, ["pppppp", "pPpPpp", "pppppp"])                  # plaster
    inks = {
        "h": I((112, 102, 178), shadow=(66, 58, 128), light=(170, 162, 226),
               line=(28, 22, 60), inner=(50, 42, 100), layer=4, form=(3, 3),
               casts=(("a", 1, 3), ("e", 2, 2), ("n", 2, 3))),
        "H": I((184, 178, 236), of="h", tone=2),
        "j": I((0, 0, 0), of="h", tone=0),
        "B": I((52, 44, 100), flat=True),
        "c": I((222, 128, 146), shadow=(168, 80, 116), line=(60, 22, 40), layer=0,
               form=(6, 4)),
        "C": I((246, 180, 190), shadow=(200, 124, 150), line=(60, 22, 40), layer=1),
        "t": I((96, 72, 104), line=(30, 20, 36), layer=1, form=(0, 0)),
        "y": I((250, 240, 230), flat=True),
        "p": I((240, 226, 200), flat=True),
        "P": I((196, 170, 150), flat=True),
    }
    inks.update(skin_inks((252, 218, 190)))
    inks.update(eye_inks((150, 110, 200)))
    return cv, inks


def _trader():
    """Pell the Trader: a head-wrap with a tail, a gold hoop, eyes half
    closed as if pricing you, and the corner of a smile about the price."""
    cv = canvas()
    poly(cv, [(2, 144), (6, 122), (20, 108), (40, 100), (50, 95), (66, 95),
              (78, 100), (100, 108), (118, 120), (126, 144)], "c")
    poly(cv, [(50, 94), (40, 124), (52, 144), (60, 106)], "d")         # lapel L
    poly(cv, [(66, 94), (82, 122), (70, 144), (62, 106)], "d")         # lapel R
    poly(cv, [(58, 100), (64, 100), (64, 144), (60, 144)], "t")
    for i, x in enumerate(range(50, 76, 4)):                            # coin string
        stamp(cv, x, 104 + abs(x - 62) // -3 + 6, ["gg", "gg"])
    for pts in ([(28, 114), (33, 144)], [(98, 114), (104, 144)]):
        line(cv, pts, "x")
    lock(cv, (40, 36), (22, 62), (26, 104), 7.0, 3.0, "r")             # wrap's tail
    face(cv)
    poly(cv, [(36, 44), (35, 62), (40, 70), (44, 50)], "h")            # sideburn
    oval(cv, 61, 34, 28, 17, "r")                                      # the wrap
    poly(cv, [(34, 34), (88, 34), (86, 46), (36, 46)], "r")
    for p0, c, p1 in (((36, 30), (60, 38), (86, 26)), ((38, 40), (60, 46), (86, 38)),
                      ((44, 22), (60, 28), (80, 18))):
        lock(cv, p0, c, p1, 0.7, 0.7, "z", onto="r")                    # its folds
    lock(cv, (40, 26), (56, 18), (72, 20), 1.4, 0.6, "R", onto="r")
    line(cv, [(35, 44), (60, 47), (87, 42)], "g", onto="r")            # gold band
    line(cv, [(35, 43), (60, 46), (87, 41)], "g", onto="r")
    for p0, c, p1, r in (((48, 44), (46, 50), (47, 56), 3.0),       # hair under it
                         ((56, 45), (55, 50), (56, 54), 2.6),
                         ((80, 44), (82, 50), (81, 56), 2.4)):
        lock(cv, p0, c, p1, r, 0.6, "h")
    near, far = EYE_LIDDED
    eyes(cv, near, far, ((44, 56), (67, 56)))
    line(cv, [(44, 53), (51, 52), (58, 53)], "B", onto="a")
    line(cv, [(66, 51), (71, 48), (77, 49)], "B", onto="a")             # one raised
    stamp(cv, 76, 66, ["q", ".q"])
    line(cv, [(60, 75), (65, 75), (67, 74), (68, 73)], "m")              # the smirk
    oval(cv, 37, 72, 3, 4, "g")                                        # earring
    oval(cv, 37, 72, 1.4, 2.2, CLEAR)
    inks = {
        "r": I((168, 52, 58), shadow=(112, 30, 52), light=(214, 96, 90),
               line=(46, 10, 20), inner=(90, 20, 36), layer=5, form=(3, 3),
               casts=(("a", 1, 4), ("h", 0, 3))),
        "R": I((0, 0, 0), of="r", tone=2),
        "z": I((0, 0, 0), of="r", tone=0),
        "h": I((150, 96, 56), shadow=(100, 58, 40), line=(40, 22, 14),
               inner=(80, 44, 28), layer=4, form=(2, 2), casts=(("a", 1, 2),)),
        "B": I((70, 40, 26), flat=True),
        "c": I((214, 162, 88), shadow=(160, 106, 70), line=(56, 34, 20), layer=0,
               form=(6, 4)),
        "x": I((0, 0, 0), of="c", tone=0),
        "d": I((110, 70, 48), line=(40, 22, 14), layer=1, form=(3, 3)),
        "t": I((236, 224, 196), line=(90, 80, 64), layer=0, form=(0, 0)),
        "g": I((236, 198, 90), shadow=(180, 120, 50), line=(80, 50, 16), layer=6,
               form=(1, 1)),
    }
    inks.update(skin_inks((226, 180, 140), line=(88, 44, 30)))
    inks.update(eye_inks((196, 146, 60), lash=(40, 26, 20)))
    return cv, inks


def _warden():
    """Warden Isa: blue-black hair tied back, a scar across the cheek, a
    steel pauldron and a gorget - the Hollow's one standing soldier."""
    cv = canvas()
    lock(cv, (40, 30), (12, 40), (18, 118), 7.0, 2.0, "h")             # the tail
    poly(cv, [(4, 144), (8, 122), (22, 108), (42, 100), (50, 95), (66, 95),
              (78, 100), (100, 108), (118, 120), (126, 144)], "c")
    for pts in ([(92, 116), (98, 144)], [(74, 124), (76, 144)]):
        line(cv, pts, "x")
    poly(cv, [(44, 88), (72, 88), (80, 106), (36, 106)], "g")         # gorget
    line(cv, [(38, 100), (78, 100)], "z", onto="g")
    # the pauldron: one domed plate over the near shoulder, rimmed in gold
    oval(cv, 24, 114, 23, 14, "y")
    oval(cv, 25, 113, 21.5, 12.5, "p")
    line(cv, [(8, 118), (20, 110), (40, 110)], "z", onto="p")
    stamp(cv, 22, 106, ["NN", "NN"])                                    # rivet
    face(cv)
    oval(cv, 61, 38, 27, 21, "h")
    uncover(cv, 45)
    poly(cv, [(35, 40), (34, 64), (39, 74), (44, 48)], "h")
    lock(cv, (40, 34), (32, 60), (40, 92), 4.4, 1.0, "h")              # framing locks
    lock(cv, (84, 36), (90, 58), (82, 84), 3.4, 0.8, "h")
    for p0, c, p1, r in (
            ((48, 32), (40, 44), (42, 58), 4.8),
            ((56, 32), (50, 44), (52, 54), 4.2),
            ((64, 32), (64, 44), (62, 52), 3.6),     # parted here
            ((74, 32), (78, 42), (78, 54), 3.8),
            ((81, 34), (86, 44), (85, 58), 3.0)):
        lock(cv, p0, c, p1, r, 0.6, "h")
    for p0, c, p1 in (((52, 38), (48, 46), (47, 54)), ((60, 38), (58, 46), (57, 50)),
                      ((72, 38), (74, 44), (74, 50)), ((42, 50), (38, 66), (40, 82))):
        lock(cv, p0, c, p1, 0.6, 0.9, "j", onto="hH")
    lock(cv, (44, 26), (58, 18), (76, 24), 1.5, 0.6, "H", onto="h")
    poly(cv, [(34, 30), (40, 26), (42, 34), (36, 36)], "r")           # the tie
    near, far = EYE_SHARP
    eyes(cv, near, far)
    line(cv, [(44, 51), (51, 50), (58, 52)], "B", onto="a")
    line(cv, [(45, 50), (51, 49)], "B", onto="a")
    line(cv, [(66, 52), (71, 50), (77, 50)], "B", onto="a")
    line(cv, [(49, 70), (55, 65)], "v", onto="a")                       # scar
    stamp(cv, 76, 66, ["q", ".q"])
    line(cv, [(61, 75), (66, 75)], "m")
    inks = {
        "h": I((58, 60, 96), shadow=(30, 30, 62), light=(110, 116, 170),
               line=(12, 12, 30), inner=(24, 24, 50), layer=4, form=(3, 3),
               casts=(("a", 1, 3), ("e", 2, 2), ("n", 2, 3))),
        "H": I((130, 140, 196), of="h", tone=2),
        "j": I((0, 0, 0), of="h", tone=0),
        "r": I((200, 60, 60), line=(60, 16, 20), layer=5, form=(0, 0)),
        "B": I((20, 20, 40), flat=True),
        "c": I((80, 120, 190), shadow=(48, 74, 140), line=(16, 24, 56), layer=0,
               form=(6, 4)),
        "x": I((0, 0, 0), of="c", tone=0),
        "g": I((172, 180, 196), shadow=(110, 116, 140), light=(236, 240, 248),
               line=(36, 40, 56), layer=1, form=(3, 3)),
        "p": I((180, 188, 204), shadow=(104, 110, 136), light=(240, 244, 252),
               line=(36, 40, 56), layer=3, form=(4, 4)),
        "z": I((0, 0, 0), of="g", tone=0),
        "y": I((226, 190, 96), flat=True),
        "w": I((0, 0, 0), of="a", tone=0),
        "v": I((250, 226, 206), flat=True),
    }
    inks["z"] = I((0, 0, 0), of="p", tone=0)
    inks["N"] = I((250, 250, 255), flat=True)
    inks.update(skin_inks((244, 208, 180)))
    inks.update(eye_inks((90, 132, 196), lash=(18, 18, 36)))
    return cv, inks


def _pilgrim():
    """Pilgrim Sefa: a hood the road has bleached, a veil against the
    desert wind, and eyes that have already seen the scale."""
    cv = canvas()
    poly(cv, [(26, 50), (16, 100), (4, 144), (122, 144), (110, 100), (96, 56)], "r")
    poly(cv, [(2, 144), (8, 122), (22, 110), (42, 104), (80, 104), (104, 110),
              (118, 122), (124, 144)], "c")
    for pts in ([(30, 116), (34, 144)], [(96, 116), (100, 144)], [(60, 110), (62, 144)]):
        line(cv, pts, "x")
    for i in range(9):                                                   # beads
        x = 40 + i * 5
        y = 112 + int(((x - 60) / 22.0) ** 2 * 8)
        oval(cv, x, y, 1.8, 1.8, "b")
    face(cv, ear=False)
    oval(cv, 60, 40, 31, 28, "r")                                      # the hood
    oval(cv, 63, 60, 25, 30, "Z", onto="r")                            # lining
    uncover(cv, 42)
    for p0, c, p1, r in (((50, 38), (46, 44), (47, 52), 2.8),       # hair under it
                         ((58, 38), (56, 44), (57, 50), 2.4),
                         ((78, 38), (80, 44), (80, 52), 2.2)):
        lock(cv, p0, c, p1, r, 0.6, "h")
    lock(cv, (40, 32), (33, 62), (44, 92), 4.0, 3.0, "r")              # hood rim
    lock(cv, (82, 32), (90, 52), (84, 84), 2.6, 2.0, "r")
    lock(cv, (42, 22), (60, 14), (80, 20), 1.6, 0.6, "R", onto="r")
    for p0, c, p1 in (((30, 48), (26, 70), (22, 100)), ((92, 60), (98, 80), (104, 104))):
        lock(cv, p0, c, p1, 0.7, 0.7, "z", onto="r")
    # the veil, from the bridge of the nose down
    poly(cv, [(41, 68), (60, 70), (82, 66), (80, 76), (70, 86), (60, 90), (50, 88), (43, 80)], "v")
    for p0, c, p1 in (((48, 72), (56, 80), (56, 92)), ((66, 70), (72, 80), (70, 90))):
        lock(cv, p0, c, p1, 0.6, 0.6, "V", onto="v")
    near, far = EYE_LIDDED
    eyes(cv, near, far, ((44, 56), (67, 56)))
    line(cv, [(45, 53), (51, 51), (57, 52)], "B", onto="a")
    line(cv, [(67, 52), (72, 51), (77, 52)], "B", onto="a")
    inks = {
        "r": I((176, 134, 86), shadow=(120, 84, 64), light=(214, 178, 124),
               line=(52, 32, 20), inner=(100, 66, 44), layer=5, form=(4, 4),
               casts=(("a", 2, 6), ("h", 0, 3), ("v", 1, 4))),
        "R": I((0, 0, 0), of="r", tone=2),
        "z": I((0, 0, 0), of="r", tone=0),
        "Z": I((84, 56, 44), line=(40, 24, 18), inner=(40, 24, 18), layer=2,
               form=(0, 0), rim=False),
        "h": I((136, 116, 100), line=(50, 40, 34), inner=(90, 76, 66), layer=4,
               form=(2, 2), casts=(("a", 1, 2),)),
        "B": I((80, 62, 50), flat=True),
        "c": I((150, 110, 74), shadow=(104, 72, 56), line=(46, 28, 18), layer=1,
               form=(6, 4)),
        "x": I((0, 0, 0), of="c", tone=0),
        "b": I((120, 170, 170), shadow=(60, 104, 116), line=(24, 44, 50), layer=6,
               form=(1, 1)),
        "v": I((224, 214, 190), shadow=(170, 158, 146), line=(80, 70, 60),
               layer=3, form=(4, 3)),
        "V": I((0, 0, 0), of="v", tone=0),
    }
    inks.update(skin_inks((214, 170, 132), line=(80, 44, 30)))
    inks.update(eye_inks((150, 108, 70), lash=(40, 28, 22)))
    return cv, inks


def _anubis():
    """Anubis: black jackal, gold-rimmed eyes, the striped headcloth and the
    broad collar of the weigher of hearts. Authored facing right like the
    rest; he is shown on the right of the box, turned to face you."""
    cv = canvas()
    # shoulders, the broad collar in bands, the headcloth's lappets
    poly(cv, [(0, 144), (4, 120), (18, 106), (40, 98), (80, 98), (104, 106),
              (120, 120), (126, 144)], "f")
    for rx, ry, ch in ((58, 26, "y"), (52, 22, "t"), (46, 18, "y"), (40, 14, "u"),
                       (34, 10, "y")):
        oval(cv, 60, 100, rx, ry, ch, onto="f" + "ytu")
    poly(cv, [(26, 40), (40, 30), (54, 40), (52, 76), (48, 104), (22, 108), (20, 70)], "y")
    for y in range(34, 110, 6):
        for x in range(0, 60):
            for dy in range(3):
                if 0 <= y + dy < H and cv[y + dy][x] == "y" and x < 56:
                    cv[y + dy][x] = "u"
    # the head: skull, long muzzle, jaw
    poly(cv, [(44, 60), (40, 100), (72, 100), (70, 70)], "f")          # neck
    oval(cv, 58, 46, 20, 17, "f")
    poly(cv, [(64, 38), (104, 54), (110, 58), (110, 64), (104, 68), (76, 72), (64, 66)], "f")
    poly(cv, [(46, 52), (72, 72), (64, 82), (50, 76)], "f")           # jaw
    # the ears, tall and pointed, gold-lined inside
    poly(cv, [(44, 38), (38, 0), (58, 30)], "f")
    poly(cv, [(58, 32), (70, 2), (76, 36)], "f")
    poly(cv, [(46, 32), (42, 10), (53, 29)], "i")
    poly(cv, [(62, 30), (69, 10), (72, 32)], "i")
    oval(cv, 107, 60, 4, 3.5, "o")                                     # nose
    line(cv, [(76, 70), (90, 69), (104, 67)], "l")                      # mouth
    line(cv, [(68, 44), (84, 50), (100, 54)], "F", onto="f")           # muzzle ridge
    stamp(cv, 60, 45, [
        "...KKKKKK....",
        ".KKKggggKK...",
        "KKgggGGgggKKK",
        "..KKggggKK..K",
        "....KKKK.....",
    ])
    lock(cv, (56, 44), (62, 40), (72, 42), 0.8, 0.6, "K")              # brow of kohl
    inks = {
        "f": I((52, 48, 66), shadow=(26, 22, 38), light=(96, 92, 132),
               line=(10, 8, 18), inner=(20, 18, 30), layer=3, form=(3, 3),
               casts=(("y", 0, 4),)),
        "F": I((0, 0, 0), of="f", tone=2),
        "i": I((150, 70, 60), shadow=(96, 40, 40), line=(214, 176, 90),
               inner=(214, 176, 90), layer=4, form=(2, 2)),
        "o": I((20, 18, 26), line=(8, 6, 12), layer=5, form=(0, 0)),
        "l": I((14, 10, 20), flat=True),
        "y": I((226, 186, 90), shadow=(170, 110, 56), light=(252, 226, 150),
               line=(70, 44, 16), inner=(120, 80, 30), layer=1, form=(3, 3)),
        "u": I((50, 70, 150), shadow=(30, 40, 100), light=(90, 110, 190),
               line=(12, 16, 44), inner=(24, 30, 80), layer=1, form=(3, 3)),
        "t": I((80, 190, 180), shadow=(40, 120, 130), light=(150, 226, 210),
               line=(14, 50, 50), layer=1, form=(3, 3)),
        "K": I((12, 10, 18), flat=True),
        "g": I((255, 206, 90), flat=True),
        "G": I((255, 252, 230), flat=True),
    }
    return cv, inks


FACE_ROUND = [(40, 46), (40, 60), (42, 67), (47, 74), (53, 78), (59, 80),
              (63, 80), (69, 76), (75, 70), (79, 63), (81, 56), (82, 48),
              (83, 42), (78, 32), (60, 28), (46, 32)]


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
DROP = {"kid": 10}
RIGHT = {"anubis"}

_cache = {}


def portrait(key):
    """The lit portrait surface for one character, cached. Faces are
    authored turned to the right; one shown on the right is mirrored."""
    if key not in _cache:
        cv, inks = CAST[key]()
        surf = render(cv, inks)
        drop = DROP.get(key, 0)
        if drop:
            out = pygame.Surface(surf.get_size(), pygame.SRCALPHA)
            out.blit(surf, (0, drop))
            surf = out
        if key in RIGHT:
            surf = pygame.transform.flip(surf, True, False)
        _cache[key] = surf
    return _cache[key]
