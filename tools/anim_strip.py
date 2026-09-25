"""Dev tool: film one monster acting in a real battle scene.

Usage: python tools/anim_strip.py <species> [skill] [out.png]

Stages the species as the foe, has it use the skill on the party, and grabs
frames of the canvas every few ticks, cropped to the stage, so the attack
animation can be checked frame by frame.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playtest import Harness
import pygame
from game.battle.engine import Battle, Action, ENEMY
from game.battle.scene import BattleScene
from game.data import skills as SK
from game.monster import Monster

key = sys.argv[1] if len(sys.argv) > 1 else "pixie"
skill_key = sys.argv[2] if len(sys.argv) > 2 else "strike"
out = sys.argv[3] if len(sys.argv) > 3 else "/tmp/anim.png"

h = Harness(os.path.join(os.path.dirname(out) or ".", "_anim_tmp"))
h.game.player = __import__("game.player", fromlist=["new_game"]).new_game(key)
foe = Monster(key, 12)
party = [Monster("golem", 12), Monster("kappa", 12)]
b = Battle(party, [foe], boss=False)
b.begin()
scene = BattleScene(h.game, b)
h.game.push(scene)
h.settle()
for _ in range(90):
    h.tick(1)
# make it the foe's turn and have it act
b.side = ENEMY
b.turns.full = 2
b.cursor = b.foes.index(foe)
skill = SK.get(skill_key)
targets = [foe] if skill.target == SK.SELF else (
    list(party) if skill.target == SK.ALL_FOES else [party[0]])
scene.run_action(Action("skill", skill, targets))
frames = []
for i in range(16):
    h.game.blink = True
    h.tick(3)
    frames.append(h.game.canvas.subsurface((40, 0, 400, 210)).copy())
cols = 4
sheet = pygame.Surface((cols * 404, (len(frames) + cols - 1) // cols * 214))
sheet.fill((20, 20, 28))
for i, f in enumerate(frames):
    sheet.blit(f, ((i % cols) * 404 + 2, (i // cols) * 214 + 2))
pygame.image.save(sheet, out)
print("wrote", out, sheet.get_size())
