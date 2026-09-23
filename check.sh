#!/usr/bin/env bash
# Verify a build: unit tests, then three headless playthroughs that drive the
# real game loop and save screenshots you can flip through.
#
#   ./check.sh              writes screenshots to check_output/
#   ./check.sh somewhere/   writes them there instead
#
# Exits non-zero if anything fails, which is what CI checks.
set -u
cd "$(dirname "$0")"
OUT="${1:-check_output}"
rm -rf "$OUT"; mkdir -p "$OUT"
PY="${PYTHON:-python3}"
fail=0

step () {                      # step <name> <command...>
  printf '%-34s' "$1"; shift
  if out=$("$@" 2>&1); then
    echo "ok"
  else
    echo "FAILED"
    echo "$out" | tail -25 | sed 's/^/    /'
    fail=1
  fi
}

echo "=== Tabula Mythos: checking this build ==="
step "engine tests"        "$PY" -m unittest discover -s tests -q
step "imports compile"     "$PY" -m compileall -q game main.py tools
step "playthrough"         "$PY" tools/run_playtest.py    "$OUT/1_playthrough"
step "world: village->boss" "$PY" tools/run_world_test.py  "$OUT/2_world"
step "battle systems"      "$PY" tools/run_battle_demo.py "$OUT/3_battle"
step "every map"           "$PY" tools/shot_maps.py       "$OUT/4_maps"
step "every monster"       "$PY" tools/make_roster_image.py
step "spell effects"       "$PY" tools/effect_strip.py    "$OUT/effects.png"

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed. Screenshots are in $OUT/ - open them and look."
else
  echo "Something failed. See the output above."
fi
exit "$fail"
