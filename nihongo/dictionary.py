"""Offline English meanings for Japanese words, from JMdict.

data/jmdict.sqlite.gz is built by tools/build_dict.py. On first use it is
unpacked (and indexed) into a cache folder, then queried from disk, so the app
never holds the whole dictionary in memory:

    Windows: %LOCALAPPDATA%\\NihongoGrammar
    others:  ~/.cache/nihongo-grammar
"""

import gzip
import hashlib
import os
import shutil
import sqlite3
import tempfile
import threading
from pathlib import Path

SOURCE = Path(__file__).with_name("data") / "jmdict.sqlite.gz"
ATTRIBUTION = ("Word meanings from JMdict, © the Electronic Dictionary Research and "
               "Development Group, used under CC BY-SA 4.0.")

_lock = threading.Lock()
_conn = None


def cache_dir():
    if os.environ.get("NIHONGO_CACHE"):
        return Path(os.environ["NIHONGO_CACHE"])
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "NihongoGrammar"
    base = os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache"
    return Path(base) / "nihongo-grammar"


def _fingerprint():
    h = hashlib.sha1(str(SOURCE.stat().st_size).encode())
    with open(SOURCE, "rb") as f:
        h.update(f.read(1 << 20))
    return h.hexdigest()[:12]


def _unpack(target):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=target.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as dst, gzip.open(SOURCE, "rb") as src:
            shutil.copyfileobj(src, dst)
        db = sqlite3.connect(tmp)
        db.execute("CREATE INDEX IF NOT EXISTS head_idx ON head (head)")
        db.commit()
        db.close()
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _connect():
    global _conn
    if _conn is None:
        name = f"jmdict-{_fingerprint()}.sqlite"
        target = cache_dir() / name
        try:
            if not target.exists():
                _unpack(target)
        except OSError:
            target = Path(tempfile.gettempdir()) / name  # cache folder not writable
            if not target.exists():
                _unpack(target)
        _conn = sqlite3.connect(f"file:{target}?mode=ro", uri=True, check_same_thread=False)
    return _conn


def available():
    return SOURCE.exists()


def lookup(word, reading=None, pos=None):
    """Best English gloss for a dictionary-form word, or None.

    reading (hiragana) and pos (a coarse tag such as "v", "n", "adj", "prt")
    come from the tokenizer and pick between homographs: 降る is ふる "to fall"
    rather than くだる "to descend" when the text was read ふっ.
    """
    if not word or not available():
        return None
    with _lock:
        rows = _connect().execute(
            "SELECT e.readings, e.gloss, e.flags, e.rank, e.pos FROM head h "
            "JOIN entry e ON e.id = h.id WHERE h.head = ?", (word,)).fetchall()
    if not rows:
        return None
    kana_word = all("぀" <= ch <= "ヿ" for ch in word)

    def score(row):
        readings, _, flags, rank, tags = row
        s = 0.0
        if reading:
            s += 3 * max(_shared_prefix(r, reading) for r in readings.split(","))
        if pos and pos in tags.split():
            s += 4 + (1 if tags.split()[0] == pos else 0)
        if "c" in flags:
            s += 2
        if kana_word and "k" in flags:
            s += 2
        return s - rank / 50
    return max(rows, key=score)[1]


def _shared_prefix(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n
