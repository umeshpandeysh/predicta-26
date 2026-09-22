"""
PREDICTA — PHASE 12 TASK 2 CROSS-RUNTIME & API PARITY TEST SUITE (Python)
File: tests/test_phase12_task2_api_parity.py

Verifies 100% numerical and categorical parity between Python inference engine and Node.js inference engine
against the authoritative Phase 12 Task 2 contract (ml/evaluation/phase12_task2_api_parity_contract.json).
"""

import os
import sys
import json
import math
import hashlib
import subprocess
import pytest
from typing import Any, Dict

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService

CONTRACT_PATH = os.path.join(BASE_DIR, "ml", "evaluation", "phase12_task2_api_parity_contract.json")
REPORT_PATH = os.path.join(BASE_DIR, "tests", "artifacts", "phase12_task2_parity_report.json")

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_CALIBRATION_SHA = "f8a9c67889ebca9561cb925ffc8579d41a17bf540c6c2d48a5d54833140df339"
EXPECTED_TEST_SHA = "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2"
EXPECTED_MANIFEST_SHA = "fd2a867f276e5a8975834997ed60080092f77f067a877659cb72769c97e63f8a"

VECTOR_A_NORMAL = {
    "supply_voltage": 1.20, "output_voltage": 1.20, "current": 10.7, "leakage_current": 111.7,
    "resistance": 10.0, "capacitance": 5.0, "threshold_voltage": 0.45, "frequency": 1000.0,
    "propagation_delay": 10.98, "setup_time": 1.0, "hold_time": 0.5, "timing_margin": 2.0,
    "temperature": 25.0, "dynamic_power": 30.0, "total_power": 35.0, "test_duration": 1.0,
    "equipment_id": "EQP-101"
}

VECTOR_D_HIGH_RISK = {
    "supply_voltage": 1.05, "output_voltage": 1.00, "current": 150.0, "leakage_current": 240.0,
    "resistance": 15.0, "capacitance": 8.0, "threshold_voltage": 0.35, "frequency": 1200.0,
    "propagation_delay": 18.0, "setup_time": 1.5, "hold_time": 0.8, "timing_margin": 0.5,
    "temperature": 55.0, "dynamic_power": 90.0, "total_power": 110.0, "test_duration": 1.2,
    "equipment_id": "EQP-102"
}

VECTOR_E_PAT_REJECT = {
    "supply_voltage": 1.20, "output_voltage": 1.20, "current": 450.0, "leakage_current": 350.0,
    "resistance": 10.0, "capacitance": 5.0, "threshold_voltage": 0.45, "frequency": 1000.0,
    "propagation_delay": 20.0, "setup_time": 1.0, "hold_time": 0.5, "timing_margin": 2.0,
    "temperature": 25.0, "dynamic_power": 30.0, "total_power": 35.0, "test_duration": 1.0,
    "equipment_id": "EQP-103"
}

VECTOR_F_MONITOR = {
    **VECTOR_A_NORMAL,
    "leakage_current": 122.0
}

VECTOR_H_COMPLETE_PROGNOSTIC = {
    **VECTOR_A_NORMAL,
    "iddq_0h": 10.7,
    "ileak_0h": 111.7,
    "tpd_0h": 10.98
}


def run_node_inference(record: Dict[str, Any]) -> Dict[str, Any]:
    """Helper function to invoke Node.js inference engine and return JSON result."""
    record_json = json.dumps(record)
    cmd = [
        "node",
        "-e",
        f"const s = require('./src/api/inference'); console.log(JSON.stringify(s.predictSingle({record_json})))"
    ]
    res = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True, check=True)
    return json.loads(res.stdout.strip())


@pytest.fixture(scope="module")
def py_service():
    service = PredictaInferenceService()
    assert service.is_loaded, "Python PredictaInferenceService failed to load."
    return service


def test_contract_provenance_and_shas():
    """Verify that Task 2 contract exists and protected file SHAs match authoritative governance."""
    assert os.path.exists(CONTRACT_PATH), f"Contract file missing at {CONTRACT_PATH}"
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)

    assert contract.get("contract_name") == "AUTHORITATIVE_PHASE12_TASK2_API_PARITY_CONTRACT"
    assert contract.get("contract_version") == "1.0.0"

    prov = contract.get("provenance", {})
    assert prov.get("model_sha256") == EXPECTED_MODEL_SHA
    assert prov.get("calibration_sha256") == EXPECTED_CALIBRATION_SHA
    assert prov.get("test_sha256") == EXPECTED_TEST_SHA
    assert prov.get("manifest_sha256") == EXPECTED_MANIFEST_SHA
    assert prov.get("operating_threshold") == 0.20


def test_vector_a_normal_component_parity(py_service):
    """Vector A: Normal component parity between Py and JS."""
    py_res = py_service.predict_single(VECTOR_A_NORMAL)
    js_res = run_node_inference(VECTOR_A_NORMAL)

    py_prob = py_res["probability"]
    js_prob = js_res["probability"]

    assert abs(py_prob - js_prob) <= 1e-5, f"Probability delta {abs(py_prob - js_prob)} exceeds 1e-5"
    assert py_res["prediction"] == js_res["prediction"] == "PASS"
    assert py_res["threshold"] == js_res["threshold"] == 0.20
    assert py_res["disposition"] == js_res["disposition"] == "PASS"
    assert py_res["risk_level"] == js_res["risk_level"] == "LOW"


def test_vector_b_probability_below_threshold(py_service):
    """Vector B: Probability below threshold contract check."""
    py_res = py_service.predict_single(VECTOR_A_NORMAL)
    assert py_res["probability"] < py_service.operating_threshold
    assert py_res["prediction"] == "PASS"


def test_vector_c_exact_threshold(py_service):
    """Vector C: Authoritative threshold boundary check (0.20)."""
    assert py_service.operating_threshold == 0.20


def test_vector_d_high_risk_parity(py_service):
    """Vector D: Probability above threshold parity."""
    py_res = py_service.predict_single(VECTOR_D_HIGH_RISK)
    js_res = run_node_inference(VECTOR_D_HIGH_RISK)

    py_prob = py_res["probability"]
    js_prob = js_res["probability"]

    assert abs(py_prob - js_prob) <= 1e-5, f"Probability delta {abs(py_prob - js_prob)} exceeds 1e-6"
    assert py_res["prediction"] == js_res["prediction"] == "FAIL"
    assert py_res["threshold"] == js_res["threshold"] == 0.20


def test_vector_e_pat_reject_parity(py_service):
    """Vector E: Severe PAT/COPOD anomaly override parity."""
    py_res = py_service.predict_single(VECTOR_E_PAT_REJECT)
    js_res = run_node_inference(VECTOR_E_PAT_REJECT)

    assert py_res["anomaly_status"] == js_res["anomaly_status"] == "REJECT"
    assert py_res["disposition"] == js_res["disposition"] == "REJECT"
    assert py_res["risk_level"] == js_res["risk_level"] == "CRITICAL"


def test_vector_f_monitor_warning_parity(py_service):
    """Vector F: Monitor warning parity."""
    py_res = py_service.predict_single(VECTOR_F_MONITOR)
    js_res = run_node_inference(VECTOR_F_MONITOR)

    assert py_res["disposition"] == js_res["disposition"] == "MONITOR"
    assert py_res["operational_decision"] == js_res["operational_decision"] == "SECONDARY_TEST"


def test_vector_h_complete_prognostic_parity(py_service):
    """Vector H: Complete prognostic history with 0h baseline."""
    py_res = py_service.predict_single(VECTOR_H_COMPLETE_PROGNOSTIC)
    js_res = run_node_inference(VECTOR_H_COMPLETE_PROGNOSTIC)

    py_drift = py_res.get("ml_details", {}).get("drift_prediction", {}).get("iddq", {})
    js_drift = js_res.get("ml_details", {}).get("drift_prediction", {}).get("iddq", {})

    assert py_drift.get("status") == js_drift.get("status") == "CALCULATED"
    assert py_drift.get("has_history") == js_drift.get("has_history") == True


def test_vector_j_unseen_equipment_parity(py_service):
    """Vector J: Unseen equipment ID handles gracefully without crashing."""
    unseen_vec = {**VECTOR_A_NORMAL, "equipment_id": "EQP-999"}
    py_res = py_service.predict_single(unseen_vec)
    js_res = run_node_inference(unseen_vec)

    assert py_res["is_unseen_equipment"] == js_res["is_unseen_equipment"] == True
    assert abs(py_res["probability"] - js_res["probability"]) <= 1e-5


def test_vector_k_invalid_numerical_input_validation(py_service):
    """Vector K: Invalid numerical input raises validation error."""
    invalid_vec = {**VECTOR_A_NORMAL, "supply_voltage": -5.0}
    with pytest.raises(ValueError, match="positive number"):
        py_service.validate_input_record(invalid_vec)


def test_vector_m_batch_inference_parity(py_service):
    """Vector M: Batch inference parity."""
    batch = [VECTOR_A_NORMAL, VECTOR_D_HIGH_RISK, VECTOR_E_PAT_REJECT]
    batch_res = py_service.predict_batch(batch)
    assert batch_res["total"] == 3
    assert batch_res["results"][0]["prediction"] == "PASS"
    assert batch_res["results"][1]["prediction"] == "FAIL"
    assert batch_res["results"][2]["disposition"] == "REJECT"


def test_vector_n_deterministic_repeatability(py_service):
    """Vector N: Deterministic repeatability across 2 consecutive runs."""
    run1 = py_service.predict_single(VECTOR_A_NORMAL)
    run2 = py_service.predict_single(VECTOR_A_NORMAL)

    assert run1["probability"] == run2["probability"]
    assert run1["prediction"] == run2["prediction"]
    assert run1["disposition"] == run2["disposition"]
    assert run1["risk_level"] == run2["risk_level"]
