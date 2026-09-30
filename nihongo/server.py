"""A tiny local web server.

    GET  /              the page
    GET  /api/status    the engine in use, and whether it still needs an API key
    POST /api/key       {"key": "sk-ant-..."} saves a key (Claude engine only)
    POST /api/analyze   {"sentence": "..."} returns an analysis
"""

import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import config
from .analyzer import AnalysisError, analyze, demo_analysis
from .offline import analyze_offline

ENGINES = {"offline": analyze_offline, "claude": analyze}

STATIC = Path(__file__).with_name("static")


def make_handler(demo=False, effort="medium", engine="offline", analyze_fn=None):
    analyze_fn = analyze_fn or ENGINES[engine]
    needs_key = engine == "claude" and not demo

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/", "/index.html"):
                body = (STATIC / "index.html").read_bytes()
                self._send(200, body, "text/html; charset=utf-8")
            elif self.path == "/api/status":
                self._send_json(200, {"demo": demo, "engine": engine,
                                      "has_key": not needs_key or config.has_key()})
            else:
                self._send_json(404, {"error": "not found"})

        def do_POST(self):
            if self.path not in ("/api/analyze", "/api/key"):
                return self._send_json(404, {"error": "not found"})
            # The page is only ever served from here, so a cross-site request
            # (another website poking at this port) is refused outright.
            origin = self.headers.get("Origin")
            if origin and origin != f"http://{self.headers.get('Host')}":
                return self._send_json(403, {"error": "cross-origin request refused"})
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self._send_json(400, {"error": "Send a JSON object."})

            if self.path == "/api/key":
                try:
                    config.save_api_key(body.get("key"))
                except ValueError as e:
                    return self._send_json(422, {"error": str(e)})
                except OSError as e:
                    return self._send_json(500, {"error": f"Could not save the key: {e}"})
                return self._send_json(200, {"has_key": True})

            try:
                sentence = str(body.get("sentence", ""))
                result = demo_analysis() if demo else analyze_fn(sentence, effort=effort)
            except AnalysisError as e:
                return self._send_json(422, {"error": str(e)})
            self._send_json(200, result)

        def _send_json(self, status, obj):
            self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                       "application/json; charset=utf-8")

        def _send(self, status, body, content_type):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):
            pass  # keep the terminal quiet

    return Handler


def serve(host="127.0.0.1", port=8000, demo=False, effort="medium", engine="offline",
          open_browser=False):
    """Serve until Ctrl+C. port=0 picks any free port."""
    server = ThreadingHTTPServer((host, port), make_handler(demo=demo, effort=effort, engine=engine))
    url = f"http://{host}:{server.server_address[1]}/"
    mode = (" (demo mode: every request returns the sample analysis)" if demo
            else " (using Claude; API charges apply)" if engine == "claude"
            else " (offline: free, nothing leaves this computer)")
    print(f"Japanese grammar analyzer running at {url}{mode}")
    print("Close this window or press Ctrl+C to stop.", flush=True)
    if open_browser:
        threading.Timer(0.3, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
