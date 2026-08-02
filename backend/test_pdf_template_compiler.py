import os
import tempfile
import unittest

from reportlab.pdfgen import canvas

from backend.pdf_template_compiler import compile_pdf_template
from backend.document_renderer import render_pdf
from pypdf import PdfReader


class PdfTemplateCompilerTests(unittest.TestCase):
    def test_compiles_native_form_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "form.pdf")
            pdf = canvas.Canvas(path)
            pdf.acroForm.textfield(name="employee_name", x=100, y=700, width=160, height=20)
            pdf.acroForm.checkbox(name="confirmed", x=100, y=660)
            pdf.showPage(); pdf.save()
            compiled = compile_pdf_template(path)
        kinds = {placement.kind for field in compiled.fields for placement in field.placements}
        self.assertEqual(kinds, {"pdf_form_text", "pdf_form_checkbox"})

    def test_text_pdf_candidate_keeps_page_and_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "text.pdf")
            pdf = canvas.Canvas(path)
            pdf.drawString(80, 700, "Name: ________")
            pdf.showPage(); pdf.save()
            compiled = compile_pdf_template(path)
        placement = compiled.fields[0].placements[0]
        self.assertGreaterEqual(placement.page, 0)
        self.assertGreater(placement.rect[2], placement.rect[0])

    def test_fills_native_text_form_value(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "form.pdf")
            output = os.path.join(directory, "filled.pdf")
            pdf = canvas.Canvas(path)
            pdf.acroForm.textfield(name="employee_name", x=100, y=700, width=160, height=20)
            pdf.showPage(); pdf.save()
            compiled = compile_pdf_template(path)
            render_pdf(path, compiled.fields, {"employee_name": {"value": "Zhang San"}}, output)
            fields = PdfReader(output).get_fields()
        self.assertEqual(fields["employee_name"].get("/V"), "Zhang San")


if __name__ == "__main__":
    unittest.main()
