"""Overworld character sprites (16x20), drawn from a single chibi template."""

from ..pixelart import flip
from . import shading
from .shading import M

# Shared material slots so villagers can be recoloured cheaply.
#   o outline, h hood/hair, H hood highlight, a skin, k eye, m mouth,
#   c cloak, C cloak highlight, b boot, s satchel
HERO_PAL = {
    "o": M((44, 36, 58), "cloth", outline=(28, 22, 40)),
    "h": M((72, 152, 104), "cloth"), "H": M((112, 200, 144), "cloth"),
    "a": M((248, 212, 176), "skin"),
    "k": M((40, 34, 52), "gem", flat=True),
    "m": M((200, 120, 120), "skin"),
    "c": M((236, 236, 228), "cloth"), "C": M((180, 188, 204), "cloth"),
    "b": M((96, 72, 56), "cloth"), "s": M((208, 166, 74), "cloth"),
}


def _recolour(**kw):
    """A villager palette: the hero's materials with a few slots swapped."""
    out = dict(HERO_PAL)
    out.update(kw)
    return out

DOWN_A = [
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "...ohHhhhhhho...",
    "...ohhaaaahho...",
    "...ohaaaaaaho...",
    "...oakkaakkao...",
    "...oaaaaaaaao...",
    "...oaammmmaao...",
    "....oaaaaaao....",
    "...occcccccco...",
    "..occcCccccco...",
    "..ocsccccccco...",
    "..ocssccccccco..",
    "..occccccccccc..",
    "...occcccccco...",
    "....oooooooo....",
    ".....ob..bo.....",
    ".....ob..bo.....",
    ".....oo..oo.....",
]
DOWN_B = [
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "...ohHhhhhhho...",
    "...ohhaaaahho...",
    "...ohaaaaaaho...",
    "...oakkaakkao...",
    "...oaaaaaaaao...",
    "...oaammmmaao...",
    "....oaaaaaao....",
    "...occcccccco...",
    "..occcCccccco...",
    "..ocsccccccco...",
    "..ocssccccccco..",
    "..occccccccccc..",
    "...occcccccco...",
    "....oooooooo....",
    "....ob....bo....",
    "....ob....bo....",
    "....oo....oo....",
]
UP_A = [
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "...ohhhhhhhho...",
    "...ohhhhhhhho...",
    "...ohhhhhhhho...",
    "...ohhhhhhhho...",
    "...ohhhhhhhho...",
    "...ohhhhhhhho...",
    "....ohhhhhho....",
    "...occcccccco...",
    "..occcccccccco..",
    "..occcccCcccco..",
    "..occcccccccco..",
    "..occcccccccco..",
    "...occcccccco...",
    "....oooooooo....",
    ".....ob..bo.....",
    ".....ob..bo.....",
    ".....oo..oo.....",
]
UP_B = [r for r in UP_A[:17]] + [
    "....ob....bo....",
    "....ob....bo....",
    "....oo....oo....",
]
SIDE_A = [
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "...ohhhhhhhho...",
    "...ohhhaaaaho...",
    "...ohhaaaaaho...",
    "...ohhakkaaho...",
    "...ohhaaaaao....",
    "...ohhaammao....",
    "....ohaaaao.....",
    "....occccco.....",
    "...occcccccco...",
    "...ocsccccco....",
    "...ocssccccco...",
    "...occcccccco...",
    "....occcccco....",
    "....oooooooo....",
    ".....ob.bo......",
    ".....ob.bo......",
    ".....oo.oo......",
]
SIDE_B = [r for r in SIDE_A[:17]] + [
    "......obbo......",
    ".....ob..bo.....",
    ".....oo..oo.....",
]

VILLAGER = [
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "...ohhhhhhhho...",
    "...ohhaaaahho...",
    "...ohaaaaaaho...",
    "...oakkaakkao...",
    "...oaaaaaaaao...",
    "...oaammmmaao...",
    "....oaaaaaao....",
    "....occcccco....",
    "...occcccccco...",
    "...occcCcccco...",
    "..occccccccco...",
    "..occccccccco...",
    "...occcccccco...",
    "....oooooooo....",
    ".....ob..bo.....",
    ".....ob..bo.....",
    ".....oo..oo.....",
]

ELDER_PAL = _recolour(h=M((224, 224, 232), "cloth"),
                      H=M((248, 248, 248), "cloth"),
                      c=M((124, 100, 172), "cloth"),
                      C=M((164, 140, 212), "cloth"))
SHOP_PAL = _recolour(h=M((176, 112, 64), "fur"), H=M((216, 152, 96), "fur"),
                     c=M((232, 176, 96), "cloth"),
                     C=M((248, 216, 152), "cloth"))
KID_PAL = _recolour(h=M((100, 92, 156), "cloth"),
                    H=M((140, 132, 204), "cloth"),
                    c=M((232, 136, 152), "cloth"),
                    C=M((248, 184, 192), "cloth"))
WARD_PAL = _recolour(h=M((68, 68, 92), "cloth"), H=M((108, 108, 140), "cloth"),
                     c=M((100, 140, 204), "cloth"),
                     C=M((148, 188, 244), "cloth"))


def build():
    """Lit walk cycles at 32x40 - the same size they were drawn at before,
    but shaded by the same model as the monsters and the scenery."""
    def lit(rows, pal):
        return shading.render(rows, pal)

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
    }
    return hero, npcs
