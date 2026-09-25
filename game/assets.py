"""Builds every runtime surface once the display exists.

Sprites are authored at 16x16 / 16x20 and drawn into the diorama at twice the
size: low-resolution pixel art presented large, which is the HD-2D house
style. Scaling is nearest-neighbour so the pixels stay square and hard-edged.
"""

import pygame

from .art import actors, monsters, terrain, tiles
from .render.diorama import Diorama


def scale2x(surf):
    return pygame.transform.scale(surf, (surf.get_width() * 2,
                                         surf.get_height() * 2))


_mon_scaled = {}


def monster_scaled(key, scale=1, pose="idle"):
    """A monster's battle sprite in one pose. Scale 1 is the normal size;
    larger values are for set pieces."""
    if scale == 1:
        return monsters.sprite(key, pose)
    cached = _mon_scaled.get((key, scale, pose))
    if cached is None:
        src = monsters.sprite(key, pose)
        cached = pygame.transform.scale(
            src, (src.get_width() * scale, src.get_height() * scale))
        _mon_scaled[(key, scale, pose)] = cached
    return cached


def monster2x(key):
    return monster_scaled(key, 1)


def build(game):
    props = tiles.build_props()
    ground = terrain.build()
    hero, npcs = actors.build()
    game.assets["props"] = props
    game.assets["ground"] = ground
    game.assets["tiles"] = props        # silhouettes and backdrops
    game.assets["hero"] = hero
    game.assets["npcs"] = npcs
    # the art pipeline already delivers these at twice their authored size
    game.assets["hero2x"] = hero
    game.assets["npcs2x"] = npcs
    game.assets["diorama"] = Diorama(props, ground)
    monsters.prebuild()
    game.assets["mon2x"] = monster2x
    game.assets["mon_scaled"] = monster_scaled
    return game.assets
