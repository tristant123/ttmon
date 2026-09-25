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

# ---------------------------------------------------------------------------
ART = {
    "pixie": Creature(_pixie, PIXIE_MAT),
    "kitsune": Creature(_kitsune, KITSUNE_MAT),
    "kappa": Creature(_kappa, KAPPA_MAT),
    "thunderbird": Creature(_thunderbird, THUNDERBIRD_MAT),
    "golem": (GOLEM64, GOLEM64_MAT),
    "wisp": Creature(_wisp, WISP_MAT),
    "naga": (NAGA64, NAGA64_MAT),
    "tengu": (TENGU64, TENGU64_MAT),
    "mandrake": Creature(_mandrake, MANDRAKE_MAT),
    "cerberus": (CERBERUS64, CERBERUS64_MAT),
    "baku": (BAKU64, BAKU64_MAT),
    "anubis": Creature(_anubis, ANUBIS_MAT),
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
