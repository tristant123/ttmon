# Japanese Grammar Breakdown

A small app that takes a Japanese sentence, finds the grammar points in it
(particles, conjugations, auxiliaries, set patterns like 〜ている or
〜なければならない, conjunctions, keigo), and explains what each one means
and what it is doing in that sentence.

**It is free and runs entirely on your computer.** No account, no API key,
no internet connection needed, and nothing you type is sent anywhere.

For each sentence you get:

- the sentence with furigana, a romaji line, and a word-by-word gloss
- **phrase by phrase**: the sentence split into its phrases (雨が / 降っていたので /
  傘を / 持って / 出かけました), what each one does (subject, object, reason
  clause, main predicate …), and the grammar points inside it
- one card per grammar point, from N5 to N1: pattern, JLPT level, meaning,
  what it does in this sentence, how it is formed, an example sentence, and a
  link to look it up on Bunpro. Click a card or a phrase to highlight it.
- a note on the register (plain, polite, keigo) and the kind of sentence
- a word list with readings, dictionary forms, parts of speech and meanings

## How it works

1. [Janome](https://github.com/mocobeta/janome), a Japanese morphological
   analyzer written in Python, splits the sentence into words and tells us
   each word's part of speech, conjugation form, dictionary form and reading.
2. **A grammar library of about 400 points**, organised by JLPT level the way
   Bunpro's is, is matched against the whole sentence. Points are written as
   patterns, the way textbooks write them:

   ```
   {V-te} いる                    Verb て-form + いる
   {PLAIN|N} にもかかわらず         plain form or noun + にもかかわらず
   たとえ … ても                    a pattern in two parts
   ```

   So 〜にもかかわらず is found as one grammar point, not as に + も + かかわる +
   ず. Smaller pieces inside a bigger pattern are folded into it.
3. Word meanings come from [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html),
   the free Japanese–English dictionary, bundled as `data/jmdict.sqlite.gz`.

The explanations are written for this app. Bunpro's own explanations are
their copyrighted content, so each card links to a Bunpro search for the
pattern instead of copying them.

### How it is checked

- Every grammar point must be found in its own example sentence (tested for
  all ~410).
- A second set of sentences, different from the examples, checks that the
  patterns work in new sentences.
- A set of look-alikes checks that nothing fires where it shouldn't: 駅の前に
  ("in front of the station") is not 〜前に ("before"), 上がる is not 〜がる,
  思い出す ("recall") is not 〜出す ("start to").

### Limits, compared with an AI model

- **No full-sentence translation.** You get a word-by-word gloss instead.
- **It only knows the patterns in its library.** It covers the common grammar
  from N5 to N1, but not every point in Bunpro's library, and not idioms or
  slang.
- **Explanations of what a point does "here" are partly templates.**
- **The word splitter sometimes guesses wrong**, and then a pattern can be
  missed. Examples: it reads 降りそう as 降りる "get off" rather than 降る
  "fall", and 誰かいますか as containing 飼う "keep (a pet)".
- Some patterns mean different things in different contexts (〜によって is
  "by", "depending on" or "due to"); the card gives all the meanings.

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
| `grammar.py` | Core grammar rules (particles, conjugations, te-form patterns …) |
| `catalog/n5.py` … `catalog/n1.py` | The grammar library, one file per JLPT level |
| `patterns.py` | The pattern language the library is written in |
| `phrases.py` | Splits the sentence into phrases and gives each a role |
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
