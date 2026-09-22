#!/usr/bin/env python3
"""Tabula Mythos - a monster-binding RPG with Press Turn battles.

Run with:  python main.py
Keys:      arrows/WASD move, Z confirm, X back/menu, Shift run,
           F11 fullscreen, +/- window size, F12 screenshot.
"""

import argparse
import os
import sys

# Keep the window from opening at a silly position on Windows.
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

import pygame

from game import config, sfx
from game.app import Game
from game.art import actors, tiles
from game.scenes import Title


def build_assets(game):
    game.assets["tiles"] = tiles.build()
    hero, npcs = actors.build()
    game.assets["hero"] = hero
    game.assets["npcs"] = npcs


def main(argv=None):
    ap = argparse.ArgumentParser(description=config.TITLE)
    ap.add_argument("--scale", type=int, default=config.DEFAULT_SCALE,
                    help="window scale factor (1-6)")
    ap.add_argument("--fullscreen", action="store_true")
    ap.add_argument("--mute", action="store_true")
    args = ap.parse_args(argv)

    pygame.init()
    if not args.mute:
        sfx.init()
    game = Game(scale=max(config.MIN_SCALE, min(config.MAX_SCALE, args.scale)),
                fullscreen=args.fullscreen)
    build_assets(game)
    game.push(Title(game))
    game.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
