"""The battle stage.

A perspective floor is baked once per encounter: rows of the local terrain
texture sampled with increasing depth toward a horizon, with a distant
treeline behind it. Because it never changes during a fight it costs a single
blit per frame, and the depth-of-field pass softens the far end for free.
"""

import math

import pygame

from .. import config, palette as P

W, H = config.INTERNAL_W, config.INTERNAL_H
HORIZON = 62


def _tiled(tile, width, height):
    out = pygame.Surface((width, height))
    tw, th = tile.get_size()
    for y in range(0, height, th):
        for x in range(0, width, tw):
            out.blit(tile, (x, y))
    return out


def build_floor(tile, horizon=HORIZON, sky=((104, 138, 196), (186, 198, 210))):
    """Bake the receding ground plane plus its sky."""
    strip = _tiled(tile, 2048, tile.get_height())
    sh = strip.get_height()
    floor = pygame.Surface((W, H))

    # sky
    for y in range(0, horizon + 2):
        k = y / float(horizon + 2)
        col = tuple(int(sky[0][i] + (sky[1][i] - sky[0][i]) * k)
                    for i in range(3))
        pygame.draw.line(floor, col, (0, y), (W, y))

    # ground, sampled with depth
    row = pygame.Surface((W, 1))
    for y in range(horizon, H):
        t = (y - horizon + 1) / float(H - horizon)
        depth = 1.0 / (t * 0.92 + 0.07)
        wsrc = max(W, min(2048, int(W * depth * 0.34)))
        v = int(depth * 15.0) % sh
        src = strip.subsurface((0, v, wsrc, 1))
        pygame.transform.scale(src, (W, 1), row)
        # haze toward the horizon
        shade = int(255 * min(1.0, 0.55 + 0.45 * t))
        row.fill((shade, shade, shade), special_flags=pygame.BLEND_RGB_MULT)
        floor.blit(row, (0, y))

    # a soft line where ground meets sky
    band = pygame.Surface((W, 6), pygame.SRCALPHA)
    for i in range(6):
        pygame.draw.line(band, (255, 255, 255, 60 - i * 10), (0, i), (W, i))
    floor.blit(band, (0, horizon - 3))
    return floor


def add_backdrop(floor, props, horizon=HORIZON, rng_seed=5):
    """Scenery behind the stage: a rolling hill band, then two layers of
    silhouettes at different depths. The DoF pass pushes it all back."""
    import random
    rng = random.Random(rng_seed)

    # distant hills, so the ground does not meet the sky on a ruled line
    hill = pygame.Surface((W, 26), pygame.SRCALPHA)
    y = 0
    x = 0
    pts = [(0, 26)]
    while x <= W:
        y = 8 + int(8 * math.sin(x * 0.012 + rng_seed) +
                    4 * math.sin(x * 0.031))
        pts.append((x, y))
        x += 8
    pts.append((W, 26))
    pygame.draw.polygon(hill, (96, 118, 140, 190), pts)
    floor.blit(hill, (0, horizon - 22))

    # far layer: small, pale, hugging the hills
    for _ in range(14):
        art = props[rng.randrange(len(props))]
        k = rng.uniform(0.7, 1.2)
        spr = pygame.transform.scale(art, (max(5, int(art.get_width() * k)),
                                           max(5, int(art.get_height() * k))))
        dark = pygame.mask.from_surface(spr).to_surface(
            setcolor=(92, 110, 132, 190), unsetcolor=(0, 0, 0, 0))
        floor.blit(dark, (rng.randrange(-16, W), horizon - spr.get_height()
                          + rng.randint(-8, 0)))
    # near layer: larger and darker, standing just behind the stage
    for _ in range(11):
        art = props[rng.randrange(len(props))]
        k = rng.uniform(1.4, 2.4)
        spr = pygame.transform.scale(art, (int(art.get_width() * k),
                                           int(art.get_height() * k)))
        dark = pygame.mask.from_surface(spr).to_surface(
            setcolor=(54, 68, 86, 225), unsetcolor=(0, 0, 0, 0))
        floor.blit(dark, (rng.randrange(-24, W), horizon - spr.get_height()
                          + rng.randint(2, 12)))
    return floor


def ground_shadow(w, h):
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(5):
        k = 1.0 - i / 5.0
        pygame.draw.ellipse(s, (8, 6, 18, int(64 * k)),
                            (int(w * 0.5 * (1 - k)), int(h * 0.5 * (1 - k)),
                             max(2, int(w * k)), max(1, int(h * k))))
    return s
