"""Title, dialogue, and the menu screens."""

import math

import pygame

from . import config, music, palette as P, save, sfx, ui
from .app import Scene, CONFIRM, CANCEL, direction_of
from .font import get_font, CURSOR, LINE_H
from .art import monsters as MART
from .art import portraits as PORTRAIT
from .data import skills as SK
from .data.items import ITEMS, SHOP_STOCK
from .data.elements import (NAMES as EL_NAMES, COLORS as EL_COLORS,
                            ATTACK_ELEMENTS, AFFINITY_TAGS, AFFINITY_COLORS,
                            NEUTRAL)
from .monster import Monster, AILMENT_SHORT
from .player import new_game


class Title(Scene):
    """Title card, staged over a live diorama of the shrine at dusk."""

    grade = "shrine"

    def __init__(self, game):
        super().__init__(game)
        items = ["New Game"]
        if save.has_save():
            items.insert(0, "Continue")
        items.append("Quit")
        self.menu = ui.Menu(items, (78, 104, 84, 46), dark=True)
        self.t = 0.0
        self.motes = None
        self.cam = (1.0, -4.6)

    def enter(self):
        from .render.particles import MoteField
        self.motes = MoteField((config.INTERNAL_W, config.INTERNAL_H),
                               count=44, colour=(210, 226, 255), speed=4.0)
        music.play("title")

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        d = direction_of(event.key)
        if d and self.menu.move(0, {"up": -1, "down": 1}.get(d, 0)):
            sfx.play("cursor")
        elif event.key in CONFIRM:
            sfx.play("confirm")
            choice = self.menu.payload()
            if choice == "Quit":
                self.game.quit()
            elif choice == "Continue":
                player = save.load()
                if player is None:
                    sfx.play("cancel")
                    return
                self.game.player = player
                self.start_world()
            else:
                self.game.player = new_game()
                self.game.fade_to(lambda: self.game.replace(Intro(self.game)),
                                  0.35)

    def start_world(self):
        from .world.overworld import Overworld
        self.game.fade_to(lambda: self.game.replace(Overworld(self.game)), 0.35)

    def update(self, dt):
        self.t += dt
        if self.motes is None:
            self.enter()
        self.motes.update(dt)
        # a slow drift across the shrine, so the card is never quite still
        self.cam = (1.0 + math.sin(self.t * 0.10) * 0.7, -4.6)

    def draw_world(self, canvas):
        from .world import maps
        dio = self.game.assets.get("diorama")
        if dio is None:
            return
        gmap = maps.get("shrine")
        for y in range(config.INTERNAL_H):
            k = y / float(config.INTERNAL_H)
            canvas.fill((int(26 + 62 * k), int(24 + 52 * k), int(58 + 70 * k)),
                        (0, y, config.INTERNAL_W, 1))
        dio.draw(canvas, gmap, self.cam, [], self.t, self.game.fx,
                 int(self.t * 2) % 2)
        self.motes.draw(canvas, self.t)

    def draw(self, surf):
        font = get_font()
        # a scrim so the title reads against the scene behind it
        scrim = pygame.Surface((config.UI_W, config.UI_H), pygame.SRCALPHA)
        pygame.draw.rect(scrim, (12, 10, 26, 96), (0, 0, config.UI_W, 44))
        pygame.draw.rect(scrim, (12, 10, 26, 104), (0, 96, config.UI_W, 64))
        surf.blit(scrim, (0, 0))
        title = "TABULA MYTHOS"
        for dx, dy in ((0, 1), (1, 0), (0, -1), (-1, 0), (1, 1)):
            font.draw_centered(surf, title, 120 + dx, 14 + dy, P.BLACK)
        font.draw_centered(surf, title, 120, 14, P.ICON_FULL)
        font.draw_centered(surf, "a binder's proof of concept", 120, 28,
                           P.GREY_L)
        ui.window(surf, (74, 100, 92, 52), dark=True)
        self.menu.rect = (74, 100, 92, 52)
        self.menu.draw(surf, draw_frame=False, x=94, y=106)
        font.draw_centered(surf, "Z confirm   X back   F11 fullscreen", 120,
                           152, P.GREY_L)


class Intro(Scene):
    """Choosing the first monster."""

    CHOICES = [("pixie", "Wind"), ("mandrake", "Plant"), ("kitsune", "Fire")]

    def __init__(self, game):
        super().__init__(game)
        self.index = 0
        self.stage = 0
        self.box = ui.TextBox((4, 112, 232, 44))
        self.lines = [
            "ELDER MARU: So. You want to bind.",
            "Then take one. It will be the first\nturn you ever own.",
            "Choose, binder.",
        ]
        self.box.show(self.lines[0])

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        if self.stage < len(self.lines) - 1:
            if event.key in CONFIRM:
                if not self.box.done:
                    self.box.skip()
                    return
                self.stage += 1
                self.box.show(self.lines[self.stage])
                sfx.play("confirm")
            return
        d = direction_of(event.key)
        if d == "left":
            self.index = (self.index - 1) % 3
            sfx.play("cursor")
        elif d == "right":
            self.index = (self.index + 1) % 3
            sfx.play("cursor")
        elif event.key in CONFIRM:
            sfx.play("level")
            key = self.CHOICES[self.index][0]
            player = self.game.player
            player.party = []
            mon = Monster(key, 5)
            player.add_monster(mon)
            from .world.overworld import Overworld
            self.game.fade_to(
                lambda: self.game.replace(Overworld(self.game)), 0.4)

    def update(self, dt):
        self.box.update(dt)

    def draw(self, surf):
        surf.fill((40, 36, 64))
        font = get_font()
        for i, (key, el) in enumerate(self.CHOICES):
            x = 24 + i * 68
            sel = i == self.index and self.stage >= len(self.lines) - 1
            ui.panel(surf, (x - 6, 26, 56, 62),
                     (56, 50, 84) if not sel else (88, 78, 128),
                     P.ICON_FULL if sel and self.game.blink else P.BLACK)
            spr = MART.icon(key, 40)
            bob = math.sin(self.game.time * 2 + i) * 1.5 if sel else 0
            surf.blit(spr, (x + 2, 28 + bob))
            name = Monster(key, 5).species.name
            font.draw_centered(surf, name, x + 22, 66, P.WHITE)
            font.draw_centered(surf, el, x + 22, 76, P.GREY_L)
            if sel and self.game.blink:
                font.draw(surf, CURSOR, x - 2, 50, P.ICON_FULL)
        self.box.draw(surf, blink_on=self.game.blink)


def portrait_frame(t, talking):
    """Which eyes and mouth a portrait shows at time `t`. Fire Emblem's
    busts blink every few seconds and flap their mouths while their line is
    printing; the rhythm below is close to theirs."""
    phase = (t + 1.3) % 3.7
    eye = "open"
    if phase > 3.58:
        eye = "half" if phase < 3.61 or phase > 3.67 else "shut"
    talk = "open" if talking and int(t * 9) % 2 else "shut"
    return eye, talk


def draw_portrait(canvas, key, bottom, t=1.0, right=None, talking=False):
    """A bust beside a text box, Fire Emblem style: authored at UI size and
    doubled, its shoulders tucked behind the box, sliding in as it fades
    up, blinking, and moving its mouth while it talks."""
    eye, talk = portrait_frame(t, talking)
    surf = PORTRAIT.portrait(key, eye, talk, scale=config.UI_SCALE)
    if right is None:
        right = key in PORTRAIT.RIGHT
    k = min(1.0, t / 0.18)
    ease = 1 - (1 - k) ** 3
    slide = int((1 - ease) * 14)
    x = config.INTERNAL_W - 4 - surf.get_width() + slide if right else 4 - slide
    if k < 1.0:
        surf = surf.copy()
        surf.set_alpha(int(255 * ease))
    canvas.blit(surf, (x, bottom - surf.get_height()))


class Dialogue(Scene):
    opaque = False

    def __init__(self, game, lines, speaker="", on_close=None, dark=False,
                 portrait=None):
        super().__init__(game)
        self.lines = list(lines)
        self.i = 0
        self.speaker = speaker
        self.on_close = on_close
        self.box = ui.TextBox((4, 108, 232, 48), dark=dark)
        self.box.show(self.lines[0])
        # the speaker's face, if they have one
        self.portrait = portrait or PORTRAIT.SPEAKERS.get(speaker)
        self.t = 0.0

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        if event.key in CONFIRM or event.key in CANCEL:
            if not self.box.done:
                self.box.skip()
                return
            self.i += 1
            if self.i >= len(self.lines):
                self.game.pop()
                if self.on_close:
                    self.on_close()
                return
            sfx.play("cursor")
            self.box.show(self.lines[self.i])

    def update(self, dt):
        self.t += dt
        self.box.update(dt)

    def draw_front(self, canvas):
        if self.portrait:
            draw_portrait(canvas, self.portrait, 108 * config.UI_SCALE + 18,
                          self.t, talking=not self.box.done)

    def draw(self, surf):
        if self.speaker:
            font = get_font()
            w = font.width(self.speaker) + 12
            # the name plate sits beside a portrait on the left, not on it
            x = 8
            if self.portrait and self.portrait not in PORTRAIT.RIGHT:
                x = PORTRAIT.W + 6
            ui.panel(surf, (x, 98, w, 13), P.NEAR_BLACK, P.WIN_EDGE_D)
            font.draw(surf, self.speaker, x + 6, 101, P.ICON_FULL)
        self.box.draw(surf, blink_on=self.game.blink)


class PauseMenu(Scene):
    opaque = False

    def __init__(self, game):
        super().__init__(game)
        self.menu = ui.Menu(["Party", "Bag", "Record", "Save", "Title"],
                            (160, 6, 74, 68))
        self.t = 0.0

    def update(self, dt):
        self.t += dt

    def draw_front(self, canvas):
        draw_portrait(canvas, "hero", 116 * config.UI_SCALE + 14, self.t)

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        d = direction_of(event.key)
        if d and self.menu.move(0, {"up": -1, "down": 1}.get(d, 0)):
            sfx.play("cursor")
        elif event.key in CANCEL:
            sfx.play("cancel")
            self.game.pop()
        elif event.key in CONFIRM:
            sfx.play("confirm")
            choice = self.menu.payload()
            if choice == "Party":
                self.game.push(PartyMenu(self.game))
            elif choice == "Bag":
                self.game.push(BagMenu(self.game))
            elif choice == "Record":
                self.game.push(RecordScreen(self.game))
            elif choice == "Save":
                ok = save.save(self.game.player)
                self.game.push(Dialogue(self.game, [
                    "Progress recorded." if ok else "Could not write a save."]))
            elif choice == "Title":
                self.game.fade_to(self.to_title, 0.35)

    def to_title(self):
        while len(self.game.scenes) > 0:
            self.game.pop()
        self.game.push(Title(self.game))

    def draw(self, surf):
        font = get_font()
        p = self.game.player
        self.menu.draw(surf)
        ui.window(surf, (6, 116, 148, 38))
        font.draw(surf, "%s" % p.name, 14, 122, P.NEAR_BLACK)
        font.draw(surf, "Coin %d" % p.gold, 14, 133, P.GREY_D)
        font.draw(surf, "Bound %d/%d" % (len(p.party), config.PARTY_MAX), 80,
                  133, P.GREY_D)


class PartyMenu(Scene):
    def __init__(self, game):
        super().__init__(game)
        self.index = 0
        self.swap_from = None
        self.detail = False

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        party = self.game.player.party
        d = direction_of(event.key)
        if self.detail:
            if event.key in CANCEL or event.key in CONFIRM:
                sfx.play("cancel")
                self.detail = False
            elif d in ("left", "right") and party:
                self.index = (self.index + (1 if d == "right" else -1)) % len(party)
                sfx.play("cursor")
            return
        if d in ("up", "down") and party:
            self.index = (self.index + (1 if d == "down" else -1)) % len(party)
            sfx.play("cursor")
        elif event.key in CONFIRM and party:
            if self.swap_from is None:
                sfx.play("confirm")
                self.detail = True
            else:
                self.game.player.swap(self.swap_from, self.index)
                self.swap_from = None
                sfx.play("level")
        elif event.key == pygame.K_s and party:
            self.swap_from = self.index if self.swap_from is None else None
            sfx.play("cursor")
        elif event.key in CANCEL:
            sfx.play("cancel")
            self.game.pop()

    def draw(self, surf):
        surf.fill((48, 44, 74))
        font = get_font()
        party = self.game.player.party
        if self.detail and party:
            self.draw_detail(surf, party[self.index])
            return
        font.draw(surf, "PARTY", 8, 5, P.WHITE)
        font.draw(surf, "first 3 fight - S swaps", 74, 6, P.GREY_L)
        for i, mon in enumerate(party):
            y = 16 + i * 23
            active = i < config.BATTLE_SLOTS
            bg = (64, 60, 96) if active else (44, 40, 68)
            if i == self.index:
                bg = (96, 88, 140)
            ui.panel(surf, (6, y, 228, 21), bg,
                     P.ICON_FULL if i == self.swap_from else P.BLACK)
            spr = MART.icon(mon.art, 32)
            surf.blit(spr, (8, y - 6), pygame.Rect(0, 4, 32, 21))
            font.draw(surf, mon.name, 44, y + 2, P.WHITE)
            font.draw(surf, "Lv%d" % mon.level, 44, y + 12, P.GREY_L)
            ratio = mon.hp / float(mon.maxhp)
            ui.gauge(surf, 92, y + 4, 60, 4, ratio, ui.hp_color(ratio))
            font.draw(surf, "%d/%d" % (mon.hp, mon.maxhp), 92, y + 11, P.GREY_L)
            ui.gauge(surf, 160, y + 4, 40, 3,
                     mon.mp / float(max(1, mon.maxmp)), P.MP_FILL)
            font.draw(surf, "MP%d" % mon.mp, 160, y + 11, P.GREY_L)
            if mon.ailment:
                font.draw(surf, AILMENT_SHORT[mon.ailment], 208, y + 11,
                          P.EL_DARK)
            if active:
                font.draw(surf, "\x03", 216, y + 2, P.ICON_FULL)
        if not party:
            font.draw_centered(surf, "No monsters bound.", 120, 70, P.GREY_L)
        font.draw(surf, "Z details   X back", 8, 150, P.GREY)

    def draw_detail(self, surf, mon):
        font = get_font()
        surf.fill((40, 38, 66))
        ui.panel(surf, (4, 4, 74, 74), (60, 56, 92))
        surf.blit(MART.icon(mon.art, 48), (17, 16))
        font.draw_centered(surf, mon.name, 41, 8, P.WHITE)
        font.draw_centered(surf, "%s  Lv%d" % (mon.species.race, mon.level),
                           41, 62, P.GREY_L)
        x = 84
        font.draw(surf, "HP %d/%d" % (mon.hp, mon.maxhp), x, 6, P.WHITE)
        ui.gauge(surf, x, 16, 140, 4, mon.hp / float(mon.maxhp),
                 ui.hp_color(mon.hp / float(mon.maxhp)))
        font.draw(surf, "MP %d/%d" % (mon.mp, mon.maxmp), x, 24, P.WHITE)
        ui.gauge(surf, x, 34, 140, 3, mon.mp / float(max(1, mon.maxmp)),
                 P.MP_FILL)
        from .data.species import xp_to_next
        need = xp_to_next(mon.level)
        font.draw(surf, "XP %d/%d" % (mon.xp, need), x, 42, P.GREY_L)
        ui.gauge(surf, x, 52, 140, 3, mon.xp / float(need), P.XP_FILL)
        stats = [("St", "st"), ("Ma", "ma"), ("Vi", "vi"), ("Ag", "ag"),
                 ("Lu", "lu")]
        for i, (label, key) in enumerate(stats):
            sx = x + (i % 5) * 28
            font.draw(surf, label, sx, 60, P.GREY_L)
            font.draw(surf, str(mon.base_stat(key)), sx, 69, P.WHITE)
        font.draw(surf, "AFFINITY", 8, 82, P.ICON_FULL)
        cx = 8
        for el in ATTACK_ELEMENTS:
            aff = mon.affinity(el)
            font.draw(surf, EL_NAMES[el][:2], cx, 92, EL_COLORS[el])
            font.draw(surf, AFFINITY_TAGS[aff], cx + 2, 101,
                      AFFINITY_COLORS[aff] if aff != NEUTRAL else P.GREY)
            cx += 22
        font.draw(surf, "SKILLS", 8, 112, P.ICON_FULL)
        for i, s in enumerate(mon.skill_objs()):
            sx = 8 + (i % 2) * 116
            sy = 122 + (i // 2) * 10
            ui.element_tag(surf, sx, sy - 1, s.element)
            font.draw(surf, s.name, sx + 32, sy, P.WHITE)
            font.draw(surf, s.cost_text(), sx + 88, sy, P.GREY_L)
        lines = font.wrap(mon.species.desc, 224)
        tail = lines[0] + ("..." if len(lines) > 1 else "")
        font.draw(surf, tail, 8, 152, P.GREY)


class BagMenu(Scene):
    def __init__(self, game):
        super().__init__(game)
        self.rebuild()
        self.target = None

    def rebuild(self):
        bag = self.game.player.bag_items(battle=False)
        items = [(it.name, it) for it, n in bag]
        self.menu = ui.Menu(items, (6, 18, 228, 110), item_h=11)
        for i, (it, n) in enumerate(bag):
            self.menu.notes[i] = "x%d" % n

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        d = direction_of(event.key)
        if self.target is not None:
            party = self.game.player.party
            if d in ("up", "down"):
                self.target = (self.target + (1 if d == "down" else -1)) % len(party)
                sfx.play("cursor")
            elif event.key in CONFIRM:
                self.use_on(party[self.target])
            elif event.key in CANCEL:
                sfx.play("cancel")
                self.target = None
            return
        if d and self.menu.move(0, {"up": -1, "down": 1}.get(d, 0)):
            sfx.play("cursor")
        elif event.key in CONFIRM and self.menu.items:
            sfx.play("confirm")
            self.target = 0
        elif event.key in CANCEL:
            sfx.play("cancel")
            self.game.pop()

    def use_on(self, mon):
        item = self.menu.payload()
        player = self.game.player
        events = item.use(mon)
        worked = any(e["type"] in ("heal", "mp", "revive") for e in events) or \
            any("cleansed" in e.get("text", "") for e in events)
        if worked:
            player.take(item.key)
            sfx.play("heal")
            self.rebuild()
            self.target = None
            if not self.menu.items:
                self.game.pop()
        else:
            sfx.play("cancel")

    def draw(self, surf):
        surf.fill((48, 44, 74))
        font = get_font()
        font.draw(surf, "BAG", 8, 5, P.WHITE)
        font.draw(surf, "Coin %d" % self.game.player.gold, 190, 5, P.ICON_FULL)
        ui.window(surf, (4, 16, 232, 112))
        self.menu.rect = (4, 16, 232, 112)
        self.menu.draw(surf, draw_frame=False, x=20, y=22)
        item = self.menu.payload()
        ui.window(surf, (4, 130, 232, 26))
        if item:
            font.draw(surf, item.desc, 12, 138, P.NEAR_BLACK)
        else:
            font.draw(surf, "Nothing in the bag.", 12, 138, P.GREY_D)
        if self.target is not None:
            self.draw_party_picker(surf)

    def draw_party_picker(self, surf):
        font = get_font()
        party = self.game.player.party
        ui.window(surf, (60, 20, 120, 12 + 14 * len(party)))
        for i, mon in enumerate(party):
            y = 26 + i * 14
            col = P.NEAR_BLACK if not mon.down else P.GREY
            font.draw(surf, mon.name, 78, y, col)
            font.draw(surf, "%d/%d" % (mon.hp, mon.maxhp), 136, y, P.GREY_D)
            if i == self.target:
                font.draw(surf, CURSOR, 68, y, P.NEAR_BLACK)


class ShopMenu(Scene):
    def __init__(self, game):
        super().__init__(game)
        items = [(ITEMS[k].name, ITEMS[k]) for k in SHOP_STOCK]
        self.menu = ui.Menu(items, (4, 16, 232, 108), item_h=11)
        for i, k in enumerate(SHOP_STOCK):
            self.menu.notes[i] = "%d" % ITEMS[k].price

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        d = direction_of(event.key)
        if d and self.menu.move(0, {"up": -1, "down": 1}.get(d, 0)):
            sfx.play("cursor")
        elif event.key in CONFIRM:
            self.buy()
        elif event.key in CANCEL:
            sfx.play("cancel")
            self.game.pop()

    def buy(self):
        item = self.menu.payload()
        p = self.game.player
        if p.gold < item.price:
            sfx.play("cancel")
            return
        p.gold -= item.price
        p.give(item.key)
        sfx.play("confirm")

    def draw(self, surf):
        surf.fill((48, 44, 74))
        font = get_font()
        font.draw(surf, "PELL'S GOODS", 8, 5, P.WHITE)
        font.draw(surf, "Coin %d" % self.game.player.gold, 178, 5, P.ICON_FULL)
        ui.window(surf, (4, 16, 232, 108))
        self.menu.rect = (4, 16, 232, 108)
        self.menu.draw(surf, draw_frame=False, x=20, y=22)
        item = self.menu.payload()
        ui.window(surf, (4, 126, 232, 30))
        font.draw(surf, item.desc, 12, 132, P.NEAR_BLACK)
        font.draw(surf, "Have %d" % self.game.player.count(item.key), 12, 143,
                  P.GREY_D)
        font.draw(surf, "Z buy   X leave", 150, 143, P.GREY_D)


class RecordScreen(Scene):
    """A small bestiary: what has been met and what has been bound."""

    def __init__(self, game):
        super().__init__(game)
        from .data.species import SPECIES
        self.keys = [k for k in SPECIES if k != "anubis"]
        self.index = 0

    def handle(self, event):
        if event.type != pygame.KEYDOWN:
            return
        d = direction_of(event.key)
        if d in ("left", "up"):
            self.index = (self.index - 1) % len(self.keys)
            sfx.play("cursor")
        elif d in ("right", "down"):
            self.index = (self.index + 1) % len(self.keys)
            sfx.play("cursor")
        elif event.key in CANCEL or event.key in CONFIRM:
            sfx.play("cancel")
            self.game.pop()

    def draw(self, surf):
        from .data.species import SPECIES
        surf.fill((44, 40, 70))
        font = get_font()
        p = self.game.player
        font.draw(surf, "RECORD", 8, 4, P.WHITE)
        font.draw(surf, "met %d / bound %d of %d"
                  % (len(p.seen & set(self.keys)), len(p.bound & set(self.keys)),
                     len(self.keys)), 96, 5, P.GREY_L)
        cols = 7
        for i, key in enumerate(self.keys):
            x = 5 + (i % cols) * 33
            y = 14 + (i // cols) * 31
            seen = key in p.seen
            bound = key in p.bound
            ui.panel(surf, (x, y, 31, 29),
                     (60, 56, 92) if seen else (36, 34, 56),
                     P.ICON_FULL if i == self.index and self.game.blink
                     else P.BLACK)
            spr = MART.icon(SPECIES[key].art, 28)
            if seen:
                surf.blit(spr, (x + 2, y + 1))
            else:
                shadow = pygame.mask.from_surface(spr).to_surface(
                    setcolor=(28, 26, 44, 255), unsetcolor=(0, 0, 0, 0))
                surf.blit(shadow, (x + 2, y + 1))
            if bound:
                font.draw(surf, "\x03", x + 24, y + 21, P.ICON_FULL)
        key = self.keys[self.index]
        sp = SPECIES[key]
        ui.window(surf, (4, 108, 232, 48))
        if key in p.seen:
            font.draw(surf, "%s  -  %s" % (sp.name, sp.race), 12, 113,
                      P.NEAR_BLACK)
            cx = 12
            for el in ATTACK_ELEMENTS:
                aff = sp.affinity.get(el, NEUTRAL)
                font.draw(surf, EL_NAMES[el][:2], cx, 124, P.GREY_D)
                font.draw(surf, AFFINITY_TAGS[aff], cx + 2, 133,
                          AFFINITY_COLORS[aff] if aff != NEUTRAL else P.GREY)
                cx += 22
            for i, line in enumerate(font.wrap(sp.desc, 216)[:1]):
                font.draw(surf, line, 12, 144, P.GREY_D)
        else:
            font.draw(surf, "Not yet met.", 12, 124, P.GREY_D)
