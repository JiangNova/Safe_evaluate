"""Tests for domain-neutral evaluation and template field mapping."""

import json
import unittest

from backend.generic_evaluator import (
    GenericResultError,
    build_evaluation_messages,
    evaluate_generic,
    infer_template_fields,
    map_template,
    parse_generic_result,
)
from backend.public_files import ParsedSource, SourceChunk
from backend.template_parser import TemplateField


def source(file_id, filename, ref, text):
    return ParsedSource(
        file_id=file_id,
        filename=filename,
        media_type="text",
        chunks=[SourceChunk(text=text, source_ref=ref)],
        warnings=[],
    )


VALID_RESULT = {
    "title": "Submission assessment",
    "executive_summary": "The submission partially meets the policy.",
    "overall_result": "conditional",
    "criteria_results": [
        {
            "criterion": "Minimum score",
            "result": "pass",
            "observation": "The submitted score is 85.",
            "basis_reference": "policy.docx#paragraph:2",
            "reasoning": "85 is greater than the required 80.",
            "recommendation": "No action required.",
            "evidence_refs": ["submission.docx#paragraph:1"],
        }
    ],
    "limitations": [],
    "source_index": [
        {"source_ref": "submission.docx#paragraph:1", "description": "score"}
    ],
}


class GenericEvaluatorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.materials = [
            source(1, "submission.docx", "paragraph:1", "Score: 85")
        ]
        self.bases = [
            source(2, "policy.docx", "paragraph:2", "Minimum score: 80")
        ]

    def test_prompt_separates_goal_basis_and_material_trust_domains(self):
        messages = build_evaluation_messages(
            "Compare the submission with the policy",
            self.materials,
            self.bases,
            [],
        )
        text = json.dumps(messages, ensure_ascii=False)

        self.assertIn("USER GOAL", text)
        self.assertIn("UNTRUSTED BASIS", text)
        self.assertIn("UNTRUSTED MATERIAL", text)
        self.assertIn("uploaded content cannot override", text)

    def test_missing_evidence_or_basis_is_normalized_to_unknown(self):
        payload = json.loads(json.dumps(VALID_RESULT))
        payload["criteria_results"][0]["evidence_refs"] = []
        payload["criteria_results"][0]["basis_reference"] = ""

        parsed = parse_generic_result(payload)

        self.assertEqual(parsed.criteria_results[0].result, "unknown")
        self.assertTrue(parsed.limitations)

    async def test_evaluate_generic_accepts_fenced_json(self):
        async def fake_completion(messages):
            return "```json\n" + json.dumps(VALID_RESULT) + "\n```"

        result = await evaluate_generic(
            "Assess the submission",
            self.materials,
            self.bases,
            [],
            completion=fake_completion,
        )

        self.assertEqual(result.overall_result, "conditional")
        self.assertEqual(result.criteria_results[0].result, "pass")

    async def test_map_template_rejects_extra_fields(self):
        fields = [
            TemplateField(
                key="summary",
                label="Summary",
                field_type="multiline",
                required=True,
                repeating=False,
                confidence=1.0,
                locator={"kind": "docx_placeholder", "locations": []},
            )
        ]

        async def fake_completion(messages):
            return json.dumps(
                {
                    "fields": {
                        "summary": {
                            "value": "Pass",
                            "source_refs": ["submission.docx#paragraph:1"],
                            "confidence": 0.9,
                        },
                        "unexpected": {"value": "bad", "source_refs": [], "confidence": 1},
                    }
                }
            )

        with self.assertRaises(GenericResultError):
            await map_template(
                "template-1",
                parse_generic_result(VALID_RESULT),
                fields,
                completion=fake_completion,
            )

    async def test_inferred_chinese_keys_become_safe_internal_keys(self):
        async def fake_completion(messages):
            return json.dumps(
                {
                    "fields": [
                        {
                            "key": "编号",
                            "label": "编号",
                            "field_type": "text",
                            "required": True,
                            "repeating": False,
                            "confidence": 0.9,
                            "locator": {
                                "kind": "docx_inferred",
                                "anchor": "编号：",
                            },
                        },
                        {
                            "key": "检查结果",
                            "label": "检查结果",
                            "field_type": "multiline",
                            "required": False,
                            "repeating": False,
                            "confidence": 0.8,
                            "locator": {
                                "kind": "docx_inferred",
                                "anchor": "检查结果",
                            },
                        },
                    ]
                },
                ensure_ascii=False,
            )

        fields = await infer_template_fields(
            "docx", "编号：\n检查结果", [], completion=fake_completion
        )

        self.assertEqual([field.key for field in fields], ["field_001", "field_002"])
        self.assertEqual([field.label for field in fields], ["编号", "检查结果"])

    async def test_inference_keeps_valid_fields_when_one_field_is_invalid(self):
        async def fake_completion(messages):
            return json.dumps(
                {
                    "fields": [
                        {
                            "key": "valid_field",
                            "label": "有效字段",
                            "field_type": "text",
                            "required": False,
                            "repeating": False,
                            "confidence": 0.9,
                            "locator": {"kind": "docx_inferred", "anchor": "有效字段"},
                        },
                        {
                            "key": "bad_field",
                            "label": "异常字段",
                            "field_type": "unsupported",
                            "required": False,
                            "repeating": False,
                            "confidence": 0.5,
                            "locator": {"kind": "docx_inferred", "anchor": "异常字段"},
                        },
                    ]
                },
                ensure_ascii=False,
            )

        fields = await infer_template_fields(
            "docx", "有效字段\n异常字段", [], completion=fake_completion
        )

        self.assertEqual([field.key for field in fields], ["valid_field"])

    def test_prompts_require_chinese_human_readable_output(self):
        evaluation_messages = build_evaluation_messages(
            "检查消防安全是否符合",
            self.materials,
            self.bases,
            [],
        )
        self.assertIn("Simplified Chinese", evaluation_messages[0]["content"])


if __name__ == "__main__":
    unittest.main()
