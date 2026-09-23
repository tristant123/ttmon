"""Builds every runtime surface once the display exists.

Sprites are authored at 16x16 / 16x20 and drawn into the diorama at twice the
size: low-resolution pixel art presented large, which is the HD-2D house
style. Scaling is nearest-neighbour so the pixels stay square and hard-edged.
"""

import pygame

from .art import actors, monsters, tiles
from .render.diorama import Diorama


def scale2x(surf):
    return pygame.transform.scale(surf, (surf.get_width() * 2,
                                         surf.get_height() * 2))


_mon_scaled = {}


def monster_scaled(key, scale=2):
    """A monster sprite at battle size, built once per species and scale.
    Nearest-neighbour, so a 3x boss keeps hard square pixels."""
    cached = _mon_scaled.get((key, scale))
    if cached is None:
        src = monsters.sprite(key)
        cached = pygame.transform.scale(
            src, (src.get_width() * scale, src.get_height() * scale))
        _mon_scaled[(key, scale)] = cached
    return cached


def monster2x(key):
    return monster_scaled(key, 2)


def build(game):
    tile_art = tiles.build()
    hero, npcs = actors.build()
    game.assets["tiles"] = tile_art
    game.assets["hero"] = hero
    game.assets["npcs"] = npcs
    game.assets["hero2x"] = {d: [scale2x(f) for f in frames]
                             for d, frames in hero.items()}
    game.assets["npcs2x"] = {k: scale2x(v) for k, v in npcs.items()}
    game.assets["diorama"] = Diorama(tile_art)
    game.assets["mon2x"] = monster2x
    game.assets["mon_scaled"] = monster_scaled
    return game.assets
