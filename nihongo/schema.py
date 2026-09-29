"""The shape of one sentence analysis.

The same schema is sent to Claude as a structured-output format (so the reply
is guaranteed to be JSON of this shape) and used by validate() to check any
analysis before the UI sees it, including the offline demo.
"""

JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1", "none"]

CATEGORIES = [
    "particle",           # が, を, に, で, は, も, の, から, ね, よ ...
    "conjugation",        # te-form, past, negative, potential, volitional ...
    "auxiliary",          # ます, たい, られる, させる, そうだ, らしい ...
    "sentence_pattern",   # 〜ている, 〜なければならない, 〜ことができる ...
    "conjunction",        # ので, けど, のに, たら, ば, ながら ...
    "honorific",          # 尊敬語, 謙譲語, お〜になる ...
    "nominalizer",        # の, こと, もの ...
    "other",
]

_TOKEN = {
    "type": "object",
    "properties": {
        "surface": {"type": "string", "description": "Exactly as written in the sentence."},
        "reading": {"type": "string", "description": "Hiragana reading of the surface form."},
        "romaji": {"type": "string"},
        "part_of_speech": {"type": "string", "description": "e.g. noun, verb, i-adjective, particle, auxiliary verb, punctuation."},
        "base_form": {"type": "string", "description": "Dictionary form; same as surface if it does not inflect."},
        "gloss": {"type": "string", "description": "Short English meaning of this token in context."},
    },
    "required": ["surface", "reading", "romaji", "part_of_speech", "base_form", "gloss"],
    "additionalProperties": False,
}

_EXAMPLE = {
    "type": "object",
    "properties": {
        "japanese": {"type": "string"},
        "english": {"type": "string"},
    },
    "required": ["japanese", "english"],
    "additionalProperties": False,
}

_GRAMMAR_POINT = {
    "type": "object",
    "properties": {
        "pattern": {"type": "string", "description": "Canonical dictionary-style pattern, e.g. 〜ている, 〜ので, が."},
        "name": {"type": "string", "description": "Short English name, e.g. 'Progressive / ongoing state'."},
        "category": {"type": "string", "enum": CATEGORIES},
        "jlpt": {"type": "string", "enum": JLPT_LEVELS},
        "matched_text": {"type": "string", "description": "The exact text in this sentence that realises the pattern."},
        "token_indices": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "Indices into tokens[] that make up matched_text.",
        },
        "meaning": {"type": "string", "description": "One-line meaning of the pattern in general."},
        "explanation": {"type": "string", "description": "What it does in this particular sentence and why this form was chosen."},
        "formation": {"type": "string", "description": "How the pattern attaches, e.g. 'Verb て-form + いる'."},
        "example": _EXAMPLE,
    },
    "required": [
        "pattern", "name", "category", "jlpt", "matched_text", "token_indices",
        "meaning", "explanation", "formation", "example",
    ],
    "additionalProperties": False,
}

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "sentence": {"type": "string"},
        "reading": {"type": "string", "description": "Whole sentence in hiragana."},
        "romaji": {"type": "string"},
        "translation": {"type": "string", "description": "Natural English translation."},
        "literal_translation": {"type": "string", "description": "Word-order-faithful gloss that shows the structure."},
        "structure": {"type": "string", "description": "How the clauses fit together, omitted subjects, register."},
        "tokens": {"type": "array", "items": _TOKEN},
        "grammar_points": {"type": "array", "items": _GRAMMAR_POINT},
    },
    "required": [
        "sentence", "reading", "romaji", "translation", "literal_translation",
        "structure", "tokens", "grammar_points",
    ],
    "additionalProperties": False,
}


def validate(analysis):
    """Return a list of problems with an analysis; empty means it is usable.

    Structured output already guarantees the JSON shape, so this mostly checks
    the things a schema cannot: that the tokens really spell the sentence and
    that every grammar point points at tokens that exist.
    """
    problems = []
    for key in ANALYSIS_SCHEMA["required"]:
        if key not in analysis:
            problems.append(f"missing field: {key}")
    if problems:
        return problems

    tokens = analysis["tokens"]
    joined = "".join(t["surface"] for t in tokens)
    if _squash(joined) != _squash(analysis["sentence"]):
        problems.append(f"tokens spell {joined!r}, not the sentence")

    for n, gp in enumerate(analysis["grammar_points"]):
        bad = [i for i in gp["token_indices"] if not 0 <= i < len(tokens)]
        if bad:
            problems.append(f"grammar point {n} ({gp['pattern']}) points at missing tokens {bad}")
        if gp["jlpt"] not in JLPT_LEVELS:
            problems.append(f"grammar point {n} has unknown JLPT level {gp['jlpt']!r}")
    return problems


def _squash(text):
    return "".join(text.split())
