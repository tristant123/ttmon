"""Ask Claude to break a Japanese sentence into tokens and grammar points."""

import json
import os
from pathlib import Path

from .schema import ANALYSIS_SCHEMA, validate

MODEL = os.environ.get("NIHONGO_MODEL", "claude-opus-5-5")
EFFORTS = ("low", "medium", "high", "xhigh", "max")
MAX_SENTENCE_CHARS = 400
NO_CREDENTIALS = ("No valid Anthropic credentials. Set ANTHROPIC_API_KEY "
                  "(or use --demo to try the app offline).")

SYSTEM_PROMPT = """\
You are a Japanese grammar teacher. A learner gives you one Japanese sentence
(occasionally two or three short ones). Break it down so they can see exactly
how it is built.

Tokens
- Split the sentence into tokens that, concatenated in order, reproduce the
  input exactly, punctuation included. Keep inflected words split the way a
  teacher would explain them: 食べ + させ + られ + ました, 行か + なかった,
  持って + いる. A particle is always its own token.
- Give each token its hiragana reading, romaji (Hepburn), part of speech, the
  dictionary form, and a short gloss for its meaning here.

Grammar points
- List every grammar point in the sentence, in the order they appear. Be
  exhaustive: basic particles (は, が, を, に, で, の, と, も, へ, から, まで),
  conjugations (て-form, た-form, negative, potential, passive, causative,
  volitional, conditional forms), auxiliaries (ます, たい, です, だ, そうだ,
  らしい, ようだ), set patterns (〜ている, 〜てしまう, 〜なければならない,
  〜ことができる, 〜と思う, 〜ようにする ...), conjunctions and clause
  linkers (ので, から, けど, のに, たら, ば, ながら), nominalisers,
  sentence-final particles (ね, よ, か, な), relative clauses, counters and
  keigo. A beginner should not find anything in the sentence left unexplained.
- When patterns nest (〜ていた is 〜ている in the past), give each layer its
  own entry if a learner would need to know both.
- matched_text must be the exact characters from this sentence, and
  token_indices must list the tokens that make it up.
- meaning is the general meaning of the pattern. explanation says what it is
  doing in this sentence and why the speaker chose it (nuance, politeness,
  what would change with a different form).
- formation says how the pattern attaches (e.g. "Verb て-form + いる").
- jlpt is the level at which the pattern is usually taught; use "none" for
  things outside the JLPT syllabus.
- The example must be a new, simple sentence using the same pattern, not the
  input sentence.

Sentence level
- translation is natural English. literal_translation follows Japanese word
  order closely enough to show the structure.
- structure explains how the clauses fit together, what subject or object is
  omitted and understood, and the register (casual, polite, formal, keigo).

If the input contains a mistake, analyse what was written and point out the
mistake in structure. Write all explanations in English for an English-speaking
learner.
"""


class AnalysisError(Exception):
    """Something went wrong that the learner should be told about."""


def analyze(sentence, client=None, effort="medium"):
    """Return an analysis dict (see schema.ANALYSIS_SCHEMA) for one sentence."""
    sentence = sentence.strip()
    if not sentence:
        raise AnalysisError("Type a Japanese sentence first.")
    if len(sentence) > MAX_SENTENCE_CHARS:
        raise AnalysisError(f"That is too long; keep it under {MAX_SENTENCE_CHARS} characters.")
    if effort not in EFFORTS:
        raise AnalysisError(f"effort must be one of {', '.join(EFFORTS)}")

    import anthropic  # only needed for live analysis, not for the demo or tests

    client = client or anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            # If a safety classifier declines, let the API retry on its
            # recommended fallback model instead of failing outright.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=[{"type": "text", "text": SYSTEM_PROMPT,
                     "cache_control": {"type": "ephemeral"}}],
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": ANALYSIS_SCHEMA},
            },
            messages=[{"role": "user", "content": sentence}],
        )
    except anthropic.AuthenticationError:
        raise AnalysisError(NO_CREDENTIALS)
    except TypeError as e:
        # The SDK raises TypeError, not an API error, when no credentials exist at all.
        if "authentication" in str(e):
            raise AnalysisError(NO_CREDENTIALS)
        raise
    except anthropic.RateLimitError:
        raise AnalysisError("Rate limited by the API; wait a moment and try again.")
    except anthropic.APIStatusError as e:
        raise AnalysisError(f"The API returned an error ({e.status_code}): {e.message}")
    except anthropic.APIConnectionError:
        raise AnalysisError("Could not reach the Anthropic API. Check your connection.")

    if response.stop_reason == "refusal":
        raise AnalysisError("The model declined to analyse that sentence.")
    if response.stop_reason == "max_tokens":
        raise AnalysisError("The analysis ran too long. Try a shorter sentence.")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AnalysisError("The model returned no analysis.")
    try:
        analysis = json.loads(text)
    except json.JSONDecodeError:
        raise AnalysisError("The model returned malformed JSON.")

    analysis["warnings"] = validate(analysis)
    return analysis


def demo_analysis():
    """A canned analysis so the app can be tried without an API key."""
    path = Path(__file__).with_name("demo.json")
    analysis = json.loads(path.read_text(encoding="utf-8"))
    analysis["warnings"] = validate(analysis)
    analysis["demo"] = True
    return analysis
