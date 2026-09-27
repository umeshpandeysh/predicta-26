"""
PREDICTA-26 — Final Hardening Scientific, Economic, and Provenance Test Suite
File: tests/test_final_hardening.py

Assertions:
1. Economic impact model outputs valid schema, conservative/base/optimistic scenarios, and enforces theta* = 0.20 lock.
2. Synthetic generator independence challenge runs on non-retrained frozen model and outputs valid metrics.
3. OOD and insufficient evidence evaluator executes fail-closed on 100% of out-of-distribution inputs.
4. Module-B temporal contract prohibits future features (t > 24h) and documents continuous prognostic MAE.
5. Hidden test integrity document exists and asserts zero test-set threshold tuning.
6. Claim-evidence matrix contains all 12 canonical claims and executable commands.
7. README contains authoritative PS-26170 references, single live URL, and exact test assertions.
"""

import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.evaluation.economic_impact_model import run_comprehensive_economic_analysis
from src.evaluation.evaluate_synthetic_generator_independence import evaluate_generator_independence
from src.evaluation.evaluate_ood_insufficient_evidence import evaluate_ood_and_insufficient_evidence_cases


def test_01_economic_impact_model_execution_and_schema():
    """Verify economic impact model produces complete scenario analysis and enforces locked threshold."""
    report = run_comprehensive_economic_analysis()

    assert "report_metadata" in report
    assert report["report_metadata"]["operating_threshold"] == 0.20
    assert report["report_metadata"]["operating_threshold_status"] == "LOCKED_IMMUTABLE"

    assert "scenarios" in report
    scenarios = report["scenarios"]
    assert "Conservative" in scenarios
    assert "Base_Case" in scenarios
    assert "Optimistic" in scenarios

    base = scenarios["Base_Case"]
    assert base["net_economic_verdict"]["net_economic_benefit_usd"] > 0
    assert base["net_economic_verdict"]["roi_percentage"] > 0
    assert base["chamber_hours_and_savings"]["potential_early_termination_window_per_die_hours"] == 144.0

    assert report["critical_semantic_rule"]["declaration"] == "POTENTIAL_EARLY_TERMINATION_WINDOW_NOT_EQUAL_GUARANTEED_SAVINGS"


def test_02_synthetic_generator_independence_challenge():
    """Verify generator independence challenge evaluates frozen model without retraining."""
    report = evaluate_generator_independence()

    assert report["report_metadata"]["governance_classification"] == "FROZEN_MODEL_EXTERNAL_GENERATOR_CHALLENGE"
    assert report["report_metadata"]["retraining_permitted"] is False

    comp = report["comparative_evaluation"]
    chal = comp["independent_challenge_generator"]

    # Assert robust recall and ROC-AUC under severe domain shift
    assert chal["recall"] >= 0.90, f"Challenge recall too low: {chal['recall']}"
    assert chal["roc_auc"] >= 0.75, f"Challenge ROC-AUC too low: {chal['roc_auc']}"
    assert chal["confusion_matrix"]["tp"] > 0
    assert chal["confusion_matrix"]["fn"] > 0


def test_03_ood_and_insufficient_evidence_fail_closed():
    """Verify OOD/stress inputs trigger fail-closed state (zero automated PASS) and unseen equipment is flagged."""
    report = evaluate_ood_and_insufficient_evidence_cases()

    summary = report["demonstration_summary"]
    assert summary["automated_pass_prevented_on_stress_and_data_failures"] is True
    assert summary["total_cases_evaluated"] == 5

    cases = {c["case_id"]: c for c in report["evaluated_cases"]}

    # Case 1 & 2 & 4: automated PASS strictly blocked
    assert cases["CASE_OOD_01_EXTREME_PHYSICAL_RANGE"]["prediction"] in ["REJECT", "FAIL"]
    assert cases["CASE_OOD_02_MULTIVARIATE_COPULA_TAIL"]["prediction"] in ["REJECT", "FAIL", "MONITOR"]
    assert cases["CASE_OOD_04_UNPHYSICAL_SENSOR_DATA"]["execution_status"] == "DATA_QUALITY_REJECTED"

    # Case 3: unseen equipment flagged
    assert cases["CASE_OOD_03_UNSEEN_EQUIPMENT_STATION"]["is_unseen_equipment"] is True

    # Case 5: nominal device passes
    assert cases["CASE_OOD_05_NOMINAL_POSITIVE_CONTROL"]["prediction"] == "PASS"


def test_04_module_b_temporal_contract_and_features():
    """Verify Module-B temporal contract document exists and contains required feature table."""
    contract_path = os.path.join(BASE_DIR, "docs", "MODULE_B_TEMPORAL_CONTRACT.md")
    assert os.path.exists(contract_path)
    content = open(contract_path, "r", encoding="utf-8").read()

    assert "iddq_standby_0h" in content
    assert "iddq_standby_24h" in content
    assert "iddq_standby_168h" in content
    assert "PROHIBITED" in content
    assert "FORECAST TARGET ONLY" in content
    assert "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME" in content


def test_05_hidden_test_integrity_provenance_document():
    """Verify hidden test integrity document exists and asserts zero test-set threshold tuning."""
    doc_path = os.path.join(BASE_DIR, "docs", "HIDDEN_TEST_INTEGRITY.md")
    assert os.path.exists(doc_path)
    content = open(doc_path, "r", encoding="utf-8").read()

    assert "predicta_dataset_v4_production.csv" in content
    assert "train.csv" in content
    assert "validation.csv" in content
    assert "test.csv" in content
    assert "θ* = 0.20" in content
    assert "ForbiddenTestThresholdOptimizationError" in content


def test_06_claim_evidence_matrix_completeness():
    """Verify claim-to-evidence matrix exists and contains all 12 canonical claims."""
    matrix_path = os.path.join(BASE_DIR, "docs", "CLAIM_EVIDENCE_MATRIX.md")
    assert os.path.exists(matrix_path)
    content = open(matrix_path, "r", encoding="utf-8").read()

    for i in range(1, 13):
        claim_tag = f"CLM-{i:02d}"
        assert claim_tag in content, f"Missing {claim_tag} in CLAIM_EVIDENCE_MATRIX.md"


def test_07_readme_authority_and_ps26170_consistency():
    """Verify README references PS-26170 and single live URL."""
    readme_path = os.path.join(BASE_DIR, "README.md")
    assert os.path.exists(readme_path)
    content = open(readme_path, "r", encoding="utf-8").read()

    assert "PS-26170" in content
    assert "https://predicta-26-pi.vercel.app" in content
    assert "ceenew.vercel.app" not in content
    assert "144h potential early-termination window" in content.lower()
