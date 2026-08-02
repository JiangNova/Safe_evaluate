"""Tests for recoverable anonymous workspace persistence."""

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from backend import public_workspaces


class PublicWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(
            public_workspaces,
            "DB_PATH",
            os.path.join(self.temp_dir.name, "workspaces.db"),
        )
        self.db_patch.start()
        public_workspaces.init_workspace_db()

    def tearDown(self):
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def test_create_persists_hash_and_authorize_renews(self):
        workspace, secret = public_workspaces.create_workspace("我的工作区")
        row = public_workspaces._fetch_workspace_row(workspace["id"])

        self.assertNotIn(secret, row["access_secret_hash"])
        self.assertEqual(len(row["access_secret_hash"]), 64)
        before = row["cleanup_after"]

        renewed = public_workspaces.authorize_workspace(workspace["id"], secret)

        self.assertEqual(renewed["name"], "我的工作区")
        self.assertGreaterEqual(renewed["cleanup_after"], before)

    def test_wrong_secret_is_rejected(self):
        workspace, _ = public_workspaces.create_workspace()

        with self.assertRaises(PermissionError):
            public_workspaces.authorize_workspace(workspace["id"], "wrong")

    def test_workspace_in_grace_can_be_recovered_and_renewed(self):
        workspace, secret = public_workspaces.create_workspace()
        now = datetime.now(timezone.utc)
        public_workspaces.update_workspace(
            workspace["id"],
            status="pending_cleanup",
            cleanup_after=now + timedelta(days=5),
        )

        recovered = public_workspaces.authorize_workspace(workspace["id"], secret)

        self.assertEqual(recovered["status"], "active")
        self.assertGreater(
            datetime.fromisoformat(recovered["cleanup_after"]),
            now + timedelta(days=300),
        )

    def test_expired_grace_is_rejected(self):
        workspace, secret = public_workspaces.create_workspace()
        public_workspaces.update_workspace(
            workspace["id"],
            status="pending_cleanup",
            cleanup_after="2000-01-01T00:00:00+00:00",
        )

        with self.assertRaises(PermissionError):
            public_workspaces.authorize_workspace(workspace["id"], secret)

    def test_list_expired_and_delete_are_idempotent(self):
        expired, _ = public_workspaces.create_workspace("expired")
        active, _ = public_workspaces.create_workspace("active")
        public_workspaces.update_workspace(
            expired["id"],
            status="pending_cleanup",
            cleanup_after="2000-01-01T00:00:00+00:00",
        )

        ids = public_workspaces.list_expired_workspace_ids(
            datetime(2026, 8, 2, tzinfo=timezone.utc)
        )
        public_workspaces.delete_workspace(expired["id"])
        public_workspaces.delete_workspace(expired["id"])

        self.assertEqual(ids, [expired["id"]])
        self.assertIsNone(public_workspaces.get_workspace(expired["id"]))
        self.assertIsNotNone(public_workspaces.get_workspace(active["id"]))


if __name__ == "__main__":
    unittest.main()
