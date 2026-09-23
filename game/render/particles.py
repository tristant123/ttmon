"""Ambient motes: dust in a sunbeam, pollen, cold sparks at the shrine.

Drawn additively so the bloom pass turns them into soft floating lights,
which is a large part of why HD-2D scenes feel like lit dioramas rather than
flat maps.
"""

import math
import random

import pygame


class MoteField:
    def __init__(self, size, count=28, colour=(255, 236, 190), speed=6.0,
                 size_px=2, seed=7):
        self.w, self.h = size
        self.colour = colour
        self.speed = speed
        self.size_px = size_px
        rng = random.Random(seed)
        self.motes = []
        for _ in range(count):
            self.motes.append([
                rng.uniform(0, self.w),          # x
                rng.uniform(0, self.h),          # y
                rng.uniform(0.35, 1.0),          # depth (parallax + brightness)
                rng.uniform(0, math.tau),        # sway phase
                rng.uniform(0.6, 1.8),           # sway rate
            ])

    def update(self, dt, drift=(0.0, 0.0)):
        for m in self.motes:
            m[0] += (drift[0] * m[2] + self.speed * 0.35 * m[2]) * dt
            m[1] -= self.speed * m[2] * dt * 0.5
            m[3] += m[4] * dt
            if m[1] < -4:
                m[1] = self.h + 4
            if m[0] > self.w + 4:
                m[0] = -4
            elif m[0] < -4:
                m[0] = self.w + 4

    def draw(self, surf, t=0.0):
        col = self.colour
        for x, y, depth, phase, rate in self.motes:
            sway = math.sin(phase) * 6.0 * depth
            k = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(phase * 1.7))
            k *= depth
            c = (int(col[0] * k), int(col[1] * k), int(col[2] * k))
            s = max(1, int(self.size_px * depth + 0.5))
            # additive, so the bloom pass catches them as floating lights
            surf.fill(c, (int(x + sway), int(y), s, s),
                      special_flags=pygame.BLEND_RGB_ADD)


class Sparks:
    """Short-lived embers, used for spell impacts in battle."""

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
