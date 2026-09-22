"""The player's persistent state: party, bag, coin and position."""

from .config import BATTLE_SLOTS, PARTY_MAX
from .monster import Monster


class PlayerState:
    def __init__(self, name="Binder"):
        self.name = name
        self.party = []
        self.inventory = {}
        self.gold = 250
        self.map_key = "village"
        self.x = 13
        self.y = 14
        self.facing = "down"
        self.flags = set()
        self.steps = 0
        self.seen = set()          # species keys encountered
        self.bound = set()         # species keys captured

    # --- party ------------------------------------------------------------
    def active(self):
        """The monsters that take the field, in order."""
        return self.party[:BATTLE_SLOTS]

    def fielded(self):
        return [m for m in self.active() if not m.down]

    def all_down(self):
        return all(m.down for m in self.party) if self.party else True

    def add_monster(self, mon):
        if len(self.party) >= PARTY_MAX:
            return False
        self.party.append(mon)
        self.bound.add(mon.species.key)
        self.seen.add(mon.species.key)
        return True

    def has_room(self):
        return len(self.party) < PARTY_MAX

    def swap(self, i, j):
        self.party[i], self.party[j] = self.party[j], self.party[i]

    def heal_all(self):
        for m in self.party:
            m.full_restore()

    # --- bag --------------------------------------------------------------
    def give(self, key, count=1):
        self.inventory[key] = self.inventory.get(key, 0) + count

    def take(self, key, count=1):
        have = self.inventory.get(key, 0)
        if have < count:
            return False
        self.inventory[key] = have - count
        if self.inventory[key] <= 0:
            del self.inventory[key]
        return True

    def count(self, key):
        return self.inventory.get(key, 0)

    def bag_items(self, battle=False):
        from .data.items import ITEMS
        out = []
        for key, n in self.inventory.items():
            if n <= 0:
                continue
            item = ITEMS[key]
            if item.battle_only and not battle:
                continue
            out.append((item, n))
        out.sort(key=lambda t: (t[0].is_capture, t[0].price))
        return out

    # --- serialisation ----------------------------------------------------
    def to_dict(self):
        return {
            "name": self.name,
            "gold": self.gold,
            "map": self.map_key,
            "x": self.x, "y": self.y, "facing": self.facing,
            "flags": sorted(self.flags),
            "steps": self.steps,
            "seen": sorted(self.seen),
            "bound": sorted(self.bound),
            "inventory": dict(self.inventory),
            "party": [monster_to_dict(m) for m in self.party],
        }

    @classmethod
    def from_dict(cls, data):
        p = cls(data.get("name", "Binder"))
        p.gold = data.get("gold", 0)
        p.map_key = data.get("map", "village")
        p.x, p.y = data.get("x", 13), data.get("y", 14)
        p.facing = data.get("facing", "down")
        p.flags = set(data.get("flags", []))
        p.steps = data.get("steps", 0)
        p.seen = set(data.get("seen", []))
        p.bound = set(data.get("bound", []))
        p.inventory = dict(data.get("inventory", {}))
        p.party = [monster_from_dict(d) for d in data.get("party", [])]
        return p


def monster_to_dict(m):
    return {
        "species": m.species.key, "level": m.level, "xp": m.xp,
        "hp": m.hp, "mp": m.mp, "skills": list(m.skills),
        "nickname": m.nickname,
    }


def monster_from_dict(d):
    m = Monster(d["species"], d["level"], d.get("nickname"))
    m.xp = d.get("xp", 0)
    m.skills = list(d.get("skills") or m.skills)
    m.hp = min(d.get("hp", m.maxhp), m.maxhp)
    m.mp = min(d.get("mp", m.maxmp), m.maxmp)
    return m


def new_game(starter_key="pixie"):
    p = PlayerState()
    starter = Monster(starter_key, 5)
    p.add_monster(starter)
    p.give("herb", 3)
    p.give("sigil_l", 5)
    p.flags.add("has_starter")
    return p
