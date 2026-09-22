"""Dev tool: play out thousands of battles to sanity-check the balance.

Both sides are driven by the engine's own AI, so the numbers describe a
competent-but-not-perfect player. Usage: python3 tools/simulate.py [runs]
"""
import os, random, sys, statistics
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.battle.engine import Battle, Action, PLAYER
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


def run_one(party_spec, foe_spec, seed, boss=False):
    rng = random.Random(seed)
    party = [Monster(k, lv) for k, lv in party_spec]
    foes = [Monster(k, lv) for k, lv in foe_spec]
    b = Battle(party, foes, rng=rng, boss=boss,
               inventory={"herb": 4, "draught": 2, "ash": 1})
    b.begin()
    guard = 0
    while b.finished is None and guard < 400:
        guard += 1
        actor = b.current_actor
        if actor is None:
            b._settle()
            continue
        if b.side == PLAYER:
            b.execute(player_policy(b, actor))
        else:
            b.execute(b.ai_pick(actor))
    hp_left = sum(m.hp for m in party) / max(1, sum(m.maxhp for m in party))
    return b.finished, b.round, hp_left


def report(label, party_spec, foe_spec, runs, boss=False):
    wins = rounds = 0
    hp = []
    for i in range(runs):
        res, rnd, left = run_one(party_spec, foe_spec, 1000 + i, boss)
        wins += res == "win"
        rounds += rnd
        hp.append(left)
    print("%-42s win %5.1f%%  rounds %4.1f  hp left %4.0f%%"
          % (label, 100.0 * wins / runs, rounds / runs,
             100 * statistics.mean(hp)))


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
    print("=== under-levelled (should hurt) ===")
    report("3x Lv8 party vs 3x Lv12 wild",
           [("pixie", 8), ("kitsune", 8), ("golem", 8)],
           [("naga", 12), ("tengu", 12), ("baku", 12)], runs)
    print("=== boss ===")
    report("Lv13 kitsune/kappa/golem (no wind) vs Anubis 15",
           [("kitsune", 13), ("kappa", 13), ("golem", 13)],
           [("anubis", 15)], runs, boss=True)
    report("Lv13 tengu/kappa/golem (wind) vs Anubis 15",
           [("tengu", 13), ("kappa", 13), ("golem", 13)],
           [("anubis", 15)], runs, boss=True)
    report("Lv15 tengu/kappa/golem (wind) vs Anubis 15",
           [("tengu", 15), ("kappa", 15), ("golem", 15)],
           [("anubis", 15)], runs, boss=True)
    report("Lv17 tengu/pixie/kappa (2x wind) vs Anubis 15",
           [("tengu", 17), ("pixie", 17), ("kappa", 17)],
           [("anubis", 15)], runs, boss=True)
