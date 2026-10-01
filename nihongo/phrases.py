"""Split a sentence into phrases (bunsetsu) and say what each one does.

A bunsetsu is one content word plus everything that attaches to it:
雨が / 降っていたので、 / 傘を / 持って / 出かけました。 Japanese is analysed
this way in schools and dictionaries, and it is the unit learners read in.
"""

# Content words start a new phrase; everything else attaches to the one before.
_STARTS = ("名詞", "動詞,自立", "形容詞,自立", "副詞", "連体詞", "接続詞", "感動詞", "接頭詞")


def _starts_phrase(prev, t):
    if prev is None:
        return True
    if prev.pos.startswith("接頭詞"):
        return False                                     # お + 茶
    if not t.pos.startswith(_STARTS):
        return t.pos.startswith("記号,括弧開")
    if t.pos.startswith(("名詞,接尾", "名詞,非自立")):
        return False                                     # 田中 + さん, 読む + の
    if t.pos.startswith("名詞") and prev.pos.startswith("名詞") and not prev.pos.startswith("名詞,非自立"):
        return False                                     # 天気 + 予報
    if t.base in ("する", "できる") and prev.pos.startswith("名詞,サ変接続"):
        return False                                     # 勉強 + する
    if prev.pos.startswith("記号,括弧開"):
        return False
    return True


def segment(toks, glue=()):
    """[(start, end), ...] covering every token.

    glue: token indices that must not start a phrase because they sit inside
    a fixed expression (にもかかわらず is one unit even though かかわら looks
    like a verb).
    """
    spans, start = [], 0
    for i, t in enumerate(toks):
        if i > 0 and i not in glue and _starts_phrase(toks[i - 1], t):
            spans.append((start, i))
            start = i
    if toks:
        spans.append((start, len(toks)))
    return spans


_PARTICLE_ROLES = {
    "は": "Topic", "が": "Subject", "を": "Object", "に": "Target / time / place",
    "で": "Place / means", "へ": "Direction", "と": "With / and", "まで": "Until / up to",
    "より": "Compared with", "の": "Describes the next noun", "も": "Also / even",
    "や": "Listing (and …)", "から": "From", "って": "Quote / topic", "だけ": "Only",
    "しか": "Only (+ negative)", "ほど": "Extent", "くらい": "About", "ぐらい": "About",
    "など": "Examples", "さえ": "Even", "こそ": "Emphasis", "でも": "Even / or something",
}
_CLAUSE_ROLES = {
    "ので": "Reason clause", "から": "Reason clause", "けど": "Contrast clause",
    "けれど": "Contrast clause", "けれども": "Contrast clause", "が": "Contrast clause",
    "のに": "Contrast clause (even though)", "ば": "Condition", "と": "Condition (when / if)",
    "ながら": "Simultaneous action", "し": "Listing reasons", "たり": "Example action",
    "だり": "Example action", "ても": "Concession (even if)", "でも": "Concession (even if)",
}


def role(toks, start, end, is_last, next_start_tok):
    words = [t for t in toks[start:end] if not t.pos.startswith("記号")]
    if not words:
        return "Punctuation"
    head, last = words[0], words[-1]
    if head.pos.startswith("接続詞"):
        return "Connector"
    if head.pos.startswith("感動詞"):
        return "Interjection"
    if head.pos.startswith("連体詞"):
        return "Describes the next noun"
    if head.pos.startswith("副詞") and len(words) == 1:
        return "Adverb"

    # Ends in a particle: the particle says what the phrase does.
    if last.pos.startswith("助詞"):
        if last.pos.startswith("助詞,終助詞") or (is_last and last.surface in ("か", "ね", "よ", "な")):
            return "Main predicate"
        if last.pos.startswith("助詞,接続助詞"):
            if last.surface in ("て", "で"):
                return "Linked action (て-form)"
            if last.surface == "も" or (len(words) > 1 and words[-2].surface in ("て", "で") and last.surface == "も"):
                return "Concession (even if)"
            return _CLAUSE_ROLES.get(last.surface, "Linked clause")
        if last.surface == "も" and len(words) > 1 and words[-2].surface in ("て", "で") \
                and words[-2].pos.startswith("助詞,接続助詞"):
            return "Concession (even if)"
        if last.pos.startswith("助詞,格助詞,引用"):
            return "Quoted content"
        if last.pos.startswith("助詞,副詞化"):
            return "Adverbial (how)"
        if last.surface == "に" and head.pos.startswith("名詞,形容動詞語幹"):
            return "Adverbial (how)"
        return _PARTICLE_ROLES.get(last.surface, "Particle phrase")

    if is_last:
        return "Main predicate"
    is_pred = any(t.pos.startswith(("動詞", "形容詞", "助動詞")) for t in words)
    if is_pred and next_start_tok is not None and next_start_tok.pos.startswith("名詞") \
            and last.iform.startswith(("基本形", "体言接続")):
        return "Describes the next noun"
    if is_pred and last.iform.startswith("連用"):
        return "Linked clause"
    if is_pred and last.pos.startswith("助動詞") and last.iform.startswith("仮定"):
        return "Condition"
    if not is_pred and head.pos.startswith(("名詞,副詞可能", "名詞,数")) or head.base in ("今日", "昨日", "明日", "毎日", "毎朝", "今"):
        return "Time"
    if not is_pred:
        return "Noun (no particle)"
    return "Predicate"


def analyse(toks, grammar_points, glue=()):
    spans = segment(toks, glue)
    out = []
    for n, (s, e) in enumerate(spans):
        is_last = all(t.pos.startswith("記号") for t in toks[e:])
        nxt = toks[e] if e < len(toks) else None
        inside = set(range(s, e))
        gp = [k for k, p in enumerate(grammar_points) if inside & set(p["token_indices"])]
        r = role(toks, s, e, is_last, nxt)
        # A clause-linking grammar point that closes the phrase names its role
        # better than the particle does: 忙しいにもかかわらず → "Despite …".
        words_end = max((i for i in range(s, e) if not toks[i].pos.startswith("記号")), default=e - 1)
        for k in reversed(gp):
            p = grammar_points[k]
            if p["category"] == "conjunction" and words_end in p["token_indices"] and not is_last:
                r = f"{p['name']} (clause)"
                break
        out.append({
            "text": "".join(t.surface for t in toks[s:e]),
            "token_indices": list(range(s, e)),
            "role": r,
            "grammar": gp,
        })
    return out


def before(toks, i):
    """Text of the phrase just before token i (for explanations), or ''."""
    for s, e in reversed(segment(toks)):
        if s < i:
            return "".join(t.surface for t in toks[s:min(e, i)] if not t.pos.startswith("記号"))
    return ""
