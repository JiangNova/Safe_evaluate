"""Contract tests for the anonymous public evaluation API."""

import unittest

from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)
BLOCKED_PUBLIC_TERMS = ("天心区", "公安分局", "派出所")


class PublicApiContractTests(unittest.TestCase):
    def test_public_route_surface_is_narrow(self):
        routes = {
            (route.path, method)
            for route in app.routes
            for method in (route.methods or set())
        }

        self.assertIn(("/api/public/evaluate", "POST"), routes)
        self.assertIn(("/api/public/rules", "GET"), routes)
        self.assertIn(("/api/public/reports/{report_id}", "GET"), routes)
        self.assertIn(
            (
                "/api/public/reports/{report_id}/images/{image_index}",
                "GET",
            ),
            routes,
        )
        self.assertNotIn(("/api/public/reports", "GET"), routes)
        self.assertNotIn(("/api/public/stats", "GET"), routes)

    def test_public_rules_are_builtin_and_neutral(self):
        response = client.get("/api/public/rules")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total"], len(payload["items"]))
        self.assertTrue(payload["items"])
        self.assertTrue(
            all(not item["is_custom"] for item in payload["items"])
        )
        self.assertTrue(
            all(
                term not in str(item)
                for item in payload["items"]
                for term in BLOCKED_PUBLIC_TERMS
            )
        )

    def test_internal_collections_remain_authenticated(self):
        self.assertIn(client.get("/api/reports").status_code, (401, 403))
        self.assertIn(client.get("/api/stats").status_code, (401, 403))


if __name__ == "__main__":
    unittest.main()
