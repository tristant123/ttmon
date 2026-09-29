# Japanese Grammar Breakdown

A small app that takes a Japanese sentence, finds every grammar point in it
(particles, conjugations, auxiliaries, set patterns like 〜ている or
〜なければならない, conjunctions, keigo), and explains what each one means
and what it is doing in that sentence.

For each sentence you get:

- the sentence with furigana, a romaji line, a natural translation and a
  literal one that shows the structure
- a note on how the clauses fit together, what is left unsaid, and the register
- one card per grammar point: pattern, JLPT level, general meaning, what it
  does here, how it is formed, and a fresh example sentence. Click a card to
  highlight its words in the sentence.
- a word list with readings, dictionary forms and parts of speech

The analysis comes from Claude (`claude-opus-5-5`) through the Anthropic API.
The reply is constrained to a fixed JSON schema (`schema.py`), then checked to
make sure the words really spell the input and every grammar point points at
real words.

## Running it

Run these from the repository root:

```
pip install -r nihongo/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python -m nihongo serve
```

Then open http://127.0.0.1:8000/.

To try it without an API key, `python -m nihongo serve --demo` serves a
built-in sample analysis for every request.

From the command line:

```
python -m nihongo "日本に来てから、毎日日本語を勉強しています。"
python -m nihongo --json "..."     # raw JSON
python -m nihongo --demo           # sample, no API call
```

`--effort low|medium|high|xhigh|max` trades speed and cost for depth
(the default is `medium`). Set `NIHONGO_MODEL` to use a different model.

## Files

| File | What it does |
|---|---|
| `analyzer.py` | The prompt and the API call |
| `schema.py` | The JSON shape of an analysis, plus `validate()` |
| `server.py` | Local web server: `/` and `POST /api/analyze` |
| `static/index.html` | The whole front end, no build step |
| `demo.json` | The sample analysis used by `--demo` and the tests |
| `__main__.py` | Command line entry point |

## Tests

```
python -m unittest discover -s nihongo/tests -t .
```

The tests use a fake client, so they need no API key or network.
