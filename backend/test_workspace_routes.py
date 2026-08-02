"""Contract tests for recoverable workspace resource APIs."""

import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import public_workspaces, workspace_assets
from backend.main import app


class WorkspaceRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(
            public_workspaces,
            "DB_PATH",
            os.path.join(self.temp_dir.name, "workspaces.db"),
        )
        self.storage_patch = patch.object(
            workspace_assets,
            "PUBLIC_WORKSPACE_STORAGE_DIR",
            os.path.join(self.temp_dir.name, "storage"),
        )
        self.db_patch.start()
        self.storage_patch.start()
        public_workspaces.init_workspace_db()
        workspace_assets.init_workspace_asset_db()
        self.client = TestClient(app)

    def tearDown(self):
        self.storage_patch.stop()
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def create_workspace(self, name="我的评估工作区"):
        response = self.client.post(
            "/api/public/workspaces", json={"name": name}
        )
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        return payload["workspace_id"], payload["access_token"]

    @staticmethod
    def headers(token):
        return {"X-Workspace-Token": token}

    def create_asset(self, workspace_id, token, asset_type, name):
        response = self.client.post(
            f"/api/public/workspaces/{workspace_id}/assets",
            headers=self.headers(token),
            json={"asset_type": asset_type, "name": name},
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def create_text_version(self, workspace_id, token, asset_id, text):
        response = self.client.post(
            f"/api/public/workspaces/{workspace_id}/assets/{asset_id}/versions/text",
            headers=self.headers(token),
            json={"source_kind": "text_freeform", "source_text": text},
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_route_surface_contains_workspace_resources(self):
        routes = {
            (route.path, method)
            for route in app.routes
            for method in (route.methods or set())
        }
        self.assertIn(("/api/public/workspaces", "POST"), routes)
        self.assertIn(("/api/public/workspaces/{workspace_id}", "GET"), routes)
        self.assertIn(
            ("/api/public/workspaces/{workspace_id}/assets", "POST"), routes
        )
        self.assertIn(
            (
                "/api/public/workspaces/{workspace_id}/assets/{asset_id}/versions/text",
                "POST",
            ),
            routes,
        )
        self.assertIn(
            ("/api/public/workspaces/{workspace_id}/scenarios", "POST"), routes
        )

    def test_workspace_secret_is_returned_once_and_required(self):
        workspace_id, token = self.create_workspace()
        created = self.client.get(
            f"/api/public/workspaces/{workspace_id}",
            headers=self.headers(token),
        )
        self.assertEqual(created.status_code, 200, created.text)
        self.assertNotIn("secret_hash", created.text)
        self.assertNotIn("access_token", created.text)
        self.assertEqual(
            self.client.get(f"/api/public/workspaces/{workspace_id}").status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                f"/api/public/workspaces/{workspace_id}",
                headers=self.headers("wrong"),
            ).status_code,
            403,
        )

    def test_text_and_file_versions_are_listed_without_storage_paths(self):
        workspace_id, token = self.create_workspace()
        asset = self.create_asset(workspace_id, token, "basis", "员工处罚制度")
        text_version = self.create_text_version(
            workspace_id, token, asset["id"], "迟到三次给予书面警告。"
        )
        self.assertEqual(text_version["version_number"], 1)

        upload = self.client.post(
            f"/api/public/workspaces/{workspace_id}/assets/{asset['id']}/versions/file",
            headers=self.headers(token),
            files={"file": ("制度.txt", b"late three times: warning", "text/plain")},
        )
        self.assertEqual(upload.status_code, 201, upload.text)
        self.assertEqual(upload.json()["version_number"], 2)

        response = self.client.get(
            f"/api/public/workspaces/{workspace_id}/assets/{asset['id']}/versions",
            headers=self.headers(token),
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([item["version_number"] for item in response.json()], [2, 1])
        self.assertNotIn("source_file_path", response.text)

    def test_scenario_accepts_owned_versions_and_rejects_foreign_versions(self):
        workspace_id, token = self.create_workspace("甲")
        basis = self.create_asset(workspace_id, token, "basis", "处罚制度")
        template = self.create_asset(workspace_id, token, "template", "处罚建议模板")
        basis_version = self.create_text_version(
            workspace_id, token, basis["id"], "按情节给予警告。"
        )
        template_version = self.create_text_version(
            workspace_id, token, template["id"], "输出：事实、依据、建议。"
        )

        scenario = self.client.post(
            f"/api/public/workspaces/{workspace_id}/scenarios",
            headers=self.headers(token),
            json={
                "name": "员工违纪处罚",
                "goal_template": "根据制度给出处罚建议",
                "basis_version_ids": [basis_version["id"]],
                "template_version_ids": [template_version["id"]],
            },
        )
        self.assertEqual(scenario.status_code, 201, scenario.text)

        other_id, other_token = self.create_workspace("乙")
        other_basis = self.create_asset(other_id, other_token, "basis", "其他制度")
        foreign_version = self.create_text_version(
            other_id, other_token, other_basis["id"], "其他内容"
        )
        rejected = self.client.post(
            f"/api/public/workspaces/{workspace_id}/scenarios",
            headers=self.headers(token),
            json={
                "name": "越权场景",
                "goal_template": "不应成功",
                "basis_version_ids": [foreign_version["id"]],
                "template_version_ids": [],
            },
        )
        self.assertEqual(rejected.status_code, 403, rejected.text)
        self.assertEqual(rejected.json()["detail"]["code"], "foreign_asset_version")


if __name__ == "__main__":
    unittest.main()
