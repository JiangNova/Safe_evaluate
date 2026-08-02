import unittest

from backend.document_quality import validate_document_for_finalize
from backend.document_renderer import RenderWarning
from backend.template_ir import CompiledField, CompiledTemplate


class DocumentQualityTests(unittest.TestCase):
    def test_required_user_field_blocks_finalize(self):
        template = CompiledTemplate(kind="docx", fields=[CompiledField(
            key="employee_id", label="工号", fill_source="user", required=True,
        )])
        report = validate_document_for_finalize(template, {"employee_id": {"value": ""}}, [])
        self.assertFalse(report.can_finalize)
        self.assertIn("employee_id", report.blocking_fields)

    def test_stale_location_warning_blocks_finalize(self):
        template = CompiledTemplate(kind="docx")
        report = validate_document_for_finalize(template, {}, [RenderWarning("stale_placement", "位置已变化")])
        self.assertFalse(report.can_finalize)


if __name__ == "__main__":
    unittest.main()
