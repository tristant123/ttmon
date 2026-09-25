"""Hand-drawn tile maps, their warps, encounters and inhabitants."""

# Tile legend: (tile art key, solid, tag)
LEGEND = {
    ".": ("grass", False, None),
    ",": ("flowers", False, None),
    "*": ("tallgrass", False, "encounter"),
    "#": ("tree", True, None),
    "~": ("water", True, None),
    "o": ("rock", True, None),
    "=": ("path", False, None),
    "+": ("sand", False, None),
    "F": ("floor", False, None),
    "S": ("sign", True, "sign"),
    "C": ("column", True, None),
    "r": ("rubble", True, None),
    "W": ("fountain", True, "fountain"),
    "w": ("wall", True, None),
    "v": ("window", True, None),
    "D": ("door", True, "door"),
    "1": ("roof_l", True, None),
    "2": ("roof_m", True, None),
    "3": ("roof_r", True, None),
    "T": ("shrine_tl", True, None),
    "Y": ("shrine_tm", True, None),
    "U": ("shrine_tr", True, None),
    "L": ("shrine_bl", True, None),
    "M": ("shrine_bm", True, "altar"),
    "R": ("shrine_br", True, None),
}


class NPC:
    def __init__(self, x, y, sprite, lines, name="", action=None, once=None):
        self.x = x
        self.y = y
        self.sprite = sprite
        self.lines = lines
        self.name = name
        self.action = action     # 'shop' / 'heal' / 'gift' / None
        self.once = once         # flag key for one-time gifts


class GameMap:
    def __init__(self, key, name, rows, warps=None, npcs=None, encounters=None,
                 rate=0.0, signs=None, group=(1, 1), safe=False,
                 heights=None, grade=None, lights=None, motes=None,
                 music=None):
        self.key = key
        self.name = name
        self.rows = rows
        self.w = len(rows[0])
        self.h = len(rows)
        self.warps = warps or {}          # (x,y) -> (map, x, y)
        self.npcs = npcs or []
        self.encounters = encounters or []  # (species, lo, hi, weight)
        self.rate = rate
        self.signs = signs or {}          # (x,y) -> text
        self.group = group                # min/max wild group size
        self.safe = safe
        self.grade = grade or key         # post-processing profile
        self.music = music or key         # track name in game/music.py
        self.lights = lights or []        # (tx, ty, radius, colour, strength)
        self.motes = motes or None        # ambient particle settings
        # Elevation grid for the diorama. '.' means "derive from the tile",
        # a digit is an explicit height in wall units. Purely visual.
        self.heights = None
        if heights:
            if len(heights) != self.h:
                raise ValueError("%s: height grid is %d rows, map is %d"
                                 % (key, len(heights), self.h))
            self.heights = []
            for i, row in enumerate(heights):
                if len(row) != self.w:
                    raise ValueError("%s: height row %d is %d wide, map is %d"
                                     % (key, i, len(row), self.w))
                self.heights.append([None if c == "." else int(c)
                                     for c in row])
        for i, r in enumerate(rows):
            if len(r) != self.w:
                raise ValueError("%s row %d is %d wide, expected %d"
                                 % (key, i, len(r), self.w))

    def char(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.rows[y][x]
        return "#"

    def tile(self, x, y):
        return LEGEND[self.char(x, y)][0]

    def solid(self, x, y):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return True
        return LEGEND[self.char(x, y)][1]

    def tag(self, x, y):
        return LEGEND[self.char(x, y)][2]

    def npc_at(self, x, y):
        for n in self.npcs:
            if n.x == x and n.y == y:
                return n
        return None


# ---------------------------------------------------------------------------
# Lantern Hollow - the starting village.
# ---------------------------------------------------------------------------
VILLAGE_ROWS = [
    "########################",
    "#......................#",
    "#..1223......1223....,.#",
    "#..wvDw......wvDw......#",
    "#..======....======....#",
    "#.......=....=.........#",
    "#...,...======.........#",
    "#.......=....=.........#",
    "#.......=....=....,,...#",
    "#.......=.W..=.........#",
    "#.......======.........#",
    "#..1223.=....=.........#",
    "#..wvDw.=....=.........#",
    "#..=====......=........#",
    "#.,...........=........#",
    "#.....S.......=........#",
    "#.............=........#",
    "############.=.#########",
]

VILLAGE_HEIGHTS = [
    "..1111111...1111111.....",
    "..1111111...1111111.....",
    "..1111111...1111111.....",
    "..1111111...1111111.....",
    "..1111111...1111111.....",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "..1111111...............",
    "..1111111...............",
    "..1111111...............",
    "........................",
    "........................",
    "........................",
    "........................",
]

VILLAGE = GameMap(
    "village", "Lantern Hollow", VILLAGE_ROWS,
    warps={(13, 17): ("route", 13, 1), (12, 17): ("route", 13, 1)},
    safe=True, heights=VILLAGE_HEIGHTS, grade="village",
    lights=[(5, 4, 60, (255, 196, 110), 0.75),
            (14, 4, 60, (255, 196, 110), 0.75),
            (11, 9, 58, (150, 205, 255), 0.40),
            (17, 13, 54, (255, 208, 130), 0.55)],
    motes={"count": 26, "colour": (255, 236, 190), "speed": 5.0, "size": 2},
    signs={(6, 15): "LANTERN HOLLOW\nBind what you meet. It is kinder than\nthe alternative."},
    npcs=[
        NPC(9, 6, "elder", [
            "Ah - the new binder.",
            "Listen, because the Hollow has buried\nbinders who did not.",
            "A battle gives each side one turn for\nevery monster still standing.",
            "Strike a weakness, or land a clean hit,\nand your turn is only half spent.\nYou act again.",
            "But miss, or strike something that\nshrugs you off, and you lose two turns\nat once.",
            "Hit what a monster drinks in - or what\nit throws back - and your side's turn\nends on the spot.",
            "So. More allies, more turns. Go and\nbind some.",
        ], name="Elder Maru"),
        NPC(5, 12, "kid", [
            "A wild one at full strength won't fit\nin a sigil. Everybody knows that.",
            "Hurt it first. Put it to sleep if you\ncan. Then throw.",
            "Bosses laugh at sigils, though. Don't\nwaste one on the shrine thing.",
        ], name="Nen"),
        NPC(17, 8, "shop", [
            "Herbs, draughts, sigils. Coin first.",
            "Going to the shrine? Then you want\nincense, salt and a bell. Trust me.",
        ], name="Pell the Trader", action="shop"),
        NPC(16, 12, "ward", [
            "Rest here, binder. Your monsters look\nlike a bad night's sleep.",
        ], name="Warden Isa", action="heal"),
    ])

# ---------------------------------------------------------------------------
# Mistgrass Road - the route, where wild monsters live.
# ---------------------------------------------------------------------------
ROUTE_ROWS = [
    "#############.##############",
    "#####........=.........#####",
    "####.****....=....****....##",
    "###..*****...=...******...##",
    "##...*****...=...******....#",
    "##....****.S.=....*****....#",
    "#......***...=.....***.....#",
    "#............=.............#",
    "#.==========================",
    "#.=.........=..........o..o#",
    "#.=..~~~~...=..******...o..#",
    "#.=.~~~~~~..=..********....#",
    "#.=.~~~~~~..=..*********...#",
    "#.=..~~~~...=...********...#",
    "#.=.........=....******....#",
    "#.===========....****......#",
    "#.=..........,.............#",
    "#.=..,.....S...............#",
    "#.=........................#",
    "#.==========================",
    "#.........................=#",
    "############################",
]

ROUTE_HEIGHTS = [
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "1111111111111.11111111111111",
    "............................",
    "...........................1",
    "...........1..111111111...11",
    "...........1..1111111111...1",
    "...........1..11111111111..1",
    "...........1...1111111111..1",
    "...........1....11111111...1",
    "................111111......",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
    "............................",
]

ROUTE = GameMap(
    "route", "Mistgrass Road", ROUTE_ROWS,
    warps={(13, 0): ("village", 13, 16), (27, 19): ("shrine", 2, 13),
           (27, 8): ("shrine", 2, 13), (2, 20): ("ruins", 22, 16)},
    rate=0.11, group=(1, 2), heights=ROUTE_HEIGHTS, grade="route",
    lights=[(6, 11, 66, (150, 210, 255), 0.35)],
    motes={"count": 34, "colour": (216, 255, 200), "speed": 7.0, "size": 2},
    signs={
        (11, 5): "MISTGRASS ROAD\nThe grass is tall. So is what lives\nin it.",
        (11, 17): "EAST: SHRINE OF THE SCALE\nPilgrims welcome. Survivors rarer.\nSOUTH-WEST: THE MARBLE STEPS",
    },
    encounters=[
        ("mandrake", 3, 6, 30),
        ("pixie", 3, 6, 24),
        ("kitsune", 4, 7, 16),
        ("kappa", 4, 7, 14),
        ("wisp", 5, 8, 10),
        ("thunderbird", 5, 8, 6),
    ])

# ---------------------------------------------------------------------------
# Shrine of the Scale - the deep grass and the boss.
# ---------------------------------------------------------------------------
SHRINE_ROWS = [
    "####################",
    "##....TYU.........##",
    "##..FFLMRFF.......##",
    "#..FFFFFFFFFF......#",
    "#..FFFFFFFFFF...oo.#",
    "#..FFFFFFFFFF....o.#",
    "#...FF~~~~FF.......#",
    "#....~~~~~~....****#",
    "#....~~~~~~....****#",
    "#...FF~~~~FF..*****#",
    "#..FFFFFFFFFF.*****#",
    "#..FFFFFFFFFF..****#",
    "#...FFFFFFFF.......#",
    "#=..............S..#",
    "#=.................#",
    "####################",
]

SHRINE_HEIGHTS = [
    "....................",
    "....2222222.........",
    "....2222222.........",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

SHRINE = GameMap(
    "shrine", "Shrine of the Scale", SHRINE_ROWS,
    warps={(1, 13): ("route", 26, 19), (1, 14): ("route", 26, 19)},
    rate=0.13, group=(1, 3), heights=SHRINE_HEIGHTS, grade="shrine",
    lights=[(5, 8, 62, (130, 180, 255), 0.30),
            (10, 8, 62, (130, 180, 255), 0.30),
            (3, 12, 56, (150, 170, 255), 0.22)],
    motes={"count": 40, "colour": (200, 220, 255), "speed": 4.0, "size": 2},
    signs={(16, 13): "THE SCALE WEIGHS ALL.\nIt has not yet been wrong."},
    encounters=[
        ("wisp", 8, 12, 22),
        ("naga", 9, 13, 20),
        ("tengu", 9, 13, 18),
        ("baku", 10, 14, 14),
        ("golem", 9, 13, 14),
        ("cerberus", 11, 15, 12),
        ("nemean", 12, 16, 10),
        ("chimera", 12, 16, 10),
        ("talos", 12, 16, 8),
        ("medusa", 11, 15, 8),
    ],
    npcs=[
        NPC(7, 6, "ward", [
            "The spring still runs clean. Drink,\nand your monsters will too.",
        ], name="Spring", action="heal"),
        NPC(4, 13, "pilgrim", [
            "You mean to stand before the scale?\nThen hear what it cost me to learn.",
            "He gilds his hide first. Strip the gold\nwith Dispel, or a bell - or Crack it -\nor nothing you have will bite.",
            "When he lifts the scales, you have one\nturn. Ward yourselves. Sap him. Brace.\nHeal whoever is hurt. Do not attack.",
            "The desert wind was always what he\nfeared. Light he throws back, and dark\nhe drinks.",
            "And near the end, his anger rises.\nSap it, or it will be the end of you.",
        ], name="Pilgrim Sefa"),
    ])

# ---------------------------------------------------------------------------
# The Marble Steps - a Greek ruin between the road and the shrine, and where
# the Hellenic half of the bestiary lives.
# ---------------------------------------------------------------------------
RUINS_ROWS = [
    "########################",
    "#***...oo.........***..#",
    "#***....o........****..#",
    "#**.............*****..#",
    "#.....CFFFFFFC.........#",
    "#.....FFFFFFFF....rr...#",
    "#..C..FFFFFFFF..C......#",
    "#.....FFFFFFFF.........#",
    "#.....FFFFFFFF......***#",
    "#.....CFFFFFFC.....****#",
    "#..r................***#",
    "#........rr.S..........#",
    "#***...................#",
    "#****.........C....C...#",
    "#***...................#",
    "#.....................=#",
    "#.....................=#",
    "########################",
]

RUINS = GameMap(
    "ruins", "The Marble Steps", RUINS_ROWS,
    warps={(22, 15): ("route", 2, 19), (22, 16): ("route", 2, 19)},
    rate=0.12, group=(1, 2), grade="ruins",
    signs={(12, 11): "THE MARBLE STEPS\nRaised to gods who no longer answer.\nSomething else moved in."},
    lights=[(9, 6, 70, (255, 206, 132), 0.55),
            (16, 6, 54, (255, 198, 126), 0.40),
            (6, 13, 54, (255, 198, 126), 0.35)],
    motes={"count": 40, "colour": (255, 228, 172), "speed": 5.0, "size": 2},
    encounters=[
        ("satyr", 6, 9, 26),
        ("harpy", 6, 10, 22),
        ("medusa", 8, 11, 16),
        ("minotaur", 8, 12, 14),
        ("siren", 7, 11, 12),
        ("cyclops", 9, 12, 8),
        ("chimera", 10, 13, 6),
        ("pegasus", 9, 12, 5),
        ("talos", 10, 13, 4),
        ("nemean", 11, 14, 3),
    ])

MAPS = {m.key: m for m in (VILLAGE, ROUTE, SHRINE, RUINS)}

# The altar tile that starts the boss fight.
BOSS_TILE = ("shrine", 7, 2)
BOSS_APPROACH = [(6, 3), (7, 3), (8, 3)]


def get(key):
    return MAPS[key]
