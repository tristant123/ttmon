"""Application shell: window, scaling, scene stack and transitions."""

import os
import time

import pygame

from . import config, palette as P, sfx

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
    """Base class. Scenes are stacked; only the top one gets input."""

    opaque = True          # if False, the scene below is drawn first

    def __init__(self, game):
        self.game = game

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
        self._apply_mode()

    # --- display ----------------------------------------------------------
    def _apply_mode(self):
        flags = pygame.SCALED | pygame.RESIZABLE
        if self.fullscreen:
            self.screen = pygame.display.set_mode(
                (config.INTERNAL_W, config.INTERNAL_H),
                flags | pygame.FULLSCREEN, vsync=1)
        else:
            size = (config.INTERNAL_W * self.scale,
                    config.INTERNAL_H * self.scale)
            self.screen = pygame.display.set_mode(size, flags, vsync=1)
        pygame.display.set_caption(config.TITLE)

    def toggle_fullscreen(self):
        self.fullscreen = not self.fullscreen
        self._apply_mode()

    def set_scale(self, delta):
        if self.fullscreen:
            return
        self.scale = max(config.MIN_SCALE,
                         min(config.MAX_SCALE, self.scale + delta))
        self._apply_mode()

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
        for s in self.scenes[start:]:
            s.draw(self.canvas)
        self._draw_fade(self.canvas)
        self.screen.blit(self.canvas, (0, 0))
        pygame.display.flip()
