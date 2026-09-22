"""Saving and loading, next to the executable on Windows or in ~ elsewhere."""

import json
import os
import sys

from .config import SAVE_FILENAME
from .player import PlayerState


def save_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    if os.name == "nt":
        base = os.environ.get("APPDATA")
        if base:
            d = os.path.join(base, "TabulaMythos")
            os.makedirs(d, exist_ok=True)
            return d
    return os.path.expanduser("~")


def save_path():
    return os.path.join(save_dir(), SAVE_FILENAME)


def has_save():
    return os.path.exists(save_path())


def save(player):
    try:
        with open(save_path(), "w", encoding="utf-8") as fh:
            json.dump({"version": 1, "player": player.to_dict()}, fh)
        return True
    except OSError:
        return False


def load():
    try:
        with open(save_path(), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return PlayerState.from_dict(data["player"])
    except (OSError, ValueError, KeyError):
        return None


def delete():
    try:
        os.remove(save_path())
    except OSError:
        pass
