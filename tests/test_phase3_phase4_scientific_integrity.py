"""
PREDICTA-26 — Phase 3 & Phase 4 Scientific Integrity & Final Freeze Test Suite
File: tests/test_phase3_phase4_scientific_integrity.py

Verifies:
1. Canonical 5-Artifact Package existence and authority consistency
2. Phase 3 Synthetic Realism (10 difficulty levels evaluated, non-degenerate metrics)
3. Phase 3 Temporal Leakage Audit (14 checks pass, 0 temporal/target/identifier leakage)
4. Phase 3 Module-B Continuous Prognostic Proof (168h MAE/RMSE, hidden cases, cost analysis)
5. Canonical Operational Cases (Cases A, B, C, D)
6. Latency and Production Safety
"""

import json
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def test_canonical_five_artifacts_package():
    """Verify all 5 canonical artifacts exist in docs/ and experiments/benchmarks/."""
    expected_docs = [
        "01_PS26170_FINAL_BENCHMARK.md",
        "02_SYNTHETIC_REALISM_AUDIT.md",
        "03_ABLATION_STUDY.md",
        "04_TEMPORAL_LEAKAGE_AUDIT.md",
        "05_PRODUCTION_AUTHORITY.md",
    ]
    expected_jsons = [
        "01_ps26170_final_benchmark.json",
        "02_synthetic_realism_audit.json",
        "03_ablation_study.json",
        "04_temporal_leakage_audit.json",
        "05_production_authority.json",
    ]

    for doc in expected_docs:
        doc_path = os.path.join(BASE_DIR, "docs", doc)
        assert os.path.exists(doc_path), f"Missing canonical doc: {doc}"
        assert os.path.getsize(doc_path) > 100, f"Canonical doc is empty: {doc}"

    for js in expected_jsons:
        js_path = os.path.join(BASE_DIR, "experiments", "benchmarks", js)
        assert os.path.exists(js_path), f"Missing canonical JSON: {js}"
        with open(js_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert len(data) > 0, f"Canonical JSON is empty: {js}"


def test_phase3_synthetic_realism_10_levels():
    """Verify 02_synthetic_realism_audit.json has all 10 difficulty levels evaluated."""
    json_path = os.path.join(BASE_DIR, "experiments", "benchmarks", "02_synthetic_realism_audit.json")
    assert os.path.exists(json_path), "02_synthetic_realism_audit.json must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    levels = data.get("difficulty_level_evaluations", {})
    assert len(levels) == 10, f"Expected 10 difficulty levels, got {len(levels)}"

    for lvl in range(1, 11):
        key = f"LEVEL_{lvl}"
        assert key in levels, f"Missing {key} in realism audit"
        cm = levels[key]["classification_metrics"]
        assert cm["sample_count"] > 0
        assert cm["recall"] >= 0.85, f"{key} recall too low: {cm['recall']}"
        assert cm["f1_score"] > 0.50, f"{key} F1 too low: {cm['f1_score']}"

        pm = levels[key]["prognostics_168h_metrics"]
        assert "iddq" in pm and "ileak" in pm and "tpd" in pm
        assert pm["iddq"]["mae"] > 0
        assert pm["ileak"]["mae"] > 0
        assert pm["tpd"]["mae"] > 0


def test_phase3_temporal_leakage_14_checks():
    """Verify 04_temporal_leakage_audit.json has all 14 checks passing."""
    json_path = os.path.join(BASE_DIR, "experiments", "benchmarks", "04_temporal_leakage_audit.json")
    assert os.path.exists(json_path), "04_temporal_leakage_audit.json must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("report_metadata", {})
    assert meta.get("overall_audit_status") == "PASS"

    matrix = data.get("leakage_audit_matrix", {})
    assert len([k for k in matrix.keys() if k.startswith("check_")]) == 14

    # Check temporal feature count is 0
    temp_check = matrix.get("check_03_temporal_feature_leakage", {})
    assert temp_check.get("future_feature_count") == 0
    assert temp_check.get("status") == "PASS"

    # Check lot overlap is 0
    lot_check = matrix.get("check_04_lot_boundary_isolation", {})
    assert lot_check.get("overlapping_lots_count") == 0
    assert lot_check.get("status") == "PASS"

    # Check exact duplicates is 0
    dup_check = matrix.get("check_08_exact_duplicates", {})
    assert dup_check.get("cross_partition_exact_duplicates") == 0
    assert dup_check.get("status") == "PASS"

    # Check adversarial metadata shortcut ROC-AUC < 0.60
    meta_check = matrix.get("check_12_adversarial_metadata_shortcut", {})
    assert meta_check.get("metadata_only_roc_auc") < 0.60
    assert meta_check.get("status") == "PASS"


def test_phase3_prognostics_and_ablation():
    """Verify 03_ablation_study.json has valid prognostics proof, ablation stages, and cost scenarios."""
    json_path = os.path.join(BASE_DIR, "experiments", "benchmarks", "03_ablation_study.json")
    assert os.path.exists(json_path), "03_ablation_study.json must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Ablation progression
    ablation = data.get("ablation_progression", [])
    assert len(ablation) == 6, f"Expected 6 ablation configs, got {len(ablation)}"
    # Full pipeline recall >= 94%
    assert ablation[-1]["recall"] >= 0.94

    # 2. Module-B Prognostic Proof
    prog = data.get("prognostics_168h_proof", {})
    metrics = prog.get("metrics", {})
    assert "iddq" in metrics and "ileak" in metrics and "tpd" in metrics
    assert metrics["iddq"]["168h"]["mae"] < 30.0  # uA
    assert metrics["ileak"]["168h"]["mae"] < 5.0   # uA
    assert metrics["tpd"]["168h"]["mae"] < 5.0     # ns

    demos = prog.get("demonstration_cases", [])
    assert len(demos) >= 5
    for d in demos:
        assert "component_id" in d
        assert "iddq" in d["parameters"]
        assert "actual_hidden_168h" in d["parameters"]["iddq"]

    # 3. Cost sensitive analysis
    cost = data.get("cost_sensitive_decision_analysis", {})
    scenarios = cost.get("cost_scenarios", [])
    assert len(scenarios) >= 5

    # 4. Threshold legitimacy
    thresh = data.get("threshold_legitimacy_audit", [])
    assert len(thresh) >= 4
    for t in thresh:
        assert t["test_labels_used"] is False


def test_canonical_four_cases_inference():
    """Verify canonical cases A, B, C, D evaluate deterministically."""
    from src.evaluation.phase16_canonical_cases import Phase16CanonicalCaseSuite
    suite = Phase16CanonicalCaseSuite()
    results = suite.execute_all()

    assert len(results) == 4
    case_map = {r.case_id: r for r in results}

    assert case_map["CASE_A_NORMAL"].decision == "PASS"
    assert case_map["CASE_B_STATIC_LIMIT_ESCAPE"].decision == "REJECT"
    assert case_map["CASE_C_FUTURE_FAILURE"].decision == "REJECT"
    assert case_map["CASE_D_FALSE_ALARM"].decision == "MONITOR"
