"""Dev tool: blow one sprite up so the pixels can actually be inspected.

Usage: python tools/preview.py <key> [out.png] [scale]
"""
import os, sys
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pygame
pygame.init()
pygame.display.set_mode((1, 1))

from game.art import monsters

keys = sys.argv[1].split(",")
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/preview.png"
scale = int(sys.argv[3]) if len(sys.argv) > 3 else 6

spr = [monsters.sprite(k) for k in keys]
w = max(s.get_width() for s in spr) * scale + 8
h = max(s.get_height() for s in spr) * scale + 8
sheet = pygame.Surface((w * len(spr), h))
# Mid-grey chequer: light and dark art both have to read against it.
for y in range(0, h, 16):
    for x in range(0, w * len(spr), 16):
        c = (108, 112, 124) if (x // 16 + y // 16) % 2 else (128, 132, 146)
        sheet.fill(c, (x, y, 16, 16))
for i, s in enumerate(spr):
    sheet.blit(pygame.transform.scale_by(s, scale), (i * w + 4, 4))
pygame.image.save(sheet, out)
print("wrote", out, sheet.get_size())
