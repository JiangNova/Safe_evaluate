import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import sys
import threading
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parent))
import local_preview


class HealthHandler(BaseHTTPRequestHandler):
    status_value = "ok"

    def do_GET(self):
        body = json.dumps({"status": self.status_value}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


class LocalPreviewTests(unittest.TestCase):
    def test_find_available_port_skips_an_occupied_port(self):
        occupied = socket.socket()
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        try:
            preferred = occupied.getsockname()[1]
            selected = local_preview.find_available_port(
                preferred,
                attempts=10,
            )
            self.assertGreater(selected, preferred)
        finally:
            occupied.close()

    def test_backend_state_reports_free(self):
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        self.assertEqual(local_preview.backend_state(port=port), "free")

    def test_backend_state_reuses_only_a_healthy_backend(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_address[1]
            self.assertEqual(
                local_preview.backend_state(port=port),
                "healthy",
            )
            HealthHandler.status_value = "not-ok"
            self.assertEqual(
                local_preview.backend_state(port=port),
                "occupied",
            )
        finally:
            HealthHandler.status_value = "ok"
            server.shutdown()
            server.server_close()
            thread.join()

    def test_wait_for_url_times_out_cleanly(self):
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        self.assertFalse(
            local_preview.wait_for_url(
                f"http://127.0.0.1:{port}/",
                timeout=0.05,
            )
        )


if __name__ == "__main__":
    unittest.main()
