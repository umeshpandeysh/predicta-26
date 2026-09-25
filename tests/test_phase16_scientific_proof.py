"""
PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Test Suite
File: tests/test_phase16_scientific_proof.py

Verifies:
1. Deterministic canonical cases A, B, C, D execution & validation.
2. Evidence timeline construction and structured explanations.
3. 6-configuration layer ablation study progression.
4. Relative cost sensitivity analysis & ASSUMPTION disclaimer.
5. Operating threshold sweep & protected 0.20 threshold immutability.

PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
"""

import os
import sys
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.evaluation.phase16_canonical_cases import Phase16CanonicalCaseSuite
from src.evaluation.phase16_evidence_explainer import Phase16EvidenceExplainer
from src.evaluation.phase16_ablation_study import Phase16AblationStudyEngine
from src.evaluation.phase16_cost_threshold import Phase16CostAndThresholdEvaluator


def test_canonical_scientific_cases():
    suite = Phase16CanonicalCaseSuite()
    results = suite.execute_all()

    assert len(results) == 4, "Expected 4 canonical test cases"

    for case_res in results:
        assert case_res.validation_status == "PASSED", f"Case {case_res.case_id} failed validation"

    # Specific checks
    case_a = next(r for r in results if r.case_id == "CASE_A_NORMAL")
    assert case_a.decision == "PASS"

    case_b = next(r for r in results if r.case_id == "CASE_B_STATIC_LIMIT_ESCAPE")
    assert case_b.decision == "REJECT"

    case_c = next(r for r in results if r.case_id == "CASE_C_FUTURE_FAILURE")
    assert case_c.decision == "REJECT"

    case_d = next(r for r in results if r.case_id == "CASE_D_FALSE_ALARM")
    assert case_d.decision == "MONITOR", "Case D must be MONITOR to prove ANOMALY != AUTOMATIC REJECTION"


def test_evidence_explainer_and_timelines():
    suite = Phase16CanonicalCaseSuite()
    explainer = Phase16EvidenceExplainer()
    results = suite.execute_all()

    for case_res in results:
        raw_dict = case_res.raw_telemetry
        inf_res = suite.inference_service.predict_single(raw_dict)

        timeline = explainer.build_evidence_timeline(raw_dict, inf_res)
        assert len(timeline) == 4, "Timeline must contain 4 temporal checkpoints (0h, 24h, 96h, 168h)"

        why_flagged = explainer.generate_why_flagged_explanation(inf_res)
        counterfactual = why_flagged["evidence_layers"]["model_counterfactual"]
        assert "disclaimer" in counterfactual, "Explanation must contain model counterfactual vs causal disclaimer"
        assert "MODEL_LEVEL_FEATURE_ATTRIBUTION_ONLY" in counterfactual["disclaimer"]


def test_ablation_study_configurations():
    engine = Phase16AblationStudyEngine()
    results = engine.execute_all_ablation_configs()

    assert len(results) == 6, "Ablation study must evaluate exactly 6 configurations"

    config_names = [r.config_id for r in results]
    assert config_names == [
        "CONFIG_1_STATIC_LIMITS",
        "CONFIG_2_STATIC_ANOMALY",
        "CONFIG_3_STATIC_ANOMALY_PROGNOSTICS",
        "CONFIG_4_STATIC_ANOMALY_PROG_UNCERTAINTY",
        "CONFIG_5_STATIC_ANOMALY_PROG_UNCERT_PHYSICS",
        "CONFIG_6_FULL_PIPELINE"
    ]

    for r in results:
        assert r.leakage_audit_status == "LEAKAGE_FREE_0H_24H"
        assert 0.0 <= r.recall <= 1.0
        assert 0.0 <= r.fnr <= 1.0


def test_relative_cost_sensitivity():
    evaluator = Phase16CostAndThresholdEvaluator()
    eval_df = evaluator.load_eval_data()

    scenarios = evaluator.evaluate_cost_sensitivity(eval_df, threshold=0.20)
    assert len(scenarios) == 5, "Expected 5 relative cost ratio scenarios"

    ratios = [s.fn_to_fp_relative_cost_ratio for s in scenarios]
    assert ratios == [1.0, 2.0, 5.0, 10.0, 20.0]

    for s in scenarios:
        assert "ASSUMPTION / EVALUATION-ONLY" in s.disclaimer
        assert s.operating_threshold_used == 0.20


def test_operating_threshold_protection():
    evaluator = Phase16CostAndThresholdEvaluator()
    eval_df = evaluator.load_eval_data()

    threshold_points = evaluator.evaluate_threshold_sweep(eval_df)
    assert len(threshold_points) > 0

    prod_points = [t for t in threshold_points if t.is_production_threshold]
    assert len(prod_points) == 1, "Exactly one threshold point must be flagged as production threshold"
    assert abs(prod_points[0].threshold - 0.20) < 1e-4, "Protected production threshold must be 0.20"
