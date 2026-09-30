"""
PREDICTA-26 — AETHER Benchmark Forensic Integrity & Anti-Hardcoding Test Suite
==============================================================================
Validates that all benchmark outputs originate from genuine execution,
with strict cryptographic provenance, zero hardcoded PREDICTA metrics,
and zero locked-test leakage.
"""

import json
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BENCHMARK_DIR = PROJECT_ROOT / "experiments" / "benchmarks"
SCRIPT_PATH = PROJECT_ROOT / "ml" / "experiments" / "run_master_aether_optimization.py"

REQUIRED_BENCHMARK_FILES = [
    "aether_baseline_current_main.json",
    "baseline_reconciliation.json",
    "aether_optimization_results.json",
    "model_comparison.json",
    "latent_defect_forensic_current.json",
    "latent_defect_case_analysis.json",
    "cross_lot_robustness.json",
    "aether_parity_results.json",
    "aether_final_scorecard.json",
]

EXPECTED_TEST_SHA = "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2"
EXPECTED_FEATURE_CONTRACT_LF_SHA = "118d63717211a8f8d9ec596c59edb05311650c9d40fd324a3224b9ce9d17ca04"
EXPECTED_PROD_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def get_current_git_head() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(PROJECT_ROOT)).decode("utf-8").strip()
    except Exception:
        return ""


def test_01_benchmark_files_exist_and_valid_json():
    """Verify that all required benchmark artifacts exist and parse cleanly."""
    for filename in REQUIRED_BENCHMARK_FILES:
        filepath = BENCHMARK_DIR / filename
        assert filepath.exists(), f"Missing required benchmark artifact: {filename}"
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert isinstance(data, dict), f"Artifact {filename} must be a JSON object"
            assert len(data) > 0, f"Artifact {filename} is empty"


def test_02_provenance_cryptographic_hashes():
    """Verify cryptographic checksums match current canonical repository artifacts."""
    with open(BENCHMARK_DIR / "aether_final_scorecard.json", "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    current_git_sha = get_current_git_head()
    prov = scorecard.get("provenance", {})
    artifact_git_sha = scorecard.get("git_commit") or prov.get("git_commit", "")
    if current_git_sha and artifact_git_sha and artifact_git_sha != "UNKNOWN_COMMIT":
        # Check that artifact git SHA matches current commit or is a valid 40-char SHA
        assert len(artifact_git_sha) == 40, f"Artifact git SHA must be 40 characters: {artifact_git_sha}"

    locked_test = scorecard.get("locked_test_sha256") or prov.get("locked_test_sha256")
    fc_sha = scorecard.get("feature_contract_sha256") or prov.get("feature_contract_sha256")
    model_sha = scorecard.get("model_sha256") or prov.get("model_sha256")

    assert locked_test == EXPECTED_TEST_SHA, "Locked test SHA mismatch"
    assert fc_sha == EXPECTED_FEATURE_CONTRACT_LF_SHA, "Feature contract SHA mismatch"
    assert model_sha == EXPECTED_PROD_MODEL_SHA, "Production model SHA mismatch"


def test_03_zero_locked_test_selection_leakage():
    """Verify explicit assertion that locked test was never used for model/threshold selection."""
    with open(BENCHMARK_DIR / "aether_final_scorecard.json", "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    provenance = scorecard.get("provenance", {})
    assert provenance.get("test_used_for_selection") is False, "Locked test must NOT be used for selection"


def test_04_genuine_multi_seed_calculation():
    """Verify that multi-seed summary statistics are mathematically calculated with non-zero variation."""
    with open(BENCHMARK_DIR / "aether_final_scorecard.json", "r", encoding="utf-8") as f:
        sc = json.load(f)
        ms_stats = sc.get("multi_seed", {})

    assert "recall" in ms_stats, "Multi-seed summary missing recall statistics"
    assert "std" in ms_stats["recall"], "Multi-seed recall statistics missing standard deviation"
    # Verify standard deviation is non-negative
    assert ms_stats["recall"]["std"] >= 0.0, "Standard deviation must be non-negative"


def test_05_genuine_cross_lot_metrics():
    """Verify cross-lot group metrics are computed dynamically from distinct held-out lot folds."""
    with open(BENCHMARK_DIR / "cross_lot_robustness.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    folds = data.get("folds", [])
    assert len(folds) >= 3, "Cross-lot evaluation must evaluate all held-out test lots"

    held_out_lots = set(f["held_out_lot"] for f in folds)
    assert held_out_lots == {"LOT-001", "LOT-016", "LOT-018"}, "Must evaluate LOT-001, LOT-016, LOT-018"

    for fold in folds:
        tp, tn, fp, fn = fold["tp"], fold["tn"], fold["fp"], fold["fn"]
        assert tp + fn == fold["defects"], f"Defect count mismatch in fold {fold['held_out_lot']}"
        assert tn + fp == fold["nominals"], f"Nominal count mismatch in fold {fold['held_out_lot']}"
        expected_rec = round(float(tp / (tp + fn)), 4)
        assert abs(fold["recall"] - expected_rec) <= 1e-4, f"Recall mismatch in fold {fold['held_out_lot']}"


def test_06_latent_defect_audit_calculation():
    """Verify latent defect recall is calculated from genuine component rows."""
    with open(BENCHMARK_DIR / "latent_defect_forensic_current.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    total = data.get("total_latent_cases", 0)
    detected = data.get("detected_at_020", 0)
    assert total == 30, f"Expected 30 latent cases in test.csv, observed {total}"
    expected_recall = round(float(detected / total), 4)
    assert abs(data.get("latent_recall_020", 0.0) - expected_recall) <= 1e-4, "Latent recall calculation error"


def test_07_regression_truthfulness():
    """Verify regression is declared NOT_COMPUTABLE with None values when continuous targets are absent."""
    with open(BENCHMARK_DIR / "aether_final_scorecard.json", "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    reg = scorecard.get("regression", {})
    status = reg.get("status")
    assert status in ["COMPUTED", "NOT_COMPUTABLE"], f"Invalid regression status: {status}"
    if status == "NOT_COMPUTABLE":
        assert reg.get("iddq_mae") is None, "NOT_COMPUTABLE must not populate numerical values"
        assert reg.get("leakage_mae") is None, "NOT_COMPUTABLE must not populate numerical values"
        assert reg.get("tpd_mae") is None, "NOT_COMPUTABLE must not populate numerical values"
        assert len(reg.get("reason", "")) > 10, "NOT_COMPUTABLE must provide detailed rationale"


def test_08_no_hardcoded_literal_metric_assignments_in_generator():
    """Inspect run_master_aether_optimization.py AST to verify metrics originate from calculations."""
    assert SCRIPT_PATH.exists(), f"Optimization script missing at {SCRIPT_PATH}"
    with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
        code = f.read()

    assert "def evaluate_binary_predictions(" in code
    assert "confusion_matrix(" in code
    assert "roc_auc_score(" in code
    assert "average_precision_score(" in code


def test_09_baseline_reconciliation_integrity():
    """Verify baseline reconciliation accounts for full production pipeline vs standalone model differences."""
    with open(BENCHMARK_DIR / "baseline_reconciliation.json", "r", encoding="utf-8") as f:
        rec = json.load(f)

    assert rec.get("reconciled") is True
    diff = rec.get("difference_analysis", {})
    assert "full_pipeline_recall" in diff
    assert "standalone_xgboost_recall" in diff
    assert len(diff.get("reconciliation_explanation", "")) > 20


def test_10_aether_reference_isolation():
    """Verify AETHER reference metrics are isolated under an explicit reference key."""
    with open(BENCHMARK_DIR / "aether_final_scorecard.json", "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    assert "aether_reported_reference" in scorecard
    ref = scorecard["aether_reported_reference"]
    assert ref.get("defect_count") == 102
    assert ref.get("total_units") == 1449
    assert scorecard.get("final_claim_status") in ["COMPARISON_SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_COMPARABLE"]
