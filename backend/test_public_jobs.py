"""Tests for anonymous public evaluation job persistence."""

import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend import public_jobs


class PublicJobStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "public-jobs.db")
        self.db_patch = patch.object(public_jobs, "DB_PATH", self.db_path)
        self.db_patch.start()
        public_jobs.init_public_job_db()

    def tearDown(self):
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def test_create_job_returns_raw_token_but_persists_only_hash(self):
        job, token = public_jobs.create_job(
            "Compare the submission with the uploaded policy"
        )

        self.assertGreaterEqual(len(token), 40)
        authorized = public_jobs.authorize_job(job["id"], token)
        self.assertEqual(authorized["goal"], job["goal"])

        with self.assertRaises(PermissionError):
            public_jobs.authorize_job(job["id"], "wrong-token")

        row = public_jobs._fetch_job_row(job["id"])
        self.assertNotIn(token, row["access_token_hash"])
        self.assertEqual(len(row["access_token_hash"]), 64)

    def test_goal_is_required(self):
        with self.assertRaises(ValueError):
            public_jobs.create_job("   ")

    def test_update_job_serializes_structured_fields(self):
        job, _ = public_jobs.create_job("Assess the material")

        updated = public_jobs.update_job(
            job["id"],
            status="review",
            result_json={"overall_result": "pass"},
            error_json={"warnings": []},
        )

        self.assertEqual(updated["status"], "review")
        self.assertEqual(updated["result_json"]["overall_result"], "pass")
        self.assertEqual(updated["error_json"], {"warnings": []})

    def test_related_rows_are_created_and_decoded(self):
        job, _ = public_jobs.create_job("Assess the material")
        file_record = public_jobs.add_file(
            job["id"],
            "template",
            {
                "safe_name": "template-1.docx",
                "original_name": "检查表.docx",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "size": 120,
                "storage_path": "jobs/example/template-1.docx",
                "parse_status": "parsed",
                "parse_metadata_json": {"pages": 1},
            },
        )
        template = public_jobs.add_template(
            job["id"], file_record["id"], "docx", [{"key": "unit_name"}]
        )
        document = public_jobs.add_document(
            job["id"],
            template["id"],
            {"unit_name": {"value": "Example Ltd"}},
        )
        revision = public_jobs.add_revision(
            document["id"],
            "unit_name",
            {"value": "Example Ltd"},
            {"value": "Example Company"},
            "user",
        )

        self.assertEqual(file_record["parse_metadata_json"], {"pages": 1})
        self.assertEqual(template["fields_json"], [{"key": "unit_name"}])
        self.assertEqual(
            document["current_fields_json"]["unit_name"]["value"],
            "Example Ltd",
        )
        self.assertEqual(revision["source"], "user")

    def test_delete_expired_jobs_returns_job_ids(self):
        expired, _ = public_jobs.create_job("Expired")
        active, _ = public_jobs.create_job("Active")
        public_jobs.update_job(
            expired["id"], expires_at="2000-01-01T00:00:00+00:00"
        )

        removed = public_jobs.delete_expired_jobs(
            now=datetime(2026, 8, 2, tzinfo=timezone.utc)
        )

        self.assertEqual(removed, [expired["id"]])
        self.assertIsNone(public_jobs.get_job(expired["id"]))
        self.assertIsNotNone(public_jobs.get_job(active["id"]))

    def test_job_resource_snapshot_survives_source_changes(self):
        job, _ = public_jobs.create_job("Assess", workspace_id="workspace-1")
        binding = public_jobs.bind_job_resource(
            job["id"],
            "basis",
            42,
            {"source_kind": "text_freeform", "source_text": "制度第一版"},
        )

        original_snapshot = {"source_kind": "text_freeform", "source_text": "已修改"}
        self.assertEqual(binding["asset_version_id"], 42)
        self.assertEqual(
            public_jobs.list_job_resources(job["id"])[0]["snapshot_json"]["source_text"],
            "制度第一版",
        )
        self.assertEqual(original_snapshot["source_text"], "已修改")
        self.assertEqual(public_jobs.get_job(job["id"])["workspace_id"], "workspace-1")


if __name__ == "__main__":
    unittest.main()
