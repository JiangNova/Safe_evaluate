"""Tests for physical and database cleanup of anonymous jobs."""

import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend import public_job_cleanup, public_jobs


class PublicJobCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(
            public_jobs,
            "DB_PATH",
            os.path.join(self.temp_dir.name, "public-jobs.db"),
        )
        self.storage_patch = patch.object(
            public_job_cleanup,
            "PUBLIC_JOB_STORAGE_DIR",
            os.path.join(self.temp_dir.name, "storage"),
        )
        self.db_patch.start()
        self.storage_patch.start()
        public_jobs.init_public_job_db()

    def tearDown(self):
        self.storage_patch.stop()
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def test_cleanup_removes_expired_database_row_and_directory_idempotently(self):
        job, _ = public_jobs.create_job("Expired job")
        public_jobs.update_job(
            job["id"], expires_at="2000-01-01T00:00:00+00:00"
        )
        job_dir = os.path.join(public_job_cleanup.PUBLIC_JOB_STORAGE_DIR, job["id"])
        os.makedirs(job_dir)
        with open(os.path.join(job_dir, "artifact.docx"), "wb") as stream:
            stream.write(b"example")

        removed = public_job_cleanup.cleanup_expired_public_jobs(
            datetime(2026, 8, 2, tzinfo=timezone.utc)
        )

        self.assertEqual(removed, [job["id"]])
        self.assertFalse(os.path.exists(job_dir))
        self.assertIsNone(public_jobs.get_job(job["id"]))
        self.assertEqual(
            public_job_cleanup.cleanup_expired_public_jobs(
                datetime(2026, 8, 2, tzinfo=timezone.utc)
            ),
            [],
        )

    def test_cleanup_keeps_record_when_directory_removal_fails(self):
        job, _ = public_jobs.create_job("Retry cleanup")
        public_jobs.update_job(
            job["id"], expires_at="2000-01-01T00:00:00+00:00"
        )
        job_dir = os.path.join(public_job_cleanup.PUBLIC_JOB_STORAGE_DIR, job["id"])
        os.makedirs(job_dir)

        with patch.object(public_job_cleanup.shutil, "rmtree", side_effect=OSError):
            removed = public_job_cleanup.cleanup_expired_public_jobs(
                datetime(2026, 8, 2, tzinfo=timezone.utc)
            )

        self.assertEqual(removed, [])
        self.assertIsNotNone(public_jobs.get_job(job["id"]))


if __name__ == "__main__":
    unittest.main()
