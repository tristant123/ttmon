"""Battle flourishes: damage numbers, element bursts, shakes and flashes."""

import math
import random

import pygame

from .. import palette as P
from ..font import get_font
from ..data.elements import (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK,
                             ALMIGHTY, HEAL, COLORS)


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


def draw_effect(surf, element, rect, t, kind="attack"):
    """Draw an element burst over `rect`. `t` runs 0 -> 1."""
    x, y, w, h = rect
    cx, cy = x + w // 2, y + h // 2
    col = COLORS.get(element, P.WHITE)
    rng = random.Random(int(cx * 31 + cy))

    if kind == "heal" or element == HEAL:
        for i in range(6):
            a = (i / 6.0) * math.tau + t * 3.0
            r = 4 + 14 * (1.0 - t)
            px = cx + math.cos(a) * r
            py = cy + math.sin(a) * r * 0.6 - t * 16
            pygame.draw.rect(surf, P.HP_GOOD, (int(px), int(py), 2, 3))
        return

    if element == PHYS or element is None:
        for i in range(3):
            off = i * 7 - 7
            k = min(1.0, max(0.0, t * 2.0 - i * 0.18))
            if k <= 0 or k >= 1:
                continue
            ln = int(w * 0.9 * k)
            pygame.draw.line(surf, P.WHITE,
                             (cx - ln // 2 + off, cy - ln // 2),
                             (cx + ln // 2 + off, cy + ln // 2), 2)
        return

    if element == FIRE:
        for i in range(9):
            px = x + rng.random() * w
            base = y + h
            rise = (t + rng.random()) % 1.0
            py = base - rise * h * 1.1
            size = int(5 * (1.0 - rise)) + 1
            c = P.EL_FIRE if rise < 0.6 else (248, 216, 120)
            pygame.draw.rect(surf, c, (int(px), int(py), size, size + 1))
        return

    if element == ICE:
        for i in range(6):
            a = (i / 6.0) * math.tau
            r = 20 * t
            px, py = cx + math.cos(a) * r, cy + math.sin(a) * r
            s = max(1, int(5 * (1.0 - t)) + 2)
            pygame.draw.polygon(surf, P.EL_ICE, [
                (px, py - s), (px + s, py), (px, py + s), (px - s, py)])
        return

    if element == ELEC:
        px, py = cx, y - 4
        pts = [(px, py)]
        for i in range(6):
            px += rng.randint(-7, 7)
            py += h / 6.0
            pts.append((px, py))
        if t < 0.8:
            pygame.draw.lines(surf, P.EL_ELEC, False, pts, 2)
            pygame.draw.lines(surf, P.WHITE, False,
                              [(p[0] + 1, p[1]) for p in pts], 1)
        return

    if element == WIND:
        for i in range(4):
            r = int(6 + 16 * ((t + i * 0.25) % 1.0))
            a0 = t * 6 + i
            rect_ = pygame.Rect(cx - r, cy - r, r * 2, r * 2)
            if r > 2:
                pygame.draw.arc(surf, P.EL_WIND, rect_, a0, a0 + 2.2, 2)
        return

    if element == LIGHT:
        for i in range(8):
            a = (i / 8.0) * math.tau + t
            r0, r1 = 4, 6 + 22 * t
            pygame.draw.line(surf, P.EL_LIGHT,
                             (cx + math.cos(a) * r0, cy + math.sin(a) * r0),
                             (cx + math.cos(a) * r1, cy + math.sin(a) * r1), 2)
        pygame.draw.circle(surf, P.WHITE, (cx, cy), max(1, int(8 * (1 - t))))
        return

    if element == DARK:
        for i in range(7):
            a = (i / 7.0) * math.tau - t * 2
            r = 16 * (1.0 - t) + 4
            px, py = cx + math.cos(a) * r, cy + math.sin(a) * r
            pygame.draw.circle(surf, P.EL_DARK, (int(px), int(py)),
                               max(1, int(5 * t) + 1))
        return

    if element == ALMIGHTY:
        r = int(4 + 26 * t)
        pygame.draw.circle(surf, P.EL_ALMIGHTY, (cx, cy), r, 2)
        pygame.draw.circle(surf, P.WHITE, (cx, cy), max(1, r // 2), 1)
        return

    pygame.draw.circle(surf, col, (cx, cy), max(1, int(16 * (1 - t))), 2)


def draw_sigil_throw(surf, start, end, t, caught=None):
    """The binding seal arcing at a monster, then snapping shut."""
    sx, sy = start
    ex, ey = end
    if t < 0.45:
        k = t / 0.45
        x = sx + (ex - sx) * k
        y = sy + (ey - sy) * k - math.sin(k * math.pi) * 26
        _sigil(surf, int(x), int(y), 5, k * 8)
        return
    k = (t - 0.45) / 0.55
    r = int(9 - 4 * min(1.0, k * 2))
    _sigil(surf, ex, ey, max(3, r), k * 4)
    if caught is False and k > 0.7:
        for i in range(6):
            a = (i / 6.0) * math.tau
            d = (k - 0.7) * 60
            pygame.draw.rect(surf, P.EL_LIGHT,
                             (int(ex + math.cos(a) * d),
                              int(ey + math.sin(a) * d), 2, 2))


def _sigil(surf, x, y, r, spin):
    pygame.draw.circle(surf, P.BLACK, (x, y), r + 1)
    pygame.draw.circle(surf, P.EL_LIGHT, (x, y), r)
    pygame.draw.circle(surf, (216, 176, 72), (x, y), r, 1)
    for i in range(3):
        a = spin + i * math.tau / 3
        pygame.draw.line(surf, (160, 120, 40),
                         (x, y), (x + math.cos(a) * r, y + math.sin(a) * r), 1)
