"""A small, deliberately limited GBA-flavoured palette.

Colours are kept slightly desaturated with warm midtones and cool shadows,
which is what gives 2001-era handheld art its particular look.
"""

# UI / system
BLACK       = (16, 14, 24)
NEAR_BLACK  = (33, 30, 46)
WHITE       = (248, 248, 240)
CREAM       = (232, 224, 194)
GREY_D      = (72, 68, 92)
GREY        = (128, 124, 148)
GREY_L      = (186, 184, 200)

# Window chrome (Pokemon-style rounded text frames)
WIN_FILL    = (248, 248, 232)
WIN_EDGE    = (64, 56, 88)
WIN_SHADOW  = (152, 144, 176)
WIN_FILL_D  = (56, 48, 80)     # dark variant frame
WIN_EDGE_D  = (176, 168, 208)

# Overworld terrain
GRASS_L     = (128, 184, 104)
GRASS       = (96, 160, 80)
GRASS_D     = (64, 120, 64)
TALLGRASS_L = (88, 168, 88)
TALLGRASS   = (56, 128, 72)
TALLGRASS_D = (36, 92, 56)
PATH_L      = (224, 200, 152)
PATH        = (200, 172, 120)
PATH_D      = (160, 132, 88)
WATER_L     = (120, 184, 232)
WATER       = (72, 136, 208)
WATER_D     = (48, 96, 168)
STONE_L     = (176, 176, 192)
STONE       = (128, 128, 152)
STONE_D     = (88, 88, 112)
TREE_L      = (88, 152, 88)
TREE        = (48, 112, 72)
TREE_D      = (28, 72, 56)
TRUNK       = (104, 72, 48)
ROOF_L      = (216, 112, 96)
ROOF        = (176, 72, 72)
ROOF_D      = (120, 48, 56)
WALL_L      = (232, 216, 184)
WALL        = (200, 180, 148)
WALL_D      = (144, 124, 100)
SAND        = (232, 216, 168)
FLOWER_A    = (240, 216, 96)
FLOWER_B    = (232, 120, 152)

# Element colours (also used for skill menus and affinity icons)
EL_PHYS     = (216, 208, 200)
EL_FIRE     = (240, 112, 64)
EL_ICE      = (128, 208, 240)
EL_ELEC     = (248, 216, 88)
EL_WIND     = (136, 224, 160)
EL_LIGHT    = (248, 240, 176)
EL_DARK     = (168, 112, 216)
EL_ALMIGHTY = (240, 224, 240)

# Gauges
HP_GOOD     = (96, 208, 112)
HP_WARN     = (248, 200, 72)
HP_BAD      = (232, 80, 72)
MP_FILL     = (96, 168, 240)
XP_FILL     = (120, 216, 232)
GAUGE_BACK  = (56, 48, 72)

# Press-turn icons
ICON_FULL   = (255, 236, 128)
ICON_FULL_D = (216, 168, 48)
ICON_HALF   = (255, 236, 128)
ICON_SPENT  = (72, 64, 88)

# Battle backdrop
SKY_TOP     = (88, 104, 176)
SKY_BOT     = (176, 160, 208)
FIELD_A     = (96, 152, 88)
FIELD_B     = (72, 124, 76)
