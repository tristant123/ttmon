"""Overworld characters, 32x48.

Authored at PS1 field-sprite proportions rather than the chibi 16x20 they
started as: roughly four heads tall, with a readable face, a coat that folds,
a satchel strap and separate boots. Xenogears' field sprites sit in about this
box, and the extra height is what stops a character reading as a bobblehead
next to detailed scenery.

These are material maps; shading.py lights them. They are drawn at their
authored size - no EPX upscale - because at 32x48 the silhouette is already
under our control.
"""

from ..pixelart import flip
from . import shading
from .shading import M


def C(row, off=0, w=32):
    """Centre a run of material characters in a 32-wide line."""
    pad = w - len(row)
    left = max(0, min(pad, pad // 2 + off))
    return "." * left + row + "." * (w - left - len(row))


# o outline, h hair, H hair highlight, a skin, k eye, m mouth,
# c coat, C coat front, d coat shadow, s satchel strap, p pack,
# t trousers, b boots, g glove
HERO_PAL = {
    "h": M((58, 122, 88), "cloth"), "H": M((104, 176, 126), "cloth"),
    "a": M((246, 210, 176), "skin"),
    "k": M((44, 38, 58), "gem", flat=True),
    "m": M((178, 110, 106), "skin"),
    "c": M((202, 204, 198), "cloth"), "C": M((236, 238, 232), "cloth"),
    "d": M((148, 150, 150), "cloth"), "e": M((178, 180, 176), "cloth"),
    "s": M((176, 132, 62), "cloth"), "p": M((142, 104, 52), "cloth"),
    "t": M((76, 84, 112), "cloth"),
    "b": M((92, 68, 50), "cloth"),
    "g": M((120, 96, 66), "cloth"),
}


def _recolour(**kw):
    out = dict(HERO_PAL)
    out.update(kw)
    return out


_HEAD_DOWN = [
    C("hhhhhhhh"),
    C("hhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhHHhhhhhhhh"),
    C("hhHHhhhhhhhh"),
    C("hhaaaaaaaahh"),
    C("hhaaaaaaaahh"),
    C("haakkaakkaah"),
    C("haakkaakkaah"),
    C("haaaaaaaaaah"),
    C("haaaammaaaah"),
    C("hhaaaaaaaahh"),
    C("haaaaaaaaaah"),
    C("aaaaaaaa"),
]

_HEAD_UP = [
    C("hhhhhhhh"),
    C("hhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhHHhhhhhhhh"),
    C("hhHHhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhhhhhh"),
    C("hhhhhhhh"),
]

_HEAD_SIDE = [
    C("hhhhhhh", off=-1),
    C("hhhhhhhhh", off=-1),
    C("hhhhhhhhhh", off=0),
    C("hhHHhhhhhaa", off=0),
    C("hhHHhhhhaaaa", off=1),
    C("hhhhhhhaaaaa", off=1),
    C("hhhhhhaaaaaa", off=1),
    C("hhhhhhakkaaa", off=1),
    C("hhhhhhakkaaa", off=1),
    C("hhhhhhaaaaaa", off=1),
    C("hhhhhaaaamma", off=1),
    C("hhhhhaaaaaaa", off=1),
    C("hhhhaaaaaa", off=1),
    C("aaaaaa", off=1),
]


def _legs_front(stride):
    """Twelve rows: thigh, shin, boot. stride 0 stands still."""
    if stride == 0:
        return [C("ttttttttttt")] + [C("tttt..tttt")] * 6 + \
               [C("tttt..tttt"), C("bbbb..bbbb"), C("bbbb..bbbb"),
                C("bbbbb.bbbbb"), C("bbbbb.bbbbb")]
    lead = 1 if stride > 0 else -1
    return [C("ttttttttttt"),
            C("ttttt.tttt", off=lead), C("tttt..tttt"),
            C("ttt...ttttt", off=lead), C("ttt....tttt", off=lead),
            C("ttt....tttt", off=lead), C("tt.....tttt", off=lead),
            C("tt.....tttt", off=lead), C("bb.....bbbb", off=lead),
            C("bbb....bbbb", off=lead), C("bbbb...bbbbb", off=lead),
            C("bbbb...bbbbb", off=lead)]


def _body_down(stride):
    """stride 0 stands, 1 and -1 are the two halves of a walk cycle."""
    legs = _legs_front(stride)
    return [
        C("cccccccccccc"),
        C("eecccccccccccccee"[:18]),
        C("eed" + "c" + "C" * 10 + "c" + "dee"),
        C("eed" + "c" + "C" * 3 + "ss" + "C" * 5 + "c" + "dee"),
        C("eed" + "c" + "C" * 4 + "ss" + "C" * 4 + "c" + "dee"),
        C("eed" + "c" + "C" * 5 + "ss" + "C" * 3 + "c" + "dee"),
        C("eed" + "c" + "C" * 6 + "ss" + "C" * 2 + "c" + "dee"),
        C("eed" + "c" + "C" * 10 + "c" + "dee"),
        C("eed" + "c" + "C" * 10 + "c" + "dee"),
        C("ggd" + "c" + "C" * 10 + "c" + "dgg"),
        C("ggd" + "c" + "C" * 10 + "c" + "dgg"),
        C("ggd" + "d" * 12 + "dgg"),
        C("aad" + "s" * 12 + "daa"),
        C("aad" + "d" * 12 + "daa"),
        C("d" * 16),
        C("d" * 14),
        C("t" * 13),
        C("t" * 12),
    ] + legs


def _body_up(stride):
    legs = _legs_front(stride)
    return [
        C("cccccccccccc"),
        C("eecccccccccccccee"[:18]),
        C("eed" + "c" * 12 + "dee"),
        C("eed" + "c" * 2 + "pppppp" + "c" * 4 + "dee"),
        C("eed" + "c" * 2 + "pppppp" + "c" * 4 + "dee"),
        C("eed" + "c" * 2 + "pppppp" + "c" * 4 + "dee"),
        C("eed" + "c" * 2 + "pppppp" + "c" * 4 + "dee"),
        C("eed" + "c" * 12 + "dee"),
        C("eed" + "c" * 12 + "dee"),
        C("ggd" + "c" * 12 + "dgg"),
        C("ggd" + "c" * 12 + "dgg"),
        C("ggd" + "d" * 12 + "dgg"),
        C("aad" + "s" * 12 + "daa"),
        C("aad" + "d" * 12 + "daa"),
        C("d" * 16),
        C("d" * 14),
        C("t" * 13),
        C("t" * 12),
    ] + legs


def _body_side(stride):
    """A profile: one arm in front of the body, pack on the back."""
    if stride == 0:
        legs = [C("tttttt", off=0)] * 7 + \
               [C("tttttt", off=0), C("bbbbbbb", off=0),
                C("bbbbbbb", off=0), C("bbbbbbbb", off=1),
                C("bbbbbbbb", off=1)]
    else:
        legs = [C("tttttt", off=0), C("ttt..ttt", off=0),
                C("tt....ttt", off=1), C("tt.....tt", off=1),
                C("tt.....tt", off=1), C("tt.....tt", off=1),
                C("tt.....tt", off=1), C("bb.....bb", off=1),
                C("bb.....bb", off=1), C("bbb...bbb", off=1),
                C("bbbb..bbbb", off=1), C("bbbb..bbbb", off=1)]
    return [
        C("cccccccc", off=0),
        C("pcccccccccc", off=0),
        C("ppdccCCCCcd", off=0),
        C("ppdccCCCCcd", off=0),
        C("ppdcsCCCCcd", off=0),
        C("ppdccsCCCcd", off=0),
        C("ppdcccsCCcd", off=0),
        C("ppdcccCCCcd", off=0),
        C("pdcccCCCCcd", off=0),
        C("dcccCCCCceg", off=0),
        C("dcccCCCCceg", off=0),
        C("ddddddddgg", off=0),
        C("ssssssssaa", off=0),
        C("dddddddddd", off=0),
        C("dddddddd", off=0),
        C("ttttttt", off=0),
        C("ttttttt", off=0),
        C("tttttt", off=0),
    ] + legs


def _sprite(head, body):
    rows = [C("")] * 2 + head + body
    while len(rows) < 48:
        rows.append(C(""))
    return rows[:48]


DOWN_A = _sprite(_HEAD_DOWN, _body_down(0))
DOWN_B = _sprite(_HEAD_DOWN, _body_down(1))
UP_A = _sprite(_HEAD_UP, _body_up(0))
UP_B = _sprite(_HEAD_UP, _body_up(-1))
SIDE_A = _sprite(_HEAD_SIDE, _body_side(0))
SIDE_B = _sprite(_HEAD_SIDE, _body_side(1))
VILLAGER = DOWN_A

ELDER_PAL = _recolour(h=M((226, 226, 232), "cloth"),
                      H=M((248, 248, 248), "cloth"),
                      c=M((118, 96, 164), "cloth"),
                      C=M((156, 132, 206), "cloth"),
                      t=M((78, 62, 110), "cloth"))
SHOP_PAL = _recolour(h=M((168, 108, 62), "fur"), H=M((212, 150, 94), "fur"),
                     c=M((214, 162, 88), "cloth"),
                     C=M((242, 206, 140), "cloth"),
                     t=M((122, 84, 48), "cloth"))
KID_PAL = _recolour(h=M((96, 88, 152), "cloth"), H=M((136, 128, 200), "cloth"),
                    c=M((222, 128, 146), "cloth"),
                    C=M((246, 180, 190), "cloth"),
                    t=M((96, 72, 104), "cloth"))
WARD_PAL = _recolour(h=M((64, 64, 90), "cloth"), H=M((104, 104, 138), "cloth"),
                     c=M((92, 134, 198), "cloth"),
                     C=M((140, 182, 238), "cloth"),
                     t=M((56, 72, 112), "cloth"))

# a pilgrim in dusty ochre, hood up
PILGRIM_PAL = _recolour(h=M((150, 120, 84), "cloth"), H=M((190, 160, 112), "cloth"),
                        c=M((170, 128, 80), "cloth"),
                        C=M((212, 172, 116), "cloth"),
                        t=M((110, 84, 60), "cloth"))


def build():
    """Lit walk cycles at 32x48, drawn at their authored resolution."""
    def lit(rows, pal):
        return shading.render(rows, pal, upscale=False)

    hero = {
        "down": [lit(DOWN_A, HERO_PAL), lit(DOWN_B, HERO_PAL)],
        "up": [lit(UP_A, HERO_PAL), lit(UP_B, HERO_PAL)],
        "right": [lit(SIDE_A, HERO_PAL), lit(SIDE_B, HERO_PAL)],
    }
    hero["left"] = [flip(s) for s in hero["right"]]
    npcs = {
        "elder": lit(VILLAGER, ELDER_PAL),
        "shop": lit(VILLAGER, SHOP_PAL),
        "kid": lit(VILLAGER, KID_PAL),
        "ward": lit(VILLAGER, WARD_PAL),
        "pilgrim": lit(VILLAGER, PILGRIM_PAL),
    }
    return hero, npcs
