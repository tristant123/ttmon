"""Battle spell effects.

Each element gets a short choreographed animation rather than one shape
scribbled over the target: a wind-up, a strike, and an aftermath. Bright
particles are drawn additively so the bloom pass in postfx.py catches them and
they bleed light, which is most of why a hit reads as powerful.

An effect owns its own clock and particle list. The battle scene creates one,
ticks it, draws it, and asks it for a screen flash colour on the frame it
lands.
"""

import math
import random

import pygame

from .. import palette as P
from ..font import get_font
from ..data.elements import (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK,
                             ALMIGHTY, HEAL, SUPPORT, COLORS)

# ---------------------------------------------------------------------------
# cached particle sprites
# ---------------------------------------------------------------------------

_glow_cache = {}
_shard_cache = {}


def _glow(radius, color):
    """A soft additive dot. The falloff is quantised so it stays pixel art."""
    key = (radius, color)
    spr = _glow_cache.get(key)
    if spr is None:
        d = radius * 2 + 1
        spr = pygame.Surface((d, d), pygame.SRCALPHA)
        for y in range(d):
            for x in range(d):
                dist = math.hypot(x - radius, y - radius) / max(1.0, radius)
                if dist > 1.0:
                    continue
                k = (1.0 - dist) ** 1.7
                k = round(k * 4) / 4.0
                if k <= 0:
                    continue
                spr.set_at((x, y), (int(color[0] * k), int(color[1] * k),
                                    int(color[2] * k), 255))
        _glow_cache[key] = spr
    return spr


def _shard(size, color):
    key = (size, color)
    spr = _shard_cache.get(key)
    if spr is None:
        spr = pygame.Surface((size, size * 2), pygame.SRCALPHA)
        pygame.draw.polygon(spr, color + (255,), [
            (size // 2, 0), (size - 1, size), (size // 2, size * 2 - 1),
            (0, size)])
        pygame.draw.line(spr, (255, 255, 255, 220), (size // 2, 1),
                         (1, size))
        _shard_cache[key] = spr
    return spr


def _add(surf, spr, x, y):
    surf.blit(spr, (int(x - spr.get_width() / 2),
                    int(y - spr.get_height() / 2)),
              special_flags=pygame.BLEND_RGB_ADD)


def _additive(surf, rect, draw_fn):
    """Draw a shape on a scratch layer and add it to the frame.

    Drawing a fading colour straight onto the frame fades it to *black*, which
    is how a dissipating shockwave ends up as a hard black ring. Added light
    fades to nothing instead, which is what a dissipating shockwave does."""
    w, h = max(1, rect[2]), max(1, rect[3])
    if w > 900 or h > 900:
        return
    layer = pygame.Surface((w, h), pygame.SRCALPHA)
    draw_fn(layer)
    surf.blit(layer, (rect[0], rect[1]), special_flags=pygame.BLEND_RGB_ADD)


def _ring(surf, cx, cy, rx, ry, color, width=2):
    if rx < 2 or ry < 1:
        return
    _additive(surf, (cx - rx, cy - ry, rx * 2, ry * 2),
              lambda L: pygame.draw.ellipse(L, color + (255,),
                                            (0, 0, rx * 2, ry * 2), width))


def _circle_ring(surf, cx, cy, r, color, width=2):
    _ring(surf, cx, cy, r, r, color, width)


def _arc(surf, cx, cy, r, a0, a1, color, width=2):
    if r < 3:
        return
    _additive(surf, (cx - r, cy - r, r * 2, r * 2),
              lambda L: pygame.draw.arc(L, color + (255,),
                                        (0, 0, r * 2, r * 2), a0, a1, width))


def _line(surf, x0, y0, x1, y1, color, width=1):
    lx, ly = int(min(x0, x1)) - 2, int(min(y0, y1)) - 2
    w, h = int(abs(x1 - x0)) + 5, int(abs(y1 - y0)) + 5
    _additive(surf, (lx, ly, w, h),
              lambda L: pygame.draw.line(L, color + (255,),
                                         (int(x0) - lx, int(y0) - ly),
                                         (int(x1) - lx, int(y1) - ly), width))


# ---------------------------------------------------------------------------
# floating numbers and shakes (unchanged interface)
# ---------------------------------------------------------------------------

class FloatText:
    """A damage or healing number that rises and fades."""

    def __init__(self, text, x, y, color, rise=16.0, life=0.75, big=False):
        self.text = text
        self.x = x
        self.y = y
        self.color = color
        self.rise = rise
        self.life = life
        self.t = 0.0
        self.big = big

    @property
    def dead(self):
        return self.t >= self.life

    def update(self, dt):
        self.t += dt

    def draw(self, surf):
        font = get_font()
        k = self.t / self.life
        y = self.y - self.rise * (1.0 - (1.0 - k) ** 2)
        x = self.x - font.width(self.text) // 2
        if k > 0.75 and int(self.t * 30) % 2 == 0:
            return
        font.draw(surf, self.text, int(x), int(y), self.color, P.BLACK)


class Shake:
    def __init__(self, amount=3.0, life=0.3):
        self.amount = amount
        self.life = life
        self.t = 0.0

    @property
    def dead(self):
        return self.t >= self.life

    def update(self, dt):
        self.t += dt

    def offset(self):
        if self.dead:
            return 0, 0
        k = 1.0 - self.t / self.life
        return int(math.sin(self.t * 60) * self.amount * k), 0


class Sparks:
    """Short-lived embers, used for physical impacts."""

    def __init__(self):
        self.items = []

    def burst(self, x, y, colour, count=14, speed=70.0, life=0.6, rng=None):
        rng = rng or random
        for _ in range(count):
            a = rng.uniform(0, math.tau)
            v = rng.uniform(0.3, 1.0) * speed
            self.items.append([x, y, math.cos(a) * v, math.sin(a) * v - 20.0,
                               0.0, life * rng.uniform(0.6, 1.2), colour])

    def update(self, dt):
        for p in self.items:
            p[0] += p[2] * dt
            p[1] += p[3] * dt
            p[3] += 150.0 * dt
            p[4] += dt
        self.items = [p for p in self.items if p[4] < p[5]]

    def draw(self, surf):
        for x, y, _, _, age, life, colour in self.items:
            k = max(0.0, 1.0 - age / life)
            c = (int(colour[0] * k), int(colour[1] * k), int(colour[2] * k))
            s = 3 if k > 0.6 else 2
            surf.fill(c, (int(x), int(y), s, s),
                      special_flags=pygame.BLEND_RGB_ADD)


# ---------------------------------------------------------------------------
# the spell effect
# ---------------------------------------------------------------------------

DURATION = {
    PHYS: 0.42, FIRE: 0.58, ICE: 0.56, ELEC: 0.50, WIND: 0.52,
    LIGHT: 0.60, DARK: 0.58, ALMIGHTY: 0.60, HEAL: 0.58, SUPPORT: 0.50,
}


class Effect:
    """One cast, animated over its own lifetime."""

    def __init__(self, element, rects, kind="attack", rng=None):
        self.element = element
        self.kind = kind
        self.rects = list(rects) or [pygame.Rect(200, 60, 64, 64)]
        self.rng = rng or random.Random()
        self.t = 0.0
        self.life = DURATION.get(element, 0.5)
        if kind in ("heal", "buff"):
            self.life = DURATION[HEAL]
        self.parts = []
        self._spawned = set()
        self.flash = None          # (colour, alpha) for the frame it lands
        self._seed = self.rng.random() * 100.0

    @property
    def done(self):
        return self.t >= self.life

    @property
    def k(self):
        return min(1.0, self.t / self.life)

    # -- particles ---------------------------------------------------------
    def emit(self, x, y, vx, vy, life, color, size=2, gravity=0.0, drag=0.0,
             kind="dot"):
        self.parts.append({"x": x, "y": y, "vx": vx, "vy": vy, "age": 0.0,
                           "life": life, "color": color, "size": size,
                           "g": gravity, "drag": drag, "kind": kind,
                           "spin": self.rng.uniform(0, math.tau)})

    def once(self, tag):
        """True the first time it is asked, for one-shot timeline beats."""
        if tag in self._spawned:
            return False
        self._spawned.add(tag)
        return True

    def update(self, dt):
        self.t += dt
        self.flash = None
        for p in self.parts:
            p["age"] += dt
            p["vy"] += p["g"] * dt
            if p["drag"]:
                f = max(0.0, 1.0 - p["drag"] * dt)
                p["vx"] *= f
                p["vy"] *= f
            p["x"] += p["vx"] * dt
            p["y"] += p["vy"] * dt
        self.parts = [p for p in self.parts if p["age"] < p["life"]]
        self._beat()

    def _beat(self):
        """Per-element timeline: spawn what belongs at this moment."""
        k = self.k
        fn = _BEATS.get(self.element)
        if self.kind in ("heal", "buff"):
            fn = _beat_heal
        if fn:
            fn(self, k)

    def draw(self, surf):
        k = self.k
        fn = _DRAWS.get(self.element)
        if self.kind in ("heal", "buff"):
            fn = _draw_heal
        if fn:
            fn(self, surf, k)
        self._draw_parts(surf)

    def _draw_parts(self, surf):
        for p in self.parts:
            f = 1.0 - p["age"] / p["life"]
            col = p["color"]
            c = (int(col[0] * f), int(col[1] * f), int(col[2] * f))
            if p["kind"] == "shard":
                size = max(2, int(p["size"] * (0.6 + 0.4 * f)))
                spr = _shard(size, c)
                spr = pygame.transform.rotate(
                    spr, math.degrees(p["spin"] + p["age"] * 6))
                _add(surf, spr, p["x"], p["y"])
            elif p["kind"] == "streak":
                x2 = p["x"] - p["vx"] * 0.03
                y2 = p["y"] - p["vy"] * 0.03
                pygame.draw.line(surf, c, (int(p["x"]), int(p["y"])),
                                 (int(x2), int(y2)), max(1, int(p["size"] / 2)))
            elif p["kind"] == "smoke":
                r = int(p["size"] * (1.0 + 1.6 * (1.0 - f)))
                if r > 0:
                    dark = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
                    pygame.draw.circle(dark, (18, 14, 26, int(90 * f)),
                                       (r, r), r)
                    surf.blit(dark, (int(p["x"] - r), int(p["y"] - r)))
            else:
                r = max(1, int(p["size"] * (0.5 + 0.5 * f)))
                _add(surf, _glow(r, c), p["x"], p["y"])

    # -- geometry helpers --------------------------------------------------
    def centres(self):
        return [(r.centerx, r.centery) for r in self.rects]

    def feet(self):
        return [(r.centerx, r.bottom - 4) for r in self.rects]


# ---------------------------------------------------------------------------
# per element: spawn beats and direct drawing
# ---------------------------------------------------------------------------

def _beat_fire(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.20:                       # embers gather at the feet
            if e.rng.random() < 0.6:
                e.emit(cx + e.rng.uniform(-14, 14), r.bottom - 4,
                       e.rng.uniform(-8, 8), e.rng.uniform(-40, -14),
                       0.32, (196, 132, 46), 2, gravity=30)
        elif k < 0.62:                     # the column erupts
            for _ in range(3):
                e.emit(cx + e.rng.uniform(-16, 16),
                       r.bottom - e.rng.uniform(0, 12),
                       e.rng.uniform(-22, 22), e.rng.uniform(-150, -70),
                       e.rng.uniform(0.22, 0.42),
                       (198, 158, 70) if e.rng.random() < 0.4
                       else (190, 92, 34),
                       e.rng.randint(2, 4), gravity=40, drag=1.2)
            if e.once("fire_flash"):
                e.flash = ((255, 176, 96), 38)
        elif e.once("fire_smoke"):         # smoke curls off the top
            for _ in range(7):
                e.emit(cx + e.rng.uniform(-14, 14), r.y + e.rng.uniform(-6, 10),
                       e.rng.uniform(-14, 14), e.rng.uniform(-34, -14),
                       0.45, (40, 32, 44), e.rng.randint(3, 6), kind="smoke")


def _draw_fire(e, surf, k):
    """The flame body is alpha-blended, not added.

    Added light over a green field turns yellow and then white, so an additive
    fire column reads as a white pillar. Only the hot core and the embers are
    additive - those are the parts that should bleed into the bloom."""
    if not (0.14 < k < 0.78):
        return
    p = (k - 0.14) / 0.64
    rise = min(1.0, p * 2.1)
    fade = 1.0 - max(0.0, (p - 0.62) / 0.38)
    for (cx, cy), r in zip(e.centres(), e.rects):
        h = int(r.height * 1.5 * rise)
        if h < 2:
            continue
        body = pygame.Surface((r.width * 2, h + 2), pygame.SRCALPHA)
        ox = r.width
        for i in range(0, h, 2):
            f = i / float(max(1, h))
            taper = (1.0 - f) ** 0.62
            waver = 0.82 + 0.18 * math.sin(e.t * 22 - i * 0.42 + e._seed)
            w = int(r.width * 0.42 * taper * waver)
            if w < 1:
                continue
            y = h - i
            if f < 0.20:
                col = (248, 176, 58)
            elif f < 0.52:
                col = (236, 118, 40)
            else:
                col = (186, 62, 36)
            a = int(236 * fade * (1.0 - f * 0.45))
            pygame.draw.rect(body, col + (a,), (ox - w, y, w * 2, 2))
            cw = max(1, w // 3)
            if f < 0.62:
                pygame.draw.rect(body, (252, 228, 158,
                                        int(a * 0.85)), (ox - cw, y, cw * 2, 2))
        surf.blit(body, (cx - ox, r.bottom - h))
        # a warm additive pool at the base, which is what should bloom
        glow = int(26 * fade)
        if glow > 0:
            _add(surf, _glow(int(r.width * 0.42), (glow * 4, glow * 2, glow)),
                 cx, r.bottom - 4)


def _beat_ice(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.34 and e.once("ice_in_%d" % cx):
            for i in range(9):            # shards converge from outside
                a = (i / 9.0) * math.tau + e._seed
                d = 52
                e.emit(cx + math.cos(a) * d, cy + math.sin(a) * d,
                       -math.cos(a) * d / 0.34, -math.sin(a) * d / 0.34,
                       0.34, (172, 226, 252), 5, kind="shard")
        elif k >= 0.40 and e.once("ice_out_%d" % cx):
            e.flash = ((190, 232, 255), 46)
            for i in range(16):           # and shatter outward
                a = e.rng.uniform(0, math.tau)
                v = e.rng.uniform(60, 165)
                e.emit(cx, cy, math.cos(a) * v, math.sin(a) * v,
                       e.rng.uniform(0.22, 0.4), (206, 242, 255),
                       e.rng.randint(2, 4), gravity=180, drag=0.8)


def _draw_ice(e, surf, k):
    if k < 0.40:
        return
    p = (k - 0.40) / 0.60
    for cx, cy in e.centres():
        r = int(6 + 46 * p)
        fade = (1.0 - p) ** 1.3
        _ring(surf, cx, cy, r, max(1, r // 2),
              tuple(int(c * fade) for c in (110, 176, 216)), 2)
        if p < 0.4:
            g = int(20 * (1.0 - p / 0.4))
            if g > 0:
                _add(surf, _glow(g, (150, 196, 226)), cx, cy)


def _beat_elec(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.22:                      # charge gathers above
            if e.rng.random() < 0.5:
                a = e.rng.uniform(0, math.tau)
                d = e.rng.uniform(18, 40)
                e.emit(cx + math.cos(a) * d, r.y - 30 + math.sin(a) * d * 0.4,
                       -math.cos(a) * 60, -math.sin(a) * 30,
                       0.2, (250, 240, 170), 2)
        elif e.once("elec_hit_%d" % cx):  # the strike
            e.flash = ((255, 250, 200), 62)
            for _ in range(14):
                a = e.rng.uniform(-math.pi, 0)
                v = e.rng.uniform(70, 190)
                e.emit(cx, cy + 6, math.cos(a) * v, math.sin(a) * v * 0.5,
                       e.rng.uniform(0.16, 0.34), (250, 232, 140), 3,
                       gravity=260, kind="streak")


def _bolt_points(e, x0, y0, x1, y1, jitter, segments=7):
    pts = []
    for i in range(segments + 1):
        f = i / float(segments)
        x = x0 + (x1 - x0) * f
        y = y0 + (y1 - y0) * f
        if 0 < i < segments:
            x += math.sin(e.t * 90 + i * 2.3 + e._seed) * jitter
        pts.append((int(x), int(y)))
    return pts


def _draw_elec(e, surf, k):
    if not (0.20 < k < 0.52):
        return
    for (cx, cy), r in zip(e.centres(), e.rects):
        pts = _bolt_points(e, cx, -6, cx, cy + 4, 9)
        fade = 1.0 - max(0.0, (k - 0.40) / 0.12)
        for width, col in ((5, (60, 48, 120)), (3, (170, 150, 70)),
                           (1, (220, 220, 200))):
            c = tuple(int(v * fade) for v in col)
            for i in range(len(pts) - 1):
                _line(surf, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1],
                      c, width)
        for bx, by in pts[2:-1:2]:        # forks
            fx = bx + e.rng.randint(-14, 14)
            fy = by + e.rng.randint(6, 16)
            _line(surf, bx, by, fx, fy,
                  tuple(int(v * fade) for v in (150, 138, 90)), 1)


def _beat_wind(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if 0.1 < k < 0.72 and e.rng.random() < 0.7:
            a = e.rng.uniform(0, math.tau)
            d = e.rng.uniform(10, 30)
            e.emit(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.6,
                   math.cos(a + 1.6) * 90, math.sin(a + 1.6) * 40 - 20,
                   0.3, (206, 250, 216), 2, drag=1.4)
        if e.once("wind_flash") and k > 0.3:
            e.flash = ((198, 250, 214), 26)


def _draw_wind(e, surf, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        for i in range(3):                # crescent blades sweeping through
            p = k * 1.5 - i * 0.22
            if not (0.0 < p < 1.0):
                continue
            rad = int(10 + 34 * p)
            fade = 1.0 - p
            col = tuple(int(c * fade) for c in (96, 176, 124))
            a0 = -1.1 + i * 0.5 + p * 1.4
            _arc(surf, cx, cy, rad, a0, a0 + 1.5, col, 3)
            _arc(surf, cx, cy, rad - 3, a0 + 0.1, a0 + 1.3,
                 tuple(int(c * fade * 0.7) for c in (200, 236, 210)), 1)


def _beat_light(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if 0.24 < k < 0.7 and e.rng.random() < 0.8:
            e.emit(cx + e.rng.uniform(-20, 20), r.bottom - e.rng.uniform(0, 8),
                   e.rng.uniform(-10, 10), e.rng.uniform(-70, -30),
                   0.45, (255, 246, 200), 2, drag=0.9)
        if k > 0.26 and e.once("light_flash_%d" % cx):
            e.flash = ((255, 250, 220), 54)


def _draw_light(e, surf, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if 0.1 < k < 0.72:                # the pillar
            p = (k - 0.1) / 0.62
            w = int(r.width * 0.18 * (1.0 - abs(p - 0.4) * 0.8))
            if w > 0:
                fade = 1.0 - max(0.0, (p - 0.55) / 0.45)
                for i in range(0, r.bottom, 3):
                    f = i / float(max(1, r.bottom))
                    col = tuple(int(c * fade * (0.10 + 0.20 * f))
                                for c in (172, 160, 116))
                    surf.fill(col, (cx - w, i, w * 2, 3),
                              special_flags=pygame.BLEND_RGB_ADD)
        if k > 0.26:                      # ground ring and rays
            p = (k - 0.26) / 0.74
            rad = int(8 + 44 * p)
            fade = 1.0 - p
            col = tuple(int(c * fade) for c in (200, 184, 128))
            _ring(surf, cx, r.bottom, rad, max(1, rad // 3), col, 2)
            for i in range(8):
                a = (i / 8.0) * math.tau + p * 1.2
                r0, r1 = 6 + 30 * p, 12 + 52 * p
                _line(surf, cx + math.cos(a) * r0, cy + math.sin(a) * r0,
                      cx + math.cos(a) * r1, cy + math.sin(a) * r1, col, 1)


def _beat_dark(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.46 and e.rng.random() < 0.85:   # spiral inward
            a = e.rng.uniform(0, math.tau)
            d = e.rng.uniform(34, 62)
            e.emit(cx + math.cos(a) * d, cy + math.sin(a) * d,
                   -math.cos(a) * d * 2.1, -math.sin(a) * d * 2.1,
                   0.3, (176, 118, 232), 3, drag=0.4)
        elif e.once("dark_burst_%d" % cx):       # implode, then burst
            e.flash = ((132, 80, 190), 44)
            for _ in range(18):
                a = e.rng.uniform(0, math.tau)
                v = e.rng.uniform(50, 150)
                e.emit(cx, cy, math.cos(a) * v, math.sin(a) * v,
                       e.rng.uniform(0.2, 0.42), (190, 132, 246),
                       e.rng.randint(2, 4), drag=1.4)
            for _ in range(6):
                e.emit(cx + e.rng.uniform(-10, 10), cy + e.rng.uniform(-10, 10),
                       e.rng.uniform(-20, 20), e.rng.uniform(-30, -6),
                       0.45, (20, 12, 30), e.rng.randint(4, 7), kind="smoke")


def _draw_dark(e, surf, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.5:                       # a collapsing well of shadow
            rad = int(26 * (1.0 - k / 0.5)) + 5
            hole = pygame.Surface((rad * 2, rad * 2), pygame.SRCALPHA)
            for i in range(3):
                rr = int(rad * (1.0 - i * 0.28))
                if rr > 0:
                    pygame.draw.circle(hole, (26, 14, 38, 90 + i * 55),
                                       (rad, rad), rr)
            surf.blit(hole, (cx - rad, cy - rad))
            _circle_ring(surf, cx, cy, rad, (108, 62, 156), 1)
        else:
            p = (k - 0.5) / 0.5
            rad = int(10 + 40 * p)
            fade = (1.0 - p) ** 1.2
            _circle_ring(surf, cx, cy, rad,
                         tuple(int(c * fade) for c in (128, 78, 186)), 2)


def _beat_almighty(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if e.rng.random() < 0.5:
            a = e.rng.uniform(0, math.tau)
            v = e.rng.uniform(40, 130)
            e.emit(cx, cy, math.cos(a) * v, math.sin(a) * v,
                   0.3, (244, 236, 255), 2, drag=1.0)
        if k > 0.25 and e.once("alm_flash_%d" % cx):
            e.flash = ((240, 232, 255), 52)


def _draw_almighty(e, surf, k):
    for cx, cy in e.centres():
        for i in range(3):
            p = k * 1.4 - i * 0.2
            if not (0.0 < p < 1.0):
                continue
            rad = int(6 + 48 * p)
            fade = 1.0 - p
            col = tuple(int(c * fade) for c in (186, 176, 214))
            _circle_ring(surf, cx, cy, rad, col, 2)
        for i in range(10):
            a = (i / 10.0) * math.tau
            r1 = 10 + 56 * k
            _line(surf, cx + math.cos(a) * (r1 - 10),
                  cy + math.sin(a) * (r1 - 10),
                  cx + math.cos(a) * r1, cy + math.sin(a) * r1,
                  (92, 86, 122), 1)


def _beat_heal(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k < 0.8 and e.rng.random() < 0.85:
            e.emit(cx + e.rng.uniform(-r.width * 0.4, r.width * 0.4),
                   r.bottom - e.rng.uniform(0, 6),
                   e.rng.uniform(-6, 6), e.rng.uniform(-64, -30),
                   0.5, (168, 250, 190), 2, drag=0.6)


def _draw_heal(e, surf, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        rad = int(r.width * 0.5 * min(1.0, k * 2.4))
        fade = 1.0 - max(0.0, (k - 0.55) / 0.45)
        col = tuple(int(c * fade) for c in (72, 182, 108))
        _ring(surf, cx, r.bottom - rad + 6, rad, rad, col, 2)
        _ring(surf, cx, r.bottom, rad, max(1, rad // 3),
              tuple(int(c * 0.6) for c in col), 1)


def _beat_phys(e, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        if k > 0.34 and e.once("phys_hit_%d" % cx):
            e.flash = ((255, 252, 246), 30)
            for _ in range(12):
                a = e.rng.uniform(0, math.tau)
                v = e.rng.uniform(50, 150)
                e.emit(cx, cy, math.cos(a) * v, math.sin(a) * v,
                       e.rng.uniform(0.14, 0.3), (255, 246, 214), 3,
                       gravity=280, kind="streak")


def _draw_phys(e, surf, k):
    for (cx, cy), r in zip(e.centres(), e.rects):
        for i in range(3):
            p = k * 2.1 - i * 0.26
            if not (0.0 < p < 1.0):
                continue
            span = int(r.width * 1.25)
            off = (i - 1) * 9
            fade = 1.0 - p
            lead = int(span * p)
            x0 = cx - span // 2 + off
            y0 = cy - span // 2 + off // 2
            _line(surf, x0, y0, x0 + lead, y0 + lead,
                  tuple(int(c * fade) for c in (110, 118, 150)), 4)
            _line(surf, x0 + lead - 8, y0 + lead - 8, x0 + lead, y0 + lead,
                  tuple(int(c * fade) for c in (210, 210, 200)), 2)


_BEATS = {
    PHYS: _beat_phys, FIRE: _beat_fire, ICE: _beat_ice, ELEC: _beat_elec,
    WIND: _beat_wind, LIGHT: _beat_light, DARK: _beat_dark,
    ALMIGHTY: _beat_almighty, HEAL: _beat_heal, SUPPORT: _beat_heal,
}
_DRAWS = {
    PHYS: _draw_phys, FIRE: _draw_fire, ICE: _draw_ice, ELEC: _draw_elec,
    WIND: _draw_wind, LIGHT: _draw_light, DARK: _draw_dark,
    ALMIGHTY: _draw_almighty, HEAL: _draw_heal, SUPPORT: _draw_heal,
}


# ---------------------------------------------------------------------------
# the binding sigil, unchanged in spirit but drawn a little richer
# ---------------------------------------------------------------------------

def draw_sigil_throw(surf, start, end, t, caught=None):
    sx, sy = start
    ex, ey = end
    if t < 0.45:
        k = t / 0.45
        x = sx + (ex - sx) * k
        y = sy + (ey - sy) * k - math.sin(k * math.pi) * 40
        _sigil(surf, int(x), int(y), 7, k * 10)
        _add(surf, _glow(6, (120, 96, 30)), x, y)
        return
    k = (t - 0.45) / 0.55
    r = int(13 - 6 * min(1.0, k * 2))
    _sigil(surf, ex, ey, max(4, r), k * 5)
    if k < 0.5:
        rad = int(30 * (1.0 - k * 2)) + 6
        pygame.draw.circle(surf, (250, 226, 150), (ex, ey), rad, 1)
    if caught is False and k > 0.7:
        for i in range(8):
            a = (i / 8.0) * math.tau
            d = (k - 0.7) * 150
            _add(surf, _glow(2, (250, 230, 170)),
                 ex + math.cos(a) * d, ey + math.sin(a) * d)


def _sigil(surf, x, y, r, spin):
    pygame.draw.circle(surf, P.BLACK, (x, y), r + 1)
    pygame.draw.circle(surf, (250, 234, 176), (x, y), r)
    pygame.draw.circle(surf, (198, 152, 56), (x, y), r, 1)
    for i in range(3):
        a = spin + i * math.tau / 3
        pygame.draw.line(surf, (150, 110, 36), (x, y),
                         (x + math.cos(a) * r, y + math.sin(a) * r), 1)


def draw_effect(surf, element, rect, t, kind="attack"):
    """Kept for callers that still draw a one-off burst without an Effect."""
    e = Effect(element, [pygame.Rect(rect)], kind)
    e.t = t * e.life
    e.draw(surf)
