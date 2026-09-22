"""Render docs/screens.png: a montage of real in-game screens."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness, HELD
import pygame

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "screens.png")
TMP = os.path.join(ROOT, "docs", "_tmp")
Z = pygame.K_z


def grab(h, name):
    h.game.blink = True
    h.tick(1)
    return h.shot(name)


def main():
    h = Harness(TMP)
    h.tick(10)
    shots = []

    shots.append(grab(h, "title"))

    from game.player import PlayerState
    from game.monster import Monster, make_wild
    from game.world.overworld import Overworld
    from game.scenes import PartyMenu

    p = PlayerState()
    for key, lv in (("kitsune", 13), ("kappa", 13), ("tengu", 13)):
        p.add_monster(Monster(key, lv))
    p.add_monster(Monster("pixie", 11))
    p.give("herb", 4); p.give("sigil_l", 5); p.give("sigil_g", 2)
    p.seen.update(["kitsune", "kappa", "tengu", "pixie", "mandrake", "wisp"])
    p.bound.update(["kitsune", "kappa", "tengu", "pixie"])
    p.map_key = "village"; p.x, p.y = 11, 9
    h.game.player = p
    while h.game.scenes:
        h.game.pop()
    h.game.push(Overworld(h.game))
    h.tick(20)
    shots.append(grab(h, "village"))

    # A battle, paused on the command window with a half icon earned.
    ov = h.scene
    ov.start_battle([make_wild("mandrake", 11), make_wild("wisp", 12),
                     make_wild("golem", 12)])
    h.settle()
    for _ in range(300):
        h.tick(2)
        if getattr(h.scene, "mode", "") == "command":
            break
    sc = h.scene
    for i in range(len(sc.menu.items)):
        if sc.menu.label(i) == "Skill":
            sc.menu.index = i
    h.press(Z, 4)
    shots.append(grab(h, "skills"))
    for i, item in enumerate(sc.sub.items):
        if item[1].key == "ember":
            sc.sub.index = i
    h.press(Z, 4)
    h.press(Z, 2)
    for _ in range(120):
        h.tick(2)
        if h.scene.mode == "command":
            break
    shots.append(grab(h, "battle"))

    # Party detail.
    while h.game.scenes and type(h.game.scene).__name__ != "Overworld":
        h.game.pop()
    h.game.push(PartyMenu(h.game))
    h.tick(2)
    h.scene.detail = True
    h.tick(2)
    shots.append(grab(h, "monster"))
    h.game.pop()

    # The boss.
    for m in p.party:
        m.full_restore()
    ov = h.scene
    ov.start_battle([Monster("anubis", 15)], boss=True)
    h.settle()
    for _ in range(300):
        h.tick(2)
        if getattr(h.scene, "mode", "") == "command":
            break
    shots.append(grab(h, "boss"))

    # Compose: 2 columns, 3 rows, 2x scale, with a little padding.
    S, cols, pad = 2, 2, 8
    imgs = [pygame.image.load(s) for s in shots]
    w, hgt = 240 * S, 160 * S
    rows = (len(imgs) + cols - 1) // cols
    sheet = pygame.Surface((cols * w + (cols + 1) * pad,
                            rows * hgt + (rows + 1) * pad))
    sheet.fill((26, 24, 38))
    for i, im in enumerate(imgs):
        x = pad + (i % cols) * (w + pad)
        y = pad + (i // cols) * (hgt + pad)
        pygame.draw.rect(sheet, (72, 66, 104), (x - 2, y - 2, w + 4, hgt + 4))
        sheet.blit(pygame.transform.scale(im, (w, hgt)), (x, y))
    pygame.image.save(sheet, OUT)
    print("wrote", OUT, sheet.get_size())
    for s in shots:
        os.remove(s)
    os.rmdir(TMP)


if __name__ == "__main__":
    main()
