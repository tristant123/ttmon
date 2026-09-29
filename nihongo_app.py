"""Entry point for the NihongoGrammar executable (see NihongoGrammar.spec).

Double-clicked, it starts the app on a free local port and opens it in the
browser. Given arguments, it behaves like `python -m nihongo`.
"""

import sys

from nihongo.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
