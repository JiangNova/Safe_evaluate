"""Contract tests for the generic anonymous public job API."""

import io
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from docx import Document
from fastapi.testclient import TestClient

from backend import public_files, public_jobs
from backend.main import app


DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


def docx_bytes(text: str) -> bytes:
    document = Document()
    document.add_paragraph(text)
    stream = io.BytesIO()
    document.save(stream)
    return stream.getvalue()


class PublicJobRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(
            public_jobs,
            "DB_PATH",
            os.path.join(self.temp_dir.name, "jobs.db"),
        )
        self.storage_patch = patch.object(
            public_files,
            "PUBLIC_JOB_STORAGE_DIR",
            os.path.join(self.temp_dir.name, "storage"),
        )
        self.db_patch.start()
        self.storage_patch.start()
        public_jobs.init_public_job_db()
        self.client = TestClient(app)

    def tearDown(self):
        self.storage_patch.stop()
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def create_job(self):
        response = self.client.post(
            "/api/public/jobs", json={"goal": "Assess against the uploaded policy"}
        )
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        return payload["job_id"], payload["access_token"]

    @staticmethod
    def headers(token):
        return {"X-Job-Token": token}

    def test_route_surface_contains_generic_job_endpoints(self):
        routes = {
            (route.path, method)
            for route in app.routes
            for method in (route.methods or set())
        }
        self.assertIn(("/api/public/jobs", "POST"), routes)
        self.assertIn(("/api/public/jobs/{job_id}", "GET"), routes)
        self.assertIn(
            ("/api/public/jobs/{job_id}/templates", "POST"), routes
        )
        self.assertIn(("/api/public/jobs/{job_id}/evaluate", "POST"), routes)

    def test_job_routes_require_the_correct_access_token(self):
        job_id, token = self.create_job()

        self.assertEqual(
            self.client.get(f"/api/public/jobs/{job_id}").status_code, 401
        )
        self.assertEqual(
            self.client.get(
                f"/api/public/jobs/{job_id}",
                headers=self.headers("wrong-token"),
            ).status_code,
            403,
        )
        response = self.client.get(
            f"/api/public/jobs/{job_id}", headers=self.headers(token)
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["goal"], "Assess against the uploaded policy")
        self.assertNotIn("access_token_hash", response.text)
        self.assertNotIn("storage_path", response.text)

    def test_upload_template_parse_and_confirm_fields(self):
        job_id, token = self.create_job()
        response = self.client.post(
            f"/api/public/jobs/{job_id}/templates",
            headers=self.headers(token),
            files={
                "files": (
                    "template.docx",
                    docx_bytes("单位：{{unit_name}}"),
                    DOCX_MIME,
                )
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        template = response.json()["templates"][0]
        self.assertEqual(template["fields"][0]["key"], "unit_name")

        confirm = self.client.put(
            f"/api/public/jobs/{job_id}/templates/{template['id']}/fields",
            headers=self.headers(token),
            json={"fields": template["fields"]},
        )
        self.assertEqual(confirm.status_code, 200, confirm.text)
        self.assertEqual(confirm.json()["confirmation_status"], "confirmed")

    def test_evaluate_rejects_unconfirmed_templates(self):
        job_id, token = self.create_job()
        headers = self.headers(token)
        self.client.post(
            f"/api/public/jobs/{job_id}/files/material",
            headers=headers,
            files={"files": ("material.docx", docx_bytes("Score 85"), DOCX_MIME)},
        )
        self.client.post(
            f"/api/public/jobs/{job_id}/files/basis",
            headers=headers,
            files={"files": ("basis.txt", b"Minimum score 80", "text/plain")},
        )
        self.client.post(
            f"/api/public/jobs/{job_id}/templates?auto_infer=false",
            headers=headers,
            files={"files": ("plain.docx", docx_bytes("Summary:"), DOCX_MIME)},
        )

        response = self.client.post(
            f"/api/public/jobs/{job_id}/evaluate", headers=headers
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"]["code"], "templates_unconfirmed")

    def test_confirmed_job_starts_background_evaluation(self):
        job_id, token = self.create_job()
        headers = self.headers(token)
        self.client.post(
            f"/api/public/jobs/{job_id}/files/material",
            headers=headers,
            files={"files": ("material.docx", docx_bytes("Score 85"), DOCX_MIME)},
        )
        self.client.post(
            f"/api/public/jobs/{job_id}/files/basis",
            headers=headers,
            files={"files": ("basis.txt", b"Minimum score 80", "text/plain")},
        )
        template_response = self.client.post(
            f"/api/public/jobs/{job_id}/templates",
            headers=headers,
            files={
                "files": (
                    "template.docx",
                    docx_bytes("Summary: {{summary}}"),
                    DOCX_MIME,
                )
            },
        )
        template = template_response.json()["templates"][0]
        self.client.put(
            f"/api/public/jobs/{job_id}/templates/{template['id']}/fields",
            headers=headers,
            json={"fields": template["fields"]},
        )

        with patch(
            "backend.public_job_routes._execute_evaluation", new=AsyncMock()
        ) as execute:
            response = self.client.post(
                f"/api/public/jobs/{job_id}/evaluate", headers=headers
            )

        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["status"], "queued")
        execute.assert_awaited_once_with(job_id)
        self.assertEqual(public_jobs.get_job(job_id)["status"], "queued")


if __name__ == "__main__":
    unittest.main()
