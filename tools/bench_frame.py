"""Measure frame cost of the HD-2D renderer, with and without post-processing."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness
import pygame


def timeit(h, frames=180):
    h.tick(20)
    t = time.perf_counter()
    for _ in range(frames):
        h.game.tick(1.0 / 60.0)
    return (time.perf_counter() - t) / frames * 1000.0


def main():
    h = Harness("/tmp/bench_shots")
    h.tick(3)
    from game.player import PlayerState
    from game.monster import Monster, make_wild
    from game.world import maps
    from game.world.overworld import Overworld
    p = PlayerState()
    for k, lv in (("kitsune", 13), ("kappa", 13), ("tengu", 13)):
        p.add_monster(Monster(k, lv))
    p.map_key = "route"; p.x, p.y = 13, 8
    h.game.player = p
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(5)

    rows = []
    for label, key, pos in (("village", "village", (10, 8)),
                            ("route", "route", (13, 8)),
                            ("shrine", "shrine", (7, 6))):
        ov = h.scene
        ov.map = maps.get(key); ov.tx, ov.ty = pos
        ov.px, ov.py = float(pos[0]), float(pos[1])
        p.map_key = key; ov._setup_render()
        for fxon in (True, False):
            h.game.fx.enabled = fxon
            rows.append((label + (" +fx" if fxon else " flat"), timeit(h)))
    h.game.fx.enabled = True

    ov = h.scene
    ov.map = maps.get("route"); p.map_key = "route"
    ov.start_battle([make_wild("mandrake", 11), make_wild("wisp", 12),
                     make_wild("golem", 12)])
    h.settle()
    for _ in range(300):
        h.tick(2)
        if getattr(h.scene, "mode", "") in ("command", "result"):
            break
    rows.append(("battle +fx", timeit(h)))
    h.game.fx.enabled = False
    rows.append(("battle flat", timeit(h)))

    print("%-16s %8s %8s" % ("scene", "ms/frame", "fps"))
    for name, ms in rows:
        print("%-16s %8.2f %8.0f" % (name, ms, 1000.0 / ms if ms else 999))


if __name__ == "__main__":
    main()
