"""Walks the whole world: village -> route -> shrine, checks warps, NPCs,
signs, the shop, healing and the altar."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness, HELD
import pygame

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots4"
Z, X = pygame.K_z, pygame.K_x
KEY = {"up": pygame.K_UP, "down": pygame.K_DOWN, "left": pygame.K_LEFT,
       "right": pygame.K_RIGHT}


def clear_dialogue(h, limit=40):
    """Mash confirm until we are back on the map (each line needs one press to
    finish typing and one to advance)."""
    for _ in range(limit):
        if type(h.scene).__name__ == "Overworld":
            return True
        h.press(Z, 3)
    return type(h.scene).__name__ == "Overworld"


def path_to(ov, goal):
    """Breadth-first search over walkable tiles (NPCs count as walls)."""
    from collections import deque
    start = (ov.tx, ov.ty)
    seen = {start: None}
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == goal:
            steps = []
            while cur != start:
                cur, d = seen[cur][0], seen[cur][1]
                steps.append(d)
            return list(reversed(steps))
        for d, (dx, dy) in (("up", (0, -1)), ("down", (0, 1)),
                            ("left", (-1, 0)), ("right", (1, 0))):
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in seen or ov.blocked(*nxt):
                continue
            seen[nxt] = (cur, d)
            q.append(nxt)
    return None


def walk_to(h, x, y, limit=400):
    if type(h.scene).__name__ != "Overworld":
        return False
    steps = path_to(h.scene, (x, y))
    if steps is None:
        return False
    for d in steps[:limit]:
        if type(h.scene).__name__ != "Overworld":
            return False
        ov = h.scene
        # tap: hold just long enough to begin the step, then let it finish
        HELD.add(KEY[d])
        h.tick(2)
        HELD.discard(KEY[d])
        for _ in range(40):
            if type(h.scene).__name__ != "Overworld" or not h.scene.moving:
                break
            h.tick(1)
        h.tick(1)
    return type(h.scene).__name__ == "Overworld" and \
        (h.scene.tx, h.scene.ty) == (x, y)


def main():
    h = Harness(OUT)
    h.tick(3)
    from game.player import new_game
    from game.world.overworld import Overworld
    h.game.player = new_game("kitsune")
    h.game.player.party[0].level = 12
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(3)

    # Talk to the elder (stand below him and face up).
    ov = h.scene
    print("start at", ov.map.key, ov.tx, ov.ty)
    assert walk_to(h, 9, 7), "could not reach the elder"
    ov = h.scene
    ov.facing = "up"
    h.press(Z, 6)
    print("elder scene:", h.scene_name())
    h.shot("elder_talk")
    clear_dialogue(h)
    print("after elder:", h.scene_name())

    # The shop.
    assert walk_to(h, 17, 9), "could not reach the trader"
    h.scene.facing = "up"
    h.press(Z, 6)
    for _ in range(6):
        if h.scene_name() == "ShopMenu":
            break
        h.press(Z, 5)
    print("shop scene:", h.scene_name())
    h.shot("shop")
    if h.scene_name() == "ShopMenu":
        gold = h.game.player.gold
        h.press(Z, 4)
        print("bought; gold", gold, "->", h.game.player.gold)
        h.press(X, 4)

    # Head south to the route.
    clear_dialogue(h)
    ok = walk_to(h, 13, 16)
    print("reached village exit:", ok)
    HELD.add(KEY["down"]); h.tick(30); HELD.discard(KEY["down"])
    h.settle(); h.tick(10)
    print("now on:", h.scene.map.key if type(h.scene).__name__ == "Overworld"
          else h.scene_name())
    if type(h.scene).__name__ == "BattleScene":
        # a wild encounter on the way is a fine sign the rate works
        print("encounter on arrival; fleeing")
        for _ in range(200):
            h.tick(3)
            if getattr(h.scene, "mode", "") == "command":
                for i in range(len(h.scene.menu.items)):
                    if h.scene.menu.label(i) == "Flee":
                        h.scene.menu.index = i
                h.press(Z, 3)
            if type(h.scene).__name__ == "Overworld":
                break
    h.shot("route_arrival")
    print("map now:", h.scene.map.key)

    # Cross to the shrine.
    ov = h.scene
    ov.map.rate = 0.0         # keep the walk deterministic for the test
    assert walk_to(h, 26, 19), "could not cross the route"
    HELD.add(KEY["right"]); h.tick(30); HELD.discard(KEY["right"])
    h.settle(); h.tick(10)
    print("map now:", h.scene.map.key)
    h.shot("shrine_arrival")
    h.scene.map.rate = 0.0

    # The spring heals.
    h.game.player.party[0].hp = 5
    assert walk_to(h, 7, 5), "could not reach the spring"
    h.scene.facing = "down"
    h.press(Z, 6)
    clear_dialogue(h)
    print("hp after spring:", h.game.player.party[0].hp,
          "/", h.game.player.party[0].maxhp)

    # The altar.
    assert walk_to(h, 7, 3), "could not reach the altar"
    h.scene.facing = "up"
    h.press(Z, 6)
    h.shot("altar_dialogue")
    for _ in range(10):
        if type(h.scene).__name__ != "Dialogue":
            break
        h.press(Z, 5)
    h.settle(); h.tick(30)
    print("scene at altar:", h.scene_name())
    if type(h.scene).__name__ == "BattleScene":
        print("boss:", h.scene.b.foes[0].name, "Lv", h.scene.b.foes[0].level,
              "icons", h.scene.b.turns.icons())
        h.shot("boss_fight")
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
