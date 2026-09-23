"""The 2.5D diorama renderer.

The world is drawn the way an HD-2D game draws it: a foreshortened ground
plane whose tiles have real height and visible side faces, with everything
that stands up - trees, buildings, the shrine gate, people and monsters -
drawn as upright billboards sorted back to front.

Nothing here is a 3D mesh. The depth comes from projection, extrusion,
contact shadows and the lighting pass in postfx.py, which is exactly how the
Square Enix HD-2D titles get their look out of 2D sprites.
"""

import math

import pygame

from .. import config, palette as P
from ..pixelart import make

TILE = config.TILE                       # 32px on screen
Y_STEP = int(round(TILE * config.Y_SQUASH))   # 26px of screen per world row
WALL_H = config.WALL_H                   # 22px of side face per height unit

# Terrain elevation by tile name. Everything unlisted sits at ground level.
HEIGHTS = {
    "water": -1,
    "floor": 1,
}

# Tiles that stand up as billboards instead of lying on the ground.
PROPS = {
    "tree", "rock", "sign", "fountain",
    "wall", "window", "door", "roof_l", "roof_m", "roof_r",
    "shrine_tl", "shrine_tm", "shrine_tr",
    "shrine_bl", "shrine_bm", "shrine_br",
}

# How many tiles above its own base a prop is lifted (roofs sit on walls).
LIFT = {
    "roof_l": 1, "roof_m": 1, "roof_r": 1,
    "shrine_tl": 1, "shrine_tm": 1, "shrine_tr": 1,
}

# What ground shows underneath a prop tile.
GROUND_UNDER = {
    "shrine_bl": "floor", "shrine_bm": "floor", "shrine_br": "floor",
    "shrine_tl": "floor", "shrine_tm": "floor", "shrine_tr": "floor",
    "fountain": "path",
}

# Props whose own elevation follows the tile in front of them (so a building
# on a raised plaza stands on the plaza, not in the air).
TUFT_ON = {"tallgrass"}


def _darken(surf, k, ao=0.0):
    out = surf.copy()
    v = int(255 * k)
    out.fill((v, v, v), special_flags=pygame.BLEND_RGB_MULT)
    if ao:
        h = out.get_height()
        shade = pygame.Surface((out.get_width(), h), pygame.SRCALPHA)
        for y in range(h):
            a = int(255 * ao * (y / float(max(1, h - 1))) ** 1.4)
            pygame.draw.line(shade, (0, 0, 0, a), (0, y), (out.get_width(), y))
        out.blit(shade, (0, 0))
    return out


# The earth or stone exposed where terrain steps down.
CLIFF_BASE = {
    "grass": ((122, 88, 58), (86, 60, 40)),
    "flowers": ((122, 88, 58), (86, 60, 40)),
    "tallgrass": ((104, 76, 50), (72, 52, 34)),
    "path": ((168, 136, 92), (116, 92, 62)),
    "sand": ((198, 172, 122), (146, 124, 88)),
    "floor": ((146, 146, 164), (92, 92, 112)),
    "water": ((70, 92, 140), (44, 60, 100)),
}
CLIFF_DEFAULT = ((128, 108, 84), (84, 70, 54))


def _side_face(name, tile, height_px):
    """Build the face of a terrain step: lit rim, a lip of the surface texture
    hanging over the edge, then graded earth or stone with quiet strata."""
    top_col, bot_col = CLIFF_BASE.get(name, CLIFF_DEFAULT)
    h = max(6, height_px)
    face = pygame.Surface((TILE, h))
    for y in range(h):
        k = (y / float(h - 1)) ** 0.85
        col = tuple(int(top_col[i] + (bot_col[i] - top_col[i]) * k)
                    for i in range(3))
        pygame.draw.line(face, col, (0, y), (TILE, y))
    # deterministic speckle so the face is not a flat gradient
    for i in range(46):
        n = (i * 2654435761) & 0xFFFFFFFF
        x = n % TILE
        y = (n >> 8) % h
        shade = -18 if (n >> 16) & 1 else 16
        base = face.get_at((x, y))
        face.set_at((x, y), tuple(
            max(0, min(255, base[c] + shade)) for c in range(3)))
    # quiet horizontal strata
    for y in range(5, h - 2, 7):
        strip = pygame.Surface((TILE, 1), pygame.SRCALPHA)
        strip.fill((0, 0, 0, 46))
        face.blit(strip, (0, y))
        strip.fill((255, 255, 255, 26))
        face.blit(strip, (0, y + 1))
    # a lip of the surface itself hanging over the drop, then the lit rim
    lip = pygame.transform.scale(tile, (TILE, 4))
    face.blit(lip, (0, 0))
    rim = pygame.Surface((TILE, 1), pygame.SRCALPHA)
    rim.fill((255, 248, 220, 120))
    face.blit(rim, (0, 0))
    # ambient occlusion pooling at the bottom
    ao = pygame.Surface((TILE, h), pygame.SRCALPHA)
    for y in range(h):
        a = int(90 * (y / float(h - 1)) ** 2.4)
        pygame.draw.line(ao, (12, 10, 24, a), (0, y), (TILE, y))
    face.blit(ao, (0, 0))
    return face


class Diorama:
    """Holds the projected art and draws a map."""

    def __init__(self, tiles):
        self.tops = {}
        self.sides = {}
        self.bills = {}
        for name, art in tiles.items():
            aw, ah = art.get_size()
            self.tops[name] = pygame.transform.scale(art, (TILE, Y_STEP))
            self.sides[name] = _side_face(name, art, WALL_H)
            # props are drawn upright at 2x, keeping whatever height they were
            # authored at, so a tall tree stays a tall tree
            self.bills[name] = pygame.transform.scale(art, (aw * 2, ah * 2))
        self._shadow_cache = {}
        self._tuft = None
        self._sparkle_seed = 12345

    # -- projection --------------------------------------------------------
    @staticmethod
    def height_at(gmap, x, y):
        if not (0 <= x < gmap.w and 0 <= y < gmap.h):
            return 0
        h = gmap.heights[y][x] if getattr(gmap, "heights", None) else None
        if h is not None:
            return h
        return HEIGHTS.get(gmap.tile(x, y), 0)

    @staticmethod
    def ground_height(gmap, x, y):
        """Elevation something standing on this tile sits at.

        A prop tile has no ground of its own, so it takes the map's explicit
        elevation when there is one - otherwise it stands on whatever the tile
        in front of it stands on."""
        name = gmap.tile(x, y)
        if name in PROPS:
            grid = getattr(gmap, "heights", None)
            if grid and 0 <= y < gmap.h and 0 <= x < gmap.w:
                explicit = grid[y][x]
                if explicit is not None:
                    return explicit
            return Diorama.height_at(gmap, x, y + 1)
        return Diorama.height_at(gmap, x, y)

    def project(self, wx, wy, h, cam):
        """World tile coordinates -> screen pixels (top-left of the tile)."""
        sx = (wx - cam[0]) * TILE
        sy = (wy - cam[1]) * Y_STEP - h * WALL_H
        return sx, sy

    def camera(self, px, py, gmap):
        """Centre on the walker, clamped so the map edge never shows through."""
        h = self.ground_height(gmap, int(round(px)), int(round(py)))
        cx = px - (config.INTERNAL_W / 2.0 - TILE / 2.0) / TILE
        cy = py - (config.INTERNAL_H / 2.0) / Y_STEP - (h * WALL_H) / Y_STEP
        max_x = gmap.w - config.INTERNAL_W / float(TILE)
        max_y = gmap.h - config.INTERNAL_H / float(Y_STEP)
        cx = max(0.0, min(max(0.0, max_x), cx)) if max_x > 0 else max_x / 2.0
        cy = max(-1.0, min(max(0.0, max_y) + 1.0, cy)) if max_y > 0 else max_y / 2.0
        return cx, cy

    # -- pieces ------------------------------------------------------------
    def shadow(self, w, h):
        key = (w, h)
        s = self._shadow_cache.get(key)
        if s is None:
            s = pygame.Surface((w, h), pygame.SRCALPHA)
            for i in range(4):
                k = 1.0 - i / 4.0
                pygame.draw.ellipse(
                    s, (10, 8, 20, int(70 * k)),
                    (int(w * 0.5 * (1 - k)), int(h * 0.5 * (1 - k)),
                     max(2, int(w * k)), max(1, int(h * k))))
            self._shadow_cache[key] = s
        return s

    def tuft(self):
        if self._tuft is None:
            art = [
                "..g...g....g....",
                ".gGg.gGg..gGg...",
                ".gGg.gGg.gGgg...",
                "gGGggGGggGGGg.g.",
                "gGGGgGGGgGGGggGg",
                "kGGGkGGGkGGGkGGg",
                "kkGGkkGGkkGGkkGG",
                "kkkkkkkkkkkkkkkk",
            ]
            pal = {"g": P.TALLGRASS, "G": P.TALLGRASS_L, "k": P.TALLGRASS_D}
            self._tuft = pygame.transform.scale(make(art, pal), (TILE, 22))
        return self._tuft

    # -- the main pass -----------------------------------------------------
    def draw(self, surf, gmap, cam, actors, t=0.0, fx=None, water_frame=0):
        """Paint the map. `actors` is a list of dicts with x, y, sprite and an
        optional lift, drawn as billboards in depth order."""
        x0 = max(0, int(cam[0]) - 1)
        y0 = max(0, int(cam[1]) - 2)
        x1 = min(gmap.w, x0 + config.VIEW_TILES_W + 3)
        y1 = min(gmap.h, y0 + int(config.INTERNAL_H / Y_STEP) + 8)

        # bucket the billboards by the row they stand in
        by_row = {}
        for a in actors:
            row = int(math.floor(a["y"] + 0.5))
            by_row.setdefault(row, []).append(a)

        for ty in range(y0, y1):
            for tx in range(x0, x1):
                self._draw_cell(surf, gmap, tx, ty, cam, t, water_frame)
            # props of this row, then walkers, sorted so nearer draws later
            props = []
            for tx in range(x0, x1):
                name = gmap.tile(tx, ty)
                if name in PROPS:
                    props.append((tx, ty, name, 0))
                # a prop lifted onto the tile below belongs to this row
                above = gmap.tile(tx, ty - 1)
                if above in PROPS and LIFT.get(above):
                    props.append((tx, ty - 1, above, LIFT[above]))
            for tx, py_, name, lift in sorted(props, key=lambda p: (p[3], p[0])):
                self._draw_prop(surf, gmap, tx, py_, name, lift, cam, fx, t)
            for a in sorted(by_row.get(ty, []), key=lambda a: a["y"]):
                self._draw_actor(surf, gmap, a, cam)

    def _draw_cell(self, surf, gmap, tx, ty, cam, t, water_frame):
        name = gmap.tile(tx, ty)
        if name in PROPS:
            name = GROUND_UNDER.get(name, "grass")
        if name == "water" and water_frame:
            name = "water_b"
        h = self.height_at(gmap, tx, ty)
        sx, sy = self.project(tx, ty, h, cam)
        if sx < -TILE or sx > config.INTERNAL_W or sy < -80 or \
                sy > config.INTERNAL_H + 80:
            return
        top = self.tops.get(name)
        if top is None:
            return
        surf.blit(top, (int(sx), int(sy)))
        # side face wherever the tile in front is lower
        front = self.height_at(gmap, tx, ty + 1)
        gmap_front_name = gmap.tile(tx, ty + 1)
        if gmap_front_name in PROPS:
            front = self.height_at(gmap, tx, ty + 2)
        drop = h - front
        if drop > 0:
            face = self.sides.get(name, self.sides["grass"])
            for i in range(drop):
                surf.blit(face, (int(sx), int(sy + Y_STEP + i * WALL_H)))
        if name in ("water", "water_b"):
            self._sparkle(surf, tx, ty, sx, sy, t)
        if name == "tallgrass":
            surf.blit(self.tuft(), (int(sx), int(sy + Y_STEP - 20)))

    def _sparkle(self, surf, tx, ty, sx, sy, t):
        """Bright specular dots on water; the bloom pass turns them to glints."""
        seed = (tx * 73856093) ^ (ty * 19349663)
        for i in range(2):
            ph = ((seed >> (i * 5)) & 63) / 63.0
            k = (math.sin(t * 1.6 + ph * math.tau) + 1.0) * 0.5
            if k < 0.72:
                continue
            ox = 4 + ((seed >> (i * 3)) & 7) * 3
            oy = 4 + ((seed >> (i * 7)) & 3) * 5
            size = 2 if k < 0.9 else 3
            pygame.draw.rect(surf, (255, 255, 248),
                             (int(sx + ox), int(sy + oy), size, size))

    def _draw_prop(self, surf, gmap, tx, ty, name, lift, cam, fx, t):
        base_row = ty + lift
        h = self.ground_height(gmap, tx, base_row)
        sx, sy = self.project(tx, base_row, h, cam)
        bill = self.bills.get(name)
        if bill is None:
            return
        foot = sy + Y_STEP
        top_y = foot - bill.get_height() - lift * (TILE - 2)
        if sx < -TILE * 2 or sx > config.INTERNAL_W + TILE:
            return
        if not lift:
            sh = self.shadow(TILE + 6, 12)
            surf.blit(sh, (int(sx - 3), int(foot - 8)))
        surf.blit(bill, (int(sx), int(top_y)))
        if fx is not None:
            self._prop_light(fx, name, sx, top_y, t)

    @staticmethod
    def _prop_light(fx, name, sx, sy, t):
        if name == "shrine_tm":
            flicker = 0.88 + 0.12 * math.sin(t * 2.2)
            fx.add_light(sx + TILE / 2, sy + TILE * 0.62, 52,
                         (255, 214, 120), 0.42 * flicker)
        elif name == "window":
            fx.add_light(sx + TILE / 2, sy + TILE * 0.4, 42,
                         (255, 190, 110), 0.45)
        elif name == "fountain":
            fx.add_light(sx + TILE / 2, sy + TILE * 0.5, 52,
                         (150, 200, 255), 0.42)

    def _draw_actor(self, surf, gmap, a, cam):
        sprite = a["sprite"]
        h = self.ground_height(gmap, int(round(a["x"])), int(round(a["y"])))
        sx, sy = self.project(a["x"], a["y"], h, cam)
        foot = sy + Y_STEP - a.get("raise", 0)
        sh = self.shadow(TILE - 2, 11)
        surf.blit(sh, (int(sx + 1), int(foot - 7)))
        surf.blit(sprite, (int(sx + (TILE - sprite.get_width()) // 2),
                           int(foot - sprite.get_height())))
