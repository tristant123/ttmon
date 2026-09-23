"""Tests for the Press Turn rules and the battle engine."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game.battle.engine import (Battle, PressTurns, Action, PLAYER, ENEMY,
                                NORMAL, BONUS, MISS, NULLED, REFLECT)
from game.monster import Monster
from game.data import skills as SK
from game.data.elements import FIRE, ICE, WIND, LIGHT, DARK, ELEC


class TestPressTurns(unittest.TestCase):
    def test_normal_spends_one_full(self):
        t = PressTurns(3)
        t.spend(NORMAL)
        self.assertEqual((t.full, t.half), (2, 0))

    def test_weakness_converts_full_to_half(self):
        t = PressTurns(3)
        t.spend(BONUS)
        self.assertEqual((t.full, t.half), (2, 1))
        self.assertEqual(t.total, 5)

    def test_half_icons_are_spent_before_full(self):
        t = PressTurns(2)
        t.spend(BONUS)           # 1 full, 1 half
        t.spend(NORMAL)          # eats the half
        self.assertEqual((t.full, t.half), (1, 0))

    def test_bonus_with_only_halves_consumes_a_half(self):
        t = PressTurns(1)
        t.spend(BONUS)           # 0 full, 1 half
        t.spend(BONUS)
        self.assertEqual((t.full, t.half), (0, 0))
        self.assertTrue(t.empty)

    def test_miss_burns_two_icons(self):
        t = PressTurns(3)
        t.spend(MISS)
        self.assertEqual((t.full, t.half), (1, 0))

    def test_null_burns_two_icons_mixed(self):
        t = PressTurns(2)
        t.spend(BONUS)           # 1 full, 1 half
        t.spend(NULLED)          # half first, then a full
        self.assertEqual((t.full, t.half), (0, 0))

    def test_reflect_loses_everything(self):
        t = PressTurns(4)
        t.spend(BONUS)
        t.spend(REFLECT)
        self.assertTrue(t.empty)

    def test_icon_display_order(self):
        t = PressTurns(3)
        t.spend(BONUS)
        self.assertEqual(t.icons(), [True, True, False])


class AlwaysRoll(random.Random):
    """An rng whose random() is pinned, for deterministic chance tests."""

    def __init__(self, value):
        super().__init__(99)
        self.value = value

    def random(self):
        return self.value


def party(*specs):
    return [Monster(k, lv) for k, lv in specs]


class TestBattleFlow(unittest.TestCase):
    def setUp(self):
        self.rng = random.Random(1234)

    def test_side_gets_one_icon_per_living_member(self):
        b = Battle(party(("pixie", 5), ("kitsune", 5), ("golem", 5)),
                   party(("mandrake", 4)), rng=self.rng)
        b.begin()
        self.assertEqual(b.side, PLAYER)
        self.assertEqual(b.turns.full, 3)

    def test_downed_members_do_not_grant_icons(self):
        p = party(("pixie", 5), ("kitsune", 5), ("golem", 5))
        p[2].take_damage(9999)
        b = Battle(p, party(("mandrake", 4)), rng=self.rng)
        b.begin()
        self.assertEqual(b.turns.full, 2)

    def test_hitting_a_weakness_grants_a_half_icon(self):
        # Mandrake is weak to Fire.
        attacker = Monster("kitsune", 12)
        b = Battle([attacker], party(("mandrake", 5)), rng=random.Random(7))
        b.begin()
        before = b.turns.total
        b.execute(Action("skill", SK.get("ember"), [b.foes[0]]))
        # 1 full icon (2 half-units) becomes a half icon (1 half-unit).
        self.assertEqual(b.turns.total, before - 1)

    def test_nulled_attack_costs_two_icons(self):
        # Thunderbird nulls Electric.
        attacker = Monster("pixie", 10)
        b = Battle([attacker, Monster("pixie", 10), Monster("pixie", 10)],
                   [Monster("thunderbird", 5)], rng=random.Random(3))
        b.begin()
        self.assertEqual(b.turns.full, 3)
        b.execute(Action("skill", SK.get("spark"), [b.foes[0]]))
        self.assertEqual(b.turns.full, 1)

    def test_drained_attack_costs_all_icons(self):
        # Wisp drains Fire.
        b = Battle([Monster("kitsune", 10), Monster("kitsune", 10)],
                   [Monster("wisp", 5)], rng=random.Random(5))
        b.begin()
        b.execute(Action("skill", SK.get("ember"), [b.foes[0]]))
        self.assertEqual(b.side, ENEMY)   # side ended immediately

    def test_repelled_attack_hurts_the_caster(self):
        # Anubis repels Light.
        caster = Monster("pixie", 10)
        b = Battle([caster, Monster("pixie", 10)], [Monster("anubis", 20)],
                   rng=random.Random(11), boss=True)
        b.begin()
        hp = caster.hp
        b.execute(Action("skill", SK.get("glimmer"), [b.foes[0]]))
        self.assertLess(caster.hp, hp)

    def test_pass_costs_half_and_moves_to_next_actor(self):
        b = Battle(party(("pixie", 5), ("kitsune", 5)), party(("mandrake", 4)),
                   rng=self.rng)
        b.begin()
        first = b.current_actor
        b.execute(Action("pass"))
        self.assertIsNot(b.current_actor, first)
        self.assertEqual(b.turns.icons(), [True, False])

    def test_turn_passes_to_enemy_when_icons_run_out(self):
        b = Battle([Monster("golem", 5)], [Monster("mandrake", 3)],
                   rng=random.Random(2))
        b.begin()
        b.execute(Action("guard"))
        self.assertEqual(b.side, ENEMY)

    def test_battle_ends_when_a_side_is_wiped(self):
        b = Battle([Monster("cerberus", 20)], [Monster("mandrake", 1)],
                   rng=random.Random(9))
        b.begin()
        b.execute(Action("skill", SK.get("ember"), [b.foes[0]]))
        self.assertEqual(b.finished, "win")

    def test_sleeping_actor_forfeits_an_icon(self):
        sleeper = Monster("pixie", 5)
        b = Battle([sleeper], [Monster("mandrake", 3)], rng=random.Random(4))
        b.begin()
        sleeper.inflict("sleep", random.Random(1))
        sleeper.ailment_turns = 5
        b.turns = PressTurns(1)
        b.cursor = 0
        ev = b._settle()
        self.assertTrue(any(e.get("type") == "phase" for e in ev))

    def test_poison_ticks_at_end_of_side(self):
        mon = Monster("golem", 8)
        b = Battle([mon], [Monster("mandrake", 3)], rng=random.Random(6))
        b.begin()
        mon.inflict("poison", random.Random(1))
        mon.ailment_turns = 9
        hp = mon.hp
        b.execute(Action("guard"))
        self.assertLess(mon.hp, hp)


class TestCapture(unittest.TestCase):
    def test_full_hp_capture_is_unlikely_and_low_hp_is_likely(self):
        target = Monster("mandrake", 4, wild=True)
        b = Battle([Monster("pixie", 6)], [target], rng=random.Random(1))
        full = b.capture_chance(target, 1.0)
        target.take_damage(int(target.maxhp * 0.9))
        low = b.capture_chance(target, 1.0)
        self.assertLess(full, 0.25)
        self.assertGreater(low, full * 2)

    def test_ailment_improves_capture(self):
        target = Monster("mandrake", 4, wild=True)
        b = Battle([Monster("pixie", 6)], [target], rng=random.Random(1))
        target.take_damage(int(target.maxhp * 0.7))
        plain = b.capture_chance(target, 1.0)
        target.inflict("sleep", random.Random(1))
        self.assertGreater(b.capture_chance(target, 1.0), plain)

    def test_boss_cannot_be_captured(self):
        boss = Monster("anubis", 18)
        b = Battle([Monster("pixie", 10)], [boss], rng=random.Random(1),
                   boss=True, inventory={"sigil_s": 1})
        b.begin()
        b.execute(Action("capture", targets=[boss], item="sigil_s"))
        self.assertEqual(b.captured, [])

    def test_successful_capture_removes_the_foe(self):
        target = Monster("mandrake", 3, wild=True)
        target.take_damage(target.maxhp - 1)
        b = Battle([Monster("pixie", 9)], [target], rng=AlwaysRoll(0.0),
                   inventory={"sigil_s": 5})
        b.begin()
        b.execute(Action("capture", targets=[target], item="sigil_s"))
        self.assertIn(target, b.captured)
        self.assertEqual(b.finished, "win")


class TestAI(unittest.TestCase):
    def test_ai_avoids_an_element_the_player_absorbs(self):
        # Wisp (AI) knows Ember; the player's Wisp drains Fire.
        ai_mon = Monster("wisp", 12)
        player_mon = Monster("wisp", 12)
        b = Battle([player_mon], [ai_mon], rng=random.Random(3), boss=True)
        b.begin()
        b.side = ENEMY
        action = b.ai_pick(ai_mon)
        self.assertNotEqual(action.skill.element, FIRE)

    def test_ai_targets_a_weakness_when_it_has_one(self):
        ai_mon = Monster("kitsune", 14)      # knows Ember (Fire)
        prey = Monster("mandrake", 10)       # weak to Fire
        b = Battle([prey], [ai_mon], rng=random.Random(3), boss=True)
        b.begin()
        b.side = ENEMY
        action = b.ai_pick(ai_mon)
        self.assertEqual(action.skill.element, FIRE)

    def test_ai_heals_a_badly_hurt_ally(self):
        healer = Monster("baku", 16)
        hurt = Monster("wisp", 10)
        hurt.take_damage(int(hurt.maxhp * 0.85))
        b = Battle([Monster("pixie", 5)], [healer, hurt],
                   rng=random.Random(1), boss=True)
        b.begin()
        b.side = ENEMY
        picks = [b.ai_pick(healer).skill.key for _ in range(12)]
        self.assertIn("mend", picks)


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestStalemate(unittest.TestCase):
    """A party with only physical damage cannot hurt something that nulls it,
    and the free Strike is physical too. The fight must still end."""

    def test_physical_only_party_versus_null_physical_ends(self):
        party = [Monster("golem", 12)]          # physical skills only
        party[0].skills = ["lunge", "ward"]
        foe = Monster("nemean", 12)             # nulls Physical
        b = Battle(party, [foe], rng=random.Random(4))
        b.begin()
        guard = 0
        while b.finished is None and guard < 2000:
            guard += 1
            if b.current_actor is None:
                b._settle()
                continue
            b.execute(b.ai_pick(b.current_actor))
        self.assertIsNotNone(b.finished)
        self.assertLess(guard, 2000, "battle never resolved")

    def test_a_fight_that_makes_progress_is_not_called_off(self):
        b = Battle([Monster("kitsune", 14)], [Monster("mandrake", 10)],
                   rng=random.Random(8))
        b.begin()
        guard = 0
        while b.finished is None and guard < 400:
            guard += 1
            if b.current_actor is None:
                b._settle()
                continue
            b.execute(b.ai_pick(b.current_actor))
        self.assertEqual(b.finished, "win")
