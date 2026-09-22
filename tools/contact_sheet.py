"""Dev tool: render every monster sprite to a PNG so the art can be eyeballed."""
import os, sys
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pygame
pygame.init()
pygame.display.set_mode((1, 1))

from game.art import monsters
from game.font import get_font

SCALE = 3
COLS = 6
CELL = 32 * SCALE + 8
keys = list(monsters.ART.keys())
rows = (len(keys) + COLS - 1) // COLS
sheet = pygame.Surface((COLS * CELL, rows * (CELL + 12)))
sheet.fill((140, 150, 170))
font = get_font()
for i, k in enumerate(keys):
    cx = (i % COLS) * CELL
    cy = (i // COLS) * (CELL + 12)
    pygame.draw.rect(sheet, (200, 206, 216), (cx + 2, cy + 2, CELL - 4, CELL - 4))
    spr = pygame.transform.scale_by(monsters.sprite(k), SCALE)
    sheet.blit(spr, (cx + 4, cy + 4))
    font.draw(sheet, k, cx + 6, cy + CELL, (20, 20, 30))
out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sheet.png"
pygame.image.save(sheet, out)
print("wrote", out, sheet.get_size())
