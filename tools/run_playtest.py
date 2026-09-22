"""Scripted playthrough: title -> starter -> overworld -> battle -> menus."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness  # noqa: E402

import pygame  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots"
Z, X = pygame.K_z, pygame.K_x


def main():
    h = Harness(OUT)
    h.tick(10)
    print("scene:", h.scene_name())
    h.shot("title")

    # New Game (Continue may be first if a save exists)
    for _ in range(4):
        if h.scene_name() == "Title":
            label = h.scene.menu.label(h.scene.menu.index)
            if label == "New Game":
                break
            h.press(pygame.K_DOWN, 2)
    h.press(Z, 4)
    h.settle()
    print("after new game:", h.scene_name())
    h.shot("intro")

    for _ in range(3):
        h.press(Z, 6)
    h.shot("starter_choice")
    h.press(pygame.K_RIGHT, 4)
    h.shot("starter_kitsune")
    h.press(pygame.K_LEFT, 4)
    h.press(Z, 6)
    h.settle()
    print("after starter:", h.scene_name())
    h.shot("overworld")

    ov = h.scene
    print("map:", ov.map.key, "at", ov.tx, ov.ty)

    # Talk to the elder: walk to him and interact.
    h.hold(pygame.K_UP, 60)
    h.shot("village_walk")

    # Open the pause menu and look at the party.
    h.press(X, 6)
    print("pause:", h.scene_name())
    h.shot("pause_menu")
    h.press(Z, 6)
    print("party:", h.scene_name())
    h.shot("party")
    h.press(Z, 6)
    h.shot("party_detail")
    h.press(X, 4)
    h.press(X, 4)
    h.press(pygame.K_DOWN, 3)
    h.press(Z, 6)
    print("bag:", h.scene_name())
    h.shot("bag")
    h.press(X, 4)
    h.press(pygame.K_DOWN, 3)
    h.press(Z, 6)
    print("record:", h.scene_name())
    h.shot("record")
    h.press(X, 4)
    h.press(X, 4)
    print("back to:", h.scene_name())

    # Force an encounter rather than waiting on the RNG.
    from game.monster import make_wild
    ov = h.scene
    foes = [make_wild("mandrake", 4), make_wild("pixie", 4)]
    ov.start_battle(foes)
    h.settle()
    h.tick(40)
    print("battle scene:", h.scene_name(), "mode:", getattr(h.scene, "mode", "?"))
    h.shot("battle_open")

    # Play out a few turns.
    for i in range(80):
        h.tick(4)
        sc = h.scene
        if type(sc).__name__ != "BattleScene":
            break
        if sc.mode == "command":
            h.shot("battle_command") if i == 0 else None
            h.press(Z, 3)          # Attack
            if sc.mode == "target":
                h.shot("battle_target") if i == 0 else None
                h.press(Z, 3)
        elif sc.mode == "result":
            h.shot("battle_result")
            h.press(Z, 3)
        else:
            h.press(Z, 1)
    print("after battle:", h.scene_name())
    h.shot("after_battle")
    print("party now:", h.game.player.party)
    print("gold:", h.game.player.gold)
    print("OK - shots in", OUT)


if __name__ == "__main__":
    main()
