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


def mirror(rows):
    return ["".join(reversed(r)) for r in rows]


def finish(cv):
    return ["".join(r) for r in cv]


def C64(row, off=0):
    """Centre content in a 64-wide line, for the detailed sprites."""
    return C(row, off, 64)


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

# ===========================================================================
# DETAILED SPRITES (64x64)
#
# Authored at the size they are drawn, rather than 32x32 upscaled: room for
# anatomy, cloth folds, claws and irises. Proportions move off chibi toward
# the three-and-a-half heads a PS1 battle sprite tends to use.
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
def _feather(length, width, fill):
    """A flight feather pointing right, for stacking into a wing."""
    sp = plume(length, 2, 3, 1, width, w_base=2, peak=0.6)
    return mirror(turn(spans(None, sp, fill, edge="N")))


def _wing(lengths, tones, gap=3):
    """Feathers stacked top to bottom, all rooted at the left edge. The lower
    feather is laid over the one above, and neighbours alternate tone, so
    each one reads on its own instead of the wing fusing into a paddle."""
    cv = canvas(max(lengths) + 2, gap * len(lengths) + 6)
    for i, n in enumerate(lengths):
        fill, tip = tones[i % len(tones)]
        f = _feather(n, 6, fill)
        f = [r[:n - 5] + r[n - 5:].replace(fill, tip) for r in f]
        stamp(cv, 0, i * gap, f)
    return finish(cv)


_TBIRD_WING = _wing([19, 22, 21, 18, 15], [("b", "n"), ("d", "N")])
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
    "gggggg"[:5], "ggggg",
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

# ---------------------------------------------------------------------------
ART = {
    "pixie": (PIXIE64, PIXIE64_MAT),
    "kitsune": (KITSUNE64, KITSUNE64_MAT),
    "kappa": (KAPPA64, KAPPA64_MAT),
    "thunderbird": (THUNDERBIRD64, THUNDERBIRD64_MAT),
    "golem": (GOLEM, GOLEM_PAL),
    "wisp": (WISP64, WISP64_MAT),
    "naga": (NAGA, NAGA_PAL),
    "tengu": (TENGU, TENGU_PAL),
    "mandrake": (MANDRAKE64, MANDRAKE64_MAT),
    "cerberus": (CERBERUS, CERBERUS_PAL),
    "baku": (BAKU, BAKU_PAL),
    "anubis": (ANUBIS64, ANUBIS64_MAT),
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
