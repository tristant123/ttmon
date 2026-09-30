"""Free, offline sentence analysis: Janome for the words, grammar.py for the
grammar points, JMdict for the meanings. No network and no API key.

It returns the same shape as the Claude analyzer (schema.ANALYSIS_SCHEMA), so
the page shows either. What it cannot do is translate the whole sentence;
it gives a word-by-word gloss instead.
"""

import re
import threading
from dataclasses import dataclass

from . import dictionary
from .analyzer import AnalysisError
from .grammar import RULES, potential_origin
from .kana import has_japanese, to_hiragana, to_romaji
from .schema import validate

MAX_SENTENCE_CHARS = 400

_tokenizer = None
_tok_lock = threading.Lock()


OfflineError = AnalysisError


@dataclass
class Tok:
    surface: str
    pos: str          # IPADIC part of speech, e.g. "助詞,格助詞,一般,*"
    itype: str        # conjugation type, e.g. "五段・ラ行"
    iform: str        # conjugation form, e.g. "連用タ接続"
    base: str         # dictionary form
    reading: str      # hiragana

    @property
    def major(self):
        return self.pos.split(",")[0]


def tokenize(text):
    global _tokenizer
    with _tok_lock:
        if _tokenizer is None:
            from janome.tokenizer import Tokenizer
            _tokenizer = Tokenizer()
        raw = list(_tokenizer.tokenize(text))
    toks = []
    for t in raw:
        reading = t.reading if t.reading != "*" else t.surface
        base = t.base_form if t.base_form != "*" else t.surface
        reading = _READING_FIX.get(t.surface, to_hiragana(reading))
        toks.append(Tok(t.surface, t.part_of_speech, t.infl_type, t.infl_form, base, reading))
    return toks


_READING_FIX = {"日本": "にほん"}   # IPADIC prefers にっぽん


# --- English labels ------------------------------------------------------------

_POS_EN = [
    ("名詞,固有名詞", "proper noun"), ("名詞,代名詞", "pronoun"), ("名詞,数", "number"),
    ("名詞,接尾,助数詞", "counter"), ("名詞,接尾", "suffix"), ("名詞,非自立", "dependent noun"),
    ("名詞,形容動詞語幹", "な-adjective"), ("名詞,サ変接続", "noun (takes する)"),
    ("名詞,特殊", "auxiliary noun"), ("名詞", "noun"),
    ("動詞,非自立", "helper verb"), ("動詞,接尾", "verb suffix"), ("動詞", "verb"),
    ("形容詞,非自立", "helper adjective"), ("形容詞", "い-adjective"),
    ("助詞,格助詞", "case particle"), ("助詞,係助詞", "binding particle"),
    ("助詞,接続助詞", "conjunctive particle"), ("助詞,終助詞", "sentence-ending particle"),
    ("助詞,並立助詞", "listing particle"), ("助詞,連体化", "linking particle"),
    ("助詞,副助詞", "adverbial particle"), ("助詞", "particle"),
    ("助動詞", "auxiliary"), ("副詞", "adverb"), ("連体詞", "pre-noun adjective"),
    ("接続詞", "conjunction"), ("感動詞", "interjection"), ("接頭詞", "prefix"),
    ("記号", "punctuation"), ("フィラー", "filler"),
]
_FORM_EN = [
    ("連用タ接続", "て/た stem"), ("連用テ接続", "く form"), ("連用デ接続", "で form"),
    ("連用ニ接続", "に form"), ("連用", "ます stem"), ("未然ウ接続", "volitional stem"),
    ("未然", "negative stem"), ("仮定縮約", "contracted conditional"), ("仮定", "conditional stem"),
    ("命令", "imperative"), ("体言接続", "before a noun"), ("基本形", "dictionary form"),
]
_JMDICT_POS = [("名詞,形容動詞語幹", "na"), ("名詞", "n"), ("動詞", "v"), ("形容詞", "adj"),
               ("副詞", "adv"), ("助詞", "prt"), ("助動詞", "aux"), ("接続詞", "conj"),
               ("感動詞", "int"), ("接頭詞", "pfx"), ("代名詞", "pn")]

# Meanings for grammatical words, where a dictionary entry would mislead
# (JMdict's first いる is "to shoot"; the helper いる in 〜ている isn't "to be").
_FUNCTION_GLOSS = {
    ("助詞", "は"): "topic marker", ("助詞", "が"): "subject marker", ("助詞", "を"): "object marker",
    ("助詞", "に"): "to, at, in (target / time / place)", ("助詞", "で"): "at, by, with (place of action / means)",
    ("助詞", "へ"): "toward", ("助詞", "と"): "and, with; (quotation)", ("助詞", "の"): "'s, of",
    ("助詞", "も"): "also, too", ("助詞", "から"): "from; because", ("助詞", "まで"): "until, as far as",
    ("助詞", "より"): "than; from", ("助詞", "や"): "and (among others)", ("助詞", "か"): "question marker; or",
    ("助詞", "ね"): "…, isn't it? (seeking agreement)", ("助詞", "よ"): "(emphasis: I'm telling you)",
    ("助詞", "な"): "(musing; or 'don't!')", ("助詞", "ので"): "because, so", ("助詞", "のに"): "even though",
    ("助詞", "けど"): "but, although", ("助詞", "けれど"): "but, although", ("助詞", "けれども"): "but, although",
    ("助詞", "ば"): "if", ("助詞", "て"): "(te-form: and, and then)", ("助詞", "ながら"): "while",
    ("助詞", "たり"): "(listing actions)", ("助詞", "だり"): "(listing actions)", ("助詞", "し"): "and what's more",
    ("助詞", "という"): "called; that says", ("助詞", "って"): "(casual quote / topic)", ("助詞", "しか"): "only (+ negative)",
    ("助詞", "だけ"): "only, just", ("助詞", "ばかり"): "nothing but; just", ("助詞", "くらい"): "about",
    ("助詞", "ぐらい"): "about", ("助詞", "など"): "etc.", ("助詞", "でも"): "even; … or something",
    ("助詞", "かも"): "maybe", ("助詞", "じゃ"): "(= では)", ("助詞", "とか"): "things like", ("助詞", "かな"): "I wonder",
    ("助動詞", "ます"): "(polite)", ("助動詞", "です"): "is, am, are (polite)", ("助動詞", "だ"): "is, am, are (plain)",
    ("助動詞", "た"): "(past / completed)", ("助動詞", "ない"): "not", ("助動詞", "ん"): "not",
    ("助動詞", "ぬ"): "not", ("助動詞", "たい"): "want to", ("助動詞", "らしい"): "seems, apparently",
    ("助動詞", "う"): "(let's / will)", ("助動詞", "よう"): "(let's / will)", ("助動詞", "べし"): "should",
    ("動詞,接尾", "れる"): "(passive / potential)", ("動詞,接尾", "られる"): "(passive / potential)",
    ("動詞,接尾", "せる"): "(make / let do)", ("動詞,接尾", "させる"): "(make / let do)",
    ("動詞,非自立", "いる"): "(ongoing / state)", ("動詞,非自立", "てる"): "(ongoing / state)",
    ("動詞,非自立", "でる"): "(ongoing / state)", ("動詞,非自立", "しまう"): "(completely; regrettably)",
    ("動詞,非自立", "ちゃう"): "(completely; regrettably)", ("動詞,非自立", "みる"): "(try doing)",
    ("動詞,非自立", "おく"): "(in advance)", ("動詞,非自立", "とく"): "(in advance)", ("動詞,非自立", "くる"): "(come; start to)",
    ("動詞,非自立", "いく"): "(go on; continue)", ("動詞,非自立", "あげる"): "(for someone)",
    ("動詞,非自立", "くれる"): "(for me)", ("動詞,非自立", "もらう"): "(receive the favor)",
    ("動詞,非自立", "くださる"): "please (do for me)", ("動詞,非自立", "いただく"): "(humbly receive the favor)",
    ("動詞,非自立", "なさる"): "(do! — firm command)", ("動詞,非自立", "すぎる"): "too much",
    ("動詞,非自立", "なる"): "become; (must)", ("動詞,非自立", "いける"): "(must not / must)",
    ("名詞,非自立", "こと"): "(turns a clause into a noun)", ("名詞,非自立", "の"): "(turns a clause into a noun)",
    ("名詞,非自立", "ん"): "(explanatory: it's that …)", ("名詞,非自立", "よう"): "like; so that",
    ("名詞,非自立", "みたい"): "like, seems", ("名詞,非自立", "ため"): "for; because of",
    ("名詞,非自立", "ほう"): "side, way (comparison / advice)", ("名詞,非自立", "はず"): "should be, expected",
    ("名詞,非自立", "つもり"): "intention", ("名詞,非自立", "ところ"): "point (in an action)",
    ("名詞,非自立", "時"): "when, time", ("名詞,非自立", "とき"): "when, time",
    ("名詞,接尾", "そう"): "looks like", ("名詞,特殊", "そう"): "I hear that",
    ("形容詞,非自立", "いい"): "good, OK", ("形容詞,非自立", "やすい"): "easy to", ("形容詞,非自立", "にくい"): "hard to",
    ("形容詞,非自立", "ほしい"): "want (someone) to",
    ("動詞,自立", "いる"): "to be, to exist (people, animals)", ("動詞,自立", "ある"): "to be, to exist (things); to have",
    ("動詞,自立", "する"): "to do", ("動詞,自立", "なる"): "to become", ("動詞,自立", "できる"): "can do; to be done",
    ("動詞,自立", "しれる"): "(in かもしれない: might)",
}
_LITERAL_TAG = {
    "は": "[topic]", "が": "[subj]", "を": "[obj]", "の": "'s", "も": "also", "た": "[past]",
    "ます": "[polite]", "ない": "[not]", "ん": "[not]", "て": "(te)", "で": "at/by",
    "だ": "is", "です": "is", "か": "?", "ね": "right?", "よ": "!", "に": "to/at",
    "へ": "toward", "と": "and/with", "から": "from/because", "まで": "until", "ので": "because",
    "のに": "even though", "けど": "but", "ば": "if", "や": "and", "より": "than", "たい": "want",
    "う": "[let's]", "よう": "[let's]", "たら": "if/when",
}


def _english_pos(tok):
    label = next((en for jp, en in _POS_EN if tok.pos.startswith(jp)), tok.major)
    form = next((en for jp, en in _FORM_EN if tok.iform.startswith(jp)), None)
    return f"{label} ({form})" if form and form != "dictionary form" else label


def _jmdict_pos(tok):
    return next((tag for jp, tag in _JMDICT_POS if tok.pos.startswith(jp)), None)


def gloss_for(tok):
    if tok.major == "記号":
        return {"、": "comma", "。": "full stop", "？": "question mark", "！": "exclamation"}.get(tok.surface, "symbol")
    pos2 = ",".join(tok.pos.split(",")[:2])
    for key in ((pos2, tok.base), (tok.major, tok.base)):
        if key in _FUNCTION_GLOSS:
            return _FUNCTION_GLOSS[key]
    origin = potential_origin(tok) if tok.major == "動詞" else None
    if origin:
        return f"can {_bare(dictionary.lookup(origin, None, 'v') or origin)}"
    g = dictionary.lookup(tok.base, tok.reading, _jmdict_pos(tok))
    if g is None and tok.base != tok.surface:
        g = dictionary.lookup(tok.surface, tok.reading, _jmdict_pos(tok))
    return g or ""


def _short(gloss):
    return gloss.split(" / ")[0].split(";")[0].strip() if gloss else ""


def _bare(gloss):
    """'to fall (of rain, snow, ash, etc.); to come down' -> 'fall'."""
    g = re.sub(r"\s*\([^)]*\)", "", gloss.split(" / ")[0] if gloss else "")
    g = re.split(r"[;,]", g)[0].strip()
    return g[3:] if g.startswith("to ") else g


# --- the analysis ----------------------------------------------------------------

def analyze_offline(sentence, effort=None):
    """Analyse one sentence. effort is accepted for parity with the Claude engine."""
    sentence = sentence.strip()
    if not sentence:
        raise OfflineError("Type a Japanese sentence first.")
    if len(sentence) > MAX_SENTENCE_CHARS:
        raise OfflineError(f"That is too long; keep it under {MAX_SENTENCE_CHARS} characters.")
    if not has_japanese(sentence):
        raise OfflineError("That doesn't look like Japanese. Paste a sentence in Japanese script.")

    toks = tokenize(sentence)
    glosses = [gloss_for(t) for t in toks]
    points = _find_grammar(toks, glosses)

    tokens = [{
        "surface": t.surface,
        "reading": t.reading if t.major != "記号" else t.surface,
        "romaji": _token_romaji(t),
        "part_of_speech": "punctuation" if t.major == "記号" else _english_pos(t),
        "base_form": t.base,
        "gloss": _short_gloss(g),
    } for t, g in zip(toks, glosses)]

    analysis = {
        "sentence": sentence,
        "reading": "".join(t["reading"] for t in tokens),
        "romaji": _sentence_romaji(toks),
        "translation": "",
        "literal_translation": _literal(toks, glosses),
        "structure": _structure(toks, points),
        "tokens": tokens,
        "grammar_points": points,
        "engine": "offline",
        "attribution": dictionary.ATTRIBUTION,
    }
    analysis["warnings"] = validate(analysis)
    return analysis


def _short_gloss(g):
    return g if len(g) <= 60 else _short(g)


def _find_grammar(toks, glosses):
    found = []                                           # (start, end, rule)
    for r in RULES:
        for start, end in r.find(toks):
            found.append((*_widen(toks, start, end), r))

    def inside(a, b):
        return b[0] <= a[0] and a[1] <= b[1]
    kept = []
    for f in found:
        hidden = any(f[2].key in g[2].hides and inside(f, g) and f is not g for g in found)
        dup = any(k[2].key == f[2].key and k[0] < f[1] and f[0] < k[1] for k in kept)
        if not hidden and not dup:
            kept.append(f)
    kept.sort(key=lambda f: (f[0], -(f[1] - f[0])))
    return [_describe(toks, glosses, s, e, r) for s, e, r in kept]


def _widen(toks, start, end):
    """Make a match read as whole words.

    An auxiliary or verb suffix is pulled back onto the verb it hangs on
    (ました -> 出かけました, られて -> 褒められて); a verb stem left dangling
    before て / た gets them (と思っ -> と思って).
    """
    while (start > 0 and toks[start].pos.startswith(("助動詞", "動詞,接尾"))
           and toks[start].base not in ("だ", "です")
           and toks[start - 1].major in ("動詞", "形容詞", "助動詞")
           and toks[start - 1].base not in ("だ", "です")):
        start -= 1
    last = toks[end - 1]
    if (end < len(toks) and last.major in ("動詞", "形容詞") and "接尾" not in last.pos
            and last.iform.startswith("連用") and toks[end].surface in ("て", "で", "た", "だ")
            and toks[end].pos.startswith(("助詞,接続助詞", "助動詞"))):
        end += 1
    return start, end


def _describe(toks, glosses, start, end, r):
    ctx = _context(toks, glosses, start, end)
    here = r.here(ctx) if callable(r.here) else r.here.format_map(_Blank(ctx))
    return {
        "pattern": r.pattern, "name": r.name, "category": r.category, "jlpt": r.jlpt,
        "matched_text": "".join(t.surface for t in toks[start:end]),
        "token_indices": list(range(start, end)),
        "meaning": r.meaning, "explanation": here, "formation": r.formation,
        "example": {"japanese": r.example[0], "english": r.example[1]},
    }


class _Blank(dict):
    def __missing__(self, key):
        return ""


def _context(toks, glosses, start, end):
    span = toks[start:end]
    # The content word the pattern hangs on: the first verb/adjective inside the
    # match, or failing that the nearest one before it.
    head = next((k for k in range(start, end) if _is_content(toks[k])), None)
    if head is None:
        head = next((k for k in range(start - 1, -1, -1) if _is_content(toks[k])), None)
    base_jp = toks[head].base if head is not None else ""
    base_en = _bare(glosses[head]) if head is not None else ""
    origin = potential_origin(toks[start]) if toks[start].major == "動詞" else None
    prev = toks[start - 1] if start > 0 else None
    return {
        "text": "".join(t.surface for t in span),
        "text_first": span[0].surface, "text_last": span[-1].surface,
        "prev": _prev_phrase(toks, start),
        "prev_surface": prev.surface if prev else "",
        "prev_pos": prev.pos if prev else "", "prev_iform": prev.iform if prev else "",
        "base": f"{base_jp} ('{base_en}')" if base_en else base_jp,
        "gloss": base_en or base_jp,
        "base_gloss": base_en or base_jp,
        "origin": origin or "",
        "origin_gloss": _bare(dictionary.lookup(origin, None, "v")) if origin else "",
        "has_ni_before": any(t.surface == "に" and t.pos.startswith("助詞,格助詞") for t in toks[:start]),
        "at_end": all(t.major == "記号" for t in toks[end:]),
        "passive_after": any(t.base in ("れる", "られる") and t.pos.startswith("動詞,接尾")
                             for t in toks[end:end + 6]),
    }


def _is_content(t):
    return (t.major in ("動詞", "形容詞") and "非自立" not in t.pos and "接尾" not in t.pos) \
        or t.pos.startswith("名詞,形容動詞語幹") or t.pos.startswith("名詞,サ変接続")


def _prev_phrase(toks, start):
    """The noun phrase right before a particle, e.g. 日本語 or 田中さん."""
    k = start - 1
    if k < 0:
        return ""
    if toks[k].major != "名詞":
        return toks[k].surface
    words = [toks[k].surface]
    # Only glue on what belongs to the same word: 田中 + さん, お + 茶, 三 + 冊.
    while k > 0 and (toks[k].pos.startswith("名詞,接尾") or toks[k - 1].major == "接頭詞"
                     or (toks[k].pos.startswith("名詞,数") and toks[k - 1].pos.startswith("名詞,数"))):
        k -= 1
        words.insert(0, toks[k].surface)
    return "".join(words)


_ATTACH = ("助動詞", "動詞,接尾")


def _token_romaji(t):
    if t.major == "記号":
        return to_romaji(t.surface)
    if t.pos.startswith("助詞") and t.surface in ("は", "へ", "を"):
        return {"は": "wa", "へ": "e", "を": "o"}[t.surface]
    return to_romaji(t.reading)


def _sentence_romaji(toks):
    groups = []                      # kana of each spoken word, e.g. ふって, いた
    prefix_pending = False
    prev = None
    for t in toks:
        kana = {"は": "わ", "へ": "え", "を": "お"}.get(t.surface, t.reading) \
            if t.pos.startswith("助詞") else (t.surface if t.major == "記号" else t.reading)
        attach = groups and (
            t.major == "記号"
            or (t.pos.startswith(_ATTACH) and t.base not in ("だ", "です")
                and prev is not None and prev.major in ("動詞", "形容詞", "助動詞"))
            or t.base in ("ちゃう", "じゃう")
            or (t.pos.startswith("助詞,接続助詞") and t.surface in ("て", "で", "ば", "たり", "だり"))
            or groups[-1].endswith("っ")
            or prefix_pending)
        if attach:
            groups[-1] += kana
        else:
            groups.append(kana)
        prefix_pending = t.major == "接頭詞"         # お + 茶 → ocha
        prev = t
    out = " ".join(to_romaji(g) for g in groups).strip()
    return re.sub(r"(^|[.!?]\s+)([a-z])", lambda mt: mt.group(1) + mt.group(2).upper(), out)


def _literal(toks, glosses):
    words = []
    for t, g in zip(toks, glosses):
        if t.major == "記号":
            if words:
                words[-1] += {"、": ",", "。": ".", "？": "?", "！": "!"}.get(t.surface, "")
            continue
        if t.major in ("助詞", "助動詞") and (t.surface in _LITERAL_TAG or t.base in _LITERAL_TAG):
            words.append(_LITERAL_TAG.get(t.surface) or _LITERAL_TAG[t.base])
        elif g.startswith("("):
            words.append("[" + g.strip("()").split(";")[0] + "]")
        elif t.major in ("助詞", "助動詞") or "非自立" in t.pos:
            words.append(_bare(g) or t.surface)
        else:
            words.append(_bare(g) or t.surface)
    return " ".join(w for w in words if w)


def _structure(toks, points):
    keys = {p["pattern"] for p in points}
    names = [p["name"] for p in points]
    notes = []

    polite = any(t.base in ("ます", "です") and t.major == "助動詞" for t in toks)
    keigo = any(p["category"] == "honorific" and p["pattern"] not in ("〜さん / 〜様 / 〜ちゃん / 〜君",) for p in points)
    if keigo:
        notes.append("Register: keigo (honorific or humble language), used with customers, superiors or strangers.")
    elif polite:
        notes.append("Register: polite (です/ます), the default with people you don't know well.")
    else:
        notes.append("Register: plain (casual), used with friends and family, or in writing.")

    content = [t for t in toks if t.major != "記号"]
    last = content[-1] if content else None
    if last is not None:
        if last.surface in ("か", "かな") or toks[-1].surface in ("？", "?"):
            kind = "an invitation" if "〜ませんか" in keys else "a question"
        elif "〜ましょう" in keys:
            kind = "a suggestion ('let's …')"
        elif keys & {"〜てください", "〜ないでください", "〜て (request)"}:
            kind = "a request"
        elif any(t.iform.startswith("命令") for t in content[-2:]):
            kind = "a command"
        else:
            kind = "a statement"
        notes.append(f"It is {kind}.")

    links = [p for p in points if p["category"] == "conjunction"]
    te_links = [p for p in points if p["pattern"] == "〜て (て-form)"
                and p["token_indices"][-1] + 1 < len(toks)
                and toks[p["token_indices"][-1] + 1].pos.startswith(("名詞", "動詞,自立", "副詞", "記号,読点"))]
    if links or te_links:
        joins = [f"{p['matched_text']} ({p['name'].lower()})" for p in links]
        joins += [f"{p['matched_text']} (て-form linking)" for p in te_links]
        notes.append(f"The clauses are joined by: {'; '.join(joins)}. "
                     "In Japanese the main clause, with the sentence's main verb, always comes last.")

    has_topic = any(t.surface == "は" and t.pos.startswith("助詞,係助詞") for t in toks)
    has_subject = any(t.surface == "が" and t.pos.startswith("助詞,格助詞") for t in toks)
    main_verbs = [t for t in toks if t.major in ("動詞", "形容詞") and "非自立" not in t.pos]
    if main_verbs and not has_topic and not has_subject:
        notes.append("No subject is stated. It is understood from context: usually 'I' in statements "
                     "and 'you' in questions.")
    elif has_topic:
        topic = [p for p in points if p["pattern"] == "は"]
        if topic:
            notes.append(f"The topic is {_topic_text(toks, topic[0])}: everything else is said about it.")

    if "Relative clause" in names:
        notes.append("A clause sits directly in front of a noun to describe it (a relative clause); "
                     "Japanese has no word for 'that' or 'which'.")
    return " ".join(notes)


def _topic_text(toks, point):
    i = point["token_indices"][0]
    return _prev_phrase(toks, i) or "the word before は"
