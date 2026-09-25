"""Items, including the sigils used to bind wild monsters."""


class Item:
    def __init__(self, key, name, kind, power=0, price=0, desc="",
                 battle_only=False, field_only=False, stages=None, side="ally"):
        self.key = key
        self.name = name
        self.kind = kind          # heal / mp / cure / revive / capture / stage / dispel
        self.stages = stages or {}
        self.side = side          # for stage and dispel items: whose side it hits
        self.power = power
        self.price = price
        self.desc = desc
        self.battle_only = battle_only
        self.field_only = field_only

    @property
    def is_capture(self):
        return self.kind == "capture"

    @property
    def targets_ally(self):
        return (self.kind in ("heal", "mp", "cure", "revive")
                or (self.kind == "stage" and self.side == "ally"))

    @property
    def whole_side(self):
        """Stage and dispel items act on a whole side, with no target to pick."""
        return self.kind in ("stage", "dispel")

    def use(self, target, battle=None):
        """Apply to a monster. Returns engine events (or plain messages)."""
        ev = []
        if self.kind == "heal":
            if target.down:
                return [{"type": "msg", "text": "%s cannot be roused." % target.name}]
            got = target.heal(self.power)
            ev.append({"type": "heal", "target": target, "amount": got})
        elif self.kind == "mp":
            got = target.restore_mp(self.power)
            ev.append({"type": "mp", "target": target, "amount": got})
            ev.append({"type": "msg", "text": "%s recovers %d MP." % (target.name, got)})
        elif self.kind == "cure":
            if target.cure():
                ev.append({"type": "msg", "text": "%s is cleansed." % target.name})
            else:
                ev.append({"type": "msg", "text": "Nothing to cure."})
        elif self.kind == "revive":
            if target.down:
                target.revive(self.power / 100.0)
                ev.append({"type": "revive", "target": target})
                ev.append({"type": "msg", "text": "%s stirs!" % target.name})
            else:
                ev.append({"type": "msg", "text": "%s is still standing." % target.name})
        elif self.kind == "stage":
            if target.down:
                return ev
            for key, delta in self.stages.items():
                moved = target.apply_buff(key, delta)
                ev.append({"type": "buff", "target": target, "stat": key,
                           "delta": moved})
        elif self.kind == "dispel":
            if target.clear_buffs():
                ev.append({"type": "buff", "target": target, "stat": "atk",
                           "delta": 0})
                ev.append({"type": "msg",
                           "text": "%s's aid is stripped away." % target.name})
        return ev


ITEMS = {}


def _i(*a, **kw):
    it = Item(*a, **kw)
    ITEMS[it.key] = it
    return it


_i("herb", "Spring Herb", "heal", power=45, price=40,
   desc="Restores 45 HP to one monster.")
_i("draught", "Temple Draught", "heal", power=110, price=110,
   desc="Restores 110 HP to one monster.")
_i("dew", "Mnemos Dew", "mp", power=25, price=90,
   desc="Restores 25 MP to one monster.")
_i("charm", "Ward Charm", "cure", price=50,
   desc="Cures any one ailment.")
_i("ash", "Phoenix Ash", "revive", power=50, price=180,
   desc="Revives a fallen monster at half HP.")
_i("sigil_l", "Lesser Sigil", "capture", power=1.0, price=60,
   battle_only=True, desc="Binds a weakened wild monster.")
_i("sigil_g", "Greater Sigil", "capture", power=1.7, price=160,
   battle_only=True, desc="A stronger binding seal.")
_i("sigil_s", "Sacred Sigil", "capture", power=2.8, price=400,
   battle_only=True, desc="Seldom fails on anything mortal.")

# Support in a bottle, so any party can answer a boss's buffs and big hits
# whether or not it has the skills.
_i("incense", "Ward Incense", "stage", price=90, battle_only=True,
   stages={"dfn": 1}, side="ally",
   desc="Raises the whole party's defence for 3 rounds.")
_i("salt", "Withering Salt", "stage", price=90, battle_only=True,
   stages={"atk": -1}, side="foe",
   desc="Lowers every foe's attack for 3 rounds.")
_i("bell", "Unbinding Bell", "dispel", price=140, battle_only=True,
   side="foe", desc="Strips every buff from every foe.")

SHOP_STOCK = ["herb", "draught", "dew", "charm", "ash", "incense", "salt",
              "bell", "sigil_l", "sigil_g", "sigil_s"]


def get(key):
    return ITEMS[key]
