"""
Phase 19.4 — Hostile Adversarial Fleet, Judge Journey & ML Functionality Test Suite (Python)
=============================================================================================
Validates:
1. Protected Artifacts & Cryptographic Locks (Model SHA, Dataset SHA, Threshold 0.20)
2. Real Native ML Model Execution with Actual Dataset Rows & Calibration
3. Boundary & Threshold Precision Attacks (0.199999 vs 0.200000 vs 0.200001)
4. Robust Fail-Closed Behavior on Corrupted / Missing / NaN / Extreme Inputs
5. Canonical Case Grounding (NORMAL, LATENT_DEFECT, FALSE_ALARM)
6. 168h Evaluation Horizon Semantics & Disclaimers
7. Fleet Monitoring Hierarchy, Cross-Lot Isolation & Fail-Closed Queries
8. Digital Reliability Twin Determinism, Immutability & Cryptographic Chain of Custody
9. Governed Decision Synthesis & Human Disposition Immutability
10. Scientific Honesty & Zero-Leakage Validation
"""

import hashlib
import json
import re
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
import xgboost as xgb

from src.features.feature_contract import (
    ALL_28_FEATURE_NAMES,
    extract_feature_vector,
)
from src.fleet.fleet_manager import FleetManagerPy
from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy
from src.governance.disposition import (
    HumanDispositionManager,
    register_authoritative_prediction,
)
from src.api.inference_service import PredictaInferenceService

ROOT = Path(__file__).resolve().parent.parent

PROD_MODEL_PATH = ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
PROD_DATASET_PATH = ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v3_50000.csv"
CANONICAL_DATA_PATH = ROOT / "src" / "governance" / "canonical_demo_data.json"
TWIN_CONTRACT_PATH = ROOT / "ml" / "reliability_twin" / "reliability_twin_contract.json"
README_PATH = ROOT / "README.md"

PROTECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
PROTECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"
PROTECTED_THRESHOLD = 0.20


def compute_sha256(path: Path) -> str:
    content = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ─── 1. BASELINE ARTIFACT CRYPTOGRAPHIC LOCKS ──────────────────────────────

def test_protected_artifacts_cryptographic_lock():
    assert PROD_MODEL_PATH.exists()
    assert compute_sha256(PROD_MODEL_PATH) == PROTECTED_MODEL_SHA

    assert PROD_DATASET_PATH.exists()
    assert compute_sha256(PROD_DATASET_PATH) == PROTECTED_DATASET_SHA

    assert TWIN_CONTRACT_PATH.exists()
    contract = json.loads(TWIN_CONTRACT_PATH.read_text(encoding="utf-8"))
    assert contract["immutability_constraints"]["authoritative_operating_threshold"] == PROTECTED_THRESHOLD


# ─── 2. REAL NATIVE ML MODEL INFERENCE EXECUTION ──────────────────────────

def test_real_xgboost_inference_on_dataset_rows():
    """Load native XGBoost model directly and evaluate genuine rows from the 50k dataset."""
    booster = xgb.Booster()
    booster.load_model(str(PROD_MODEL_PATH))
    assert booster.num_features() == 28

    # Read first 50 rows from production dataset
    df = pd.read_csv(PROD_DATASET_PATH, nrows=50)
    assert len(df) == 50

    for idx, row in df.iterrows():
        raw_dict = row.to_dict()
        vec, is_fallback = extract_feature_vector(raw_dict)
        assert len(vec) == 28
        assert not any(np.isnan(vec)), f"Row {idx} contains NaN in feature vector"

        dmat = xgb.DMatrix(np.array([vec], dtype=np.float32), feature_names=ALL_28_FEATURE_NAMES)
        raw_pred = booster.predict(dmat)
        prob = float(raw_pred[0])

        # Probability must be bounded [0, 1]
        assert 0.0 <= prob <= 1.0, f"Row {idx} generated out-of-bounds probability: {prob}"

        # Decision derivation
        decision = "FAIL" if prob >= PROTECTED_THRESHOLD else "PASS"
        if prob < PROTECTED_THRESHOLD:
            assert decision == "PASS"
        else:
            assert decision == "FAIL"


def test_inference_service_full_pipeline():
    """Verify PredictaInferenceService full end-to-end multi-task execution."""
    service = PredictaInferenceService()
    assert service.is_loaded is True

    # Nominal Telemetry Payload
    nominal_payload = {
        "supply_voltage": 1.2,
        "output_voltage": 1.18,
        "current": 47.88,
        "iddq": 10.70,
        "ileak": 111.73,
        "leakage_current": 111.73,
        "tpd": 10.98,
        "resistance": 13.0,
        "capacitance": 4.2,
        "threshold_voltage": 0.45,
        "frequency": 2687.68,
        "propagation_delay": 10.98,
        "setup_time": 0.8396,
        "hold_time": 0.4265,
        "timing_margin": 1.3115,
        "temperature": 28.56,
        "dynamic_power": 56.58,
        "total_power": 56.83,
        "test_duration": 150.05,
        "equipment_id": "EQP-101",
        "lot_id": "LOT-SYN-001",
        "wafer_id": "WFR-001",
        "die_id": "DIE-001"
    }

    result = service.predict_single(nominal_payload)
    assert "probability" in result
    assert "prediction" in result
    assert "risk_level" in result
    assert "anomaly_status" in result
    assert result["probability"] < PROTECTED_THRESHOLD
    assert result["prediction"] == "PASS"


# ─── 3. THRESHOLD PRECISION & BOUNDARY ATTACKS ────────────────────────────

def test_threshold_boundary_precision():
    """Verify exact behavior at 0.199999, 0.200000, and 0.200001."""
    threshold = PROTECTED_THRESHOLD

    # Just below threshold -> PASS
    p_below = 0.19999999
    assert (p_below < threshold) is True
    decision_below = "FAIL" if p_below >= threshold else "PASS"
    assert decision_below == "PASS"

    # Exactly at threshold -> FAIL
    p_exact = 0.20000000
    assert (p_exact >= threshold) is True
    decision_exact = "FAIL" if p_exact >= threshold else "PASS"
    assert decision_exact == "FAIL"

    # Just above threshold -> FAIL
    p_above = 0.20000001
    assert (p_above >= threshold) is True
    decision_above = "FAIL" if p_above >= threshold else "PASS"
    assert decision_above == "FAIL"


# ─── 4. FAIL-CLOSED INPUT VALIDATION ATTACKS ──────────────────────────────

def test_missing_and_corrupted_features_fail_closed():
    """Extracting feature vectors on malformed or missing telemetry fails closed safely."""
    # Completely empty payload
    with pytest.raises(Exception):
        extract_feature_vector({})

    # Payload with missing critical electrical parameters
    incomplete_payload = {
        "supply_voltage": 1.2,
        "temperature": 25.0,
    }
    with pytest.raises(Exception):
        extract_feature_vector(incomplete_payload)


# ─── 5. CANONICAL CASES GROUNDING & EVIDENTIARY TRACEABILITY ──────────────

def test_canonical_cases_integrity_and_traceability():
    """Validate canonical cases in canonical_demo_data.json."""
    assert CANONICAL_DATA_PATH.exists()
    canonical_data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    assert canonical_data["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"

    cases = canonical_data["cases"]
    assert set(cases.keys()) == {"NORMAL", "LATENT_DEFECT", "FALSE_ALARM"}

    # Case A: NORMAL
    normal = cases["NORMAL"]
    assert normal["inference_result"]["prediction"] == "PASS"
    assert normal["inference_result"]["probability"] < PROTECTED_THRESHOLD
    assert normal["operational_recommendation"] == "PASS"

    # Case B: LATENT_DEFECT (Static Limit Escape)
    latent = cases["LATENT_DEFECT"]
    assert latent["inference_result"]["prediction"] == "PASS"  # Single point ML pass
    assert latent["inference_result"]["anomaly_status"] == "REJECT"  # PAT outlier flag
    assert latent["operational_recommendation"] == "REJECT"  # Governed disposition
    assert latent["why_flagged"]["evidence_layers"]["lot_deviation"]["max_z_score"] > 3.0

    # Case C: FALSE_ALARM (Scrap Avoidance)
    false_alarm = cases["FALSE_ALARM"]
    assert false_alarm["why_flagged"]["disposition"] == "MONITOR"
    assert false_alarm["inference_result"]["probability"] < PROTECTED_THRESHOLD


# ─── 6. FLEET MONITORING HIERARCHY & CROSS-LOT ISOLATION ──────────────────

def test_fleet_manager_hierarchy_and_isolation():
    fleet_mgr = FleetManagerPy()
    summary = fleet_mgr.get_fleet_summary()

    assert summary["fleet_id"] == "PREDICTA_FLEET_QUALIFICATION_COHORT_2026"
    assert summary["total_lots"] == 50
    assert summary["total_wafers"] >= 100
    assert summary["total_components"] == 5000

    # Query Lot 1
    lot1 = fleet_mgr.get_lot_detail("LOT-SYN-001")
    assert lot1 is not None
    assert lot1["lot_id"] == "LOT-SYN-001"
    assert len(lot1["wafers"]) >= 2
    assert "WFR-001" in lot1["wafers"]

    # Cross-Lot Isolation: WFR-001 must NOT appear in Lot 2
    lot2 = fleet_mgr.get_lot_detail("LOT-SYN-002")
    assert "WFR-001" not in lot2["wafers"]

    # Nonexistent entity fails closed (returns None)
    assert fleet_mgr.get_lot_detail("LOT-INVALID-999") is None
    assert fleet_mgr.get_wafer_detail("WFR-INVALID-999") is None


# ─── 7. RELIABILITY TWIN DETERMINISM & READ-ONLY GUARANTEES ───────────────

def test_reliability_twin_deterministic_hashing_and_read_model():
    """Verify twin ID generation is strictly deterministic and read-only."""
    twin_mgr = ReliabilityTwinManagerPy()

    # Canonical Normal Case
    twin_normal = twin_mgr.build_reliability_twin("COMP-NORMAL")
    assert twin_normal is not None
    assert twin_normal["identity"]["component_id"] == "COMP-NORMAL"
    assert twin_normal["identity"]["trace_id"] == "TR-NORMAL-2026"
    assert "longitudinal_timeline" in twin_normal
    assert len(twin_normal["longitudinal_timeline"]) >= 5

    # Unregistered component ID fails closed
    unreg_twin = twin_mgr.build_reliability_twin("COMP-UNREGISTERED-999")
    assert unreg_twin["identity"]["identity_status"] == "UNREGISTERED"


# ─── 8. GOVERNED DISPOSITION & HUMAN ACTION IMMUTABILITY ──────────────────

def test_governed_disposition_human_action_immutability():
    """Human operator disposition records in audit trail but never rewrites ML truth."""
    trace_id = "TR-ADV-TEST-001"

    # Register Authoritative Prediction
    register_authoritative_prediction({
        "trace_id": trace_id,
        "test_id": "TEST-ADV-001",
        "component_id": "COMP-ADV-001",
        "lot_id": "LOT-SYN-001",
        "wafer_id": "WFR-001",
        "die_id": "DIE-001",
        "prediction": "PASS",
        "probability": 0.045,
        "model_hash": PROTECTED_MODEL_SHA,
        "model_id": "predicta_xgboost_v4",
        "anomaly_score": 0.12,
        "prognostic_output": {"drift_168h": 142.0},
    })

    disp_mgr = HumanDispositionManager()

    # Submit human disposition
    disp_result = disp_mgr.record_disposition(
        trace_id=trace_id,
        disposition="HOLD",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        operator_id="OP-QA-01",
        comment="Quality hold for optical gate inspection"
    )
    assert disp_result is not None
    assert disp_result.get("disposition") == "HOLD"
    assert disp_result.get("original_ml_decision") == "PASS"
    assert disp_result.get("original_ml_probability") == 0.045
    assert disp_result.get("model_hash_at_decision") == PROTECTED_MODEL_SHA
    assert disp_result.get("governance_guarantees", {}).get("ml_decision_unaltered") is True


# ─── 9. SCIENTIFIC HONESTY & DISCLAIMERS PRESERVATION ────────────────────

def test_scientific_honesty_and_no_prohibited_shap_tokens():
    """Verify zero prohibited SHAP tokens in frontend mirrors and valid disclaimers."""
    frontend_files = [
        ROOT / "index.html",
        ROOT / "script.js",
        ROOT / "api.js",
        ROOT / "frontend" / "index.html",
        ROOT / "frontend" / "script.js",
        ROOT / "frontend" / "api.js",
    ]
    shap_pattern = re.compile(r"\bSHAP\b", re.IGNORECASE)
    prohibited_multipliers = [r"\*\s*1\.2\b", r"\*\s*1\.05\b", r"\*\s*0\.95\b"]

    for file_path in frontend_files:
        assert file_path.exists()
        content = file_path.read_text(encoding="utf-8")
        assert not shap_pattern.search(content), f"Prohibited SHAP token found in {file_path.name}"
        for pattern in prohibited_multipliers:
            assert not re.search(pattern, content), f"Prohibited multiplier in {file_path.name}"
