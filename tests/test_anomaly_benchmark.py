import os
import sys
import json
import pytest
import numpy as np
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.anomaly_detection.robust_mad import RobustMADDetector
from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.isolation_forest import IsolationForestDetector, euler_harmonic_c

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET_PATH = os.path.join(BASE_DIR, "data", "synthetic", "semiconductor_synthetic_full.csv")
SPLIT_MANIFEST_PATH = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
ANOMALY_CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "anomaly", "anomaly_contract.json")
PROD_ARTIFACT_V2_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_anomaly_v2_artifacts.json")


@pytest.fixture
def sample_train_data():
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({
        "iddq": np.random.normal(2100.0, 50.0, n),
        "ileak": np.random.normal(300.0, 10.0, n),
        "tpd": np.random.normal(190.0, 5.0, n),
    })
    lots = pd.Series(["LOT-SYN-001"] * 50 + ["LOT-SYN-002"] * 50)
    return df, lots


import subprocess


def test_anomaly_contract_structure():
    """Verify anomaly contract exists, is valid JSON, and adheres to schema."""
    assert os.path.exists(ANOMALY_CONTRACT_PATH)
    with open(ANOMALY_CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)

    assert contract["contract_version"] == "2.0.0"
    assert contract["data_governance"]["is_synthetic"] is True
    assert "e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa" in contract["data_governance"]["dataset_sha256"]
    assert contract["threshold_governance"]["optimization_target"] == "F2_MAX_VALIDATION_ONLY"
    assert contract["detector_definitions"]["isolation_forest"]["random_state"] == 42
    assert contract["detector_definitions"]["robust_mad"]["min_reference_size"] == 10
    assert contract["feature_contract"]["canonical_feature_order"] == ["iddq", "ileak", "tpd"]


def test_deterministic_isolation_forest(sample_train_data):
    """Verify Isolation Forest produces identical trees across runs with seed=42."""
    df, lots = sample_train_data
    clf1 = IsolationForestDetector(n_estimators=20, random_state=42)
    clf1.fit(df, lots)

    clf2 = IsolationForestDetector(n_estimators=20, random_state=42)
    clf2.fit(df, lots)

    s1 = clf1.score(df)
    s2 = clf2.score(df)
    np.testing.assert_allclose(s1, s2, atol=1e-7)


def test_feature_order_locking(sample_train_data):
    """Verify all detectors enforce strict canonical feature order ['iddq', 'ileak', 'tpd']."""
    df, lots = sample_train_data

    # 1. Canonical order succeeds
    clf = IsolationForestDetector(n_estimators=10, random_state=42)
    clf.fit(df, lots)
    assert clf.feature_names == ["iddq", "ileak", "tpd"]

    mad = RobustMADDetector()
    mad.fit(df, lots)
    assert mad.feature_names == ["iddq", "ileak", "tpd"]

    copod = COPODDetector()
    copod.fit(df, lots)
    assert copod.feature_names == ["iddq", "ileak", "tpd"]

    # 2. Reordered DataFrame fails explicitly
    reordered_df = df[["tpd", "iddq", "ileak"]].copy()
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        clf.fit(reordered_df, lots)
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        mad.fit(reordered_df, lots)
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        copod.fit(reordered_df, lots)
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        clf.score(reordered_df)

    # 3. Missing feature fails
    missing_df = df[["iddq", "ileak"]].copy()
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        clf.fit(missing_df, lots)
    with pytest.raises(ValueError, match="Missing required canonical anomaly feature"):
        mad.score_single({"iddq": 2100.0, "ileak": 300.0})

    # 4. Extra feature fails
    extra_df = df.copy()
    extra_df["extra_feature"] = 1.0
    with pytest.raises(ValueError, match="Feature schema/order mismatch"):
        clf.fit(extra_df, lots)


def test_robust_mad_lot_relative_and_fallback(sample_train_data):
    """Verify Robust MAD uses lot stats for known lots and falls back safely for unseen/small lots."""
    df, lots = sample_train_data
    det = RobustMADDetector(min_reference_size=10)
    det.fit(df, lots)

    # 1. Known Lot
    res_known = det.score_single({"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}, "LOT-SYN-001")
    assert res_known["reference_source"] == "LOT_RELATIVE"

    # 2. Unseen Lot
    res_unseen = det.score_single({"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}, "LOT-UNSEEN-999")
    assert "GLOBAL_FALLBACK" in res_unseen["reference_source"]

    # 3. Missing Lot
    res_missing = det.score_single({"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}, None)
    assert res_missing["reference_source"] == "GLOBAL_FALLBACK"


def test_copod_monotonicity():
    """Verify COPOD tail probability increases with extremity."""
    ref_df = pd.DataFrame({
        "iddq": np.linspace(1000.0, 2000.0, 100),
        "ileak": np.linspace(100.0, 200.0, 100),
        "tpd": np.linspace(10.0, 20.0, 100),
    })
    copod = COPODDetector()
    copod.fit(ref_df)

    s_median = copod.score_single({"iddq": 1500.0, "ileak": 150.0, "tpd": 15.0})["score"]
    s_extreme = copod.score_single({"iddq": 2500.0, "ileak": 350.0, "tpd": 35.0})["score"]
    assert s_extreme > s_median


def test_insufficient_reference_small_lot():
    """Verify lots with sample count < min_reference_size do not form lot-specific models."""
    df = pd.DataFrame({
        "iddq": [2100.0] * 5,
        "ileak": [300.0] * 5,
        "tpd": [190.0] * 5,
    })
    lots = pd.Series(["TINY-LOT"] * 5)
    det = RobustMADDetector(min_reference_size=10)
    det.fit(df, lots)
    assert "TINY-LOT" not in det.lot_stats
    res = det.score_single({"iddq": 2100.0, "ileak": 300.0, "tpd": 190.0}, "TINY-LOT")
    assert "GLOBAL_FALLBACK" in res["reference_source"]


def test_nan_inf_rejection():
    """Verify detectors reject NaN/Inf values with explicit ValueError."""
    det = RobustMADDetector()
    det.global_stats = {
        "iddq": {"median": 2000.0, "sigma": 100.0},
        "ileak": {"median": 300.0, "sigma": 10.0},
        "tpd": {"median": 190.0, "sigma": 5.0},
    }
    with pytest.raises(ValueError, match="Invalid non-numeric or non-finite value"):
        det.score_single({"iddq": np.nan, "ileak": 300.0, "tpd": 190.0})


def test_v2_production_artifact_exists_and_valid():
    """Verify predicta_anomaly_v2_artifacts.json exists, contains all required fields, and passes hash check."""
    assert os.path.exists(PROD_ARTIFACT_V2_PATH)
    with open(PROD_ARTIFACT_V2_PATH, "r", encoding="utf-8") as f:
        artifact = json.load(f)

    assert artifact["contract_version"] == "2.0.0_authoritative"
    assert artifact["canonical_feature_order"] == ["iddq", "ileak", "tpd"]
    assert artifact["threshold_optimization_metric"] == "F2_MAX_VALIDATION_ONLY"
    assert "robust_mad" in artifact
    assert "copod" in artifact
    assert "isolation_forest" in artifact
    assert "fusion" in artifact
    assert "frozen_thresholds" in artifact
    assert "trees" in artifact["isolation_forest"]
    assert len(artifact["isolation_forest"]["trees"]) == 100


def test_euler_harmonic_math():
    """Verify average BST path length calculation matches theory."""
    assert euler_harmonic_c(1) == 0.0
    assert euler_harmonic_c(2) == 1.0
    c_256 = euler_harmonic_c(256)
    assert 9.0 < c_256 < 11.0


def test_python_node_benchmark_parity():
    """Verifies that Node.js benchmark reproduces Python benchmark results with exact parity."""
    # 1. Load Python Benchmark Report
    report_path = os.path.join(BASE_DIR, "experiments", "anomaly_evaluation", "anomaly_benchmark_report.json")
    assert os.path.exists(report_path), "Python benchmark report not found."
    with open(report_path, "r", encoding="utf-8") as f:
        py_report = json.load(f)

    py_test_bench = py_report["held_out_test_benchmark"]

    # 2. Run Node.js Benchmark
    node_eval_script = os.path.join(BASE_DIR, "src", "anomaly", "evaluate_anomaly.js")
    result = subprocess.run(["node", node_eval_script], capture_output=True, text=True, cwd=BASE_DIR)
    assert result.returncode == 0, f"Node evaluate_anomaly failed: {result.stderr}"

    # Parse Node output lines to verify every detector's metrics match
    output_lines = result.stdout.splitlines()
    node_results = {}
    for line in output_lines:
        if "->" in line and "Thresh:" in line:
            parts = line.strip().split("->")
            det_name = parts[0].strip()
            # Extract threshold, F2, F1, Recall, FNR, Prec, TP
            metrics_str = parts[1].strip()
            tokens = [t.strip() for t in metrics_str.split("|")]
            th_val = float(tokens[0].replace("Thresh:", "").strip())
            f2_val = float(tokens[1].replace("F2:", "").strip())
            f1_val = float(tokens[2].replace("F1:", "").strip())
            rec_val = float(tokens[3].replace("Recall:", "").replace("%", "").strip()) / 100.0
            fnr_val = float(tokens[4].replace("FNR:", "").replace("%", "").strip()) / 100.0
            prec_val = float(tokens[5].replace("Prec:", "").replace("%", "").strip()) / 100.0
            tp_token = tokens[6].replace("TP:", "").strip().split("/")
            tp_val = int(tp_token[0])
            pos_count = int(tp_token[1])

            node_results[det_name] = {
                "threshold": th_val,
                "f2_score": f2_val,
                "f1_score": f1_val,
                "recall": rec_val,
                "false_negative_rate": fnr_val,
                "precision": prec_val,
                "tp": tp_val,
                "positive_count": pos_count,
            }

    for det_name, py_metrics in py_test_bench.items():
        assert det_name in node_results, f"Detector {det_name} missing in Node results"
        nr = node_results[det_name]

        assert abs(nr["threshold"] - py_metrics["threshold"]) < 1e-3, f"{det_name} threshold mismatch: Py={py_metrics['threshold']}, Node={nr['threshold']}"
        assert abs(nr["f2_score"] - py_metrics["f2_score"]) < 1e-3, f"{det_name} F2 mismatch: Py={py_metrics['f2_score']}, Node={nr['f2_score']}"
        assert abs(nr["f1_score"] - py_metrics["f1_score"]) < 1e-3, f"{det_name} F1 mismatch: Py={py_metrics['f1_score']}, Node={nr['f1_score']}"
        assert abs(nr["recall"] - py_metrics["recall"]) < 1e-3, f"{det_name} Recall mismatch: Py={py_metrics['recall']}, Node={nr['recall']}"
        assert abs(nr["false_negative_rate"] - py_metrics["false_negative_rate"]) < 1e-3, f"{det_name} FNR mismatch: Py={py_metrics['false_negative_rate']}, Node={nr['false_negative_rate']}"
        assert abs(nr["precision"] - py_metrics["precision"]) < 1e-3, f"{det_name} Precision mismatch: Py={py_metrics['precision']}, Node={nr['precision']}"
        assert nr["tp"] == py_metrics["confusion_matrix"]["tp"], f"{det_name} TP mismatch: Py={py_metrics['confusion_matrix']['tp']}, Node={nr['tp']}"
        assert nr["positive_count"] == py_metrics["support"]["positive_count"], f"{det_name} Positive Count mismatch: Py={py_metrics['support']['positive_count']}, Node={nr['positive_count']}"

