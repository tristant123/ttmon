"""Turn ASCII art into pygame surfaces.

Every sprite in the game is authored as a list of strings where each character
indexes a palette dict. '.' is always transparent. Keeping the art in source
means the game is a single dependency-free package with no binary assets to
lose, and it makes the whole look tweakable from one place.
"""

import pygame

TRANSPARENT = "."


def make(rows, pal):
    """Build a surface from ASCII rows and a {char: (r,g,b)} palette."""
    h = len(rows)
    w = max(len(r) for r in rows)
    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == TRANSPARENT:
                continue
            col = pal.get(ch)
            if col is None:
                continue
            surf.set_at((x, y), col)
    return surf


def flip(surf):
    return pygame.transform.flip(surf, True, False)


def silhouette(surf, color):
    """A flat-coloured copy, used for battle intros and faint animations."""
    out = surf.copy()
    out.fill(color + (0,), special_flags=pygame.BLEND_RGBA_ADD)
    px = pygame.PixelArray(out)
    del px
    mask = pygame.mask.from_surface(surf)
    shape = mask.to_surface(setcolor=color + (255,), unsetcolor=(0, 0, 0, 0))
    return shape


def tint(surf, color, amount):
    """Blend a sprite toward a colour (0..255) without touching alpha."""
    out = surf.copy()
    layer = pygame.Surface(surf.get_size(), pygame.SRCALPHA)
    layer.fill(color + (amount,))
    out.blit(layer, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
    add = pygame.mask.from_surface(surf).to_surface(
        setcolor=tuple(int(c * amount / 255) for c in color) + (0,),
        unsetcolor=(0, 0, 0, 0),
    )
    out.blit(add, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)
    return out


# A 16x16 dither mask reused by the ground tiles. Because it is a fixed
# pattern (not random) the tiles seam perfectly when laid edge to edge.
DITHER = [
    "..1....2....1...",
    ".....1....2....1",
    "2....1.....1....",
    "...2.....1....2.",
    "1....2.1........",
    "....1.....2....1",
    ".2.......1....2.",
    "1....2....1.....",
    "....1....2....1.",
    ".1.....2.....1..",
    "2....1....2.....",
    "...1....2....1..",
    ".....2....1....2",
    "1....1.....2....",
    "..2.....1....1..",
    "....1....2....1.",
]


def ground_tile(base, speck1, speck2):
    """A flat 16x16 ground tile with two speckle shades."""
    surf = pygame.Surface((16, 16))
    surf.fill(base)
    for y, row in enumerate(DITHER):
        for x, ch in enumerate(row):
            if ch == "1":
                surf.set_at((x, y), speck1)
            elif ch == "2":
                surf.set_at((x, y), speck2)
    return surf
