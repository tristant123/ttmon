"""HD-2D post-processing.

The look is built from four cheap, C-speed passes over the frame:

* **Bloom** - a bright-pass is blurred and added back, so lanterns, magic and
  water highlights bleed light the way they do in a lit diorama.
* **Tilt-shift depth of field** - the frame is blurred and composited back in
  horizontal bands, sharp at the focus line and soft toward the top (distance)
  and bottom (foreground). This is what sells the "miniature diorama" read.
* **Vignette and colour grade** - a radial darkening plus a per-location tint,
  so the village is warm afternoon and the shrine is cold dusk.
* **Point lights** - additive radial sprites placed in world space, drawn
  before bloom so they bleed.

Every operation is a pygame blit, smoothscale or fill with a blend flag, so
the whole stack costs about 2ms at 480x320.
"""

import math

import pygame


class Grade:
    """A location's look."""

    def __init__(self, name, tint=(255, 255, 255), lift=(0, 0, 0),
                 bloom=0.85, threshold=118, dof=0.75, focus=0.58,
                 vignette=0.5, fog=None, fog_strength=0.0, sat=1.0):
        self.name = name
        self.tint = tint                 # multiplied over the frame
        self.lift = lift                 # added to the frame (a soft fill light)
        self.bloom = bloom               # 0..1.5 strength
        self.threshold = threshold       # brightness above which things glow
        self.dof = dof                   # 0..1 blur strength away from focus
        self.focus = focus               # 0..1 screen height of the sharp band
        self.vignette = vignette         # 0..1 corner darkening
        self.fog = fog                   # distance haze colour, or None
        self.fog_strength = fog_strength
        self.sat = sat


PROFILES = {
    "village": Grade("village", tint=(255, 248, 232), lift=(14, 10, 2),
                     bloom=0.80, threshold=126, dof=0.70, focus=0.60,
                     vignette=0.42, fog=(226, 214, 198), fog_strength=0.12),
    "route": Grade("route", tint=(250, 252, 242), lift=(10, 12, 6),
                   bloom=0.70, threshold=132, dof=0.66, focus=0.58,
                   vignette=0.38, fog=(214, 228, 226), fog_strength=0.14),
    "ruins": Grade("ruins", tint=(255, 240, 214), lift=(20, 12, 0),
                   bloom=0.88, threshold=124, dof=0.72, focus=0.58,
                   vignette=0.46, fog=(238, 216, 186), fog_strength=0.20),
    "shrine": Grade("shrine", tint=(216, 228, 255), lift=(4, 12, 30),
                    bloom=0.85, threshold=132, dof=0.74, focus=0.56,
                    vignette=0.45, fog=(150, 166, 214), fog_strength=0.16),
    "battle": Grade("battle", tint=(250, 246, 240), lift=(10, 8, 6),
                    bloom=0.90, threshold=118, dof=0.82, focus=0.56,
                    vignette=0.46, fog=(198, 206, 224), fog_strength=0.18),
    "boss": Grade("boss", tint=(230, 220, 250), lift=(18, 8, 24),
                  bloom=1.0, threshold=116, dof=0.84, focus=0.56,
                  vignette=0.58, fog=(140, 120, 190), fog_strength=0.20),
    "flat": Grade("flat", bloom=0.0, dof=0.0, vignette=0.0, fog=None),
}


def _radial(size, inner=(255, 255, 255), outer=(0, 0, 0), power=1.6):
    """A radial gradient surface, built once and cached."""
    surf = pygame.Surface((size, size))
    half = size / 2.0
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - half + 0.5, y - half + 0.5) / half
            k = max(0.0, 1.0 - d) ** power
            surf.set_at((x, y), tuple(
                int(outer[i] + (inner[i] - outer[i]) * k) for i in range(3)))
    return surf


class PostFX:
    def __init__(self, size):
        self.size = size
        self.w, self.h = size
        self._bright = pygame.Surface(size).convert()
        self._work = pygame.Surface(size).convert()
        self._tint = pygame.Surface(size).convert()
        self._vignettes = {}
        self._light = _radial(96, (255, 255, 255), (0, 0, 0), 2.1)
        self._light_cache = {}
        self.lights = []          # (x, y, radius, colour, intensity)
        self.enabled = True

    # -- lights ------------------------------------------------------------
    def add_light(self, x, y, radius, colour=(255, 210, 140), intensity=1.0):
        self.lights.append((x, y, radius, colour, intensity))

    def clear_lights(self):
        self.lights = []

    def _light_sprite(self, radius, colour, intensity):
        key = (radius, colour, round(intensity, 2))
        spr = self._light_cache.get(key)
        if spr is None:
            spr = pygame.transform.smoothscale(self._light,
                                               (radius * 2, radius * 2))
            k = max(0.0, min(1.0, intensity))
            spr = spr.copy()
            spr.fill((int(colour[0] * k), int(colour[1] * k),
                      int(colour[2] * k)), special_flags=pygame.BLEND_RGB_MULT)
            if len(self._light_cache) > 64:
                self._light_cache.clear()
            self._light_cache[key] = spr
        return spr

    def draw_lights(self, frame):
        for x, y, radius, colour, intensity in self.lights:
            spr = self._light_sprite(radius, colour, intensity)
            frame.blit(spr, (int(x - radius), int(y - radius)),
                       special_flags=pygame.BLEND_RGB_ADD)

    # -- passes ------------------------------------------------------------
    def _blur(self, src, down, passes=1):
        s = src
        for _ in range(passes):
            small = pygame.transform.smoothscale(
                s, (max(2, self.w // down), max(2, self.h // down)))
            s = pygame.transform.smoothscale(small, self.size)
        return s

    def _bloom(self, frame, grade):
        if grade.bloom <= 0.01:
            return
        t = grade.threshold
        self._bright.blit(frame, (0, 0))
        self._bright.fill((t, t, t), special_flags=pygame.BLEND_RGB_SUB)
        glow = self._blur(self._bright, 6, 2)
        k = int(max(0, min(255, grade.bloom * 255)))
        if k < 255:
            glow = glow.copy()
            glow.fill((k, k, k), special_flags=pygame.BLEND_RGB_MULT)
        frame.blit(glow, (0, 0), special_flags=pygame.BLEND_RGB_ADD)

    def _dof(self, frame, grade):
        if grade.dof <= 0.01:
            return
        blurred = self._blur(frame, 3, 1)
        band = 8
        focus_y = self.h * grade.focus
        span = self.h * 0.62
        for y in range(0, self.h, band):
            d = abs((y + band * 0.5) - focus_y) / span
            a = int(235 * grade.dof * min(1.0, d ** 1.7))
            if a <= 4:
                continue
            strip = blurred.subsurface(
                (0, y, self.w, min(band, self.h - y))).copy()
            strip.set_alpha(a)
            frame.blit(strip, (0, y))

    def _fog(self, frame, grade):
        """Distance haze: the further up the screen, the more it washes out."""
        if not grade.fog or grade.fog_strength <= 0.01:
            return
        band = 10
        top = int(self.h * 0.55)
        layer = pygame.Surface((self.w, band)).convert()
        layer.fill(grade.fog)
        for y in range(0, top, band):
            k = 1.0 - (y / float(max(1, top)))
            a = int(190 * grade.fog_strength * (k ** 1.4))
            if a <= 3:
                continue
            layer.set_alpha(a)
            frame.blit(layer, (0, y))

    def _vignette(self, frame, grade):
        if grade.vignette <= 0.01:
            return
        key = round(grade.vignette, 2)
        v = self._vignettes.get(key)
        if v is None:
            dark = int(255 * (1.0 - grade.vignette))
            small = _radial(64, (255, 255, 255), (dark, dark, dark + 8), 1.15)
            v = pygame.transform.smoothscale(
                small, (int(self.w * 1.05), int(self.h * 1.25)))
            self._vignettes[key] = v
        frame.blit(v, (-int(self.w * 0.025), -int(self.h * 0.125)),
                   special_flags=pygame.BLEND_RGB_MULT)

    def _grade(self, frame, grade):
        if grade.tint != (255, 255, 255):
            self._tint.fill(grade.tint)
            frame.blit(self._tint, (0, 0), special_flags=pygame.BLEND_RGB_MULT)
        if any(grade.lift):
            self._tint.fill(grade.lift)
            frame.blit(self._tint, (0, 0), special_flags=pygame.BLEND_RGB_ADD)

    # -- entry point -------------------------------------------------------
    def apply(self, frame, grade):
        """Run the stack in place on `frame`."""
        if not self.enabled or grade is None:
            self.clear_lights()
            return frame
        self.draw_lights(frame)
        self._fog(frame, grade)
        self._bloom(frame, grade)
        self._dof(frame, grade)
        self._vignette(frame, grade)
        self._grade(frame, grade)
        self.clear_lights()
        return frame


def get(name):
    return PROFILES.get(name, PROFILES["village"])
