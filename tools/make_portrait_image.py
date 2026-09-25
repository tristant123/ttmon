"""Render docs/portraits.png: every dialogue portrait, side by side."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
import pygame
pygame.init(); pygame.display.set_mode((1, 1))

from game.art import portraits
from game.font import get_font

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "portraits.png")

NAMES = {v: k for k, v in portraits.SPEAKERS.items()}
NAMES["hero"] = "The binder"
Z, PAD = 3, 10
w, h = portraits.W * Z, portraits.H * Z
keys = list(portraits.CAST)
sheet = pygame.Surface((len(keys) * (w + PAD) + PAD, h + PAD * 2 + 14))
sheet.fill((38, 36, 54))
font = get_font()
for i, key in enumerate(keys):
    x = PAD + i * (w + PAD)
    pygame.draw.rect(sheet, (58, 54, 82), (x, PAD, w, h))
    sheet.blit(portraits.portrait(key, scale=Z), (x, PAD))
    font.draw(sheet, NAMES.get(key, key), x + 4, PAD + h + 4, (226, 224, 238))
pygame.image.save(sheet, OUT)
print("wrote", OUT, sheet.get_size())
