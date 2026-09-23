"""The battle screen: rendering, input and event playback."""

import math

import pygame

from .. import config, palette as P, sfx, ui as uimod
from ..app import Scene, CONFIRM, CANCEL, direction_of
from ..render import arena
from ..render.particles import Sparks
from ..font import get_font, CURSOR, LINE_H
from ..art import monsters as MART
from ..data import skills as SK
from ..data.items import ITEMS
from ..data.elements import (NAMES as EL_NAMES, COLORS as EL_COLORS,
                             ATTACK_ELEMENTS, AFFINITY_TAGS, AFFINITY_COLORS,
                             NEUTRAL, WEAK, RESIST, NULL, DRAIN, REPEL, PHYS,
                             HEAL, SUPPORT)
from .engine import Action, PLAYER, ENEMY
from . import effects

# The fight is staged on the full-resolution canvas; the UI keeps its own
# 240x160 space, so every world coordinate here is exactly twice a UI one.
C_ENEMY_FEET = 92           # where an enemy's feet meet the ground
C_ALLY_FEET = 188
C_SPRITE = 64               # 32x32 art drawn at 2x
SPRITE = 32                 # UI-space sprite box

# Slim party plates, so the stage keeps most of the screen
STATUS_BOXES = [(2, 96, 76, 15), (82, 96, 76, 15), (162, 96, 76, 15)]
BOTTOM = (0, 112, 240, 48)

# terrain each area fights on, and the sky above it
AREA_FLOOR = {
    "village": ("grass", ((104, 138, 196), (196, 206, 206))),
    "route": ("grass", ((110, 150, 202), (192, 208, 198))),
    "shrine": ("floor", ((44, 52, 106), (128, 126, 168))),
}


def canvas_slots(count, feet_y, span=142):
    """Centred stage positions: (centre x, feet y)."""
    count = max(1, min(3, count))
    total = (count - 1) * span
    x0 = config.INTERNAL_W // 2 - total // 2
    return [(x0 + i * span, feet_y) for i in range(count)]


class BattleScene(Scene):
    def __init__(self, game, battle, on_end=None):
        super().__init__(game)
        self.b = battle
        self.on_end = on_end
        self.box = uimod.TextBox((4, BOTTOM[1] + 3, 232, BOTTOM[3] - 6))
        self.queue = []
        self.timer = 0.0
        self.mode = "events"
        self.floats = []
        self.shakes = {}
        self.flash = {}
        self.fainting = {}
        self.effect = None
        self.sigil = None
        self.actor_mark = None
        self.menu = uimod.Menu([], (0, 0, 0, 0))
        self.sub = None
        self.pending = None        # (kind, payload) awaiting a target
        self.prev_mode = "command"
        self.targets = []
        self.target_i = 0
        self.result_lines = []
        self.result_i = 0
        self.banner = None
        self.banner_t = 0.0
        self.sparks = Sparks()
        self.floor = None
        self.shake_world = 0.0

    # -- setup -------------------------------------------------------------
    @property
    def grade(self):
        return "boss" if self.b.boss else "battle"

    def enter(self):
        sfx.play("encounter")
        self._build_stage()
        self.queue = list(self.b.begin())
        self.timer = 0.2

    def _build_stage(self):
        """Bake the arena floor for wherever this fight is happening."""
        tiles = self.game.assets["tiles"]
        key = self.game.player.map_key if self.game.player else "route"
        ground, sky = AREA_FLOOR.get(key, AREA_FLOOR["route"])
        self.floor = arena.build_floor(tiles[ground], sky=sky)
        props = [tiles["tree"], tiles["rock"]]
        if key == "shrine":
            props = [tiles["tree"], tiles["shrine_bl"], tiles["rock"]]
        arena.add_backdrop(self.floor, props)

    # -- geometry ----------------------------------------------------------
    def stage_pos(self, mon):
        """Canvas-space (centre x, feet y) for a combatant."""
        if mon in self.b.foes:
            slots = canvas_slots(len(self.b.foes), C_ENEMY_FEET)
            i = self.b.foes.index(mon)
            return slots[i] if i < len(slots) else slots[-1]
        party = self.b.party[:3]
        slots = canvas_slots(len(party), C_ALLY_FEET, span=150)
        i = self.b.party.index(mon) if mon in self.b.party else 0
        return slots[i] if i < len(slots) else slots[-1]

    def crect_of(self, mon):
        """Canvas-space sprite box. Bosses are drawn at a larger scale, and
        stand further forward so their full height fits on the stage."""
        cx, feet = self.stage_pos(mon)
        size = 32 * getattr(mon.species, "scale", 2)
        if mon in self.b.foes and size > C_SPRITE:
            feet += (size - C_SPRITE) // 2
        return pygame.Rect(cx - size // 2, feet - size, size, size)

    def rect_of(self, mon):
        """The same box in UI space, for damage numbers and cursors."""
        c = self.crect_of(mon)
        return pygame.Rect(c.x // 2, c.y // 2, c.w // 2, c.h // 2)

    # -- event playback ----------------------------------------------------
    def update(self, dt):
        for f in self.floats:
            f.update(dt)
        self.floats = [f for f in self.floats if not f.dead]
        for k in list(self.shakes):
            self.shakes[k].update(dt)
            if self.shakes[k].dead:
                del self.shakes[k]
        for k in list(self.flash):
            self.flash[k] -= dt
            if self.flash[k] <= 0:
                del self.flash[k]
        for k in list(self.fainting):
            self.fainting[k] = min(1.0, self.fainting[k] + dt * 2.2)
        if self.effect:
            self.effect["t"] += dt
            if self.effect["t"] >= self.effect["dur"]:
                self.effect = None
        if self.sigil:
            self.sigil["t"] += dt
            if self.sigil["t"] >= self.sigil["dur"]:
                self.sigil = None
        if self.banner:
            self.banner_t += dt
            if self.banner_t > 0.75:
                self.banner = None
        self.sparks.update(dt)
        self.shake_world = max(0.0, self.shake_world - dt)
        self.box.update(dt)

        if self.mode != "events":
            return
        self.timer -= dt
        if self.timer > 0:
            return
        if self.queue:
            self.timer = self.play(self.queue.pop(0))
            return
        if self.b.finished:
            self.finish()
            return
        if self.b.waiting_for_input:
            self.open_command()
        else:
            self.queue = list(self.b.step())
            if not self.queue:
                self.queue = list(self.b._settle())
                if not self.queue and not self.b.finished:
                    self.b.finished = "win" if not self.b.living(ENEMY) else None
                    if self.b.finished is None:
                        self.queue = [{"type": "msg", "text": "..."}]

    def play(self, e):
        t = e["type"]
        if t == "msg":
            self.box.show(e["text"])
            return min(1.15, 0.35 + len(e["text"]) / 95.0)
        if t == "phase":
            self.banner = e["text"]
            self.banner_t = 0.0
            sfx.play("turn")
            return 0.45
        if t == "act":
            self.actor_mark = e.get("actor")
            return 0.12
        if t == "anim":
            skill = e.get("skill")
            targets = e.get("targets") or []
            if targets:
                r = self.crect_of(targets[0])
                if len(targets) > 1:
                    r = pygame.Rect(0, r.y, config.INTERNAL_W, C_SPRITE)
                kind = "heal" if skill.kind in (SK.RECOVER, SK.REVIVE) else "attack"
                self.effect = {"element": skill.element, "rect": r, "t": 0.0,
                               "dur": 0.42, "kind": kind}
            if skill.element == PHYS:
                sfx.play("hit")
            elif skill.kind in (SK.RECOVER, SK.REVIVE, SK.CURE):
                sfx.play("heal")
            else:
                sfx.play("magic")
            return 0.34
        if t == "dmg":
            tgt = e["target"]
            aff = e.get("affinity", NEUTRAL)
            colour = P.WHITE
            if aff == WEAK:
                colour = P.HP_BAD
                sfx.play("weak")
            elif e.get("crit"):
                colour = P.ICON_FULL
                sfx.play("crit")
            elif aff == RESIST:
                colour = P.MP_FILL
                sfx.play("hit")
            else:
                sfx.play("hit")
            r = self.rect_of(tgt)
            self.floats.append(effects.FloatText(
                str(e["amount"]), r.centerx, r.y + 6, colour))
            self.shakes[id(tgt)] = effects.Shake(3.5 if aff != WEAK else 5.0)
            self.flash[id(tgt)] = 0.14
            c = self.crect_of(tgt)
            self.sparks.burst(c.centerx, c.centery, colour,
                              count=16 if aff == WEAK else 9,
                              speed=110 if aff == WEAK else 70,
                              rng=self.b.rng)
            if aff == WEAK or e.get("crit"):
                self.shake_world = 0.22
            return 0.3
        if t == "heal":
            tgt = e["target"]
            r = self.rect_of(tgt)
            self.floats.append(effects.FloatText(
                "+" + str(e["amount"]), r.centerx, r.y + 6, P.HP_GOOD))
            sfx.play("heal")
            return 0.3
        if t == "mp":
            tgt = e["target"]
            r = self.rect_of(tgt)
            self.floats.append(effects.FloatText(
                "+%d MP" % e["amount"], r.centerx, r.y + 6, P.MP_FILL))
            return 0.3
        if t == "miss":
            r = self.rect_of(e["target"])
            self.floats.append(effects.FloatText("MISS", r.centerx, r.y + 6,
                                                 P.GREY_L))
            return 0.3
        if t == "affinity":
            aff = e["affinity"]
            r = self.rect_of(e["target"])
            label = {NULL: "NULL", DRAIN: "DRAIN", REPEL: "REPEL"}.get(aff, "")
            self.floats.append(effects.FloatText(label, r.centerx, r.y + 4,
                                                 AFFINITY_COLORS[aff]))
            sfx.play("repel" if aff in (DRAIN, REPEL) else "null")
            return 0.42
        if t == "instakill":
            r = self.rect_of(e["target"])
            self.floats.append(effects.FloatText("SLAIN", r.centerx, r.y,
                                                 P.EL_DARK))
            sfx.play("faint")
            return 0.4
        if t == "faint":
            self.fainting[id(e["target"])] = 0.0
            sfx.play("faint")
            return 0.45
        if t == "revive":
            self.fainting.pop(id(e["target"]), None)
            sfx.play("heal")
            return 0.3
        if t == "status":
            r = self.rect_of(e["target"])
            self.floats.append(effects.FloatText(
                e["ailment"].upper()[:4], r.centerx, r.y + 4, P.EL_DARK))
            return 0.35
        if t == "buff":
            tgt = e["target"]
            if e.get("delta"):
                r = self.rect_of(tgt)
                arrow = "UP" if e["delta"] > 0 else "DOWN"
                self.floats.append(effects.FloatText(
                    "%s %s" % (e["stat"].upper(), arrow), r.centerx, r.y + 4,
                    P.ICON_FULL if e["delta"] > 0 else P.EL_DARK))
            return 0.22
        if t == "capture_try":
            tgt = e["target"]
            r = self.crect_of(tgt)
            self.sigil = {"t": 0.0, "dur": 1.0, "start": (240, 250),
                          "end": (r.centerx, r.centery), "caught": None}
            sfx.play("catch_throw")
            return 1.0
        if t == "capture":
            if e["success"]:
                sfx.play("catch_ok")
                self.fainting[id(e["target"])] = 0.0
            else:
                sfx.play("catch_no")
            return 0.4
        if t == "scan":
            e["target"].scanned = True
            return 0.25
        if t == "cost":
            return 0.12
        if t == "end":
            return 0.25
        return 0.15

    # -- command menus -------------------------------------------------------
    def open_command(self):
        self.mode = "command"
        self.actor_mark = self.b.current_actor
        actor = self.b.current_actor
        items = ["Attack", "Skill", "Item", "Bind", "Guard", "Pass"]
        if self.b.can_flee:
            items.append("Flee")
        self.menu = uimod.Menu(items, (0, BOTTOM[1], 240, BOTTOM[3]), columns=2,
                            item_h=10)
        self.box.show("%s's move." % actor.name)
        self.box.skip()

    def open_skills(self):
        actor = self.b.current_actor
        rows = []
        for s in actor.skill_objs():
            rows.append((s.name, s))
        self.sub = uimod.Menu(rows, (0, 74, 240, 86), columns=2, item_h=10)
        for i, (_, s) in enumerate(rows):
            self.sub.enabled[i] = actor.can_pay(s)
            self.sub.notes[i] = s.cost_text()
        self.mode = "skill"

    def open_items(self, capture=False):
        bag = []
        for item, n in self.game.player.bag_items(battle=True):
            if item.is_capture != capture:
                continue
            bag.append(("%s" % item.name, item))
        if not bag:
            self.box.show("No sigils left." if capture else "The bag is empty.")
            self.box.skip()
            sfx.play("cancel")
            return
        self.sub = uimod.Menu(bag, (0, 74, 240, 86), columns=2, item_h=10)
        for i, (_, item) in enumerate(bag):
            self.sub.notes[i] = "x%d" % self.game.player.count(item.key)
        self.mode = "sigil" if capture else "item"

    def start_target(self, kind, payload, side=ENEMY, allow_downed=False):
        pool = self.b.living(side)
        if allow_downed:
            pool = list(self.b.members(side))
        if not pool:
            sfx.play("cancel")
            return
        self.pending = (kind, payload)
        self.targets = pool
        self.target_i = 0
        self.prev_mode = self.mode
        self.mode = "target"

    def confirm_target(self):
        kind, payload = self.pending
        target = self.targets[self.target_i]
        self.pending = None
        if kind == "skill":
            skill = payload
            if skill.target in (SK.ALL_FOES, SK.ALL_ALLIES):
                tg = self.b.living(ENEMY if skill.target == SK.ALL_FOES
                                   else PLAYER)
            else:
                tg = [target]
            self.run_action(Action("skill", skill, tg))
        elif kind == "item":
            self.run_action(Action("item", targets=[target], item=payload.key))
        elif kind == "capture":
            self.run_action(Action("capture", targets=[target],
                                   item=payload.key))

    def run_action(self, action):
        self.mode = "events"
        self.sub = None
        self.effect = None
        self.queue = list(self.b.execute(action))
        self.timer = 0.05

    # -- input ---------------------------------------------------------------
    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        key = event.key
        if self.mode == "events":
            if key in CONFIRM:
                self.box.skip()
                self.timer = min(self.timer, 0.03)
            return
        if self.mode == "result":
            if key in CONFIRM or key in CANCEL:
                self.result_i += 1
                if self.result_i >= len(self.result_lines):
                    self.close()
                else:
                    self.box.show(self.result_lines[self.result_i])
                    sfx.play("confirm")
            return
        d = direction_of(key)
        if self.mode == "command":
            if d and self.menu.move(
                    {"left": -1, "right": 1}.get(d, 0),
                    {"up": -1, "down": 1}.get(d, 0)):
                sfx.play("cursor")
            elif key in CONFIRM:
                sfx.play("confirm")
                self.choose_command(self.menu.payload())
            return
        if self.mode in ("skill", "item", "sigil"):
            if d and self.sub.move({"left": -1, "right": 1}.get(d, 0),
                                   {"up": -1, "down": 1}.get(d, 0)):
                sfx.play("cursor")
            elif key in CONFIRM:
                self.choose_sub()
            elif key in CANCEL:
                sfx.play("cancel")
                self.sub = None
                self.open_command()
            return
        if self.mode == "target":
            if d in ("left", "up"):
                self.target_i = (self.target_i - 1) % len(self.targets)
                sfx.play("cursor")
            elif d in ("right", "down"):
                self.target_i = (self.target_i + 1) % len(self.targets)
                sfx.play("cursor")
            elif key in CONFIRM:
                sfx.play("confirm")
                self.confirm_target()
            elif key in CANCEL:
                sfx.play("cancel")
                self.pending = None
                if self.sub is not None and self.prev_mode in (
                        "skill", "item", "sigil"):
                    self.mode = self.prev_mode
                else:
                    self.open_command()
            return

    def choose_command(self, cmd):
        actor = self.b.current_actor
        if cmd == "Attack":
            self.start_target("skill", SK.basic())
        elif cmd == "Skill":
            self.open_skills()
        elif cmd == "Item":
            self.open_items(capture=False)
        elif cmd == "Bind":
            self.open_items(capture=True)
        elif cmd == "Guard":
            self.run_action(Action("guard"))
        elif cmd == "Pass":
            self.run_action(Action("pass"))
        elif cmd == "Flee":
            self.run_action(Action("flee"))

    def choose_sub(self):
        payload = self.sub.payload()
        if self.mode == "skill":
            actor = self.b.current_actor
            if not actor.can_pay(payload):
                sfx.play("cancel")
                return
            sfx.play("confirm")
            if payload.target in (SK.ONE_ALLY, SK.ALL_ALLIES):
                self.start_target("skill", payload, PLAYER,
                                  allow_downed=payload.kind == SK.REVIVE)
            elif payload.target == SK.SELF:
                self.run_action(Action("skill", payload, [actor]))
            else:
                self.start_target("skill", payload, ENEMY)
        elif self.mode == "item":
            sfx.play("confirm")
            self.start_target("item", payload, PLAYER, allow_downed=True)
        elif self.mode == "sigil":
            sfx.play("confirm")
            self.start_target("capture", payload, ENEMY)

    # -- end of battle --------------------------------------------------------
    def finish(self):
        player = self.game.player
        res = self.b.finished
        lines = []
        if res == "win":
            sfx.play("victory")
            xp, gold = self.b.rewards()
            player.gold += gold
            lines.append("The field is yours.")
            if gold:
                lines.append("Found %d coin." % gold)
            for mon in self.b.party:
                if mon.down or xp <= 0:
                    continue
                grew = mon.gain_xp(xp)
                for kind, payload in grew:
                    if kind == "level":
                        lines.append("%s reached Lv%d!" % (mon.name, payload))
                    else:
                        lines.append("%s learned %s!"
                                     % (mon.name, SK.get(payload).name))
            if xp > 0:
                lines.insert(1, "Each survivor gained %d XP." % xp)
        elif res == "lose":
            sfx.play("defeat")
            lost = int(player.gold * 0.3)
            player.gold -= lost
            lines.append("Your monsters can fight no more...")
            lines.append("You wake at the Hollow, %d coin lighter." % lost)
        elif res == "fled":
            lines.append("You got away.")
        for mon in self.b.captured:
            player.seen.add(mon.species.key)
            if player.add_monster(mon):
                lines.append("%s was bound to your sigil." % mon.name)
            else:
                lines.append("Your party is full. %s slipped away."
                             % mon.name)
        for mon in self.b.foes + self.b.party:
            player.seen.add(mon.species.key)
        if not lines:
            lines.append("The battle ends.")
        self.result_lines = lines
        self.result_i = 0
        self.mode = "result"
        self.box.show(lines[0])

    def close(self):
        for m in self.game.player.party:
            m.reset_battle_state()
        result = self.b.finished
        self.game.pop()
        if self.on_end:
            self.on_end(result)

    # -- drawing -----------------------------------------------------------
    def draw_world(self, canvas):
        """The stage: baked floor, billboarded combatants, spell effects."""
        if self.floor is None:
            self._build_stage()
        ox, oy = 0, 0
        if self.shake_world > 0:
            k = self.shake_world / 0.22
            ox = int(math.sin(self.game.time * 90) * 5 * k)
            oy = int(math.cos(self.game.time * 70) * 3 * k)
        canvas.blit(self.floor, (ox, oy))
        for mon in self.b.foes:
            self.draw_monster(canvas, mon, enemy=True)
        for mon in self.b.party[:3]:
            self.draw_monster(canvas, mon, enemy=False)
        fx = self.game.fx
        if self.effect:
            e = self.effect
            k = e["t"] / e["dur"]
            effects.draw_effect(canvas, e["element"], e["rect"], k, e["kind"])
            col = EL_COLORS.get(e["element"], P.WHITE)
            r = e["rect"]
            fx.add_light(r.centerx, r.centery, 90,
                         col, 0.85 * (1.0 - k))
        if self.sigil:
            sg = self.sigil
            effects.draw_sigil_throw(canvas, sg["start"], sg["end"],
                                     sg["t"] / sg["dur"], sg["caught"])
        self.sparks.draw(canvas)
        if self.b.boss:
            for mon in self.b.foes:
                c = self.crect_of(mon)
                fx.add_light(c.centerx, c.centery - 6, 86, (196, 150, 255),
                             0.30 + 0.06 * math.sin(self.game.time * 2.0))

    def draw_monster(self, canvas, mon, enemy):
        rect = self.crect_of(mon)
        spr = self.game.assets["mon_scaled"](mon.art,
                                             getattr(mon.species, "scale", 2))
        if not enemy:
            spr = pygame.transform.flip(spr, True, False)
        fade = self.fainting.get(id(mon))
        if mon.down and fade is None:
            return
        dx, dy = 0, 0
        sh = self.shakes.get(id(mon))
        if sh:
            sdx, sdy = sh.offset()
            dx, dy = sdx * 2, sdy * 2
        img = spr
        alpha = 255
        if fade is not None:
            if fade >= 1.0:
                return
            alpha = int(255 * (1.0 - fade))
            dy += int(fade * 18)
        if id(mon) in self.flash:
            img = img.copy()
            img.fill((96, 96, 96, 0), special_flags=pygame.BLEND_RGB_ADD)
        elif alpha < 255:
            img = img.copy()
        if alpha < 255:
            img.set_alpha(alpha)
        bob = math.sin(self.game.time * 2.0 + rect.x * 0.05) * 2.0
        feet = rect.bottom + dy + int(bob)
        shadow = arena.ground_shadow(max(20, rect.w - 10),
                                     10 + rect.w // 12)
        if alpha < 255:
            shadow = shadow.copy()
            shadow.set_alpha(alpha)
        canvas.blit(shadow, (rect.x + 5 + dx,
                             feet - shadow.get_height() + 4))
        canvas.blit(img, (rect.x + dx, rect.y + dy + int(bob)))

    def draw(self, ui):
        """The interface layer, authored at 240x160 and never blurred."""
        for mon in self.b.foes:
            if not mon.down:
                self.draw_enemy_plate(ui, mon)
        for f in self.floats:
            f.draw(ui)
        self.draw_status(ui)
        self.draw_turn_strip(ui)
        if self.mode == "command":
            self.draw_command(ui)
        elif self.mode in ("skill", "item", "sigil"):
            self.draw_sub(ui)
        elif self.mode == "target":
            self.draw_target(ui)
        else:
            self.box.draw(ui, arrow=self.mode == "result",
                          blink_on=self.game.blink)
        if self.banner and self.mode == "events":
            self.draw_banner(ui)

    def draw_enemy_plate(self, ui, mon):
        """A small health pip under each foe, in crisp UI pixels."""
        r = self.rect_of(mon)
        ratio = mon.hp / float(mon.maxhp)
        uimod.gauge(ui, r.x + 3, r.bottom + 1, 26, 3, ratio,
                    uimod.hp_color(ratio))
        self.draw_ailment_dot(ui, mon, r.x + 1, r.bottom + 5)
        if self.actor_mark is mon and self.mode in (
                "command", "skill", "item", "sigil", "target"):
            if self.game.blink:
                get_font().draw(ui, "\x03", r.centerx - 2, r.y - 8,
                                P.ICON_FULL, P.BLACK)

    def draw_ailment_dot(self, surf, mon, x, y):
        if not mon.ailment:
            return
        from ..monster import AILMENT_SHORT
        get_font().draw(surf, AILMENT_SHORT[mon.ailment], x, y, P.EL_DARK,
                        P.WHITE)

    def draw_status(self, surf):
        font = get_font()
        for i, mon in enumerate(self.b.party[:3]):
            x, y, w, h = STATUS_BOXES[i]
            active = (self.actor_mark is mon and self.b.side == PLAYER)
            uimod.panel(surf, (x, y, w, h),
                        P.NEAR_BLACK if not active else (58, 54, 98),
                        P.ICON_FULL if active and self.game.blink else P.BLACK)
            col = P.WHITE if not mon.down else P.GREY
            font.draw(surf, mon.name[:8], x + 3, y + 1, col)
            font.draw(surf, "%d" % mon.hp, x + w - 4 - font.width("%d" % mon.hp),
                      y + 1, P.GREY_L if not mon.down else P.GREY)
            ratio = mon.hp / float(mon.maxhp)
            uimod.gauge(surf, x + 3, y + 9, w - 24, 3, ratio,
                        uimod.hp_color(ratio))
            uimod.gauge(surf, x + w - 18, y + 10, 14, 2,
                        mon.mp / float(max(1, mon.maxmp)), P.MP_FILL)
            if mon.ailment:
                from ..monster import AILMENT_SHORT
                font.draw(surf, AILMENT_SHORT[mon.ailment], x + w - 34, y + 8,
                          P.EL_DARK)
            for j, (k, v) in enumerate(mon.buffs.items()):
                if v:
                    c = P.ICON_FULL if v > 0 else P.HP_BAD
                    pygame.draw.rect(surf, c, (x + 3 + j * 5, y + 13, 4, 1))

    def draw_turn_strip(self, surf):
        font = get_font()
        icons = self.b.turns.icons()
        total = len(icons)
        x = 238 - total * 11
        label = "YOU" if self.b.side == PLAYER else "FOE"
        col = P.ICON_FULL if self.b.side == PLAYER else P.HP_BAD
        font.draw(surf, label, x - 22, 2, col, P.BLACK)
        uimod.press_icons(surf, x, 3, icons, self.game.blink)

    def draw_command(self, surf):
        uimod.window(surf, BOTTOM)
        font = get_font()
        actor = self.b.current_actor
        if actor:
            font.draw(surf, actor.name, 10, BOTTOM[1] + 5, P.NEAR_BLACK)
            uimod.gauge(surf, 10, BOTTOM[1] + 16, 56, 4,
                     actor.hp / float(actor.maxhp),
                     uimod.hp_color(actor.hp / float(actor.maxhp)))
            font.draw(surf, "%d/%d" % (actor.hp, actor.maxhp), 10,
                      BOTTOM[1] + 23, P.GREY_D)
            uimod.gauge(surf, 10, BOTTOM[1] + 32, 56, 3,
                     actor.mp / float(max(1, actor.maxmp)), P.MP_FILL)
            font.draw(surf, "MP %d/%d" % (actor.mp, actor.maxmp), 10,
                      BOTTOM[1] + 37, P.GREY_D)
        self.menu.rect = (78, BOTTOM[1], 162, BOTTOM[3])
        self.menu.draw(surf, draw_frame=False, x=96, y=BOTTOM[1] + 5, col_w=72)

    def draw_sub(self, surf):
        font = get_font()
        rect = (0, 70, 240, 90)
        uimod.window(surf, rect)
        self.sub.rect = rect
        self.sub.draw(surf, draw_frame=False, x=18, y=76, col_w=108)
        payload = self.sub.payload()
        y = rect[1] + rect[3] - 18
        pygame.draw.line(surf, P.WIN_SHADOW, (8, y - 4), (232, y - 4))
        if payload is None:
            return
        if hasattr(payload, "element"):
            uimod.element_tag(surf, 10, y - 1, payload.element)
            font.draw(surf, payload.desc, 48, y, P.NEAR_BLACK)
        else:
            font.draw(surf, payload.desc, 10, y, P.NEAR_BLACK)

    def draw_target(self, surf):
        font = get_font()
        target = self.targets[self.target_i]
        rect = self.rect_of(target)
        if self.game.blink:
            font.draw(surf, "\x01", rect.x - 9, rect.centery - 4, P.ICON_FULL,
                      P.BLACK)
            pygame.draw.rect(surf, P.ICON_FULL, rect.inflate(4, 4), 1)
        uimod.window(surf, BOTTOM)
        font.draw(surf, "%s  Lv%d" % (target.name, target.level), 10,
                  BOTTOM[1] + 5, P.NEAR_BLACK)
        ratio = target.hp / float(target.maxhp)
        uimod.gauge(surf, 10, BOTTOM[1] + 16, 70, 4, ratio, uimod.hp_color(ratio))
        if target in self.b.party:
            font.draw(surf, "%d/%d" % (target.hp, target.maxhp), 86,
                      BOTTOM[1] + 14, P.GREY_D)
        if target.scanned or not target.wild:
            self.draw_affinities(surf, target, 10, BOTTOM[1] + 26)
        else:
            font.draw(surf, "Affinities unknown - try Scan.", 10,
                      BOTTOM[1] + 28, P.GREY_D)
        font.draw(surf, "\x01 select", 180, BOTTOM[1] + 33, P.GREY_D)

    def draw_affinities(self, surf, mon, x, y):
        font = get_font()
        cx = x
        for el in ATTACK_ELEMENTS:
            aff = mon.affinity(el)
            name = EL_NAMES[el][:2]
            colour = AFFINITY_COLORS[aff] if aff != NEUTRAL else P.GREY
            font.draw(surf, name, cx, y, EL_COLORS[el] if aff != NEUTRAL
                      else P.GREY_L)
            font.draw(surf, AFFINITY_TAGS[aff], cx + 1, y + 8, colour)
            cx += 17

    def draw_banner(self, surf):
        font = get_font()
        w = font.width(self.banner) + 16
        x = 120 - w // 2
        k = min(1.0, self.banner_t / 0.12)
        uimod.panel(surf, (x, 122, w, 15), P.NEAR_BLACK, P.ICON_FULL)
        font.draw_centered(surf, self.banner, 120, 126, P.WHITE)
