"""Shared UI drawing: windows, gauges, press turn icons, menus."""

import pygame

from . import palette as P
from .font import get_font, CURSOR, LINE_H
from .data.elements import COLORS as EL_COLORS, NAMES as EL_NAMES


def window(surf, rect, dark=False):
    """A handheld-RPG text frame: dark outline, flat fill, inner highlight."""
    x, y, w, h = rect
    fill = P.WIN_FILL_D if dark else P.WIN_FILL
    edge = P.WIN_EDGE_D if dark else P.WIN_EDGE
    outer = P.BLACK if not dark else P.BLACK
    pygame.draw.rect(surf, outer, (x, y, w, h), border_radius=4)
    pygame.draw.rect(surf, fill, (x + 1, y + 1, w - 2, h - 2), border_radius=4)
    pygame.draw.rect(surf, edge, (x + 2, y + 2, w - 4, h - 4), width=1,
                     border_radius=3)


def panel(surf, rect, color, border=None):
    x, y, w, h = rect
    pygame.draw.rect(surf, border or P.BLACK, (x, y, w, h), border_radius=2)
    pygame.draw.rect(surf, color, (x + 1, y + 1, w - 2, h - 2), border_radius=2)


def gauge(surf, x, y, w, h, ratio, color, back=None, outline=True):
    ratio = max(0.0, min(1.0, ratio))
    if outline:
        pygame.draw.rect(surf, P.BLACK, (x - 1, y - 1, w + 2, h + 2))
    pygame.draw.rect(surf, back or P.GAUGE_BACK, (x, y, w, h))
    fill = int(round(w * ratio))
    if fill > 0:
        pygame.draw.rect(surf, color, (x, y, fill, h))
        if h >= 3:
            light = tuple(min(255, c + 40) for c in color)
            pygame.draw.rect(surf, light, (x, y, fill, 1))


def hp_color(ratio):
    if ratio <= 0.2:
        return P.HP_BAD
    if ratio <= 0.5:
        return P.HP_WARN
    return P.HP_GOOD


def press_icons(surf, x, y, icons, blink_on=True, spent=0):
    """Draw the press turn strip.

    A full icon is a solid diamond. A blinking half icon - what you earn by
    striking a weakness - is drawn as a visibly halved diamond in a hotter
    colour, because telling the two apart at a glance is the whole game.
    """
    cx = x
    for full in icons:
        pygame.draw.polygon(surf, P.BLACK, [
            (cx + 4, y - 1), (cx + 9, y + 4), (cx + 4, y + 9), (cx - 1, y + 4)])
        if full:
            pygame.draw.polygon(surf, P.ICON_FULL, [
                (cx + 4, y + 1), (cx + 7, y + 4), (cx + 4, y + 7), (cx + 1, y + 4)])
            pygame.draw.polygon(surf, P.WHITE, [
                (cx + 4, y + 1), (cx + 5, y + 3), (cx + 3, y + 3)])
        else:
            pygame.draw.polygon(surf, P.ICON_SPENT, [
                (cx + 4, y + 1), (cx + 7, y + 4), (cx + 4, y + 7), (cx + 1, y + 4)])
            if blink_on:
                # left half only, so a half turn is unmistakable
                pygame.draw.polygon(surf, P.ICON_FULL_D, [
                    (cx + 4, y + 1), (cx + 4, y + 7), (cx + 1, y + 4)])
                pygame.draw.line(surf, P.WHITE, (cx + 4, y + 1), (cx + 4, y + 7))
        cx += 11
    for _ in range(spent):
        pygame.draw.polygon(surf, P.ICON_SPENT, [
            (cx + 4, y + 2), (cx + 6, y + 4), (cx + 4, y + 6), (cx + 2, y + 4)])
        cx += 11
    return cx


def element_tag(surf, x, y, element, text=None):
    font = get_font()
    label = text if text is not None else EL_NAMES[element]
    w = font.width(label) + 6
    panel(surf, (x, y, w, 9), EL_COLORS[element])
    font.draw(surf, label, x + 3, y + 1, P.BLACK)
    return w


class TextBox:
    """Bottom message window with a typewriter reveal."""

    def __init__(self, rect, speed=1.7, dark=False):
        self.rect = rect
        self.speed = speed
        self.dark = dark
        self.lines = []
        self.progress = 0.0
        self.done = True

    def show(self, text):
        font = get_font()
        self.lines = font.wrap(text, self.rect[2] - 16)[:3]
        self.progress = 0.0
        self.done = False

    def skip(self):
        self.progress = float(sum(len(l) for l in self.lines))
        self.done = True

    def update(self, dt):
        if self.done:
            return
        self.progress += self.speed * dt * 60.0
        if self.progress >= sum(len(l) for l in self.lines):
            self.done = True

    def draw(self, surf, arrow=True, blink_on=True):
        if not self.lines:
            return
        font = get_font()
        window(surf, self.rect, self.dark)
        budget = int(self.progress)
        y = self.rect[1] + 7
        col = P.WHITE if self.dark else P.NEAR_BLACK
        for line in self.lines:
            shown = line[:budget]
            budget -= len(line)
            font.draw(surf, shown, self.rect[0] + 8, y, col)
            y += LINE_H
            if budget <= 0:
                break
        if self.done and arrow and blink_on:
            font.draw(surf, CURSOR, self.rect[0] + self.rect[2] - 10,
                      self.rect[1] + self.rect[3] - 11, col)


class Menu:
    """A cursor menu that can lay out in one or more columns."""

    def __init__(self, items, rect=None, columns=1, item_h=None, wrap=True,
                 dark=False):
        self.items = list(items)     # list of str, or (label, payload)
        self.rect = rect
        self.columns = columns
        self.index = 0
        self.wrap = wrap
        self.dark = dark
        self.item_h = item_h or LINE_H + 2
        self.enabled = [True] * len(self.items)
        self.notes = [""] * len(self.items)

    def set_items(self, items, keep_index=False):
        idx = self.index
        self.items = list(items)
        self.enabled = [True] * len(self.items)
        self.notes = [""] * len(self.items)
        self.index = min(idx, max(0, len(self.items) - 1)) if keep_index else 0

    def label(self, i):
        it = self.items[i]
        return it[0] if isinstance(it, tuple) else it

    def payload(self, i=None):
        i = self.index if i is None else i
        if not self.items:
            return None
        it = self.items[i]
        return it[1] if isinstance(it, tuple) else it

    @property
    def rows(self):
        return (len(self.items) + self.columns - 1) // self.columns

    def move(self, dx, dy):
        if not self.items:
            return False
        col, row = self.index % self.columns, self.index // self.columns
        moved = False
        if dx:
            col += dx
            if 0 <= col < self.columns:
                moved = True
            else:
                col = max(0, min(self.columns - 1, col))
        if dy:
            row += dy
            if 0 <= row < self.rows:
                moved = True
            elif self.wrap:
                row %= self.rows
                moved = True
            else:
                row = max(0, min(self.rows - 1, row))
        idx = row * self.columns + col
        if idx >= len(self.items):
            idx = len(self.items) - 1
        if idx != self.index:
            self.index = idx
            return True
        return moved

    def draw(self, surf, draw_frame=True, x=None, y=None, col_w=None):
        font = get_font()
        rx, ry, rw, rh = self.rect
        if draw_frame:
            window(surf, self.rect, self.dark)
        ox = rx + 12 if x is None else x
        oy = ry + 6 if y is None else y
        cw = col_w or (rw - 16) // self.columns
        base = P.WHITE if self.dark else P.NEAR_BLACK
        for i in range(len(self.items)):
            cx = ox + (i % self.columns) * cw
            cy = oy + (i // self.columns) * self.item_h
            colour = base if self.enabled[i] else P.GREY
            font.draw(surf, self.label(i), cx, cy, colour)
            if self.notes[i]:
                font.draw(surf, self.notes[i],
                          cx + cw - 12 - font.width(self.notes[i]), cy,
                          P.GREY_D if not self.dark else P.GREY_L)
            if i == self.index:
                font.draw(surf, CURSOR, cx - 8, cy, base)
