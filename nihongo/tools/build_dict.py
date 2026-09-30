"""Build nihongo/data/jmdict.sqlite.gz, the offline word list, from JMdict.

The source is the SQLite copy of JMdict in the `jamdict-data` package on
PyPI (it ships as jamdict.db.xz):

    pip download --no-deps --no-binary :all: jamdict-data
    tar xzf jamdict_data-*.tar.gz
    xz -dk jamdict_data-*/jamdict_data/jamdict.db.xz
    python -m nihongo.tools.build_dict jamdict_data-*/jamdict_data/jamdict.db

Only what the app shows is kept: each entry's readings, a short English
meaning, and whether the word is common. JMdict is © the Electronic
Dictionary Research and Development Group, used under CC BY-SA 4.0; the
derived file carries the same licence.
"""

import gzip
import shutil
import sqlite3
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "jmdict.sqlite.gz"
COMMON = {"news1", "ichi1", "spec1", "spec2", "gai1"}
MAX_GLOSS_CHARS = 90

# JMdict part-of-speech text -> the coarse tag the analyzer matches against.
POS_TAGS = [
    ("auxiliary", "aux"), ("particle", "prt"), ("conjunction", "conj"),
    ("pronoun", "pn"), ("interjection", "int"), ("counter", "sfx"),
    ("suffix", "sfx"), ("prefix", "pfx"), ("adverb", "adv"),
    ("adjective (keiyoushi)", "adj"), ("adjectival nouns", "na"),
    ("verb", "v"), ("noun", "n"), ("expressions", "exp"),
]


def pos_tag(text):
    for needle, tag in POS_TAGS:
        if needle in text:
            return tag
    return None


def short_gloss(senses):
    """First sense's glosses, plus the second sense if there is room."""
    parts = []
    for glosses in senses[:2]:
        text = "; ".join(glosses[:3])
        if parts and len(parts[0]) + len(text) + 3 > MAX_GLOSS_CHARS:
            break
        parts.append(text)
    gloss = " / ".join(parts)
    return gloss if len(gloss) <= MAX_GLOSS_CHARS else gloss[:MAX_GLOSS_CHARS - 1] + "…"


def build(db_path):
    c = sqlite3.connect(db_path)

    kanji = defaultdict(list)        # idseq -> [kanji forms]
    common = set()
    for kid, idseq, text in c.execute("SELECT ID, idseq, text FROM Kanji ORDER BY ID"):
        kanji[idseq].append(text)
    for idseq, in c.execute("SELECT DISTINCT k.idseq FROM Kanji k JOIN KJP p ON p.kid = k.ID "
                            f"WHERE p.text IN ({','.join('?' * len(COMMON))})", sorted(COMMON)):
        common.add(idseq)

    kana = defaultdict(list)         # idseq -> [readings]
    for idseq, text in c.execute("SELECT idseq, text FROM Kana ORDER BY ID"):
        kana[idseq].append(text)
    for idseq, in c.execute("SELECT DISTINCT k.idseq FROM Kana k JOIN KNP p ON p.kid = k.ID "
                            f"WHERE p.text IN ({','.join('?' * len(COMMON))})", sorted(COMMON)):
        common.add(idseq)

    # nfXX is a frequency band (01 = most frequent); lower is better.
    rank = defaultdict(lambda: 99)
    for table, key in (("KJP", "Kanji"), ("KNP", "Kana")):
        for idseq, text in c.execute(f"SELECT k.idseq, p.text FROM {key} k JOIN {table} p ON p.kid = k.ID "
                                     "WHERE p.text LIKE 'nf%'"):
            rank[idseq] = min(rank[idseq], int(text[2:]))

    tags = defaultdict(list)         # idseq -> coarse POS tags, most important first
    usually_kana = set()
    for idseq, text in c.execute("SELECT s.idseq, p.text FROM pos p JOIN Sense s ON s.ID = p.sid ORDER BY s.ID"):
        tag = pos_tag(text)
        if tag and tag not in tags[idseq]:
            tags[idseq].append(tag)
    for idseq, in c.execute("SELECT DISTINCT s.idseq FROM misc m JOIN Sense s ON s.ID = m.sid "
                            "WHERE m.text LIKE '%usually written using kana%'"):
        usually_kana.add(idseq)

    senses = defaultdict(list)       # idseq -> [[glosses of sense 1], [sense 2], ...]
    sense_of = {}
    for sid, idseq in c.execute("SELECT ID, idseq FROM Sense ORDER BY ID"):
        sense_of[sid] = len(senses[idseq])
        senses[idseq].append([])
    by_sid = defaultdict(list)
    for sid, text in c.execute("SELECT sid, text FROM SenseGloss WHERE lang = 'eng' ORDER BY rowid"):
        by_sid[sid].append(text)
    for sid, idseq in c.execute("SELECT ID, idseq FROM Sense"):
        senses[idseq][sense_of[sid]] = by_sid.get(sid, [])

    entries, index = [], defaultdict(list)
    for idseq, in c.execute("SELECT idseq FROM Entry ORDER BY idseq"):
        gl = short_gloss([s for s in senses[idseq] if s])
        if not gl or not kana[idseq]:
            continue
        n = len(entries)
        flags = ("c" if idseq in common else "") + ("k" if idseq in usually_kana else "")
        entries.append([kana[idseq], gl, flags, rank[idseq], " ".join(tags[idseq])])
        for head in kanji[idseq] + kana[idseq]:
            index[head].append(n)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "jmdict.sqlite"
        out = sqlite3.connect(db)
        out.executescript("""
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
            -- flags: c = common word, k = usually written in kana alone.
            -- rank: JMdict frequency band, 1 = most frequent, 99 = unranked.
            -- pos: coarse part-of-speech tags, most important first.
            CREATE TABLE entry (id INTEGER PRIMARY KEY, readings TEXT, gloss TEXT,
                                flags TEXT, rank INTEGER, pos TEXT);
            CREATE TABLE head (head TEXT, id INTEGER);
        """)
        out.executemany("INSERT INTO meta VALUES (?, ?)", [
            ("source", "JMdict, (c) Electronic Dictionary Research and Development Group"),
            ("licence", "CC BY-SA 4.0 - https://www.edrdg.org/edrdg/licence.html"),
        ])
        out.executemany("INSERT INTO entry VALUES (?, ?, ?, ?, ?, ?)",
                        [(n, ",".join(e[0]), *e[1:]) for n, e in enumerate(entries)])
        out.executemany("INSERT INTO head VALUES (?, ?)",
                        sorted((h, n) for h, ids in index.items() for n in ids))
        # No index here: it doubles the download. The app adds it once, when
        # it unpacks the file on first run (see nihongo/dictionary.py).
        out.commit()
        out.execute("VACUUM")
        out.close()
        with open(db, "rb") as src, gzip.open(OUT, "wb", compresslevel=9) as dst:
            shutil.copyfileobj(src, dst)
    print(f"{len(entries)} entries, {len(index)} headwords -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build(sys.argv[1])
