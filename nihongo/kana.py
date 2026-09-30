"""Kana helpers: katakana → hiragana, and kana → Hepburn romaji."""

_BASE = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゔ": "vu",
}
_SMALL_Y = {"ゃ": "a", "ゅ": "u", "ょ": "o"}
_SMALL_V = {"ぁ": "a", "ぃ": "i", "ぇ": "e", "ぉ": "o"}
_PUNCT = {"、": ",", "。": ".", "？": "?", "！": "!", "「": '"', "」": '"', "・": " ", "　": " ", "〜": "~"}


def to_hiragana(text):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def is_kana(text):
    return bool(text) and all("぀" <= c <= "ヿ" or c == "ー" for c in text)


def has_kanji(text):
    return any("一" <= c <= "鿿" or "㐀" <= c <= "䶿" or c == "々" for c in text)


def has_japanese(text):
    return any(is_kana(c) or has_kanji(c) for c in text)


def to_romaji(text):
    """Hepburn romaji for kana; anything else is passed through."""
    s = to_hiragana(text)
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        nxt = s[i + 1] if i + 1 < len(s) else ""
        if c == "っ":                                  # double the next consonant
            r = to_romaji(s[i + 1:i + 3]) if nxt else ""
            if r and r[0] not in "aiueon":
                out.append("t" if r.startswith("ch") else r[0])
            i += 1
            continue
        if c == "ー":                                  # long vowel: repeat the last one
            if out and out[-1] and out[-1][-1] in "aiueo":
                out.append(out[-1][-1])
            i += 1
            continue
        if c == "ん":
            out.append("n'" if nxt and (nxt in "あいうえおやゆよ") else "n")
            i += 1
            continue
        r = _BASE.get(c)
        if r is None:
            out.append(_PUNCT.get(c, c))
            i += 1
            continue
        if nxt in _SMALL_Y and r.endswith("i") and len(r) > 1:
            stem = r[:-1]
            if stem in ("sh", "ch", "j"):
                out.append(stem + _SMALL_Y[nxt])
            else:
                out.append(stem + "y" + _SMALL_Y[nxt])
            i += 2
            continue
        if nxt in _SMALL_V and r in ("fu", "vu", "te", "de", "u", "tsu", "shi", "chi", "ji"):
            head = {"fu": "f", "vu": "v", "te": "t", "de": "d", "u": "w", "tsu": "ts",
                    "shi": "sh", "chi": "ch", "ji": "j"}[r]
            out.append(head + _SMALL_V[nxt])
            i += 2
            continue
        out.append(r)
        i += 1
    return "".join(out)
