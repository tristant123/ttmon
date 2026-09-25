"""Dev tool: play out thousands of battles to sanity-check the balance.

Both sides are driven by the engine's own AI, so the numbers describe a
competent-but-not-perfect player. Usage: python3 tools/simulate.py [runs]
"""
import os, random, sys, statistics
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.battle.engine import Battle, Action, PLAYER, ENEMY
from game.data import skills as SK
from game.monster import Monster


def player_policy(b, actor):
    """A competent human stand-in: drinks when hurt, otherwise plays the AI's
    best line. Without this the simulation badly understates the party."""
    mine = b.living(PLAYER)
    worst = min(mine, key=lambda m: m.hp / m.maxhp)
    if worst.hp < worst.maxhp * 0.45:
        for key in ("draught", "herb"):
            if b.inventory.get(key, 0) > 0:
                return Action("item", targets=[worst], item=key)
    return b.ai_pick(actor)


def _upkeep(b, actor):
    """What any sensible player does first: raise the fallen, drink for MP."""
    fallen = [m for m in b.party if m.down]
    if fallen:
        kindle = [s for s in actor.skill_objs()
                  if s.kind == SK.REVIVE and actor.can_pay(s)]
        if kindle:
            return Action("skill", kindle[0], [fallen[0]])
        if b.inventory.get("ash", 0) > 0:
            return Action("item", targets=[fallen[0]], item="ash")
    if actor.mp < 12 and actor.maxmp >= 20 and b.inventory.get("dew", 0) > 0:
        return Action("item", targets=[actor], item="dew")
    return None


def _worth_attacking(b, actor, action):
    """Would a person bother? A resisted chip is better spent passing the
    turn to a partner who can hit the weakness."""
    if action.kind != "skill" or action.skill.kind != SK.ATTACK:
        return True
    return max(b._ai_value(actor, t, action.skill) for t in action.targets) >= 18


def _heal_first(b, actor, line=0.45):
    up = _upkeep(b, actor)
    if up:
        return up
    mine = b.living(PLAYER)
    worst = min(mine, key=lambda m: m.hp / m.maxhp)
    if worst.hp < worst.maxhp * line:
        mend = [s for s in actor.skill_objs()
                if s.kind == SK.RECOVER and actor.can_pay(s)]
        if mend:
            s = max(mend, key=lambda k: k.power)
            tg = mine if s.target == SK.ALL_ALLIES else [worst]
            return Action("skill", s, tg)
        for key in ("draught", "herb"):
            if b.inventory.get(key, 0) > 0:
                return Action("item", targets=[worst], item=key)
    return None


def _attack(b, actor):
    """The AI's best damaging line, with the support skills taken away."""
    keep = actor.skills
    actor.skills = [k for k in keep
                    if SK.get(k).kind not in (SK.BUFF, SK.DEBUFF)]
    try:
        return b.ai_pick(actor)
    finally:
        actor.skills = keep


def brute_policy(b, actor):
    """Heals and hits. Never buffs, never debuffs, never braces."""
    return _heal_first(b, actor) or _attack(b, actor)


def tactician_policy(b, actor):
    """Plays the boss the way it asks to be played: answers each threat with
    the skill or item made for it, and otherwise attacks."""
    foes = b.living(ENEMY)
    if not b.boss or not foes:
        return player_policy(b, actor)
    boss = foes[0]
    mine = b.living(PLAYER)
    have = {s.key: s for s in actor.skill_objs() if actor.can_pay(s)}
    inv = b.inventory

    def skill(key, targets):
        return Action("skill", have[key], targets) if key in have else None

    def item(key):
        return Action("item", item=key) if inv.get(key, 0) > 0 else None

    if boss.charged:
        # the scales are up: get defence on, his attack down, then brace
        if min(m.buffs["dfn"] for m in mine) < 1:
            a = skill("ward", mine) or item("incense")
            if a:
                return a
        if boss.buffs["atk"] > -1:
            a = skill("sap", foes) or item("salt")
            if a:
                return a
        h = _heal_first(b, actor, 0.7)
        if h:
            return h
        if actor.hp < actor.maxhp * 0.75:
            return Action("guard")
    h = _heal_first(b, actor, 0.4)
    if h:
        return h
    if boss.buffs["dfn"] > 0:
        a = skill("dispel", foes) or item("bell") or skill("crack", foes)
        if a:
            return a
    if boss.buffs["atk"] > 0:
        a = skill("sap", foes) or item("salt")
        if a:
            return a
    hit = _attack(b, actor)
    if not _worth_attacking(b, actor, hit) and b.turns.full > 1:
        return Action("pass")
    return hit


POLICIES = {"smart": None, "brute": brute_policy, "tactician": tactician_policy}
BOSS_BAG = {"herb": 4, "draught": 3, "dew": 3, "ash": 2, "incense": 2,
            "salt": 2, "bell": 2}


def run_one(party_spec, foe_spec, seed, boss=False, policy=None, bag=None):
    rng = random.Random(seed)
    party = [Monster(k, lv) for k, lv in party_spec]
    foes = [Monster(k, lv) for k, lv in foe_spec]
    b = Battle(party, foes, rng=rng, boss=boss,
               inventory=dict(bag or {"herb": 4, "draught": 2, "ash": 1}))
    policy = policy or player_policy
    b.begin()
    guard = 0
    while b.finished is None and guard < 400:
        guard += 1
        actor = b.current_actor
        if actor is None:
            b._settle()
            continue
        if b.side == PLAYER:
            b.execute(policy(b, actor))
        else:
            b.execute(b.ai_pick(actor))
    hp_left = sum(m.hp for m in party) / max(1, sum(m.maxhp for m in party))
    return b.finished, b.round, hp_left


def report(label, party_spec, foe_spec, runs, boss=False, policy=None,
           bag=None):
    wins = rounds = stale = 0
    hp = []
    for i in range(runs):
        res, rnd, left = run_one(party_spec, foe_spec, 1000 + i, boss,
                                 policy, bag)
        wins += res == "win"
        stale += res == "stalemate"
        rounds += rnd
        hp.append(left)
    tail = "  (%d%% called off)" % (100 * stale / runs) if stale else ""
    print("%-48s win %5.1f%%  rounds %4.1f  hp left %4.0f%%%s"
          % (label, 100.0 * wins / runs, rounds / runs,
             100 * statistics.mean(hp), tail))


if __name__ == "__main__":
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    print("=== early game ===")
    report("2x Lv5 party vs 1x Lv4 wild",
           [("pixie", 5), ("mandrake", 5)], [("kappa", 4)], runs)
    report("2x Lv6 party vs 2x Lv5 route wild",
           [("kitsune", 6), ("pixie", 6)], [("mandrake", 5), ("pixie", 5)], runs)
    report("2x Lv5 party vs bad matchup (2x Lv5)",
           [("pixie", 5), ("mandrake", 5)], [("kappa", 5), ("wisp", 5)], runs)
    print("=== mid game ===")
    report("3x Lv10 party vs 2x Lv10 wild",
           [("pixie", 10), ("kitsune", 10), ("golem", 10)],
           [("naga", 10), ("tengu", 10)], runs)
    report("3x Lv10 party vs 3x Lv11 wild",
           [("pixie", 10), ("kitsune", 10), ("golem", 10)],
           [("naga", 11), ("tengu", 11), ("cerberus", 11)], runs)
    print("=== the marble steps (greek roster) ===")
    report("3x Lv9 party vs 2x Lv9 ruins wild",
           [("kitsune", 9), ("kappa", 9), ("pixie", 9)],
           [("satyr", 9), ("harpy", 9)], runs)
    report("3x Lv11 party vs 2x Lv11 ruins wild",
           [("kitsune", 11), ("kappa", 11), ("tengu", 11)],
           [("medusa", 11), ("minotaur", 11)], runs)
    report("3x Lv12 all-physical vs Nemean Lv12 (nulls Phys)",
           [("minotaur", 12), ("cyclops", 12), ("golem", 12)],
           [("nemean", 12)], runs)
    report("3x Lv12 with magic vs Nemean Lv12",
           [("thunderbird", 12), ("kitsune", 12), ("kappa", 12)],
           [("nemean", 12)], runs)
    report("3x Lv12 vs Talos Lv12 (nulls Fire, weak Elec)",
           [("thunderbird", 12), ("kappa", 12), ("tengu", 12)],
           [("talos", 12)], runs)
    print("=== under-levelled (should hurt) ===")
    report("3x Lv8 party vs 3x Lv12 wild",
           [("pixie", 8), ("kitsune", 8), ("golem", 8)],
           [("naga", 12), ("tengu", 12), ("baku", 12)], runs)
    print("=== boss: the same party and bag, played two ways ===")
    print("(Anubis meets the party at its own level, from 14 to 17, as in the game)")
    boss_at = lambda lv: [("anubis", max(14, min(17, lv)))]
    for lv in (12, 14, 16):
        for name, party in (("tengu/pixie/kappa", ("tengu", "pixie", "kappa")),
                            ("thunderbird/golem/harpy", ("thunderbird", "golem", "harpy")),
                            ("kitsune/kappa/cerberus (resisted)", ("kitsune", "kappa", "cerberus"))):
            for pol in ("tactician", "brute"):
                report("Lv%d %s  %s" % (lv, name, pol), [(k, lv) for k in party],
                       boss_at(lv), runs, boss=True, policy=POLICIES[pol],
                       bag=BOSS_BAG)
    for lv in (19, 21):
        report("Lv%d tengu/pixie/kappa  brute (out-levelled)" % lv,
               [("tengu", lv), ("pixie", lv), ("kappa", lv)], boss_at(lv),
               runs, boss=True, policy=brute_policy, bag=BOSS_BAG)
