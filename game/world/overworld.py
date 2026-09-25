"""The overworld: walking, talking, and stumbling into things in the grass."""

import random

import pygame

from .. import config, music, palette as P, sfx, ui
from ..app import Scene, CONFIRM, CANCEL, direction_of, RUN
from ..render.diorama import Diorama, TILE, Y_STEP
from ..render.particles import MoteField
from ..font import get_font
from ..monster import make_wild
from ..battle.engine import Battle
from ..battle.scene import BattleScene
from . import maps

STEP_TIME = 0.16
RUN_TIME = 0.095
DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


class Overworld(Scene):
    def __init__(self, game):
        super().__init__(game)
        self.map = maps.get(game.player.map_key)
        self.px = float(game.player.x)
        self.py = float(game.player.y)
        self.tx = game.player.x
        self.ty = game.player.y
        self.facing = game.player.facing
        self.moving = False
        self.move_t = 0.0
        self.move_dur = STEP_TIME
        self.from_x = self.px
        self.from_y = self.py
        self.frame = 0
        self.anim_t = 0.0
        self.rng = random.Random()
        self.since_encounter = 0
        self.banner_t = 2.0
        self.rustle = 0.0
        self.dio = None
        self.motes = None
        self.cam = (0.0, 0.0)

    # -- helpers -----------------------------------------------------------
    @property
    def grade(self):
        return self.map.grade

    def enter(self):
        self.map = maps.get(self.game.player.map_key)
        self.banner_t = 2.0
        self._setup_render()
        music.play(self.map.music)

    def _setup_render(self):
        if self.dio is None:
            self.dio = self.game.assets.get("diorama")
            if self.dio is None:
                self.dio = Diorama(self.game.assets["props"],
                                   self.game.assets["ground"])
                self.game.assets["diorama"] = self.dio
        cfg = self.map.motes or {}
        self.motes = MoteField(
            (config.INTERNAL_W, config.INTERNAL_H),
            count=cfg.get("count", 24), colour=cfg.get("colour", (255, 236, 190)),
            speed=cfg.get("speed", 6.0), size_px=cfg.get("size", 2))

    def sync(self):
        p = self.game.player
        p.map_key = self.map.key
        p.x, p.y = self.tx, self.ty
        p.facing = self.facing

    def camera(self):
        return self.dio.camera(self.px, self.py, self.map)

    def blocked(self, x, y):
        if self.map.solid(x, y):
            return True
        return self.map.npc_at(x, y) is not None

    # -- input --------------------------------------------------------------
    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        if event.key in CONFIRM:
            self.interact()
        elif event.key in CANCEL:
            from ..scenes import PauseMenu
            sfx.play("confirm")
            self.game.push(PauseMenu(self.game))

    def update(self, dt):
        self.banner_t = max(0.0, self.banner_t - dt)
        self.rustle = max(0.0, self.rustle - dt)
        if self.motes is None:
            self._setup_render()
        self.motes.update(dt)
        if self.game.busy:
            return
        if self.moving:
            self.move_t += dt
            k = min(1.0, self.move_t / self.move_dur)
            self.px = self.from_x + (self.tx - self.from_x) * k
            self.py = self.from_y + (self.ty - self.from_y) * k
            self.anim_t += dt
            if self.anim_t > self.move_dur * 0.5:
                self.anim_t = 0.0
                self.frame ^= 1
            if k >= 1.0:
                self.moving = False
                self.arrive()
            return
        keys = pygame.key.get_pressed()
        d = None
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            d = "up"
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            d = "down"
        elif keys[pygame.K_LEFT] or keys[pygame.K_a]:
            d = "left"
        elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            d = "right"
        if d:
            self.try_step(d, any(keys[k] for k in RUN))

    def try_step(self, d, running):
        self.facing = d
        dx, dy = DIRS[d]
        nx, ny = self.tx + dx, self.ty + dy
        if self.blocked(nx, ny):
            self.frame = 0
            self.sync()
            return
        self.from_x, self.from_y = float(self.tx), float(self.ty)
        self.tx, self.ty = nx, ny
        self.moving = True
        self.move_t = 0.0
        self.move_dur = RUN_TIME if running else STEP_TIME

    def arrive(self):
        p = self.game.player
        p.steps += 1
        self.sync()
        warp = self.map.warps.get((self.tx, self.ty))
        if warp:
            self.do_warp(warp)
            return
        if self.map.tag(self.tx, self.ty) == "encounter":
            self.rustle = 0.25
            sfx.play("step")
            self.roll_encounter()

    def do_warp(self, warp):
        key, x, y = warp
        sfx.play("warp")

        def arrive():
            self.map = maps.get(key)
            self.tx, self.ty = x, y
            self.px, self.py = float(x), float(y)
            self.game.player.map_key = key
            self.sync()
            self.banner_t = 2.0
            self._setup_render()
            music.play(self.map.music)

        self.game.fade_to(arrive, 0.25)

    # -- encounters ----------------------------------------------------------
    def roll_encounter(self):
        if not self.map.encounters:
            return
        self.since_encounter += 1
        chance = self.map.rate
        if self.since_encounter < 4:
            chance *= 0.35          # brief grace period after a fight
        if self.rng.random() > chance:
            return
        party = self.game.player.fielded()
        if not party:
            return
        self.since_encounter = 0
        foes = self.roll_group()
        advantage = 0
        roll = self.rng.random()
        if roll < 0.14:
            advantage = 1
        elif roll > 0.92:
            advantage = -1
        self.start_battle(foes, advantage=advantage)

    def roll_group(self):
        lo, hi = self.map.group
        party = self.game.player.active()
        top = max((m.level for m in party), default=3)
        count = self.rng.randint(lo, hi)
        if top <= 6:
            count = min(count, 2)
        table = self.map.encounters
        total = sum(w for _, _, _, w in table)
        foes = []
        for _ in range(count):
            r = self.rng.uniform(0, total)
            acc = 0
            for key, l0, l1, w in table:
                acc += w
                if r <= acc:
                    lvl = self.rng.randint(l0, l1)
                    foes.append(make_wild(key, lvl, self.rng))
                    break
        return foes or [make_wild(table[0][0], table[0][1], self.rng)]

    def start_battle(self, foes, advantage=0, boss=False):
        player = self.game.player
        if not player.fielded():
            from ..scenes import Dialogue
            self.game.push(Dialogue(self.game, [
                "None of your monsters can stand.\nFind a place to rest first."]))
            return
        party = [m for m in player.active()]
        battle = Battle(party, foes, inventory=player.inventory,
                        rng=self.rng, boss=boss, advantage=advantage,
                        area=self.map.name)

        def begin():
            self.game.push(BattleScene(self.game, battle, self.after_battle))

        self.game.battle_wipe(begin)

    def after_battle(self, result):
        player = self.game.player
        music.play(self.map.music, restart=True)
        if result == "lose" and self.pending_boss:
            # Losing to the boss is a lesson, not a penalty: wake at the
            # shrine door, whole, and be told what went wrong.
            self.pending_boss = False
            from ..scenes import Dialogue

            def wake():
                player.heal_all()
                player.map_key = "shrine"
                player.x, player.y = 2, 13
                self.map = maps.get("shrine")
                self.tx, self.ty = 2, 13
                self.px, self.py = 2.0, 13.0
                self.facing = "right"
                self.sync()
                self.game.push(Dialogue(self.game, [
                    "You wake at the shrine door, whole.\nThe scale has sent you back.",
                    '"Lighter," says the voice. "Come back\nlighter. Ward your hearts before they\nare weighed, and strip my gold."',
                ], "Anubis"))
            self.game.fade_to(wake, 0.5)
        elif result == "lose":
            def revive():
                player.heal_all()
                player.map_key = "village"
                player.x, player.y = 13, 13
                self.map = maps.get("village")
                self.tx, self.ty = 13, 13
                self.px, self.py = 13.0, 13.0
                self.facing = "down"
                self.sync()
                self.banner_t = 2.0
            self.game.fade_to(revive, 0.5)
        elif result == "win" and self.pending_boss:
            player.flags.add("boss_defeated")
            self.pending_boss = False
            from ..scenes import Dialogue
            self.game.push(Dialogue(self.game, [
                "The scale tips, and is still.",
                "Anubis inclines his head.",
                '"Bound, then. Carry the weight\nyourself for a while."',
                "-- proof of concept complete --\nThanks for playing!",
            ]))

    pending_boss = False

    # -- interaction ----------------------------------------------------------
    def interact(self):
        dx, dy = DIRS[self.facing]
        fx, fy = self.tx + dx, self.ty + dy
        npc = self.map.npc_at(fx, fy)
        from ..scenes import Dialogue, ShopMenu
        if npc:
            sfx.play("confirm")
            self.game.push(Dialogue(self.game, npc.lines, npc.name,
                                    on_close=lambda: self.npc_action(npc)))
            return
        tag = self.map.tag(fx, fy)
        if tag == "sign" and (fx, fy) in self.map.signs:
            sfx.play("confirm")
            self.game.push(Dialogue(self.game, [self.map.signs[(fx, fy)]]))
        elif tag == "altar":
            self.try_boss()
        elif tag == "fountain":
            self.game.push(Dialogue(self.game, [
                "The fountain runs clear.\nSomething small darts away under it."]))
        elif tag == "door":
            self.game.push(Dialogue(self.game, ["The door is shut fast."]))

    def npc_action(self, npc):
        from ..scenes import Dialogue, ShopMenu
        if npc.action == "shop":
            self.game.push(ShopMenu(self.game))
        elif npc.action == "heal":
            self.game.player.heal_all()
            sfx.play("level")
            self.game.push(Dialogue(self.game, [
                "Your monsters are rested and whole."]))

    def try_boss(self):
        player = self.game.player
        from ..scenes import Dialogue
        if "boss_defeated" in player.flags:
            self.game.push(Dialogue(self.game, [
                "The altar is quiet. The scale hangs\nlevel."]))
            return
        lines = [
            "The scale on the altar swings, though\nthere is no wind.",
            '"You have bound the small things,"\nsays a voice like a closing door.',
            '"Now be weighed."',
        ]

        def go():
            self.pending_boss = True
            from ..monster import Monster
            # He meets you at your own level, from 14 to 17. Past that,
            # out-levelling him is a slower way through, and a fair one.
            lvl = max(14, min(17, max(m.level for m in player.active())))
            self.start_battle([Monster("anubis", lvl)], boss=True)

        self.game.push(Dialogue(self.game, lines, "Anubis", on_close=go))

    # -- drawing ---------------------------------------------------------------
    def draw_world(self, canvas):
        if self.dio is None:
            self._setup_render()
        fx = self.game.fx
        tiles = self.game.assets["tiles"]
        hero = self.game.assets["hero2x"]
        npc_art = self.game.assets["npcs2x"]
        cam = self.camera()
        self.cam = cam
        self._sky(canvas)
        actors = []
        for n in self.map.npcs:
            actors.append({"x": float(n.x), "y": float(n.y),
                           "sprite": npc_art[n.sprite]})
        frame = self.frame if self.moving else 0
        actors.append({"x": self.px, "y": self.py,
                       "sprite": hero[self.facing][frame]})
        water = int(self.game.time * 3) % 4
        self.dio.draw(canvas, self.map, cam, actors, self.game.time, fx, water)
        # map lights, placed in world space
        for tx, ty, radius, colour, strength in self.map.lights:
            h = self.dio.ground_height(self.map, tx, ty)
            sx, sy = self.dio.project(tx, ty, h, cam)
            if -120 < sx < config.INTERNAL_W + 120:
                fx.add_light(sx + TILE / 2, sy + Y_STEP / 2, radius, colour,
                             strength)
        self.motes.draw(canvas, self.game.time)
        if self.map.tag(self.tx, self.ty) == "encounter":
            self._rustle_world(canvas, cam)

    def _sky(self, canvas):
        """A graded backdrop so the diorama sits in air rather than on black."""
        top, bot = self.SKY.get(self.map.grade, self.SKY["route"])
        h = config.INTERNAL_H
        band = 8
        for y in range(0, h, band):
            k = y / float(h)
            col = tuple(int(top[i] + (bot[i] - top[i]) * k) for i in range(3))
            canvas.fill(col, (0, y, config.INTERNAL_W, band))

    SKY = {
        "village": ((126, 166, 214), (206, 214, 198)),
        "route": ((118, 162, 206), (198, 214, 196)),
        "shrine": ((46, 52, 104), (126, 118, 168)),
        "ruins": ((148, 168, 210), (238, 214, 178)),
    }

    def _rustle_world(self, canvas, cam):
        h = self.dio.ground_height(self.map, self.tx, self.ty)
        sx, sy = self.dio.project(self.px, self.py, h, cam)
        base = sy + Y_STEP - 4
        for i in range(5):
            x = int(sx) + 3 + i * 6
            k = 4 + (i % 2) * 3
            pygame.draw.line(canvas, P.TALLGRASS_L, (x, base), (x + 2, base - k))

    def draw(self, surf):
        if self.banner_t > 0:
            self.draw_banner(surf)

    def draw_banner(self, surf):
        font = get_font()
        alpha = min(1.0, self.banner_t / 0.5)
        w = font.width(self.map.name) + 16
        ui.panel(surf, (6, 6, w, 15), P.NEAR_BLACK, P.WIN_EDGE_D)
        font.draw(surf, self.map.name, 14, 10, P.WHITE)
