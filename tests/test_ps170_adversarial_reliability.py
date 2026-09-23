"""
PREDICTA-26 — PS-170 Adversarial Reliability Unit Test Suite (Python)
File: tests/test_ps170_adversarial_reliability.py
"""

import os
import sys
import unittest

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from ml.benchmarks.ps170_adversarial_reliability_benchmark import run_adversarial_benchmark


class TestPS170AdversarialReliability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = run_adversarial_benchmark()

    def test_benchmark_overall_status(self):
        self.assertEqual(self.report["benchmark_status"], "PASSED")
        self.assertEqual(self.report["passed_attacks"], 20)
        self.assertEqual(self.report["failed_attacks"], 0)

    def test_all_attacks_passed_individually(self):
        for atk in self.report["attack_results"]:
            self.assertTrue(atk["passed"], f"Attack {atk['attack_id']}: {atk['name']} failed")


if __name__ == "__main__":
    unittest.main()
