import unittest

from pydantic import ValidationError

from backend.template_ir import CompiledField, compile_legacy_fields


class TemplateIRTests(unittest.TestCase):
    def test_single_choice_rejects_multiple_selected_defaults(self):
        with self.assertRaises(ValidationError):
            CompiledField(
                key="action", label="处罚", value_type="single_choice",
                options=["警告", "记过"], default=["警告", "记过"],
            )

    def test_legacy_anchor_compiles_to_compatibility_placement(self):
        compiled = compile_legacy_fields("docx", [{"key": "employee", "label": "员工姓名"}])
        self.assertEqual(compiled.fields[0].placements[0].kind, "paragraph_insert")

    def test_required_field_blocks_finalize_by_default(self):
        field = CompiledField(key="signature", label="签名", required=True, fill_source="user")
        self.assertEqual(field.missing_policy, "block_finalize")


if __name__ == "__main__":
    unittest.main()
