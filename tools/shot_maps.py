"""Render each map at a chosen spot, for looking at the diorama."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness
import pygame

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hd"
SPOTS = [("village", 13, 12), ("village", 8, 6), ("route", 13, 8),
         ("route", 13, 3), ("shrine", 7, 5), ("shrine", 7, 8)]


def main():
    h = Harness(OUT)
    h.tick(3)
    from game.player import new_game
    from game.world import maps
    from game.world.overworld import Overworld
    h.game.player = new_game("kitsune")
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(6)
    ov = h.scene
    for i, (key, x, y) in enumerate(SPOTS):
        ov.map = maps.get(key)
        ov.tx, ov.ty = x, y
        ov.px, ov.py = float(x), float(y)
        h.game.player.map_key = key
        ov._setup_render()
        ov.banner_t = 0.0
        h.tick(24)
        h.shot("%s_%d_%d" % (key, x, y))
    print("ok ->", OUT)


if __name__ == "__main__":
    main()
