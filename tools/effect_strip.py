"""Render a filmstrip of each spell effect so the animation can be checked."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
import pygame
pygame.init(); pygame.display.set_mode((1, 1))

import random
from game.battle import effects
from game.data.elements import (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK,
                                ALMIGHTY, HEAL)
from game.font import get_font
from game.render import postfx

NAMES = [("Phys", PHYS, "attack"), ("Fire", FIRE, "attack"),
         ("Ice", ICE, "attack"), ("Elec", ELEC, "attack"),
         ("Wind", WIND, "attack"), ("Light", LIGHT, "attack"),
         ("Dark", DARK, "attack"), ("Almighty", ALMIGHTY, "attack"),
         ("Heal", HEAL, "heal")]
FRAMES = 7
W, H = 120, 110
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/effects.png"

font = get_font()
sheet = pygame.Surface((FRAMES * (W + 4) + 4, len(NAMES) * (H + 14) + 4))
sheet.fill((26, 26, 36))
fx = postfx.PostFX((W, H))
grade = postfx.get("battle")

for row, (label, element, kind) in enumerate(NAMES):
    rng = random.Random(7)
    rect = pygame.Rect(W // 2 - 32, 24, 64, 64)
    e = effects.Effect(element, [rect], kind, rng)
    step = e.life / (FRAMES - 1)
    for col in range(FRAMES):
        frame = pygame.Surface((W, H))
        frame.fill((62, 92, 64))
        pygame.draw.rect(frame, (52, 78, 56), (0, 88, W, H - 88))
        pygame.draw.ellipse(frame, (44, 66, 48), (rect.x + 8, rect.bottom - 6,
                                                  48, 10))
        pygame.draw.rect(frame, (150, 140, 170), rect.inflate(-18, -6))
        e.draw(frame)
        if e.flash:
            colour, alpha = e.flash
            frame.fill(tuple(c * alpha // 255 for c in colour),
                       special_flags=pygame.BLEND_RGB_ADD)
        fx.apply(frame, grade)
        x = 4 + col * (W + 4)
        y = 4 + row * (H + 14)
        sheet.blit(frame, (x, y))
        if col == 0:
            font.draw(sheet, label, x + 2, y + H + 2, (230, 228, 242))
        for _ in range(3):
            e.update(step / 3.0)
pygame.image.save(sheet, OUT)
print("wrote", OUT, sheet.get_size())
