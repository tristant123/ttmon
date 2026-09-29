"""A tiny local web server: the page at /, the analysis at POST /api/analyze."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .analyzer import AnalysisError, analyze, demo_analysis

STATIC = Path(__file__).with_name("static")


def make_handler(demo=False, effort="medium", analyze_fn=analyze):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/", "/index.html"):
                body = (STATIC / "index.html").read_bytes()
                self._send(200, body, "text/html; charset=utf-8")
            else:
                self._send_json(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/api/analyze":
                return self._send_json(404, {"error": "not found"})
            try:
                length = int(self.headers.get("Content-Length", 0))
                sentence = json.loads(self.rfile.read(length) or b"{}").get("sentence", "")
            except (ValueError, AttributeError):
                return self._send_json(400, {"error": "Send JSON like {\"sentence\": \"...\"}."})
            try:
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
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):
            pass  # keep the terminal quiet

    return Handler


def serve(host="127.0.0.1", port=8000, demo=False, effort="medium"):
    server = ThreadingHTTPServer((host, port), make_handler(demo=demo, effort=effort))
    mode = " (demo mode: every request returns the sample analysis)" if demo else ""
    print(f"Japanese grammar analyzer running at http://{host}:{port}/{mode}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
