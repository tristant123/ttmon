"""A small pattern language for writing grammar points the way textbooks do.

    {V-te} いる                 Verb て-form + いる
    {PLAIN|N} にもかかわらず      plain form or noun + にもかかわらず
    たとえ … {V-te|A-te} も      a pattern in two parts, with words between

Elements are separated by spaces:

  literal      Japanese text matched against the sentence across word
               boundaries: にもかかわらず matches に/も/かかわら/ず. The last word
               may be conjugated (ことにする also matches ことにした). Alternatives
               are written a|b. A trailing ? makes it optional; a trailing ~
               also takes in the endings after it (ます, た, ない, ん ...).
               Literals ending in ない also match the polite ません and past
               なかった; literals ending in だ also match です / だった / でした.
  {SLOT}       a kind of word, e.g. {V-te}; alternatives {V-dict|N-no}.
  …            a gap of up to 12 words (not crossing the end of a sentence).

Slots (verb slots include する-nouns like 勉強する and suffixes like させる):

  V        a verb with any endings       V-dict   dictionary form (行く)
  V-masu   ます-stem (行き)               V-te     て-form, incl. ないで/なくて
  V-ta     た-form (行った, 行かなかった)    V-neg    ない-stem (行か)
  V-nai    plain negative (行かない)      V-vol    volitional (行こう)
  V-ba     ば-form (行けば)               V-imp    imperative (行け)
  A        い-adjective, any form        A-dict   dictionary form (高い)
  A-stem   stem (高, as in 高すぎる)       A-ku     く-form (高く)
  A-te     くて-form                      NA       な-adjective (静か)            NA-na    な-adjective + な (静かな)
  N        a noun or noun phrase          N-no     noun + の
  NUM      a number (+ counter)           Q        a question word (何, 誰 ...)
  PLAIN    any plain-form predicate (行く, 行かなかった, 高い, 学生だ)
  PRED     any predicate, plain or polite

Verb, adjective and predicate slots are highlighted with the grammar point;
noun slots are context only.
"""

import re
from dataclasses import dataclass, field
from urllib.parse import quote

MAX_GAP = 12
NUMERALS = set("一二三四五六七八九十百千万何数0123456789０１２３４５６７８９")
QUESTION_WORDS = {"何", "なに", "なん", "誰", "だれ", "どこ", "いつ", "どう", "どれ", "どの", "どちら",
                  "どっち", "なぜ", "どうして", "どんな", "いくら", "いくつ", "どなた", "何故"}


# --- word-level helpers ------------------------------------------------------------

def _is(t, prefix):
    return t.pos.startswith(prefix)


def _verb_word(toks, i):
    """End of the verb word starting at i (incl. する-noun and suffixes), or None."""
    n = len(toks)
    if i >= n:
        return None
    j = i
    if _is(toks[i], "名詞,サ変接続") and i + 1 < n and toks[i + 1].base in ("する", "できる") \
            and _is(toks[i + 1], "動詞"):
        j = i + 1
    elif toks[i].surface in ("お", "ご") and _is(toks[i], "接頭詞") and i + 1 < n and _is(toks[i + 1], "動詞"):
        j = i + 1
    if not (_is(toks[j], "動詞,自立") or _is(toks[j], "動詞,非自立")):
        return None
    j += 1
    while j < n and _is(toks[j], "動詞,接尾"):
        j += 1
    return j


def _aux_chain(toks, j, plain_only=False):
    """All ends reachable by adding auxiliaries / ている-style helpers after j."""
    ends = [j]
    n = len(toks)
    while j < n:
        t = toks[j]
        if _is(t, "助動詞") or _is(t, "動詞,接尾"):
            if plain_only and t.base in ("ます", "です"):
                break
            j += 1
        elif t.surface in ("て", "で") and _is(t, "助詞,接続助詞") and j + 1 < n and _is(toks[j + 1], "動詞,非自立"):
            j += 2
        elif _is(t, "動詞,非自立"):
            j += 1
        else:
            break
        ends.append(j)
    return ends


def _is_plain_end(t):
    if t.base in ("ます", "です") or t.surface in ("ませ",):
        return False
    return t.iform.startswith(("基本形", "文語基本形")) or (t.surface == "ん" and _is(t, "助動詞"))


def _noun_phrase(toks, i):
    n = len(toks)
    j = i
    if j < n and _is(toks[j], "接頭詞"):
        j += 1
    k = j
    while k < n and _is(toks[k], "名詞") and not (toks[k].surface in ("の", "ん") and _is(toks[k], "名詞,非自立")):
        k += 1
    return k if k > j else None


def _slot_ends(name, toks, i):
    """Possible (end, highlighted) results for a slot starting at i."""
    n = len(toks)
    if i >= n:
        return []
    t = toks[i]
    out = []

    if name.startswith("V"):
        vw = _verb_word(toks, i)
        if vw is None:
            return []
        last = toks[vw - 1]
        nxt = toks[vw] if vw < n else None
        if name == "V":
            out = _aux_chain(toks, vw)
        elif name == "V-dict":
            out = [vw] if last.iform.startswith(("基本形", "文語基本形")) else []
        elif name == "V-masu":
            out = [vw] if last.iform == "連用形" else []
        elif name == "V-te":
            if last.iform.startswith("連用") and nxt and nxt.surface in ("て", "で") and _is(nxt, "助詞,接続助詞"):
                out = [vw + 1]
            elif last.iform.startswith("未然") and nxt and nxt.base == "ない" and vw + 1 < n \
                    and toks[vw + 1].surface in ("て", "で"):
                out = [vw + 2]
        elif name == "V-ta":
            if last.iform.startswith("連用") and nxt and nxt.base in ("た", "だ") and nxt.iform == "基本形" \
                    and nxt.surface in ("た", "だ"):
                out = [vw + 1]
            elif last.iform.startswith("未然") and nxt and nxt.base == "ない" and nxt.iform.startswith("連用タ") \
                    and vw + 1 < n and toks[vw + 1].base == "た":
                out = [vw + 2]
            elif nxt and nxt.base == "ます" and nxt.iform.startswith("連用") and vw + 1 < n \
                    and toks[vw + 1].base == "た":          # polite past: 食べました
                out = [vw + 2]
        elif name == "V-neg":
            out = [vw] if last.iform.startswith("未然") and not last.iform.startswith("未然ウ") else []
        elif name == "V-nai":
            if last.iform.startswith("未然") and nxt and nxt.base == "ない" and nxt.iform == "基本形":
                out = [vw + 1]
        elif name == "V-vol":
            if nxt and nxt.surface in ("う", "よう") and _is(nxt, "助動詞"):
                out = [vw + 1]
            elif nxt and nxt.base == "ます" and nxt.iform.startswith("未然ウ") and vw + 1 < n and toks[vw + 1].surface == "う":
                out = [vw + 2]
        elif name == "V-ba":
            if last.iform.startswith("仮定") and nxt and nxt.surface == "ば":
                out = [vw + 1]
        elif name == "V-imp":
            out = [vw] if last.iform.startswith("命令") else []
        return [(e, True) for e in out]

    if name.startswith("A"):
        if not _is(t, "形容詞"):
            return []
        nxt = toks[i + 1] if i + 1 < n else None
        if name == "A":
            out = _aux_chain(toks, i + 1)
        elif name == "A-dict":
            out = [i + 1] if t.iform == "基本形" else []
        elif name == "A-stem":
            out = [i + 1] if t.iform.startswith(("ガル接続", "語幹")) else []
        elif name == "A-ku":
            out = [i + 1] if t.iform.startswith("連用テ") else []
        elif name == "A-te":
            out = [i + 2] if t.iform.startswith("連用テ") and nxt and nxt.surface == "て" else []
        elif name == "A-ba":
            out = [i + 2] if t.iform.startswith("仮定") and nxt and nxt.surface == "ば" else []
        return [(e, True) for e in out]

    if name == "NA":
        return [(i + 1, True)] if _is(t, "名詞,形容動詞語幹") else []
    if name == "NA-na":                         # 静かな, 好きな
        if _is(t, "名詞,形容動詞語幹") and i + 1 < n and toks[i + 1].surface == "な" and _is(toks[i + 1], "助動詞"):
            return [(i + 2, True)]
        return []
    if name == "N":
        e = _noun_phrase(toks, i)
        return [(k, False) for k in range(e, i, -1)] if e else []
    if name == "N-no":
        e = _noun_phrase(toks, i)
        if e and e < n and toks[e].surface == "の" and _is(toks[e], "助詞,連体化"):
            return [(e + 1, False)]
        return []
    if name == "NUM":
        if not _is(t, "名詞,数") and not (_is(t, "名詞") and t.surface[0] in NUMERALS):
            return []
        j = i + 1                               # 一つ, 三人 can be single words
        while j < n and _is(toks[j], "名詞,数"):
            j += 1
        if j < n and _is(toks[j], "名詞,接尾"):
            j += 1
        return [(j, True)]
    if name == "Q":
        return [(i + 1, True)] if t.base in QUESTION_WORDS or t.surface in QUESTION_WORDS else []
    if name in ("PLAIN", "PRED"):
        plain = name == "PLAIN"
        starts = []
        vw = _verb_word(toks, i)
        if vw is not None:
            starts.append(vw)
        elif _is(t, "形容詞"):
            starts.append(i + 1)
        elif _is(t, "名詞"):                      # 学生だ, 静かだった
            e = _noun_phrase(toks, i)
            if e and e < n and toks[e].base in ("だ", "です") and _is(toks[e], "助動詞"):
                starts.append(e + 1)
        for s in starts:
            for e in _aux_chain(toks, s, plain_only=plain):
                last = toks[e - 1]
                if not plain or _is_plain_end(last):
                    out.append(e)
        return [(e, True) for e in sorted(set(out), reverse=True)]
    raise ValueError(f"unknown slot {{{name}}}")


# --- literals ------------------------------------------------------------------------

def _variants(text):
    out = [text]
    if text.endswith("ない"):
        out += [text[:-2] + "ません", text[:-2] + "なかった", text[:-2] + "なく"]
    if text.endswith("だ"):
        out += [text[:-1] + "です", text[:-1] + "だった", text[:-1] + "でした", text[:-1] + "で"]
    return out


def _literal_end(toks, i, text, mid_start=False):
    """End index if `text` matches the words starting at i, else None."""
    n = len(toks)
    if i >= n:
        return None
    first = toks[i].surface
    starts = [""]
    if mid_start:
        starts += [first[k:] for k in range(1, len(first)) if text.startswith(first[k:])]
    if mid_start and toks[i].base != first and toks[i].major in ("動詞", "形容詞"):
        if any(toks[i].base[k:] == text for k in range(1, len(toks[i].base))):
            return i + 1                        # 読み切っ: base 読み切る ends with 切る
    for k, acc0 in enumerate(starts):
        acc = ""
        j = i
        if k:                                   # the literal starts inside toks[i]
            acc = acc0
            if acc == text:
                return i + 1
            j = i + 1
        while j < n:
            t = toks[j]
            s = t.surface
            if acc + s == text:
                return j + 1
            if t.base != s and t.major in ("動詞", "形容詞", "助動詞") and acc + t.base == text:
                return j + 1
            if text.startswith(acc + s):
                acc += s
                j += 1
                continue
            break
    return None


@dataclass
class Element:
    kind: str                 # "lit", "slot", "gap"
    alts: list = field(default_factory=list)
    optional: bool = False
    tail: bool = False


def compile_spec(spec):
    elems = []
    for part in spec.split():
        if part in ("…", "..."):
            elems.append(Element("gap"))
        elif part.startswith("{"):
            optional = part.endswith("?")
            elems.append(Element("slot", part.strip("{}?").split("|"), optional))
        else:
            optional = part.endswith("?")
            part = part.rstrip("?")
            tail = "~" in part
            alts = [v for a in part.split("|") for v in _variants(a.rstrip("~"))]
            elems.append(Element("lit", sorted(set(alts), key=len, reverse=True), optional, tail))
    return elems


# Endings a "~" literal takes in: politeness, tense and negation. Conditionals
# (たら), volitional (う) and conjectures are grammar points of their own.
_TAIL_BASES = {"ます", "た", "ない", "ん", "ぬ", "です"}


def _tail(toks, j):
    while j < len(toks) and _is(toks[j], "助動詞") and toks[j].base in _TAIL_BASES \
            and not toks[j].iform.startswith(("仮定", "未然ウ")):
        j += 1
    return j


def _match(elems, toks, k, i, core, full):
    """Yield (core, full) index lists for elems[k:] matched from position i."""
    if k == len(elems):
        yield core, full
        return
    e = elems[k]
    if e.kind == "lit":
        for alt in e.alts:                      # longest alternative first
            end = _literal_end(toks, i, alt, mid_start=(k == 0))
            if end is not None:
                if e.tail:
                    end = _tail(toks, end)
                span = list(range(i, end))
                yield from _match(elems, toks, k + 1, end, core + span, full + span)
                break
        if e.optional:
            yield from _match(elems, toks, k + 1, i, core, full)
    elif e.kind == "slot":
        found = False
        for name in e.alts:
            for end, shown in _slot_ends(name, toks, i):
                found = True
                span = list(range(i, end))
                yield from _match(elems, toks, k + 1, end, core, full + (span if shown else []))
        if e.optional and not found:
            yield from _match(elems, toks, k + 1, i, core, full)
    else:                                       # gap
        for j in range(i, min(len(toks), i + MAX_GAP) + 1):
            if j > i and toks[j - 1].surface in ("。", "！", "？", "!", "?"):
                break
            yield from _match(elems, toks, k + 1, j, core, full)


# --- grammar points ------------------------------------------------------------------

LEVELS = ("N5", "N4", "N3", "N2", "N1")


@dataclass
class Entry:
    key: str
    pattern: str
    name: str
    jlpt: str
    category: str
    specs: list
    meaning: str
    formation: str
    example: tuple
    gloss: str = ""
    here: object = None
    hides: tuple = ()
    generic: bool = False
    check: object = None              # callable(toks, core, full) -> bool
    compiled: list = field(default_factory=list, repr=False)
    needles: list = field(default_factory=list, repr=False)

    def __post_init__(self):
        if isinstance(self.specs, str):
            self.specs = [self.specs]
        self.compiled = [compile_spec(s) for s in self.specs]
        # Cheap pre-filter: each required literal (or a stem of it) must occur.
        self.needles = []
        for elems in self.compiled:
            # Conjugation can change the last two characters (する → し), so only
            # the stem of longer literals is a safe filter.
            req = [[a[:-2] for a in e.alts] for e in elems
                   if e.kind == "lit" and not e.optional and all(len(a) >= 3 for a in e.alts)]
            self.needles.append(req)
        # A fixed expression ending in ない (〜ざるを得ない) swallows the negation;
        # a split one (あまり … ない) leaves the verb's own negative visible.
        fixed = not any("…" in sp or "..." in sp for sp in self.specs)
        if fixed and any(w in self.specs[0] for w in ("ない", "ず", "ません")):
            self.hides = tuple(self.hides) + ("nai", "masen", "negative_n", "nakatta", "i_adj_neg")

    @property
    def lookup_url(self):
        return lookup_url(self.pattern)

    def find(self, toks, text):
        for elems, needles in zip(self.compiled, self.needles):
            if any(not any(nd in text for nd in alts) for alts in needles):
                continue
            seen = set()
            for i in range(len(toks)):
                for core, full in _match(elems, toks, 0, i, [], []):
                    if not core:
                        continue
                    key = tuple(core)
                    if key in seen:
                        continue
                    if self.check and not self.check(toks, core, full):
                        continue
                    seen.add(key)
                    yield sorted(set(core)), sorted(set(full))
                    break


REGISTRY = []


def lookup_url(pattern):
    """A Bunpro search for the pattern (bunpro.jp's own page for it is the top hit)."""
    q = pattern.replace("〜", "").replace("~", "").split(" / ")[0].split(" (")[0].strip()
    return "https://www.google.com/search?q=" + quote(f"bunpro {q} grammar")


def g(level, key, pattern, name, category, specs, meaning, formation, example, gloss="", **kw):
    assert level in LEVELS, level
    e = Entry(key, pattern, name, level, category, specs, meaning, formation, example, gloss, **kw)
    REGISTRY.append(e)
    return e


def compound(suffixes, exclude=(), allow=None):
    """Check for a suffix inside one compound-verb word, e.g. 読み切る, 助け合う.

    Janome often keeps such verbs whole, so the pattern matches mid-word; this
    makes sure the word really is verb-stem + suffix and not a lookalike
    (上がる is not 上 + がる).
    """
    def check(toks, core, full):
        t = toks[core[0]]
        base = t.base
        if not t.pos.startswith("動詞") or base in exclude:
            return False
        if allow is not None:
            return base in allow
        return any(base.endswith(sfx) and len(base) > len(sfx) for sfx in suffixes)
    return check


def describe_here(entry, toks, core, full):
    """Default 'what it does here' text for a catalog entry."""
    from .phrases import before
    core_text = _join(toks, core)
    slot = [i for i in full if i not in core]
    slot_text = _join(toks, slot) or before(toks, core[0])
    if callable(entry.here):
        return entry.here({"text": core_text, "slot": slot_text, "toks": toks, "core": core, "full": full})
    if entry.here:
        return entry.here.format(text=core_text, slot=slot_text or core_text)
    gloss = entry.gloss or entry.name.lower()
    split = any(b != a + 1 for a, b in zip(full, full[1:]))
    if split:                                   # あまり … ない, いくら … ても
        return f"「{_join(toks, full)}」: the parts work together to mean '{gloss}'."
    if slot:
        return f"「{core_text}」 attaches to 「{_join(toks, slot)}」 and means '{gloss}' here."
    if slot_text:
        return f"「{core_text}」 follows 「{slot_text}」 and means '{gloss}' here."
    return f"「{core_text}」 here means '{gloss}'."


def _join(toks, idx):
    out, prev = [], None
    for i in idx:
        if prev is not None and i != prev + 1:
            out.append("…")
        out.append(toks[i].surface)
        prev = i
    return "".join(out)


def matched_text(toks, idx):
    return _join(toks, idx)


def strip_tilde(s):
    return re.sub(r"[〜~]", "", s)
