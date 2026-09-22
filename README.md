# Tabula Mythos

A proof-of-concept monster-binding RPG for Windows PC: Game Boy Advance-era
presentation, cutesy monsters drawn from world mythology, and a battle system
built on Shin Megami Tensei's **Press Turn** rules rather than Pokémon's.

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

Options: `--scale 1..6`, `--fullscreen`, `--mute`.

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
3. Shrine of the Scale — deeper grass, Lv8–15 monsters, a healing spring.
4. The altar — **Anubis**, who repels Light, drains Dark, resists Physical,
   Fire and Ice, acts **twice per turn**, and is weak to exactly one thing:
   **Wind**. Bring a Tengu, a Pixie or a Mandrake, and bring draughts.

Simulated against the engine's own AI, a level 13 party wins about 60% of the
time and a level 15 party around 95%. Wind is not strictly required — the
extra press turns it grants mainly shorten the fight — but survivability is:
a team that resists Physical soaks his Judge's Blade, and a team that does not
tends to lose two monsters in one turn. Cast Light at him once and you will
lose the entire round.

## The monsters

Twelve species, each with an affinity table that is meant to be exploited in
both directions:

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

## How it is built

Everything is Python and pygame-ce, and **every asset is source code** — the
sprites are ASCII art with palettes, the font is a hand-authored 5×8 bitmap,
the maps are character grids, and the sound effects are square waves
synthesised at start-up. There are no binary assets to lose, and the whole
look can be retuned from `game/palette.py`.

```
main.py                 entry point
game/
  app.py                window, scaling, scene stack, transitions
  config.py             240x160 internal resolution and other constants
  palette.py            the whole colour scheme
  font.py               5x8 bitmap font, proportional spacing
  pixelart.py           ASCII art -> pygame surfaces
  ui.py                 windows, gauges, press turn icons, menus
  sfx.py                procedural chiptune sound
  monster.py            a monster instance: stats, growth, buffs, ailments
  player.py / save.py   party, bag, JSON save
  scenes.py             title, dialogue, party, bag, shop, bestiary
  art/                  monsters.py, tiles.py, actors.py  (all ASCII art)
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
```

The balance numbers in `tools/simulate.py` are what the difficulty was tuned
against: roughly 95% wins at level with a 3-monster party, 65% against a
higher-level group, near-zero four levels under, and a boss that needs both the
right element and the right defences.

## Scope

This is a proof of concept, so it stops where the systems have been proven:
three maps, twelve species, forty skills, one boss, a bestiary, a shop, saving,
and a complete Press Turn implementation. There is no fusion, no trading, no
multi-area story, and the music is silence — those are the obvious next steps,
not oversights.
