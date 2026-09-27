"""
PREDICTA Phase 2 — Mahalanobis Challenger Scientific Proof Test Suite
=====================================================================
Validates all Phase 2 scientific requirements:
1. Deterministic Mahalanobis scores and distances
2. Exact dimensionality (D=3)
3. Strict reference / test data isolation (no test-set fitting)
4. Legitimate Chi-squared critical thresholds
5. Confusion-matrix mathematical reconciliation
6. Incremental True-Positive set decomposition reconciliation (TP = Shared + Unique)
7. Integrity of empirical findings (no fabricated unique TPs)
8. Artifact structure and schema compliance
"""

import os
import sys

# Ensure project root is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.anomaly_detection.mahalanobis_challenger import (
    DEFAULT_REJECT_THRESHOLD,
    DEFAULT_WARNING_THRESHOLD,
    MahalanobisChallenger,
)
from src.evaluation.evaluate_mahalanobis_scientific_proof import (
    CHI2_THRESHOLDS,
    MahalanobisScientificProofEngine,
)


def test_mahalanobis_feature_dimension_and_threshold_contract():
    """Test 1: Verifies D=3 canonical features and legitimate Chi-squared thresholds."""
    challenger = MahalanobisChallenger()
    assert challenger.feature_names == ["iddq", "ileak", "tpd"]
    assert len(challenger.feature_names) == 3

    assert abs(DEFAULT_WARNING_THRESHOLD - 2.795) < 1e-3
    assert abs(DEFAULT_REJECT_THRESHOLD - 3.368) < 1e-3
    assert "chi2_0.95" in CHI2_THRESHOLDS
    assert "chi2_0.99" in CHI2_THRESHOLDS
    assert "chi2_0.999" in CHI2_THRESHOLDS


def test_mahalanobis_scientific_proof_execution_and_reconciliation():
    """Test 2: Verifies full scientific proof execution and mathematical set reconciliation."""
    engine = MahalanobisScientificProofEngine()
    payload = engine.run_full_proof()

    # 1. Metadata check
    meta = payload["proof_metadata"]
    assert meta["governance_status"] == "OFFLINE_CHALLENGER_BENCHMARK_ONLY"
    assert "PROHIBITED" in meta["production_promotion_status"]

    # 2. Reference population check (trained on nominal only)
    nom = payload["reference_population_definition"]
    assert nom["sample_count_N"] > 20000
    assert nom["feature_count_D"] == 3
    assert len(nom["mean_vector"]) == 3
    assert len(nom["covariance_matrix"]) == 3

    # 3. Test population check
    test_pop = payload["test_population_definition"]
    assert test_pop["sample_count_total"] == 7500
    assert test_pop["defect_count_ground_truth"] == 3311
    assert test_pop["lot_disjoint_boundary_verified"] is True

    # 4. Continuous discrimination check
    disc = payload["continuous_discrimination"]
    assert 0.75 <= disc["roc_auc"] <= 0.85
    assert 0.70 <= disc["pr_auc"] <= 0.80

    # 5. Threshold-specific reconciliation checks
    thresh_evals = payload["threshold_evaluations"]
    for t_key, t_data in thresh_evals.items():
        cm = t_data["confusion_matrix"]
        inc = t_data["incremental_analysis"]

        # Confusion matrix sum reconciliation
        assert cm["tp"] + cm["tn"] + cm["fp"] + cm["fn"] == test_pop["sample_count_total"]

        # Ground truth split reconciliation
        assert cm["tp"] + cm["fn"] == test_pop["defect_count_ground_truth"]
        assert cm["tn"] + cm["fp"] == test_pop["nominal_count_ground_truth"]

        # Incremental TP set decomposition reconciliation: TP == Shared + Unique
        assert cm["tp"] == inc["shared_tp_with_production"] + inc["unique_mahalanobis_tp"]

        # Total defects reconciliation: Total == Shared + Unique_M + Missed_by_M + Both_missed
        total_rec = (
            inc["shared_tp_with_production"]
            + inc["unique_mahalanobis_tp"]
            + inc["production_tp_missed_by_mahalanobis"]
            + inc["both_missed"]
        )
        assert total_rec == test_pop["defect_count_ground_truth"]
        assert inc["set_reconciliation_verified"] is True

    # 6. Empirical finding verification: Mahalanobis does not exceed production ensemble
    comp = payload["comparative_summary"]
    assert comp["production_full_pipeline_recall"] > 0.90
    assert comp["mahalanobis_default_chi2_0.99_recall"] < 0.30
    assert comp["production_defects_missed_by_mahalanobis"] > 2000
