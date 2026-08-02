import os
import tempfile
import unittest

from docx import Document

from backend.text_document_renderer import render_text_document
from backend.text_template_compiler import compile_text_template


class TextTemplateTests(unittest.TestCase):
    def test_structured_text_preserves_declared_field_order(self):
        compiled = compile_text_template(
            "structured", "员工姓名：_____\n违规事实：_____\n处罚建议：_____"
        )
        self.assertEqual([field.label for field in compiled.fields], ["员工姓名", "违规事实", "处罚建议"])

    def test_freeform_requires_requested_sections(self):
        compiled = compile_text_template(
            "freeform", "生成处罚建议书，包含事实、依据、建议和申诉说明"
        )
        self.assertEqual(
            [field.label for field in compiled.fields],
            ["事实与情况", "适用依据", "处理建议", "申诉说明"],
        )

    def test_renderer_marks_missing_required_content_as_draft(self):
        compiled = compile_text_template("freeform", "输出事实、依据和建议")
        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, "draft.docx")
            result = render_text_document(compiled, {}, output)
            text = "\n".join(paragraph.text for paragraph in Document(output).paragraphs)
        self.assertIn("[待人工补充]", text)
        self.assertTrue(result.warnings)


if __name__ == "__main__":
    unittest.main()
