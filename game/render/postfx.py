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
                 vignette=0.5, fog=None, fog_strength=0.0, sat=1.0,
                 dither=1.0, quantize=True, frame_fog=True):
        self.name = name
        self.frame_fog = frame_fog       # False: the scene bakes its own haze
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
        self.dither = dither        # ordered dither before the depth cut
        self.quantize = quantize    # reduce to a 16-bit framebuffer


PROFILES = {
    "village": Grade("village", tint=(255, 248, 234), lift=(12, 8, 0),
                     bloom=0.30, threshold=150, dof=0.0,
                     vignette=0.34, fog=(214, 200, 176), fog_strength=0.34),
    "route": Grade("route", tint=(250, 252, 244), lift=(8, 10, 4),
                   bloom=0.26, threshold=154, dof=0.0,
                   vignette=0.30, fog=(198, 214, 208), fog_strength=0.38),
    "ruins": Grade("ruins", tint=(255, 242, 218), lift=(18, 10, 0),
                   bloom=0.32, threshold=148, dof=0.0,
                   vignette=0.34, fog=(226, 200, 166), fog_strength=0.40),
    "shrine": Grade("shrine", tint=(218, 228, 255), lift=(4, 10, 26),
                    bloom=0.36, threshold=146, dof=0.0,
                    vignette=0.38, fog=(120, 138, 190), fog_strength=0.44),
    # Battle grades carry a fog colour for the stage to bake in (see
    # arena.haze), and apply none over the frame: it greyed the monsters.
    "battle": Grade("battle", tint=(250, 246, 240), lift=(8, 6, 4),
                    bloom=0.30, threshold=150, dof=0.0,
                    vignette=0.32, fog=(186, 196, 216), fog_strength=0.34,
                    frame_fog=False),
    "boss": Grade("boss", tint=(230, 220, 250), lift=(16, 6, 22),
                  bloom=0.38, threshold=144, dof=0.0,
                  vignette=0.44, fog=(122, 104, 168), fog_strength=0.40,
                  frame_fog=False),
    "flat": Grade("flat", bloom=0.0, dof=0.0, vignette=0.0, fog=None,
                  dither=0.0, quantize=False),
}


# The PS1 rendered into a 16-bit framebuffer, so its gradients banded badly.
# Studios hid it by dithering before the depth cut, and that speckle is one of
# the most recognisable things about the era's look.
BAYER = (
    (0, 8, 2, 10),
    (12, 4, 14, 6),
    (3, 11, 1, 9),
    (15, 7, 13, 5),
)


def _dither_tiles(size, strength):
    """Two tiled surfaces: what to add, and what to subtract, so the dither is
    centred on zero instead of brightening the whole frame."""
    w, h = size
    step = 255.0 / 31.0                       # one level of a 5-bit channel
    pos = pygame.Surface((4, 4))
    neg = pygame.Surface((4, 4))
    for y in range(4):
        for x in range(4):
            v = ((BAYER[y][x] + 0.5) / 16.0 - 0.5) * step * 2.0 * strength
            a = int(max(0.0, v))
            b = int(max(0.0, -v))
            pos.set_at((x, y), (a, a, a))
            neg.set_at((x, y), (b, b, b))
    big_pos = pygame.Surface((w, h))
    big_neg = pygame.Surface((w, h))
    for ty in range(0, h, 4):
        for tx in range(0, w, 4):
            big_pos.blit(pos, (tx, ty))
            big_neg.blit(neg, (tx, ty))
    return big_pos.convert(), big_neg.convert()


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
        self._dither = {}
        self._lowbit = pygame.Surface(size, 0, 16)
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
        if not grade.fog or grade.fog_strength <= 0.01 or not grade.frame_fog:
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

    def _ps1(self, frame, grade):
        """Dither, then cut the frame to 16-bit colour."""
        if grade.dither > 0.01:
            key = round(grade.dither, 2)
            tiles = self._dither.get(key)
            if tiles is None:
                tiles = _dither_tiles(self.size, grade.dither)
                self._dither[key] = tiles
            frame.blit(tiles[0], (0, 0), special_flags=pygame.BLEND_RGB_ADD)
            frame.blit(tiles[1], (0, 0), special_flags=pygame.BLEND_RGB_SUB)
        if grade.quantize:
            self._lowbit.blit(frame, (0, 0))
            frame.blit(self._lowbit, (0, 0))

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
        self._ps1(frame, grade)
        self.clear_lights()
        return frame


def get(name):
    return PROFILES.get(name, PROFILES["village"])
