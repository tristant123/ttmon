"""Every character who talks has a face, and every face renders."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")

import pygame

from game.art import portraits
from game.world import maps

# Speakers that are places or things, not people.
FACELESS = {"Spring"}


class TestPortraits(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        pygame.display.set_mode((1, 1))

    def test_every_named_npc_has_a_portrait(self):
        for key in maps.MAPS:
            for npc in maps.get(key).npcs:
                if npc.name and npc.name not in FACELESS:
                    self.assertIn(npc.name, portraits.SPEAKERS, npc.name)

    def test_every_portrait_renders_at_size(self):
        for key in portraits.CAST:
            surf = portraits.portrait(key)
            self.assertEqual(surf.get_size(), (portraits.W, portraits.H))
            # something was drawn, and the corners stay clear
            self.assertIsNotNone(surf.get_bounding_rect())
            self.assertEqual(surf.get_at((0, 0)).a, 0)

    def test_every_ink_used_is_defined(self):
        for key, build in portraits.CAST.items():
            cv, inks = build()
            used = {ch for row in cv for ch in row} - {portraits.CLEAR}
            self.assertFalse(used - set(inks), key)


if __name__ == "__main__":
    unittest.main()
