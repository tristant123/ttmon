"""Global constants for Tabula Mythos (ttmon)."""

# HD-2D presentation, the Octopath Traveler approach: low-resolution pixel
# sprites lit and composited in a higher-resolution scene.
#
# The world renders at 480x320 so that bloom, depth of field and lighting have
# enough pixels to read. The UI keeps its original 240x160 layout space and is
# scaled up by exactly 2 on top of the finished frame, which keeps text crisp
# and untouched by the post-processing.
INTERNAL_W = 480
INTERNAL_H = 320
UI_W = 240
UI_H = 160
UI_SCALE = INTERNAL_W // UI_W        # 2

# Source art stays 16x16; the diorama draws it at twice the size.
ART_TILE = 16
TILE = 32
VIEW_TILES_W = INTERNAL_W // TILE    # 15
VIEW_TILES_H = INTERNAL_H // TILE    # 10

# Diorama projection: the ground plane is foreshortened, and one unit of
# height lifts a tile by WALL_H pixels with a visible side face.
Y_SQUASH = 0.80
WALL_H = 22

DEFAULT_SCALE = 2
MIN_SCALE = 1
MAX_SCALE = 4
FPS = 60

TITLE = "Tabula Mythos"

# Party / battle sizing
BATTLE_SLOTS = 3        # monsters fielded per side
PARTY_MAX = 6           # total monsters carried (fielded + reserve)

SAVE_FILENAME = "ttmon_save.json"
