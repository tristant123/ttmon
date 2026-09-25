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
from .parts import *                       # noqa: F401,F403 - the authoring kit
from .parts import GLINT


POSES = ("idle", "attack", "cast")


class Creature:
    """A monster's art: one build function, many poses.

    `build(pose)` returns the material rows for that pose - the same parts
    moved: an arm swung, wings flared, a head lowered to charge. Poses a
    creature does not draw fall back to its idle pose, and the battle scene
    covers the gap with motion alone."""

    def __init__(self, build, mats, poses=POSES):
        self.build = build
        self.mats = mats
        self.poses = tuple(poses)

    def rows(self, pose):
        return self.build(pose if pose in self.poses else "idle")


# ===========================================================================
# THE ROSTER
#
# Each creature is a block of parts and a function that stamps them onto an
# 80x80 canvas back to front, once per pose. Letters are materials, and each block has its
# own material table, so the same letter means different things in
# different creatures - but never two things within one.
# ===========================================================================

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
# PIXIE (80) - a hedge-sprite grown into something with an edge: slight,
# sharp-eyed, twin tails of leaf-green hair and dragonfly wings, a little wind
# held in one palm like a knife she has not decided to use.
# --------------------------------------------------------------------------
_PIXIE_HEAD = rows_of(19,
    "..........jh.......",
    "....j.jjhhj...j....",
    "...jhjhhhhHhhjhj...",
    "..jhhhhHHHHHhhhhj..",
    ".jhhhhHHHhhhhhhhhj.",
    "jhhhhhhhhhhhhhhhhhj",
    "jhhhhhhhhhhhhhhhhhh",
    "jhjhhhjhhhhjhhhhhhh",
    "hjbbhhjbbhhbjhhhhhh",
    "jhbaajaaaabbhhhhhhh",
    "hjakkkaakkkkkhhhhhh",
    "hja+ikaai+iiekhhhhh",
    "hjaiIkaaiIIieahhhhh",
    "hjaakaaaakkkaahhhhh",
    "hjaaanaaaaaaaabhhhh",
    "hj.aaaaaaaaaabbhhhj",
    "hj.aammaaaaaabhhhhj",
    "hj..aaaaaaaabbhhhj.",
    "hj...aaaaaabbhhhj..",
    ".j....aaaabbhhhj...",
    ".j.....abb..hhj....",
    "........bbb.hj.....",
    ".........bbb.......",
)
_PIXIE_TORSO = spans(14, [(5, 8), (5, 8), (2, 11), (1, 12), (1, 12), (1, 12),
                          (2, 11), (2, 11), (3, 10), (3, 10), (3, 10)], "a")
_PIXIE_BODICE = spans(14, [None, None, None, (1, 12), (1, 12), (2, 11), (2, 11),
                           (2, 11), (3, 10), (3, 10), (3, 10)], "d")
_PIXIE_BODICE[3] = "." + "g" * 12 + "."
_PIXIE_SKIRT = spans(20, [(6, 13), (5, 14), (4, 15), (3, 16), (2, 17), (1, 18),
                          (0, 19), (0, 19)], "d")
_PIXIE_SKIRT += ["dd.ddd.dddd.ddd.dd.".ljust(20, "."), "d...d...dd...d...d.".ljust(20, ".")]
_PIXIE_SKIRT = [r[:10] + r[10:].replace("d", "D") for r in _PIXIE_SKIRT]


def _pixie_wing(length, width, fill, rib, rim):
    """A dragonfly wing: long, narrow, round at the tip, ribbed along its
    length - light enough to read as membrane, not as a paddle."""
    sp = plume(length, 1, width // 2 + 1, 2, width, w_base=2, w_tip=3, peak=0.7)
    rows = spans(None, sp, fill, edge=rim)
    rows = recolour(rows, (0, 2), fill, rim)
    for k in (0.35, 0.65):
        tip = int(sp[2][0] + (sp[2][1] - sp[2][0]) * k)
        rows = vein(rows, (2, length - 1), (tip, 2), rib)
    return rows


_PIXIE_WING_UP = _pixie_wing(32, 11, "w", "v", "c")
_PIXIE_WING_LO = _pixie_wing(26, 9, "w", "v", "c")
_PIXIE_WING_FAR = [r.replace("w", "x").replace("v", "y").replace("c", "z")
                   for r in _pixie_wing(26, 9, "w", "v", "c")]

# arm paths per pose: (shoulder, elbow, hand) for the far and near arm
_PIXIE_ARMS = {
    "idle":   (((35, 31), (29, 36), (25, 33)), ((44, 31), (48, 37), (45, 42))),
    "attack": (((34, 31), (26, 31), (17, 30)), ((44, 31), (48, 36), (47, 41))),
    "cast":   (((35, 31), (31, 22), (32, 13)), ((44, 31), (49, 22), (47, 13))),
}
_PIXIE_WIND = rows_of(7, "..s....", ".sSs.s.", "sSWSsSs", ".sSs.s.", "..s....")


def _pixie(pose):
    cv = canvas(80, 80)
    lean = -3 if pose == "attack" else 0          # the whole body leans in
    lift = -2 if pose == "cast" else 0
    ox, oy = lean, lift
    # wings: flared up to cast, swept back to strike
    tilt = {"idle": 0, "attack": 16, "cast": -14}[pose]
    pin_rotated(cv, _PIXIE_WING_FAR, (2, 25), (37 + ox, 30 + oy), 38 - tilt, flip=True)
    pin_rotated(cv, _PIXIE_WING_FAR, (2, 25), (38 + ox, 33 + oy), 70 - tilt, flip=True)
    pin_rotated(cv, _PIXIE_WING_UP, (2, 31), (45 + ox, 30 + oy), 28 + tilt)
    pin_rotated(cv, _PIXIE_WING_LO, (2, 25), (45 + ox, 33 + oy), 72 + tilt)
    # twin tails stream back, further when she strikes
    fling = 6 if pose == "attack" else 0
    for dy, r in ((0, 1.9), (6, 1.6)):
        tube(cv, [(45 + ox, 12 + oy + dy, r + 0.6), (52 + ox + fling, 19 + oy + dy, r),
                  (56 + ox + fling, 31 + oy + dy, r * 0.9), (53 + ox + fling, 42 + oy + dy, r * 0.7),
                  (56 + ox + fling, 49 + oy + dy, 0.6)], "t")
    # far leg bent back, near leg pointed straight: she is hovering
    tube(cv, [(36 + ox, 45 + oy, 2.3), (35 + ox, 56 + oy, 2.0), (40 + ox, 63 + oy, 1.7),
              (46 + ox, 66 + oy, 1.3)], "b")
    tube(cv, [(46 + ox, 65 + oy, 1.5), (49 + ox, 67 + oy, 1.0)], "O")
    tube(cv, [(41 + ox, 45 + oy, 2.4), (42 + ox, 58 + oy, 2.1), (43 + ox, 70 + oy, 1.6),
              (42 + ox, 76 + oy, 1.1)], "a")
    tube(cv, [(43 + ox, 69 + oy, 1.8), (42 + ox, 76 + oy, 1.2)], "o")
    far, near = _PIXIE_ARMS[pose]
    tube(cv, [(x + ox, y + oy, r) for (x, y), r in zip(far, (2.0, 1.8, 1.5))], "b")
    stamp(cv, 32 + ox, 26 + oy, _PIXIE_TORSO)
    stamp(cv, 32 + ox, 26 + oy, _PIXIE_BODICE, onto=True)
    stamp(cv, 29 + ox, 36 + oy, _PIXIE_SKIRT)
    tube(cv, [(x + ox, y + oy, r) for (x, y), r in zip(near, (2.1, 1.9, 1.6))], "a")
    stamp(cv, 28 + ox, 4 + oy, _PIXIE_HEAD)
    hand = far[2]
    if pose == "attack":
        stamp(cv, 8 + ox, 27 + oy, rows_of(9, "..s.s....", ".sSsSs.s.", "sSWWWSsSs",
                                            ".sSsSs.s.", "..s.s...."))
    elif pose == "cast":
        stamp(cv, 35 + ox, 5 + oy, _PIXIE_WIND)
    else:
        stamp(cv, hand[0] - 4 + ox, hand[1] - 6 + oy, _PIXIE_WIND)
    return finish(cv)


PIXIE_MAT = {
    "a": M((252, 228, 212), "cel"), "b": M((226, 190, 182), "cel"),
    "h": M((70, 170, 110), "fur"), "H": M((160, 232, 170), "fur", over="h"),
    "j": M((36, 100, 76), "fur"),
    "t": M((48, 140, 96), "fur"),
    "e": M((250, 250, 250), "gem", flat=True),
    "k": M((30, 22, 40), "gem", flat=True),
    "i": M((50, 150, 120), "gem", flat=True), "I": M((150, 240, 200), "gem", flat=True),
    "+": GLINT,
    "n": M((210, 160, 150), "cel", flat=True), "m": M((200, 110, 120), "cel", flat=True),
    "d": M((50, 130, 90), "cloth"), "D": M((80, 170, 110), "cloth"),
    "g": M((230, 190, 90), "metal", outline=(80, 56, 30)),
    "o": M((40, 90, 70), "cloth"), "O": M((34, 76, 60), "cloth"),
    # the wings are light, not objects: thin ribs, a faint glow, no weight
    "W2": None,
}
PIXIE_MAT.update({
    "w": M((196, 244, 240), "gem", emissive=0.3),
    "v": M((70, 170, 170), "gem", over="w"),
    "c": M((40, 120, 130), "gem"),
    "x": M((130, 200, 204), "gem", emissive=0.15),
    "y": M((60, 140, 150), "gem", over="x"), "z": M((34, 100, 112), "gem"),
    "s": M((210, 255, 240), "gem", flat=True, outline=False),
    "S": M((240, 255, 250), "gem", flat=True, outline=False),
    "W": M((255, 255, 255), "gem", flat=True, outline=False),
})
del PIXIE_MAT["W2"]

# --------------------------------------------------------------------------
# KITSUNE (80) - a fox of the shrines, long and low, a rope of office round
# its throat and three tails already burning. It does not so much attack as
# decide to.
# --------------------------------------------------------------------------
def _kitsune_tail(length, width, fill, core):
    sp = plume(length, 3, 9, 5, width, w_base=5, peak=0.5)
    rows = spans(None, sp, fill)
    rows = inset(rows, fill, core, 2)
    # the tip burns: ember, then flame, then white heat
    rows = recolour(rows, (0, 13), core, "F")
    rows = recolour(rows, (0, 10), fill, "F")
    rows = recolour(rows, (0, 10), "F", "f")
    return recolour(rows, (0, 5), "f", "W")


_KITSUNE_TAILS = [_kitsune_tail(30, 11, "t", "u"), _kitsune_tail(34, 12, "s", "v"),
                  _kitsune_tail(28, 10, "t", "u")]
_KITSUNE_HEAD = rows_of(24,
    "..............kk.....kk.",
    ".............kki....kik.",
    "............kaii...kaik.",
    "............aaii...aaia.",
    "...........aaaai..aaaia.",
    "...........aaaaiaaaaaia.",
    "..........aaaaaaaaaaaaa.",
    ".........aaaaaaaaaaaaaaa",
    "........aaarrkkkaaaaaaaa",
    ".......aaaakyykaaaaaaaaa",
    "......aaaaaakkaaraaaaaaa",
    "...aaaaaaaaaaaarraaaaaaa",
    ".aaaaaaaaaaaaaaaaaaaaaa.",
    "naaaaaaaaaaaaaaaaaaaaa..",
    "nmmmmmmmmaaaaaaaaaaaa...",
    ".mmmmmmmmmmmmaaaaaaa....",
    "..mmmmmmmmmmmmmaaaa.....",
    "....mmmmmmmmmmmm........",
)
_KITSUNE_JAW_OPEN = rows_of(24,
    "..............kk.....kk.",
    ".............kki....kik.",
    "............kaii...kaik.",
    "............aaii...aaia.",
    "...........aaaai..aaaia.",
    "...........aaaaiaaaaaia.",
    "..........aaaaaaaaaaaaa.",
    ".........aaaaaaaaaaaaaaa",
    "........aaarrkkkaaaaaaaa",
    ".......aaaakyykaaaaaaaaa",
    "......aaaaaakkaaraaaaaaa",
    "...aaaaaaaaaaaarraaaaaaa",
    ".aaaaaaaaaaaaaaaaaaaaaa.",
    "naaaaaaaaaaaaaaaaaaaaa..",
    ".TqTqTqTqqqqaaaaaaaaa...",
    "..qqqqqqqqqqqqmaaaaa....",
    "..TqTqTqqqqqmmmmmaa.....",
    "...mmmmmmmmmmmm.........",
    ".....mmmmmmmm...........",
)
_KITSUNE_ROPE = rows_of(14,
    "..cccccccccc..",
    ".cCcCcCcCcCcc.",
    "..cccccccccc..",
    "....p..p..p...",
    "...pp..pp.pp..",
    "....p...p..p..",
)
# (shoulder, knee, paw) per pose for each leg
_KITSUNE_LEGS = {
    "idle": {"fn": ((27, 47), (26, 62), (24, 76)), "ff": ((32, 48), (32, 62), (30, 75)),
             "hn": ((52, 46), (57, 60), (53, 76)), "hf": ((48, 47), (51, 61), (47, 75))},
    "attack": {"fn": ((22, 49), (13, 55), (5, 58)), "ff": ((27, 50), (19, 58), (11, 63)),
               "hn": ((52, 48), (58, 60), (62, 75)), "hf": ((48, 49), (53, 61), (56, 75))},
    "cast": {"fn": ((27, 47), (25, 62), (23, 76)), "ff": ((32, 48), (31, 62), (29, 75)),
             "hn": ((52, 46), (57, 60), (53, 76)), "hf": ((48, 47), (51, 61), (47, 75))},
}
_KITSUNE_FOXFIRE = rows_of(5, ".fF..", "fWWf.", "fWWFf", ".fff.")


def _kitsune(pose):
    cv = canvas(80, 80)
    low = 5 if pose == "attack" else 0            # the pounce drops the body
    spread = {"idle": (-34, 4, 36), "attack": (-8, 26, 54), "cast": (-48, -12, 22)}[pose]
    for tail, ang in zip(_KITSUNE_TAILS, spread):
        pin_rotated(cv, tail, base_of(tail), (56, 42 + low), ang)
    legs = _KITSUNE_LEGS[pose]
    for key in ("ff", "hf"):
        (x0, y0), (x1, y1), (x2, y2) = legs[key]
        tube(cv, [(x0, y0 + low // 2, 3.2), (x1, y1, 2.0), (x2, y2, 1.8)], "b")
        tube(cv, [(x1, y1 + 3, 1.9), (x2, y2, 1.8)], "k")
    # body: deep chest, tucked belly, long and low
    tube(cv, [(28, 42 + low, 7.0), (38, 43 + low, 6.2), (48, 42 + low, 5.6),
              (55, 41 + low, 5.4)], "a")
    tube(cv, [(28, 47 + low, 4.0), (36, 49 + low, 2.5)], "m")     # white chest
    for key in ("fn", "hn"):
        (x0, y0), (x1, y1), (x2, y2) = legs[key]
        tube(cv, [(x0, y0 + low // 2, 3.6), (x1, y1, 2.2), (x2, y2, 2.0)], "a")
        tube(cv, [(x1, y1 + 3, 2.1), (x2, y2, 2.0)], "k")         # black socks
    # the head: high and alert, thrust low to pounce, thrown back to howl
    hx, hy = {"idle": (4, 16), "attack": (-2, 27), "cast": (8, 8)}[pose]
    tube(cv, [(30, 40 + low, 6.4), (hx + 16, hy + 12, 5.8)], "a")
    head = _KITSUNE_JAW_OPEN if pose == "attack" else _KITSUNE_HEAD
    if pose == "cast":
        head, _ = rotate(head, -24)
    stamp(cv, hx, hy, head)
    stamp(cv, 29, 36 + low, _KITSUNE_ROPE)
    if pose == "cast":
        for x, y in ((0, 34), (14, 56), (64, 4), (72, 26)):
            stamp(cv, x, y, _KITSUNE_FOXFIRE)
    return finish(cv)


KITSUNE_MAT = {
    "a": M((222, 96, 44), "fur"), "b": M((176, 70, 40), "fur"),
    "m": M((250, 244, 232), "fur", over="a"),
    "i": M((252, 222, 210), "fur"), "k": M((44, 30, 34), "fur"),
    "n": M((26, 18, 22), "gem", flat=True),
    "q": M((90, 20, 34), "gem", flat=True), "T": M((255, 250, 240), "gem", flat=True),
    "y": M((255, 206, 70), "gem", flat=True),
    "r": M((150, 20, 40), "cloth", over="a"),
    "t": M((240, 170, 110), "fur"), "u": M((255, 220, 170), "fur"),
    "s": M((226, 130, 70), "fur"), "v": M((250, 190, 130), "fur"),
    "f": M((255, 150, 60), "gem", emissive=0.85), "F": M((250, 90, 50), "gem", emissive=0.7),
    "W": M((255, 246, 210), "gem", emissive=1.0),
    "c": M((214, 180, 120), "cloth"), "C": M((170, 130, 80), "cloth", over="c"),
    "p": M((250, 250, 244), "cloth", outline=False),
}

# --------------------------------------------------------------------------
# KAPPA (80) - a river warrior in a wide, planted stance, shell worn like a
# war-carapace and a trident held across its body. The dish on its crown has
# frozen over; spill it and a kappa loses its strength, so it fights without
# ever bowing its head.
# --------------------------------------------------------------------------
_KAPPA_SHELL = spans(None, ellipse(24, 32), "s")
_KAPPA_SHELL = inset(_KAPPA_SHELL, "s", "S", 3)
for _y in range(2, 30, 4):              # a serrated rim, like a snapper's
    _KAPPA_SHELL[_y] = _KAPPA_SHELL[_y].rstrip(".") + "R"
    _KAPPA_SHELL[_y] = _KAPPA_SHELL[_y].ljust(25, ".")
_KAPPA_SHELL = [r.ljust(25, ".") for r in _KAPPA_SHELL]
_KAPPA_HEAD = rows_of(18,
    "...ddddddddddd....",
    ".ddwwWWwwwfwwwdd..",
    "..ddddddddddddd...",
    "..hhhhhhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhhhh",
    ".hbhhbaahbhhhhhhhh",
    "hbaaaaaaaaahhhhhhh",
    "aaaaaaaaaaaahhhhhh",
    "akkkkaaaaaaaabhhhh",
    "aek+kaaaaaaaaabhhh",
    "aakkaaaaaaaaaaabhh",
    "yyyyaaaaaaaaaaab.h",
    "Yyyyyyaaaaaaaab..h",
    "qqyyyyyyaaaaab...h",
    ".qqqqqyyaaaab....h",
    "..qyyyyyaab.......",
    "....yyy...........",
)
_KAPPA_TORSO = spans(None, [(6, 16), (3, 19), (2, 20), (2, 20), (3, 19), (3, 18),
                            (4, 17), (5, 16), (5, 15), (6, 15), (6, 14), (6, 14),
                            (6, 14), (6, 14), (6, 14)], "a")
_KAPPA_PLASTRON = spans(None, [None, None, (5, 14), (5, 15), (6, 14), (6, 13),
                               (7, 13), (7, 13), (7, 12), (8, 12), (8, 12), (8, 12)], "p")
_KAPPA_PLASTRON[5] = _KAPPA_PLASTRON[5].replace("p", "P")
_KAPPA_PLASTRON[8] = _KAPPA_PLASTRON[8].replace("p", "P")
_KAPPA_LOIN = rows_of(14,
    "oooooooooooooo",
    "occcccccccccco",
    ".cccccccCccc..",
    ".ccccccCCcc...",
    "..cccccCcc....",
    "..cccc.Ccc....",
    "...cc...c.....",
)
_KAPPA_TRIDENT = rows_of(9,
    "X...X...X",
    "x..xXx..x",
    "xX.xXx.Xx",
    ".xXxxxXx.",
    "..xxXxx..",
    "...xxx...",
    "....x....",
) + ["....o...."] * 34 + ["...xxx...", "....x...."]
_KAPPA_ICE = rows_of(5, "..i..", ".iIi.", "iIIIi", ".iIi.", "..i..")


def _kappa(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    stamp(cv, 40 + ox, 20, _KAPPA_SHELL)
    # a wide, planted stance: far leg back, near leg forward and bent
    tube(cv, [(44 + ox, 52, 4.2), (52 + ox, 62, 3.4), (50 + ox, 72, 2.6), (52 + ox, 76, 2.4)], "b")
    stamp(cv, 49 + ox, 75, rows_of(8, "bb.bb.bb", "bbbbbbbb"))
    stamp(cv, 26 + ox, 24, _KAPPA_TORSO)
    stamp(cv, 26 + ox, 24, _KAPPA_PLASTRON, onto=True)
    tube(cv, [(36 + ox, 52, 4.4), (27 + ox, 60, 3.6), (25 + ox, 70, 2.8), (22 + ox, 76, 2.5)], "a")
    stamp(cv, 16 + ox, 75, rows_of(9, "aa.aa.aa.", "aaaaaaaaa"))
    stamp(cv, 29 + ox, 45, _KAPPA_LOIN)
    # the trident: across the body in guard, levelled to thrust, raised to call
    if pose == "attack":
        spear, _ = rotate(_KAPPA_TRIDENT, -84)
        stamp(cv, -2, 26, spear)
        arm_far = [(30, 27, 3.4), (22, 32, 2.6), (14, 34, 2.4)]
        arm_near = [(42, 28, 3.8), (34, 36, 2.8), (24, 36, 2.6)]
    elif pose == "cast":
        stamp(cv, 12, -2, _KAPPA_TRIDENT)
        arm_far = [(30, 26, 3.4), (22, 20, 2.6), (17, 12, 2.4)]
        arm_near = [(42, 27, 3.8), (30, 22, 2.8), (18, 17, 2.6)]
        for x, y in ((2, 6), (28, 0), (4, 30), (30, 16)):
            stamp(cv, x, y, _KAPPA_ICE)
    else:
        spear, _ = rotate(_KAPPA_TRIDENT, -22)
        stamp(cv, 8, 2, spear)
        arm_far = [(30, 27, 3.4), (24, 34, 2.6), (20, 31, 2.4)]
        arm_near = [(42, 28, 3.8), (38, 38, 2.8), (30, 44, 2.6)]
    tube(cv, arm_far, "b")
    tube(cv, arm_far[1:], "r")          # bandaged forearms
    stamp(cv, 20 + ox, 6, _KAPPA_HEAD)
    tube(cv, arm_near, "a")
    tube(cv, arm_near[1:], "r")
    return finish(cv)


KAPPA_MAT = {
    "a": M((88, 160, 116), "scale"), "b": M((64, 126, 96), "scale"),
    "h": M((24, 58, 66), "fur"),
    "s": M((62, 70, 44), "scale"), "S": M((104, 112, 60), "scale"),
    "R": M((200, 200, 150), "stone"),
    "p": M((226, 210, 146), "scale", over="a"), "P": M((180, 160, 100), "scale", over="a"),
    # a snapper's beak, bone and olive, not a duck's
    "y": M((168, 158, 110), "stone"), "Y": M((214, 206, 160), "stone", over="y"),
    "q": M((60, 40, 26), "gem", flat=True),
    "k": M((16, 22, 24), "gem", flat=True), "+": GLINT,
    "e": M((110, 220, 240), "gem", flat=True),
    "d": M((214, 222, 226), "stone"),
    "w": M((150, 214, 246), "gem", emissive=0.3), "W": M((226, 248, 255), "gem", emissive=0.6),
    "f": M((255, 255, 255), "gem", emissive=0.7),
    "x": M((170, 190, 210), "metal"), "X": M((236, 244, 255), "metal"),
    "o": M((96, 70, 50), "matte"),
    "c": M((50, 80, 140), "cloth"), "C": M((34, 56, 110), "cloth", over="c"),
    "r": M((220, 212, 190), "cloth"),
    "i": M((190, 236, 255), "gem", flat=True, outline=False),
    "I": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# THUNDERBIRD (80) - a storm raptor, wings like thunderheads, the bolt in its
# feathers glowing when it is angry, which is usually. The crest is not a
# feather.
# --------------------------------------------------------------------------
_TBIRD_NEAR = wing([30, 34, 33, 30, 26, 22, 18], [("b", "n"), ("d", "N")], gap=3, edge="e")
_TBIRD_FAR = [r.replace("b", "B").replace("d", "D").replace("n", "m").replace("N", "M")
              for r in wing([24, 28, 27, 24, 20, 16], [("b", "n"), ("d", "N")], gap=3, edge="e")]


def _bolted(rows, y):
    """Paint a lightning mark along one feather row of a wing."""
    rows = [list(r) for r in rows]
    x = 4
    zig = 0
    while x < len(rows[0]) - 6 and 0 <= y < len(rows):
        if rows[y][x] in "bdBD":
            rows[y][x] = "z"
        x += 1
        zig += 1
        if zig % 5 == 0:
            y += -1 if (zig // 5) % 2 else 1
    return ["".join(r) for r in rows]


_TBIRD_NEAR = _bolted(_TBIRD_NEAR, 5)
_TBIRD_NEAR = _bolted(_TBIRD_NEAR, 11)
# an eagle's head in profile: flat skull, a brow that overhangs the eye, and
# a beak that hooks down over its own lower half
_TBIRD_HEAD = rows_of(22,
    "..............zz.z....",
    "...........zzzzzzz.zz.",
    ".........zzbbbbbbzzzzz",
    "......bbbbbbbbbbbbbzz.",
    "....BBBBBBbbbbbbbbbbb.",
    "...BBBBBBBBbbbbbbbbbb.",
    "..yyBkggkBbbbbbbbbbbb.",
    ".yyyybkkbbbbbbbbbbbbb.",
    "yyyyyybbbbbbbbbbbbbb..",
    "yYYyyyybbbbbbbbbbbbb..",
    "yyyyyyyycbbbbbbbbbb...",
    "qyy.qyyyccbbbbbbbb....",
    ".q...qqyccccbbbbb.....",
    "......qqccccccbb......",
    ".........cccccc.......",
)
_TBIRD_TAIL = rows_of(16,
    "..bbbbbbbbbbbb..",
    ".bdbdbdbdbdbdbb.",
    ".bdbdbdbdbdbdbd.",
    "bbdbbdbbdbbdbbdb",
    "bd.bd.bd.bd.bd.b",
    "b..b..b..b..b..b",
)
_TBIRD_ARC = rows_of(7, "z......", ".z..z..", "..zz.z.", "...z..z", "..z....")


def _thunderbird(pose):
    cv = canvas(80, 80)
    dive = pose == "attack"
    # wings: half-spread in flight, swept back in the dive, raised to call
    near_a, far_a = {"idle": (-38, -64), "attack": (-8, -26), "cast": (-70, -96)}[pose]
    # the far wing rises behind the near one: a layered V, clear of the head
    pin_rotated(cv, _TBIRD_FAR, (0, 8), (40, 26), far_a)
    body_tilt = 18 if dive else 0
    tail, _ = rotate(_TBIRD_TAIL, 20 + body_tilt)
    stamp(cv, 40, 48 - body_tilt // 3, tail)
    # talons: tucked in flight, thrown forward in the dive
    if dive:
        for x in (26, 32):
            tube(cv, [(x + 8, 50, 2.2), (x, 58, 1.8), (x - 6, 62, 1.6)], "l")
            stamp(cv, x - 10, 61, rows_of(6, "t.t.t.", ".ttt.."))
    else:
        for x in (36, 42):
            tube(cv, [(x, 50, 2.2), (x, 60, 1.8), (x - 1, 66, 1.6)], "l")
            stamp(cv, x - 4, 65, rows_of(6, "t.t.t.", "tttt.."))
    # body: a deep chest tapering to the tail
    tube(cv, [(34, 30 + body_tilt // 2, 9.0), (38, 40, 8.5), (42, 48, 6.0)], "b")
    # the breast is feathered, not a bib: rows of pale chevrons
    for y in range(26, 50, 3):
        for x in range(24, 44):
            if cv[y][x] == "b" and (x + 2 * y) % 5 == 0:
                cv[y][x] = "C"
    hx, hy = {"idle": (12, 10), "attack": (10, 22), "cast": (14, 6)}[pose]
    tube(cv, [(33, 30 + body_tilt // 2, 7.0), (hx + 14, hy + 9, 5.5)], "b")
    stamp(cv, hx, hy, _TBIRD_HEAD)
    pin_rotated(cv, _TBIRD_NEAR, (0, 8), (44, 30), near_a)
    if pose == "cast":
        for x, y in ((2, 2), (60, 0), (4, 40), (66, 50)):
            stamp(cv, x, y, _TBIRD_ARC)
    return finish(cv)


THUNDERBIRD_MAT = {
    "b": M((40, 52, 110), "fur"), "d": M((58, 76, 146), "fur"),
    "B": M((30, 38, 84), "fur"), "D": M((44, 56, 110), "fur"),
    "n": M((230, 230, 250), "fur"), "N": M((200, 210, 240), "fur"),
    "m": M((170, 176, 210), "fur"), "M": M((150, 156, 196), "fur"),
    "e": M((20, 24, 50), "fur"),
    "c": M((236, 226, 196), "fur"), "C": M((150, 164, 214), "fur", over="b"),
    "z": M((255, 236, 110), "gem", emissive=0.8),
    "y": M((250, 196, 70), "scale"), "Y": M((255, 236, 160), "scale", over="y"),
    "q": M((110, 70, 30), "gem", flat=True),
    "k": M((16, 16, 30), "gem", flat=True),
    "l": M((236, 190, 70), "scale"), "t": M((30, 26, 30), "stone"),
}
THUNDERBIRD_MAT["g"] = M((255, 230, 90), "gem", flat=True)

# --------------------------------------------------------------------------
# MANDRAKE (80) - pulled from the ground at last, and not grateful. A slender
# thing of pale root with a mane of leaf blades, fingers like twigs, and a
# mouth that opens much wider than a mouth should.
# --------------------------------------------------------------------------
def _mandrake_blade(length, width, fill, rib):
    sp = plume(length, 1, 3, 2, width, w_base=2, peak=0.35)
    rows = spans(None, sp, fill)
    return vein(rows, (2, length - 1), (3, 1), rib)


_MANDRAKE_BLADES = [_mandrake_blade(18, 5, "g", "v"), _mandrake_blade(24, 6, "G", "V"),
                    _mandrake_blade(28, 6, "g", "v"), _mandrake_blade(26, 6, "G", "V"),
                    _mandrake_blade(22, 5, "g", "v"), _mandrake_blade(16, 4, "G", "V")]
# a long face, hollow at the eyes; something glows at the bottom of them
_MANDRAKE_HEAD = rows_of(13,
    "....bbbbb....",
    "..baaaaaaab..",
    ".baaaaaaaaab.",
    "baaaaaaaaaaab",
    "akkkaaaakkkkb",
    "akekaaaakkekb",
    "aakkaaaaakkab",
    "aaaaacaaaaab.",
    ".aaaacaaaaab.",
    ".aaaaaaaaab..",
    "..aqqqqqab...",
    "...aaaaab....",
    "....abbb.....",
    ".....bb......",
)
_MANDRAKE_SCREAM = rows_of(13,
    "....bbbbb....",
    "..baaaaaaab..",
    ".baaaaaaaaab.",
    "baaaaaaaaaaab",
    "akkkaaaakkkkb",
    "akekaaaakkekb",
    "aakkaaaaakkab",
    "aaaqqqqqaaab.",
    ".aqqQQQqqaab.",
    ".aqQQQQQqab..",
    "..qqQQQqqb...",
    "...qqQqqb....",
    "....qqqb.....",
    ".....bb......",
)
_MANDRAKE_SPRIG = rows_of(6, "..gG..", ".gGGg.", "gGgg..", ".b....")
_MANDRAKE_TORSO = spans(None, [(3, 8), (1, 11), (0, 12), (1, 11), (2, 10), (2, 10),
                               (3, 9), (3, 9), (3, 9), (2, 10), (2, 10), (1, 11),
                               (1, 11), (2, 10)], "a")
_MANDRAKE_RING = rows_of(9, "..sssss..", ".s.....s.", "s.......s")


def _mandrake(pose):
    cv = canvas(80, 80)
    hx, hy = {"idle": (29, 9), "attack": (22, 14), "cast": (30, 7)}[pose]
    # the mane: leaf blades swept back off the crown, flared to scream
    fan = {"idle": (-10, 20, 44, 66, 88, 110), "attack": (20, 42, 62, 82, 100, 118),
           "cast": (-40, -14, 12, 38, 64, 90)}[pose]
    for blade, ang in zip(_MANDRAKE_BLADES, fan):
        pin_rotated(cv, blade, base_of(blade), (hx + 8, hy + 3), ang)
    # roots for legs: they split at the hip and grip the ground
    for (x1, y1), (x2, y2), r in (((30, 58), (22, 76), 2.6), ((36, 60), (34, 76), 2.8),
                                  ((42, 58), (48, 76), 2.6), ((46, 56), (58, 74), 2.0),
                                  ((26, 56), (14, 72), 2.0)):
        tube(cv, [(37, 46, 4.0), (x1, y1, r), (x2, y2, r * 0.45)], "b")
    tube(cv, [(36, 46, 4.2), (34, 60, 2.8), (33, 76, 1.6)], "a")
    stamp(cv, 30, 24 if pose != "attack" else 27, _MANDRAKE_TORSO)
    # arms like branches; the fingers are twigs
    arms = {"idle": ([(32, 27, 2.4), (26, 38, 2.0), (24, 50, 1.6)],
                     [(42, 27, 2.6), (47, 38, 2.2), (48, 50, 1.8)]),
            "attack": ([(32, 30, 2.4), (20, 30, 2.0), (8, 26, 1.6)],
                       [(42, 30, 2.6), (32, 36, 2.2), (16, 36, 1.8)]),
            "cast": ([(32, 26, 2.4), (22, 20, 2.0), (16, 10, 1.6)],
                     [(42, 26, 2.6), (52, 20, 2.2), (58, 10, 1.8)])}[pose]
    for arm, mat in zip(arms, ("b", "a")):
        tube(cv, arm, mat)
        (xa, ya, _), (xb, yb, _) = arm[-2], arm[-1]
        dx, dy = xb - xa, yb - ya
        for spread in (-0.5, 0.0, 0.5):              # three twig fingers
            fx = xb + int(dx * 0.4 - dy * spread * 0.5)
            fy = yb + int(dy * 0.4 + dx * spread * 0.5)
            tube(cv, [(xb, yb, 1.0), (fx, fy, 0.5)], mat)
    stamp(cv, hx, hy, _MANDRAKE_SCREAM if pose == "cast" else _MANDRAKE_HEAD)
    ty = 24 if pose != "attack" else 27
    stamp(cv, 27, ty - 3, _MANDRAKE_SPRIG)
    stamp(cv, 41, ty - 4, mirror(_MANDRAKE_SPRIG))
    # cracks in the bark
    for a, b in (((33, 28), (35, 34)), ((38, 31), (36, 37)), ((34, 44), (36, 50))):
        for y, row in enumerate(vein(finish(cv), a, b, "c")):
            cv[y][:] = row
    if pose == "cast":
        for i, (x, y) in enumerate(((16, 16), (10, 12), (4, 8))):
            stamp(cv, x - 2 * i, y, _MANDRAKE_RING)
    return finish(cv)


MANDRAKE_MAT = {
    "a": M((222, 208, 172), "plant"), "b": M((166, 146, 108), "plant"),
    "c": M((120, 100, 70), "plant", over="a"),
    "g": M((60, 140, 70), "plant"), "G": M((100, 176, 80), "plant"),
    "v": M((140, 200, 110), "plant", over="g"), "V": M((170, 220, 130), "plant", over="G"),
    "k": M((30, 26, 20), "gem", flat=True),
    "e": M((210, 255, 90), "gem", flat=True),
    "q": M((40, 20, 20), "gem", flat=True), "Q": M((90, 30, 40), "gem", flat=True),
    "s": M((230, 255, 200), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# WISP (80) - a grave-light that learned to wear a face: a hood and robe of
# cold violet fire, a noh mask where its head should be, and a paper lantern
# it carries for the dead who have lost their way. It is not helping.
# --------------------------------------------------------------------------
def _layers(rows, *steps):
    for frm, to, by in steps:
        rows = inset(rows, frm, to, by)
    return rows


def _wisp_robe():
    # an inverted flame: narrow at the shoulders, flaring into tongues
    out = []
    for y in range(44):
        t = y / 43.0
        half = 5 + 13 * t ** 0.8
        cx = 38 + 3 * t
        out.append((int(cx - half), int(cx + half)))
    rows = spans(64, out, "f")
    rows = [list(r) for r in rows]
    for y in range(28, 44):                 # tattered hem: tongues of flame
        for x in range(64):
            if rows[y][x] != "." and ((x // 3) % 2 == 0) and y > 28 + (x * 7) % 13:
                rows[y][x] = "."
    rows = ["".join(r) for r in rows]
    # dark inside, cold fire at the rim: a wraith, not a campfire
    return _layers(rows, ("f", "o", 2), ("o", "d", 2))


_WISP_ROBE = _wisp_robe()
# a pointed cowl, the tip licking up like the flame it is
_WISP_HOOD = _layers(spans(None, plume(26, 11, 13, -1, 22, w_base=18, w_tip=1, peak=0.35), "f"),
                     ("f", "o", 2), ("o", "d", 2))
_WISP_MASK = rows_of(12,
    "...wwwwww...",
    "..wwwwwwww..",
    ".wwrwwwwrww.",
    ".wwwwwwwwww.",
    "wwkkkwwkkkww",
    "wwkkwwwwkkww",
    "wwwwwwwwwwww",
    "wwwwwwwwwwww",
    ".wwwwwwwwww.",
    ".wwwrrrrwww.",
    "..wwwwwwww..",
    "...wwwwww...",
    "....wwww....",
)
_WISP_LANTERN = rows_of(9,
    "...nnn...",
    ".nnnnnnn.",
    "lLLLlLLLl",
    "lLYYYYYLl",
    "nnnnnnnnn",
    "lLYYWYYLl",
    "lLYYYYYLl",
    "nnnnnnnnn",
    "lLLLlLLLl",
    ".nnnnnnn.",
    "...nnn...",
    "....n....",
)
_WISP_EMBER = rows_of(3, ".s.", "sSs", ".s.")


def _wisp(pose):
    cv = canvas(80, 80)
    ox = -6 if pose == "attack" else 0
    stamp(cv, 8 + ox, 22, _WISP_ROBE)
    # arms: sleeves of flame ending in pale, long-fingered hands
    arms = {"idle": ([(32, 28, 3.5), (24, 36, 2.8), (20, 42, 2.0)],
                     [(46, 28, 3.5), (54, 34, 2.8), (58, 30, 2.0)]),
            "attack": ([(30, 26, 3.5), (18, 26, 2.8), (6, 24, 2.0)],
                       [(44, 28, 3.5), (50, 36, 2.8), (52, 42, 2.0)]),
            "cast": ([(32, 26, 3.5), (26, 16, 2.8), (24, 6, 2.0)],
                     [(46, 26, 3.5), (54, 32, 2.8), (58, 36, 2.0)])}[pose]
    for arm in arms:
        tube(cv, arm, "o")
        x, y, _ = arm[-1]
        tube(cv, [(x, y, 1.6), (x + (arm[-1][0] - arm[-2][0]) // 2,
                               y + (arm[-1][1] - arm[-2][1]) // 2, 0.8)], "h")
    stamp(cv, 27 + ox, 0, _WISP_HOOD)
    stamp(cv, 32 + ox, 13, _WISP_MASK)
    # the lantern hangs from one hand, raised high to cast
    lx, ly = {"idle": (15, 42), "attack": (47, 42), "cast": (19, -4)}[pose]
    stamp(cv, lx, ly, _WISP_LANTERN)
    if pose == "attack":
        # the swipe leaves claw marks of flame in the air
        for dy in (-4, 0, 4):
            tube(cv, [(10, 26 + dy, 1.2), (2, 30 + dy, 0.8)], "S")
    for x, y in ((6, 20), (64, 14), (70, 44), (4, 70), (60, 72)):
        stamp(cv, x, y, _WISP_EMBER)
    return finish(cv)


WISP_MAT = {
    "d": M((34, 20, 60), "cloth"),
    "o": M((80, 50, 170), "flame", emissive=0.4),
    "f": M((130, 170, 255), "flame", emissive=0.8),
    "h": M((220, 226, 250), "cel"),
    "w": M((240, 234, 220), "cel"), "k": M((20, 16, 30), "gem", flat=True),
    "r": M((200, 40, 60), "gem", flat=True),
    "l": M((200, 50, 50), "cloth", emissive=0.3), "L": M((250, 110, 80), "cloth", emissive=0.5),
    "Y": M((255, 220, 140), "gem", emissive=0.9), "W": M((255, 255, 230), "gem", emissive=1.0),
    "n": M((30, 24, 30), "matte"),
    "s": M((190, 200, 255), "gem", flat=True, outline=False),
    "S": M((230, 236, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# ANUBIS (112) - the boss, drawn at his own size rather than doubled: the
# jackal god in gold and lapis, the sun ringed behind him, sceptre planted in
# one hand and the scales of judgement held out in the other. When he lifts
# them overhead, every heart in the room is about to be weighed.
# --------------------------------------------------------------------------
_ANUBIS_HALO = inset(spans(None, ellipse(62, 62), "h"), "h", ".", 3)
# a jackal's ears: tall, narrow, upright - short ones make him a cat
_ANUBIS_EAR = spans(None, [(4, 4), (4, 4), (3, 5), (3, 5), (3, 5), (3, 6), (2, 6),
                           (2, 6), (2, 7), (2, 7), (1, 7), (1, 7), (1, 8), (1, 8),
                           (0, 8), (0, 8), (0, 8), (0, 9), (0, 9), (0, 9), (0, 9)], "a")
_ANUBIS_EAR = inset(_ANUBIS_EAR, "a", "i", 2)
# the skull runs in one long flat line down into the snout
_ANUBIS_HEAD = rows_of(30,
    "...............aaaaaaaa.......",
    "............aaaaaaaaaaaaaa....",
    "..........aaaaaaaaaaaaaaaaa...",
    "........aaggggggaaaaaaaaaaaa..",
    "......aaaakkeekkaaaaaaaaaaaa..",
    "....aaaaaakeEekaaaaaaaaaaaaa..",
    "..aaaaaaaaakkkaaaaaaaaaaaaa...",
    "AAAAaaaaaaaaaaaaaaaaaaaaaaa...",
    "nAAAAAAAaaaaaaaaaaaaaaaaaa....",
    "nnAAAAAAAAAaaaaaaaaaaaaaa.....",
    ".qqqqqAAAAAAAaaaaaaaaaaa......",
    "...qqqqqqAAAAAAaaaaaaaa.......",
    "......AAAAAAAAAAaaaaaa........",
    ".........AAAAAAAaaaa..........",
)
_ANUBIS_LAPPET = rows_of(5, *[("ggggg" if (y // 2) % 2 == 0 else "lllll") for y in range(24)])
_ANUBIS_COLLAR = [r.replace("g", "gttlggttlg."[min(y, 10)]) for y, r in
                  enumerate(spans(38, ellipse(38, 24)[12:], "g"))]
_ANUBIS_TORSO = spans(None, [(4, 36), (2, 38), (1, 39), (1, 39), (2, 38), (3, 37),
                             (4, 36), (5, 35), (6, 34), (7, 33), (8, 32), (9, 31),
                             (9, 31), (10, 30), (10, 30), (10, 30), (10, 30), (10, 30),
                             (11, 29), (11, 29), (11, 29), (11, 29), (11, 29), (11, 29)], "a")
_ANUBIS_ABS = rows_of(40,
    "........................................",
    "........................................",
    "........................................",
    "..........bbbbbbbbb...bbbbbbbbb.........",
    "............bbbbb.......bbbbb...........",
    "........................................",
    "........................................",
    "..................b.b...................",
    "..................b.b...................",
    "........................................",
    "..................b.b...................",
    "..................b.b...................",
    "........................................",
    "..................b.b...................",
)
_ANUBIS_PAULDRON = spans(None, ellipse(14, 10), "g")
_ANUBIS_PAULDRON = inset(_ANUBIS_PAULDRON, "g", "G", 2)
_ANUBIS_KILT = spans(34, [(3, 30), (3, 30), (2, 31), (2, 31), (1, 32), (1, 32),
                          (1, 32), (0, 33), (0, 33), (0, 33), (0, 33), (1, 32),
                          (2, 31), (4, 29)], "w")
_ANUBIS_KILT[0] = _ANUBIS_KILT[1] = "..." + "g" * 28 + "..."
_ANUBIS_KILT = [r[:14] + r[14:21].replace("w", "gllgllg"[i % 7] if False else "W") + r[21:]
                if 2 <= i else r for i, r in enumerate(_ANUBIS_KILT)]
for _i in range(2, 14):                       # the apron: gold and lapis bands
    _ANUBIS_KILT[_i] = (_ANUBIS_KILT[_i][:14] + ("gg" if _i % 3 else "ll") + "lllgg"[:3]
                        + ("gg" if _i % 3 else "ll") + _ANUBIS_KILT[_i][21:])
_ANUBIS_CAPE = spans(None, [(0, 10), (0, 12), (0, 14), (0, 15), (0, 16), (0, 17),
                            (0, 18), (0, 19), (0, 20), (0, 21), (0, 22), (0, 22),
                            (0, 23), (0, 23), (0, 24), (0, 24), (0, 25), (0, 25),
                            (0, 26), (0, 26), (0, 27), (0, 27), (0, 28), (0, 28),
                            (0, 29), (0, 29), (0, 30), (0, 30), (0, 30), (0, 30),
                            (0, 31), (0, 31), (0, 31), (0, 31), (0, 32), (0, 32),
                            (0, 32), (0, 32), (0, 33), (0, 33), (0, 33), (0, 33),
                            (1, 32), (2, 30), (4, 28), (6, 25), (9, 21)], "c")
_ANUBIS_CAPE = inset(_ANUBIS_CAPE, "c", "C", 3)
_ANUBIS_STAFF = rows_of(10,
    "gggggg....",
    "gGGggggg..",
    "....gggg..",
    ".....ggg..",
    "......gg..",
) + ["......gg.."] * 88 + ["....gggg..", "....g..g..", "....g..g.."]
_ANUBIS_SCALES = rows_of(34,
    "................g.................",
    "................G.................",
    "................g.................",
    ".gggggggggggggggGggggggggggggggg..",
    "..s.......................s.......",
    "..s.......................s.......",
    "..s......................s.s......",
    "..s.....................s...s.....",
    "..s....................s.....s....",
    ".s.s..................s..ff...s...",
    ".s.s.................ggggfFfgggg..",
    "s...s.................ggggggggg...",
    "s...s.............................",
    "s...s.............................",
    ".rrr..............................",
    "rrRrr.............................",
    "grrrgg............................",
    "gggggg............................",
    ".gggg.............................",
)


def _anubis(pose):
    cv = canvas(112, 112)
    lean = -4 if pose == "attack" else 0
    ox = lean
    stamp(cv, 36 + ox, 0, _ANUBIS_HALO)
    stamp(cv, 60 + ox, 44, _ANUBIS_CAPE)
    # legs: a wide stance, gold at the shin
    # legs: a wide stride under a short kilt, gold at the shin
    tube(cv, [(62 + ox, 80, 5.4), (70 + ox, 94, 4.4), (74 + ox, 109, 3.4)], "b")
    tube(cv, [(71 + ox, 98, 4.0), (74 + ox, 108, 3.6)], "g")
    tube(cv, [(52 + ox, 80, 5.6), (44 + ox, 94, 4.6), (40 + ox, 109, 3.6)], "a")
    tube(cv, [(43 + ox, 98, 4.2), (40 + ox, 108, 3.8)], "g")
    stamp(cv, 36 + ox, 46, _ANUBIS_TORSO)
    stamp(cv, 36 + ox, 46, _ANUBIS_ABS, onto=True)
    stamp(cv, 40 + ox, 70, _ANUBIS_KILT)
    # the sceptre: planted, swept in an arc, or held aside while he weighs
    if pose == "attack":
        staff, _ = rotate(_ANUBIS_STAFF, -58)
        stamp(cv, -8, 20, staff)
        near = [(76, 50, 5.5), (70, 62, 4.2), (58, 64, 3.8)]
    else:
        stamp(cv, 82 + ox, 4, _ANUBIS_STAFF)
        near = [(76, 50, 5.5), (84, 62, 4.2), (88, 70, 3.8)]
    # the scales: held out, or lifted high overhead to weigh
    if pose == "cast":
        stamp(cv, 20 + ox, 0, _ANUBIS_SCALES)
        far = [(44, 50, 5.2), (40, 34, 4.0), (37, 18, 3.6)]
    elif pose == "attack":
        far = [(44, 50, 5.2), (34, 60, 4.0), (30, 70, 3.6)]
    else:
        stamp(cv, 0 + ox, 58, _ANUBIS_SCALES)
        far = [(44, 50, 5.2), (32, 58, 4.0), (22, 58, 3.6)]
    tube(cv, [(x + ox, y, r) for x, y, r in far], "b")
    tube(cv, [(x + ox, y, r) for x, y, r in far[1:2]], "g")      # arm band
    stamp(cv, 34 + ox, 42, _ANUBIS_PAULDRON)
    tube(cv, [(60 + ox, 26, 6.0), (60 + ox, 44, 6.5)], "b")      # the neck
    stamp(cv, 49 + ox, 30, _ANUBIS_LAPPET)
    stamp(cv, 71 + ox, 30, _ANUBIS_LAPPET)
    stamp(cv, 41 + ox, 42, _ANUBIS_COLLAR)
    stamp(cv, 62 + ox, 0, _ANUBIS_EAR)
    stamp(cv, 54 + ox, 2, mirror(_ANUBIS_EAR))
    stamp(cv, 38 + ox, 16, _ANUBIS_HEAD)
    tube(cv, [(x + (ox if pose != "attack" else 0), y, r) for x, y, r in near], "a")
    tube(cv, [(x + (ox if pose != "attack" else 0), y, r) for x, y, r in near[1:2]], "g")
    stamp(cv, 70 + ox, 42, _ANUBIS_PAULDRON)
    return finish(cv)


ANUBIS_MAT = {
    "a": M((42, 38, 54), "fur"), "A": M((70, 62, 84), "fur"), "b": M((32, 28, 42), "fur"),
    "n": M((14, 12, 18), "gem", flat=True), "q": M((120, 40, 50), "gem", flat=True),
    "k": M((12, 10, 16), "gem", flat=True),
    "e": M((255, 210, 90), "gem", flat=True), "E": M((255, 255, 220), "gem", flat=True),
    "g": M((232, 186, 76), "metal", outline=(80, 50, 24)),
    "G": M((255, 236, 160), "metal", outline=(80, 50, 24)),
    "i": M((200, 150, 60), "metal"),
    "l": M((40, 70, 170), "cloth", outline=(16, 22, 60)),
    "t": M((70, 186, 178), "gem", outline=(16, 50, 56)),
    "w": M((238, 232, 214), "cloth"), "W": M((210, 202, 184), "cloth", over="w"),
    "c": M((110, 30, 44), "cloth"), "C": M((150, 44, 60), "cloth", over="c"),
    "h": M((255, 222, 140), "gem", flat=True, outline=False),
    "s": M((200, 160, 70), "metal", outline=False),
    "r": M((210, 50, 60), "skin"), "R": M((250, 120, 120), "skin", over="r"),
    "f": M((250, 250, 244), "cloth"), "F": M((210, 220, 236), "cloth"),
}

# --------------------------------------------------------------------------
# TENGU (80) - a karasu tengu: crow-headed, crow-winged, in the white robes
# and pom-pom sash of a mountain ascetic, and a better swordsman than any
# man who has climbed up to find out.
# --------------------------------------------------------------------------
_TENGU_WING_N = wing([19, 22, 22, 20, 17, 14], [("b", "e"), ("d", "e")], gap=3, edge="e")
_TENGU_WING_F = [r.replace("b", "B").replace("d", "D").replace("e", "E")
                 for r in wing([17, 20, 20, 18, 15], [("b", "e"), ("d", "e")], gap=3, edge="e")]
# a crow's head: the beak long and pale enough to read against black feathers
_TENGU_HEAD = rows_of(20,
    ".........TTTT.......",
    "........TTttTT......",
    ".......ccTTTTcc.....",
    "........bbbbbbb.....",
    "......bbbbbbbbbbb...",
    ".....bbbbbbbbbbbbb..",
    "....bbkkkbbbbbbbbbb.",
    "....bbkvvkbbbbbbbbb.",
    "yyyyybbkkbbbbbbbbbb.",
    "YYYYyyybbbbbbbbbbb..",
    ".yyyyyyyybbbbbbbbb..",
    "..qqqyyyyybbbbbbb...",
    "......qqqyybbbbb....",
    "........bbbbbb......",
    "........nnnnnn......",
)
_TENGU_ROBE = spans(None, [(5, 12), (3, 15), (2, 16), (1, 17), (1, 17), (1, 17),
                           (2, 16), (2, 16), (2, 16), (3, 15), (3, 15), (3, 15),
                           (3, 15)], "r")
_TENGU_SASH = rows_of(18,
    "..................",
    "..............o...",
    ".............oO...",
    "...........oo.....",
    ".........oo.......",
    "....O..oo.........",
    "...OOoo...O.......",
    "..oo.....OO.......",
    "..........O.......",
)
_TENGU_HAKAMA = spans(20, [(2, 16), (1, 17), (1, 18), (0, 18), (0, 19), (0, 19),
                           (0, 8), (0, 8), (0, 8), (0, 8), (11, 19), (11, 19)], "h")
_TENGU_BLADE = rows_of(3, "..z", ".zz", ".zz", "..w", "..w") + ["..x"] * 26 + ["..X", "..X", ".X."]
_TENGU_FAN = rows_of(11,
    "....fff....",
    "..ffFfFff..",
    ".fFfFfFfFf.",
    "fFfFfFfFfFf",
    "fFfFfFfFfFf",
    ".fFfFfFfFf.",
    "..ffFfFff..",
    "....f.f....",
    ".....w.....",
    ".....w.....",
)
_TENGU_GUST = rows_of(9, "..s....s.", ".s..ss...", "s..s....s", ".ss...ss.")


def _tengu(pose):
    cv = canvas(80, 80)
    ox = -5 if pose == "attack" else 0
    spread = {"idle": (-40, -70), "attack": (-12, -30), "cast": (-58, -92)}[pose]
    pin_rotated(cv, _TENGU_WING_F, (0, 7), (44 + ox, 32), spread[1])
    # legs in wide hakama, geta beneath
    stamp(cv, 28 + ox, 46, _TENGU_HAKAMA)
    for x in (30, 43):
        stamp(cv, x + ox, 58, rows_of(5, ".hhh.", ".hhh.", ".aaa.", ".aaa.",
                                      "ggggg", ".g.g.", ".g.g."))
    stamp(cv, 29 + ox, 30, _TENGU_ROBE)
    stamp(cv, 29 + ox, 30, _TENGU_SASH, onto=True)
    # the blade: held low and ready, swept through a cut, or put up for the fan
    if pose == "attack":
        blade, piv = rotate(_TENGU_BLADE, -118, (2, 30))
        stamp(cv, 22 - piv[0], 32 - piv[1], blade)
        near = [(44, 33, 2.6), (34, 34, 2.2), (24, 32, 2.0)]
    elif pose == "cast":
        stamp(cv, 12, 2, _TENGU_FAN)
        stamp(cv, 0, 20, _TENGU_GUST)
        stamp(cv, 2, 32, _TENGU_GUST)
        near = [(44, 33, 2.6), (46, 42, 2.2), (44, 48, 2.0)]
    else:
        blade, piv = rotate(_TENGU_BLADE, -160, (2, 30))
        stamp(cv, 24 - piv[0], 46 - piv[1], blade)
        near = [(44, 33, 2.6), (36, 42, 2.2), (26, 46, 2.0)]
    far = {"idle": [(32, 33, 2.4), (26, 40, 2.0), (24, 46, 1.8)],
           "attack": [(32, 33, 2.4), (26, 32, 2.0), (22, 32, 1.8)],
           "cast": [(32, 33, 2.4), (24, 24, 2.0), (18, 14, 1.8)]}[pose]
    tube(cv, [(x + ox, y, r) for x, y, r in far], "R")
    stamp(cv, 26 + ox, 10, _TENGU_HEAD)
    pin_rotated(cv, _TENGU_WING_N, (0, 7), (47 + ox, 34), spread[0])
    tube(cv, [(x + ox, y, r) for x, y, r in near], "r")
    return finish(cv)


TENGU_MAT = {
    # black feathers show their structure by a blue sheen along each edge
    "b": M((30, 30, 44), "fur"), "d": M((44, 44, 64), "fur"), "e": M((100, 110, 156), "fur"),
    "B": M((24, 24, 36), "fur"), "D": M((36, 36, 52), "fur"), "E": M((72, 80, 120), "fur"),
    "y": M((120, 116, 124), "stone"), "Y": M((200, 198, 206), "stone", over="y"),
    "n": M((240, 240, 246), "cloth"),
    "q": M((20, 18, 22), "gem", flat=True),
    "k": M((14, 12, 18), "gem", flat=True), "r": M((226, 228, 236), "cloth"),
    "R": M((206, 210, 222), "cloth"),
    "T": M((30, 30, 40), "cloth"), "t": M((90, 90, 110), "cloth", over="T"),
    "c": M((240, 220, 150), "cloth", outline=False),
    "o": M((240, 150, 50), "cloth"), "O": M((255, 200, 110), "fur"),
    "h": M((44, 52, 96), "cloth"), "a": M((230, 222, 210), "cloth"),
    "g": M((130, 96, 64), "matte"),
    "x": M((200, 210, 226), "metal"), "X": M((70, 50, 60), "matte"),
    "z": M((250, 252, 255), "metal"), "w": M((230, 190, 90), "metal"),
    "s": M((220, 236, 255), "gem", flat=True, outline=False),
}
TENGU_MAT["v"] = M((230, 40, 50), "gem", flat=True)
TENGU_MAT["f"] = M((70, 60, 70), "plant")
TENGU_MAT["F"] = M((150, 130, 140), "plant")

# --------------------------------------------------------------------------
# NAGA (80) - serpent priestess of the cold springs: a cobra's hood spread
# behind a calm, unkind face, gold at the brow and wrists, and a staff that
# keeps the spring's frost in a bead of ice. Below the waist she is all coil.
# --------------------------------------------------------------------------
_NAGA_HEAD = rows_of(19,
    "........gGg........",
    "......ggjJjgg......",
    ".....hhggggghh.....",
    "...hhhhhhhhhhhhh...",
    "..hhhhHHHHhhhhhhh..",
    ".hhhhHHHhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhhhhh",
    "hhjhhhhjhhhhjhhhhhh",
    "hjbbhhjbbhhbjhhhhhh",
    "hhbaajaaaabbhhhhhhh",
    "hhakkkaakkkkkhhhhhh",
    "hha+ikaai+iiekhhhhh",
    "hhaiIkaaiIIieahhhhh",
    "hhaakaaaakkkaahhhhh",
    "hhaaanaaaaaaaabhhhh",
    "hh.aaaaaaaaaabbhhhh",
    "hh.aammaaaaaabhhhhh",
    "hh..aaaaaaaabbhhhhh",
    "hh...aaaaaabbhhhhhh",
    "hhh...aaaabbhhhhhhh",
    "hhh....abb..hhhhhh.",
    "hhh.....bb..hhhhh..",
    ".hh.....bb...hhhh..",
)


def _hood():
    out = []
    for y, sp in enumerate(ellipse(40, 34)):
        if sp and y > 12:
            t = (y - 12) / 21.0
            a, b = sp
            pull = int(round((b - a - 12) * 0.5 * t * t))
            sp = (a + pull, b - pull)
        out.append(sp)
    rows = inset(spans(40, out, "o"), "o", "O", 2)
    mark = [hh + "." * 28 + hh[::-1] for hh in ("...qq.", "..qQQq", "..qQQq", "...qq.")]
    for i, m in enumerate(mark):
        rows[12 + i] = "".join(c if m[x] == "." or c == "." else m[x]
                               for x, c in enumerate(rows[12 + i]))
    return rows


_NAGA_HOOD = _hood()
_NAGA_TORSO = spans(None, [(5, 8), (5, 8), (2, 11), (1, 12), (1, 12), (1, 12),
                           (2, 11), (2, 11), (3, 10), (3, 10), (3, 10), (3, 10),
                           (2, 11)], "a")
_NAGA_WRAP = spans(14, [None, None, None, (1, 12), (1, 12), (2, 11), None, None,
                        None, None, (3, 10), (3, 10), (2, 11)], "w")
_NAGA_WRAP[3] = "." + "g" * 12 + "."
_NAGA_WRAP[10] = "..." + "g" * 7 + "...."
_NAGA_STAFF = rows_of(9,
    "..ccccc..",
    ".cCCcccc.",
    "cCCcccccc",
    "cCccccccc",
    "ccccccccc",
    ".ccccccc.",
    "..ggggg..",
    "...gGg...",
    "....g....",
) + ["....x...."] * 50
_NAGA_SPARK = rows_of(5, "..z..", ".zZz.", "zZZZz", ".zZz.", "..z..")


def _naga(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    flare = pose == "cast"
    hood = _NAGA_HOOD if not flare else [r for r in _NAGA_HOOD]
    stamp(cv, 20 + ox, -2 if flare else 0, hood)
    # the coil: down from the waist, round the front, tip curling back
    tube(cv, [(37 + ox, 44, 6.0), (40, 52, 7.0), (50, 58, 6.8), (54, 66, 6.2),
              (44, 72, 5.8), (30, 72, 5.2), (18, 68, 4.4), (12, 60, 3.4),
              (14, 52, 2.4), (19, 48, 1.4)], "s", belly="v")
    scales(cv, "s", "S", 5)
    # far arm, then torso, then near arm and staff
    staff_at = {"idle": (48, 10), "attack": (4, 20), "cast": (46, -6)}[pose]
    if pose == "attack":
        st, _ = rotate(_NAGA_STAFF, -76)
        stamp(cv, 2, 12, st)
        near = [(44, 30, 2.3), (34, 32, 2.0), (22, 30, 1.8)]
        far = [(33, 30, 2.1), (26, 34, 1.8), (20, 32, 1.6)]
    else:
        stamp(cv, staff_at[0], staff_at[1], _NAGA_STAFF)
        near = [(44, 30, 2.3), (50, 36, 2.0), (52, 28 if flare else 34, 1.8)]
        far = [(33, 30, 2.1), (28, 38, 1.8), (26, 44, 1.6)]
    tube(cv, [(x + ox, y, r) for x, y, r in far], "b")
    stamp(cv, 32 + ox, 25, _NAGA_TORSO)
    stamp(cv, 32 + ox, 25, _NAGA_WRAP, onto=True)
    stamp(cv, 29 + ox, 3, _NAGA_HEAD)
    tube(cv, [(x + ox, y, r) for x, y, r in near], "a")
    for arm in (near, far):                       # gold at the wrists
        x, y, r = arm[1]
        tube(cv, [(x + ox, y, r)], "g")
    if flare:
        for x, y in ((50, 0), (70, 12), (40, 4)):
            stamp(cv, x, y, _NAGA_SPARK)
    return finish(cv)


NAGA_MAT = {
    "a": M((236, 218, 226), "cel"), "b": M((206, 186, 204), "cel"),
    "h": M((52, 60, 130), "fur"), "H": M((110, 130, 210), "fur", over="h"),
    "j": M((30, 34, 80), "fur"),
    "k": M((20, 16, 36), "gem", flat=True), "e": M((250, 250, 255), "gem", flat=True),
    "i": M((70, 180, 220), "gem", flat=True), "I": M((170, 236, 250), "gem", flat=True),
    "+": GLINT, "n": M((200, 170, 186), "cel", flat=True), "m": M((170, 90, 120), "cel", flat=True),
    "g": M((232, 190, 80), "metal", outline=(80, 54, 26)),
    "G": M((255, 240, 170), "metal", outline=(80, 54, 26)),
    "J": M((90, 210, 250), "gem"),
    "o": M((36, 96, 104), "scale"), "O": M((66, 140, 140), "scale"),
    "q": M((20, 40, 50), "scale", over="O"), "Q": M((200, 236, 226), "scale", over="O"),
    "s": M((56, 134, 144), "scale"), "S": M((40, 100, 120), "scale", over="s"),
    "v": M((220, 232, 204), "scale", over="s"),
    "w": M((60, 90, 170), "cloth"),
    "c": M((170, 230, 250), "gem", emissive=0.5), "C": M((250, 255, 255), "gem", emissive=0.8),
    "x": M((110, 84, 60), "matte"),
    "s2": None,
}
del NAGA_MAT["s2"]
NAGA_MAT["z"] = M((200, 240, 255), "gem", flat=True, outline=False)
NAGA_MAT["Z"] = M((255, 255, 255), "gem", flat=True, outline=False)

# --------------------------------------------------------------------------
# GOLEM (80) - a temple guardian cut from riverstone and fitted like armour:
# a helm with one burning slit for a face, fists the size of shrine bells,
# and old runes in the seams that still remember what it was told to guard.
# --------------------------------------------------------------------------
_GOLEM_TORSO = spans(None, [(4, 30), (1, 33), (0, 34), (0, 34), (1, 33), (2, 32),
                            (3, 31), (4, 30), (5, 29), (6, 28), (7, 27), (7, 27),
                            (8, 26), (8, 26), (8, 26), (8, 26), (9, 25), (9, 25),
                            (10, 24), (10, 24)], "a")
_GOLEM_PLATES = rows_of(35,
    "...................................",
    "...................................",
    "......ccccccccc.....ccccccccc......",
    ".......c.................c.........",
    "........c...rrrrrrrrr...c..........",
    ".........c..r.......r..c...........",
    "............r..rRr..r..............",
    "............r.......r..............",
    "............rrrrrrrrr..............",
    "...................................",
    "...........ccccccccccccc...........",
    "...................................",
    "............c.....c.....c..........",
    "............c.....c.....c..........",
    "...................................",
    "..........ccccccccccccccc..........",
)
_GOLEM_HELM = rows_of(16,
    "....hhhhhhhh....",
    "..hhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhh.",
    "hhhhhhhhhhhhhhhh",
    "hhhhhhhhhhhhhhhh",
    "hkkkkkkkkkkkkhhh",
    "keeEEEEEEeeekhhh",
    "hkkkkkkkkkkkkhhh",
    "hhhhhhhhhhhhhhhh",
    ".hhhhhhhhhhhhhh.",
    "..hhhchhhchhhh..",
    "...hhhhhhhhhh...",
)
_GOLEM_MOSS = rows_of(16,
    "....mmmmmmm.....",
    "..mmMmmmmMmmm...",
    ".mmmmmMmmmmmmm..",
    "mm.mm..mmm.mmm..",
    "m...m...m...m...",
)
_GOLEM_PAULDRON = inset(spans(None, ellipse(16, 13), "b"), "b", "B", 3)
_GOLEM_FIST = spans(None, ellipse(18, 15), "a")
_GOLEM_KNUCKLE = rows_of(18, "..................", "...c...c...c...c..", "...c...c...c...c..",
                         "..................", "..cccccccccccccc..")
_GOLEM_RUNE = rows_of(5, "..R..", ".RrR.", "RrrrR", ".RrR.", "..R..")


def _golem(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    # legs: pillars with knee plates
    for x, mat in ((46, "d"), (30, "a")):
        tube(cv, [(x + ox, 54, 7.5), (x + ox - 1, 65, 6.8), (x + ox - 2, 74, 7.4)], mat)
        stamp(cv, x + ox - 6, 61, spans(None, ellipse(12, 8), "b"))
    # arms per pose: (shoulder, elbow, fist centre)
    arms = {"idle": (((24, 30), (18, 42), (16, 54)), ((58, 30), (62, 42), (62, 54))),
            "attack": (((24, 30), (14, 34), (4, 34)), ((58, 30), (60, 42), (56, 52))),
            "cast": (((24, 30), (12, 24), (6, 14)), ((58, 30), (70, 24), (74, 14)))}[pose]
    far, near = arms
    for (sx, sy), (ex, ey), (fx, fy) in (far,):
        tube(cv, [(sx + ox, sy, 6.0), (ex + ox, ey, 6.2), (fx + ox, fy, 6.6)], "d")
        stamp(cv, fx + ox - 9, fy - 7, [r.replace("a", "d") for r in _GOLEM_FIST])
    stamp(cv, 23 + ox, 24, _GOLEM_TORSO)
    stamp(cv, 23 + ox, 24, _GOLEM_PLATES, onto=True)
    stamp(cv, 32 + ox, 10, _GOLEM_HELM)
    stamp(cv, 32 + ox, 8, _GOLEM_MOSS)
    stamp(cv, 14 + ox, 20, _GOLEM_PAULDRON)
    for (sx, sy), (ex, ey), (fx, fy) in (near,):
        tube(cv, [(sx + ox, sy, 6.4), (ex + ox, ey, 6.6), (fx + ox, fy, 7.0)], "a")
        stamp(cv, fx + ox - 9, fy - 7, _GOLEM_FIST)
        stamp(cv, fx + ox - 9, fy - 7, _GOLEM_KNUCKLE, onto=True)
    stamp(cv, 50 + ox, 20, _GOLEM_PAULDRON)
    stamp(cv, 50 + ox, 18, mirror(_GOLEM_MOSS))
    if pose == "cast":
        for x, y in ((2, 40), (70, 42), (36, 0), (10, 64), (66, 66)):
            stamp(cv, x, y, _GOLEM_RUNE)
    return finish(cv)


GOLEM_MAT = {
    "a": M((128, 136, 148), "stone"), "d": M((104, 110, 124), "stone"),
    "b": M((150, 146, 136), "stone"), "B": M((176, 170, 158), "stone"),
    "h": M((140, 146, 150), "stone"),
    "c": M((78, 84, 98), "stone", over="a"),
    "r": M((90, 230, 220), "gem", emissive=0.7, over="a"),
    "R": M((220, 255, 250), "gem", emissive=0.95),
    "k": M((30, 30, 40), "gem", flat=True),
    "e": M((100, 240, 230), "gem", flat=True), "E": M((230, 255, 255), "gem", flat=True),
    "m": M((84, 140, 66), "plant"), "M": M((140, 190, 90), "plant"),
}

# --------------------------------------------------------------------------
# CERBERUS (80) - the hound of the underworld gate: lean, black, split by
# cracks of banked fire, three heads on three necks and every one of them
# snarling. The collars are iron. The chains were cut a long time ago.
# --------------------------------------------------------------------------
_CERB_HEAD = rows_of(20,
    ".........kk....kk...",
    "........kaak..kaak..",
    ".......kaaak.kaaak..",
    "......aaaaaaaaaaaa..",
    "....aaaaaaaaaaaaaaa.",
    "..aaaaarreeaaaaaaaa.",
    ".aaaaaaaarraaaaaaaa.",
    "naaaaaaaaaaaaaaaaa..",
    "nnaaaaaaaaaaaaaaa...",
    ".TqTqTqqqqaaaaaaa...",
    "..qqqqqqqqqaaaaa....",
    "..TqTqTaaaaaaaa.....",
    "....aaaaaaaa........",
)
_CERB_HEAD_OPEN = rows_of(20,
    ".........kk....kk...",
    "........kaak..kaak..",
    ".......kaaak.kaaak..",
    "......aaaaaaaaaaaa..",
    "....aaaaaaaaaaaaaaa.",
    "..aaaaarreeaaaaaaaa.",
    ".aaaaaaaarraaaaaaaa.",
    "naaaaaaaaaaaaaaaaa..",
    "nnaaaaaaaaaaaaaaa...",
    ".TqTqTqqqqqaaaaaa...",
    "..qqqqqqqqqqqaaaa...",
    "...qqqQQQqqqqaaa....",
    "....qqqqqqqqaaaa....",
    "...TqTqTqaaaaaa.....",
    ".....aaaaaaa........",
)
_CERB_COLLAR = rows_of(10, "..X..X..X.", ".xxxxxxxxx", "xxxxxxxxxx", ".xxxxxxxx.")
_CERB_FLAME = rows_of(8, "...f....", "..fF..f.", ".fFWf.F.", "fFWWFfF.", ".fFFFff.", "..fff...")


def _cerb_mane(cv, pts):
    """Flame spikes along the neck and spine."""
    for (x, y), h in pts:
        sp = plume(h, 2, 3, 1, 4, w_base=3, peak=0.3)
        f = spans(None, sp, "f")
        f = recolour(f, (0, h // 2), "f", "F")
        pin(cv, f, base_of(f), (x, y))


def _cerberus(pose):
    cv = canvas(80, 80)
    low = 4 if pose == "attack" else 0
    # the tail: a whip, lit at the end
    tube(cv, [(60, 40 + low, 3.0), (68, 34, 2.4), (74, 24, 1.8), (72, 16, 1.2)], "b")
    stamp(cv, 68, 8, _CERB_FLAME)
    # far legs, body, near legs
    for (x0, x1, x2) in ((34, 32, 30), (56, 60, 57)):
        tube(cv, [(x0, 46 + low, 4.2), (x1, 62, 2.6), (x2, 76, 2.4)], "b")
    tube(cv, [(28, 40 + low, 9.0), (40, 43 + low, 7.2), (52, 42 + low, 6.4),
              (60, 40 + low, 6.4)], "a")
    for (x0, x1, x2) in ((26, 24, 21), (54, 60, 55)):
        tube(cv, [(x0, 46 + low, 4.8), (x1, 62, 3.0), (x2, 76, 2.8)], "a")
        stamp(cv, x2 - 3, 75, rows_of(7, "k.k.k..", "kkkkkk."))
    # ember cracks through the hide
    for a, b in (((30, 36), (36, 44)), ((36, 44), (34, 50)), ((46, 38), (50, 46)),
                 ((56, 38), (58, 44)), ((22, 54), (24, 62))):
        for y, row in enumerate(vein(finish(cv), a, b, "r")):
            cv[y][:] = row
    _cerb_mane(cv, [((40, 38 + low), 7), ((46, 37 + low), 8), ((52, 37 + low), 7),
                    ((58, 36 + low), 6)])
    # three necks, three heads: far-low, high-middle, near-forward
    # stacked far apart enough that each reads as its own head
    heads = {"idle": ((0, 40), (3, 24), (11, 8)),
             "attack": ((-6, 44), (-5, 28), (1, 12)),
             "cast": ((0, 32), (5, 16), (13, 0))}[pose]
    art = _CERB_HEAD_OPEN if pose != "idle" else _CERB_HEAD
    for i, (hx, hy) in enumerate(heads):
        mat = "b" if i == 0 else "a"
        tube(cv, [(28, 36 + low, 6.2), (hx + 14, hy + 7, 5.0)], mat)
        head = art if i != 0 else [r.replace("a", "b") for r in art]
        if pose == "cast":
            head, _ = rotate(head, 20)
        stamp(cv, hx, hy, head)
        stamp(cv, hx + 11, hy + 10, _CERB_COLLAR)
        _cerb_mane(cv, [((hx + 17, hy + 4), 5), ((hx + 20, hy + 6), 6)])
    if pose == "cast":
        for hx, hy in heads:
            stamp(cv, hx - 4, hy - 8, _CERB_FLAME)
    return finish(cv)


CERBERUS_MAT = {
    "a": M((46, 40, 46), "fur"), "b": M((32, 28, 34), "fur"),
    "k": M((20, 16, 20), "fur"),
    "r": M((255, 110, 40), "gem", emissive=0.8, over="a"),
    "e": M((255, 210, 80), "gem", flat=True),
    "n": M((14, 10, 14), "gem", flat=True),
    "q": M((90, 20, 20), "gem", flat=True), "Q": M((255, 120, 40), "gem", emissive=0.9),
    "T": M((250, 244, 230), "gem", flat=True),
    "x": M((110, 106, 116), "metal"), "X": M((190, 190, 200), "metal"),
    "f": M((255, 140, 50), "gem", emissive=0.85), "F": M((255, 80, 40), "gem", emissive=0.7),
    "W": M((255, 244, 200), "gem", emissive=1.0),
}

# --------------------------------------------------------------------------
# BAKU (80) - the dream-eater of the old scrolls: tapir's trunk, elephant's
# tusks, a tiger's striped legs, a mane of violet smoke and a body like a
# strip of night sky. It wears the moon on its brow and takes what it likes.
# --------------------------------------------------------------------------
_BAKU_HEAD = rows_of(24,
    "........g.....g.........",
    ".........gGGGg..........",
    ".......hhhhhhhhhh.......",
    ".....hhhhhhhhhhhhhh.....",
    "....hhhhhhhhhhhhhhhh....",
    "...hhhkkkhhhhhhhhhhhh...",
    "...hhkeekhhhhhhhhhhhh...",
    "..hhhhkkhhhhhhhhhhhhh...",
    "..hhhhhhhhhhhhhhhhhhh...",
    ".hhhhhhhhhhhhhhhhhhh....",
    ".hhhhhhhhhhhhhhhhhh.....",
    "..hhhhhhhhhhhhhhhh......",
    "...wwhhhhhhhhhhh........",
    "..ww..hhhhhhhh..........",
)
_BAKU_MIST = rows_of(10, "..mmm.....", ".mMMmm.mm.", "mMMMmmmMm.", ".mmMMmmm..", "..mmm.....")
_BAKU_STAR = rows_of(3, ".s.", "sSs", ".s.")
_BAKU_ORB = rows_of(9, "..ddddd..", ".dDDddd..", "dDDdddddd", "ddddddDdd", ".ddddddd.", "..ddddd..")


def _baku(pose):
    cv = canvas(80, 80)
    low = 4 if pose == "attack" else 0
    # a mane of dream-smoke behind the head, blown back
    hx0, hy0 = {"idle": (6, 14), "attack": (0, 26), "cast": (8, 8)}[pose]
    # the mane rides the neck and spine, streaming back
    for x, y in ((hx0 + 16, hy0 - 2), (hx0 + 22, hy0 + 2), (hx0 + 26, hy0 + 8),
                 (34, 26 + low), (42, 28 + low), (50, 28 + low), (58, 30 + low),
                 (hx0 + 18, hy0 + 8), (38, 22 + low)):
        stamp(cv, x, y, _BAKU_MIST)
    # legs: a tiger's, striped
    legs = ((30, 30, 28), (56, 60, 58))
    for (x0, x1, x2), mat in zip(legs, ("L", "L")):
        tube(cv, [(x0 + 4, 48 + low, 4.6), (x1 + 3, 62, 3.6), (x2 + 3, 76, 3.4)], "L")
    tube(cv, [(30, 42 + low, 10.0), (42, 44 + low, 9.4), (54, 42 + low, 8.6),
              (60, 40 + low, 7.0)], "a")
    # the night-sky saddle
    for y in range(34, 54):
        for x in range(36, 56):
            if cv[y][x] == "a" and (x - 46) ** 2 / 90.0 + (y - 43 - low) ** 2 / 60.0 < 1.0:
                cv[y][x] = "n"
    for x, y in ((40, 40 + low), (47, 38 + low), (51, 44 + low), (43, 46 + low)):
        cv[y][x] = "S"
    for (x0, x1, x2) in legs:
        tube(cv, [(x0, 48 + low, 5.0), (x1, 62, 4.0), (x2, 76, 3.8)], "l")
        for yy in (56, 62, 68):                      # tiger stripes
            for xx in range(x1 - 4, x1 + 5):
                if cv[yy][xx] == "l":
                    cv[yy][xx] = "t"
        stamp(cv, x2 - 4, 75, rows_of(8, "oooooooo", "o.oo.oo."))
    # the head, lowered to charge or raised to drink a dream
    hx, hy = {"idle": (6, 14), "attack": (0, 26), "cast": (8, 8)}[pose]
    tube(cv, [(28, 38 + low, 8.0), (hx + 14, hy + 10, 7.0)], "h")
    stamp(cv, hx + 12, hy + 4, spans(None, ellipse(9, 12), "E"))   # the ear
    stamp(cv, hx, hy, _BAKU_HEAD)
    # the trunk: curled in rest, thrust down to charge, raised to the orb
    trunk = {"idle": [(hx + 4, hy + 12, 3.4), (hx + 1, hy + 20, 2.8), (hx + 4, hy + 25, 2.2), (hx + 8, hy + 23, 1.6)],
             "attack": [(hx + 4, hy + 12, 3.4), (hx + 1, hy + 20, 2.6), (hx + 2, hy + 27, 2.0)],
             "cast": [(hx + 4, hy + 12, 3.4), (hx - 1, hy + 6, 2.8), (hx - 1, hy - 1, 2.2), (hx + 2, hy - 5, 1.6)]}[pose]
    tube(cv, trunk, "h")
    # tusks
    tube(cv, [(hx + 7, hy + 14, 1.6), (hx + 4, hy + 20, 1.3), (hx + 1, hy + 22, 0.9)], "w")
    if pose == "cast":
        stamp(cv, hx - 4, hy - 16, _BAKU_ORB)
    for x, y in ((66, 6), (72, 30), (2, 6)):
        stamp(cv, x, y, _BAKU_STAR)
    return finish(cv)


BAKU_MAT = {
    "a": M((70, 58, 104), "fur"), "h": M((84, 70, 124), "fur"),
    "n": M((26, 28, 70), "fur", over="a"),
    "l": M((186, 136, 80), "fur"), "L": M((150, 108, 64), "fur"),
    "E": M((100, 84, 140), "fur"),
    "t": M((50, 30, 30), "fur", over="l"),
    "o": M((220, 210, 190), "stone"),
    "w": M((244, 238, 222), "stone"),
    "k": M((20, 16, 34), "gem", flat=True), "e": M((255, 214, 120), "gem", flat=True),
    "g": M((236, 196, 90), "metal", outline=(80, 56, 26)),
    "G": M((255, 244, 190), "metal", outline=(80, 56, 26)),
    "m": M((150, 110, 200), "cloth", emissive=0.35), "M": M((210, 180, 250), "cloth", emissive=0.5),
    "d": M((250, 190, 230), "cloth", emissive=0.5), "D": M((255, 240, 250), "cloth", emissive=0.7),
    "s": M((230, 230, 255), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# MINOTAUR (80) - the labyrinth's keeper, cornered and furious and not sure
# why: a bull's head on a champion's body, a black mane over the shoulders,
# one bronze pauldron and a labrys it swings as if it weighed nothing.
# --------------------------------------------------------------------------
_MINO_HEAD = rows_of(22,
    "......................",
    ".....mmmmmmmmmm.......",
    "...mmmmmmmmmmmmmm.....",
    "..aaaaaaaaaaaaaaaa....",
    ".aaaaaaaaaaaaaaaaaa...",
    ".aakkkaaaaakkkaaaaa...",
    "aaaeEkaaaaakEeaaaaa...",
    "aaaakkaaaaaakkaaaaa...",
    "aaaaaaaaaaaaaaaaaa....",
    "AAAAAAAAAAAaaaaaaa....",
    "AnnAAAAnnAAAaaaaa.....",
    "AAAAAAAAAAAAaaaa......",
    ".AAoooooAAAAaaa.......",
    "..AoAAAoAAAaa.........",
    "...AoooAAAa...........",
    ".....AAAA.............",
)
_MINO_HORN = spans(None, plume(18, 12, 2, 4, 5, w_base=5, w_tip=1, peak=0.2), "h")
_MINO_HORN = recolour(_MINO_HORN, (0, 5), "h", "H")
_MINO_TORSO = spans(None, [(5, 27), (2, 30), (1, 31), (0, 32), (0, 32), (1, 31),
                           (2, 30), (3, 29), (4, 28), (5, 27), (6, 26), (7, 25),
                           (7, 25), (8, 24), (8, 24), (8, 24)], "a")
_MINO_MUSCLE = rows_of(33,
    ".................................",
    ".................................",
    ".................................",
    ".......bbbbbbb.....bbbbbbb.......",
    "......b.......bbbbb.......b......",
    ".................................",
    "...............b.b...............",
    "............bb.b.b.bb............",
    "...............b.b...............",
    "............bb.b.b.bb............",
    "...............b.b...............",
)
_MINO_PAULDRON = inset(spans(None, ellipse(16, 12), "g"), "g", "G", 2)
_MINO_SPIKES = rows_of(16, "..X...X...X.....", ".XX..XX..XX.....")
_MINO_LOIN = spans(24, [(0, 23), (0, 23), (1, 22), (2, 21), (3, 20), (4, 19),
                        (6, 17), (8, 15)], "c")
_MINO_LOIN[0] = _MINO_LOIN[1] = "g" * 24
_MINO_AXE = rows_of(22,
    ".....x..........x.....",
    "...xxxx........xxxx...",
    "..xXXxx........xxXXx..",
    ".xXXxxxxx....xxxxxXXx.",
    "xXXxxxxxxwwwwxxxxxxXXx",
    "xXxxxxxxxwwwwxxxxxxxXx",
    "xXxxxxxxxwwwwxxxxxxxXx",
    "xXXxxxxxxwwwwxxxxxxXXx",
    ".xXXxxxxx.ww.xxxxxXXx.",
    "..xXXxx...ww...xxXXx..",
    "...xxxx...ww...xxxx...",
    ".....x....ww....x.....",
) + ["..........ww.........."] * 22
_MINO_STEAM = rows_of(7, "..vv...", ".vVVv..", "vVVVvv.", ".vvvVv.", "...vv..")


def _wrap(cv, arm, ox):
    """Bandages at the wrist only: a band, not a sleeve."""
    (x1, y1, r1), (x2, y2, r2) = arm[-2], arm[-1]
    tube(cv, [(x1 + (x2 - x1) * 0.55 + ox, y1 + (y2 - y1) * 0.55, r2 * 0.95),
              (x2 + ox, y2, r2)], "r")


def _minotaur(pose):
    cv = canvas(80, 80)
    ox = -3 if pose == "attack" else 0
    # the axe: on the shoulder, brought down, or held low while it roars
    if pose == "attack":
        axe, _ = rotate(_MINO_AXE, -64)
        stamp(cv, -2, 8, axe)
    elif pose == "cast":
        axe, _ = rotate(_MINO_AXE, 170)
        stamp(cv, 48, 30, axe)
    else:
        axe, _ = rotate(_MINO_AXE, 28)
        stamp(cv, 42, -2, axe)
    # legs: thick, braced, ending in hooves
    for x, mat in ((48, "d"), (34, "a")):
        tube(cv, [(x + ox, 56, 6.2), (x + ox + 2, 66, 5.0), (x + ox, 75, 4.2)], mat)
        stamp(cv, x + ox - 4, 74, rows_of(9, "kkkk.kkkk", "kkkk.kkkk"))
    stamp(cv, 24 + ox, 26, _MINO_TORSO)
    stamp(cv, 24 + ox, 26, _MINO_MUSCLE, onto=True)
    stamp(cv, 28 + ox, 48, _MINO_LOIN)
    arms = {"idle": ([(28, 30, 5.2), (22, 42, 4.4), (22, 52, 4.0)],
                     [(54, 30, 5.6), (60, 22, 4.6), (58, 14, 4.2)]),
            "attack": ([(28, 30, 5.2), (18, 30, 4.4), (10, 30, 4.0)],
                       [(54, 30, 5.6), (44, 30, 4.6), (22, 28, 4.2)]),
            "cast": ([(28, 30, 5.2), (20, 40, 4.4), (16, 48, 4.4)],
                     [(54, 30, 5.6), (60, 42, 4.6), (58, 50, 4.4)])}[pose]
    far, near = arms
    tube(cv, [(x + ox, y, r) for x, y, r in far], "d")
    _wrap(cv, far, ox)
    # head: lowered on the swing, thrown back to roar
    hx, hy = {"idle": (22, 10), "attack": (14, 14), "cast": (24, 6)}[pose]
    tube(cv, [(40 + ox, 30, 8.0), (hx + 10, hy + 12, 7.0)], "a")     # a bull's neck
    stamp(cv, hx + 14, hy - 8, _MINO_HORN)
    stamp(cv, hx + 2 - len(_MINO_HORN[0]) + 10, hy - 8, mirror(_MINO_HORN))
    stamp(cv, hx, hy, _MINO_HEAD)
    stamp(cv, 50 + ox, 22, _MINO_PAULDRON)
    stamp(cv, 50 + ox, 19, _MINO_SPIKES)
    tube(cv, [(x + ox, y, r) for x, y, r in near], "a")
    _wrap(cv, near, ox)
    if pose == "cast":
        stamp(cv, hx - 6, hy + 10, mirror(_MINO_STEAM))
        stamp(cv, hx - 8, hy + 16, mirror(_MINO_STEAM))
    return finish(cv)


MINOTAUR_MAT = {
    "a": M((122, 70, 46), "fur"), "d": M((96, 54, 38), "fur"),
    "b": M((80, 44, 32), "fur", over="a"),
    "A": M((170, 120, 90), "fur"), "n": M((40, 20, 20), "gem", flat=True),
    "m": M((30, 24, 28), "fur"),
    "k": M((28, 20, 20), "stone"),
    "e": M((255, 90, 60), "gem", flat=True), "E": M((255, 220, 180), "gem", flat=True),
    "o": M((230, 186, 80), "metal", outline=(80, 50, 24)),
    "h": M((230, 220, 190), "stone"), "H": M((120, 100, 80), "stone"),
    "g": M((200, 140, 70), "metal", outline=(70, 40, 20)),
    "G": M((240, 190, 110), "metal", outline=(70, 40, 20)),
    "X": M((210, 210, 220), "metal"),
    "c": M((140, 36, 40), "cloth"),
    "r": M((170, 150, 120), "cloth"),
    "x": M((160, 166, 180), "metal"), "w": M((100, 70, 50), "matte"),
    "v": M((236, 240, 248), "cloth", outline=False), "V": M((255, 255, 255), "cloth", outline=False),
}

# --------------------------------------------------------------------------
# MEDUSA (80) - the gorgon as she tells it: cold, poised, dressed for a
# funeral that is not hers, with hair that hisses and eyes that settle
# arguments permanently. Her snakes are friendlier than she is. Barely.
# --------------------------------------------------------------------------
_MEDUSA_HEAD = rows_of(16,
    "....hhhhhhhh....",
    "..hhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhh.",
    "hhbbhhhbbhhhbhhh",
    "hbaaaaaaaaabbhhh",
    "hakkkaakkkkbhhhh",
    "hayykaayyykahhhh",
    "haakkaaakkkahhhh",
    "haaanaaaaaaabhhh",
    ".aaaaaaaaaabbhh.",
    ".aammmaaaaabhhh.",
    "..aaaaaaaabbhh..",
    "...aaaaaabbhh...",
    "....aaaabb......",
    ".....abb........",
)
_MEDUSA_HEAD_GAZE = [r.replace("y", "Y") for r in _MEDUSA_HEAD]
_MEDUSA_SNAKE = rows_of(7, "..sss..", ".sssss.", "sWkssss", "ssssss.", "uuuus..", ".uu....")
_MEDUSA_TORSO = spans(None, [(5, 8), (5, 8), (2, 11), (1, 12), (1, 12), (1, 12),
                             (2, 11), (2, 11), (3, 10), (3, 10), (3, 10), (3, 10)], "a")
_MEDUSA_GOWN = spans(None, [(3, 10), (2, 11), (1, 12), (2, 11), (3, 10), (3, 10),
                            (2, 11), (2, 12), (1, 12), (1, 13), (0, 13), (0, 14),
                            (0, 14), (0, 15), (0, 15), (0, 16), (0, 16), (0, 17),
                            (0, 17), (0, 18), (0, 18), (0, 19), (0, 19), (0, 20),
                            (0, 20), (0, 21), (0, 21), (0, 22), (0, 22), (0, 22),
                            (0, 22), (0, 22), (1, 21), (2, 20)], "d")
_MEDUSA_GOWN[0] = _MEDUSA_GOWN[0].replace("d", "g")
_MEDUSA_GOWN[5] = _MEDUSA_GOWN[5].replace("d", "g")
_MEDUSA_BEAM = rows_of(24, "YY..YYY...YYYY....YYYYYY", ".YYYYYYYYYYYYYYYYYYYYYYY", "YY..YYY...YYYY....YYYYYY")


def _snakes(cv, hx, hy, strike):
    """Snake locks rooted round the crown, coiling out; they lunge to strike."""
    reach = 6 if strike else 0
    roots = ((hx + 3, hy + 3), (hx + 6, hy + 1), (hx + 10, hy), (hx + 13, hy + 1),
             (hx + 15, hy + 4), (hx + 15, hy + 8))
    ends = ((hx - 6 - reach, hy + 2), (hx - 2 - reach, hy - 8), (hx + 8, hy - 12),
            (hx + 18, hy - 10), (hx + 24, hy - 2), (hx + 24, hy + 10))
    for i, ((rx, ry), (ex, ey)) in enumerate(zip(roots, ends)):
        mid = ((rx + ex) // 2 + (3 if i % 2 else -3), (ry + ey) // 2 - 3)
        body = "s" if i % 2 else "S"
        tube(cv, [(rx, ry, 2.2), (mid[0], mid[1], 2.0), (ex, ey, 1.8)], body, belly="u")
        head = [r.replace("s", body) for r in _MEDUSA_SNAKE]
        stamp(cv, ex - 3, ey - 3, head if ex > hx + 8 else mirror(head))


def _medusa(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    hx, hy = 30 + ox, 12
    _snakes(cv, hx, hy, pose == "attack")
    # the gown, slit to the thigh: one leg shows
    tube(cv, [(40 + ox, 48, 2.8), (43 + ox, 62, 2.4), (44 + ox, 74, 2.0), (42 + ox, 77, 1.4)], "a")
    stamp(cv, 28 + ox, 38, _MEDUSA_GOWN)
    stamp(cv, 32 + ox, 26, _MEDUSA_TORSO)
    stamp(cv, 32 + ox, 26, spans(14, [None, None, None, (1, 12), (1, 12), (2, 11), (2, 11),
                                       (2, 11), (3, 10), (3, 10), (3, 10), (3, 10)], "d"),
          onto=True)
    arms = {"idle": ([(34, 30, 2.1), (30, 38, 1.9), (40, 38, 1.7)],
                     [(44, 30, 2.3), (48, 37, 2.0), (38, 39, 1.8)]),
            "attack": ([(34, 30, 2.1), (24, 30, 1.9), (14, 28, 1.7)],
                       [(44, 30, 2.3), (48, 38, 2.0), (46, 46, 1.8)]),
            "cast": ([(34, 30, 2.1), (28, 24, 1.9), (30, 17, 1.7)],
                     [(44, 30, 2.3), (48, 38, 2.0), (46, 46, 1.8)])}[pose]
    for arm, mat in zip(arms, ("b", "a")):
        tube(cv, [(x + ox, y, r) for x, y, r in arm], mat)
        x, y, r = arm[1]
        tube(cv, [(x + ox, y, r + 0.3)], "g")                 # serpent armlets
    if pose == "attack":
        x, y, _ = arms[0][-1]
        for dy in (-4, 0, 4):                        # the rake of her nails
            tube(cv, [(x + ox - 3, y + dy - 2, 0.6), (x + ox - 10, y + dy + 2, 0.5)], "Y")
    stamp(cv, hx, hy, _MEDUSA_HEAD_GAZE if pose == "cast" else _MEDUSA_HEAD)
    if pose == "cast":
        stamp(cv, hx - 24, hy + 5, _MEDUSA_BEAM)
    return finish(cv)


MEDUSA_MAT = {
    "a": M((210, 216, 200), "cel"), "b": M((180, 188, 176), "cel"),
    "h": M((40, 60, 50), "fur"),
    "k": M((20, 20, 24), "gem", flat=True),
    "y": M((230, 240, 80), "gem", flat=True), "Y": M((255, 255, 190), "gem", flat=True),
    "n": M((170, 176, 160), "cel", flat=True), "m": M((110, 60, 80), "cel", flat=True),
    "s": M((52, 130, 90), "scale"), "S": M((80, 160, 90), "scale"),
    "u": M((220, 214, 150), "scale", over="s"),
    "W": M((255, 255, 255), "gem", flat=True),
    "d": M((70, 40, 100), "cloth"), "g": M((220, 180, 80), "metal", outline=(80, 54, 26)),
}
MEDUSA_MAT["Y"] = M((255, 255, 190), "gem", flat=True, outline=False)

# --------------------------------------------------------------------------
# HARPY (80) - shrieks first, considers later. A storm-crow of a woman:
# wings where her arms should be, war paint across the eyes, a wild crest
# of feathers for hair and talons made for exactly what they do.
# --------------------------------------------------------------------------
_HARPY_WING = wing([26, 29, 27, 23, 18, 13], [("b", "e"), ("d", "e")], gap=2, edge="e")
_HARPY_WING_F = [r.replace("b", "B").replace("d", "D").replace("e", "E")
                 for r in wing([22, 25, 23, 19, 14], [("b", "e"), ("d", "e")], gap=2, edge="e")]
_HARPY_HEAD = rows_of(18,
    "....h..hh.h..h....",
    "...hhhhhhhhhhhh...",
    "..hhHHHhhhhhhhhh..",
    ".hhhHHhhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhhhh",
    "hjhhhjhhhhjhhhhhhh",
    "hjbbhjbbhhbjhhhhhh",
    "hjbaajaaaabbhhhhhh",
    "hjpkkkpakkkkkhhhhh",
    "hja+ikaai+iiekhhhh",
    "hjpppkaappppeahhhh",
    "hjaaaaaaakkaaahhhh",
    "hj.aanaaaaaaaabhhh",
    "hj.aaaaaaaaaabbhhh",
    "hj..aqqqaaaabhhhh.",
    "hj...aaaaaabbhhh..",
    ".j....aaaabbhhh...",
    "......abb..hh.....",
)
_HARPY_SHRIEK = [r.replace("aqqqaaaab", "aQQQQaaab") for r in _HARPY_HEAD]
_HARPY_SHRIEK[13] = _HARPY_SHRIEK[13].replace("aaaaaaaaaabb", "aaQQQQaaaabb", 1)
_HARPY_TORSO = spans(None, [(5, 8), (4, 9), (2, 11), (1, 12), (1, 12), (2, 11),
                            (2, 11), (3, 10), (3, 10), (3, 10), (4, 9), (4, 9)], "a")
_HARPY_BODICE = spans(14, [None, None, (1, 12), (1, 12), (2, 11), (2, 11), (2, 11),
                           (3, 10), None, None, (4, 9), (4, 9)], "c")
_HARPY_TAIL = rows_of(16,
    "......bbbb......",
    "....bbdbdbbb....",
    "..bbdbbdbbdbbb..",
    ".bdbb.bdb.bbdbb.",
    "bdb...bdb...bdbb",
    "bb....bdb....bbb",
    "......bb........",
)
_HARPY_GUST = rows_of(9, "..s....s.", ".s..ss...", "s..s....s", ".ss...ss.")


def _harpy(pose):
    cv = canvas(80, 80)
    dive = pose == "attack"
    ox = -4 if dive else 0
    near_a, far_a = {"idle": (-30, -150), "attack": (10, 170), "cast": (-78, -104)}[pose]
    pin_rotated(cv, _HARPY_WING_F, (0, 7), (35 + ox, 30), far_a)
    stamp(cv, 30 + ox, 50, _HARPY_TAIL)
    # bird legs: scaled, knees back, talons spread
    legs = {"idle": ((36, 50), (34, 62), (36, 72)), "attack": ((36, 50), (28, 58), (20, 62)),
            "cast": ((36, 50), (34, 62), (36, 72))}[pose]
    for dx in (0, 7):
        (x0, y0), (x1, y1), (x2, y2) = legs
        tube(cv, [(x0 + dx + ox, y0, 3.0), (x1 + dx + ox, y1, 1.8), (x2 + dx + ox, y2, 1.6)], "l")
        stamp(cv, x2 + dx + ox - 4, y2, rows_of(8, "t..t..t.", ".t.t.t..", "..ttt..."))
    # feathers from the waist down: a skirt of them over the thighs
    tube(cv, [(38 + ox, 40, 5.0), (39 + ox, 47, 6.0), (40 + ox, 52, 5.5)], "f")
    for y in range(42, 57, 3):
        for x in range(30, 50):
            if cv[y][x] == "f" and (x + y) % 3 == 0:
                cv[y][x] = "F"
    stamp(cv, 32 + ox, 27, _HARPY_TORSO)
    stamp(cv, 32 + ox, 27, _HARPY_BODICE, onto=True)
    stamp(cv, 28 + ox, 10, _HARPY_SHRIEK if pose == "cast" else _HARPY_HEAD)
    pin_rotated(cv, _HARPY_WING, (0, 7), (44 + ox, 30), near_a)
    if pose == "cast":
        for x, y in ((2, 16), (4, 30), (0, 44)):
            stamp(cv, x, y, _HARPY_GUST)
    return finish(cv)


HARPY_MAT = {
    "a": M((238, 206, 180), "cel"), "p": M((170, 40, 50), "cel", flat=True),
    "h": M((150, 90, 50), "fur"), "H": M((210, 150, 90), "fur", over="h"),
    "j": M((100, 56, 34), "fur"), "b2": None,
    "k": M((30, 20, 20), "gem", flat=True),
    "i": M((230, 160, 40), "gem", flat=True), "I": M((255, 220, 120), "gem", flat=True),
    "+": GLINT, "n": M((200, 160, 140), "cel", flat=True),
    "q": M((110, 40, 50), "cel", flat=True), "Q": M((70, 20, 30), "gem", flat=True),
    "b": M((150, 90, 52), "fur"), "d": M((190, 130, 72), "fur"), "e": M((80, 44, 30), "fur"),
    "B": M((120, 70, 42), "fur"), "D": M((160, 104, 60), "fur"), "E": M((64, 36, 26), "fur"),
    "c": M((220, 200, 170), "fur"), "f": M((170, 110, 64), "fur"),
    "F": M((120, 72, 44), "fur", over="f"),
    "l": M((236, 186, 70), "scale"), "t": M((40, 30, 30), "stone"),
    "s": M((255, 250, 230), "gem", flat=True, outline=False),
}
del HARPY_MAT["b2"]
HARPY_MAT["e2"] = None
del HARPY_MAT["e2"]

# --------------------------------------------------------------------------
# CYCLOPS (80) - one of the smiths who forged the thunderbolt, and never
# once thanked for it: a giant under a heavy brow, one great eye, a beard
# singed at the ends, and a forge hammer that has flattened better things
# than you.
# --------------------------------------------------------------------------
_CYC_HEAD = rows_of(22,
    "......hhhhhhhh........",
    "....hhaaaaaaaahh......",
    "...aaaaaaaaaaaaaa.....",
    "..aaaaaaaaaaaaaaaa....",
    ".aabbbbbbbbbbbbbaaa...",
    ".akkkkkkkkkkkkkkaaa...",
    "aakwwwwwiiiwwwwkaaa...",
    "aakwwwwiIIiiwwwkaaa...",
    "aakwwwwiI+iiwwwkaaa...",
    "aaakkwwiiiiiwwkkaaa...",
    "aaaaakkkkkkkkkaaaa....",
    "aaaaaaaanaaaaaaaaa....",
    ".aaaaaannnaaaaaaa.....",
    ".rrrrrraaaarrrrrr.....",
    "rrrrrrqqqqqrrrrrrr....",
    "rrrrrrrrrrrrrrrrrr....",
    ".rrrrrrrrrrrrrrrr.....",
    "..rrrRrrrrRrrrrr......",
    "...rRrrRrrrRrrr.......",
    "....rr..rr..rr........",
)
_CYC_TORSO = spans(None, [(6, 30), (3, 33), (1, 35), (0, 36), (0, 36), (0, 36),
                          (1, 35), (2, 34), (3, 33), (4, 32), (5, 31), (6, 30),
                          (6, 30), (7, 29), (7, 29), (8, 28), (8, 28), (8, 28)], "a")
_CYC_TATTOO = rows_of(37,
    ".....................................",
    ".....................................",
    ".....................................",
    "...t.t.t.........................t.t.",
    "....ttt.........................ttt..",
    ".....t...........................t...",
)
_CYC_APRON = spans(24, [(2, 21), (2, 21), (2, 21), (2, 21), (3, 20), (3, 20),
                        (3, 20), (4, 19), (4, 19), (4, 19), (5, 18), (5, 18),
                        (5, 18), (6, 17), (6, 17), (7, 16)], "l")
_CYC_APRON[0] = _CYC_APRON[1] = "x" * 24
_CYC_HAMMER = rows_of(16,
    "xxxxxxxxxxxxxxxx",
    "xXXXXXXXXXXXXXXx",
    "xXxxxxxxxxxxxxXx",
    "xxxxxxxxxxxxxxxx",
    "xxxxxxxxxxxxxxxx",
    "xXxxxxxxxxxxxxXx",
    "xxxxxxxxxxxxxxxx",
    "......oooo......",
) + ["......oooo......"] * 26 + [".....xxxxxx....."]
_CYC_GLARE = rows_of(24, "YY.YYY..YYYY..YYYYYYYYYY", ".YYYYYYYYYYYYYYYYYYYYYYY", "YY.YYY..YYYY..YYYYYYYYYY")


def _bracer(cv, arm, ox):
    """An iron band round the forearm, short of the wrist: a bracer, not a
    gauntlet swallowing the whole arm."""
    (x1, y1, _), (x2, y2, r2) = arm[-2], arm[-1]
    a, b = 0.45, 0.8
    tube(cv, [(x1 + (x2 - x1) * a + ox, y1 + (y2 - y1) * a, r2 + 0.5),
              (x1 + (x2 - x1) * b + ox, y1 + (y2 - y1) * b, r2 + 0.5)], "x")


def _cyclops(pose):
    cv = canvas(80, 80)
    ox = -3 if pose == "attack" else 0
    # the hammer: grounded, raised, or overhead mid-smash
    if pose == "attack":
        # a flat sidesweep at chest height: the swing reads, and so does he
        ham, _ = rotate(_CYC_HAMMER, 96)
        stamp(cv, -4, 24, ham)
    else:
        ham, _ = rotate(_CYC_HAMMER, 12)
        stamp(cv, 50, 30, ham)
    for x, mat in ((48, "b"), (30, "a")):
        tube(cv, [(x + ox, 56, 6.4), (x + ox - 1, 66, 5.6), (x + ox, 75, 5.2)], mat)
        stamp(cv, x + ox - 6, 73, rows_of(12, "kkkkkkkkkkk.", "kkkkkkkkkkkk"))
    stamp(cv, 21 + ox, 26, _CYC_TORSO)
    stamp(cv, 21 + ox, 26, _CYC_TATTOO, onto=True)
    stamp(cv, 27 + ox, 44, _CYC_APRON)
    arms = {"idle": ([(24, 30, 5.8), (16, 42, 4.8), (14, 52, 4.6)],
                     [(54, 30, 6.2), (58, 42, 5.2), (56, 50, 5.0)]),
            "attack": ([(24, 30, 5.8), (16, 36, 4.8), (12, 38, 4.6)],
                       [(54, 30, 6.2), (38, 38, 5.2), (20, 40, 5.0)]),
            "cast": ([(24, 30, 5.8), (16, 42, 4.8), (14, 52, 4.6)],
                     [(54, 30, 6.2), (58, 42, 5.2), (56, 50, 5.0)])}[pose]
    far, near = arms
    tube(cv, [(x + ox, y, r) for x, y, r in far], "b")
    _bracer(cv, far, ox)
    tube(cv, [(40 + ox, 28, 7.0), (40 + ox, 22, 7.0)], "a")        # a neck like a bole
    hx, hy = {"idle": (28, 4), "attack": (24, 8), "cast": (28, 2)}[pose]
    stamp(cv, hx, hy, _CYC_HEAD)
    tube(cv, [(x + ox, y, r) for x, y, r in near], "a")
    _bracer(cv, near, ox)
    if pose == "cast":
        stamp(cv, hx - 24, hy + 5, _CYC_GLARE)
    return finish(cv)


CYCLOPS_MAT = {
    "a": M((196, 150, 120), "skin"), "b": M((166, 124, 100), "skin"),
    "h": M((60, 40, 30), "fur"),
    "k": M((50, 36, 30), "stone"),
    "w": M((250, 246, 236), "gem", flat=True),
    "i": M((210, 120, 40), "gem", flat=True), "I": M((255, 200, 90), "gem", flat=True),
    "+": GLINT, "n": M((150, 104, 84), "skin", flat=True),
    "r": M((140, 60, 30), "fur"), "R": M((200, 110, 50), "fur", over="r"),
    "q": M((70, 30, 30), "gem", flat=True),
    "t": M((60, 50, 110), "skin", over="a", flat=True),
    "l": M((120, 80, 50), "cloth"), "x": M((96, 96, 110), "metal"),
    "X": M((170, 170, 186), "metal"), "o": M((110, 80, 56), "matte"),
    "Y": M((255, 240, 180), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# PEGASUS (80) - insufferably graceful: a white war-steed of the high air,
# gold at the brow and hoof, mane like struck light, swan's wings held half
# open as if it might leave at any moment, which it would prefer.
# --------------------------------------------------------------------------
_PEG_WING = wing([26, 30, 30, 28, 24, 20, 16], [("w", "e"), ("W", "e")], gap=3, edge="e")
_PEG_WING_F = [r.replace("w", "v").replace("W", "V").replace("e", "E")
               for r in wing([22, 26, 26, 23, 19, 15], [("w", "e"), ("W", "e")], gap=3, edge="e")]
_PEG_HEAD = rows_of(20,
    "..........aa........",
    ".........aaa........",
    "........aaaaa.......",
    "......gggaaaaa......",
    "....aaaaaaaaaaa.....",
    "..aaaakkaaaaaaaa....",
    ".aaaaakaaaaaaaaaa...",
    "aaaaaaaaaaaaaaaaa...",
    "nAAAAAaaaaaaaaaa....",
    "AAAAAAAaaaaaaaa.....",
    ".AAAAAAaaaaaaa......",
    "..AAAAaaaaaa........",
)
_PEG_SPARK = rows_of(3, ".s.", "sSs", ".s.")


def _pegasus(pose):
    cv = canvas(80, 80)
    rear = pose == "attack"
    lift = -8 if rear else 0
    near_a, far_a = {"idle": (-58, -78), "attack": (-36, -56), "cast": (-86, -100)}[pose]
    pin_rotated(cv, _PEG_WING_F, (0, 7), (40, 36 + lift), far_a)
    # the tail streams back
    tube(cv, [(60, 38 + lift // 2, 3.2), (68, 42, 3.6), (72, 52, 3.0), (70, 62, 2.2),
              (74, 68, 1.2)], "m")
    tube(cv, [(62, 40, 1.4), (69, 48, 1.6), (70, 58, 1.2)], "M")
    # far legs, body, near legs; rearing lifts the forehand
    fore = ((28, 48 + lift), (22, 56 + lift), (16, 52 + lift)) if rear else ((28, 48), (27, 62), (26, 76))
    fore_f = ((32, 48 + lift), (26, 58 + lift), (22, 60 + lift)) if rear else ((33, 48), (33, 62), (32, 76))
    for (a, b, c) in (fore_f, ((56, 48), (58, 62), (56, 76))):
        tube(cv, [(a[0], a[1], 3.4), (b[0], b[1], 2.2), (c[0], c[1], 2.0)], "b")
        stamp(cv, c[0] - 2, c[1] - 1, rows_of(5, "ggggg", "ggggg"))
    tube(cv, [(30, 40 + lift, 8.0), (42, 42 + lift // 2, 7.2), (54, 42, 7.0),
              (60, 40, 6.4)], "a")
    for (a, b, c) in (fore, ((52, 48), (54, 62), (50, 76))):
        tube(cv, [(a[0], a[1], 3.8), (b[0], b[1], 2.4), (c[0], c[1], 2.2)], "a")
        stamp(cv, c[0] - 2, c[1] - 1, rows_of(5, "ggggg", "ggggg"))
    # a proud neck, the head held high
    hx, hy = {"idle": (8, 8), "attack": (6, 0), "cast": (10, 4)}[pose]
    tube(cv, [(32, 36 + lift, 6.4), (hx + 14, hy + 10, 5.2)], "a")
    # the mane falls along the crest of the neck
    tube(cv, [(hx + 14, hy + 4, 3.0), (hx + 20, hy + 12, 3.4), (26, 26 + lift, 3.4),
              (32, 32 + lift, 2.6)], "m")
    tube(cv, [(hx + 15, hy + 6, 1.2), (hx + 20, hy + 14, 1.4), (27, 28 + lift, 1.2)], "M")
    stamp(cv, hx, hy, _PEG_HEAD)
    pin_rotated(cv, _PEG_WING, (0, 7), (46, 36 + lift), near_a)
    if pose == "cast":
        for x, y in ((6, 30), (70, 6), (2, 52), (62, 30)):
            stamp(cv, x, y, _PEG_SPARK)
    return finish(cv)


PEGASUS_MAT = {
    "a": M((246, 246, 252), "fur"), "b": M((212, 214, 232), "fur"),
    "A": M((230, 226, 240), "fur"), "n": M((150, 140, 170), "fur", flat=True),
    "k": M((40, 40, 80), "gem", flat=True),
    "g": M((236, 196, 90), "metal", outline=(80, 56, 26)),
    "m": M((250, 226, 150), "fur"), "M": M((255, 248, 210), "fur"),
    "w": M((250, 250, 255), "fur"), "W": M((226, 232, 250), "fur"),
    "e": M((150, 170, 220), "fur"),
    "v": M((214, 218, 240), "fur"), "V": M((196, 202, 230), "fur"), "E": M((130, 146, 196), "fur"),
    "s": M((255, 250, 220), "gem", flat=True, outline=False),
    "S": M((255, 255, 255), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# CHIMERA (80) - three animals, one very bad mood: a lion with a mane like
# a banked fire, a black goat rising out of its back with horns wound tight,
# and a viper for a tail that is always, always looking at you.
# --------------------------------------------------------------------------
_CHIM_LION = rows_of(22,
    ".....aaaaaaaaaa.......",
    "...aaaaaaaaaaaaaa.....",
    "..aaakkkaaaaaaaaaa....",
    ".aaaakeykaaaaaaaaa....",
    "aaaaaakkaaaaaaaaaa....",
    "AAAAAaaaaaaaaaaaa.....",
    "nAAAAAAaaaaaaaaaa.....",
    "nnAAAAAAaaaaaaaa......",
    ".TqTqTAAAaaaaa........",
    "..qqqqqqAAaaa.........",
    "...TqTqAAAa...........",
    ".....AAAA.............",
)
_CHIM_LION_ROAR = rows_of(22,
    ".....aaaaaaaaaa.......",
    "...aaaaaaaaaaaaaa.....",
    "..aaakkkaaaaaaaaaa....",
    ".aaaakeykaaaaaaaaa....",
    "aaaaaakkaaaaaaaaaa....",
    "AAAAAaaaaaaaaaaaa.....",
    "nAAAAAAaaaaaaaaaa.....",
    ".TqTqTqqAaaaaaaa......",
    "..qqqqqqqqAaaaa.......",
    "..qqQQQqqqAaaa........",
    "...qqqqqqAAaa.........",
    "...TqTqTqAAa..........",
    ".....AAAAA............",
)
_CHIM_GOAT = rows_of(12,
    "....gggggg..",
    "..gggggggggg",
    ".ggkkgggggg.",
    "gggkegggggg.",
    "Gggggggggg..",
    "GGGggggggg..",
    ".GGGgggg....",
    "..GGgg......",
    "...GG.......",
)
_CHIM_VIPER = rows_of(9, "..sssss..", ".sssssss.", "sWkssssss", "sssssss..", "uuuuus...", ".uuu.....")
_CHIM_FIRE = rows_of(14,
    "........fF....",
    "....ffFFfWf...",
    "..ffFFWWWFff..",
    "fFFWWWWWWWFf..",
    ".fFFWWWWFFff..",
    "..ffFFWFFf....",
    "....fff.......",
)


def _mane(w, h):
    """A ragged mane: an ellipse cut into tufts at the rim, streaked inward."""
    import math
    rows = [list(r) for r in inset(spans(None, ellipse(w, h), "r"), "r", "R", 4)]
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    for y in range(h):
        for x in range(len(rows[y])):
            if rows[y][x] == ".":
                continue
            ang = math.atan2(y - cy, x - cx)
            rad = math.hypot((x - cx) / (w / 2.0), (y - cy) / (h / 2.0))
            # scallop the rim into tufts
            if rad > 0.82 + 0.14 * math.cos(ang * 9):
                rows[y][x] = "."
            elif rows[y][x] == "R" and int((ang + math.pi) * 9) % 3 == 0:
                rows[y][x] = "r"
    return ["".join(r) for r in rows]


_CHIM_MANE = _mane(34, 32)


def _chimera(pose):
    cv = canvas(80, 80)
    low = 4 if pose == "attack" else 0
    # the viper tail rises behind, head cocked
    tube(cv, [(60, 42 + low, 3.4), (68, 36, 3.0), (72, 26, 2.6), (68, 18, 2.4)], "s", belly="u")
    stamp(cv, 60, 12, mirror(_CHIM_VIPER))
    # legs and body: a lion's, heavy in the shoulder
    for (x0, x1, x2) in ((32, 30, 28), (56, 60, 56)):
        tube(cv, [(x0, 48 + low, 4.8), (x1, 62, 3.4), (x2, 76, 3.2)], "b")
    tube(cv, [(30, 42 + low, 10.0), (42, 44 + low, 8.4), (54, 43 + low, 7.4),
              (60, 42 + low, 6.8)], "c")
    for (x0, x1, x2) in ((26, 24, 21), (54, 58, 53)):
        tube(cv, [(x0, 48 + low, 5.4), (x1, 62, 3.8), (x2, 76, 3.6)], "c")
        stamp(cv, x2 - 4, 74, rows_of(9, "cc.cc.cc.", "ccccccccc"))
    # the goat rises from the back on its own neck, horns wound back
    tube(cv, [(48, 38 + low, 5.0), (52, 24 + low, 4.2), (53, 12 + low, 3.8)], "g")
    for side in (0, 1):
        tube(cv, [(55 + side * 2, 7 + low, 2.4), (61 + side, 5 + low, 2.0),
                  (64, 11 + low, 1.6), (61, 15 + low, 1.2)], "h")
    stamp(cv, 46, 6 + low, _CHIM_GOAT)
    # the lion: mane first, then the face in it
    hx, hy = {"idle": (4, 16), "attack": (-2, 24), "cast": (6, 10)}[pose]
    stamp(cv, hx + 4, hy - 8, _CHIM_MANE)
    stamp(cv, hx, hy + 2, _CHIM_LION_ROAR if pose != "idle" else _CHIM_LION)
    if pose == "cast":
        stamp(cv, hx - 12, hy + 4, mirror(_CHIM_FIRE))
    return finish(cv)


CHIMERA_MAT = {
    "c": M((214, 160, 90), "fur"), "b": M((176, 128, 72), "fur"),
    "a": M((222, 170, 100), "fur"), "A": M((240, 214, 170), "fur"),
    "r": M((140, 40, 34), "fur"), "R": M((190, 70, 40), "fur", over="r"),
    "k": M((40, 20, 16), "gem", flat=True),
    "e": M((255, 190, 60), "gem", flat=True), "y": M((255, 240, 180), "gem", flat=True),
    "n": M((40, 20, 20), "gem", flat=True),
    "q": M((80, 16, 20), "gem", flat=True), "Q": M((255, 110, 40), "gem", emissive=0.9),
    "T": M((250, 244, 230), "gem", flat=True),
    "g": M((40, 36, 44), "fur"), "G": M((80, 76, 86), "fur"), "h": M((170, 150, 120), "stone"),
    "s": M((70, 120, 70), "scale"), "u": M((210, 204, 140), "scale", over="s"),
    "W": M((255, 255, 255), "gem", flat=True),
    "f": M((255, 140, 50), "gem", emissive=0.85), "F": M((255, 80, 40), "gem", emissive=0.7),
}
CHIMERA_MAT["W2"] = None
del CHIMERA_MAT["W2"]

# --------------------------------------------------------------------------
# SATYR (80) - a faun of the wine roads, all charm and no conscience: curled
# horns, a crooked grin, goat's legs and a set of pipes he will not stop
# playing, even to kick you.
# --------------------------------------------------------------------------
_SATYR_HEAD = rows_of(19,
    "...hhhhhhhhhhhh....",
    "..hhhhHHHhhhhhhh...",
    ".hhhhHHhhhhhhhhhh..",
    "hhhhhhhhhhhhhhhhh..",
    "hjhhhjhhhhjhhhhhhh.",
    "hjbbhjbbhhbjhhhhhh.",
    "hjbaajaaaabbhhhhhh.",
    "hjakkkaakkkkkhhhhh.",
    "hja+ikaai+iiekhhhh.",
    "hjaiIkaaiIIieahhhh.",
    "hjaakaaaakkkaahhhh.",
    "hjaaaoaaaaaaaabhhh.",
    "hj.aaaaaaaaaabbhhh.",
    "hj.aaaamaaaambhhh..",
    "hj..aaaammmmbbhh...",
    "hj...aaaaaabbhh....",
    ".j....aaaabbh......",
    "......abb..........",
)
_SATYR_HORN = spans(None, [(3, 6), (2, 7), (1, 7), (0, 6), (0, 5), (1, 5), (2, 6),
                           (4, 8), (6, 9), (7, 9)], "w")
_SATYR_HORN = [r[:3] + r[3:5].replace("w", "W") + r[5:] for r in _SATYR_HORN]
_SATYR_TORSO = spans(None, [(5, 8), (5, 8), (2, 11), (1, 12), (1, 12), (1, 12),
                            (2, 11), (2, 11), (3, 10), (3, 10), (3, 10), (3, 10)], "a")
_SATYR_VEST = spans(14, [None, None, (1, 4), (1, 5), (1, 5), (1, 5), (2, 5), (2, 5),
                         (3, 5), (3, 5), (3, 5), (3, 5)], "v")
_SATYR_VEST = [r[:8] + "".join("v" if c == "a" else c for c in r[8:]) for r in _SATYR_VEST]
_SATYR_PIPES = rows_of(11,
    "ppppppppppp",
    "PPPPPPPPPPP",
    "p.p.p.p.p.p",
    "p.p.p.p.p..",
    "p.p.p.p....",
    "p.p.p......",
    "p.p........",
)
_SATYR_NOTE = rows_of(4, "...n", "..nn", "..n.", "..n.", "nnn.", "nnn.")


def _satyr(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    # goat legs: thigh forward, hock back; one kicks out to strike
    far = [(38, 46, 4.0), (35, 55, 3.0), (39, 63, 2.4), (37, 74, 2.0)]
    near = ([(44, 46, 4.4), (36, 54, 3.2), (26, 56, 2.6), (18, 54, 2.2)] if pose == "attack"
            else [(44, 46, 4.4), (48, 55, 3.2), (43, 63, 2.6), (46, 74, 2.2)])
    tube(cv, [(x + ox, y, r) for x, y, r in far], "F")
    stamp(cv, far[-1][0] + ox - 3, 74, rows_of(6, "kkkkk.", "kk.kk."))
    stamp(cv, 31 + ox, 24, _SATYR_TORSO)
    stamp(cv, 31 + ox, 24, _SATYR_VEST, onto=True)
    tube(cv, [(41 + ox, 40, 6.0), (41 + ox, 46, 6.2)], "f")       # the goat half
    tube(cv, [(x + ox, y, r) for x, y, r in near], "f")
    nx, ny, _ = near[-1]
    stamp(cv, nx + ox - 3, ny - 1, rows_of(6, "kkkkk.", "kk.kk."))
    # arms and pipes: held at the lips in all but the kick
    if pose == "attack":
        arms = ([(34, 28, 2.1), (26, 24, 1.9), (20, 18, 1.7)], [(44, 28, 2.3), (50, 20, 2.0), (54, 12, 1.8)])
    else:
        arms = ([(34, 28, 2.1), (28, 24, 1.9), (30, 19, 1.7)], [(44, 28, 2.3), (44, 22, 2.0), (38, 19, 1.8)])
    tube(cv, [(x + ox, y, r) for x, y, r in arms[0]], "b")
    stamp(cv, 26 + ox, 4, _SATYR_HEAD)
    stamp(cv, 40 + ox, 0, _SATYR_HORN)
    stamp(cv, 26 + ox, 2, mirror(_SATYR_HORN))
    if pose != "attack":
        stamp(cv, 24 + ox, 17, _SATYR_PIPES)
    tube(cv, [(x + ox, y, r) for x, y, r in arms[1]], "a")
    if pose == "cast":
        for x, y in ((4, 8), (12, 20), (2, 30), (62, 6), (66, 24)):
            stamp(cv, x, y, _SATYR_NOTE)
    return finish(cv)


SATYR_MAT = {
    "a": M((238, 198, 164), "cel"), "b": M((214, 176, 146), "cel"),
    "h": M((120, 60, 40), "fur"), "H": M((180, 110, 70), "fur", over="h"),
    "j": M((80, 38, 26), "fur"),
    "k": M((30, 22, 20), "gem", flat=True), "e": M((250, 250, 250), "gem", flat=True),
    "i": M((120, 170, 60), "gem", flat=True), "I": M((200, 230, 120), "gem", flat=True),
    "+": GLINT, "n2": None,
    "m": M((150, 70, 70), "cel", flat=True),
    "w": M((96, 84, 74), "stone"), "W": M((150, 136, 120), "stone", over="w"),
    "v": M((100, 60, 120), "cloth"),
    "f": M((130, 90, 60), "fur"), "F": M((104, 70, 48), "fur"),
    "p": M((230, 190, 90), "plant", outline=(90, 60, 30)), "P": M((150, 110, 60), "plant"),
}
del SATYR_MAT["n2"]
SATYR_MAT["n"] = M((255, 246, 200), "gem", flat=True, outline=False)
SATYR_MAT["o"] = M((200, 150, 120), "cel", flat=True)

# --------------------------------------------------------------------------
# NEMEAN LION (80) - its hide has never once been cut: a lion the size of
# a cart, coat like beaten gold, mane like a thundercloud at sunset, and at
# its feet the heads of every spear that tried.
# --------------------------------------------------------------------------
def _lion_mane(w, h):
    import math
    rows = [list(r) for r in inset(spans(None, ellipse(w, h), "r"), "r", "R", 5)]
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    for y in range(h):
        for x in range(len(rows[y])):
            if rows[y][x] == ".":
                continue
            ang = math.atan2(y - cy, x - cx)
            rad = math.hypot((x - cx) / (w / 2.0), (y - cy) / (h / 2.0))
            if rad > 0.8 + 0.16 * math.cos(ang * 11):
                rows[y][x] = "."
            elif int((ang + math.pi) * 11) % 3 == 0 and rad > 0.35:
                rows[y][x] = "r" if rows[y][x] == "R" else "j"
    return ["".join(r) for r in rows]


_NEM_MANE = _lion_mane(40, 38)
# a broad face, set into the mane rather than poking out of it
_NEM_FACE = rows_of(22,
    "......aaaaaaaaa.......",
    "....aaaaaaaaaaaaa.....",
    "...aaaaaaaaaaaaaaa....",
    "..akkkkaaaaakkkkkaa...",
    ".aaaaeekkaaaaaeekaa...",
    ".aaaaaaaaaaaaaaaaaa...",
    "aaaaaaaaaaaaaaaaaaa...",
    "AAAAAAaaaaaaaaaaaa....",
    "AAAAAAAAaaaaaaaaaa....",
    "nnAAAAAAAAaaaaaaa.....",
    "nAAAAAAAAAAaaaaa......",
    ".AAqqqqAAAAAaaa.......",
    "..AAAAAAAAAaa.........",
    "....AAAAAA............",
)
_NEM_ROAR = rows_of(22,
    "......aaaaaaaaa.......",
    "....aaaaaaaaaaaaa.....",
    "...aaaaaaaaaaaaaaa....",
    "..akkkkaaaaakkkkkaa...",
    ".aaaaeekkaaaaaeekaa...",
    ".aaaaaaaaaaaaaaaaaa...",
    "aaaaaaaaaaaaaaaaaaa...",
    "AAAAAAaaaaaaaaaaaa....",
    "nnAAAAAAaaaaaaaaaa....",
    ".TqTqTqTAAaaaaaaa.....",
    "..qqqQQQqqAAaaaa......",
    "..qqQQQQqqqAaaa.......",
    "..qqqqqqqqAAaa........",
    "..TqTqTqTAAa..........",
    "....AAAAAAA...........",
)
_NEM_SPEAR = rows_of(14, "..............", "ss............", "sss...........",
                     "sswwwwwwwww...", "sss...........", "ss............")
_NEM_WAVE = rows_of(5, "..Y..", ".Y...", "Y....", ".Y...", "..Y..")


def _nemean(pose):
    cv = canvas(80, 80)
    low = 4 if pose == "attack" else 0
    # tail with its dark tuft
    tube(cv, [(64, 46 + low, 2.8), (72, 42, 2.4), (75, 32, 2.0)], "b")
    stamp(cv, 70, 24, spans(None, ellipse(9, 9), "r"))
    for (x0, x1, x2) in ((34, 32, 30), (58, 62, 59)):
        tube(cv, [(x0, 54 + low, 5.2), (x1, 65, 4.0), (x2, 76, 3.8)], "b")
    # long and low, all chest
    tube(cv, [(30, 48 + low, 11.5), (44, 50 + low, 9.4), (56, 49 + low, 8.4),
              (64, 48 + low, 7.2)], "a")
    # the near forepaw raised, claws out, to pounce
    fore = ([(26, 54 + low, 5.8), (16, 58, 4.2), (8, 58, 4.0)] if pose == "attack"
            else [(26, 54 + low, 5.8), (24, 65, 4.4), (22, 76, 4.2)])
    for leg in (fore, [(56, 54 + low, 5.8), (60, 65, 4.4), (56, 76, 4.2)]):
        tube(cv, leg, "a")
        x, y, _ = leg[-1]
        stamp(cv, x - 4, y - 1, rows_of(9, "aaaaaaaa.", "aaaaaaaaa", "T.T.T...."))
    hx, hy = {"idle": (4, 20), "attack": (-2, 26), "cast": (6, 14)}[pose]
    stamp(cv, hx - 4, hy - 12, _NEM_MANE)
    stamp(cv, hx, hy, _NEM_ROAR if pose != "idle" else _NEM_FACE)
    stamp(cv, 2, 72, _NEM_SPEAR)
    stamp(cv, 60, 70, mirror(_NEM_SPEAR))
    if pose == "cast":
        for i in range(3):
            stamp(cv, hx - 4 - i * 5, hy + 6 + i, _NEM_WAVE)
    return finish(cv)


NEMEAN_MAT = {
    # the hide is lit as metal: it has never been cut because it is not fur
    "a": M((236, 186, 80), "metal", outline=(90, 56, 22)),
    "b": M((200, 150, 64), "metal", outline=(90, 56, 22)),
    "A": M((252, 226, 160), "metal", outline=(90, 56, 22)),
    "r": M((120, 60, 30), "fur"), "R": M((170, 96, 40), "fur", over="r"),
    "j": M((90, 44, 26), "fur", over="r"),
    "k": M((50, 30, 16), "gem", flat=True), "e": M((255, 230, 120), "gem", flat=True),
    "n": M((50, 30, 20), "gem", flat=True),
    "q": M((90, 30, 20), "gem", flat=True), "Q": M((255, 190, 90), "gem", emissive=0.8),
    "T": M((250, 244, 230), "gem", flat=True),
    "s": M((170, 176, 190), "metal"), "w": M((130, 96, 60), "matte"),
    "Y": M((255, 236, 150), "gem", flat=True, outline=False),
}

# --------------------------------------------------------------------------
# SIREN (80) - the song is the dangerous part: a sea-singer on a floe,
# pearls at the brow, hair the colour of deep water, and a finned tail that
# ends in a train like a gown. She is only ever singing to one of you.
# --------------------------------------------------------------------------
_SIREN_HEAD = rows_of(19,
    "......oOoOo........",
    ".....hhhhhhhhh.....",
    "...hhhhhhhhhhhhh...",
    "..hhhhHHHHhhhhhhh..",
    ".hhhhHHHhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhhhhh",
    "hhjhhhjhhhhjhhhhhhh",
    "hjbbhhjbbhhbjhhhhhh",
    "hhbaajaaaabbhhhhhhh",
    "hhaaaaaaaaaaahhhhhh",
    "hhakkkkaakkkkkhhhhh",
    "hhaaiiaaaaiiiahhhhh",
    "hhaaaaaaaaaaaabhhhh",
    "hhaaanaaaaaaaabhhhh",
    "hh.aaaaaaaaaabbhhhh",
    "hh.aammaaaaaabhhhhh",
    "hh..aaaaaaaabbhhhhh",
    "hh...aaaaaabbhhhhhh",
    "hhh...aaaabbhhhhhhh",
    "hhh....abb..hhhhhh.",
)
_SIREN_SING = [r.replace("aammaa", "aaMMaa") for r in _SIREN_HEAD]
_SIREN_TORSO = spans(None, [(5, 8), (5, 8), (2, 11), (1, 12), (1, 12), (1, 12),
                            (2, 11), (2, 11), (3, 10), (3, 10), (3, 10)], "a")
_SIREN_SHELLS = spans(14, [None, None, None, (1, 12), (1, 12), (2, 11), None, None,
                           None, None, None], "c")
_SIREN_SHELLS[3] = ".cCcCc.cCcCc.."
_SIREN_FIN = rows_of(16,
    "ff............ff",
    "fFf..........fFf",
    ".fFff......ffFf.",
    ".ffFFff..ffFFff.",
    "..ffFFFffFFFff..",
    "...ffFFFFFFff...",
    ".....ffFFff.....",
    ".......ff.......",
)
_SIREN_ROCK = inset(spans(None, ellipse(48, 16), "r"), "r", "I", 3)
_SIREN_NOTE = rows_of(4, "...n", "..nn", "..n.", "..n.", "nnn.", "nnn.")
_SIREN_SPRAY = rows_of(7, "..w.w..", ".w.w.w.", "w.w.w.w", ".w...w.")


def _siren(pose):
    cv = canvas(80, 80)
    # hair: long, falling down her back and over the rock
    tube(cv, [(44, 14, 7.0), (50, 26, 6.4), (52, 40, 5.4), (50, 52, 4.0), (54, 60, 2.2)], "h")
    tube(cv, [(45, 16, 2.2), (50, 30, 2.4), (51, 44, 1.8)], "H")
    stamp(cv, 16, 62, _SIREN_ROCK)
    # the tail curls over the lip of the floe; it lashes to strike
    if pose == "attack":
        path = [(36, 42, 6.4), (32, 52, 6.0), (22, 58, 5.0), (12, 54, 3.6), (4, 46, 2.2)]
        fin_at, fin_rot = (-6, 30), -70
    else:
        path = [(36, 42, 6.4), (36, 52, 6.2), (44, 60, 5.4), (56, 62, 4.0), (64, 58, 2.4)]
        fin_at, fin_rot = (60, 44), 20
    tube(cv, path, "s", belly="u")
    scales(cv, "s", "S", 4)
    fin, _ = rotate(_SIREN_FIN, fin_rot)
    stamp(cv, fin_at[0], fin_at[1], fin)
    stamp(cv, 29, 28, _SIREN_TORSO)
    stamp(cv, 29, 28, _SIREN_SHELLS, onto=True)
    arms = {"idle": ([(31, 31, 2.0), (26, 38, 1.8), (22, 46, 1.6)],
                     [(41, 31, 2.2), (42, 38, 2.0), (36, 36, 1.8)]),
            "attack": ([(31, 31, 2.0), (26, 38, 1.8), (22, 46, 1.6)],
                       [(41, 31, 2.2), (46, 38, 2.0), (48, 46, 1.8)]),
            "cast": ([(31, 31, 2.0), (22, 26, 1.8), (14, 22, 1.6)],
                     [(41, 31, 2.2), (50, 26, 2.0), (58, 20, 1.8)])}[pose]
    tube(cv, arms[0], "b")
    stamp(cv, 26, 9, _SIREN_SING if pose == "cast" else _SIREN_HEAD)
    tube(cv, arms[1], "a")
    if pose == "cast":
        for x, y in ((4, 8), (12, 0), (64, 4), (70, 16), (2, 26)):
            stamp(cv, x, y, _SIREN_NOTE)
    if pose == "attack":
        for x, y in ((0, 38), (8, 30), (2, 56)):
            stamp(cv, x, y, _SIREN_SPRAY)
    return finish(cv)


SIREN_MAT = {
    "a": M((246, 222, 216), "cel"), "b": M((222, 196, 196), "cel"),
    "h": M((40, 120, 150), "fur"), "H": M((110, 200, 210), "fur", over="h"),
    "j": M((24, 70, 100), "fur"),
    "k": M((20, 30, 50), "gem", flat=True),
    "i": M((80, 180, 220), "gem", flat=True),
    "n": M((200, 230, 255), "gem", flat=True, outline=False),
    "m": M((180, 100, 120), "cel", flat=True), "M": M((110, 40, 70), "gem", flat=True),
    "o": M((250, 246, 240), "gem"), "O": M((230, 220, 250), "gem"),
    "c": M((246, 170, 190), "stone"), "C": M((255, 220, 230), "stone", over="c"),
    "s": M((70, 140, 210), "scale"), "S": M((50, 110, 180), "scale", over="s"),
    "u": M((200, 236, 240), "scale", over="s"),
    "f": M((120, 200, 240), "gem"), "F": M((210, 244, 255), "gem"),
    "i2": None,
    "I": M((226, 242, 255), "stone"), "w": M((220, 244, 255), "gem", flat=True, outline=False),
}
del SIREN_MAT["i2"]
SIREN_MAT["r"] = M((196, 222, 240), "stone")

# --------------------------------------------------------------------------
# TALOS (80) - the bronze guardian of Crete: a hoplite cast rather than born,
# crested helm, riveted cuirass gone green in the seams, and one vein of
# ichor from neck to heel, stoppered with a nail that was never quite tight.
# --------------------------------------------------------------------------
_TALOS_HELM = rows_of(18,
    "......aaaaaa......",
    "....aaaaaaaaaa....",
    "...aaaaaaaaaaaa...",
    "..aaaaaaaaaaaaaa..",
    "..aaaaaaaaaaaaaa..",
    ".kkkkkkaaaaaaaaaa.",
    "keeeekkaaaaaaaaaa.",
    ".kkkkkkaaaaaaaaaa.",
    "..aakkaaaaaaaaaa..",
    "..aakkaaaaaaaaaa..",
    "..aakkaaaaaaaaa...",
    "...akkaaaaaaa.....",
    "....aaaaaaa.......",
)
_TALOS_CUIRASS = spans(None, [(4, 26), (1, 29), (0, 30), (0, 30), (1, 29), (2, 28),
                              (3, 27), (4, 26), (5, 25), (6, 24), (6, 24), (7, 23),
                              (7, 23), (7, 23), (7, 23)], "a")
_TALOS_DETAIL = rows_of(31,
    "...............................",
    "...v.......................v...",
    "...............................",
    "......qqqqqq......qqqqqq.......",
    ".....q......qqqqqq......q......",
    "..............q.q..............",
    "...........qq.q.q.qq...........",
    "..............q.q..............",
    "...........qq.q.q.qq...........",
    "..............q.q..............",
    "...v.......................v...",
)
_TALOS_SHIELD = inset(spans(None, ellipse(26, 26), "b"), "b", "c", 3)
_TALOS_BOLT = rows_of(10, "......eeee", ".....eeee.", "....eeee..", "...eeEeeee",
                      "......eee.", ".....eee..", "....eee...", "...ee.....", "..e.......")
_TALOS_SPEAR = rows_of(6, "..xx..", ".xXXx.", ".xXXx.", "xXXXXx", "xxxxxx", "..xx..") + ["..ww.."] * 44
_TALOS_SKIRT = rows_of(20, *["pp.pp.pp.pp.pp.pp.pp"] * 5)
_TALOS_ARC = rows_of(7, "z......", ".z..z..", "..zz.z.", "...z..z", "..z....")


def _talos(pose):
    cv = canvas(80, 80)
    ox = -4 if pose == "attack" else 0
    # the crest, front to back over the helm
    tube(cv, [(30 + ox, 6, 2.0), (34 + ox, 1, 2.4), (40 + ox, 0, 2.6), (46 + ox, 2, 2.4),
              (50 + ox, 7, 2.0)], "r")
    # the spear: grounded, levelled to thrust, or lifted
    if pose == "attack":
        near = [(52, 30, 4.2), (42, 32, 3.6), (30, 32, 3.4)]
    else:
        stamp(cv, 58, 2 if pose == "idle" else -6, _TALOS_SPEAR)
        near = [(52, 30, 4.2), (58, 38, 3.6), (60, 32 if pose == "cast" else 40, 3.4)]
    stride = {"idle": (0, 0), "attack": (-5, 3), "cast": (-1, 1)}[pose]
    for (x, mat), dx in zip(((46, "b"), (32, "a")), stride):
        x += ox + dx
        tube(cv, [(x, 48, 5.4), (x, 58, 4.4)], mat)                     # thigh
        tube(cv, [(x, 59, 4.2), (x - 1, 64, 4.8), (x - 1, 71, 3.0)], "g")  # greave
        tube(cv, [(x - 1, 74, 3.0), (x - 5, 76, 2.4)], mat)              # sandal
    stamp(cv, 25 + ox, 24, _TALOS_CUIRASS)
    stamp(cv, 25 + ox, 24, _TALOS_DETAIL, onto=True)
    stamp(cv, 29 + ox, 45, _TALOS_SKIRT)
    far = {"idle": [(28, 30, 4.0), (20, 38, 3.4), (16, 40, 3.2)],
           "attack": [(28, 30, 4.0), (22, 36, 3.4), (18, 38, 3.2)],
           "cast": [(28, 30, 4.0), (20, 22, 3.4), (16, 14, 3.2)]}[pose]
    tube(cv, [(x + ox, y, r) for x, y, r in far], "b")
    stamp(cv, 31 + ox, 6, _TALOS_HELM)
    # the ichor vein, neck to heel, and the nail where it leaks
    for x, y in ((40, 26), (40, 28), (39, 30), (39, 32), (40, 34), (40, 36), (41, 38),
                 (41, 40), (42, 42), (43, 44), (45, 56), (46, 58), (46, 60), (46, 62)):
        if cv[y][x + ox] not in ".":
            cv[y][x + ox] = "i"
    stamp(cv, 44 + ox, 66, rows_of(3, "nnn", "nNn", "nnn"))
    stamp(cv, 45 + ox, 69, rows_of(2, "i.", "ii", ".i"))
    # the shield on the far arm: guarding, or raised to call the storm
    sx, sy = {"idle": (4, 28), "attack": (6, 26), "cast": (2, 0)}[pose]
    stamp(cv, sx + ox, sy, _TALOS_SHIELD)
    stamp(cv, sx + 8 + ox, sy + 8, _TALOS_BOLT)
    if pose == "attack":
        sp, _ = rotate(_TALOS_SPEAR, -84)
        stamp(cv, 1, 27, sp)
    tube(cv, [(x + ox, y, r) for x, y, r in near], "a")
    for x, y in ((28, 27), (50, 27)):                                   # pauldrons
        tube(cv, [(x + ox - 3, y, 3.6), (x + ox + 3, y, 3.6)], "c")
    if pose == "cast":
        for x, y in ((30, 4), (2, 30), (66, 40)):
            stamp(cv, x, y, _TALOS_ARC)
    return finish(cv)


TALOS_MAT = {
    "a": M((206, 134, 70), "metal", outline=(80, 40, 20)),
    "b": M((180, 114, 60), "metal", outline=(80, 40, 20)),
    "c": M((222, 160, 90), "metal", outline=(80, 40, 20)),
    "g": M((150, 128, 84), "metal", outline=(48, 40, 26)),
    "q": M((140, 80, 44), "metal", over="a"), "v": M((255, 226, 170), "metal", over="a"),
    "k": M((40, 24, 20), "gem", flat=True),
    "e": M((140, 240, 255), "gem", emissive=0.9), "E": M((255, 255, 255), "gem", emissive=1.0),
    "r": M((190, 40, 44), "fur"),
    "x": M((200, 206, 220), "metal"), "X": M((250, 252, 255), "metal"),
    "w": M((110, 80, 56), "matte"),
    "p": M((120, 70, 44), "matte"),
    "i": M((255, 214, 90), "gem", emissive=0.9),
    "n": M((110, 110, 120), "metal"), "N": M((200, 200, 210), "metal"),
    "z": M((200, 240, 255), "gem", flat=True, outline=False),
}

# ---------------------------------------------------------------------------
ART = {
    "pixie": Creature(_pixie, PIXIE_MAT),
    "kitsune": Creature(_kitsune, KITSUNE_MAT),
    "kappa": Creature(_kappa, KAPPA_MAT),
    "thunderbird": Creature(_thunderbird, THUNDERBIRD_MAT),
    "golem": Creature(_golem, GOLEM_MAT),
    "wisp": Creature(_wisp, WISP_MAT),
    "naga": Creature(_naga, NAGA_MAT),
    "tengu": Creature(_tengu, TENGU_MAT),
    "mandrake": Creature(_mandrake, MANDRAKE_MAT),
    "cerberus": Creature(_cerberus, CERBERUS_MAT),
    "baku": Creature(_baku, BAKU_MAT),
    "anubis": Creature(_anubis, ANUBIS_MAT),
    "minotaur": Creature(_minotaur, MINOTAUR_MAT),
    "medusa": Creature(_medusa, MEDUSA_MAT),
    "harpy": Creature(_harpy, HARPY_MAT),
    "cyclops": Creature(_cyclops, CYCLOPS_MAT),
    "pegasus": Creature(_pegasus, PEGASUS_MAT),
    "chimera": Creature(_chimera, CHIMERA_MAT),
    "satyr": Creature(_satyr, SATYR_MAT),
    "nemean": Creature(_nemean, NEMEAN_MAT),
    "siren": Creature(_siren, SIREN_MAT),
    "talos": Creature(_talos, TALOS_MAT),
}

_cache = {}
_icons = {}

def _entry(key):
    e = ART[key]
    if isinstance(e, Creature):
        return e
    rows, mats = e                      # a single drawing: every pose is it
    return Creature(lambda pose, rows=rows: rows, mats, poses=("idle",))


def poses(key):
    return _entry(key).poses


# Sprites authored at this width or more are already at their display size,
# so they skip the EPX upscale and are lit at their own resolution.
NATIVE_WIDTH = 48


def sprite(key, pose="idle"):
    """The lit battle sprite for one pose."""
    entry = _entry(key)
    pose = pose if pose in entry.poses else "idle"
    k = (key, pose)
    if k not in _cache:
        rows = entry.rows(pose)
        native = max(len(r) for r in rows) >= NATIVE_WIDTH
        # Native art has its detail drawn in; the procedural texture is only
        # for keeping upscaled 32x32 forms from looking like poured plastic.
        _cache[k] = shading.render(rows, entry.mats, upscale=not native,
                                   detail=not native)
    return _cache[k]


def icon(key, size=32):
    """A small version for menus and the bestiary."""
    k = (key, size)
    if k not in _icons:
        import pygame
        _icons[k] = pygame.transform.smoothscale(sprite(key), (size, size))
    return _icons[k]


def prebuild():
    """Light every sprite and pose up front so no battle stutters."""
    for key in ART:
        for pose in poses(key):
            sprite(key, pose)
