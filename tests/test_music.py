"""The score parses, every bar adds up, and nothing loops too soon."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game import music as M
from game.score import SONGS

# Map themes are heard for minutes at a time; they must not repeat quickly.
MIN_LOOP_SECONDS = {"victory": 20}
DEFAULT_MIN_LOOP = 45


def loop_seconds(song):
    beats = song.get("beats", 4)
    return sum(s["bars"] * beats for s in song["loop"]) * 60.0 / song["bpm"]


class TestScore(unittest.TestCase):
    def test_every_part_parses_and_fits_its_section(self):
        for name, song in SONGS.items():
            beats = song.get("beats", 4)
            for i, sec in enumerate(song.get("intro", []) + song["loop"]):
                chords = M.parse_chords(sec["chords"], beats)
                self.assertAlmostEqual(sum(c[1] for c in chords), sec["bars"] * beats,
                                       msg="%s section %d chords" % (name, i + 1))
                for part in sec["parts"]:
                    self.assertIn(part["inst"], M._instruments(), name)
                    if "notes" in part:
                        _, used = M.parse_notes(part["notes"], beats, name)
                        self.assertLessEqual(used, sec["bars"] * beats + 1e-6, name)
                    else:
                        M.accompany(part["style"], chords, sec["bars"] * beats, beats)
                if sec.get("drums"):
                    self.assertIn(sec["drums"], M.DRUMS)

    def test_loops_are_long(self):
        for name, song in SONGS.items():
            want = MIN_LOOP_SECONDS.get(name, DEFAULT_MIN_LOOP)
            self.assertGreaterEqual(loop_seconds(song), want, name)

    def test_a_bar_that_does_not_add_up_is_an_error(self):
        with self.assertRaises(ValueError):
            M.parse_notes("c4/4 d4 e4 | f4/2 |", 4, "test")

    def test_harmony_stays_on_chord_tones(self):
        chords = M.parse_chords("C", 4)
        ev, _ = M.parse_notes("c5/4 e5 g5 c6 |", 4)
        out = M.harmonize(ev, chords, "C", "major")
        for _, _, ps, _ in out:
            self.assertIn(ps[0] % 12, (0, 4, 7))

    def test_victory_renders_and_is_not_silent(self):
        intro, body = M.render(SONGS["victory"])
        self.assertIsNotNone(intro)
        self.assertGreater(abs(body).max(), 10000)


if __name__ == "__main__":
    unittest.main()
