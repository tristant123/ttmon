"""The Press Turn battle engine.

Rules, following Shin Megami Tensei's Press Turn system:

* At the start of a side's turn it receives one full icon per living member.
* A plain action spends one full icon (or one blinking half icon first).
* Striking a weakness, or landing a critical, turns a full icon into a
  blinking half icon - so you act again, but the side is now on borrowed time.
  If only half icons remain, one is consumed.
* Passing costs half an icon, exactly like a weakness hit.
* A miss, or an attack a foe nullifies, burns two icons.
* An attack that is repelled or drained costs the side *every* remaining icon.

The engine is deliberately free of pygame: it emits a list of event dicts that
a presentation layer animates, which also makes it straightforward to test and
to simulate thousands of battles for balancing.
"""

import math
import random

from ..data import skills as SK
from ..data.elements import (PHYS, HEAL, SUPPORT, ALMIGHTY, NEUTRAL, WEAK,
                             RESIST, NULL, DRAIN, REPEL, AFFINITY_MULT)

PLAYER = "player"
ENEMY = "enemy"

# Consecutive rounds in which the player lands no damage at all before the
# fight is called off. Neither side's HP total is a usable test - physical
# arts cost their user HP, so both totals drift even when nothing is landing.
# What matters is damage the player actually deals.
STALEMATE_ROUNDS = 8

# How often a wild monster plays its best line rather than something
# middling from its top half. Animals are not tacticians; at 0.78 a chance
# early matchup was all but unwinnable.
WILD_INTEL = 0.6

# icon costs
NORMAL, BONUS, MISS, NULLED, REFLECT = "normal", "bonus", "miss", "null", "reflect"


class PressTurns:
    """Full and blinking-half press turn icons for one side."""

    def __init__(self, count=0):
        self.full = count
        self.half = 0

    @property
    def total(self):
        return self.full * 2 + self.half

    @property
    def empty(self):
        return self.full <= 0 and self.half <= 0

    def icons(self):
        """Display list, left to right: True = full, False = blinking half."""
        return [True] * self.full + [False] * self.half

    def spend(self, kind):
        if kind == BONUS:
            if self.full > 0:
                self.full -= 1
                self.half += 1
            elif self.half > 0:
                self.half -= 1
        elif kind == NORMAL:
            if self.half > 0:
                self.half -= 1
            elif self.full > 0:
                self.full -= 1
        elif kind in (MISS, NULLED):
            for _ in range(2):
                if self.half > 0:
                    self.half -= 1
                elif self.full > 0:
                    self.full -= 1
        elif kind == REFLECT:
            self.full = 0
            self.half = 0
        return self


class Action:
    """What a combatant chose to do."""

    def __init__(self, kind, skill=None, targets=None, item=None):
        self.kind = kind          # skill / item / capture / flee / pass / guard
        self.skill = skill
        self.targets = targets or []
        self.item = item


def _ev(_type, **kw):
    kw["type"] = _type
    return kw


class Battle:
    def __init__(self, party, foes, inventory=None, rng=None, boss=False,
                 advantage=0, area="", can_flee=True):
        self.party = party
        self.foes = foes
        self.inventory = inventory if inventory is not None else {}
        self.rng = rng or random.Random()
        self.boss = boss
        self.area = area
        self.can_flee = can_flee and not boss
        self.advantage = advantage      # +1 player struck first, -1 ambushed
        self.side = PLAYER
        self.turns = PressTurns(0)
        self.cursor = 0
        self.finished = None            # 'win' / 'lose' / 'fled' / 'caught'
        self.round = 0
        self.guarding = set()
        self.captured = []
        self.xp_pool = 0
        self.gold_pool = 0
        self._log = []
        # Deadlock guard. A party whose only damage is physical cannot hurt
        # something that nulls physical, and the free Strike is physical too,
        # so such a fight would otherwise run forever. After enough rounds in
        # which nobody's HP moves at all, both sides disengage.
        self._player_damage = 0
        self._stale_rounds = 0
        self.script = {}                # scratch space for a boss script

    # --- helpers ----------------------------------------------------------
    def members(self, side):
        return self.party if side == PLAYER else self.foes

    def living(self, side):
        return [m for m in self.members(side) if not m.down]

    def opposite(self, side):
        return ENEMY if side == PLAYER else PLAYER

    def side_of(self, mon):
        return PLAYER if mon in self.party else ENEMY

    @property
    def current_actor(self):
        mem = self.members(self.side)
        n = len(mem)
        for i in range(n):
            mon = mem[(self.cursor + i) % n]
            if not mon.down:
                return mon
        return None

    @property
    def waiting_for_input(self):
        return (self.finished is None and self.side == PLAYER
                and self.current_actor is not None)

    def _advance_cursor(self):
        mem = self.members(self.side)
        n = len(mem)
        actor = self.current_actor
        if actor is None:
            return
        idx = mem.index(actor)
        self.cursor = (idx + 1) % n

    # --- battle flow ------------------------------------------------------
    def begin(self):
        ev = []
        names = ", ".join(m.name for m in self.foes)
        if self.boss:
            ev.append(_ev("msg", text="%s blocks the way!" % names))
        else:
            ev.append(_ev("msg", text="Wild %s appeared!" % names))
        for m in self.party + self.foes:
            m.reset_battle_state()
        if self.advantage > 0:
            self.side = PLAYER
            ev.append(_ev("msg", text="You struck first!"))
        elif self.advantage < 0:
            self.side = ENEMY
            ev.append(_ev("msg", text="You were ambushed!"))
        else:
            self.side = PLAYER
        ev += self._begin_side(self.side, first=True)
        return ev

    def _begin_side(self, side, first=False):
        self.side = side
        self.cursor = 0
        living = self.living(side)
        count = len(living) + sum(m.species.press for m in living)
        if side == PLAYER and first and self.advantage > 0:
            count += 1
        self.turns = PressTurns(count)
        self.guarding -= set(self.members(side))
        worn = []
        if side == PLAYER and not first:
            worn = self._tick_stages()
        if side == PLAYER:
            self.round += 1
            if self.round > 1:
                if self._player_damage > 0:
                    self._stale_rounds = 0
                else:
                    self._stale_rounds += 1
            self._player_damage = 0
            if self._stale_rounds >= STALEMATE_ROUNDS:
                self.finished = "stalemate"
                return [_ev("msg", text="Nothing you have can touch it."),
                        _ev("end", result="stalemate")]
        ev = [_ev("phase", side=side, text="Your turn" if side == PLAYER
                  else "Foe's turn")]
        ev += worn
        ev += self._settle()
        return ev

    STAGE_WORDS = {"atk": "attack", "dfn": "defence", "agi": "speed"}

    def _tick_stages(self):
        """A new round: every stage counts down, and some wear off."""
        ev = []
        for mon in self.party + self.foes:
            if mon.down:
                continue
            for key in mon.tick_buffs():
                ev.append(_ev("buff", target=mon, stat=key, delta=0))
                ev.append(_ev("msg", text="%s's %s returns to normal."
                              % (mon.name, self.STAGE_WORDS[key])))
        return ev

    def _end_side(self):
        """End-of-turn upkeep for the side that just finished acting."""
        ev = []
        for mon in list(self.members(self.side)):
            if mon.down:
                continue
            if mon.ailment == "poison":
                dmg = max(1, int(mon.maxhp * 0.08))
                mon.take_damage(dmg)
                ev.append(_ev("dmg", target=mon, amount=dmg, affinity=NEUTRAL,
                              crit=False, source="poison"))
                ev.append(_ev("msg", text="%s is wracked by venom." % mon.name))
                if mon.down:
                    ev.append(_ev("faint", target=mon))
            if mon.ailment in ("sleep", "bind", "fear"):
                mon.ailment_turns -= 1
                if mon.ailment_turns <= 0:
                    word = {"sleep": "wakes up", "bind": "breaks free",
                            "fear": "steadies itself"}[mon.ailment]
                    mon.cure()
                    ev.append(_ev("msg", text="%s %s." % (mon.name, word)))
        ev += self._check_end()
        return ev

    def _check_end(self):
        if self.finished:
            return []
        if not self.living(ENEMY):
            self.finished = "win"
            return [_ev("end", result="win")]
        if not self.living(PLAYER):
            self.finished = "lose"
            return [_ev("end", result="lose")]
        return []

    def _settle(self):
        """Resolve auto-skips and side changes until someone can act."""
        ev = []
        for _ in range(64):
            if self.finished:
                return ev
            if self.turns.empty:
                ev += self._end_side()
                if self.finished:
                    return ev
                ev += self._begin_side(self.opposite(self.side))
                return ev
            actor = self.current_actor
            if actor is None:
                ev += self._end_side()
                if self.finished:
                    return ev
                ev += self._begin_side(self.opposite(self.side))
                return ev
            skip = self._incapacitated(actor)
            if not skip:
                return ev
            ev += skip
            self.turns.spend(NORMAL)
            self._advance_cursor()
        return ev

    def _incapacitated(self, actor):
        if actor.ailment == "sleep":
            actor.restore_mp(max(1, int(actor.maxmp * 0.08)))
            actor.heal(max(1, int(actor.maxhp * 0.05)))
            return [_ev("msg", text="%s is fast asleep." % actor.name)]
        if actor.ailment == "bind" and self.rng.random() < 0.5:
            return [_ev("msg", text="%s is bound fast!" % actor.name)]
        if actor.ailment == "fear" and self.rng.random() < 0.3:
            return [_ev("msg", text="%s cowers in fear!" % actor.name)]
        return None

    # --- resolving actions -------------------------------------------------
    def execute(self, action):
        actor = self.current_actor
        if actor is None or self.finished:
            return []
        ev = []
        cost = NORMAL

        if action.kind == "pass":
            ev.append(_ev("msg", text="%s hands over the turn." % actor.name))
            cost = BONUS
        elif action.kind == "guard":
            self.guarding.add(actor)
            ev.append(_ev("msg", text="%s braces itself." % actor.name))
            cost = NORMAL
        elif action.kind == "flee":
            ev, cost = self._do_flee(actor)
        elif action.kind == "capture":
            ev, cost = self._do_capture(actor, action)
        elif action.kind == "item":
            ev, cost = self._do_item(actor, action)
        else:
            ev, cost = self._do_skill(actor, action)

        if self.finished:
            self.turns.spend(cost)
            return ev

        ev.append(_ev("cost", kind=cost))
        self.turns.spend(cost)
        self._advance_cursor()
        ev += self._check_end()
        if not self.finished:
            ev += self._settle()
        return ev

    # --- skills ------------------------------------------------------------
    def _do_skill(self, actor, action):
        skill = action.skill
        ev = [_ev("act", actor=actor, skill=skill)]
        if skill.say:
            ev.append(_ev("msg", text=skill.say.replace("%s", actor.name)))
        actor.spend(skill)
        targets = [t for t in action.targets if not t.down] or None
        if targets is None:
            targets = self._default_targets(actor, skill)
        ev.append(_ev("anim", actor=actor, skill=skill, targets=list(targets)))

        if skill.kind == SK.RECOVER:
            for t in targets:
                if t.down:
                    continue
                amount = self._heal_amount(actor, skill)
                got = t.heal(amount)
                ev.append(_ev("heal", target=t, amount=got))
            return ev, NORMAL
        if skill.kind == SK.CURE:
            for t in targets:
                if t.cure():
                    ev.append(_ev("msg", text="%s is cleansed." % t.name))
                else:
                    ev.append(_ev("msg", text="Nothing to cure."))
            return ev, NORMAL
        if skill.kind == SK.REVIVE:
            for t in targets:
                if t.down:
                    t.revive(skill.power / 100.0)
                    ev.append(_ev("revive", target=t))
                    ev.append(_ev("msg", text="%s returns to the fight!" % t.name))
                else:
                    ev.append(_ev("msg", text="%s is still standing." % t.name))
            return ev, NORMAL
        if skill.kind in (SK.BUFF, SK.DEBUFF):
            return self._do_stages(actor, skill, targets, ev)
        if skill.kind == SK.CHARGE:
            # the wind-up names the blow it is for; nothing else spends it
            actor.charged = skill.effect
            self.script["charged_round"] = self.round
            ev.append(_ev("charge", actor=actor))
            return ev, NORMAL
        if skill.kind == SK.SCAN:
            for t in targets:
                t.scanned = True
                ev.append(_ev("scan", target=t))
                ev.append(_ev("msg", text="%s's affinities are laid bare." % t.name))
            return ev, NORMAL
        if skill.kind == SK.INSTAKILL:
            return self._do_instakill(actor, skill, targets, ev)
        return self._do_attack(actor, skill, targets, ev)

    def _heal_amount(self, actor, skill):
        return skill.power + actor.stat("ma") * 1.2

    def _do_stages(self, actor, skill, targets, ev):
        any_effect = False
        for t in targets:
            if t.down:
                continue
            if "clear" in skill.stages:
                if t.clear_buffs():
                    any_effect = True
                    ev.append(_ev("msg", text="%s's aid is stripped away." % t.name))
                continue
            for key, delta in skill.stages.items():
                moved = t.apply_buff(key, delta)
                if moved:
                    any_effect = True
                ev.append(_ev("buff", target=t, stat=key, delta=moved))
        word = "rises" if skill.kind == SK.BUFF else "falls"
        if any_effect:
            ev.append(_ev("msg", text="%s - power %s." % (skill.name, word)))
        else:
            ev.append(_ev("msg", text="No further effect."))
        return ev, NORMAL

    def _do_instakill(self, actor, skill, targets, ev):
        outcome = NORMAL
        for t in targets:
            aff = t.affinity(skill.element)
            if aff in (DRAIN, REPEL):
                ev.append(_ev("affinity", target=t, affinity=aff,
                              element=skill.element))
                ev.append(_ev("msg", text="%s turns the rite back on you!"
                              % t.name))
                if aff == REPEL:
                    self._reflect_instakill(actor, ev)
                return ev, REFLECT
            if aff == NULL:
                ev.append(_ev("affinity", target=t, affinity=NULL,
                              element=skill.element))
                ev.append(_ev("msg", text="%s is untouched." % t.name))
                outcome = NULLED
                continue
            chance = skill.power / 100.0
            chance *= 1.0 + 0.03 * (actor.stat("lu") - t.stat("lu"))
            if aff == WEAK:
                chance *= 1.8
            elif aff == RESIST:
                chance *= 0.35
            if t.ailment in ("sleep", "bind", "fear"):
                chance *= 1.3
            if self.boss and self.side_of(t) == ENEMY:
                chance *= 0.15
            chance = max(0.02, min(0.45, chance))
            if self.rng.random() < chance:
                t.take_damage(t.maxhp * 99)
                if self.side_of(actor) == PLAYER:
                    self._player_damage += 1
                ev.append(_ev("instakill", target=t, element=skill.element))
                ev.append(_ev("msg", text="%s is struck from the world!" % t.name))
                ev.append(_ev("faint", target=t))
                if outcome == NORMAL:
                    outcome = BONUS
            else:
                ev.append(_ev("miss", target=t))
                ev.append(_ev("msg", text="%s endures." % t.name))
                if outcome == NORMAL:
                    outcome = MISS
        return ev, outcome

    def _reflect_instakill(self, actor, ev):
        if self.rng.random() < 0.35:
            actor.take_damage(actor.maxhp * 99)
            ev.append(_ev("instakill", target=actor, element=None))
            ev.append(_ev("faint", target=actor))
            ev += self._check_end()

    def _do_attack(self, actor, skill, targets, ev):
        outcome = None
        landed_any = False
        if actor.charged and actor.charged == skill.key:
            actor.charged = False
            ev.append(_ev("discharge", actor=actor))
        for t in targets:
            if t.down:
                continue
            aff = t.affinity(skill.element)
            if skill.element == ALMIGHTY:
                aff = NEUTRAL
            # accuracy
            if not self._roll_hit(actor, t, skill):
                ev.append(_ev("miss", target=t))
                ev.append(_ev("msg", text="%s evades!" % t.name))
                outcome = self._worse(outcome, MISS)
                continue
            if aff == REPEL:
                total = 0
                for _ in range(self._hit_count(skill)):
                    total += self._raw_damage(actor, actor, skill, False)
                total = int(max(1, total))
                ev.append(_ev("affinity", target=t, affinity=REPEL,
                              element=skill.element))
                ev.append(_ev("msg", text="%s repels it!" % t.name))
                actor.take_damage(total)
                ev.append(_ev("dmg", target=actor, amount=total, affinity=NEUTRAL,
                              crit=False, source="repel"))
                if actor.down:
                    ev.append(_ev("faint", target=actor))
                outcome = REFLECT
                continue
            if aff == DRAIN:
                total = 0
                for _ in range(self._hit_count(skill)):
                    total += self._raw_damage(actor, t, skill, False)
                got = t.heal(int(max(1, total)))
                ev.append(_ev("affinity", target=t, affinity=DRAIN,
                              element=skill.element))
                ev.append(_ev("heal", target=t, amount=got))
                ev.append(_ev("msg", text="%s drinks it in!" % t.name))
                outcome = REFLECT
                continue
            if aff == NULL:
                ev.append(_ev("affinity", target=t, affinity=NULL,
                              element=skill.element))
                ev.append(_ev("msg", text="%s blocks it." % t.name))
                outcome = self._worse(outcome, NULLED)
                continue

            if skill.kind == SK.AILMENT:
                # A status move. Its power is a chance, not a damage figure;
                # it once dealt damage equal to that chance, which made
                # Lullaby a heavier hit than Gust.
                landed_any = True
                outcome = self._worse(outcome, NORMAL)
                continue

            hits = self._hit_count(skill)
            crit_any = False
            for _ in range(hits):
                crit = (skill.element == PHYS
                        and self.rng.random() < self._crit_chance(actor, t, skill))
                crit_any = crit_any or crit
                dmg = self._raw_damage(actor, t, skill, crit)
                dmg *= AFFINITY_MULT[aff]
                if t in self.guarding:
                    dmg *= 0.45
                dmg = max(1, int(dmg))
                t.take_damage(dmg)
                if self.side_of(actor) == PLAYER:
                    self._player_damage += dmg
                ev.append(_ev("dmg", target=t, amount=dmg, affinity=aff,
                              crit=crit, element=skill.element,
                              hits=hits))
                if t.ailment == "sleep":
                    t.cure()
                    ev.append(_ev("msg", text="%s is jolted awake." % t.name))
                if t.down:
                    break
            landed_any = True
            if aff == WEAK:
                ev.append(_ev("msg", text="A weak point! %s reels." % t.name))
            elif aff == RESIST:
                ev.append(_ev("msg", text="%s shrugs it off." % t.name))
            if crit_any:
                ev.append(_ev("msg", text="A clean hit!"))
            if t.down:
                ev.append(_ev("faint", target=t))
                ev.append(_ev("msg", text="%s is felled!" % t.name))
            if aff == WEAK or crit_any:
                outcome = self._worse(outcome, BONUS)
            else:
                outcome = self._worse(outcome, NORMAL)

        if skill.kind == SK.AILMENT and landed_any:
            ev += self._apply_ailment(actor, skill, targets)
        return ev, outcome or NORMAL

    def _apply_ailment(self, actor, skill, targets):
        ev = []
        for t in targets:
            if t.down:
                continue
            aff = t.affinity(skill.element)
            if aff in (NULL, DRAIN, REPEL):
                continue
            chance = skill.power / 100.0
            chance *= 1.0 + 0.02 * (actor.stat("lu") - t.stat("lu"))
            if aff == WEAK:
                chance *= 1.4
            elif aff == RESIST:
                chance *= 0.5
            if self.boss and self.side_of(t) == ENEMY:
                # A boss that can be bound or slept through its turns is a
                # boss that can be skipped. Debuffs are the tool here.
                ev.append(_ev("msg", text="%s is unmoved." % t.name))
                continue
            if self.rng.random() < max(0.05, min(0.9, chance)):
                if t.inflict(skill.effect, self.rng):
                    ev.append(_ev("status", target=t, ailment=skill.effect))
                    ev.append(_ev("msg", text="%s is afflicted with %s!"
                                  % (t.name, skill.effect.capitalize())))
        return ev

    @staticmethod
    def _worse(current, candidate):
        order = [BONUS, NORMAL, MISS, NULLED, REFLECT]
        if current is None:
            return candidate
        return candidate if order.index(candidate) > order.index(current) else current

    def _hit_count(self, skill):
        lo, hi = skill.hits
        return self.rng.randint(lo, hi)

    def _roll_hit(self, actor, target, skill):
        if skill.acc >= 1.0:
            return True
        ratio = actor.stat("ag") / max(1.0, target.stat("ag"))
        chance = skill.acc * (0.72 + 0.28 * min(2.0, ratio))
        if target.ailment in ("sleep", "bind"):
            chance += 0.2
        return self.rng.random() < max(0.25, min(0.99, chance))

    def _crit_chance(self, actor, target, skill):
        base = 0.045 + skill.crit
        base += 0.006 * (actor.stat("lu") - target.stat("lu"))
        if target.ailment in ("sleep", "bind", "fear"):
            base += 0.15
        return max(0.01, min(0.6, base))

    def _raw_damage(self, actor, target, skill, crit):
        atk = actor.stat("st") if skill.element == PHYS else actor.stat("ma")
        dfn = target.stat("vi")
        raw = skill.power * atk / math.sqrt(max(1.0, dfn)) / 9.0
        raw *= actor.buff_mult("atk") / target.buff_mult("dfn")
        raw *= self.rng.uniform(0.92, 1.08)
        if crit:
            raw *= 1.55
        if target.ailment == "sleep":
            raw *= 1.3
        return raw

    def _default_targets(self, actor, skill):
        side = self.side_of(actor)
        if skill.target in (SK.ONE_FOE, SK.ALL_FOES):
            pool = self.living(self.opposite(side))
        elif skill.target == SK.SELF:
            return [actor]
        else:
            pool = self.living(side)
        if not pool:
            return []
        if skill.target in (SK.ALL_FOES, SK.ALL_ALLIES):
            return list(pool)
        return [self.rng.choice(pool)]

    # --- items, capture, flight --------------------------------------------
    def _do_item(self, actor, action):
        from ..data.items import ITEMS
        item = ITEMS[action.item]
        ev = [_ev("act", actor=actor, item=item)]
        if self.inventory.get(action.item, 0) <= 0:
            return [_ev("msg", text="None left!")], NORMAL
        self.inventory[action.item] -= 1
        targets = action.targets or [actor]
        if item.whole_side:
            side = self.side_of(actor)
            targets = self.living(side if item.side == "ally"
                                  else self.opposite(side))
        for t in targets:
            ev += item.use(t, self)
        if item.kind == "stage":
            word = "rises" if item.side == "ally" else "falls"
            ev.append(_ev("msg", text="%s - power %s." % (item.name, word)))
        return ev, NORMAL

    def _do_capture(self, actor, action):
        from ..data.items import ITEMS
        item = ITEMS[action.item]
        target = action.targets[0] if action.targets else None
        if target is None or target.down:
            return [_ev("msg", text="Nothing to bind.")], NORMAL
        if self.inventory.get(action.item, 0) <= 0:
            return [_ev("msg", text="None left!")], NORMAL
        self.inventory[action.item] -= 1
        ev = [_ev("act", actor=actor, item=item),
              _ev("msg", text="%s hurls a %s!" % (actor.name, item.name))]
        if self.boss or target.species.catch <= 0:
            ev.append(_ev("capture", target=target, success=False,
                          reason="boss"))
            ev.append(_ev("msg", text="The sigil shatters. It will not be bound."))
            return ev, NORMAL
        chance = self.capture_chance(target, item.power)
        ev.append(_ev("capture_try", target=target, chance=chance))
        if self.rng.random() < chance:
            self.captured.append(target)
            target.wild = False
            self.foes.remove(target)
            ev.append(_ev("capture", target=target, success=True))
            ev.append(_ev("msg", text="%s joins you!" % target.name))
            if not self.living(ENEMY):
                self.finished = "win"
                ev.append(_ev("end", result="win"))
            return ev, NORMAL
        ev.append(_ev("capture", target=target, success=False))
        ev.append(_ev("msg", text="%s broke free!" % target.name))
        return ev, NORMAL

    def capture_chance(self, target, item_power):
        hp_ratio = target.hp / float(target.maxhp)
        hp_factor = 1.0 - 0.78 * hp_ratio
        leader = max((m.level for m in self.party), default=1)
        level_factor = max(0.25, min(1.35, 1.25 - 0.06 * (target.level - leader)))
        ail = 1.55 if target.ailment else 1.0
        chance = (target.species.catch / 100.0) * item_power * hp_factor
        chance *= level_factor * ail
        return max(0.02, min(0.95, chance))

    def _do_flee(self, actor):
        if not self.can_flee:
            return [_ev("msg", text="There is no way past!")], NORMAL
        speed = sum(m.stat("ag") for m in self.living(PLAYER))
        foe = sum(m.stat("ag") for m in self.living(ENEMY))
        chance = max(0.15, min(0.92, 0.45 + 0.35 * (speed / max(1.0, foe) - 1.0)))
        if self.rng.random() < chance:
            self.finished = "fled"
            return ([_ev("msg", text="You slip away."),
                     _ev("end", result="fled")], NORMAL)
        return [_ev("msg", text="You could not escape!")], REFLECT

    # --- the enemy ----------------------------------------------------------
    def step(self):
        """Advance the enemy side by a single action."""
        if self.finished or self.side == PLAYER:
            return []
        actor = self.current_actor
        if actor is None:
            return self._settle()
        return self.execute(self.ai_pick(actor))

    def ai_pick(self, actor=None):
        """Pick an action for `actor`. Works for either side, which lets the
        balance simulator drive both teams."""
        actor = actor or self.current_actor
        if self.boss and self.side_of(actor) == ENEMY:
            from .bosses import SCRIPTS
            script = SCRIPTS.get(actor.species.key)
            if script:
                return script(self, actor)
        side = self.side_of(actor)
        foes = self.living(self.opposite(side))
        allies = self.living(side)
        usable = [SK.basic()] + [s for s in actor.skill_objs()
                                 if actor.can_pay(s)
                                 and s.kind not in (SK.SCAN, SK.CHARGE)]
        intel = 1.0 if self.boss else WILD_INTEL
        if not usable or not foes:
            return Action("guard")

        # Keep a wounded line standing first.
        hurt = [m for m in allies if m.hp < m.maxhp * 0.35]
        if hurt:
            heals = [s for s in usable if s.kind == SK.RECOVER]
            if heals and self.rng.random() < 0.75:
                s = max(heals, key=lambda k: k.power)
                tgt = (list(allies) if s.target == SK.ALL_ALLIES
                       else [min(hurt, key=lambda m: m.hp / m.maxhp)])
                return Action("skill", s, tgt)

        scored = []
        for s in usable:
            if s.kind == SK.RECOVER or s.kind == SK.REVIVE or s.kind == SK.CURE:
                continue
            if s.kind == SK.BUFF:
                room = sum(max(0, 2 - a.buffs[k]) for a in allies
                           for k in s.stages)
                scored.append((14 * room / max(1, len(allies)), s, list(allies)))
                continue
            if s.kind == SK.DEBUFF:
                if "clear" in s.stages:
                    stacks = sum(max(0, v) for m in foes for v in m.buffs.values())
                    scored.append((16 * stacks, s, list(foes)))
                else:
                    room = sum(max(0, 2 + m.buffs[k]) for m in foes
                               for k in s.stages)
                    scored.append((11 * room / max(1, len(foes)), s, list(foes)))
                continue
            if s.target == SK.ALL_FOES:
                total = sum(self._ai_value(actor, t, s) for t in foes)
                scored.append((total * 0.85, s, list(foes)))
            else:
                for t in foes:
                    scored.append((self._ai_value(actor, t, s), s, [t]))
        if not scored:
            return Action("guard")
        scored.sort(key=lambda x: -x[0])
        if self.rng.random() > intel:
            pick = self.rng.choice(scored[: max(1, len(scored) // 2)])
        else:
            pick = scored[0]
        return Action("skill", pick[1], pick[2])

    def _ai_value(self, actor, target, skill):
        aff = target.affinity(skill.element)
        if skill.element == ALMIGHTY:
            aff = NEUTRAL
        if aff in (DRAIN, REPEL):
            return -80.0
        if aff == NULL:
            return -40.0
        if skill.kind == SK.AILMENT:
            if target.ailment or (self.boss and self.side_of(target) == ENEMY):
                return -5.0
            base = skill.power * 0.55
            if aff == WEAK:
                base *= 1.5
            return base
        if skill.kind == SK.INSTAKILL:
            if aff == WEAK:
                return 90.0
            return 26.0 + 0.2 * (actor.stat("lu") - target.stat("lu"))
        atk = actor.stat("st") if skill.element == PHYS else actor.stat("ma")
        est = skill.power * atk / math.sqrt(max(1.0, target.stat("vi"))) / 9.0
        est *= actor.buff_mult("atk") / target.buff_mult("dfn")
        est *= (skill.hits[0] + skill.hits[1]) / 2.0
        est *= AFFINITY_MULT[aff]
        if skill.hp_cost and actor.hp < actor.maxhp * 0.3:
            est *= 0.4
        value = min(est, target.hp) * 1.0
        if est >= target.hp:
            value += 22.0          # finishing a foe is worth an icon
        if aff == WEAK:
            value += 26.0          # ... and so is the extra press turn
        return value

    # --- spoils --------------------------------------------------------------
    def rewards(self):
        from ..data.species import xp_reward
        alive = [m for m in self.party if not m.down]
        xp = sum(xp_reward(m.species, m.level, max(1, len(alive)))
                 for m in self.foes if m.down)
        gold = sum(6 + 3 * m.level for m in self.foes if m.down)
        return xp, gold
