"""Overworld character sprites (16x20), drawn from a single chibi template."""

from ..pixelart import make, flip

# Shared palette slots so villagers can be recoloured cheaply.
#   o outline, h hood/hair, H hood highlight, a skin, k eye, m mouth,
#   c cloak, C cloak highlight, b boot, s satchel
HERO_PAL = {
    "o": (40, 34, 52), "h": (72, 152, 104), "H": (112, 200, 144),
    "a": (248, 212, 176), "k": (40, 34, 52), "m": (200, 120, 120),
    "c": (232, 232, 224), "C": (176, 184, 200), "b": (96, 72, 56),
    "s": (200, 160, 72),
}

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

ELDER_PAL = dict(HERO_PAL, h=(224, 224, 232), H=(248, 248, 248),
                 c=(120, 96, 168), C=(160, 136, 208))
SHOP_PAL = dict(HERO_PAL, h=(176, 112, 64), H=(216, 152, 96),
                c=(232, 176, 96), C=(248, 216, 152))
KID_PAL = dict(HERO_PAL, h=(96, 88, 152), H=(136, 128, 200),
               c=(232, 136, 152), C=(248, 184, 192))
WARD_PAL = dict(HERO_PAL, h=(64, 64, 88), H=(104, 104, 136),
                c=(96, 136, 200), C=(144, 184, 240))


def build():
    hero = {
        "down": [make(DOWN_A, HERO_PAL), make(DOWN_B, HERO_PAL)],
        "up": [make(UP_A, HERO_PAL), make(UP_B, HERO_PAL)],
        "right": [make(SIDE_A, HERO_PAL), make(SIDE_B, HERO_PAL)],
    }
    hero["left"] = [flip(s) for s in hero["right"]]
    npcs = {
        "elder": make(VILLAGER, ELDER_PAL),
        "shop": make(VILLAGER, SHOP_PAL),
        "kid": make(VILLAGER, KID_PAL),
        "ward": make(VILLAGER, WARD_PAL),
    }
    return hero, npcs
