"""
PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Test Suite
File: tests/test_phase16_scientific_proof.py

Strengthened Integrity Verification:
1. Deterministic canonical cases A, B, C, D execution & validation.
2. Evidence timeline construction and structured explanations.
3. 6-configuration layer ablation study progression on held-out test dataset (test.csv).
4. Zero lot overlap between training dataset (train.csv) and evaluation dataset (test.csv).
5. Mathematical consistency of TP/TN/FP/FN confusion matrices and metrics.
6. Absence of degenerate (100% FPR or 0% recall) all-positive/all-negative classifications.
7. Single-source document/report consistency (JSON vs Markdown).
8. Relative cost sensitivity analysis & ASSUMPTION / EVALUATION-ONLY disclaimer.
9. Operating threshold sweep & protected 0.20 threshold immutability.

PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
"""

import json
import os
import sys
import pandas as pd

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


def test_evaluation_dataset_splitting_and_zero_overlap():
    engine = Phase16AblationStudyEngine()
    df, meta = engine.load_evaluation_data()

    assert meta["dataset_path"].endswith("test.csv"), "Evaluation MUST use held-out test.csv"
    assert meta["sample_count"] > 0, "Test dataset must not be empty"
    assert meta["lot_overlap_with_train"] == 0, "Lot overlap between training and evaluation MUST be strictly 0"

    train_path = os.path.join(BASE_DIR, "ml", "data", "processed", "train.csv")
    if os.path.exists(train_path):
        train_df = pd.read_csv(train_path)
        train_lots = set(train_df["lot_id"].dropna().unique())
        test_lots = set(df["lot_id"].dropna().unique())
        assert len(train_lots.intersection(test_lots)) == 0, "Zero lot overlap assertion failed!"


def test_ablation_study_configurations_computation_and_math():
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
        assert r.leakage_audit_status == "LEAKAGE_FREE_HELD_OUT_TEST"
        assert r.tp + r.fn == r.positive_count, f"TP+FN must equal positive support for {r.config_id}"
        assert r.tn + r.fp == r.negative_count, f"TN+FP must equal negative support for {r.config_id}"

        expected_recall = round(float(r.tp / r.positive_count), 4) if r.positive_count > 0 else 0.0
        expected_fnr = round(float(r.fn / r.positive_count), 4) if r.positive_count > 0 else 0.0
        expected_fpr = round(float(r.fp / r.negative_count), 4) if r.negative_count > 0 else 0.0

        assert abs(r.recall - expected_recall) < 1e-4, f"Recall calculation mismatch in {r.config_id}"
        assert abs(r.fnr - expected_fnr) < 1e-4, f"FNR calculation mismatch in {r.config_id}"
        assert abs(r.fpr - expected_fpr) < 1e-4, f"FPR calculation mismatch in {r.config_id}"

        # Prevent degenerate all-positive / all-negative collapse
        assert not r.is_degenerate, f"Configuration {r.config_id} collapsed into degenerate classifier state!"


def test_single_source_report_consistency():
    json_path = os.path.join(BASE_DIR, "ml", "reports", "phase16_ablation_results.json")
    doc_path = os.path.join(BASE_DIR, "docs", "phase16_methodology_and_proof.md")

    if os.path.exists(json_path) and os.path.exists(doc_path):
        with open(json_path, "r", encoding="utf-8") as f:
            json_results = json.load(f)

        with open(doc_path, "r", encoding="utf-8") as f:
            doc_text = f.read()

        for j_res in json_results:
            expected_recall_str = f"{j_res['recall']*100:.2f}%"
            assert expected_recall_str in doc_text, f"Recall {expected_recall_str} for {j_res['config_id']} missing from doc_text!"


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


def test_lead_time_and_mae_provenance_is_explicit():
    engine = Phase16AblationStudyEngine()
    results = engine.execute_all_ablation_configs()

    # The certified held-out schema does not define a future-168h ground-truth leakage field.
    source_path = os.path.join(BASE_DIR, "src", "evaluation", "phase16_ablation_study.py")
    with open(source_path, "r", encoding="utf-8") as f:
        source = f.read()
    assert "leakage_current_168h" not in source
    assert "ileak_168h" not in source

    for result in results:
        assert result.prognostic_mae == "NOT_COMPUTABLE"
        assert result.lead_time_basis == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"
        assert result.lead_time_stats["status"] == "COMPUTED"

def test_operating_threshold_protection():
    evaluator = Phase16CostAndThresholdEvaluator()
    eval_df = evaluator.load_eval_data()

    threshold_points = evaluator.evaluate_threshold_sweep(eval_df)
    assert len(threshold_points) > 0

    prod_points = [t for t in threshold_points if t.is_production_threshold]
    assert len(prod_points) == 1, "Exactly one threshold point must be flagged as production threshold"
    assert abs(prod_points[0].threshold - 0.20) < 1e-4, "Protected production threshold must be 0.20"


def test_dynamic_lead_time_integrity():
    engine = Phase16AblationStudyEngine()
    results = engine.execute_all_ablation_configs()
    c1 = next(r for r in results if r.config_id == "CONFIG_1_STATIC_LIMITS")
    stats = c1.lead_time_stats
    assert stats["status"] == "COMPUTED"
    assert stats["min_hours"] != stats["max_hours"], "Lead time must be dynamic and derived per sample, not a fixed constant!"


def test_c6_non_degeneracy_and_specificity():
    engine = Phase16AblationStudyEngine()
    results = engine.execute_all_ablation_configs()
    c6 = next(r for r in results if r.config_id == "CONFIG_6_FULL_PIPELINE")
    assert not c6.is_degenerate, "C6 must not collapse into degenerate classifier state"
    assert c6.tn > 0, "C6 true negatives must be > 0"
    assert c6.fpr < 1.0, "C6 FPR must be strictly < 100%"
    assert c6.specificity > 0.0, "C6 specificity must be strictly > 0.0"


def test_normalization_scaling_integrity():
    from src.api.inference_service import PredictaInferenceService
    svc = PredictaInferenceService()
    nominal_rec = {
        "current": 45.0,
        "leakage_current": 111.73,
        "propagation_delay": 10.98,
        "temperature": 25.0
    }
    norm = svc.get_normalized_params(nominal_rec)
    assert abs(norm["iddq"] - 2013.42) < 50.0, f"Normalized IDDQ out of expected bounds: {norm['iddq']}"
    assert abs(norm["ileak"] - 301.67) < 20.0, f"Normalized Ileak out of expected bounds: {norm['ileak']}"
    assert abs(norm["tpd"] - 192.21) < 15.0, f"Normalized Tpd out of expected bounds: {norm['tpd']}"


def test_protected_model_and_dataset_hashes():
    import hashlib
    model_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    with open(model_path, "rb") as f:
        computed_model_sha = hashlib.sha256(f.read()).hexdigest()
    assert computed_model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98", "Protected model SHA-256 modified!"

    dataset_path = os.path.join(BASE_DIR, "ml", "data", "processed", "test.csv")
    with open(dataset_path, "rb") as f:
        computed_test_sha = hashlib.sha256(f.read()).hexdigest()
    assert computed_test_sha == "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2", "Protected test dataset SHA-256 modified!"

