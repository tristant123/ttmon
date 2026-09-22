"""The battle screen: rendering, input and event playback."""

import math

import pygame

from .. import palette as P, sfx, ui
from ..app import Scene, CONFIRM, CANCEL, direction_of
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

ENEMY_ROW_Y = 12
ALLY_ROW_Y = 54
ENEMY_SLOTS = [(36, ENEMY_ROW_Y), (104, ENEMY_ROW_Y), (172, ENEMY_ROW_Y)]
ALLY_SLOTS = [(20, ALLY_ROW_Y), (88, ALLY_ROW_Y), (156, ALLY_ROW_Y)]


def row_slots(count, y):
    """Lay a row of sprites out centred, so a lone boss is not stuck in a
    corner of the field."""
    count = max(1, min(3, count))
    span = 68
    total = (count - 1) * span
    x0 = 120 - total // 2 - SPRITE // 2
    return [(x0 + i * span, y) for i in range(count)]
STATUS_BOXES = [(2, 88, 76, 23), (82, 88, 76, 23), (162, 88, 76, 23)]
BOTTOM = (0, 112, 240, 48)
SPRITE = 32


class BattleScene(Scene):
    def __init__(self, game, battle, on_end=None):
        super().__init__(game)
        self.b = battle
        self.on_end = on_end
        self.box = ui.TextBox((4, BOTTOM[1] + 3, 232, BOTTOM[3] - 6))
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
        self.menu = ui.Menu([], (0, 0, 0, 0))
        self.sub = None
        self.pending = None        # (kind, payload) awaiting a target
        self.prev_mode = "command"
        self.targets = []
        self.target_i = 0
        self.result_lines = []
        self.result_i = 0
        self.banner = None
        self.banner_t = 0.0

    # -- setup -------------------------------------------------------------
    def enter(self):
        sfx.play("encounter")
        self.queue = list(self.b.begin())
        self.timer = 0.2

    # -- geometry ----------------------------------------------------------
    def slot_of(self, mon):
        if mon in self.b.foes:
            slots = row_slots(len(self.b.foes), ENEMY_ROW_Y)
            i = self.b.foes.index(mon)
            if i < len(slots):
                return slots[i]
        elif mon in self.b.party:
            slots = row_slots(len(self.b.party[:3]), ALLY_ROW_Y)
            i = self.b.party.index(mon)
            if i < len(slots):
                return slots[i]
        return (104, 40)

    def rect_of(self, mon):
        x, y = self.slot_of(mon)
        return pygame.Rect(x, y, SPRITE, SPRITE)

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
                r = self.rect_of(targets[0])
                if len(targets) > 1:
                    r = pygame.Rect(0, r.y, 240, SPRITE)
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
            r = self.rect_of(tgt)
            self.sigil = {"t": 0.0, "dur": 1.0, "start": (120, 120),
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
        self.menu = ui.Menu(items, (0, BOTTOM[1], 240, BOTTOM[3]), columns=2,
                            item_h=10)
        self.box.show("%s's move." % actor.name)
        self.box.skip()

    def open_skills(self):
        actor = self.b.current_actor
        rows = []
        for s in actor.skill_objs():
            rows.append((s.name, s))
        self.sub = ui.Menu(rows, (0, 74, 240, 86), columns=2, item_h=10)
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
        self.sub = ui.Menu(bag, (0, 74, 240, 86), columns=2, item_h=10)
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

    # -- drawing ---------------------------------------------------------------
    def draw(self, surf):
        self.draw_field(surf)
        font = get_font()
        for mon in self.b.foes:
            self.draw_monster(surf, mon, enemy=True)
        for mon in self.b.party:
            self.draw_monster(surf, mon, enemy=False)
        if self.effect:
            e = self.effect
            effects.draw_effect(surf, e["element"], e["rect"],
                                e["t"] / e["dur"], e["kind"])
        if self.sigil:
            s = self.sigil
            effects.draw_sigil_throw(surf, s["start"], s["end"],
                                     s["t"] / s["dur"], s["caught"])
        for f in self.floats:
            f.draw(surf)
        self.draw_status(surf)
        self.draw_turn_strip(surf)
        if self.mode == "command":
            self.draw_command(surf)
        elif self.mode in ("skill", "item", "sigil"):
            self.draw_sub(surf)
        elif self.mode == "target":
            self.draw_target(surf)
        else:
            self.box.draw(surf, arrow=self.mode == "result",
                          blink_on=self.game.blink)
        if self.banner and self.mode == "events":
            self.draw_banner(surf)

    def draw_field(self, surf):
        h = surf.get_height()
        for y in range(0, 52):
            k = y / 52.0
            col = tuple(int(P.SKY_TOP[i] + (P.SKY_BOT[i] - P.SKY_TOP[i]) * k)
                        for i in range(3))
            pygame.draw.line(surf, col, (0, y), (240, y))
        pygame.draw.rect(surf, P.FIELD_A, (0, 44, 240, 24))
        pygame.draw.rect(surf, P.FIELD_B, (0, 68, 240, 46))
        for i in range(0, 240, 8):
            pygame.draw.rect(surf, P.FIELD_B, (i + (i // 8 % 2) * 3, 46, 3, 2))
            pygame.draw.rect(surf, P.FIELD_A, (i + (i // 8 % 2) * 4, 72, 3, 2))
        # a soft shadow under each row
        for x, y in row_slots(len(self.b.foes), ENEMY_ROW_Y):
            pygame.draw.ellipse(surf, (72, 116, 76), (x + 4, y + 28, 24, 6))
        for x, y in row_slots(len(self.b.party[:3]), ALLY_ROW_Y):
            pygame.draw.ellipse(surf, (56, 100, 64), (x + 4, y + 28, 24, 6))

    def draw_monster(self, surf, mon, enemy):
        rect = self.rect_of(mon)
        spr = MART.sprite(mon.art)
        if not enemy:
            spr = pygame.transform.flip(spr, True, False)
        fade = self.fainting.get(id(mon))
        if mon.down and fade is None:
            return
        dx, dy = (0, 0)
        sh = self.shakes.get(id(mon))
        if sh:
            dx, dy = sh.offset()
        img = spr
        if fade is not None:
            if fade >= 1.0:
                return
            img = spr.copy()
            img.set_alpha(int(255 * (1.0 - fade)))
            dy += int(fade * 10)
        if id(mon) in self.flash:
            img = img.copy()
            img.fill((96, 96, 96, 0), special_flags=pygame.BLEND_RGB_ADD)
        bob = math.sin(self.game.time * 2.0 + rect.x) * 1.0
        surf.blit(img, (rect.x + dx, rect.y + dy + int(bob)))
        if enemy and not mon.down:
            ratio = mon.hp / float(mon.maxhp)
            ui.gauge(surf, rect.x + 3, rect.bottom + 2, 26, 3, ratio,
                     ui.hp_color(ratio))
            self.draw_ailment_dot(surf, mon, rect.x + 1, rect.bottom + 6)
        if self.actor_mark is mon and self.mode in (
                "command", "skill", "item", "sigil", "target"):
            if self.game.blink:
                get_font().draw(surf, "\x03", rect.centerx - 2, rect.y - 8,
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
            ui.panel(surf, (x, y, w, h),
                     P.NEAR_BLACK if not active else (56, 52, 96),
                     P.ICON_FULL if active and self.game.blink else P.BLACK)
            name = mon.name[:9]
            col = P.WHITE if not mon.down else P.GREY
            font.draw(surf, name, x + 3, y + 2, col)
            font.draw(surf, "L%d" % mon.level, x + w - 16, y + 2, P.GREY_L)
            ratio = mon.hp / float(mon.maxhp)
            ui.gauge(surf, x + 3, y + 11, w - 6, 3, ratio, ui.hp_color(ratio))
            font.draw(surf, "%d/%d" % (mon.hp, mon.maxhp), x + 3, y + 15,
                      P.GREY_L)
            ui.gauge(surf, x + w - 30, y + 17, 26, 2,
                     mon.mp / float(max(1, mon.maxmp)), P.MP_FILL)
            if mon.ailment:
                from ..monster import AILMENT_SHORT
                font.draw(surf, AILMENT_SHORT[mon.ailment], x + w - 20,
                          y + 15, P.EL_DARK)
            for j, (k, v) in enumerate(mon.buffs.items()):
                if v:
                    c = P.ICON_FULL if v > 0 else P.HP_BAD
                    pygame.draw.rect(surf, c, (x + 34 + j * 5, y + 16, 4, 2))

    def draw_turn_strip(self, surf):
        font = get_font()
        icons = self.b.turns.icons()
        total = len(icons)
        x = 238 - total * 11
        label = "YOU" if self.b.side == PLAYER else "FOE"
        col = P.ICON_FULL if self.b.side == PLAYER else P.HP_BAD
        font.draw(surf, label, x - 22, 2, col, P.BLACK)
        ui.press_icons(surf, x, 3, icons, self.game.blink)

    def draw_command(self, surf):
        ui.window(surf, BOTTOM)
        font = get_font()
        actor = self.b.current_actor
        if actor:
            font.draw(surf, actor.name, 10, BOTTOM[1] + 5, P.NEAR_BLACK)
            ui.gauge(surf, 10, BOTTOM[1] + 16, 56, 4,
                     actor.hp / float(actor.maxhp),
                     ui.hp_color(actor.hp / float(actor.maxhp)))
            font.draw(surf, "%d/%d" % (actor.hp, actor.maxhp), 10,
                      BOTTOM[1] + 23, P.GREY_D)
            ui.gauge(surf, 10, BOTTOM[1] + 32, 56, 3,
                     actor.mp / float(max(1, actor.maxmp)), P.MP_FILL)
            font.draw(surf, "MP %d/%d" % (actor.mp, actor.maxmp), 10,
                      BOTTOM[1] + 37, P.GREY_D)
        self.menu.rect = (78, BOTTOM[1], 162, BOTTOM[3])
        self.menu.draw(surf, draw_frame=False, x=96, y=BOTTOM[1] + 5, col_w=72)

    def draw_sub(self, surf):
        font = get_font()
        rect = (0, 70, 240, 90)
        ui.window(surf, rect)
        self.sub.rect = rect
        self.sub.draw(surf, draw_frame=False, x=18, y=76, col_w=108)
        payload = self.sub.payload()
        y = rect[1] + rect[3] - 18
        pygame.draw.line(surf, P.WIN_SHADOW, (8, y - 4), (232, y - 4))
        if payload is None:
            return
        if hasattr(payload, "element"):
            ui.element_tag(surf, 10, y - 1, payload.element)
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
        ui.window(surf, BOTTOM)
        font.draw(surf, "%s  Lv%d" % (target.name, target.level), 10,
                  BOTTOM[1] + 5, P.NEAR_BLACK)
        ratio = target.hp / float(target.maxhp)
        ui.gauge(surf, 10, BOTTOM[1] + 16, 70, 4, ratio, ui.hp_color(ratio))
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
        ui.panel(surf, (x, 122, w, 15), P.NEAR_BLACK, P.ICON_FULL)
        font.draw_centered(surf, self.banner, 120, 126, P.WHITE)
