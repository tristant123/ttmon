"""Monster sprites, 32x32, hand-authored.

House style: chibi proportions (head roughly half the sprite), heavy dark
outlines, two-tone shading, and a single white glint in each eye. The species
are drawn from world mythology and deliberately kept cute so the brutal
combat system lands as a contrast rather than a warning.
"""

from . import shading
from .shading import M

# Shared materials. Eyes and glints are flat - light must not bevel them.
EYE = M((38, 32, 52), "gem", flat=True)
GLINT = M((255, 255, 255), "gem", flat=True)
BLUSH = M((246, 150, 158), "skin")
TEETH = M((250, 246, 238), "cloth")


def C(row, off=0, w=32):
    """Centre a run of material characters in a 32-wide line.

    Authoring sprites as centred content instead of counting dots either side
    removes the whole class of off-by-one errors, and makes a silhouette easy
    to read in source."""
    pad = w - len(row)
    left = max(0, min(pad, pad // 2 + off))
    return "." * left + row + "." * (w - left - len(row))

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
    "o": M((64, 52, 92), "cloth", outline=(44, 34, 64)),
    "a": M((252, 222, 194), "skin"),
    "b": M((228, 186, 162), "skin"),
    "d": M((116, 206, 128), "plant"),
    "e": M((62, 148, 88), "plant"),
    "m": M((248, 248, 240), "cloth"),
    "n": M((200, 226, 234), "cloth"),
    "g": M((92, 198, 190), "gem", emissive=0.25),
    "h": M((176, 240, 224), "gem", emissive=0.35),
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
    "o": M((96, 54, 36), "fur", outline=(58, 30, 24)),
    "a": M((244, 148, 62), "fur"),
    "b": M((208, 102, 44), "fur"),
    "i": M((248, 186, 188), "skin"),
    "m": M((250, 240, 228), "fur"),
    "t": M((212, 106, 44), "fur"),
    "u": M((250, 186, 106), "fur"),
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
    "o": M((40, 72, 52), "scale", outline=(26, 52, 40)),
    "a": M((138, 204, 128), "scale"),
    "b": M((96, 162, 104), "scale"),
    "s": M((92, 156, 98), "scale"),
    "g": M((54, 112, 78), "scale"),
    "w": M((150, 216, 250), "gem", emissive=0.3),
    "W": M((206, 242, 255), "gem", emissive=0.45),
    "y": M((250, 220, 126), "scale"),
    "k": EYE,
}

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
    "o": M((120, 88, 32), "fur", outline=(74, 52, 24)),
    "a": M((250, 224, 118), "fur"),
    "b": M((70, 112, 202), "fur"),
    "B": M((130, 178, 250), "fur"),
    "c": M((250, 160, 70), "fur"),
    "y": M((250, 176, 62), "scale"),
    "k": EYE, "w": GLINT,
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
    "o": M((44, 42, 58), "stone", outline=(28, 26, 40)),
    "S": M((188, 188, 204), "stone"),
    "s": M((138, 138, 162), "stone"),
    "x": M((92, 92, 118), "stone"),
    "r": M((104, 94, 126), "stone"),
    "y": M((120, 226, 200), "gem", emissive=0.65),
    "w": M((232, 255, 250), "gem", emissive=0.85),
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
    "y": M((250, 186, 76), "flame", emissive=0.7),
    "Y": M((248, 110, 54), "flame", emissive=0.5),
    "a": M((86, 54, 112), "cloth"),
    "k": M((250, 234, 180), "gem", flat=True),
    "w": GLINT,
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
    "o": M((34, 46, 92), "scale", outline=(22, 32, 68)),
    "a": M((172, 226, 250), "skin"),
    "b": M((96, 154, 226), "scale"),
    "c": M((52, 96, 178), "scale"),
    "h": M((136, 202, 250), "scale"),
    "m": M((70, 96, 162), "skin"),
    "k": EYE, "w": GLINT, "p": M((170, 202, 250), "skin"),
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
    "o": M((74, 30, 30), "skin", outline=(44, 22, 26)),
    "a": M((234, 118, 94), "skin"),
    "b": M((72, 98, 154), "cloth"),
    "c": M((46, 64, 114), "cloth"),
    "e": M((250, 242, 234), "cloth"),
    "k": M((46, 42, 62), "gem", flat=True),
    "n": M((202, 70, 62), "skin"),
    "m": M((118, 38, 38), "skin"),
    "w": M((62, 58, 82), "fur"),
    "W": M((106, 102, 134), "fur"),
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
    "o": M((92, 66, 42), "plant", outline=(58, 42, 28)),
    "a": M((236, 210, 152), "plant"),
    "b": M((202, 172, 110), "plant"),
    "g": M((66, 150, 70), "plant"),
    "G": M((130, 204, 96), "plant"),
    "r": M((162, 136, 86), "plant"),
    "k": M((62, 46, 38), "gem", flat=True),
    "w": GLINT, "p": M((234, 168, 150), "skin"),
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
    "o": M((30, 26, 42), "fur", outline=(20, 18, 30)),
    "a": M((76, 68, 100), "fur"),
    "b": M((50, 46, 74), "fur"),
    "r": M((206, 70, 54), "fur"),
    "y": M((250, 154, 62), "flame", emissive=0.45),
    "w": M((255, 242, 202), "gem", flat=True),
    "m": TEETH,
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
    "o": M((44, 34, 60), "fur", outline=(28, 22, 40)),
    "a": M((148, 114, 204), "fur"),
    "b": M((98, 72, 154), "fur"),
    "p": M((204, 162, 234), "skin"),
    "k": M((44, 34, 60), "gem", flat=True),
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
    "o": M((30, 26, 40), "fur", outline=(18, 16, 26)),
    "a": M((58, 54, 76), "fur"),
    "b": M((42, 38, 60), "fur"),
    "j": M((50, 46, 68), "fur"),
    "g": M((220, 178, 72), "metal"),
    "G": M((250, 226, 132), "metal"),
    "y": M((250, 218, 98), "gem", emissive=0.55),
    "w": GLINT,
    "m": M((202, 202, 218), "metal"),
}

# --------------------------------------------------------------------------



# ===========================================================================
# GREEK AND ROMAN MYTHOLOGY
#
# Authored as flat material zones; shading.py does the lighting. Forms are
# centred with C() and kept to chunky, readable silhouettes.
# ===========================================================================

# --------------------------------------------------------------------------
# MINOTAUR - Physical. Furious, cornered, and not sure why.
# --------------------------------------------------------------------------
MINOTAUR = [
    C(""),
    C("hh" + "." * 22 + "hh"),
    C("hhh" + "." * 20 + "hhh"),
    C("hhh" + "." * 20 + "hhh"),
    C("hhh" + "." * 20 + "hhh"),
    C("hhh..." + "f" * 10 + "...hhh"),
    C("hh.." + "f" * 14 + "..hh"),
    C("f" * 16),
    C("f" * 16),
    C("ff" + "kkk" + "ffffff" + "kkk" + "ff"),
    C("ff" + "kwk" + "ffffff" + "kwk" + "ff"),
    C("f" * 16),
    C("fff" + "F" * 10 + "fff"),
    C("fff" + "FF" + "nn" + "FF" + "nn" + "FF" + "fff"),
    C("fff" + "F" * 10 + "fff"),
    C("fff" + "FF" + "mmmmmm" + "FF" + "fff"),
    C("ff" + "F" * 12 + "ff"),
    C("ff" + "F" * 10 + "ff"),
    C("f" * 12),
    C("f" * 16),
    C("ff" + "f" * 16 + "ff"),
    C("fff" + "F" * 14 + "fff"),
    C("fff" + "F" * 14 + "fff"),
    C("fff" + "F" * 14 + "fff"),
    C("ffff" + "F" * 12 + "ffff"),
    C("fff" + "c" * 14 + "fff"),
    C("fff" + "c" * 14 + "fff"),
    C("ff" + "c" * 16 + "ff"),
    C("ffff" + "." * 4 + "ffff", off=-1),
    C("ffff" + "." * 4 + "ffff", off=-1),
    C("hhhh" + "." * 4 + "hhhh", off=-1),
    C("hhhh" + "." * 4 + "hhhh", off=-1),
]
MINOTAUR_MAT = {
    "f": M((132, 86, 56), "fur"),
    "F": M((196, 152, 108), "fur"),
    "h": M((226, 214, 186), "stone"),
    "c": M((178, 54, 48), "cloth"),
    "n": M((92, 58, 40), "skin"),
    "m": M((72, 44, 34), "skin"),
    "k": M((236, 92, 60), "gem", emissive=0.5, flat=True),
    "w": GLINT,
}

# --------------------------------------------------------------------------
# MEDUSA - Dark. Her hair is friendlier than she is.
# --------------------------------------------------------------------------
MEDUSA = [
    C("nn...nn...nn"),
    C("nNn..nNn..nNn"),
    C("nnn.nnnnn.nnn"),
    C("nn" + "n" * 12 + "nn"),
    C("n" * 20),
    C("nnnn" + "s" * 12 + "nnnn"),
    C("nnn" + "s" * 12 + "nnn"),
    C("nn" + "s" * 12 + "nn"),
    C("n" + "s" * 14 + "n"),
    C("s" + "kkk" + "ssss" + "kkk" + "s"),
    C("s" + "k+k" + "ssss" + "k+k" + "s"),
    C("s" * 12),
    C("ss" + "SSSS" + "ss"),
    C("sss" + "mm" + "sss"),
    C("s" * 10),
    C("s" * 8),
    C("c" * 12),
    C("c" + "C" * 10 + "c"),
    C("cc" + "C" * 10 + "cc"),
    C("t" * 14),
    C("tt" + "T" * 10 + "tt"),
    C("ttt" + "T" * 8 + "ttt" + "tt", off=2),
    C("tt" + "T" * 8 + "tttttt", off=3),
    C("t" * 16, off=3),
    C("ttttt" + "T" * 8 + "ttt", off=-2),
    C("tt" + "T" * 10 + "tt", off=-4),
    C("t" * 16, off=-3),
    C("tttt" + "T" * 10 + "tttt", off=1),
    C("tt" + "T" * 14 + "tt", off=2),
    C("t" * 20, off=1),
    C("t" * 14, off=1),
    C(""),
]
MEDUSA_MAT = {
    "n": M((62, 132, 86), "scale"),
    "N": M((122, 196, 128), "scale"),
    "s": M((176, 212, 158), "skin"),
    "S": M((206, 232, 186), "skin"),
    "m": M((128, 60, 76), "skin"),
    "c": M((104, 70, 132), "cloth"),
    "C": M((150, 112, 186), "cloth"),
    "t": M((70, 146, 110), "scale"),
    "T": M((136, 206, 146), "scale"),
    "k": M((248, 212, 96), "gem", emissive=0.45, flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# HARPY - Wind. Shrieks first, considers later.
# --------------------------------------------------------------------------
HARPY = [
    C("cc"),
    C("cCc"),
    C("cCCc"),
    C("f" * 10),
    C("f" * 14),
    C("ff" + "s" * 10 + "ff"),
    C("f" + "s" * 12 + "f"),
    C("s" * 14),
    C("s" + "kkk" + "ss" + "b" * 2 + "ss" + "kkk" + "s"),
    C("s" + "k+k" + "ss" + "bb" + "ss" + "k+k" + "s"),
    C("s" * 6 + "bb" + "s" * 6),
    C("s" * 14),
    C("f" * 12),
    C("ww" + "f" * 10 + "ww"),
    C("www" + "f" * 10 + "www"),
    C("wwww" + "F" * 10 + "wwww"),
    C("Wwwww" + "F" * 10 + "wwwW"),
    C("WWwww" + "F" * 10 + "wwWW"),
    C("WWwwww" + "F" * 8 + "wwwWW"),
    C("WWWww" + "F" * 8 + "wwWWW"),
    C("WWWw" + "f" * 8 + "wWWW"),
    C("WWW" + "f" * 8 + "WWW"),
    C("WW" + "f" * 8 + "WW"),
    C("W" + "f" * 8 + "W"),
    C("f" * 8),
    C("ff" + ".." + "ff"),
    C("bb" + ".." + "bb"),
    C("bb" + ".." + "bb"),
    C("bbbb.bbbb"),
    C("bbbb.bbbb"),
    C(""),
    C(""),
]
HARPY_MAT = {
    "f": M((196, 124, 72), "fur"),
    "F": M((238, 206, 160), "fur"),
    "w": M((150, 92, 62), "fur"),
    "W": M((110, 66, 48), "fur"),
    "s": M((250, 218, 186), "skin"),
    "c": M((236, 180, 90), "fur"),
    "C": M((250, 226, 150), "fur"),
    "b": M((248, 190, 70), "scale"),
    "k": M((42, 36, 58), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# CYCLOPS - Physical. One eye, and a blind side to match.
# --------------------------------------------------------------------------
CYCLOPS = [
    C(""),
    C("s" * 12),
    C("s" * 16),
    C("s" * 18),
    C("ss" + "S" * 14 + "ss"),
    C("s" + "S" * 16 + "s"),
    C("s" + "S" * 18 + "s"),
    C("s" + "S" * 18 + "s"),
    C("ss" + "S" * 2 + "eeeeeeeeee" + "S" * 2 + "ss"),
    C("ss" + "S" * 2 + "ee++pppeee" + "S" * 2 + "ss"),
    C("ss" + "S" * 2 + "eeepppeeee" + "S" * 2 + "ss"),
    C("ss" + "S" * 2 + "eeepppeeee" + "S" * 2 + "ss"),
    C("ss" + "S" * 2 + "eeeeeeeeee" + "S" * 2 + "ss"),
    C("s" + "S" * 18 + "s"),
    C("ss" + "S" * 6 + "mmmm" + "S" * 6 + "ss"),
    C("s" * 20),
    C("s" * 16),
    C("s" * 10),
    C("aa" + "s" * 12 + "aa"),
    C("aaa" + "c" * 12 + "aaa"),
    C("aaa" + "c" * 12 + "aaa"),
    C("aaa" + "c" + "S" * 10 + "c" + "aaa"),
    C("aaa" + "c" + "S" * 10 + "c" + "aaa"),
    C("aaa" + "c" * 12 + "aaa"),
    C("aa" + "c" * 14 + "aa"),
    C("a" + "c" * 16 + "a"),
    C("ss" + "c" * 14 + "ss"),
    C("s" * 18),
    C("ssss" + "...." + "ssss", off=-1),
    C("ssss" + "...." + "ssss", off=-1),
    C("sss" + "......" + "sss", off=-1),
    C(""),
]
CYCLOPS_MAT = {
    "s": M((206, 158, 116), "skin"),
    "S": M((238, 200, 158), "skin"),
    "a": M((190, 142, 104), "skin"),
    "c": M((126, 106, 88), "cloth"),
    "m": M((124, 62, 58), "skin"),
    "e": M((248, 248, 244), "gem"),
    "p": M((46, 38, 60), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# PEGASUS - Wind. Insufferably graceful.
# --------------------------------------------------------------------------
PEGASUS = [
    C("mm", off=-4),
    C("mmm", off=-4),
    C("f" * 6, off=-4),
    C("ff" + "mm" + "ff", off=-4),
    C("ff" + "m" * 4 + "ff", off=-3),
    C("fff" + "m" * 4 + "ff", off=-3),
    C("ff" + "kk" + "f" + "m" * 4 + "f", off=-3),
    C("ff" + "k+" + "f" + "m" * 4, off=-3),
    C("f" * 6 + "m" * 4, off=-3),
    C("f" * 5 + "m" * 5, off=-2),
    C("ff" + "f" * 4 + "m" * 5, off=-1),
    C("wwww" + "f" * 6 + "m" * 4, off=0),
    C("Wwwwww" + "f" * 8 + "mm", off=0),
    C("WWwwwww" + "f" * 10, off=0),
    C("WWWwwwww" + "f" * 10, off=1),
    C("WWWWwwww" + "f" * 12, off=1),
    C("WWWWwww" + "f" * 14, off=1),
    C("WWWww" + "f" * 16, off=1),
    C("WWw" + "f" * 18, off=1),
    C("W" + "f" * 18, off=1),
    C("f" * 18, off=1),
    C("f" * 18, off=1),
    C("f" * 4 + "FFFFFFFFFF" + "f" * 4, off=1),
    C("f" * 4 + "FFFFFFFFFF" + "f" * 4, off=1),
    C("f" * 3 + ".." + "f" * 4 + ".." + "f" * 3, off=1),
    C("ff" + "..." + "fff" + "..." + "ff", off=1),
    C("ff" + "..." + "fff" + "..." + "ff", off=1),
    C("ff" + "..." + "fff" + "..." + "ff", off=1),
    C("hh" + "..." + "hhh" + "..." + "hh", off=1),
    C("hh" + "..." + "hhh" + "..." + "hh", off=1),
    C(""),
    C(""),
]
PEGASUS_MAT = {
    "f": M((246, 246, 250), "fur"),
    "F": M((216, 220, 236), "fur"),
    "w": M((226, 232, 250), "fur"),
    "W": M((188, 200, 232), "fur"),
    "m": M((250, 216, 124), "fur"),
    "h": M((198, 190, 176), "stone"),
    "k": M((70, 96, 150), "gem", flat=True),
    "+": GLINT,
}


# --------------------------------------------------------------------------
# CHIMERA - Fire. Three animals, one very bad mood.
# --------------------------------------------------------------------------
CHIMERA = [
    C(""),
    C("hh......hh", off=-3),
    C("hhh....hhh", off=-3),
    C("F" * 12, off=-3),
    C("FF" + "f" * 10 + "FF", off=-3),
    C("F" + "f" * 14 + "F", off=-2),
    C("F" + "f" * 14 + "F", off=-2),
    C("f" + "kkk" + "ff" + "kkk" + "f", off=-2),
    C("f" + "k+k" + "ff" + "k+k" + "f", off=-2),
    C("ff" + "m" * 6 + "ff", off=-2),
    C("ff" + "m" + "yy" + "m" + "ff", off=-2),
    C("FF" + "f" * 8 + "FF", off=-2),
    C("FFF" + "f" * 8 + "FFF", off=-1),
    C("FFF" + "f" * 10 + "FF", off=0),
    C("FF" + "f" * 14 + "F", off=1),
    C("F" + "f" * 16 + "ss", off=1),
    C("f" * 16 + "sss", off=2),
    C("f" * 16 + "ssS", off=2),
    C("f" * 18 + "ss", off=2),
    C("f" * 18 + "s", off=2),
    C("f" * 4 + "F" * 10 + "f" * 4 + "s", off=2),
    C("f" * 4 + "F" * 10 + "f" * 4 + "ss", off=2),
    C("f" * 18 + "sS", off=2),
    C("f" * 18 + "ss", off=2),
    C("f" * 3 + ".." + "f" * 4 + ".." + "f" * 3, off=1),
    C("ff" + "..." + "ff" + "..." + "ff", off=1),
    C("ff" + "..." + "ff" + "..." + "ff", off=1),
    C("cc" + "..." + "cc" + "..." + "cc", off=1),
    C("cc" + "..." + "cc" + "..." + "cc", off=1),
    C(""),
    C(""),
    C(""),
]
CHIMERA_MAT = {
    "f": M((214, 154, 76), "fur"),
    "F": M((232, 120, 52), "fur"),
    "m": M((246, 216, 174), "fur"),
    "h": M((228, 218, 192), "stone"),
    "s": M((96, 170, 104), "scale"),
    "S": M((152, 214, 140), "scale"),
    "c": M((90, 70, 54), "scale"),
    "y": M((250, 168, 60), "flame", emissive=0.65),
    "k": M((44, 36, 56), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# SATYR - Wind. Plays the pipes. Will not stop playing the pipes.
# --------------------------------------------------------------------------
SATYR = [
    C(""),
    C("hh" + "." * 8 + "hh"),
    C("hhh" + "." * 6 + "hhh"),
    C("hhh" + "cccccc" + "hhh"),
    C("hh" + "c" * 10 + "hh"),
    C("c" * 14),
    C("cc" + "s" * 10 + "cc"),
    C("c" + "s" * 12 + "c"),
    C("s" * 14),
    C("s" + "kkk" + "ssss" + "kkk" + "s"),
    C("s" + "k+k" + "ssss" + "k+k" + "s"),
    C("s" * 14),
    C("ss" + "S" * 4 + "ss", off=0),
    C("ss" + "mm" + "ss"),
    C("cc" + "s" * 6 + "cc"),
    C("s" * 12),
    C("ss" + "S" * 8 + "ss"),
    C("p" + "s" * 12 + "p"),
    C("pp" + "S" * 10 + "pp"),
    C("pp" + "S" * 10 + "pp"),
    C("pp" + "s" * 10 + "pp"),
    C("p" + "s" * 12 + "p"),
    C("f" * 14),
    C("f" * 14),
    C("ff" + "F" * 10 + "ff"),
    C("ff" + "F" * 10 + "ff"),
    C("fff" + "..." + "fff", off=-1),
    C("fff" + "..." + "fff", off=-1),
    C("fff" + "..." + "fff", off=-1),
    C("hhh" + "..." + "hhh", off=-1),
    C("hhh" + "..." + "hhh", off=-1),
    C(""),
]
SATYR_MAT = {
    "s": M((246, 208, 168), "skin"),
    "S": M((226, 180, 140), "skin"),
    "c": M((146, 96, 56), "fur"),
    "f": M((120, 84, 52), "fur"),
    "F": M((166, 126, 84), "fur"),
    "h": M((222, 210, 184), "stone"),
    "m": M((140, 70, 70), "skin"),
    "p": M((196, 150, 84), "plant"),
    "k": M((46, 38, 58), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# NEMEAN LION - Physical. Its hide has never once been cut.
# --------------------------------------------------------------------------
NEMEAN = [
    C(""),
    C("F" * 10),
    C("F" * 16),
    C("F" * 20),
    C("FF" + "f" * 18 + "FF"),
    C("F" + "f" * 20 + "F"),
    C("F" + "f" * 20 + "F"),
    C("F" + "ff" + "kkk" + "ffff" + "kkk" + "ff" + "F"),
    C("F" + "ff" + "k+k" + "ffff" + "k+k" + "ff" + "F"),
    C("F" + "f" * 20 + "F"),
    C("F" + "fff" + "m" * 8 + "fff" + "F"),
    C("F" + "fff" + "m" + "nn" + "m" * 3 + "nn" + "m" + "fff" + "F"),
    C("FF" + "ff" + "m" * 10 + "ff" + "FF"),
    C("FFF" + "f" * 14 + "FFF"),
    C("FFFF" + "f" * 12 + "FFFF"),
    C("FFFFF" + "f" * 10 + "FFFFF"),
    C("FFFF" + "f" * 12 + "FFFF"),
    C("FFF" + "f" * 14 + "FFF"),
    C("FF" + "f" * 16 + "FF"),
    C("f" * 20),
    C("f" * 20),
    C("ff" + "M" * 16 + "ff"),
    C("ff" + "M" * 16 + "ff"),
    C("f" * 20),
    C("f" * 20),
    C("fff" + "..." + "ffff" + "..." + "fff"),
    C("fff" + "..." + "ffff" + "..." + "fff"),
    C("fff" + "..." + "ffff" + "..." + "fff"),
    C("ccc" + "..." + "cccc" + "..." + "ccc"),
    C("ccc" + "..." + "cccc" + "..." + "ccc"),
    C(""),
    C(""),
]
NEMEAN_MAT = {
    "f": M((226, 178, 88), "fur"),
    "F": M((186, 124, 52), "fur"),
    "M": M((240, 208, 140), "fur"),
    "m": M((248, 228, 188), "fur"),
    "n": M((110, 76, 52), "skin"),
    "c": M((238, 232, 214), "stone"),
    "k": M((88, 168, 92), "gem", emissive=0.3, flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# SIREN - Ice. The song is the dangerous part.
# --------------------------------------------------------------------------
SIREN = [
    C("hh" + "." * 8 + "hh"),
    C("hhh" + "h" * 6 + "hhh"),
    C("h" * 14),
    C("hh" + "H" * 10 + "hh"),
    C("hh" + "s" * 10 + "hh"),
    C("h" + "s" * 12 + "h"),
    C("h" + "s" * 12 + "h"),
    C("h" + "s" + "kkk" + "ss" + "kkk" + "s" + "h"),
    C("h" + "s" + "k+k" + "ss" + "k+k" + "s" + "h"),
    C("h" + "s" * 12 + "h"),
    C("h" + "ss" + "S" * 4 + "ss" + "h", off=0),
    C("hh" + "ss" + "mm" + "ss" + "hh"),
    C("hh" + "s" * 8 + "hh"),
    C("hhh" + "s" * 6 + "hhh"),
    C("hh" + "c" * 8 + "hh"),
    C("h" + "cc" + "S" * 4 + "cc" + "h"),
    C("cc" + "s" * 8 + "cc"),
    C("c" + "s" * 10 + "c"),
    C("t" * 12),
    C("tt" + "T" * 8 + "tt"),
    C("tt" + "T" * 10 + "tt", off=1),
    C("t" * 14, off=2),
    C("tt" + "T" * 8 + "tt", off=3),
    C("t" * 12, off=3),
    C("tt" + "T" * 6 + "tt", off=2),
    C("t" * 10, off=1),
    C("t" * 8),
    C("tt" + "TT" + "tt"),
    C("t" * 4 + "T" * 4 + "t" * 4),
    C("tt" + "T" * 8 + "tt"),
    C("t" * 14),
    C("t" * 10),
]
SIREN_MAT = {
    "s": M((242, 226, 226), "skin"),
    "S": M((216, 198, 206), "skin"),
    "h": M((76, 152, 168), "fur"),
    "H": M((122, 202, 212), "fur"),
    "c": M((214, 178, 126), "stone"),
    "t": M((70, 128, 202), "scale"),
    "T": M((132, 196, 244), "scale"),
    "m": M((166, 92, 108), "skin"),
    "k": M((52, 92, 140), "gem", flat=True),
    "+": GLINT,
}

# --------------------------------------------------------------------------
# TALOS - Physical/Electric. Bronze, tireless, and slightly leaking.
# --------------------------------------------------------------------------
TALOS = [
    C(""),
    C("d" * 10),
    C("b" * 14),
    C("b" + "B" * 12 + "b"),
    C("b" + "B" * 12 + "b"),
    C("b" + "B" * 12 + "b"),
    C("b" + "B" + "yyy" + "BB" + "yyy" + "B" + "b"),
    C("b" + "B" + "y+y" + "BB" + "y+y" + "B" + "b"),
    C("b" + "B" * 12 + "b"),
    C("b" + "B" * 3 + "dddddd" + "B" * 3 + "b"),
    C("bb" + "B" * 10 + "bb"),
    C("b" * 14),
    C("d" * 6),
    C("d" * 6),
    C("bbb" + "b" * 14 + "bbb"),
    C("bBb" + "B" * 14 + "bBb"),
    C("bBb" + "B" * 4 + "yyyy" + "B" * 4 + "bBb"),
    C("bBb" + "B" * 4 + "y++y" + "B" * 4 + "bBb"),
    C("bBb" + "B" * 4 + "yyyy" + "B" * 4 + "bBb"),
    C("bBb" + "B" * 14 + "bBb"),
    C("bdb" + "B" * 14 + "bdb"),
    C("bdb" + "d" * 14 + "bdb"),
    C("bbb" + "b" * 14 + "bbb"),
    C("bb" + "b" * 12 + "bb"),
    C("b" * 6 + "dd" + "b" * 6),
    C("bbbb" + "dddd" + "bbbb"),
    C("bBbb" + "...." + "bbBb"),
    C("bbbb" + "...." + "bbbb"),
    C("bbbb" + "...." + "bbbb"),
    C("dddd" + "...." + "dddd"),
    C("dddd" + "...." + "dddd"),
    C(""),
]
TALOS_MAT = {
    "b": M((186, 132, 62), "metal"),
    "B": M((222, 176, 94), "metal"),
    "d": M((124, 84, 44), "metal"),
    "y": M((120, 238, 220), "gem", emissive=0.8),
    "k": M((40, 34, 52), "gem", flat=True),
    "+": GLINT,
}

# ---------------------------------------------------------------------------
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
    "minotaur": (MINOTAUR, MINOTAUR_MAT),
    "medusa": (MEDUSA, MEDUSA_MAT),
    "harpy": (HARPY, HARPY_MAT),
    "cyclops": (CYCLOPS, CYCLOPS_MAT),
    "pegasus": (PEGASUS, PEGASUS_MAT),
    "chimera": (CHIMERA, CHIMERA_MAT),
    "satyr": (SATYR, SATYR_MAT),
    "nemean": (NEMEAN, NEMEAN_MAT),
    "siren": (SIREN, SIREN_MAT),
    "talos": (TALOS, TALOS_MAT),
}

_cache = {}
_icons = {}


def sprite(key):
    """The lit battle sprite - twice the authored size, shaded on the fly."""
    if key not in _cache:
        rows, mats = ART[key]
        _cache[key] = shading.render(rows, mats)
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
