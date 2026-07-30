"""Local same-origin preview for AGULAB and both evaluation platforms.

This helper mirrors the production Nginx path split without changing the
online server. It binds to localhost only and proxies /api/* to port 8000.
"""

from __future__ import annotations

import argparse
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEBSITE_DIST = (PROJECT_ROOT / "website" / "dist").resolve()
PUBLIC_DIST = (PROJECT_ROOT / "frontend-public" / "dist").resolve()
TIANXIN_DIST = (PROJECT_ROOT / "frontend" / "dist").resolve()


def classify_path(path: str) -> tuple[str, str]:
    """Return the frontend build and relative file for a request path."""
    clean_path = path.split("?", 1)[0]
    if clean_path == "/evaluate" or clean_path.startswith("/evaluate/"):
        relative = clean_path.removeprefix("/evaluate").lstrip("/")
        if relative.startswith("assets/"):
            return ("public", relative)
        return ("public", "index.html")
    if (
        clean_path == "/evaluate_tianxin"
        or clean_path.startswith("/evaluate_tianxin/")
    ):
        relative = clean_path.removeprefix("/evaluate_tianxin").lstrip("/")
        if not relative.startswith("assets/"):
            relative = "index.html"
        return ("tianxin", relative or "index.html")
    return ("website", "index.html")


def validate_build_outputs(
    directories=(WEBSITE_DIST, PUBLIC_DIST, TIANXIN_DIST),
) -> None:
    """Stop startup when any frontend build is unavailable."""
    for directory in directories:
        if not (directory / "index.html").is_file():
            raise SystemExit(f"Missing build output: {directory}")


class IntegrationHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle()

    def do_HEAD(self):
        self._handle(send_body=False)

    def do_POST(self):
        self._handle()

    def do_PUT(self):
        self._handle()

    def do_PATCH(self):
        self._handle()

    def do_DELETE(self):
        self._handle()

    def _handle(self, send_body=True):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            self._proxy_api(send_body)
            return

        if path.startswith("/website-static/"):
            relative = path.removeprefix("/website-static/")
            self._serve_file(WEBSITE_DIST / relative, WEBSITE_DIST, send_body)
            return

        if path == "/evaluate":
            self._redirect("/evaluate/")
            return

        if path == "/evaluate_tianxin":
            self._redirect("/evaluate_tianxin/")
            return

        application, relative = classify_path(path)
        if application == "public":
            self._serve_file(PUBLIC_DIST / relative, PUBLIC_DIST, send_body)
            return
        if application == "tianxin":
            self._serve_file(TIANXIN_DIST / relative, TIANXIN_DIST, send_body)
            return

        requested = WEBSITE_DIST / path.lstrip("/")
        candidate = (
            requested
            if path != "/" and requested.is_file()
            else WEBSITE_DIST / "index.html"
        )
        self._serve_file(candidate, WEBSITE_DIST, send_body)

    def _redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _serve_file(self, candidate, allowed_root, send_body):
        resolved = candidate.resolve()
        try:
            resolved.relative_to(allowed_root)
        except ValueError:
            self.send_error(403)
            return
        if not resolved.is_file():
            self.send_error(404)
            return

        content = resolved.read_bytes()
        content_type = mimetypes.guess_type(resolved.name)[0]
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if send_body:
            self.wfile.write(content)

    def _proxy_api(self, send_body):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "content-length", "connection"}
        }
        request = Request(
            f"http://127.0.0.1:8000{self.path}",
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            response = urlopen(request, timeout=310)
        except HTTPError as error:
            response = error
        except OSError as error:
            self.send_error(502, f"Backend unavailable: {error}")
            return

        content = response.read()
        self.send_response(response.status)
        for key, value in response.headers.items():
            if key.lower() not in {
                "connection",
                "content-length",
                "transfer-encoding",
            }:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if send_body:
            self.wfile.write(content)

    def log_message(self, format, *args):
        print(f"[preview] {self.address_string()} {format % args}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    validate_build_outputs()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), IntegrationHandler)
    print(f"Integrated preview: http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
