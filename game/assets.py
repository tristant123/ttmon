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


def monster_scaled(key, scale=1):
    """A monster's battle sprite. The art pipeline already lights and doubles
    it, so scale 1 is the normal size and larger values are for set pieces."""
    if scale == 1:
        return monsters.sprite(key)
    cached = _mon_scaled.get((key, scale))
    if cached is None:
        src = monsters.sprite(key)
        cached = pygame.transform.scale(
            src, (src.get_width() * scale, src.get_height() * scale))
        _mon_scaled[(key, scale)] = cached
    return cached


def monster2x(key):
    return monster_scaled(key, 1)


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
    monsters.prebuild()
    game.assets["mon2x"] = monster2x
    game.assets["mon_scaled"] = monster_scaled
    return game.assets
