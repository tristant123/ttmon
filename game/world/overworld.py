"""The overworld: walking, talking, and stumbling into things in the grass."""

import random

import pygame

from .. import config, palette as P, sfx, ui
from ..app import Scene, CONFIRM, CANCEL, direction_of, RUN
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

    # -- helpers -----------------------------------------------------------
    def enter(self):
        self.map = maps.get(self.game.player.map_key)
        self.banner_t = 2.0

    def sync(self):
        p = self.game.player
        p.map_key = self.map.key
        p.x, p.y = self.tx, self.ty
        p.facing = self.facing

    def camera(self):
        cx = self.px * config.TILE + config.TILE // 2 - config.INTERNAL_W // 2
        cy = self.py * config.TILE + config.TILE // 2 - config.INTERNAL_H // 2
        max_x = self.map.w * config.TILE - config.INTERNAL_W
        max_y = self.map.h * config.TILE - config.INTERNAL_H
        return (max(0, min(max_x, int(cx))) if max_x > 0 else (max_x // 2),
                max(0, min(max_y, int(cy))) if max_y > 0 else (max_y // 2))

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
        if result == "lose":
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
            lvl = max(12, min(18, max(m.level for m in player.active()) + 1))
            self.start_battle([Monster("anubis", lvl)], boss=True)

        self.game.push(Dialogue(self.game, lines, "Anubis", on_close=go))

    # -- drawing ---------------------------------------------------------------
    def draw(self, surf):
        tiles = self.game.assets["tiles"]
        hero = self.game.assets["hero"]
        npcs = self.game.assets["npcs"]
        cam_x, cam_y = self.camera()
        t = config.TILE
        x0 = max(0, cam_x // t)
        y0 = max(0, cam_y // t)
        x1 = min(self.map.w, x0 + config.VIEW_TILES_W + 2)
        y1 = min(self.map.h, y0 + config.VIEW_TILES_H + 2)
        water_phase = int(self.game.time * 2) % 2
        for y in range(y0, y1):
            for x in range(x0, x1):
                name = self.map.tile(x, y)
                if name == "water" and water_phase:
                    name = "water_b"
                img = tiles.get(name)
                if img is not None:
                    surf.blit(img, (x * t - cam_x, y * t - cam_y))
        # NPCs and the player, sorted so lower sprites overlap higher ones
        drawables = []
        for n in self.map.npcs:
            drawables.append((n.y, n.x * t - cam_x, n.y * t - cam_y - 4,
                              npcs[n.sprite]))
        hx = self.px * t - cam_x
        hy = self.py * t - cam_y - 4
        drawables.append((self.py, hx, hy,
                          hero[self.facing][self.frame if self.moving else 0]))
        for _, dx, dy, img in sorted(drawables, key=lambda d: d[0]):
            surf.blit(img, (int(dx), int(dy)))
        if self.map.tag(self.tx, self.ty) == "encounter":
            self.draw_rustle(surf, hx, hy)
        if self.banner_t > 0:
            self.draw_banner(surf)

    def draw_rustle(self, surf, hx, hy):
        col = P.TALLGRASS_L
        for i in range(4):
            x = int(hx) + 2 + i * 4
            y = int(hy) + 17 + (i % 2)
            pygame.draw.line(surf, col, (x, y + 3), (x + 1, y), 1)

    def draw_banner(self, surf):
        font = get_font()
        alpha = min(1.0, self.banner_t / 0.5)
        w = font.width(self.map.name) + 16
        ui.panel(surf, (6, 6, w, 15), P.NEAR_BLACK, P.WIN_EDGE_D)
        font.draw(surf, self.map.name, 14, 10, P.WHITE)
