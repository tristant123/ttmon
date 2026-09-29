"""Where the API key comes from, so the .exe works without setting env vars.

ANTHROPIC_API_KEY in the environment wins. Otherwise the key the user pasted
into the page is kept in their own settings folder (never next to the .exe,
which people copy around and share):

    Windows: %APPDATA%\\NihongoGrammar\\config.json
    others:  ~/.config/nihongo-grammar/config.json
"""

import json
import os
from pathlib import Path


def config_path():
    if os.environ.get("NIHONGO_CONFIG"):
        return Path(os.environ["NIHONGO_CONFIG"])
    if os.name == "nt" and os.environ.get("APPDATA"):
        return Path(os.environ["APPDATA"]) / "NihongoGrammar" / "config.json"
    base = os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config"
    return Path(base) / "nihongo-grammar" / "config.json"


def saved_api_key():
    try:
        return json.loads(config_path().read_text(encoding="utf-8")).get("api_key") or None
    except (OSError, ValueError, AttributeError):
        return None


def api_key():
    """The key to use, or None to let the SDK find credentials its own way."""
    return os.environ.get("ANTHROPIC_API_KEY") or saved_api_key()


def has_key():
    return bool(api_key() or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def save_api_key(key):
    key = (key or "").strip()
    if not key.startswith("sk-ant-"):
        raise ValueError("That doesn't look like an Anthropic API key (they start with sk-ant-).")
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"api_key": key}), encoding="utf-8")
    try:
        path.chmod(0o600)  # owner-only where the OS supports it
    except OSError:
        pass
