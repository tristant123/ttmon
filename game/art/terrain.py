"""Procedural ground textures, authored at native screen resolution.

The props and monsters are drawn at 32x32 and 64x64, so 16x16 ground stretched
to fill a tile left the floor visibly chunkier than everything standing on it.
These tiles are generated at 32x32 instead - one source pixel per screen pixel
- from seamless value noise, with several variants per surface that the
renderer picks by position. The variants matter as much as the resolution: a
single tile repeated across a field reads as wallpaper no matter how detailed
it is.

All noise wraps on the tile boundary, so the ground still lays edge to edge
without seams.
"""

import math

import pygame

SIZE = 32
VARIANTS = 4
WATER_FRAMES = ("water", "water_b", "water_c", "water_d")


# ---------------------------------------------------------------------------
# seamless value noise
# ---------------------------------------------------------------------------

def _hash(x, y, seed):
    n = (x * 374761393 + y * 668265263 + seed * 1274126177) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def _smooth(t):
    return t * t * (3.0 - 2.0 * t)


def _value_noise(x, y, period, seed):
    """Bilinear value noise on a lattice that wraps every `period` pixels."""
    fx, fy = x / float(period), y / float(period)
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = _smooth(fx - x0), _smooth(fy - y0)
    cells = SIZE // period
    x0 %= cells
    y0 %= cells
    x1 = (x0 + 1) % cells
    y1 = (y0 + 1) % cells
    a = _hash(x0, y0, seed)
    b = _hash(x1, y0, seed)
    c = _hash(x0, y1, seed)
    d = _hash(x1, y1, seed)
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty


def _fbm(x, y, seed, periods=(8, 4, 2), weights=(0.5, 0.32, 0.18)):
    total = 0.0
    for p, w in zip(periods, weights):
        total += _value_noise(x, y, p, seed + p) * w
    return total


def _field(seed, periods=(8, 4, 2), weights=(0.5, 0.32, 0.18)):
    """A whole tile of noise, normalised to a fixed mean and spread.

    Without this each variant drifts brighter or darker than its neighbours,
    and a field of them reads as a patchwork of squares rather than ground.
    Small lattice periods matter for the same reason: at period 16 a 32px tile
    only samples four lattice points, so its average is almost random."""
    vals = [[_fbm(x, y, seed, periods, weights) for x in range(SIZE)]
            for y in range(SIZE)]
    flat = [v for row in vals for v in row]
    mean = sum(flat) / len(flat)
    spread = max(1e-5, (sum((v - mean) ** 2 for v in flat) / len(flat)) ** 0.5)
    return [[0.5 + (v - mean) / spread * 0.22 for v in row] for row in vals]


def _ramp(colors, t):
    """Pick from a list of tones by a 0..1 value, quantised - no gradients."""
    i = int(max(0.0, min(0.999, t)) * len(colors))
    return colors[i]


def _tone(base, mul, shift=(0, 0, 0)):
    return tuple(max(0, min(255, int(base[i] * mul) + shift[i]))
                 for i in range(3))


# ---------------------------------------------------------------------------
# surfaces
# ---------------------------------------------------------------------------

def _blank():
    return pygame.Surface((SIZE, SIZE))


def grass(seed=0):
    base = (96, 160, 80)
    tones = [_tone(base, 0.74), _tone(base, 0.87), base,
             _tone(base, 1.10), _tone(base, 1.24)]
    surf = _blank()
    field = _field(seed * 31 + 7)
    for y in range(SIZE):
        for x in range(SIZE):
            surf.set_at((x, y), _ramp(tones, field[y][x]))
    # blades: short strokes rooted in the darker patches
    blade_hi = _tone(base, 1.34, (10, 16, 0))
    blade_lo = _tone(base, 0.66)
    for i in range(46):
        bx = int(_hash(i, seed, 11) * SIZE)
        by = int(_hash(i, seed, 23) * SIZE)
        h = 2 + int(_hash(i, seed, 37) * 3)
        col = blade_hi if _hash(i, seed, 41) > 0.45 else blade_lo
        for k in range(h):
            surf.set_at((bx % SIZE, (by - k) % SIZE), col)
    # a few clover specks for colour interest
    for i in range(6):
        cx = int(_hash(i, seed, 53) * SIZE)
        cy = int(_hash(i, seed, 59) * SIZE)
        surf.set_at((cx % SIZE, cy % SIZE), (150, 196, 108))
    return surf


def path(seed=0):
    base = (200, 172, 120)
    tones = [_tone(base, 0.76), _tone(base, 0.88), base,
             _tone(base, 1.08), _tone(base, 1.18)]
    surf = _blank()
    field = _field(seed * 17 + 3)
    for y in range(SIZE):
        for x in range(SIZE):
            surf.set_at((x, y), _ramp(tones, field[y][x]))
    # a handful of grit, kept small so the path reads as packed earth
    for i in range(7):
        px = int(_hash(i, seed, 71) * SIZE)
        py = int(_hash(i, seed, 73) * SIZE)
        surf.set_at((px % SIZE, py % SIZE), (198, 188, 166))
        surf.set_at(((px + 1) % SIZE, py % SIZE), (176, 162, 138))
        surf.set_at((px % SIZE, (py + 1) % SIZE), _tone(base, 0.72))
    return surf


def sand(seed=0):
    base = (232, 216, 168)
    tones = [_tone(base, 0.84), _tone(base, 0.92), base, _tone(base, 1.06)]
    surf = _blank()
    field = _field(seed * 13 + 5)
    for y in range(SIZE):
        for x in range(SIZE):
            n = field[y][x] + 0.05 * math.sin((x + y * 0.4) * math.pi / 8.0)
            surf.set_at((x, y), _ramp(tones, n))
    return surf


def stone_floor(seed=0):
    """Flagstones: a mortar grid, each slab shaded and cracked separately."""
    base = (128, 128, 152)
    surf = _blank()
    mortar = _tone(base, 0.56)
    surf.fill(mortar)
    slabs = [(0, 0, 15, 15), (17, 0, 15, 15), (0, 17, 15, 15), (17, 17, 15, 15)]
    if seed % 2:
        slabs = [(0, 0, 32, 15), (0, 17, 15, 15), (17, 17, 15, 15)]
    for si, (sx, sy, sw, sh) in enumerate(slabs):
        shade = 0.92 + 0.16 * _hash(si, seed, 91)
        tones = [_tone(base, 0.80 * shade), _tone(base, 0.92 * shade),
                 _tone(base, 1.0 * shade), _tone(base, 1.10 * shade)]
        field = _field(seed * 7 + si * 29, periods=(8, 4, 2),
                       weights=(0.42, 0.34, 0.24))
        for y in range(sy, sy + sh):
            for x in range(sx, sx + sw):
                surf.set_at((x % SIZE, y % SIZE),
                            _ramp(tones, field[y % SIZE][x % SIZE]))
        # lit top and left edge, shadowed bottom
        for x in range(sx, sx + sw):
            surf.set_at((x % SIZE, sy % SIZE), _tone(base, 1.26 * shade))
            surf.set_at((x % SIZE, (sy + sh - 1) % SIZE), _tone(base, 0.70))
        for y in range(sy, sy + sh):
            surf.set_at((sx % SIZE, y % SIZE), _tone(base, 1.14 * shade))
        # A crack on the occasional slab. Kept short and nearly straight:
        # a wandering line reads as handwriting rather than stone.
        if _hash(si, seed, 97) > 0.68:
            cx = sx + 4 + int(_hash(si, seed, 101) * max(1, sw - 8))
            cy = sy + 3 + int(_hash(si, seed, 109) * 3)
            length = 4 + int(_hash(si, seed, 113) * (sh - 9))
            kink = 2 + int(_hash(si, seed, 127) * max(1, length - 3))
            for k in range(length):
                if k == kink:
                    cx += 1 if _hash(si, seed, 131) > 0.5 else -1
                x = max(sx + 1, min(sx + sw - 2, cx))
                surf.set_at((x % SIZE, (cy + k) % SIZE), _tone(base, 0.58))
    return surf


def water(frame=0, seed=0):
    """Water as travelling bands rather than noise blobs: broad swells moving
    toward the viewer, with a lit crest riding the top of each one."""
    base = (72, 136, 208)
    tones = [_tone(base, 0.62), _tone(base, 0.78), _tone(base, 0.92),
             base, _tone(base, 1.12)]
    crest = (208, 238, 255)
    surf = _blank()
    phase = frame * (math.tau / 4.0)
    field = _field(seed * 5 + 2, periods=(8, 4), weights=(0.6, 0.4))
    for y in range(SIZE):
        # one full swell per tile, so it wraps cleanly
        swell = math.sin((y / float(SIZE)) * math.tau + phase)
        for x in range(SIZE):
            ripple = math.sin((x / float(SIZE)) * math.tau * 2 + phase * 0.7)
            v = 0.5 + 0.26 * swell + 0.09 * ripple
            v += (field[y][x] - 0.5) * 0.55
            surf.set_at((x, y), _ramp(tones, v))
    # crest line along the steepest part of the swell
    cy = int(((0.25 - phase / math.tau) % 1.0) * SIZE)
    for x in range(SIZE):
        wob = int(math.sin((x / float(SIZE)) * math.tau * 2 + phase) * 1.6)
        y = (cy + wob) % SIZE
        if (x + frame) % 5 != 0:
            surf.set_at((x, y), crest)
        surf.set_at((x, (y + 1) % SIZE), tones[4])
    return surf


def tall_grass(seed=0):
    """Dense blades, drawn over the ordinary grass tone."""
    surf = grass(seed + 5)
    dark = (36, 92, 56)
    mid = (56, 128, 72)
    lit = (96, 176, 96)
    for i in range(120):
        bx = int(_hash(i, seed, 131) * SIZE)
        by = int(_hash(i, seed, 137) * SIZE)
        h = 4 + int(_hash(i, seed, 139) * 6)
        lean = 1 if _hash(i, seed, 149) > 0.5 else -1
        for k in range(h):
            x = (bx + (lean if k > h - 3 else 0)) % SIZE
            y = (by - k) % SIZE
            if k == h - 1:
                surf.set_at((x, y), lit)
            elif k > h // 2:
                surf.set_at((x, y), mid)
            else:
                surf.set_at((x, y), dark)
    return surf


def flowers(seed=0):
    """Grass with clumps of wildflowers."""
    surf = grass(seed + 11)
    petals = [(240, 216, 96), (232, 120, 152), (244, 244, 236),
              (196, 154, 232)]
    for i in range(7):
        cx = int(_hash(i, seed, 151) * SIZE)
        cy = int(_hash(i, seed, 157) * SIZE)
        col = petals[int(_hash(i, seed, 163) * len(petals)) % len(petals)]
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            surf.set_at(((cx + dx) % SIZE, (cy + dy) % SIZE), col)
        surf.set_at((cx % SIZE, cy % SIZE), (250, 238, 180))
        surf.set_at((cx % SIZE, (cy + 2) % SIZE), (56, 118, 64))
    return surf


# ---------------------------------------------------------------------------

def build():
    """Every ground surface, as a list of variants keyed by tile name."""
    out = {
        "grass": [grass(v) for v in range(VARIANTS)],
        "path": [path(v) for v in range(VARIANTS)],
        "sand": [sand(v) for v in range(VARIANTS)],
        "floor": [stone_floor(v) for v in range(VARIANTS)],
        "tallgrass": [tall_grass(v) for v in range(VARIANTS)],
        "flowers": [flowers(v) for v in range(VARIANTS)],
    }
    # water animates rather than varying by position
    for i, key in enumerate(WATER_FRAMES):
        out[key] = [water(i)]
    return out
