"""Tests for immutable workspace assets, versions, and scenarios."""

import os
import tempfile
import unittest
from unittest.mock import patch

from backend import public_workspaces, workspace_assets
from backend.workspace_assets import WorkspaceAssetSource


class WorkspaceAssetTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(
            public_workspaces,
            "DB_PATH",
            os.path.join(self.temp_dir.name, "assets.db"),
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
        self.workspace, _ = public_workspaces.create_workspace("测试工作区")

    def tearDown(self):
        self.storage_patch.stop()
        self.db_patch.stop()
        self.temp_dir.cleanup()

    @staticmethod
    def text_source(text: str, kind: str = "text_structured"):
        return WorkspaceAssetSource(source_kind=kind, source_text=text)

    def test_asset_versions_are_append_only(self):
        asset = workspace_assets.create_asset(
            self.workspace["id"], "basis", "员工手册", tags=["人事"]
        )

        version_1 = workspace_assets.add_asset_version(
            asset["id"], self.text_source("第一版")
        )
        version_2 = workspace_assets.add_asset_version(
            asset["id"], self.text_source("第二版")
        )

        self.assertEqual(
            (version_1["version_number"], version_2["version_number"]), (1, 2)
        )
        self.assertEqual(
            workspace_assets.get_asset_version(version_1["id"])["source_text"],
            "第一版",
        )
        current = workspace_assets.get_asset(asset["id"])
        self.assertEqual(current["current_version_id"], version_2["id"])

    def test_file_version_is_copied_inside_workspace_boundary(self):
        source_path = os.path.join(self.temp_dir.name, "standard.txt")
        with open(source_path, "w", encoding="utf-8") as stream:
            stream.write("处罚标准")
        asset = workspace_assets.create_asset(
            self.workspace["id"], "basis", "处罚标准"
        )

        version = workspace_assets.add_asset_version(
            asset["id"],
            WorkspaceAssetSource(
                source_kind="file",
                file_path=source_path,
                original_name="处罚标准.txt",
                mime_type="text/plain",
            ),
        )

        root = os.path.abspath(workspace_assets.PUBLIC_WORKSPACE_STORAGE_DIR)
        stored = os.path.abspath(version["source_file_path"])
        self.assertEqual(os.path.commonpath([root, stored]), root)
        with open(stored, encoding="utf-8") as stream:
            self.assertEqual(stream.read(), "处罚标准")

    def test_list_assets_filters_soft_deleted_and_type(self):
        basis = workspace_assets.create_asset(
            self.workspace["id"], "basis", "员工手册"
        )
        workspace_assets.create_asset(
            self.workspace["id"], "template", "处罚决定书"
        )
        workspace_assets.delete_asset(basis["id"], self.workspace["id"])

        self.assertEqual(workspace_assets.list_assets(self.workspace["id"], "basis"), [])
        self.assertEqual(
            [item["name"] for item in workspace_assets.list_assets(self.workspace["id"])],
            ["处罚决定书"],
        )

    def test_scenario_rejects_versions_from_another_workspace(self):
        foreign, _ = public_workspaces.create_workspace("其他工作区")
        foreign_asset = workspace_assets.create_asset(
            foreign["id"], "basis", "其他制度"
        )
        foreign_version = workspace_assets.add_asset_version(
            foreign_asset["id"], self.text_source("其他内容")
        )

        with self.assertRaises(PermissionError):
            workspace_assets.create_scenario(
                self.workspace["id"],
                "员工处罚",
                "按制度评估",
                [foreign_version["id"]],
                [],
            )

    def test_scenario_preserves_selected_version_ids(self):
        basis = workspace_assets.create_asset(
            self.workspace["id"], "basis", "员工手册"
        )
        template = workspace_assets.create_asset(
            self.workspace["id"], "template", "处罚单"
        )
        basis_version = workspace_assets.add_asset_version(
            basis["id"], self.text_source("不得迟到")
        )
        template_version = workspace_assets.add_asset_version(
            template["id"], self.text_source("处罚结果：______")
        )

        scenario = workspace_assets.create_scenario(
            self.workspace["id"],
            "员工处罚",
            "根据制度提出处罚建议",
            [basis_version["id"]],
            [template_version["id"]],
        )

        self.assertEqual(scenario["basis_version_ids_json"], [basis_version["id"]])
        self.assertEqual(
            scenario["template_version_ids_json"], [template_version["id"]]
        )


if __name__ == "__main__":
    unittest.main()
