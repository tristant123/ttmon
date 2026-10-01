"""Command line entry point.

    python -m nihongo                   # start the app and open it in the browser
    python -m nihongo serve [--port 8000] [--open] [--engine offline|claude]
    python -m nihongo "雨が降っていたので、傘を持って出かけました。"
    python -m nihongo --json "..."      # raw JSON instead of the text report

The default engine is offline and free. --engine claude uses the Anthropic API
instead (needs an API key; usage is billed).
"""

import argparse
import json
import sys

from .analyzer import EFFORTS, AnalysisError, analyze, demo_analysis
from .offline import analyze_offline

ENGINE_HELP = "offline (default, free) or claude (Anthropic API, billed)"


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    # Windows pipes default to a legacy code page that cannot print Japanese.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    if not argv:  # double-clicked: any free port, straight into the browser
        argv = ["serve", "--port", "0", "--open"]
    if argv[:1] == ["serve"]:
        p = argparse.ArgumentParser(prog="python -m nihongo serve")
        p.add_argument("--host", default="127.0.0.1")
        p.add_argument("--port", type=int, default=8000)
        p.add_argument("--demo", action="store_true", help="no API calls; always show the sample analysis")
        p.add_argument("--engine", choices=("offline", "claude"), default="offline", help=ENGINE_HELP)
        p.add_argument("--effort", choices=EFFORTS, default="medium", help="Claude engine only")
        p.add_argument("--open", action="store_true", help="open the page in your browser")
        args = p.parse_args(argv[1:])
        from .server import serve
        serve(args.host, args.port, demo=args.demo, effort=args.effort, engine=args.engine,
              open_browser=args.open)
        return 0

    p = argparse.ArgumentParser(prog="python -m nihongo",
                                description="Break a Japanese sentence into its grammar points.")
    p.add_argument("sentence", nargs="?", help="omit with --demo")
    p.add_argument("--json", action="store_true", help="print the raw analysis JSON")
    p.add_argument("--demo", action="store_true", help="show the sample analysis without calling the API")
    p.add_argument("--engine", choices=("offline", "claude"), default="offline", help=ENGINE_HELP)
    p.add_argument("--effort", choices=EFFORTS, default="medium", help="Claude engine only")
    args = p.parse_args(argv)
    if not args.demo and not args.sentence:
        p.error("give a sentence, or use --demo")

    try:
        if args.demo:
            result = demo_analysis()
        elif args.engine == "claude":
            result = analyze(args.sentence, effort=args.effort)
        else:
            result = analyze_offline(args.sentence)
    except AnalysisError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_report(result))
    return 0


def format_report(a):
    lines = [a["sentence"], a["reading"], a["romaji"], ""]
    if a["translation"]:
        lines += [f"Translation: {a['translation']}", f"Literally:   {a['literal_translation']}"]
    else:
        lines += [f"Word by word: {a['literal_translation']}"]
    lines += ["", a["structure"]]
    if a.get("phrases"):
        lines += ["", "Phrase by phrase", "----------------"]
        for ph in a["phrases"]:
            gps = ", ".join(a["grammar_points"][k]["pattern"] for k in ph["grammar"])
            lines.append(f"  {ph['text']}  ({ph['role']})" + (f"  ← {gps}" if gps else ""))
    lines += ["", "Grammar points", "--------------"]
    for n, gp in enumerate(a["grammar_points"], 1):
        lines += [
            f"{n}. {gp['pattern']}  [{gp['jlpt']}, {gp['category'].replace('_', ' ')}]  {gp['name']}",
            f"   in this sentence: {gp['matched_text']}",
            f"   meaning:     {gp['meaning']}",
            f"   here:        {gp['explanation']}",
            f"   formation:   {gp['formation']}",
            f"   example:     {gp['example']['japanese']}  ({gp['example']['english']})",
        ]
        if gp.get("lookup_url"):
            lines.append(f"   more:        {gp['lookup_url']}")
        lines += [
            "",
        ]
    lines += ["Words", "-----"]
    for t in a["tokens"]:
        if t["part_of_speech"] == "punctuation":
            continue
        lines.append(f"  {t['surface']}\t{t['reading']}\t{t['part_of_speech']}\t{t['gloss']}")
    for w in a.get("warnings", []):
        lines.append(f"warning: {w}")
    if a.get("attribution"):
        lines += ["", a["attribution"]]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
