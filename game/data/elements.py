"""Elements and affinities."""

from .. import palette as P

PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK, ALMIGHTY, HEAL, SUPPORT = range(10)

NAMES = {
    PHYS: "Phys", FIRE: "Fire", ICE: "Ice", ELEC: "Elec", WIND: "Wind",
    LIGHT: "Light", DARK: "Dark", ALMIGHTY: "Almgt", HEAL: "Heal",
    SUPPORT: "Supp",
}
LONG_NAMES = {
    PHYS: "Physical", FIRE: "Fire", ICE: "Ice", ELEC: "Electric",
    WIND: "Wind", LIGHT: "Light", DARK: "Dark", ALMIGHTY: "Almighty",
    HEAL: "Healing", SUPPORT: "Support",
}
COLORS = {
    PHYS: P.EL_PHYS, FIRE: P.EL_FIRE, ICE: P.EL_ICE, ELEC: P.EL_ELEC,
    WIND: P.EL_WIND, LIGHT: P.EL_LIGHT, DARK: P.EL_DARK,
    ALMIGHTY: P.EL_ALMIGHTY, HEAL: P.HP_GOOD, SUPPORT: P.GREY_L,
}
# The elements an affinity table can meaningfully cover.
ATTACK_ELEMENTS = (PHYS, FIRE, ICE, ELEC, WIND, LIGHT, DARK)

# Affinities
NEUTRAL, WEAK, RESIST, NULL, DRAIN, REPEL = range(6)
AFFINITY_TAGS = {
    NEUTRAL: "-", WEAK: "Wk", RESIST: "Rs", NULL: "Nu", DRAIN: "Dr",
    REPEL: "Rp",
}
AFFINITY_NAMES = {
    NEUTRAL: "normal", WEAK: "weak", RESIST: "resistant", NULL: "immune",
    DRAIN: "absorbs", REPEL: "repels",
}
AFFINITY_MULT = {NEUTRAL: 1.0, WEAK: 1.5, RESIST: 0.45, NULL: 0.0,
                 DRAIN: 0.0, REPEL: 0.0}
AFFINITY_COLORS = {
    NEUTRAL: P.GREY, WEAK: P.HP_BAD, RESIST: P.MP_FILL, NULL: P.GREY_L,
    DRAIN: P.HP_GOOD, REPEL: P.EL_DARK,
}
