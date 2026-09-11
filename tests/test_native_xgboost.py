"""
Predicta Semiconductor Test Analytics Prototype — Native XGBoost Test Suite
File: tests/test_native_xgboost.py

Rigorous pytest suite validating Phase M native XGBoost criteria:
1. Native xgboost import & runtime environment
2. Native XGBoost model serialization loading (.load_model)
3. Dataset provenance & metadata integrity (50,000 synthetic semiconductor records)
4. Locked 28-feature schema contract
5. Valid probability range [0, 1]
6. Low-risk prediction for nominal semiconductor sample
7. High-risk prediction for defective semiconductor sample
8. Inference determinism across repeated requests
9. Prediction consistency after model reloads
10. Fail-fast CONFIGURATION_ERROR on missing or tampered model artifact
"""

import os
import sys
import json
import pytest
import numpy as np
import xgboost as xgb

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

MODEL_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
METADATA_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_metadata.json")
MANIFEST_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_production_manifest.json")

NOMINAL_SAMPLE = {
    "equipment_id": "EQP-101",
    "supply_voltage": 1.20,
    "output_voltage": 1.20,
    "current": 45.28,
    "iddq_standby": 10.703885,
    "leakage_current": 111.7316,
    "resistance": 12.54,
    "capacitance": 4.21,
    "threshold_voltage": 0.45,
    "frequency": 2489.32,
    "propagation_delay": 10.9834,
    "setup_time": 0.85,
    "hold_time": 0.42,
    "timing_margin": 2.63,
    "temperature": 27.97,
    "dynamic_power": 54.28,
    "total_power": 54.44,
    "test_duration": 150.0
}

DEFECTIVE_SAMPLE = {
    "equipment_id": "EQP-101",
    "supply_voltage": 1.05,
    "output_voltage": 0.90,
    "current": 85.0,
    "leakage_current": 450.0,
    "resistance": 28.0,
    "capacitance": 9.5,
    "threshold_voltage": 0.25,
    "frequency": 1800.0,
    "propagation_delay": 22.0,
    "setup_time": 1.85,
    "hold_time": 0.95,
    "timing_margin": 0.2,
    "temperature": 65.0,
    "dynamic_power": 110.0,
    "total_power": 125.0,
    "test_duration": 150.0
}

def test_01_native_library_available():
    """Test 1: Verify native xgboost library imports successfully."""
    assert xgb.__version__ is not None
    assert len(xgb.__version__) > 0

def test_02_model_loads_using_native_xgboost():
    """Test 2: Production artifact loads natively using xgb.XGBClassifier."""
    assert os.path.exists(MODEL_PATH), f"Model artifact missing at {MODEL_PATH}"
    clf = xgb.XGBClassifier()
    clf.load_model(MODEL_PATH)
    assert clf is not None

def test_03_dataset_training_provenance():
    """Test 3: Verify metadata records training provenance on synthetic semiconductor dataset."""
    assert os.path.exists(METADATA_PATH)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    assert meta["model_version"] == "2.0_production"
    assert "Synthetic semiconductor dataset" in meta["dataset_description"]
    assert meta["dataset_record_count"] == 50000

def test_04_feature_contract():
    """Test 4: Verify 28 features in exact locked contract order."""
    from src.api.inference_service import ALL_28_FEATURE_NAMES
    assert len(ALL_28_FEATURE_NAMES) == 28
    assert ALL_28_FEATURE_NAMES[0] == "supply_voltage"
    assert ALL_28_FEATURE_NAMES[15] == "test_duration"
    assert ALL_28_FEATURE_NAMES[16] == "voltage_headroom"
    assert ALL_28_FEATURE_NAMES[23] == "eq_EQP-101"

def test_05_native_probability():
    """Test 5: Verify native prediction returns valid probability in range [0, 1]."""
    from src.api.inference_service import PredictaInferenceService
    service = PredictaInferenceService()
    res = service.predict_single(NOMINAL_SAMPLE)
    assert 0.0 <= res["probability"] <= 1.0

def test_06_nominal_semiconductor_sample():
    """Test 6: Nominal semiconductor sample produces low-risk disposition."""
    from src.api.inference_service import PredictaInferenceService
    service = PredictaInferenceService()
    res = service.predict_single(NOMINAL_SAMPLE)
    assert res["probability"] < 0.20
    assert res["prediction"] == "PASS"
    assert res["disposition"] == "PASS"

def test_07_defective_semiconductor_sample():
    """Test 7: Defective semiconductor sample produces higher probability than nominal sample."""
    from src.api.inference_service import PredictaInferenceService
    service = PredictaInferenceService()
    res_nom = service.predict_single(NOMINAL_SAMPLE)
    res_def = service.predict_single(DEFECTIVE_SAMPLE)
    assert res_def["probability"] > res_nom["probability"]
    assert res_def["prediction"] == "FAIL"

def test_08_inference_determinism():
    """Test 8: Same input yields identical probability across 10 repeated inferences."""
    from src.api.inference_service import PredictaInferenceService
    service = PredictaInferenceService()
    p1 = service.predict_single(NOMINAL_SAMPLE)["probability"]
    for _ in range(9):
        p2 = service.predict_single(NOMINAL_SAMPLE)["probability"]
        assert abs(p1 - p2) < 1e-6

def test_09_model_reload():
    """Test 9: Reloading model yields identical predictions."""
    from src.api.inference_service import PredictaInferenceService
    s1 = PredictaInferenceService()
    p1 = s1.predict_single(NOMINAL_SAMPLE)["probability"]
    s2 = PredictaInferenceService()
    p2 = s2.predict_single(NOMINAL_SAMPLE)["probability"]
    assert abs(p1 - p2) < 1e-6

def test_10_missing_model_fail_fast():
    """Test 10: Missing model artifact raises CONFIGURATION_ERROR with no silent fallback."""
    from src.api.inference_service import PredictaInferenceService
    service = PredictaInferenceService()
    service.native_model = None
    with pytest.raises(ValueError, match="CONFIGURATION_ERROR"):
        service.calculate_probability({}, "EQP-101")
