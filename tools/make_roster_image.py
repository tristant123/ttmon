"""Render docs/roster.png: every species, lit by the shading pipeline."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
import pygame
pygame.init(); pygame.display.set_mode((1, 1))

from game.art import monsters as MON
from game.data import species as SP
from game.font import get_font

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "roster.png")

order = [k for k in SP.SPECIES]
# Sprites are 80x80, drawn at 2x. Anything larger (the boss) is fitted into
# the same cell rather than given a row of its own.
Z, COLS, PAD = 2, 8, 8
cell = 80 * Z
rows = (len(order) + COLS - 1) // COLS
sheet = pygame.Surface((COLS * (cell + PAD) + PAD,
                        rows * (cell + 20) + PAD))
sheet.fill((38, 36, 54))
font = get_font()
for i, key in enumerate(order):
    sp = SP.SPECIES[key]
    x = PAD + (i % COLS) * (cell + PAD)
    y = PAD + (i // COLS) * (cell + 20)
    pygame.draw.rect(sheet, (58, 54, 82), (x, y, cell, cell))
    spr = MON.sprite(sp.art)
    w, h = spr.get_size()
    k = min(Z, cell / max(w, h))
    size = (int(w * k), int(h * k))
    sheet.blit(pygame.transform.scale(spr, size),
               (x + (cell - size[0]) // 2, y + cell - size[1]))
    font.draw(sheet, sp.name, x + 2, y + cell + 4, (226, 224, 238))
    font.draw(sheet, sp.race, x + 2, y + cell + 12, (150, 148, 178))
pygame.image.save(sheet, OUT)
print("wrote", OUT, sheet.get_size(), "-", len(order), "species")
