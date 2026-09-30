# Japanese Grammar Breakdown

A small app that takes a Japanese sentence, finds the grammar points in it
(particles, conjugations, auxiliaries, set patterns like 〜ている or
〜なければならない, conjunctions, keigo), and explains what each one means
and what it is doing in that sentence.

**It is free and runs entirely on your computer.** No account, no API key,
no internet connection needed, and nothing you type is sent anywhere.

For each sentence you get:

- the sentence with furigana, a romaji line, and a word-by-word gloss
- a note on the register (plain, polite, keigo), the kind of sentence
  (statement, question, invitation, request), how the clauses are joined,
  and what is left unsaid
- one card per grammar point: pattern, JLPT level, general meaning, what it
  does here, how it is formed, and an example sentence. Click a card to
  highlight its words in the sentence.
- a word list with readings, dictionary forms, parts of speech and meanings

## How it works

1. [Janome](https://github.com/mocobeta/janome), a Japanese morphological
   analyzer written in Python, splits the sentence into words and tells us
   each word's part of speech, conjugation form, dictionary form and reading.
2. A catalog of about 130 grammar patterns (`grammar.py`) is matched against
   those words. Each pattern carries its own explanation.
3. Word meanings come from [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html),
   the free Japanese–English dictionary, bundled as `data/jmdict.sqlite.gz`.

### Limits, compared with an AI model

- **No full-sentence translation.** You get a word-by-word gloss instead.
- **It only knows the patterns in its catalog.** Common N5–N3 grammar is
  covered well; rarer N2/N1 patterns, idioms and slang may be missed.
- **Explanations are templates**, not written for your exact sentence.
- **The word splitter sometimes guesses wrong**, especially on casual or
  unusual spellings (it reads 降りそう as 降りる "get off" rather than 降る
  "fall", for example).

## Running it

### As a single .exe (Windows)

Double-click `NihongoGrammar.exe`. It opens the app in your browser. To
quit, close the black console window that opens with it. Python doesn't need
to be installed. The first run takes a second longer while it unpacks its
dictionary into `%LOCALAPPDATA%\NihongoGrammar`.

There are two ways to get the .exe:

- **Download it from GitHub.** Every push that touches the app builds it on
  Windows. Open the latest "nihongo" run under the repository's Actions tab,
  scroll to Artifacts, and download `NihongoGrammar-windows`.
- **Build it yourself** on a Windows machine with Python 3.9+: run
  `build_nihongo_windows.bat` from the repository root. It installs what it
  needs, runs the tests, and writes `dist\NihongoGrammar.exe`.

Windows SmartScreen may warn about an unsigned app the first time; choose
"More info" then "Run anyway".

### From source

Run these from the repository root:

```
pip install -r nihongo/requirements.txt
python -m nihongo
```

That starts the app on a free port and opens your browser, the same as the
.exe. `python -m nihongo serve` runs it on http://127.0.0.1:8000/ without
opening a browser.

From the command line:

```
python -m nihongo "日本に来てから、毎日日本語を勉強しています。"
python -m nihongo --json "..."     # raw JSON
```

### Optional: Claude engine (paid)

The app can also send sentences to Claude through the Anthropic API, which
gives natural translations and explanations written for each sentence. This
costs money per use and needs an API key, so it is off unless you ask for it:

```
pip install anthropic
python -m nihongo serve --engine claude
```

The page then asks for your key once and saves it in your user settings
folder. The .exe does not include this engine.

## Files

| File | What it does |
|---|---|
| `offline.py` | The free engine: tokenizes, matches grammar, builds the analysis |
| `grammar.py` | The grammar pattern catalog |
| `dictionary.py` | Word meanings from the bundled JMdict file |
| `kana.py` | Hiragana and romaji conversion |
| `analyzer.py` | The optional Claude engine |
| `schema.py` | The JSON shape of an analysis, plus `validate()` |
| `server.py` | Local web server: the page, the analysis, and key setup |
| `config.py` | Where a Claude API key is read from and saved to |
| `static/index.html` | The whole front end, no build step |
| `demo.json` | A sample analysis used by the tests |
| `tools/build_dict.py` | Rebuilds `data/jmdict.sqlite.gz` from JMdict |
| `__main__.py` | Command line entry point |
| `../nihongo_app.py`, `../NihongoGrammar.spec` | Entry point and PyInstaller recipe for the .exe |
| `../build_nihongo_windows.bat` | One-click Windows build |

## Tests

```
python -m unittest discover -s nihongo/tests -t .
```

They need no network. The two Claude-engine tests are skipped unless the
`anthropic` package is installed, and even then they use a fake client.

## Credits

Word meanings: JMdict, © the Electronic Dictionary Research and Development
Group, used under the [Creative Commons Attribution-ShareAlike 4.0
licence](https://www.edrdg.org/edrdg/licence.html). The derived file
`data/jmdict.sqlite.gz` is under the same licence.

Word splitting: Janome (Apache 2.0), which includes the IPADIC dictionary.
