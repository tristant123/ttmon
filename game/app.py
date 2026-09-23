"""Application shell: window, scaling, scene stack and transitions."""

import os
import time

import pygame

from . import config, palette as P, sfx
from .render import postfx

CONFIRM = (pygame.K_z, pygame.K_j, pygame.K_RETURN, pygame.K_KP_ENTER,
           pygame.K_SPACE)
CANCEL = (pygame.K_x, pygame.K_k, pygame.K_BACKSPACE, pygame.K_ESCAPE)
UP = (pygame.K_UP, pygame.K_w)
DOWN = (pygame.K_DOWN, pygame.K_s)
LEFT = (pygame.K_LEFT, pygame.K_a)
RIGHT = (pygame.K_RIGHT, pygame.K_d)
RUN = (pygame.K_LSHIFT, pygame.K_RSHIFT)


def direction_of(key):
    if key in UP:
        return "up"
    if key in DOWN:
        return "down"
    if key in LEFT:
        return "left"
    if key in RIGHT:
        return "right"
    return None


class Scene:
    """Base class. Scenes are stacked; only the top one gets input.

    Drawing happens in two layers. `draw_world` paints the full-resolution
    480x320 diorama and goes through the HD-2D post-processing stack;
    `draw` paints the 240x160 UI layer, which is scaled up afterwards so text
    and frames stay crisp and are never blurred or bloomed.
    """

    opaque = True          # if False, the scene below is drawn first
    grade = None           # postfx profile name, when this scene has a world

    def __init__(self, game):
        self.game = game

    def draw_world(self, canvas):
        pass

    def enter(self):
        pass

    def exit(self):
        pass

    def handle(self, event):
        pass

    def update(self, dt):
        pass

    def draw(self, surf):
        pass


class Game:
    def __init__(self, scale=config.DEFAULT_SCALE, fullscreen=False):
        self.canvas = pygame.Surface((config.INTERNAL_W, config.INTERNAL_H))
        self.ui = pygame.Surface((config.UI_W, config.UI_H), pygame.SRCALPHA)
        self.scale = scale
        self.fullscreen = fullscreen
        self.screen = None
        self.scenes = []
        self.running = True
        self.player = None
        self.clock = pygame.time.Clock()
        self.time = 0.0
        self.blink = True
        self._fade = None
        self._flash = None
        self.assets = {}
        self._ui_big = pygame.Surface((config.INTERNAL_W, config.INTERNAL_H),
                                      pygame.SRCALPHA)
        self.present_rect = pygame.Rect(0, 0, config.INTERNAL_W,
                                        config.INTERNAL_H)
        self._apply_mode()
        self._present = pygame.Surface(self.present_rect.size)
        # needs a display mode to exist, so it is built last
        self.fx = postfx.PostFX((config.INTERNAL_W, config.INTERNAL_H))

    # --- display ----------------------------------------------------------
    def _apply_mode(self):
        if self.fullscreen:
            self.screen = pygame.display.set_mode(
                (0, 0), pygame.FULLSCREEN | pygame.RESIZABLE, vsync=1)
        else:
            size = (config.INTERNAL_W * self.scale,
                    config.INTERNAL_H * self.scale)
            self.screen = pygame.display.set_mode(size, pygame.RESIZABLE,
                                                  vsync=1)
        pygame.display.set_caption(config.TITLE)
        self._recompute_present_rect()

    def _recompute_present_rect(self):
        """Largest aspect-correct rectangle the canvas fits into, centred."""
        sw, sh = self.screen.get_size()
        k = min(sw / float(config.INTERNAL_W), sh / float(config.INTERNAL_H))
        w = max(1, int(config.INTERNAL_W * k))
        h = max(1, int(config.INTERNAL_H * k))
        self.present_rect = pygame.Rect((sw - w) // 2, (sh - h) // 2, w, h)

    def toggle_fullscreen(self):
        self.fullscreen = not self.fullscreen
        self._apply_mode()
        self._present = pygame.Surface(self.present_rect.size)
        # needs a display mode to exist, so it is built last
        self.fx = postfx.PostFX((config.INTERNAL_W, config.INTERNAL_H))

    def set_scale(self, delta):
        if self.fullscreen:
            return
        self.scale = max(config.MIN_SCALE,
                         min(config.MAX_SCALE, self.scale + delta))
        self._apply_mode()
        self._present = pygame.Surface(self.present_rect.size)
        # needs a display mode to exist, so it is built last
        self.fx = postfx.PostFX((config.INTERNAL_W, config.INTERNAL_H))

    def on_resize(self):
        self._recompute_present_rect()
        self._present = pygame.Surface(self.present_rect.size)

    def screenshot(self, path=None):
        path = path or os.path.join(os.getcwd(),
                                    "ttmon_%d.png" % int(time.time()))
        pygame.image.save(self.canvas, path)
        return path

    # --- scene stack ------------------------------------------------------
    @property
    def scene(self):
        return self.scenes[-1] if self.scenes else None

    def push(self, scene):
        self.scenes.append(scene)
        scene.enter()

    def pop(self):
        if self.scenes:
            s = self.scenes.pop()
            s.exit()

    def replace(self, scene):
        self.pop()
        self.push(scene)

    def quit(self):
        self.running = False

    # --- transitions ------------------------------------------------------
    @property
    def busy(self):
        return self._fade is not None

    def fade_to(self, fn, dur=0.22, color=P.BLACK):
        """Fade to `color`, run fn(), fade back in."""
        self._fade = {"t": 0.0, "dur": dur, "phase": "out", "fn": fn,
                      "color": color}

    def battle_wipe(self, fn):
        """The classic handheld encounter flourish: flashes, then a wipe."""
        self._fade = {"t": 0.0, "dur": 0.85, "phase": "battle", "fn": fn,
                      "color": P.BLACK}

    def _update_fade(self, dt):
        f = self._fade
        if f is None:
            return
        f["t"] += dt
        if f["phase"] == "battle":
            if f["t"] >= f["dur"]:
                fn = f["fn"]
                self._fade = {"t": 0.0, "dur": 0.2, "phase": "in", "fn": None,
                              "color": P.BLACK}
                if fn:
                    fn()
            return
        if f["t"] >= f["dur"]:
            if f["phase"] == "out":
                fn = f["fn"]
                f["phase"] = "in"
                f["t"] = 0.0
                if fn:
                    fn()
            else:
                self._fade = None

    def _draw_fade(self, surf):
        f = self._fade
        if f is None:
            return
        t = min(1.0, f["t"] / max(0.001, f["dur"]))
        if f["phase"] == "battle":
            self._draw_battle_wipe(surf, t)
            return
        alpha = int(255 * (t if f["phase"] == "out" else 1.0 - t))
        overlay = pygame.Surface(surf.get_size())
        overlay.fill(f["color"])
        overlay.set_alpha(alpha)
        surf.blit(overlay, (0, 0))

    def _draw_battle_wipe(self, surf, t):
        w, h = surf.get_size()
        if t < 0.45:
            # three white flashes
            phase = int(t / 0.075)
            if phase % 2 == 0:
                overlay = pygame.Surface((w, h))
                overlay.fill(P.WHITE)
                overlay.set_alpha(150)
                surf.blit(overlay, (0, 0))
            return
        k = (t - 0.45) / 0.55
        bars = 10
        bar_h = h / bars
        for i in range(bars):
            grow = min(1.0, max(0.0, k * 1.6 - i * 0.03))
            bw = int(w * grow)
            x = 0 if i % 2 == 0 else w - bw
            pygame.draw.rect(surf, P.BLACK, (x, int(i * bar_h), bw,
                                             int(bar_h) + 1))

    # --- main loop --------------------------------------------------------
    def run(self):
        while self.running and self.scenes:
            dt = min(0.05, self.clock.tick(config.FPS) / 1000.0)
            self.tick(dt)
        pygame.quit()

    def tick(self, dt):
        """One frame: input, update, draw. Split out so it can be driven
        by the headless test harness as well as by run()."""
        self.time += dt
        self.blink = (int(self.time * 3) % 2) == 0
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_F11 or (
                        event.key == pygame.K_RETURN
                        and event.mod & pygame.KMOD_ALT):
                    self.toggle_fullscreen()
                    continue
                if event.key in (pygame.K_EQUALS, pygame.K_PLUS,
                                 pygame.K_KP_PLUS):
                    self.set_scale(1)
                    continue
                if event.key in (pygame.K_MINUS, pygame.K_KP_MINUS):
                    self.set_scale(-1)
                    continue
                if event.key == pygame.K_F12:
                    self.screenshot()
                    continue
            if not self.busy and self.scene:
                self.scene.handle(event)
        self._update_fade(dt)
        # Only the top scene updates. Anything below is frozen, which is what
        # keeps the overworld from walking around underneath an open battle.
        if self.scene:
            self.scene.update(dt)
        self._draw()

    def _draw(self):
        self.canvas.fill(P.BLACK)
        start = len(self.scenes) - 1
        while start > 0 and not self.scenes[start].opaque:
            start -= 1
        visible = self.scenes[start:]

        # 1. the world, at full resolution, through the HD-2D stack
        grade = None
        for s in visible:
            s.draw_world(self.canvas)
            if s.grade:
                grade = s.grade
        if grade:
            self.fx.apply(self.canvas, postfx.get(grade))
        else:
            self.fx.clear_lights()

        # 2. the UI, authored at 240x160 and doubled, so it stays sharp
        self.ui.fill((0, 0, 0, 0))
        for s in visible:
            s.draw(self.ui)
        pygame.transform.scale(self.ui, self.canvas.get_size(), self._ui_big)
        self.canvas.blit(self._ui_big, (0, 0))

        self._draw_fade(self.canvas)
        self.screen.fill(P.BLACK)
        pygame.transform.scale(self.canvas, self.present_rect.size,
                               self._present)
        self.screen.blit(self._present, self.present_rect.topleft)
        pygame.display.flip()
