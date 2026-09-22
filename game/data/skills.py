"""Skill definitions.

Costs are MP unless ``hp_cost`` is set (physical arts spend a slice of max HP,
the way Shin Megami Tensei's physical skills do, which keeps MP meaningful).
``power`` is the damage coefficient; for AILMENT/INSTAKILL skills it is the
base chance in percent.
"""

from .elements import (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK, ALMIGHTY,
                       HEAL, SUPPORT)

# target modes
ONE_FOE, ALL_FOES, ONE_ALLY, ALL_ALLIES, SELF = range(5)
# skill kinds
ATTACK, AILMENT, INSTAKILL, BUFF, DEBUFF, RECOVER, REVIVE, CURE, SCAN = range(9)


class Skill:
    def __init__(self, key, name, element, kind=ATTACK, power=0, cost=0,
                 hp_cost=0.0, target=ONE_FOE, hits=(1, 1), acc=0.95,
                 crit=0.0, effect=None, stages=None, desc=""):
        self.key = key
        self.name = name
        self.element = element
        self.kind = kind
        self.power = power
        self.cost = cost
        self.hp_cost = hp_cost
        self.target = target
        self.hits = hits
        self.acc = acc
        self.crit = crit
        self.effect = effect          # ailment key, or buff stat tuple
        self.stages = stages or {}    # {'atk': +1} etc.
        self.desc = desc

    @property
    def multi(self):
        return self.hits[1] > 1

    def cost_text(self):
        if self.hp_cost:
            return "%d%% HP" % round(self.hp_cost * 100)
        if self.cost:
            return "%d MP" % self.cost
        return "-"

    def __repr__(self):
        return "<Skill %s>" % self.key


def _s(*a, **kw):
    sk = Skill(*a, **kw)
    ALL[sk.key] = sk
    return sk


ALL = {}

# The free basic attack. Every monster can always fall back on this, which is
# what keeps a battle from stalling once MP runs dry.
_s("strike", "Strike", PHYS, power=23, cost=0, acc=0.92, crit=0.05,
   desc="A basic attack. Costs nothing.")

# --- Physical arts (cost HP) -------------------------------------------------
_s("lunge", "Lunge", PHYS, power=32, hp_cost=0.06, acc=0.94,
   desc="A plain running tackle.")
_s("rend", "Rend", PHYS, power=17, hp_cost=0.08, hits=(1, 3), acc=0.88,
   desc="Claws 1-3 times at one foe.")
_s("skullcrack", "Skull Crack", PHYS, power=46, hp_cost=0.11, acc=0.86,
   crit=0.12, desc="Heavy blow. Often critical.")
_s("gale_fang", "Gale Fang", PHYS, power=24, hp_cost=0.07, target=ALL_FOES,
   acc=0.88, desc="Rakes every foe.")
_s("stone_fist", "Stone Fist", PHYS, power=58, hp_cost=0.14, acc=0.80,
   crit=0.08, desc="Slow, ruinous, unreliable.")
_s("judgement_blade", "Judge's Blade", PHYS, power=40, hp_cost=0.10,
   target=ALL_FOES, acc=0.90, crit=0.10, desc="A sweeping verdict.")

# --- Elemental magic ---------------------------------------------------------
_s("ember", "Ember", FIRE, power=30, cost=4, acc=0.97, desc="Light fire damage.")
_s("pyre", "Pyre", FIRE, power=52, cost=10, acc=0.97, desc="Heavy fire damage.")
_s("inferno", "Inferno", FIRE, power=34, cost=14, target=ALL_FOES, acc=0.97,
   desc="Fire damage to all foes.")
_s("frost", "Frost", ICE, power=30, cost=4, acc=0.97, desc="Light ice damage.")
_s("rime", "Rime", ICE, power=52, cost=10, acc=0.97, desc="Heavy ice damage.")
_s("glacier", "Glacier", ICE, power=34, cost=14, target=ALL_FOES, acc=0.97,
   desc="Ice damage to all foes.")
_s("spark", "Spark", ELEC, power=30, cost=4, acc=0.97, desc="Light shock damage.")
_s("bolt", "Bolt", ELEC, power=52, cost=10, acc=0.97, desc="Heavy shock damage.")
_s("tempest", "Tempest", ELEC, power=34, cost=14, target=ALL_FOES, acc=0.97,
   desc="Shock damage to all foes.")
_s("gust", "Gust", WIND, power=30, cost=4, acc=0.97, desc="Light wind damage.")
_s("cyclone", "Cyclone", WIND, power=52, cost=10, acc=0.97,
   desc="Heavy wind damage.")
_s("maelstrom", "Maelstrom", WIND, power=34, cost=14, target=ALL_FOES,
   acc=0.97, desc="Wind damage to all foes.")
_s("glimmer", "Glimmer", LIGHT, power=34, cost=6, acc=0.97,
   desc="Light damage to one foe.")
_s("gloom", "Gloom", DARK, power=34, cost=6, acc=0.97,
   desc="Dark damage to one foe.")
_s("mythos_ray", "Mythos Ray", ALMIGHTY, power=31, cost=26, target=ALL_FOES,
   acc=1.0, desc="Damage no affinity can turn aside.")
_s("scale_of_ma", "Scale of Ma'at", ALMIGHTY, power=70, cost=26, acc=1.0,
   desc="Weighs one heart and finds it wanting.")

# --- Instant death -----------------------------------------------------------
_s("radiance", "Radiance", LIGHT, kind=INSTAKILL, power=32, cost=12,
   desc="Chance to expel one foe outright.")
_s("oblivion", "Oblivion", DARK, kind=INSTAKILL, power=32, cost=12,
   desc="Chance to unmake one foe outright.")

# --- Ailments ----------------------------------------------------------------
_s("venom", "Venom Spit", DARK, kind=AILMENT, power=68, cost=6,
   effect="poison", desc="May poison one foe.")
_s("lullaby", "Lullaby", WIND, kind=AILMENT, power=60, cost=8,
   target=ALL_FOES, effect="sleep", desc="May lull every foe to sleep.")
_s("snare", "Snare", PHYS, kind=AILMENT, power=66, cost=6, effect="bind",
   desc="May bind one foe in place.")
_s("dread", "Dread", DARK, kind=AILMENT, power=62, cost=8, target=ALL_FOES,
   effect="fear", desc="May shake the resolve of all foes.")

# --- Buffs and debuffs -------------------------------------------------------
_s("bolster", "Bolster", SUPPORT, kind=BUFF, cost=8, target=ALL_ALLIES,
   stages={"atk": 1}, desc="Raises allied attack.")
_s("ward", "Ward", SUPPORT, kind=BUFF, cost=8, target=ALL_ALLIES,
   stages={"dfn": 1}, desc="Raises allied defence.")
_s("haste", "Haste", SUPPORT, kind=BUFF, cost=8, target=ALL_ALLIES,
   stages={"agi": 1}, desc="Raises allied speed and accuracy.")
_s("sap", "Sap", SUPPORT, kind=DEBUFF, cost=8, target=ALL_FOES,
   stages={"atk": -1}, acc=1.0, desc="Lowers enemy attack.")
_s("crack", "Crack", SUPPORT, kind=DEBUFF, cost=8, target=ALL_FOES,
   stages={"dfn": -1}, acc=1.0, desc="Lowers enemy defence.")
_s("slow", "Slow", SUPPORT, kind=DEBUFF, cost=8, target=ALL_FOES,
   stages={"agi": -1}, acc=1.0, desc="Lowers enemy speed.")
_s("dispel", "Dispel", SUPPORT, kind=DEBUFF, cost=10, target=ALL_FOES,
   stages={"clear": 0}, acc=1.0, desc="Strips enemy buffs.")

# --- Recovery ----------------------------------------------------------------
_s("mend", "Mend", HEAL, kind=RECOVER, power=45, cost=6, target=ONE_ALLY,
   desc="Restores some HP to one ally.")
_s("mend_all", "Mend All", HEAL, kind=RECOVER, power=38, cost=16,
   target=ALL_ALLIES, desc="Restores HP to the whole party.")
_s("cleanse", "Cleanse", HEAL, kind=CURE, cost=8, target=ONE_ALLY,
   desc="Cures one ally's ailment.")
_s("kindle", "Kindle", HEAL, kind=REVIVE, power=50, cost=20, target=ONE_ALLY,
   desc="Revives a fallen ally.")

# --- Utility -----------------------------------------------------------------
_s("scan", "Scan", SUPPORT, kind=SCAN, cost=2, target=ONE_FOE, acc=1.0,
   desc="Reveals a foe's affinities.")


BASIC = "strike"


def get(key):
    return ALL[key]


def basic():
    return ALL[BASIC]
