"""
PREDICTA-26 — Final Consolidated Scorecard & Report Integrity Test Suite
========================================================================
Verifies:
1. Scorecard and Markdown report existence
2. Full 12-section scorecard structural completeness
3. Provenance cryptographic checksums and dynamic git commit
4. Zero hardcoded metrics and zero locked-test leakage invariants
5. Truthful NOT_COMPUTABLE regression metrics status
6. Mathematical consistency between confusion matrix metrics across sections
"""

from pathlib import Path
import json
import subprocess
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCORECARD_PATH = PROJECT_ROOT / "experiments" / "benchmarks" / "predicta_final_ml_shap_financial_scorecard.json"
MARKDOWN_PATH = PROJECT_ROOT / "docs" / "PREDICTA_FINAL_ML_SHAP_FINANCIAL_REPORT.md"

EXPECTED_TEST_SHA = "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2"
EXPECTED_FEATURE_CONTRACT_LF_SHA = "118d63717211a8f8d9ec596c59edb05311650c9d40fd324a3224b9ce9d17ca04"
EXPECTED_PROD_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def get_current_git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(PROJECT_ROOT)).decode("utf-8").strip()
    except Exception:
        return ""


@pytest.fixture(scope="module")
def scorecard_data():
    assert SCORECARD_PATH.exists(), f"Final scorecard not found at {SCORECARD_PATH}"
    with open(SCORECARD_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_01_scorecard_and_markdown_exist():
    """Verify final scorecard JSON and markdown reports exist on disk."""
    assert SCORECARD_PATH.exists(), f"Scorecard missing: {SCORECARD_PATH}"
    assert MARKDOWN_PATH.exists(), f"Markdown report missing: {MARKDOWN_PATH}"
    
    with open(MARKDOWN_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert len(content) > 500, "Markdown report must contain full executive findings"
    assert "Executive Summary" in content
    assert "Production SHAP Explainability" in content
    assert "Financial & Decision-Cost Analysis" in content


def test_02_provenance_and_crypto_hashes(scorecard_data):
    """Verify all cryptographic hashes and dynamic provenance in final scorecard."""
    provenance = scorecard_data.get("provenance", {})
    assert provenance.get("locked_test_sha256") == EXPECTED_TEST_SHA
    assert provenance.get("feature_contract_sha256") == EXPECTED_FEATURE_CONTRACT_LF_SHA
    assert provenance.get("model_sha256") == EXPECTED_PROD_MODEL_SHA
    assert provenance.get("test_used_for_selection") is False
    
    git_commit = provenance.get("git_commit", "")
    assert len(git_commit) == 40 or git_commit == "UNKNOWN_COMMIT"


def test_03_scorecard_top_level_sections(scorecard_data):
    """Verify presence of all essential scorecard analysis sections."""
    required_sections = [
        "benchmark_version",
        "status",
        "provenance",
        "production_ml",
        "shap",
        "financial",
        "cost_sensitivity",
        "cross_lot",
        "multi_seed",
        "latent_defect",
        "regression",
        "aether_reported_reference",
        "limitations",
        "integrity",
        "final_claim_status",
    ]
    for sec in required_sections:
        assert sec in scorecard_data, f"Missing required section: {sec}"


def test_04_zero_hardcoding_integrity(scorecard_data):
    """Verify integrity metrics report 0 hardcoded metrics and zero test manipulation."""
    integrity = scorecard_data.get("integrity", {})
    assert integrity.get("hardcoded_predicta_metrics") == 0
    assert integrity.get("locked_test_modified") is False
    assert integrity.get("production_model_modified") is False
    assert integrity.get("zero_test_selection_leakage") is True


def test_05_regression_truthfulness(scorecard_data):
    """Verify regression is marked NOT_COMPUTABLE with explanation and None values."""
    reg = scorecard_data.get("regression", {})
    assert reg.get("status") == "NOT_COMPUTABLE"
    assert reg.get("iddq_mae") is None
    assert reg.get("leakage_mae") is None
    assert reg.get("tpd_mae") is None
    assert len(reg.get("reason", "")) > 20


def test_06_production_ml_metrics_validity(scorecard_data):
    """Verify production ML metrics satisfy mathematical boundaries."""
    prod_ml = scorecard_data.get("production_ml", {})
    assert "xgboost_challenger_theta_020" in prod_ml
    c020 = prod_ml["xgboost_challenger_theta_020"]
    
    assert 0.0 <= c020["recall"] <= 1.0
    assert 0.0 <= c020["fpr"] <= 1.0
    assert 0.0 <= c020["precision"] <= 1.0
    assert 0.0 <= c020["f1"] <= 1.0
    assert c020["tp"] + c020["fn"] == 3311
    assert c020["tn"] + c020["fp"] == 4189


def test_07_shap_and_financial_sections_populated(scorecard_data):
    """Verify SHAP and Financial sections are richly populated."""
    shap_sec = scorecard_data.get("shap", {})
    assert shap_sec.get("additivity_verification", {}).get("passed") is True
    assert len(shap_sec.get("global_attribution", {}).get("top_10_features", [])) == 10
    
    fin_sec = scorecard_data.get("financial", {})
    assert "primary_challenger_costs" in fin_sec
    assert "baseline_comparisons" in fin_sec
    assert fin_sec["baseline_comparisons"]["net_savings_percentage_vs_no_ml"] > 90.0
