import os
import tempfile
import unittest

from reportlab.pdfgen import canvas

from backend.pdf_quality import validate_pdf_render
from backend.template_ir import CompiledField, CompiledTemplate, Placement


class PdfQualityTests(unittest.TestCase):
    def make_pdf(self, path, pages=1):
        pdf = canvas.Canvas(path)
        for _ in range(pages):
            pdf.drawString(30, 700, "template")
            pdf.showPage()
        pdf.save()

    def test_out_of_bounds_blocks_finalize(self):
        with tempfile.TemporaryDirectory() as directory:
            template = os.path.join(directory, "template.pdf")
            output = os.path.join(directory, "output.pdf")
            self.make_pdf(template); self.make_pdf(output)
            compiled = CompiledTemplate(kind="pdf", fields=[CompiledField(
                key="value", label="内容", placements=[Placement(kind="pdf_text_rect", page=0, rect=[0, 0, 9999, 20])]
            )])
            warnings = validate_pdf_render(template, output, compiled)
        self.assertIn("pdf_rect_out_of_bounds", {warning.code for warning in warnings})

    def test_page_count_must_not_change(self):
        with tempfile.TemporaryDirectory() as directory:
            template = os.path.join(directory, "template.pdf")
            output = os.path.join(directory, "output.pdf")
            self.make_pdf(template, 2); self.make_pdf(output, 1)
            warnings = validate_pdf_render(template, output, CompiledTemplate(kind="pdf"))
        self.assertIn("pdf_page_count_changed", {warning.code for warning in warnings})


if __name__ == "__main__":
    unittest.main()
