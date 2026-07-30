import importlib.util
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest


SCRIPT_PATH = Path(__file__).with_name("serve-integration.py")
SPEC = importlib.util.spec_from_file_location("serve_integration", SCRIPT_PATH)
serve_integration = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(serve_integration)

classify_path = serve_integration.classify_path


class RouteClassificationTests(unittest.TestCase):
    def test_routes_three_frontends(self):
        self.assertEqual(classify_path("/"), ("website", "index.html"))
        self.assertEqual(
            classify_path("/evaluate/"),
            ("public", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate/assets/app.js"),
            ("public", "assets/app.js"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/history"),
            ("tianxin", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/assets/app.js"),
            ("tianxin", "assets/app.js"),
        )

    def test_does_not_treat_lookalike_prefix_as_platform(self):
        self.assertEqual(
            classify_path("/evaluate-evil"),
            ("website", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin-evil"),
            ("website", "index.html"),
        )

    def test_nested_routes_fall_back_without_hiding_asset_paths(self):
        self.assertEqual(
            classify_path("/evaluate/future/workflow?step=2"),
            ("public", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/report/test-id?tab=detail"),
            ("tianxin", "index.html"),
        )
        self.assertEqual(
            classify_path("/evaluate/assets/missing.js"),
            ("public", "assets/missing.js"),
        )
        self.assertEqual(
            classify_path("/evaluate_tianxin/assets/missing.js"),
            ("tianxin", "assets/missing.js"),
        )


class BuildOutputGuardTests(unittest.TestCase):
    def test_rejects_a_missing_frontend_build(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            website = root / "website"
            public = root / "public"
            tianxin = root / "tianxin"
            website.mkdir()
            public.mkdir()
            tianxin.mkdir()
            (website / "index.html").write_text("website", encoding="utf-8")
            (public / "index.html").write_text("public", encoding="utf-8")

            with self.assertRaisesRegex(
                SystemExit,
                str(tianxin).replace("\\", r"\\"),
            ):
                serve_integration.validate_build_outputs(
                    (website, public, tianxin),
                )


class IntegrationHandlerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(cls.temporary_directory.name)
        cls.original_directories = (
            serve_integration.WEBSITE_DIST,
            serve_integration.PUBLIC_DIST,
            serve_integration.TIANXIN_DIST,
        )

        serve_integration.WEBSITE_DIST = root / "website"
        serve_integration.PUBLIC_DIST = root / "public"
        serve_integration.TIANXIN_DIST = root / "tianxin"
        for name, directory in (
            ("website", serve_integration.WEBSITE_DIST),
            ("public", serve_integration.PUBLIC_DIST),
            ("tianxin", serve_integration.TIANXIN_DIST),
        ):
            (directory / "assets").mkdir(parents=True)
            (directory / "index.html").write_text(name, encoding="utf-8")
            (directory / "assets" / "app.js").write_text(
                f"{name}-asset",
                encoding="utf-8",
            )

        class TestHandler(serve_integration.IntegrationHandler):
            def _proxy_api(self, send_body):
                self.send_response(204)
                self.send_header("X-Test-Proxy", "backend")
                self.end_headers()

            def log_message(self, format, *args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), TestHandler)
        cls.thread = threading.Thread(
            target=cls.server.serve_forever,
            daemon=True,
        )
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        (
            serve_integration.WEBSITE_DIST,
            serve_integration.PUBLIC_DIST,
            serve_integration.TIANXIN_DIST,
        ) = cls.original_directories
        cls.temporary_directory.cleanup()

    def request(self, path):
        connection = HTTPConnection(
            "127.0.0.1",
            self.server.server_address[1],
        )
        connection.request("GET", path)
        response = connection.getresponse()
        body = response.read().decode("utf-8", errors="replace")
        headers = dict(response.getheaders())
        connection.close()
        return response.status, headers, body

    def test_nested_routes_use_the_correct_spa_shell(self):
        self.assertEqual(
            self.request("/evaluate/future/workflow")[2],
            "public",
        )
        self.assertEqual(
            self.request("/evaluate_tianxin/history")[2],
            "tianxin",
        )

    def test_missing_platform_assets_return_404(self):
        self.assertEqual(
            self.request("/evaluate/assets/missing.js")[0],
            404,
        )
        self.assertEqual(
            self.request("/evaluate_tianxin/assets/missing.js")[0],
            404,
        )

    def test_lookalike_prefixes_stay_on_the_website(self):
        self.assertEqual(self.request("/evaluate-evil")[2], "website")
        self.assertEqual(
            self.request("/evaluate_tianxin-evil")[2],
            "website",
        )

    def test_bare_platform_paths_redirect_to_trailing_slashes(self):
        status, headers, _ = self.request("/evaluate")
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "/evaluate/")
        status, headers, _ = self.request("/evaluate_tianxin")
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "/evaluate_tianxin/")

    def test_bare_website_static_paths_redirect_home(self):
        for path in ("/website-static", "/website-static/"):
            with self.subTest(path=path):
                status, headers, _ = self.request(path)
                self.assertEqual(status, 302)
                self.assertEqual(headers["Location"], "/")

    def test_website_static_assets_are_not_rewritten_to_home(self):
        status, _, body = self.request("/website-static/assets/app.js")
        self.assertEqual(status, 200)
        self.assertEqual(body, "website-asset")
        self.assertEqual(
            self.request("/website-static/assets/missing.js")[0],
            404,
        )

    def test_api_prefix_is_still_proxied(self):
        status, headers, _ = self.request("/api/health")
        self.assertEqual(status, 204)
        self.assertEqual(headers["X-Test-Proxy"], "backend")


if __name__ == "__main__":
    unittest.main()
