# Tabula Mythos

A proof-of-concept monster-binding RPG for Windows PC, presented in **HD-2D**
— the Octopath Traveler approach, where low-resolution pixel sprites are lit
and composited in a higher-resolution 3D-ish diorama. Twenty-two cutesy
monsters drawn from world mythology, Greek and Roman included, and a battle
system built on Shin Megami Tensei's **Press Turn** rules rather than
Pokémon's.

You bind creatures instead of catching them, you field three at once, and a
single misread of an enemy's affinities can cost you the entire turn.

![screens](docs/screens.png)

## Running it

**Windows, from source (easiest):**

```
run_windows.bat
```

That installs the one dependency and launches the game.

**Windows, as a standalone .exe:**

```
build_windows.bat
```

This installs PyInstaller, runs the tests, and writes `dist\TabulaMythos.exe`
— a single file you can copy anywhere and double-click. No Python needed on
the target machine. Saves go to `%APPDATA%\TabulaMythos\`.

**Any platform, manually:**

```
pip install -r requirements.txt
python main.py
```

Options: `--scale 1..4`, `--fullscreen`, `--mute`, `--flat` (turns off the
post-processing on very old hardware).

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move, navigate menus |
| Z / Enter / Space | Confirm, talk, examine |
| X / Esc / Backspace | Back; opens the menu in the overworld |
| Shift (hold) | Run |
| S | Reorder monsters in the party screen |
| F11 / Alt+Enter | Fullscreen |
| `+` / `-` | Window size |
| F12 | Screenshot |

## The Press Turn system

Each side starts its turn with **one icon per living monster**. That is the
whole reason to bind more monsters: every ally is another action.

| What happened | Cost |
| --- | --- |
| Ordinary hit, heal, buff, item, guard | 1 full icon |
| **Hit a weakness, or land a critical** | ½ icon — a full icon starts blinking, and you act again |
| Pass | ½ icon |
| Miss, or hit something that **nulls** the element | **2 icons** |
| Hit something that **drains** or **repels** the element | **every remaining icon** |

Blinking half icons are always spent before full ones, so a weakness chain is
powerful but fragile. The enemy plays by exactly the same rules, and the AI
hunts your weaknesses deliberately — a party that shares a weakness will be
taken apart in a single turn.

Practical consequences:

- **Scan** before you experiment. Guessing at a Repel costs you the round.
- Physical arts cost HP, magic costs MP, and **Strike** is always free — you
  can never be locked out of acting.
- Buffs and debuffs stack three deep at 22% each; against the boss they matter
  more than raw damage.

## Spell effects

![effects](docs/effects.png)

Each element is choreographed rather than being one shape scribbled over the
target: a wind-up, a strike, an aftermath. Fire gathers embers at the feet
before the column erupts and smoke curls off the top; ice shards converge from
outside, flash, and shatter outward; lightning forks down from off-screen;
dark collapses into a well of shadow and then bursts. Every effect also hands
the scene a screen-flash colour on the frame it lands.

Two rules do most of the work. Bright particles are drawn **additively** so
the bloom pass catches them and they bleed light. And anything that fades out
is drawn onto a scratch layer and *added* to the frame rather than blended —
fading a colour toward black and drawing it normally is how a dissipating
shockwave ends up as a hard black ring. Flame bodies are the exception and use
alpha, because added light over a green field turns yellow and then white,
which made the first version of the fire column read as a white pillar.

A worst-case cast — three targets, particles at peak — costs under 0.6ms.

## Binding monsters

Throw a sigil with the **Bind** command. The chance depends on how hurt the
target is (a monster at full HP is nearly impossible), its level relative to
yours, whether it is asleep/bound/poisoned/afraid, and the grade of sigil.
Bosses cannot be bound — the sigil shatters.

You carry six monsters; the **first three** fight, and you reorder them with
`S` on the party screen.

## The proof of concept in ~20 minutes

1. Lantern Hollow — talk to Elder Maru (he explains Press Turns), buy sigils
   from Pell, rest at Warden Isa.
2. Mistgrass Road — tall grass, wild monsters around Lv3–8. Bind two more so
   you have three icons.
3. The Marble Steps — a Greek ruin south-west of the road, Lv6–14, where the
   Hellenic half of the bestiary lives. A raised marble plaza, standing
   columns, and the lion.
4. Shrine of the Scale — deeper grass, Lv8–16 monsters, a healing spring.
5. The altar — **Anubis**, who repels Light, drains Dark, resists Physical,
   Fire and Ice, acts **twice per turn**, and is weak to exactly one thing:
   **Wind**. Bring a Tengu, a Pixie or a Mandrake, and bring draughts.

Simulated against the engine's own AI, a level 13 party wins about 60% of the
time and a level 15 party around 95%. Wind is not strictly required — the
extra press turns it grants mainly shorten the fight — but survivability is:
a team that resists Physical soaks his Judge's Blade, and a team that does not
tends to lose two monsters in one turn. Cast Light at him once and you will
lose the entire round.

## The monsters

Twenty-two species, each with an affinity table meant to be exploited in both
directions.

![roster](docs/roster.png)

**Japanese and general myth** — the road and the shrine:

| Monster | Race | Notable |
| --- | --- | --- |
| Pixie | Fairy | Weak to Physical and Dark; early healer |
| Mandrake | Plant | Weak to Fire; poisons and snares |
| Kitsune | Yoma | Fire and Scan; fragile |
| Kappa | Yoma | Resists Physical, Fire and Ice; weak to Electric |
| Thunderbird | Avian | **Nulls** Electric; weak to Wind |
| Golem | Earth | **Nulls** Dark, resists Physical/Fire/Ice; slow |
| Wisp | Undead | **Drains** Fire; weak to Ice and Light |
| Naga | Snake | **Drains** Ice; weak to Fire and Electric |
| Tengu | Yoma | **Nulls** Wind; fast, hits hard |
| Cerberus | Beast | Resists Physical, Fire, Dark |
| Baku | Dream | **Drains** Dark; weak to Light; sleeps your party |
| Anubis | Deity | The boss. **Repels** Light. |

**Greek and Roman** — the Marble Steps, and the deep grass beyond it:

| Monster | Race | Notable |
| --- | --- | --- |
| Satyr | Fairy | Lullaby and buffs; weak to Physical and Ice |
| Harpy | Avian | Very fast, very brittle; weak to Ice and Electric |
| Medusa | Gorgon | Dark and ailments; resists Physical; weak to Fire |
| Minotaur | Beast | Heavy Physical; resists Physical and Dark; weak to Electric |
| Siren | Sea | Ice and sleep; resists Ice and Dark; weak to Electric |
| Cyclops | Giant | Enormous damage, no speed. **Weak to Light** — aim for the eye |
| Chimera | Beast | Fire and poison; resists Fire and Dark; weak to Ice |
| Pegasus | Divine | Healer and haste; resists Wind/Light/Electric; weak to Dark |
| Talos | Automaton | **Nulls Fire**, resists Physical and Ice; weak to Electric |
| Nemean Lion | Beast | **Nulls Physical outright.** Its hide has never been cut |

The Nemean Lion is the roster's teaching moment: the free Strike is physical,
so a party carrying nothing but physical skills cannot scratch it. Bring
magic, or walk away — if you land nothing at all for eight rounds the fight is
called off rather than grinding on forever.

## The HD-2D renderer

Octopath Traveler's look does not come from 3D character models — the
characters are small pixel sprites. It comes from staging those sprites in a
lit diorama and finishing the frame with modern post-processing. This build
does the same thing in pygame:

**The diorama** (`game/render/diorama.py`). The ground plane is foreshortened,
tiles carry real elevation, and wherever terrain steps down a side face is
drawn — earth or stone, graded, with a lip of the surface hanging over the
edge and ambient occlusion pooling at the bottom. Trees, buildings, the shrine
gate and every character are **billboards**: upright sprites with contact
shadows, sorted back to front by the row they stand in. A building is just a
wall billboard with a roof billboard lifted onto it.

**The ground** (`game/art/terrain.py`). Terrain is generated at native screen
resolution — one source pixel per screen pixel — rather than 16×16 art
stretched to fill a tile, which used to leave the floor visibly chunkier than
anything standing on it. Each surface is built from seamless value noise
quantised into tone bands, then dressed: grass gets blades and clover, paths
get grit, flagstones get per-slab shading and cracks, water gets travelling
swells with a lit crest.

Two details matter more than the resolution. Every surface has **four
variants** that the renderer picks per tile from its coordinates, because one
tile repeated across a field reads as wallpaper however detailed it is. And
each variant's noise is **normalised to a fixed mean** — without that, tiles
drift lighter and darker than their neighbours and a meadow comes out looking
like a patchwork quilt.

Standing props — trees, columns, houses, the shrine — run through the same
shading pipeline as the monsters, so they are lit by the same model, and their
old top-down grass backgrounds are stripped so they stand on the ground rather
than in a square patch of their own.

**The stage** (`game/render/arena.py`). Each battle bakes its own floor once:
rows of the local terrain sampled at increasing depth toward a horizon, with
rolling hills and two layers of silhouetted scenery behind. It costs one blit
per frame thereafter.

**The sprites** (`game/art/shading.py`). Monsters are not painted by hand.
They are authored as flat *material* maps — this pixel is fur, that one is
bronze, this one is an eye — and a lighting pass turns each into a finished
sprite:

1. **EPX upscale.** The character grid is doubled with the Scale2x rule, which
   rounds stair-stepped diagonals, so a form authored at 32×32 gets a 64×64
   silhouette without nearest-neighbour's blocky corners.
2. **Distance fields** tell every pixel how deep it sits inside its own
   material and inside the silhouette. Thin details like a blush or a belly
   patch are deliberately *not* modelled as separate volumes — they inherit
   the body's light, or the sprite breaks out in dark blotches.
3. **Quantised Lambert shading** from a key light at the upper left. Banding
   the result into five tones is what keeps it reading as pixel art instead of
   an airbrushed bevel.
4. **Hue-shifted ramps.** Shadows rotate toward blue and gain saturation;
   highlights rotate toward warm light and lose it. Flat value ramps are the
   single biggest thing separating amateur pixel art from this house style.
5. **Rim light and coloured outlines** — a cool backlight on the edge facing
   away from the key, and outlines taken from a dark, hue-shifted version of
   whatever material they hug, never pure black.

Every material also has a personality: metal gets a hard specular step, cloth
stays matte, gems and flame are emissive and bleed into the bloom pass. Adding
a monster means drawing a silhouette, not painting four shades of everything,
and the whole roster stays lit by one consistent model.

**The finish** (`game/render/postfx.py`), four passes over the frame:

| Pass | What it does |
| --- | --- |
| Point lights | Additive radial sprites — lantern windows, the shrine's hanging scale, spell impacts — drawn *before* bloom so they bleed |
| Bloom | Bright-pass, blurred twice, added back |
| Tilt-shift DoF | The frame blurred and recomposited in bands, sharp at the focus line and soft toward the distance and the foreground — this is what makes it read as a miniature |
| Fog, vignette, grade | Distance haze, corner falloff, and a per-location tint: warm afternoon in the village, cold dusk at the shrine |

Every operation is a pygame blit, `smoothscale` or blend-flag fill, so it is
all C-speed. Measured on a CPU-only container with `tools/bench_frame.py`:

```
scene            ms/frame      fps
village +fx          4.78      209
route +fx            4.65      215
shrine +fx           4.79      209
battle +fx           3.82      262
(same scenes with --flat run about twice as fast)
```

60fps needs 16.6ms, so the whole stack uses under a third of the budget.

**Resolution.** The world renders at 480×320, which is what gives bloom and
depth of field enough pixels to read. The UI keeps its original 240×160 layout
space and is scaled up by exactly 2 on top of the finished frame, so text and
window frames stay sharp and are never blurred or bloomed.

## How it is built

Everything is Python and pygame-ce, and **every asset is source code** — the
sprites are ASCII art with palettes, the font is a hand-authored 5×8 bitmap,
the maps are character grids (with a second grid for elevation), and the sound
effects are square waves synthesised at start-up. There are no binary assets
to lose, and the whole look can be retuned from `game/palette.py` and the
grade profiles in `game/render/postfx.py`.

```
main.py                 entry point
game/
  app.py                window, scaling, scene stack, transitions
  assets.py             builds every runtime surface once
  config.py             resolutions, tile size, diorama projection
  palette.py            the whole colour scheme
  font.py               5x8 bitmap font, proportional spacing
  pixelart.py           ASCII art -> pygame surfaces
  ui.py                 windows, gauges, press turn icons, menus
  sfx.py                procedural chiptune sound
  monster.py            a monster instance: stats, growth, buffs, ailments
  player.py / save.py   party, bag, JSON save
  scenes.py             title, dialogue, party, bag, shop, bestiary
  art/
    shading.py          material maps -> lit sprites (EPX, normals, ramps)
    monsters.py         22 species as material maps
    terrain.py          procedural ground, seamless, four variants each
    tiles.py            standing props, lit through shading.py
    actors.py           overworld characters
  render/
    diorama.py          extruded terrain, billboards, depth sorting
    arena.py            the baked battle stage
    postfx.py           bloom, depth of field, lights, grading
    particles.py        ambient motes and impact sparks
  battle/effects.py     per-element spell choreography
  battle/
    engine.py           the Press Turn rules - no pygame, fully testable
    scene.py            battle presentation and input
    effects.py          damage numbers, element bursts, sigil throws
  data/                 elements, skills, species, items
  world/                maps.py, overworld.py
tests/test_press_turns.py    26 tests over the turn economy and the engine
tools/                  headless playtest + balance simulation harnesses
```

## Development

```
python -m unittest discover -s tests   # 26 tests, press turn rules and engine
python tools/simulate.py 300           # play 300 battles per matchup, print win rates
python tools/run_playtest.py out/      # drive the real game headlessly, save screenshots
python tools/run_world_test.py out/    # walk village -> route -> shrine, talk, shop, boss
python tools/contact_sheet.py out.png  # render every monster sprite
python tools/make_roster_image.py      # regenerate docs/roster.png
python tools/effect_strip.py out.png   # filmstrip of every spell effect
python tools/shot_maps.py out/         # render each map in the diorama
python tools/bench_frame.py            # frame cost, with and without post-processing
```

The balance numbers in `tools/simulate.py` are what the difficulty was tuned
against: roughly 95% wins at level with a 3-monster party, 65% against a
higher-level group, near-zero four levels under, and a boss that needs both the
right element and the right defences.

## Scope

This is a proof of concept, so it stops where the systems have been proven:
four maps, twenty-two species, forty skills, one boss, a bestiary, a shop,
saving, a complete Press Turn implementation and an HD-2D renderer. There is no fusion,
no trading, no multi-area story, and the music is silence — those are the
obvious next steps, not oversights.

Monsters are authored at 32×32 and finished at 64×64 by the shading pass.
Authoring the forms directly at 64×64 would buy finer silhouettes — hands,
feathers, individual teeth — but the lighting model would not change and the
per-sprite cost roughly quadruples. A few forms are merely adequate rather
than good: the Satyr's pipes do not read, and the Chimera's three heads are
muddled at this size. Those need redrawing, not better lighting.

Terrain has no blending between surfaces yet — grass meets path on a hard tile
edge. Fringed transition variants would be the next visible upgrade there.
