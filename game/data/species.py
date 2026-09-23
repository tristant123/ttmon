"""Monster species.

Affinities are the spine of the combat design: almost everything has an
exploitable hole, and almost everything can punish the wrong element back.
"""

from .elements import (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK,
                       WEAK, RESIST, NULL, DRAIN, REPEL)


class Species:
    def __init__(self, key, name, race, art, affinity, base, learn,
                 catch=45, xp=24, flee=False, press=0, scale=2, desc=""):
        self.key = key
        self.name = name
        self.race = race
        self.art = art
        self.affinity = affinity      # {element: affinity}
        self.base = base              # hp mp st ma vi ag lu
        self.learn = learn            # [(level, skill_key)]
        self.catch = catch            # base recruitment weight
        self.xp = xp                  # xp yield coefficient
        self.flee = flee              # bosses cannot be fled from or bound
        self.press = press            # extra press turn icons per round
        self.scale = scale            # sprite magnification on the battle stage
        self.desc = desc

    def skills_at(self, level):
        return [k for lv, k in self.learn if lv <= level]


def _b(hp, mp, st, ma, vi, ag, lu):
    return {"hp": hp, "mp": mp, "st": st, "ma": ma, "vi": vi, "ag": ag,
            "lu": lu}


SPECIES = {}


def _sp(*a, **kw):
    s = Species(*a, **kw)
    SPECIES[s.key] = s
    return s


_sp("pixie", "Pixie", "Fairy", "pixie",
    {PHYS: WEAK, DARK: WEAK, WIND: RESIST, ELEC: RESIST},
    _b(26, 22, 6, 11, 6, 12, 10),
    [(1, "gust"), (1, "mend"), (3, "spark"), (6, "haste"), (9, "cleanse"),
     (12, "maelstrom"), (15, "mend_all")],
    catch=55, xp=20,
    desc="A hedge-sprite the size of a teacup. Bites.")

_sp("mandrake", "Mandrake", "Plant", "mandrake",
    {FIRE: WEAK, ICE: WEAK, ELEC: RESIST, WIND: RESIST},
    _b(30, 14, 9, 7, 10, 6, 7),
    [(1, "lunge"), (1, "venom"), (4, "gust"), (7, "snare"), (10, "sap"),
     (13, "gale_fang")],
    catch=60, xp=18,
    desc="Uprooted, it screams. Potted, it sulks.")

_sp("kitsune", "Kitsune", "Yoma", "kitsune",
    {ICE: WEAK, FIRE: RESIST, LIGHT: RESIST},
    _b(32, 26, 8, 13, 7, 13, 12),
    [(1, "ember"), (1, "scan"), (4, "rend"), (7, "sap"), (10, "pyre"),
     (14, "inferno"), (18, "lullaby")],
    catch=38, xp=30,
    desc="Counts its own tails when it thinks you are not looking.")

_sp("kappa", "Kappa", "Yoma", "kappa",
    {ELEC: WEAK, ICE: RESIST, FIRE: RESIST, PHYS: RESIST},
    _b(40, 20, 11, 10, 13, 6, 8),
    [(1, "frost"), (1, "lunge"), (4, "ward"), (8, "rime"), (11, "snare"),
     (14, "glacier"), (17, "mend_all")],
    catch=42, xp=30,
    desc="Polite to a fault. Do not let it near the river.")

_sp("thunderbird", "Thunderbird", "Avian", "thunderbird",
    {WIND: WEAK, ELEC: NULL, PHYS: RESIST},
    _b(34, 24, 10, 13, 8, 15, 11),
    [(1, "spark"), (1, "lunge"), (5, "haste"), (8, "bolt"), (12, "gale_fang"),
     (16, "tempest"), (20, "dispel")],
    catch=30, xp=38,
    desc="Storm-chick. The thunder is entirely its own fault.")

_sp("golem", "Golem", "Earth", "golem",
    {WIND: WEAK, PHYS: RESIST, FIRE: RESIST, ICE: RESIST, DARK: NULL},
    _b(52, 10, 15, 5, 17, 4, 5),
    [(1, "lunge"), (1, "ward"), (5, "snare"), (9, "stone_fist"), (13, "crack"),
     (17, "judgement_blade")],
    catch=22, xp=44,
    desc="A temple guard still standing at a temple that is not.")

_sp("wisp", "Wisp", "Undead", "wisp",
    {ICE: WEAK, LIGHT: WEAK, FIRE: DRAIN, DARK: RESIST, PHYS: RESIST},
    _b(28, 28, 6, 14, 6, 12, 9),
    [(1, "ember"), (1, "gloom"), (4, "dread"), (8, "pyre"), (12, "oblivion"),
     (16, "inferno")],
    catch=34, xp=34,
    desc="A grave-light that learned to smile. Badly.")

_sp("naga", "Naga", "Snake", "naga",
    {ELEC: WEAK, ICE: DRAIN, FIRE: WEAK, DARK: RESIST},
    _b(38, 26, 10, 14, 11, 9, 10),
    [(1, "frost"), (1, "venom"), (5, "crack"), (9, "rime"), (12, "snare"),
     (16, "glacier"), (19, "mend_all")],
    catch=28, xp=40,
    desc="Priestess of a spring that never thaws.")

_sp("tengu", "Tengu", "Yoma", "tengu",
    {ICE: WEAK, WIND: NULL, ELEC: RESIST},
    _b(36, 24, 13, 11, 10, 16, 12),
    [(1, "gust"), (1, "rend"), (5, "haste"), (9, "cyclone"), (12, "gale_fang"),
     (15, "slow"), (19, "maelstrom")],
    catch=24, xp=46,
    desc="Mountain ascetic. Will lecture you mid-battle.")

_sp("cerberus", "Cerberus", "Beast", "cerberus",
    {ICE: WEAK, FIRE: RESIST, DARK: RESIST, PHYS: RESIST},
    _b(46, 20, 16, 12, 12, 14, 9),
    [(1, "rend"), (1, "ember"), (6, "skullcrack"), (10, "inferno"),
     (13, "bolster"), (17, "gale_fang"), (21, "pyre")],
    catch=16, xp=60,
    desc="Three heads. One idea, held very firmly.")

_sp("baku", "Baku", "Dream", "baku",
    {LIGHT: WEAK, DARK: DRAIN, PHYS: RESIST, ELEC: RESIST},
    _b(48, 26, 11, 13, 14, 8, 11),
    [(1, "gloom"), (1, "lullaby"), (6, "mend"), (10, "oblivion"),
     (13, "dread"), (16, "mend_all"), (20, "dispel")],
    catch=18, xp=58,
    desc="Eats bad dreams. Is not fussy about whose.")

_sp("anubis", "Anubis", "Deity", "anubis",
    {WIND: WEAK, LIGHT: REPEL, DARK: DRAIN, PHYS: RESIST, FIRE: RESIST,
     ICE: RESIST},
    _b(115, 60, 16, 18, 16, 15, 14),
    [(1, "scale_of_ma"), (1, "judgement_blade"), (1, "radiance"),
     (1, "mythos_ray"), (1, "crack"), (1, "bolster"), (1, "dread")],
    catch=0, xp=300, flee=True, press=1, scale=3,
    desc="Keeper of the scale. He has already read your weight.")


def get(key):
    return SPECIES[key]


# --- level maths -------------------------------------------------------------

def stat_at(base_value, level, growth=0.06):
    return max(1, int(round(base_value * (1.0 + growth * (level - 1)))))


def hp_at(base_value, level):
    return int(round(base_value * (1.0 + 0.115 * (level - 1))))


def mp_at(base_value, level):
    return int(round(base_value * (1.0 + 0.085 * (level - 1))))


def xp_to_next(level):
    """XP required to go from `level` to `level` + 1."""
    return int(12 + 5 * level * level)


def xp_reward(species, level, party_size):
    base = species.xp * (1.0 + 0.22 * (level - 1))
    return max(1, int(base / max(1, party_size) * 1.6))
