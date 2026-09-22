"""Monster sprites, 32x32, hand-authored.

House style: chibi proportions (head roughly half the sprite), heavy dark
outlines, two-tone shading, and a single white glint in each eye. The species
are drawn from world mythology and deliberately kept cute so the brutal
combat system lands as a contrast rather than a warning.
"""

from ..pixelart import make

OUT = (48, 40, 64)
EYE = (40, 34, 56)
GLINT = (255, 255, 255)
BLUSH = (248, 160, 168)

# --------------------------------------------------------------------------
# PIXIE - Wind. A hedge-sprite with leaf wings.
# --------------------------------------------------------------------------
PIXIE = [
    "..............dd................",
    ".............deed...............",
    ".............deed...............",
    "............oddddddo............",
    "..........oddddddddddo..........",
    "........oddddddddddddddo........",
    ".......oddddddddddddddddo.......",
    "..ghh..odddddddddddddddddo.hhg..",
    ".ghhh..odddddddddddddddddo.hhhg.",
    "ghhhh.odddaaaaaaaaaaaaddddo.hhhg",
    "ghhhh.oddaaaaaaaaaaaaaaddo.hhhhg",
    "ghhhh.oaakkkkaaaaaakkkkaao.hhhhg",
    "ghhhh.oaakwkkaaaaaakwkkaao.hhhhg",
    ".ghhh.oaakkkkaaaaaakkkkaao.hhhg.",
    "..ghh.oaaakkaaaaaaaakkaaao.hhg..",
    "...gh.oappaaaaaaaaaaaappao.hg...",
    "....g..oaaaaaaakkaaaaaaao..g....",
    ".......oaaaaaaaaaaaaaaoo........",
    ".........oaaaaaaaaaao...........",
    "...........oaaaaaao.............",
    "...........ommmmmmo.............",
    ".........a.ommmmmmo.a...........",
    "........aa.ommmmmmo.aa..........",
    ".........ommmmmmmmmmo...........",
    "........ommmmnnnnmmmmo..........",
    ".......ommmmnnnnnnmmmmo.........",
    ".......onnnnnnnnnnnnnno.........",
    "........oooooooooooooo..........",
    ".............aa..aa.............",
    ".............aa..aa.............",
    "............ooo..ooo............",
    "................................",
]
PIXIE_PAL = {
    "o": OUT, "a": (255, 226, 198), "b": (232, 190, 166),
    "d": (128, 216, 136), "e": (72, 160, 96),
    "m": (248, 248, 240), "n": (198, 226, 232),
    "g": (96, 200, 192), "h": (176, 240, 224),
    "k": EYE, "w": GLINT, "p": BLUSH,
}

# --------------------------------------------------------------------------
# KITSUNE - Fire. Two-tailed fox kit with ember markings.
# --------------------------------------------------------------------------
KITSUNE = [
    ".......o..............o.........",
    "......oio............oio........",
    "......oiio..........oiio........",
    ".....oaiiao........oaiiao.......",
    ".....oaaiiao......oaiiaao.......",
    ".....oaaaiiao....oaiiaaao.......",
    ".....oaaaaaaoooooooaaaaao.......",
    "......oaaaaaaaaaaaaaaaao........",
    "......oaaaaaaaaaaaaaaaao........",
    "ttt...oaaaaaaaaaaaaaaaao........",
    "tuut..oakkkkaaaaaakkkkao........",
    "tuuut.oakwkkaaaaaakwkkao........",
    "tuuut.oakkkkaaaaaakkkkao........",
    "tuuut.oaaaaaaaaaaaaaaaao........",
    "tuuut.oapppammmmapppppao........",
    ".tuut.oaaaammmmmmaaaaao.........",
    "..ttt..oaaammkkmmaaaao..........",
    "..ttt...oaammmmmmaao............",
    ".tuut.....oaammmmao.............",
    "tuuut......oaaaaao..............",
    "tuuut.....oaaaaaaao.............",
    "tuuut....oaabbbbbbao............",
    ".tuut...oaabbbbbbbbao...........",
    "..ttt...oabbbbbbbbbao...........",
    "........oabbbbbbbbao............",
    ".........oaabbbbaao.............",
    ".........oaaaaaaaao.............",
    "........oaaaoooaaaao............",
    "........omma...ommao............",
    ".........oo.....oo..............",
    "................................",
    "................................",
]
KITSUNE_PAL = {
    "o": OUT, "a": (248, 156, 72), "b": (216, 112, 48),
    "i": (248, 190, 190), "m": (252, 240, 226),
    "t": (216, 112, 48), "u": (248, 186, 104),
    "k": EYE, "w": GLINT, "p": BLUSH,
}

# --------------------------------------------------------------------------
# KAPPA - Ice. River-child with a water dish and a mossy shell.
# --------------------------------------------------------------------------
KAPPA = [
    "..........oooooooooo............",
    "........oowwwwwwwwwwoo..........",
    ".......owwWWWWWWWWWWWwo.........",
    "......ooooooooooooooooooo.......",
    "....ooaaaaaaaaaaaaaaaaaaoo......",
    "...oaaaaaaaaaaaaaaaaaaaaaao.....",
    "..oaaaaaaaaaaaaaaaaaaaaaaaao....",
    "..oaaaaaaaaaaaaaaaaaaaaaaaao....",
    "..oaaaaaaaaaaaaaaaaaaaaaaaao....",
    "..oaakkkkaaaaaaaaaakkkkaaaao....",
    "..oaakwkkaaaaaaaaaakwkkaaaao....",
    "..oaakkkkaaaaaaaaaakkkkaaaao....",
    "..oaaaaaaaaaayyaaaaaaaaaaaao....",
    "...oaaaaaaaayyyyaaaaaaaaaao.....",
    "....oaaaaaaaayyaaaaaaaaaao......",
    ".....ooaaaaaaaaaaaaaaaoo........",
    ".......oooaaaaaaaaooo...........",
    "..........oaaaaao...............",
    ".......oooosssssoooo............",
    "....oooossssssssssssoooo........",
    "...oassssggggggggssssssao.......",
    "..oaasssggssssssggsssssaao......",
    "..oaasssgssssssssgssssssao......",
    "..oaasssggssssssggsssssaao......",
    "...oassssggggggggssssssao.......",
    "....ooosssssssssssssooo.........",
    "......ooosssssssssooo...........",
    ".........oaaaaaaao..............",
    ".........oaao.oaao..............",
    "........oaaao.oaaao.............",
    "........ooooo.ooooo.............",
    "................................",
]
KAPPA_PAL = {
    "o": OUT, "a": (136, 200, 128), "b": (96, 160, 104),
    "s": (88, 152, 96), "g": (56, 112, 80),
    "w": (152, 216, 248), "W": (200, 240, 255),
    "y": (248, 220, 128), "k": EYE,
}
KAPPA_PAL["w"] = (152, 216, 248)
KAPPA_PAL["k"] = EYE

# --------------------------------------------------------------------------
# THUNDERBIRD - Electric. A storm chick, far too pleased with itself.
# --------------------------------------------------------------------------
THUNDERBIRD = [
    "..............cc................",
    ".............ccc................",
    "............cccc................",
    "...........occcco...............",
    ".........oocccccoo..............",
    "........oaaaaaaaaao.............",
    ".......oaaaaaaaaaaao............",
    "......oaaaaaaaaaaaaao...........",
    "bbb...oaaaaaaaaaaaaao...bbb.....",
    "bBBb..oakkkkaaaakkkkao..bBBb....",
    "bBBBb.oakwkkaaaakwkkao.bBBBb....",
    "bBBBb.oakkkkaaaakkkkao.bBBBb....",
    "bBBBb.oaaaayyyyaaaaaao.bBBBb....",
    "bBBBb.oaaaayyyyaaaaaao.bBBBb....",
    "bBBBb..oaaaayyaaaaaao..bBBBb....",
    ".bBBb...oaaaaaaaaaao...bBBb.....",
    "..bBb....oaaaaaaao.....bBb......",
    "..bbb.....oaaaaao......bbb......",
    "..........oaaaaao...............",
    ".........oaaaaaaao..............",
    "........oaaaaaaaaao.............",
    "........oaayyyyyaao.............",
    "........oayyyyyyyao.............",
    ".........oayyyyyao..............",
    "..........oaaaaao...............",
    "...........ooooo................",
    "..........y.....y...............",
    ".........yy.....yy..............",
    "........yy.......yy.............",
    ".......oy.........yo............",
    "................................",
    "................................",
]
THUNDERBIRD_PAL = {
    "o": OUT, "a": (248, 224, 120), "b": (72, 112, 200),
    "B": (128, 176, 248), "c": (248, 160, 72),
    "y": (248, 176, 64), "k": EYE, "w": GLINT,
}

# --------------------------------------------------------------------------
# GOLEM - Physical. Temple guardian carved from riverstone.
# --------------------------------------------------------------------------
GOLEM = [
    "................................",
    "...oooooooooooooooooooooooo.....",
    "...oSSSSSSSSSSSSSSSSSSSSSSo.....",
    "...oSssssssssssssssssssssSo.....",
    "...oSssssrrrrrrrrrrssssssSo.....",
    "...oSsssrssssssssssrsssssSo.....",
    "...oSssssssssssssssssssssSo.....",
    "...oSsssyyyysssssssyyyyssso.....",
    "...oSsssywyysssssssywyyssso.....",
    "...oSsssyyyysssssssyyyyssso.....",
    "...oSssssssssssssssssssssso.....",
    "...oSsssssssrrrrrrrssssssSo.....",
    "...oSssssssssssssssssssssSo.....",
    "...oSssssoooooooooooossssSo.....",
    "...oSssssssssssssssssssssSo.....",
    "...oxxxxxxxxxxxxxxxxxxxxxxo.....",
    "....oooooooooooooooooooooo......",
    ".......oSSSSSSSSSSSSSSo.........",
    "..oooo.oSsssssssssssSo.oooo.....",
    ".oSSSo.oSssssssssssssSo.oSSSo...",
    ".oSsSo.oSssrrrrrrrssssSo.oSsSo..",
    ".oSsSo.oSsssssssssssssSo.oSsSo..",
    ".oSsSo.oSssssssssssssssSo.oSsSo.",
    ".oSsSo.oSsssssssssssssSo.oSsSo..",
    ".oxsxo.oSssssssssssssSo.oxsxo...",
    ".oxxxo.oxxxxxxxxxxxxxo..oxxxo...",
    "..ooo...ooooooooooooo....ooo....",
    "........oSSSSo.oSSSSo...........",
    "........oSssSo.oSssSo...........",
    "........oxxxxo.oxxxxo...........",
    "........oooooo.oooooo...........",
    "................................",
]
GOLEM_PAL = {
    "o": (48, 44, 60), "S": (176, 176, 192), "s": (128, 128, 152),
    "x": (88, 88, 112), "r": (96, 88, 116),
    "y": (120, 224, 200), "w": (224, 255, 248),
}

# --------------------------------------------------------------------------
# WISP - Fire/Dark. A grave-light that learned to smile.
# --------------------------------------------------------------------------
WISP = [
    "...............y................",
    "..............yy................",
    ".............yyy................",
    "............yyyy................",
    "...........yYYYYy...............",
    "..........yYYYYYYy..............",
    ".........yYYYYYYYYy.............",
    "........yYYYYaaYYYYy............",
    ".......yYYYaaaaaaYYYy...........",
    "......yYYaaaaaaaaaaYYy..........",
    "......yYaaaaaaaaaaaaYy..........",
    ".....yYaakkkkaakkkkaaYy.........",
    ".....yYaakwkkaakwkkaaYy.........",
    ".....yYaakkkkaakkkkaaYy.........",
    ".....yYaaaaaaaaaaaaaaYy.........",
    ".....yYaaaakkkkkkaaaaYy.........",
    ".....yYaaakwkkkkwkaaaYy.........",
    "......yYaaakkkkkkaaaYy..........",
    "......yYYaaaaaaaaaYYy...........",
    ".......yYYYaaaaaYYYy............",
    "........yYYYYYYYYYy.............",
    ".........yYYYYYYYy..............",
    "..........yYYYYYy...............",
    "...........yYYYy................",
    "..........yYYYYYy...............",
    ".........yYYYYYYYy..............",
    "..........yYYYYYy...............",
    "...........yYYYy................",
    "............yYy.................",
    ".............y..................",
    "................................",
    "................................",
]
WISP_PAL = {
    "y": (248, 176, 64), "Y": (248, 112, 56), "a": (88, 56, 112),
    "k": (248, 232, 176), "w": (255, 255, 255),
}

# --------------------------------------------------------------------------
# NAGA - Ice. Serpent priestess of the cold springs.
# --------------------------------------------------------------------------
NAGA = [
    "....oo..............oo..........",
    "...ohho............ohho.........",
    "..ohhho............ohhho........",
    "..ohhho..oooooooo..ohhho........",
    "..ohhho.oaaaaaaaao.ohhho........",
    "..ohhhooaaaaaaaaaaoohhho........",
    "..ohhhoaaaaaaaaaaaaohhho........",
    "...ohhoaaaaaaaaaaaaohho.........",
    "....oooaaaaaaaaaaaaooo..........",
    "......oaakkkkaakkkkao...........",
    "......oaakwkkaakwkkao...........",
    "......oaakkkkaakkkkao...........",
    "......oaaaaaaaaaaaaao...........",
    "......oaaaappaaaappao...........",
    ".......oaaaaammaaaao............",
    "........oaaaaaaaaao.............",
    "..........oaaaaao...............",
    ".........obbbbbbbo..............",
    "........obbbbbbbbbo.............",
    ".......obbbbbbbbbbbo............",
    "......obbbccccccbbbbo...........",
    ".....obbbcccccccccbbbo..........",
    "....obbbcccbbbbcccbbbbo.........",
    "...obbbcccbbbbbbcccbbbbo........",
    "..obbbcccbbbbbbbbcccbbbbo.......",
    "..obbcccbbbbbbbbbbcccbbbo.......",
    "..obcccbbbbbbbbbbbbcccbbo.......",
    "..obcccbbbbbbbbbbbbcccbbo.......",
    "...obcccbbbbbbbbbbcccbbo........",
    "....obbcccccccccccccbbo.........",
    ".....obbbbbbbbbbbbbbbo..........",
    "......oooooooooooooooo..........",
]
NAGA_PAL = {
    "o": (40, 48, 88), "a": (168, 224, 248), "b": (96, 152, 224),
    "c": (56, 96, 176), "h": (136, 200, 248),
    "k": EYE, "w": GLINT, "p": (168, 200, 248), "m": (72, 96, 160),
}

# --------------------------------------------------------------------------
# TENGU - Wind. Mountain goblin, enormous nose, enormous opinions.
# --------------------------------------------------------------------------
TENGU = [
    "................................",
    ".........oooooooooooo...........",
    "........okkkkkkkkkkkko..........",
    ".......okkkkkkkkkkkkkko.........",
    "......okkkkkkkkkkkkkkkko........",
    "ww....oaaaaaaaaaaaaaaaao....ww..",
    "wWw...oaaaaaaaaaaaaaaaao...wWw..",
    "wWWw..oaaaaaaaaaaaaaaaao..wWWw..",
    "wWWWw.oaaeeeeaaaaeeeeaao.wWWWw..",
    "wWWWw.oaaewwkaaaaewwkaao.wWWWw..",
    "wWWWw.oaaeeeeaaaaeeeeaao.wWWWw..",
    "wWWWw.oaaaaaaannaaaaaaao.wWWWw..",
    "wWWWw.oaaaaaannnnaaaaaao.wWWWw..",
    "wWWWw.oaaaaaannnnaaaaaao.wWWWw..",
    ".wWWw.oaaaaaannnnaaaaaao.wWWw...",
    "..wWw..oaaaaannnnaaaaao..wWw....",
    "...ww..oaaaaaammaaaaaao..ww.....",
    "........oaaaaaaaaaaao...........",
    "..........oaaaaaaao.............",
    ".........obbbbbbbbbo............",
    "........obbbbbbbbbbbo...........",
    ".......obbbbbbbbbbbbbo..........",
    ".......obbbccccccbbbbo..........",
    "....a..obbbccccccbbbbo..a.......",
    "...aa..obbbbbbbbbbbbbo..aa......",
    "..aa....obbbbbbbbbbbo....aa.....",
    "..a......obbbbbbbbbo......a.....",
    "..........oaaaaaaao.............",
    ".........oaaao.oaaao............",
    ".........okkko.okkko............",
    ".........ooooo.ooooo............",
    "................................",
]
TENGU_PAL = {
    "o": (40, 34, 52), "a": (232, 120, 96), "b": (72, 96, 152),
    "c": (48, 64, 112), "e": (248, 240, 232), "k": (48, 44, 64),
    "n": (200, 72, 64), "m": (120, 40, 40),
    "w": (64, 60, 84), "W": (104, 100, 132),
}

# --------------------------------------------------------------------------
# MANDRAKE - Wind. A screaming root that has never hurt anybody. Yet.
# --------------------------------------------------------------------------
MANDRAKE = [
    "................................",
    ".....gg......gg.......gg........",
    "....gGGg....gGGg.....gGGg.......",
    "....gGGGg..gGGGGg...gGGGg.......",
    ".....gGGGggGGGGGGggGGGGg........",
    "......gGGGGGGGGGGGGGGGg.........",
    ".......ggGGGGGGGGGGGgg..........",
    ".........ggggrrgggg.............",
    "..........oorrrroo..............",
    ".......ooaaaaaaaaaaoo...........",
    ".....ooaaaaaaaaaaaaaaoo.........",
    "....oaaaaaaaaaaaaaaaaaao........",
    "...oaaaaaaaaaaaaaaaaaaaao.......",
    "...oaaakkkaaaaaaaaakkkaao.......",
    "...oaakwkkkaaaaaakwkkkaao.......",
    "...oaaakkkaaaaaaaaakkkaao.......",
    "...oaaaaaaaaaaaaaaaaaaaao.......",
    "...oaaaaapppaaaapppaaaaao.......",
    "....oaaaaaaakkkkaaaaaaao........",
    "....oaaaaaakwwwwkaaaaaao........",
    ".....oaaaaakkkkkkaaaaao.........",
    "......oaaaaaaaaaaaaaao..........",
    ".......ooaaaaaaaaaaoo...........",
    ".........oaaaaaaaao.............",
    "........oaaaaaaaaaao............",
    ".......oaabbbbbbbbaao...........",
    "......oaabbbbbbbbbbaao..........",
    ".....oaabbbbbbbbbbbbaao.........",
    "......obbbbbbbbbbbbbbo..........",
    ".......obbbbbbbbbbbbo...........",
    "........oobbbbbbbboo............",
    "..........oooooooo..............",
]
MANDRAKE_PAL = {
    "o": (72, 56, 40), "a": (232, 208, 152), "b": (200, 172, 112),
    "g": (72, 152, 72), "G": (128, 200, 96), "r": (160, 136, 88),
    "k": (64, 48, 40), "w": GLINT, "p": (232, 168, 152),
}

# --------------------------------------------------------------------------
# CERBERUS - Fire. Three heads, one very small dog brain.
# --------------------------------------------------------------------------
CERBERUS = [
    "...o..........oo..........o.....",
    "..oro........orro........oro....",
    "..oro..ooo...orro...ooo..oro....",
    "..orroooaoo.orrro..ooaooorro....",
    "..oaaaaaaaaooaaaaooaaaaaaaao....",
    "..oaayyaaaaoaaaaaaoaaaayyaao....",
    "..oaywyaaaaoayyayyoaaaaywyao....",
    "..oayyyaaaaoaywywyoaaaayyyao....",
    "..oaaaaaaaaoayyayyoaaaaaaaao....",
    "..oaaammaaaoaaaaaaoaaaammaao....",
    "...oaammmaaoaammaaoaammmaao.....",
    "...ooammaaooaammmaooaammaoo.....",
    "....ooaaaoo.oammmao.ooaaaoo.....",
    "......ooo...ooaaaoo...ooo.......",
    "..............ooo...............",
    "........ooooooooooooooo.........",
    ".......oaaaaaaaaaaaaaaao........",
    "......oaaaaaaaaaaaaaaaaao.......",
    ".....oaaaaayyyyyyyaaaaaaao......",
    ".....oaaaayyyyyyyyyaaaaaao......",
    ".....oaaaaayyyyyyyaaaaaaao......",
    ".....oaaaaaaaaaaaaaaaaaaao......",
    ".....oaaaaaaaaaaaaaaaaaao.......",
    "......oaaaaaaaaaaaaaaaao........",
    ".......oaaaaaaaaaaaaaao.........",
    "......oaaaoo.oooo.ooaaao........",
    "......oaaao..oaao..oaaao........",
    "......oaaao..oaao..oaaao........",
    "......oyyyo..oyyo..oyyyo........",
    "......ooooo..oooo..ooooo........",
    "................................",
    "................................",
]
CERBERUS_PAL = {
    "o": (32, 28, 44), "a": (72, 64, 96), "b": (48, 44, 72),
    "r": (200, 72, 56), "y": (248, 152, 64), "w": (255, 240, 200),
    "m": (232, 232, 240),
}

# --------------------------------------------------------------------------
# BAKU - Dark. Eats bad dreams. Also good dreams. Also sandwiches.
# --------------------------------------------------------------------------
BAKU = [
    "................................",
    "....oooo..............oooo......",
    "...opppo..............opppo.....",
    "...opppo..oooooooo....opppo.....",
    "...oppoooaaaaaaaaaoooopppo......",
    "....oooaaaaaaaaaaaaaoooooo......",
    "....oaaaaaaaaaaaaaaaaao.........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaakkkkkaaaaakkkkkaao........",
    "...oaakkkkkaaaaakkkkkaao........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaaappaaaaaaaaappaaao........",
    "....oaaaaaaaaaaaaaaaaao.........",
    "....oaaaaaaabbbbaaaaaao.........",
    ".....oaaaaabbbbbbaaaao..........",
    "......oaaaabbbbbbaaao...........",
    ".......oaaabbbbbbaao............",
    "........oaabbbbbbao.............",
    ".......oaaabbbbbbaao............",
    "......oaaaaabbbbaaaao...........",
    ".....oaaaaaaaaaaaaaaao..........",
    "....oaaaaaaaaaaaaaaaaao.........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "...oaaaaaaaaaaaaaaaaaaao........",
    "....oaaaaaaaaaaaaaaaaao.........",
    "....oaaaoooaaaaoooaaaao.........",
    "....oaaao.oaaaao.oaaaao.........",
    "....ooooo.ooooooo.ooooo.........",
    "................................",
]
BAKU_PAL = {
    "o": (40, 32, 56), "a": (144, 112, 200), "b": (96, 72, 152),
    "p": (200, 160, 232), "k": (40, 32, 56),
}

# --------------------------------------------------------------------------
# ANUBIS - Light. Weighs your heart. Finds it wanting.
# --------------------------------------------------------------------------
ANUBIS = [
    "...oo..................oo.......",
    "..ojjo................ojjo......",
    "..ojjjo..............ojjjo......",
    "..ojjjjo............ojjjjo......",
    "..ojjjjjo..........ojjjjjo......",
    "..ojjjjjoooooooooooojjjjjo......",
    "..ojjjjjoaaaaaaaaaaojjjjjo......",
    "...ojjjjoaaaaaaaaaaojjjjo.......",
    "....ojjjoaaaaaaaaaaojjjo........",
    ".....ooooaaaaaaaaaaoooo.........",
    "........oayyyaayyyao............",
    "........oaywyaaywyao............",
    "........oayyyaayyyao............",
    "........oaaaaaaaaaao............",
    "........oaaaaaaaaaao............",
    ".........oaaammaaao.............",
    ".........oaaammaaao.............",
    ".........ooaaaaaaoo.............",
    "......ggggggoooggggggg..........",
    ".....gGGGGGGGGGGGGGGGGg.........",
    "....gGGbbbbbbbbbbbbbbGGg........",
    "....gGbbbbbbbbbbbbbbbbGg........",
    ".....ggbbbbbbbbbbbbbbgg.........",
    "......obbbbbbbbbbbbbbo..........",
    ".....obbbbbbGGGGbbbbbbo.........",
    "....obbbbbbGGGGGGbbbbbbo........",
    "....obbbbbbbGGGGbbbbbbbo........",
    "....obbbbbbbbbbbbbbbbbbo........",
    "....obbbbbbbbbbbbbbbbbbo........",
    ".....obbbbbo....obbbbbo.........",
    ".....ogggggo....ogggggo.........",
    ".....ooooooo....ooooooo.........",
]
ANUBIS_PAL = {
    "o": (32, 28, 40), "a": (56, 52, 72), "b": (40, 36, 56),
    "j": (48, 44, 64), "g": (216, 176, 72), "G": (248, 224, 128),
    "y": (248, 216, 96), "w": (255, 255, 255), "m": (200, 200, 216),
}

# --------------------------------------------------------------------------

ART = {
    "pixie": (PIXIE, PIXIE_PAL),
    "kitsune": (KITSUNE, KITSUNE_PAL),
    "kappa": (KAPPA, KAPPA_PAL),
    "thunderbird": (THUNDERBIRD, THUNDERBIRD_PAL),
    "golem": (GOLEM, GOLEM_PAL),
    "wisp": (WISP, WISP_PAL),
    "naga": (NAGA, NAGA_PAL),
    "tengu": (TENGU, TENGU_PAL),
    "mandrake": (MANDRAKE, MANDRAKE_PAL),
    "cerberus": (CERBERUS, CERBERUS_PAL),
    "baku": (BAKU, BAKU_PAL),
    "anubis": (ANUBIS, ANUBIS_PAL),
}

_cache = {}


def sprite(key):
    """Return (and memoise) the 32x32 surface for a species art key."""
    if key not in _cache:
        rows, pal = ART[key]
        _cache[key] = make(rows, pal)
    return _cache[key]
