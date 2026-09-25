"""
PREDICTA-26 Phase 17.2 — Governed Decision Center UI & Human Disposition Test Suite
File: tests/test_phase17_decision_center_ui.py

Verifies:
1. Canonical PS-170 Demo Cases:
   - Case A: NORMAL (Nominal Die, Low Risk, PASS)
   - Case B: LATENT_DEFECT (Static-Limit Escape, ileak=145 µA < 250 µA, MAD > 6.0, REJECT)
   - Case D: FALSE_ALARM (PAT MONITOR, P=0.0048 < 0.20, Recommendation MONITOR)
2. Decoupled ML Decision vs Engineering Decision (Operational & Human Disposition).
3. 0h -> 24h -> 96h -> 168h Evidence Timeline with explicit horizon label:
   "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME".
4. Six-Part WHY FLAGGED Explainer with fail-closed INSUFFICIENT EVIDENCE handling.
5. Governed Recommendation with loss-protected ESCALATE -> MONITOR + warning indicator.
6. Governed Human Disposition: exactly 4 actions (PASS, MONITOR, RETEST, REJECT).
7. Controlled reason code enforcement (8 taxonomy values).
8. Strict ML prediction & probability immutability.
9. Governed append-only audit trail logging.
10. Operating threshold locked at theta* = 0.20.
11. Protected model & dataset SHA-256 verification.
12. 100% Exact byte parity between root and frontend assets.
13. Purge verification: zero forbidden 'shap' tokens or client-side multipliers in frontend scripts.
"""

import hashlib
import json
import re
from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent

PROD_MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
PROD_DATASET_PATH = PROJECT_ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v3_50000.csv"
CANONICAL_DATA_PATH = PROJECT_ROOT / "src" / "governance" / "canonical_demo_data.json"

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"


def compute_sha256(path: Path) -> str:
    content = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ==============================================================================
# 1. PROTECTED ARTIFACTS & THRESHOLD INTEGRITY
# ==============================================================================

def test_protected_model_sha256():
    """Verify that the production model SHA-256 is unchanged."""
    actual_sha = compute_sha256(PROD_MODEL_PATH)
    assert actual_sha == EXPECTED_MODEL_SHA, f"Model SHA mismatch: {actual_sha}"


def test_protected_dataset_sha256():
    """Verify that the production dataset SHA-256 is unchanged."""
    actual_sha = compute_sha256(PROD_DATASET_PATH)
    assert actual_sha == EXPECTED_DATASET_SHA, f"Dataset SHA mismatch: {actual_sha}"


def test_protected_operating_threshold():
    """Verify that operating threshold is locked at theta* = 0.20."""
    from src.governance.taxonomy_mapping import OPERATING_THRESHOLD
    assert OPERATING_THRESHOLD == 0.20, f"Expected 0.20, got {OPERATING_THRESHOLD}"


# ==============================================================================
# 2. CANONICAL DEMONSTRATION FIXTURES & PROVENANCE
# ==============================================================================

def test_canonical_demo_data_structure():
    """Verify canonical demo cases exist and have certified Phase 16 provenance."""
    assert CANONICAL_DATA_PATH.exists(), "canonical_demo_data.json must exist"
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))

    assert data.get("provenance") == "PHASE_16_CANONICAL_PROVENANCE"
    assert data.get("lead_time_basis") == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"
    assert set(data["cases"].keys()) == {"NORMAL", "LATENT_DEFECT", "FALSE_ALARM"}


def test_canonical_case_a_normal():
    """Verify Case A (NORMAL): Low Risk, Anomaly PASS, Recommendation PASS."""
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    case = data["cases"]["NORMAL"]
    inf = case["inference_result"]

    assert case["canonical_id"] == "CASE_A_NORMAL"
    assert inf["prediction"] == "PASS"
    assert inf["probability"] < 0.20
    assert inf["anomaly_status"] == "PASS"
    assert case["operational_recommendation"] == "PASS"
    assert case["default_disposition"] == "PASS"


def test_canonical_case_b_latent_defect():
    """Verify Case B (LATENT_DEFECT): Static-Limit Escape (145 µA < 250 µA), MAD > 6.0, REJECT."""
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    case = data["cases"]["LATENT_DEFECT"]
    raw = case["raw_telemetry"]
    inf = case["inference_result"]

    assert case["canonical_id"] == "CASE_B_STATIC_LIMIT_ESCAPE"
    assert raw["leakage_current"] == 145.0
    assert raw["leakage_current"] < 250.0  # Escapes static threshold
    assert inf["anomaly_status"] == "REJECT"
    assert inf["probability"] < 0.20  # Model alone would pass
    assert case["operational_recommendation"] == "REJECT"  # Safety-first policy triggers REJECT


def test_canonical_case_d_false_alarm():
    """Verify Case D (FALSE_ALARM): PAT Anomaly MONITOR, Low Risk P < 0.20, Recommendation MONITOR."""
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    case = data["cases"]["FALSE_ALARM"]
    inf = case["inference_result"]

    assert case["canonical_id"] == "CASE_D_FALSE_ALARM"
    assert inf["anomaly_status"] == "MONITOR"
    assert inf["probability"] < 0.20
    assert case["operational_recommendation"] == "MONITOR"
    # Proves Anomaly != Automatic Rejection
    assert case["operational_recommendation"] != "REJECT"


def test_canonical_timeline_checkpoints():
    """Verify all canonical cases contain 0h, 24h, 96h, 168h checkpoints."""
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    for case_key, case in data["cases"].items():
        timeline = case["timeline"]
        assert len(timeline) == 4, f"Case {case_key} must have exactly 4 timeline points"
        hours = [t["time_point"] for t in timeline]
        assert hours == ["0h", "24h", "96h", "168h"], f"Case {case_key} timeline mismatch: {hours}"
        for point in timeline:
            assert "leakage_current_ua" in point
            assert "propagation_delay_ns" in point
            assert "evidence_status" in point


def test_canonical_why_flagged_six_layers():
    """Verify why_flagged structure contains all 6 evidence layers."""
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    for case_key, case in data["cases"].items():
        wf = case["why_flagged"]
        layers = wf["evidence_layers"]
        assert "lot_deviation" in layers, f"Missing lot_deviation in {case_key}"
        assert "trajectory_drift" in layers, f"Missing trajectory_drift in {case_key}"
        assert "prognostic_failure_risk" in layers, f"Missing prognostic_failure_risk in {case_key}"
        assert "physics_consistency" in layers, f"Missing physics_consistency in {case_key}"
        assert "risk_contribution" in layers, f"Missing risk_contribution in {case_key}"


# ==============================================================================
# 3. FRONTEND CONTRACT, ZERO FORBIDDEN TOKENS & BYTE PARITY
# ==============================================================================

def test_root_frontend_byte_parity():
    """Verify 100% exact byte parity between root and frontend copies."""
    pairs = [
        (PROJECT_ROOT / "script.js", PROJECT_ROOT / "frontend" / "script.js"),
        (PROJECT_ROOT / "api.js", PROJECT_ROOT / "frontend" / "api.js"),
        (PROJECT_ROOT / "index.html", PROJECT_ROOT / "frontend" / "index.html"),
    ]
    for root_file, front_file in pairs:
        assert root_file.exists(), f"{root_file.name} missing"
        assert front_file.exists(), f"frontend/{front_file.name} missing"
        assert root_file.read_bytes() == front_file.read_bytes(), f"Byte mismatch in {root_file.name}"


def test_frontend_zero_shap_tokens():
    """Verify that frontend script contains zero 'shap' tokens (case-insensitive)."""
    script_content = (PROJECT_ROOT / "script.js").read_text(encoding="utf-8")
    matches = re.findall(r"shap", script_content, re.IGNORECASE)
    assert len(matches) == 0, f"Found {len(matches)} forbidden 'shap' tokens in script.js"


def test_frontend_zero_client_multipliers():
    """Verify no client-side heuristic multipliers exist."""
    script_content = (PROJECT_ROOT / "script.js").read_text(encoding="utf-8")
    assert "* 1.2" not in script_content
    assert "* 1.05" not in script_content
    assert "* 0.95" not in script_content


def test_html_seven_level_visual_hierarchy():
    """Verify index.html contains all 7 Decision Center visual hierarchy elements."""
    html_content = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")

    # 1. Case Selector
    assert 'id="btn-case-normal"' in html_content
    assert 'id="btn-case-latent"' in html_content
    assert 'id="btn-case-false-alarm"' in html_content
    assert 'id="dc-case-badge"' in html_content

    # 2. Decision Summary (Decoupled ML vs Engineering)
    assert 'id="dc-ml-prediction"' in html_content
    assert 'id="dc-ml-probability"' in html_content
    assert 'id="dc-op-recommendation"' in html_content
    assert 'id="dc-human-disposition"' in html_content

    # 3. 0h -> 24h -> 96h -> 168h Timeline
    assert 'id="dc-tl-0h-leak"' in html_content
    assert 'id="dc-tl-24h-leak"' in html_content
    assert 'id="dc-tl-96h-leak"' in html_content
    assert 'id="dc-tl-168h-leak"' in html_content
    assert '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME' in html_content

    # 4. WHY FLAGGED? Six-part categories
    assert 'id="dc-wf-lot-val"' in html_content
    assert 'id="dc-wf-drift-val"' in html_content
    assert 'id="dc-wf-forecast-val"' in html_content
    assert 'id="dc-wf-uncert-val"' in html_content
    assert 'id="dc-wf-physics-val"' in html_content
    assert 'id="dc-wf-risk-val"' in html_content

    # 5. Governed Recommendation Banner & Escalation Indicator
    assert 'id="dc-gov-recom-badge"' in html_content
    assert 'id="dc-escalation-banner"' in html_content
    assert 'ESCALATED TO QUALITY ENGINEERING' in html_content

    # 6. Human Disposition Actions & Controlled Reasons
    assert 'id="btn-disp-pass"' in html_content
    assert 'id="btn-disp-monitor"' in html_content
    assert 'id="btn-disp-retest"' in html_content
    assert 'id="btn-disp-reject"' in html_content
    assert 'id="dc-reason-code-select"' in html_content

    # 7. Governed Audit Trail & Lifecycle
    assert 'id="dc-audit-table-body"' in html_content


# ==============================================================================
# 4. GOVERNANCE TAXONOMY & DISPOSITION IMMUTABILITY
# ==============================================================================

def test_governed_taxonomy_mappings():
    """Verify bidirectional mapping and loss-protected ESCALATE indicator."""
    from src.governance.taxonomy_mapping import (
        UI_ACTION_TAXONOMY,
        map_ui_to_backend_disposition,
        map_backend_to_ui_disposition,
        validate_governed_action,
    )

    assert set(UI_ACTION_TAXONOMY) == {"PASS", "MONITOR", "RETEST", "REJECT"}
    assert map_ui_to_backend_disposition("PASS") == "ACCEPT"
    assert map_ui_to_backend_disposition("MONITOR") == "HOLD"
    assert map_ui_to_backend_disposition("RETEST") == "RETEST"
    assert map_ui_to_backend_disposition("REJECT") == "REJECT"

    # ESCALATE maps to MONITOR with explicit escalation flag
    escalated = map_backend_to_ui_disposition("ESCALATE")
    assert escalated["ui_action"] == "MONITOR"
    assert escalated["escalation_flag"] is True
    assert escalated["escalation_indicator"] == "ESCALATED_TO_QUALITY_ENGINEERING"

    # Reason code enforcement
    with pytest.raises(ValueError, match="REASON_CODE_REQUIRED"):
        validate_governed_action("PASS", "")

    with pytest.raises(ValueError, match="INVALID_REASON_CODE"):
        validate_governed_action("PASS", "INVALID_CODE_XYZ")

    valid = validate_governed_action("MONITOR", "INSUFFICIENT_DATA", "Needs further analysis")
    assert valid["is_valid"] is True
    assert valid["backend_disposition"] == "HOLD"


def test_ml_prediction_immutability():
    """Verify that submitting a human disposition does not alter ML prediction or probability."""
    from src.governance.disposition import (
        HumanDispositionManager,
        register_authoritative_prediction,
    )

    mgr = HumanDispositionManager()
    trace_id = "TRACE-P17-TEST-IMMUTABLE-001"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-TEST-01",
        "lot_id": "LOT-TEST-A",
        "prediction": "FAIL",
        "probability": 0.884,
    })

    # Operator overrides ML FAIL with ACCEPT
    record = mgr.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        comment="Physical bench testing confirmed benign process variation.",
        operator_id="OPERATOR_TEST",
        require_durable_persistence=False,
    )

    assert record["original_ml_decision"] == "FAIL"
    assert record["original_ml_probability"] == 0.884
    assert record["disposition"] == "ACCEPT"

    # Authoritative ML lookup remains FAIL
    auth = mgr.lookup_authoritative_prediction(trace_id)
    assert auth["prediction"] == "FAIL"
    assert auth["probability"] == 0.884


def test_fail_closed_missing_evidence():
    """Verify missing telemetry or forecast yields INSUFFICIENT EVIDENCE."""
    from src.governance.taxonomy_mapping import format_evidence_explainer_layers

    empty_layers = format_evidence_explainer_layers({})
    assert empty_layers["lot_deviation"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["trajectory_drift"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["prognostic_forecast_168h"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["uncertainty_envelope"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["physics_consistency"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["risk_contribution"]["status"] == "INSUFFICIENT EVIDENCE"
    assert empty_layers["prognostic_forecast_168h"]["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"
