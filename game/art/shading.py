"""A pixel-art lighting pipeline, in the Octopath / FF Pixel Remaster idiom.

Sprites are authored as flat *material* maps rather than finished pixel art.
This module turns one into a lit sprite:

1. **EPX upscale.** The character grid is doubled with the Scale2x/EPX rule,
   which rounds stair-stepped corners, so a form authored at 32x32 gets a
   64x64 silhouette without the blocky diagonals of nearest-neighbour.
2. **Distance fields.** Every pixel learns how deep it sits inside its own
   material region and inside the silhouette as a whole.
3. **Normals and light.** The gradient of the local field gives a surface
   direction; a key light from the upper left produces a Lambert term that is
   *quantised into bands*, which is what keeps the result reading as pixel art
   rather than an airbrushed bevel.
4. **Hue-shifted ramps.** Shadows rotate toward blue and gain saturation,
   highlights rotate toward warm light and lose it. Flat value ramps are the
   single biggest thing separating amateur pixel art from this house style.
5. **Rim light and coloured outlines.** A cool backlight catches the edge
   facing away from the key, and the outline takes a very dark, hue-shifted
   version of whatever material it hugs - never pure black.

Everything is cached per sprite, so the cost is paid once.
"""

import colorsys
from collections import deque

import pygame

TRANSPARENT = "."

# Key light: upper-left, angled toward the viewer.
LIGHT = (-0.52, -0.66, 0.54)
# Cool backlight from the lower right.
RIM = (0.62, 0.42, 0.30)
WARM_HUE = 0.105      # highlights rotate toward this
COOL_HUE = 0.605      # shadows rotate toward this


def _norm(v):
    m = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) ** 0.5
    return (v[0] / m, v[1] / m, v[2] / m) if m else (0.0, 0.0, 1.0)


_L = _norm(LIGHT)
_R = _norm(RIM)


def _detail(kind, x, y, depth, seed):
    """A per-material surface texture, expressed as a nudge of +/-1 ramp step.

    Deliberately faint. A regular lattice in screen space does not follow the
    body it sits on, so anything stronger than this reads as brickwork painted
    onto the creature rather than as scales. Real detail comes from drawing it;
    this only keeps large flat areas from looking like poured plastic.
    """
    if depth <= 2:
        return 0
    # Mixed, not just multiplied: the low bits of a linear function of x and
    # y repeat along parallel lines, and across a 64-pixel body those "random"
    # speckles lined up into a single long crease.
    h = (x * 374761393 + y * 668265263 + seed * 2654435761) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    if kind == "stone":
        if (h & 15) == 0:
            return -1
        if (h & 63) == 1:
            return 1
        return 0
    if kind == "metal":
        return 1 if y % 9 == 0 else 0
    if kind == "scale":
        # sparse highlights on a diagonal, never the full lattice
        return 1 if (x * 2 + y * 3) % 17 == 0 else 0
    if kind in ("fur", "plant"):
        return -1 if (h & 31) == 0 else 0
    return 0


def _lerp_hue(h, target, amount):
    """Rotate a hue the short way round the wheel."""
    d = target - h
    if d > 0.5:
        d -= 1.0
    elif d < -0.5:
        d += 1.0
    return (h + d * amount) % 1.0


# Yellows are the exception to "shadows go blue": the short way from yellow
# to blue runs through green, so gold and straw shaded that way look mouldy.
# Their shadows go toward red instead, as a painter would take them.
YELLOWS = (0.105, 0.24)
YELLOW_SHADOW_HUE = 0.98


def _shift(rgb, hue_target, hue_amt, sat_mul, val_mul):
    h, s, v = colorsys.rgb_to_hsv(rgb[0] / 255.0, rgb[1] / 255.0,
                                  rgb[2] / 255.0)
    if hue_target == COOL_HUE and YELLOWS[0] < h < YELLOWS[1] and s > 0.15:
        hue_target = YELLOW_SHADOW_HUE
    h = _lerp_hue(h, hue_target, hue_amt)
    s = max(0.0, min(1.0, s * sat_mul))
    v = max(0.0, min(1.0, v * val_mul))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r * 255 + 0.5), int(g * 255 + 0.5), int(b * 255 + 0.5))


class Material:
    """A surface: its base colour and how light behaves on it.

    `kind` selects a shading personality - skin is soft and warm, metal has a
    hard specular step, cloth is matte, gem and flame are emissive.
    """

    KINDS = {
        #          hi2   hi    shadow  core   spec  contrast
        "skin":   (1.17, 1.08, 0.82,   0.70,  0.00, 1.00),
        "fur":    (1.22, 1.10, 0.79,   0.64,  0.05, 1.05),
        "scale":  (1.28, 1.12, 0.76,   0.60,  0.16, 1.12),
        "cloth":  (1.14, 1.06, 0.82,   0.70,  0.00, 0.92),
        "metal":  (1.42, 1.18, 0.66,   0.48,  0.34, 1.30),
        "stone":  (1.16, 1.07, 0.79,   0.64,  0.04, 1.02),
        "plant":  (1.20, 1.09, 0.79,   0.64,  0.02, 1.02),
        "gem":    (1.45, 1.22, 0.80,   0.66,  0.30, 1.20),
        "flame":  (1.30, 1.14, 0.90,   0.80,  0.10, 0.70),
        "matte":  (1.15, 1.07, 0.78,   0.62,  0.00, 1.00),
        # Anime skin: nearly flat, lit in two tones. The volume is carried by
        # shadows painted in by hand - under the fringe, down the far side of
        # the jaw - not by a bevel, which turns a face into a ball.
        "cel":    (1.05, 1.02, 0.93,   0.88,  0.00, 0.55),
    }

    def __init__(self, color, kind="matte", flat=False, emissive=0.0,
                 outline=None, rim=1.0, over=None):
        self.color = color
        self.kind = kind if kind in self.KINDS else "matte"
        self.flat = flat            # eyes and glints take no shading
        self.emissive = emissive    # 0..1, lifts the whole ramp and blooms
        # explicit outline colour, else derived; False for none at all, for
        # sparks and motes that are light rather than objects
        self.outline = outline
        self.rim = rim              # how strongly the backlight catches
        # A marking painted onto another material's surface - a muzzle, a
        # belly, stripes - names that material here and is lit as part of it.
        # Without this the host bevels away from the marking as if it were a
        # hole, and every muzzle grows a dark crease down one side.
        self.over = over
        self._ramp = None

    def ramp(self):
        """Five quantised tones, dark to light, with hue rotation."""
        if self._ramp is None:
            hi2, hi, sh, core, spec, contrast = self.KINDS[self.kind]

            def c(val_mul, hue_t, hue_a, sat_mul):
                # contrast pushes the ramp away from the base value
                m = 1.0 + (val_mul - 1.0) * contrast
                return _shift(self.color, hue_t, hue_a, sat_mul, m)

            base = self.color
            if self.emissive:
                e = self.emissive
                base = _shift(base, WARM_HUE, 0.25 * e, 1.0 - 0.3 * e,
                              1.0 + 0.35 * e)
            self._ramp = [
                c(core, COOL_HUE, 0.34, 1.18),     # 0 core shadow
                c(sh, COOL_HUE, 0.22, 1.10),       # 1 shadow
                base,                              # 2 base
                c(hi, WARM_HUE, 0.14, 0.88),       # 3 highlight
                c(hi2, WARM_HUE, 0.22, 0.72),      # 4 hot highlight
            ]
            self._spec = spec
        return self._ramp

    def spec(self):
        self.ramp()
        return self._spec

    def outline_color(self):
        if self.outline:
            return self.outline
        return _shift(self.color, COOL_HUE, 0.30, 1.15, 0.34)


def M(color, kind="matte", **kw):
    return Material(color, kind, **kw)


# ---------------------------------------------------------------------------
# geometry helpers
# ---------------------------------------------------------------------------

def epx(rows):
    """Scale2x/EPX on a character grid: doubles size, rounds corners."""
    h = len(rows)
    w = max(len(r) for r in rows)
    grid = [r.ljust(w, TRANSPARENT) for r in rows]

    def at(x, y):
        if 0 <= x < w and 0 <= y < h:
            return grid[y][x]
        return TRANSPARENT

    out = []
    for y in range(h):
        top = []
        bot = []
        for x in range(w):
            p = at(x, y)
            a, b = at(x, y - 1), at(x + 1, y)
            c, d = at(x - 1, y), at(x, y + 1)
            e0 = a if (c == a and c != d and a != b) else p
            e1 = b if (a == b and a != c and b != d) else p
            e2 = c if (d == c and d != b and c != a) else p
            e3 = d if (b == d and b != a and d != c) else p
            top.append(e0)
            top.append(e1)
            bot.append(e2)
            bot.append(e3)
        out.append("".join(top))
        out.append("".join(bot))
    return out


def _distance(inside, w, h):
    """Multi-source BFS: for each `inside` pixel, steps to the nearest pixel
    that is not inside. Edge pixels come out as 1."""
    dist = [[0] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            if inside[y][x]:
                # seed from any 4-neighbour that is outside the region
                if (x == 0 or y == 0 or x == w - 1 or y == h - 1
                        or not inside[y - 1][x] or not inside[y + 1][x]
                        or not inside[y][x - 1] or not inside[y][x + 1]):
                    dist[y][x] = 1
                    q.append((x, y))
    while q:
        x, y = q.popleft()
        d = dist[y][x]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and inside[ny][nx] \
                    and dist[ny][nx] == 0:
                dist[ny][nx] = d + 1
                q.append((nx, ny))
    return dist


def _grad(field, x, y, w, h):
    def g(px, py):
        if 0 <= px < w and 0 <= py < h:
            return field[py][px]
        return 0
    return (g(x + 1, y) - g(x - 1, y)) * 0.5, (g(x, y + 1) - g(x, y - 1)) * 0.5


# ---------------------------------------------------------------------------
# the renderer
# ---------------------------------------------------------------------------

def render(rows, mats, upscale=True, outline=True, detail=True):
    """Turn a material map into a lit pygame surface."""
    grid = epx(rows) if upscale else [r for r in rows]
    h = len(grid)
    w = max(len(r) for r in grid)
    grid = [r.ljust(w, TRANSPARENT) for r in grid]

    solid = [[grid[y][x] != TRANSPARENT for x in range(w)] for y in range(h)]
    sil = _distance(solid, w, h)
    seed_base = (w * 31 + h * 17) & 0xFFFF

    # Depth inside each material region, so interior forms are modelled too.
    # A region also records how chunky it is: thin details like a blush or a
    # belly patch must not be bevelled as if they were separate volumes, or
    # the sprite breaks out in dark blotches. They inherit the body's light
    # instead, weighted by `local`.
    mat_depth = [[0] * w for _ in range(h)]
    local = [[0.0] * w for _ in range(h)]

    def host(ch):
        m = mats.get(ch)
        return m.over if m is not None and m.over else ch

    def flat(ch):
        m = mats.get(ch)
        return m is not None and m.flat

    seen = set()
    for y in range(h):
        for x in range(w):
            ch = grid[y][x]
            if ch == TRANSPARENT or host(ch) in seen:
                continue
            key = host(ch)
            seen.add(key)
            # Flat features - eyes, glints, mouths - count as part of every
            # region, so a face is not bevelled around its own eyes. Left as
            # holes they bend the field, and a shadow line runs from each eye
            # to the nearest edge.
            region = [[grid[ry][rx] != TRANSPARENT and
                       (host(grid[ry][rx]) == key or flat(grid[ry][rx]))
                       for rx in range(w)] for ry in range(h)]
            d = _distance(region, w, h)
            thickness = max((d[ry][rx] for ry in range(h) for rx in range(w)
                             if region[ry][rx]), default=0)
            weight = max(0.0, min(1.0, (thickness - 2.0) / 3.5))
            for ry in range(h):
                for rx in range(w):
                    if region[ry][rx] and host(grid[ry][rx]) == key:
                        mat_depth[ry][rx] = d[ry][rx]
                        local[ry][rx] = weight

    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    for y in range(h):
        for x in range(w):
            ch = grid[y][x]
            if ch == TRANSPARENT:
                continue
            mat = mats.get(ch)
            if mat is None:
                continue
            if mat.flat:
                surf.set_at((x, y), mat.color + (255,))
                continue

            ramp = mat.ramp()
            dm = mat_depth[y][x]
            ds = sil[y][x]
            k = local[y][x]
            # blend the local material form with the silhouette's overall form
            gmx, gmy = _grad(mat_depth, x, y, w, h)
            gsx, gsy = _grad(sil, x, y, w, h)
            gx = gmx * k + gsx * (1.0 - k)
            gy = gmy * k + gsy * (1.0 - k)
            depth = dm * k + ds * (1.0 - k)
            nz = 1.25 + 0.80 * min(depth, 5)
            n = _norm((-gx, -gy, nz))
            lam = n[0] * _L[0] + n[1] * _L[1] + n[2] * _L[2]

            # the whole form darkens toward its base, as if sitting on ground
            lam -= 0.10 * (y / float(h))
            # deep interior relaxes toward the base tone
            lam *= 1.0 - 0.22 * min(1.0, depth / 7.0)

            if lam > 0.76:
                idx = 4
            elif lam > 0.50:
                idx = 3
            elif lam > 0.10:
                idx = 2
            elif lam > -0.22:
                idx = 1
            else:
                idx = 0
            if detail:
                idx = max(0, min(4, idx + _detail(mat.kind, x, y, depth,
                                                  seed_base)))
            col = ramp[idx]

            # specular chip on the lit edge of hard materials
            sp = mat.spec()
            if sp and lam > 0.86 and ds <= 3:
                col = _shift(col, WARM_HUE, 0.35, 0.5, 1.0 + sp)

            # cool rim on the silhouette edge facing away from the key light
            if mat.rim and ds <= 2:
                rimlam = n[0] * _R[0] + n[1] * _R[1] + n[2] * _R[2]
                if rimlam > 0.42 and lam < 0.34:
                    k = min(1.0, (rimlam - 0.42) * 2.2) * mat.rim
                    rc = _shift(mat.color, COOL_HUE, 0.42, 0.75, 1.45)
                    col = tuple(int(col[i] + (rc[i] - col[i]) * k)
                                for i in range(3))
            surf.set_at((x, y), col + (255,))

    if outline:
        _outline(surf, grid, mats, w, h)
    return surf


def _outline(surf, grid, mats, w, h):
    """A one-pixel skirt outside the silhouette, tinted by what it touches."""
    edges = {}
    for y in range(h):
        for x in range(w):
            if grid[y][x] != TRANSPARENT:
                continue
            best = None
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1),
                           (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1),
                           (x - 1, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and grid[ny][nx] != TRANSPARENT:
                    mat = mats.get(grid[ny][nx])
                    if mat is not None and mat.outline is not False:
                        best = mat
                        break
            if best is not None:
                edges[(x, y)] = best.outline_color()
    for (x, y), col in edges.items():
        surf.set_at((x, y), col + (255,))


_cache = {}


def sprite(key, rows, mats, upscale=True):
    surf = _cache.get(key)
    if surf is None:
        surf = render(rows, mats, upscale=upscale)
        _cache[key] = surf
    return surf
