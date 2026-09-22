"""Capture specific battle states for a visual check."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness
import pygame

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots3"
Z = pygame.K_z


def battle(h, party_spec, foes, boss=False):
    from game.player import PlayerState
    from game.monster import Monster, make_wild
    from game.world.overworld import Overworld
    p = PlayerState()
    for key, lv in party_spec:
        p.add_monster(Monster(key, lv))
    p.give("sigil_l", 5); p.give("herb", 3)
    p.map_key = "route"; p.x, p.y = 13, 8
    h.game.player = p
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(3)
    h.scene.start_battle([make_wild(k, lv) for k, lv in foes], boss=boss)
    h.settle()
    for _ in range(300):
        h.tick(2)
        if getattr(h.scene, "mode", "") in ("command", "result"):
            break
    return h.scene


def main():
    h = Harness(OUT)
    h.tick(3)
    # 1. three on three, then hit a weakness to earn a half icon
    sc = battle(h, [("kitsune", 12), ("kappa", 12), ("tengu", 12)],
                [("mandrake", 10), ("pixie", 11), ("golem", 11)])
    for i in range(len(sc.menu.items)):
        if sc.menu.label(i) == "Skill":
            sc.menu.index = i
    h.press(Z, 4)
    for i, item in enumerate(sc.sub.items):
        if item[1].key == "ember":
            sc.sub.index = i
    h.press(Z, 4)
    h.press(Z, 2)
    for _ in range(120):
        h.tick(2)
        if h.scene.mode == "command":
            break
    h.game.blink = True
    h.tick(1)
    print("icons:", h.scene.b.turns.icons())
    h.shot("half_icon_visible")
    h.press(Z, 2)   # open target screen for the Attack command
    h.shot("command_window")

    # 2. solo boss, centred
    sc = battle(h, [("tengu", 15), ("kappa", 15), ("golem", 15)],
                [("anubis", 15)], boss=True)
    h.game.blink = True
    h.tick(1)
    h.shot("boss_centred")

    # 3. two foes
    sc = battle(h, [("kitsune", 10), ("kappa", 10)],
                [("wisp", 9), ("naga", 9)])
    h.shot("two_v_two")
    print("done ->", OUT)


if __name__ == "__main__":
    main()
