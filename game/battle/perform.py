"""How a monster moves when it acts: the few frames either side of a hit.

Breath of Fire's battlers step out of line, lunge, and spring back; SMT's
demons rear and flare. A Performance is that motion for one action - a pose
to show, an offset to draw it at, and a trail of afterimages on the fast
part - and it knows the moment of impact, which is when the spell effect
and the damage numbers should land.
"""

import math


def _ease_out(t):
    return 1.0 - (1.0 - t) ** 3


def _ease_in(t):
    return t * t * t


class Performance:
    # (phase, duration, pose)
    TIMELINES = {
        # step back, dash in, hold on the hit, spring back
        "melee": (("windup", 0.14, "idle"), ("dash", 0.09, "attack"),
                  ("hit", 0.16, "attack"), ("back", 0.18, "idle")),
        # rear up into the cast pose, hold it through the release
        "cast": (("raise", 0.14, "cast"), ("hold", 0.26, "cast"),
                 ("settle", 0.14, "idle")),
        "support": (("raise", 0.12, "cast"), ("hold", 0.18, "cast"),
                    ("settle", 0.12, "idle")),
    }
    IMPACT = {"melee": "hit", "cast": "hold", "support": "hold"}

    def __init__(self, kind, start, target, reach=30):
        self.kind = kind
        self.timeline = self.TIMELINES[kind]
        self.t = 0.0
        sx, sy = start
        tx, ty = target
        dx, dy = tx - sx, ty - sy
        dist = math.hypot(dx, dy) or 1.0
        self.dir = (dx / dist, dy / dist)
        self.reach = min(reach, dist * 0.45)
        self.trail = []                    # recent (dx, dy) while dashing
        self.duration = sum(d for _, d, _ in self.timeline)
        self.impact = 0.0
        for phase, d, _ in self.timeline:
            if phase == self.IMPACT[kind]:
                break
            self.impact += d

    @property
    def done(self):
        return self.t >= self.duration

    def _phase(self):
        t = self.t
        for phase, d, pose in self.timeline:
            if t < d:
                return phase, t / d, pose
            t -= d
        phase, d, pose = self.timeline[-1]
        return phase, 1.0, pose

    def update(self, dt):
        self.t += dt
        phase, _, _ = self._phase()
        if phase == "dash":
            self.trail.append(self.offset())
            self.trail = self.trail[-4:]
        elif self.trail and phase != "hit":
            self.trail = self.trail[1:]

    @property
    def pose(self):
        return self._phase()[2]

    def offset(self):
        """(dx, dy) to draw the monster at, in canvas pixels."""
        phase, k, _ = self._phase()
        ux, uy = self.dir
        if self.kind == "melee":
            if phase == "windup":
                d = -6 * _ease_out(k)
            elif phase == "dash":
                d = -6 + (self.reach + 6) * _ease_in(k)
            elif phase == "hit":
                d = self.reach - 3 * k           # a little recoil on contact
            else:
                d = (self.reach - 3) * (1.0 - _ease_out(k))
            return int(round(ux * d)), int(round(uy * d))
        # casting: rise a few pixels and hang there
        if phase == "raise":
            lift = -4 * _ease_out(k)
        elif phase == "hold":
            lift = -4 + math.sin(k * math.pi) * -1
        else:
            lift = -4 * (1.0 - _ease_out(k))
        return 0, int(round(lift))

    def glow(self):
        """0..1: how brightly the caster should flare."""
        phase, k, _ = self._phase()
        if self.kind == "melee":
            return 0.0
        if phase == "raise":
            return k
        if phase == "hold":
            return 1.0 - 0.5 * k
        return 0.5 * (1.0 - k)


def kind_for(skill):
    """Which performance an action gets."""
    from ..data import skills as SK
    from ..data.elements import PHYS
    if skill is None:
        return "support"
    if skill.kind in (SK.RECOVER, SK.REVIVE, SK.CURE, SK.BUFF, SK.DEBUFF,
                      SK.SCAN, SK.CHARGE):
        return "support"
    if skill.element == PHYS and skill.kind == SK.ATTACK:
        return "melee"
    return "cast"
