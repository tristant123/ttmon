"""Headless playtest harness.

Drives the real game loop with synthetic input under SDL's dummy video
driver, and writes screenshots so the presentation can be checked without a
display. Usage: python3 tools/playtest.py [outdir]
"""
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame

from game import config, sfx
from game.app import Game
from game.art import actors, tiles
from game.scenes import Title

HELD = set()
_real_get_pressed = None


class FakeKeys:
    def __getitem__(self, k):
        return k in HELD


def patch_keys():
    global _real_get_pressed
    _real_get_pressed = pygame.key.get_pressed
    pygame.key.get_pressed = lambda: FakeKeys()


class Harness:
    def __init__(self, outdir):
        self.outdir = outdir
        os.makedirs(outdir, exist_ok=True)
        pygame.init()
        patch_keys()
        self.game = Game(scale=1)
        self.game.assets["tiles"] = tiles.build()
        hero, npcs = actors.build()
        self.game.assets["hero"] = hero
        self.game.assets["npcs"] = npcs
        self.game.push(Title(self.game))
        self.shots = 0

    def tick(self, frames=1):
        for _ in range(frames):
            self.game.tick(1.0 / 60.0)

    def press(self, key, frames=8):
        pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=key, mod=0))
        self.tick(1)
        pygame.event.post(pygame.event.Event(pygame.KEYUP, key=key, mod=0))
        self.tick(frames)

    def hold(self, key, frames):
        HELD.add(key)
        self.tick(frames)
        HELD.discard(key)
        self.tick(2)

    def shot(self, name):
        self.shots += 1
        path = os.path.join(self.outdir, "%02d_%s.png" % (self.shots, name))
        pygame.image.save(self.game.canvas, path)
        return path

    @property
    def scene(self):
        return self.game.scene

    def scene_name(self):
        return type(self.scene).__name__

    def settle(self, limit=600):
        """Tick until transitions finish."""
        n = 0
        while self.game.busy and n < limit:
            self.tick(1)
            n += 1
        self.tick(4)
