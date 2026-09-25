"""Scripted bosses.

A boss here is a pattern the player can learn and answer, not a stat block
with a bigger number. Each script takes the battle and the acting boss and
returns an Action; per-battle memory lives in ``battle.script``.
"""

from ..data import skills as SK
from .engine import Action, PLAYER

# Anubis's rite, one entry per action: he acts twice a round, so this is a
# four-round cycle. The Weighing is announced a full round ahead by Lift the
# Scales, so there is always a player turn between the warning and the blow.
ANUBIS_CYCLE = ("aegis", "verdict",      # gild the hide, sweep the line
                "crook", "maat",         # two single blows
                "crook", "lift",         # a blow, then the warning
                "weigh", "crook")        # the blow the warning was for


def anubis(b, me):
    st = b.script
    foes = b.living(PLAYER)
    step = lambda key: Action("skill", SK.get(key), _targets(b, me, key, foes))

    # Once, when he is badly hurt: the wrath, and straight after it the
    # scales. An enraged Weighing is what Sap is for.
    if not st.get("enraged") and me.hp < me.maxhp * 0.3:
        st["enraged"] = True
        if not me.charged:
            st["i"] = ANUBIS_CYCLE.index("lift")
        return step("duat_wrath")

    i = st.get("i", 0)
    intent = ANUBIS_CYCLE[i % len(ANUBIS_CYCLE)]

    if intent == "weigh":
        # Only on a round after the warning, never in the same one.
        if me.charged == "weighing" and st.get("charged_round", b.round) < b.round:
            st["i"] = i + 1
            return step("weighing")
        if not me.charged:
            st["i"] = i + 1          # the charge was lost; move on
        return step("verdict")

    st["i"] = i + 1
    if intent == "aegis":
        if me.buffs["dfn"] >= 2:
            # still gilded: spend the action on something else
            return step("mythos_ray" if me.can_pay(SK.get("mythos_ray"))
                        else "verdict")
        return step("gilded_aegis")
    if intent == "maat":
        if me.can_pay(SK.get("scale_of_ma")):
            return step("scale_of_ma")
        return step("verdict")
    if intent == "lift":
        return step("lift_scales")
    if intent == "crook":
        # after the Weighing, one plain blow: the scales take a round to settle
        return Action("skill", SK.basic(), [max(foes, key=lambda m: m.hp)])
    return step("verdict")


def _targets(b, me, key, foes):
    skill = SK.get(key)
    if skill.target == SK.SELF:
        return [me]
    if skill.target == SK.ALL_FOES:
        return list(foes)
    # Scale of Ma'at weighs the heaviest heart: the one with the most to lose.
    return [max(foes, key=lambda m: m.hp)]


SCRIPTS = {"anubis": anubis}
