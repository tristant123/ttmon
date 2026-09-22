"""Drives the battle UI specifically: skills, targeting, weakness chains,
binding, and the boss encounter."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness  # noqa: E402

import pygame  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots2"
Z, X = pygame.K_z, pygame.K_x
UP, DOWN, LEFT, RIGHT = (pygame.K_UP, pygame.K_DOWN, pygame.K_LEFT,
                         pygame.K_RIGHT)


def pick_command(h, label):
    """Select a command by name (the menu is two columns, so arrow-key
    assumptions are fragile)."""
    sc = h.scene
    for i in range(len(sc.menu.items)):
        if sc.menu.label(i) == label:
            sc.menu.index = i
            break
    h.press(Z, 4)
    return h.scene


def pick_sub(h, key):
    sc = h.scene
    for i, item in enumerate(sc.sub.items):
        payload = item[1]
        if getattr(payload, "key", None) == key:
            sc.sub.index = i
            break
    h.press(Z, 4)
    return h.scene


def wait_command(h, limit=400):
    for _ in range(limit):
        h.tick(2)
        sc = h.scene
        if type(sc).__name__ != "BattleScene":
            return None
        if sc.mode in ("command", "result"):
            return sc.mode
    return "timeout"


def main():
    h = Harness(OUT)
    h.tick(5)
    # Skip straight into a prepared game state.
    from game.player import PlayerState
    from game.monster import Monster, make_wild
    from game.world.overworld import Overworld
    p = PlayerState()
    for key, lv in (("kitsune", 12), ("kappa", 12), ("tengu", 12)):
        p.add_monster(Monster(key, lv))
    p.give("herb", 5); p.give("draught", 2); p.give("sigil_l", 5)
    p.give("sigil_g", 3); p.give("ash", 1)
    p.map_key = "route"; p.x, p.y = 13, 8
    h.game.player = p
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(5)
    h.shot("route_map")

    ov = h.scene
    foes = [make_wild("mandrake", 10), make_wild("pixie", 11),
            make_wild("golem", 11)]
    ov.start_battle(foes)
    h.settle()
    wait_command(h)
    h.shot("battle_three_v_three")
    print("icons at start:", h.scene.b.turns.icons())

    # Open the skill list.
    pick_command(h, "Skill")
    print("mode:", h.scene.mode)
    h.shot("skill_menu")

    # Pick Ember (Fire) - the Mandrake is weak to it.
    pick_sub(h, "ember")
    print("mode after skill pick:", h.scene.mode)
    h.shot("target_select")
    before = list(h.scene.b.turns.icons())
    h.press(Z, 2)
    for _ in range(60):
        h.tick(2)
        if h.scene.mode in ("command", "result"):
            break
    after = list(h.scene.b.turns.icons())
    print("icons before weakness hit:", before, "-> after:", after)
    h.shot("after_weakness_hit")

    # Scan a foe so affinities show up on the target screen.
    sc = h.scene
    if sc.mode == "command":
        pick_command(h, "Skill")
        pick_sub(h, "scan")
        h.press(Z, 2)
        wait_command(h)
        h.shot("after_scan")
        # Look at the target screen again, now with affinities revealed.
        pick_command(h, "Attack")
        h.shot("target_with_affinities")
        h.press(X, 3)

    # Bind a wild monster.
    sc = h.scene
    if sc.mode == "command":
        pick_command(h, "Bind")
        h.shot("sigil_menu")
        h.press(Z, 3)
        h.shot("sigil_target")
        h.press(Z, 2)
        h.tick(70)
        h.shot("sigil_throw")
        wait_command(h)
        h.shot("after_bind")

    # Let the rest of the fight play out on Attack.
    for n in range(3000):
        h.tick(3)
        sc = h.scene
        if type(sc).__name__ != "BattleScene":
            print("battle finished after", n, "loops")
            break
        if sc.mode == "command":
            pick_command(h, "Attack")
            if h.scene.mode == "target":
                h.press(Z, 2)
        elif sc.mode == "result":
            h.shot("battle_result")
            h.press(Z, 2)
        else:
            h.tick(2)
    print("scene after battle:", h.scene_name())
    print("party:", h.game.player.party)

    # The boss.
    ov = h.scene
    if type(ov).__name__ == "Overworld":
        for m in h.game.player.party:
            m.full_restore()
        ov.pending_boss = True
        ov.start_battle([Monster("anubis", 14)], boss=True)
        h.settle()
        wait_command(h)
        h.shot("boss_open")
        print("boss icons:", h.scene.b.turns.icons(),
              "foe press:", h.scene.b.foes[0].species.press)
        # Throw Light at him: he repels it, which should cost every icon.
        sc = h.scene
        sc.b.party[0].skills.append("glimmer")
        pick_command(h, "Skill")
        pick_sub(h, "glimmer")
        h.press(Z, 2)
        h.tick(90)
        h.shot("boss_repel")
        print("icons after repel:", h.scene.b.turns.icons(),
              "side:", h.scene.b.side)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
