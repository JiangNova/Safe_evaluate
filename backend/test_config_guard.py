import os
import subprocess
import sys
import unittest


def run_config(env):
    merged = os.environ.copy()
    merged.update(env)
    return subprocess.run(
        [sys.executable, "-c", "import backend.config"],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        env=merged,
        capture_output=True,
        text=True,
    )


class ProductionConfigGuardTests(unittest.TestCase):
    def test_production_rejects_missing_credentials(self):
        result = run_config(
            {
                "APP_ENV": "production",
                "APP_USERS": "",
                "JWT_SECRET": "",
                "QWEN_API_KEY": "test-key",
            }
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("APP_USERS", result.stderr)
        self.assertIn("JWT_SECRET", result.stderr)

    def test_production_accepts_explicit_credentials(self):
        result = run_config(
            {
                "APP_ENV": "production",
                "APP_USERS": '{"tester": "test-password"}',
                "JWT_SECRET": "test-secret",
                "QWEN_API_KEY": "test-key",
            }
        )
        self.assertEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
