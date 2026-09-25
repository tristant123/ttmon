"""A single monster instance: stats, growth, buffs and ailments."""

import random

from .data import species as SP
from .data import skills as SK
from .data.elements import NEUTRAL, WEAK, RESIST, NULL, DRAIN, REPEL

STAT_KEYS = ("st", "ma", "vi", "ag", "lu")
BUFF_KEYS = ("atk", "dfn", "agi")
BUFF_LIMIT = 3
# Each stage is worth a quarter: +3 attack hits 1.75x as hard, and -3 hits at
# 1/1.75. Stages act on damage directly rather than through a stat under a
# square root, so a Ward is worth casting - under the old rule three stacks
# of defence took barely a fifth off a hit.
BUFF_STEP = 0.25
# Stages wear off after this many rounds (SMT V's rule), so buffing is
# upkeep rather than a thing done once at the top of a fight.
BUFF_ROUNDS = 3

AILMENTS = {
    "poison": "Poison",
    "sleep": "Sleep",
    "bind": "Bind",
    "fear": "Fear",
}
AILMENT_SHORT = {"poison": "PSN", "sleep": "SLP", "bind": "BND", "fear": "FER"}


class Monster:
    def __init__(self, species_key, level, nickname=None, wild=False):
        self.species = SP.get(species_key)
        self.level = level
        self.nickname = nickname
        self.xp = 0
        self.skills = list(self.species.skills_at(level))[-6:]
        self.maxhp = SP.hp_at(self.species.base["hp"], level)
        self.maxmp = SP.mp_at(self.species.base["mp"], level)
        self.hp = self.maxhp
        self.mp = self.maxmp
        self.buffs = {k: 0 for k in BUFF_KEYS}
        self.buff_rounds = {k: 0 for k in BUFF_KEYS}
        self.ailment = None
        self.ailment_turns = 0
        self.wild = wild
        self.scanned = False
        self.charged = False          # a telegraphed attack is wound up

    # --- identity ---------------------------------------------------------
    @property
    def name(self):
        return self.nickname or self.species.name

    @property
    def art(self):
        return self.species.art

    @property
    def down(self):
        return self.hp <= 0

    # --- stats ------------------------------------------------------------
    def base_stat(self, key):
        return SP.stat_at(self.species.base[key], self.level)

    def stat(self, key):
        """Effective stat including speed stages and ailment penalties.
        Attack and defence stages are not folded in here; the engine applies
        them to damage directly (see buff_mult)."""
        val = float(self.base_stat(key))
        if key == "ag":
            val *= self.buff_mult("agi")
            if self.ailment == "bind":
                val *= 0.5
            elif self.ailment == "fear":
                val *= 0.8
        if self.ailment == "poison" and key in ("st", "ma"):
            val *= 0.85
        return max(1.0, val)

    def buff_mult(self, key):
        """1.25 per stage up; symmetric on the way down (-2 is 1/1.5)."""
        n = self.buffs[key]
        if n >= 0:
            return 1.0 + BUFF_STEP * n
        return 1.0 / (1.0 + BUFF_STEP * -n)

    def apply_buff(self, key, delta):
        before = self.buffs[key]
        self.buffs[key] = max(-BUFF_LIMIT, min(BUFF_LIMIT, before + delta))
        if self.buffs[key]:
            self.buff_rounds[key] = BUFF_ROUNDS
        return self.buffs[key] - before

    def tick_buffs(self):
        """Count every stage down a round; return the keys that wore off."""
        expired = []
        for k in BUFF_KEYS:
            if not self.buffs[k]:
                continue
            self.buff_rounds[k] -= 1
            if self.buff_rounds[k] <= 0:
                self.buffs[k] = 0
                expired.append(k)
        return expired

    def clear_buffs(self):
        """Strip the positive stages (Dispel). Debuffs stay where they are."""
        had = any(v > 0 for v in self.buffs.values())
        for k in BUFF_KEYS:
            if self.buffs[k] > 0:
                self.buffs[k] = 0
        return had

    # --- affinity ---------------------------------------------------------
    def affinity(self, element):
        return self.species.affinity.get(element, NEUTRAL)

    # --- damage / healing -------------------------------------------------
    def take_damage(self, amount):
        amount = max(0, int(amount))
        self.hp = max(0, self.hp - amount)
        if self.hp == 0:
            self.ailment = None
            self._reset_buffs()
        return amount

    def heal(self, amount):
        if self.down:
            return 0
        amount = int(amount)
        before = self.hp
        self.hp = min(self.maxhp, self.hp + amount)
        return self.hp - before

    def restore_mp(self, amount):
        before = self.mp
        self.mp = min(self.maxmp, self.mp + int(amount))
        return self.mp - before

    def spend(self, skill):
        if skill.hp_cost:
            cost = max(1, int(self.maxhp * skill.hp_cost))
            self.hp = max(1, self.hp - cost)
        elif skill.cost:
            self.mp = max(0, self.mp - skill.cost)

    def can_pay(self, skill):
        if skill.hp_cost:
            return self.hp > max(1, int(self.maxhp * skill.hp_cost))
        return self.mp >= skill.cost

    def revive(self, fraction=0.5):
        self.hp = max(1, int(self.maxhp * fraction))
        self.ailment = None

    def full_restore(self):
        self.hp = self.maxhp
        self.mp = self.maxmp
        self.ailment = None
        self.ailment_turns = 0
        self._reset_buffs()

    def _reset_buffs(self):
        for k in BUFF_KEYS:
            self.buffs[k] = 0
            self.buff_rounds[k] = 0

    def reset_battle_state(self):
        self._reset_buffs()
        self.charged = False
        if self.ailment in ("sleep", "bind", "fear"):
            self.ailment = None

    # --- ailments ---------------------------------------------------------
    def inflict(self, ailment, rng=random):
        if self.down or self.ailment == ailment:
            return False
        self.ailment = ailment
        self.ailment_turns = rng.randint(2, 4)
        return True

    def cure(self):
        had = self.ailment is not None
        self.ailment = None
        self.ailment_turns = 0
        return had

    # --- progression ------------------------------------------------------
    def gain_xp(self, amount):
        """Returns a list of (kind, payload) growth events."""
        events = []
        self.xp += amount
        while self.level < 40 and self.xp >= SP.xp_to_next(self.level):
            self.xp -= SP.xp_to_next(self.level)
            events.extend(self.level_up())
        return events

    def level_up(self):
        events = []
        self.level += 1
        old_hp, old_mp = self.maxhp, self.maxmp
        self.maxhp = SP.hp_at(self.species.base["hp"], self.level)
        self.maxmp = SP.mp_at(self.species.base["mp"], self.level)
        self.hp += self.maxhp - old_hp
        self.mp += self.maxmp - old_mp
        events.append(("level", self.level))
        for lv, key in self.species.learn:
            if lv == self.level and key not in self.skills:
                if len(self.skills) >= 6:
                    self.skills.pop(0)
                self.skills.append(key)
                events.append(("skill", key))
        return events

    def skill_objs(self):
        return [SK.get(k) for k in self.skills]

    def __repr__(self):
        return "<%s Lv%d %d/%d>" % (self.name, self.level, self.hp, self.maxhp)


def make_wild(species_key, level, rng=random):
    """Wild monsters vary a little so encounters are not clones."""
    m = Monster(species_key, level, wild=True)
    jitter = rng.uniform(0.92, 1.12)
    m.maxhp = max(6, int(m.maxhp * jitter))
    m.hp = m.maxhp
    return m
