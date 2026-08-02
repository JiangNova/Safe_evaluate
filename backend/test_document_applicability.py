import unittest

from backend.document_applicability import assess_document_applicability, map_compiled_template
from backend.generic_evaluator import GenericEvaluationResult
from backend.template_ir import ApplicabilityRule, CompiledField, CompiledTemplate


class DocumentApplicabilityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.result = GenericEvaluationResult(
            title="检查", executive_summary="证据不足", overall_result="unknown",
            criteria_results=[], limitations=["未见违法事实"],
        )

    async def test_notice_is_blocked_without_violation_fact(self):
        template = CompiledTemplate(
            kind="docx", applicability_rules=[ApplicabilityRule(requirement="违法事实")]
        )
        decision = await assess_document_applicability(self.result, template)
        self.assertEqual(decision.status, "insufficient_evidence")
        self.assertIn("违法事实", decision.missing_requirements)

    async def test_ai_cannot_supply_user_only_fields(self):
        template = CompiledTemplate(kind="docx", fields=[CompiledField(
            key="signature", label="签名", fill_source="user", required=True,
        )])
        mapped = await map_compiled_template(self.result, template)
        self.assertEqual(mapped.fields["signature"].status, "needs_user_input")


if __name__ == "__main__":
    unittest.main()
