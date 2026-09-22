"""Global constants for Tabula Mythos (ttmon)."""

# The GBA screen is 240x160. Everything is drawn to an internal surface of that
# size and then integer-scaled up, which keeps pixels crisp and square.
INTERNAL_W = 240
INTERNAL_H = 160
TILE = 16
VIEW_TILES_W = INTERNAL_W // TILE   # 15
VIEW_TILES_H = INTERNAL_H // TILE   # 10

DEFAULT_SCALE = 3
MIN_SCALE = 1
MAX_SCALE = 6
FPS = 60

TITLE = "Tabula Mythos"

# Party / battle sizing
BATTLE_SLOTS = 3        # monsters fielded per side
PARTY_MAX = 6           # total monsters carried (fielded + reserve)

SAVE_FILENAME = "ttmon_save.json"
