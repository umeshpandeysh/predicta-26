"""
PREDICTA-26 Phase 17.3 — Governance Stress & Adversarial Validation Suite (Python)
File: tests/test_phase17_adversarial_governance.py

Attacks the Phase 17.1 + Phase 17.2 implementation across all 13 Attack Classes:
  Attack Class A — ML Output Mutation
  Attack Class B — Threshold Tampering
  Attack Class C — Model / Dataset Identity Tampering
  Attack Class D — Invalid Human Dispositions
  Attack Class E — Missing / Invalid Reason & Oversized Comment
  Attack Class F — Frontend Bypass & Identity Taint
  Attack Class G — Missing Evidence / Fail-Closed
  Attack Class H — ESCALATE Semantic Loss
  Attack Class I — Human Disposition vs ML Decision Separation
  Attack Class J — Case ID / Data Tampering
  Attack Class K — Audit Trail Integrity
  Attack Class L — Protected Scientific Provenance
  Attack Class M — Fixture / Attribution Integrity
"""

import hashlib
import json
from pathlib import Path
import pytest

from src.governance.taxonomy_mapping import (
    OPERATING_THRESHOLD,
    REASON_CODE_TAXONOMY,
    UI_ACTION_TAXONOMY,
    derive_operational_recommendation,
    format_evidence_explainer_layers,
    map_backend_to_ui_disposition,
    map_ui_to_backend_disposition,
    validate_governed_action,
)
from src.governance.disposition import (
    HumanDispositionManager,
    register_authoritative_prediction,
)

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
# ATTACK CLASS A — ML OUTPUT MUTATION
# ==============================================================================

def test_attack_a_client_ml_output_mutation_rejected():
    """Attack A.1: Client attempts to inject fake ML prediction and probability."""
    mgr = HumanDispositionManager()
    trace_id = "TRACE-ADV-A-001"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-ADV-01",
        "lot_id": "LOT-ADV-A",
        "prediction": "FAIL",
        "probability": 0.884,
        "anomaly_status": "REJECT",
        "anomaly_score": 0.95
    })

    # Attacker tries to inject client-controlled ML fields
    prohibited_payloads = [
        {"ml_decision": "PASS"},
        {"original_ml_decision": "PASS"},
        {"probability": 0.001},
        {"anomaly_score": 0.02},
        {"anomaly_status": "PASS"},
        {"prognostic_output": {"leakage_168h": 50.0}},
        {"ground_truth": "PASS"}
    ]

    for payload in prohibited_payloads:
        with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
            mgr.record_disposition(
                trace_id=trace_id,
                disposition="ACCEPT",
                reason_code="FALSE_POSITIVE_SUSPECTED",
                operator_id="ATTACKER_01",
                require_durable_persistence=False,
                **payload
            )


def test_attack_a_registered_prediction_remains_immutable():
    """Attack A.2: Human disposition must not alter original ML prediction or probability."""
    mgr = HumanDispositionManager()
    trace_id = "TRACE-ADV-A-002"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-ADV-02",
        "lot_id": "LOT-ADV-A",
        "prediction": "FAIL",
        "probability": 0.942,
    })

    record = mgr.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        comment="Physical re-bench nominal.",
        operator_id="OPERATOR_SENIOR",
        require_durable_persistence=False,
    )

    # Human decision recorded separately
    assert record["disposition"] == "ACCEPT"
    assert record["original_ml_decision"] == "FAIL"
    assert record["original_ml_probability"] == 0.942

    # Authoritative store lookup unchanged
    auth = mgr.lookup_authoritative_prediction(trace_id)
    assert auth["prediction"] == "FAIL"
    assert auth["probability"] == 0.942


# ==============================================================================
# ATTACK CLASS B — THRESHOLD TAMPERING
# ==============================================================================

def test_attack_b_production_threshold_tamper_rejected():
    """Attack B: Client input cannot alter the locked 0.20 operating threshold."""
    # 1. Constant is strictly locked
    assert OPERATING_THRESHOLD == 0.20

    # 2. Recommendation logic strictly enforces theta* = 0.20
    # Exactly above threshold: must REJECT
    assert derive_operational_recommendation("PASS", 0.200001) == "REJECT"

    # Below threshold: must not REJECT based on probability alone
    assert derive_operational_recommendation("PASS", 0.199999) in ("PASS", "MONITOR")

    # Safety margin: probability >= 0.10 flags MONITOR
    assert derive_operational_recommendation("PASS", 0.10) == "MONITOR"
    assert derive_operational_recommendation("PASS", 0.05) == "PASS"


# ==============================================================================
# ATTACK CLASS C — MODEL / DATASET IDENTITY TAMPERING
# ==============================================================================

def test_attack_c_client_model_identity_tamper_rejected():
    """Attack C.1: Client attempts to supply custom model_id or model_hash."""
    mgr = HumanDispositionManager()
    trace_id = "TRACE-ADV-C-001"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-ADV-03",
        "lot_id": "LOT-ADV-A",
        "prediction": "FAIL",
        "probability": 0.75,
    })

    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        mgr.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            model_hash="0000000000000000000000000000000000000000000000000000000000000000",
            require_durable_persistence=False,
        )

    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        mgr.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            model_id="malicious_model_v9",
            require_durable_persistence=False,
        )


def test_attack_c_protected_artifacts_cryptographic_hashes():
    """Attack C.2: Verify production model and dataset cryptographic integrity."""
    actual_model_sha = compute_sha256(PROD_MODEL_PATH)
    assert actual_model_sha == EXPECTED_MODEL_SHA, f"Production Model tampered: {actual_model_sha}"

    actual_dataset_sha = compute_sha256(PROD_DATASET_PATH)
    assert actual_dataset_sha == EXPECTED_DATASET_SHA, f"Production Dataset tampered: {actual_dataset_sha}"


# ==============================================================================
# ATTACK CLASS D — INVALID HUMAN DISPOSITIONS
# ==============================================================================

def test_attack_d_invalid_ui_actions_rejected():
    """Attack D.1: Submit values outside the 4 controlled UI actions."""
    assert set(UI_ACTION_TAXONOMY) == {"PASS", "MONITOR", "RETEST", "REJECT"}
    invalid_ui_actions = [
        "APPROVE", "ACCEPT", "FAIL", "HOLD", "ESCALATE", "PASS123",
        "REJECT_DEFECT", "monitor", "pass", "", "   ", None, 123
    ]

    for invalid_action in invalid_ui_actions:
        with pytest.raises((ValueError, TypeError)):
            map_ui_to_backend_disposition(invalid_action)


def test_attack_d_invalid_backend_dispositions_rejected():
    """Attack D.2: Submit values outside the 5 backend governance taxonomy states."""
    invalid_backend_disps = [
        "PASS", "MONITOR", "APPROVE", "OVERRIDE", "DISMISS", "", None, 999
    ]

    for invalid_disp in invalid_backend_disps:
        with pytest.raises((ValueError, TypeError)):
            map_backend_to_ui_disposition(invalid_disp)


# ==============================================================================
# ATTACK CLASS E — MISSING / INVALID REASON & OVERSIZED COMMENT
# ==============================================================================

def test_attack_e_missing_or_empty_reason_rejected():
    """Attack E.1: Submit disposition with missing or empty reason."""
    invalid_reasons = ["", "   ", None, 0, False]

    for r in invalid_reasons:
        with pytest.raises(ValueError, match="REASON_CODE_REQUIRED"):
            validate_governed_action("PASS", r)


def test_attack_e_unrecognized_reason_rejected():
    """Attack E.2: Submit reason not in the 8-value controlled taxonomy."""
    assert len(REASON_CODE_TAXONOMY) == 8
    invalid_codes = ["FABRICATED_REASON", "CUSTOM_OVERRIDE", "BENIGN", "TRUE_DEFECT"]

    for code in invalid_codes:
        with pytest.raises(ValueError, match="INVALID_REASON_CODE"):
            validate_governed_action("PASS", code)


def test_attack_e_comment_boundary_and_oversize():
    """Attack E.3: Comment length boundary checks (max 1000 characters)."""
    # 1000 chars: allowed
    valid_comment = "A" * 1000
    res = validate_governed_action("PASS", "MANUAL_ENGINEERING_REVIEW", valid_comment)
    assert res["is_valid"] is True
    assert len(res["comment"]) == 1000

    # 1001 chars: rejected
    oversized_comment = "A" * 1001
    with pytest.raises(ValueError, match="COMMENT_TOO_LONG"):
        validate_governed_action("PASS", "MANUAL_ENGINEERING_REVIEW", oversized_comment)


# ==============================================================================
# ATTACK CLASS F — FRONTEND BYPASS & IDENTITY TAINT
# ==============================================================================

def test_attack_f_client_controlled_identity_rejected():
    """Attack F.1: Client attempts to override component_id or lot_id."""
    mgr = HumanDispositionManager()
    trace_id = "TRACE-ADV-F-001"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-AUTH-001",
        "lot_id": "LOT-AUTH-001",
        "prediction": "PASS",
        "probability": 0.05,
    })

    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        mgr.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            component_id="COMP-SPOOFED-999",
            require_durable_persistence=False,
        )

    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        mgr.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            lot_id="LOT-SPOOFED-999",
            require_durable_persistence=False,
        )


def test_attack_f_missing_authoritative_record_fails_closed():
    """Attack F.2: Submitting disposition for non-existent trace fails closed."""
    mgr = HumanDispositionManager()
    with pytest.raises(ValueError, match="AUTHORITATIVE_ML_RECORD_NOT_FOUND"):
        mgr.record_disposition(
            trace_id="TRACE-DOES-NOT-EXIST-404",
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            require_durable_persistence=False,
        )


# ==============================================================================
# ATTACK CLASS G — MISSING EVIDENCE / FAIL-CLOSED
# ==============================================================================

def test_attack_g_missing_evidence_fail_closed():
    """Attack G: Absent or empty evidence must strictly format as INSUFFICIENT EVIDENCE."""
    empty_payloads = [{}, None]

    for p in empty_payloads:
        layers = format_evidence_explainer_layers(p)
        assert layers["lot_deviation"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["trajectory_drift"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["prognostic_forecast_168h"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["uncertainty_envelope"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["physics_consistency"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["risk_contribution"]["status"] == "INSUFFICIENT EVIDENCE"
        assert layers["prognostic_forecast_168h"]["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"


# ==============================================================================
# ATTACK CLASS H — ESCALATE SEMANTIC LOSS PROTECTION
# ==============================================================================

def test_attack_h_escalate_preserves_indicator():
    """Attack H: ESCALATE mapped to MONITOR must preserve explicit escalation indicator."""
    escalate_mapping = map_backend_to_ui_disposition("ESCALATE")
    hold_mapping = map_backend_to_ui_disposition("HOLD")

    # Both map to UI action MONITOR
    assert escalate_mapping["ui_action"] == "MONITOR"
    assert hold_mapping["ui_action"] == "MONITOR"

    # But ESCALATE strictly preserves escalation flag and indicator
    assert escalate_mapping["escalation_flag"] is True
    assert escalate_mapping["escalation_indicator"] == "ESCALATED_TO_QUALITY_ENGINEERING"
    assert "ESCALATED" in escalate_mapping["display_label"]

    # HOLD does NOT have escalation flag
    assert hold_mapping["escalation_flag"] is False
    assert hold_mapping["escalation_indicator"] is None


# ==============================================================================
# ATTACK CLASS I — HUMAN DISPOSITION VS ML DECISION SEPARATION
# ==============================================================================

def test_attack_i_all_canonical_governance_combinations():
    """Attack I: Test all 4 governance override combinations on canonical cases."""
    mgr = HumanDispositionManager()

    combinations = [
        ("TRACE-CANON-01", "FAIL", 0.85, "ACCEPT", "FALSE_POSITIVE_SUSPECTED"),
        ("TRACE-CANON-02", "PASS", 0.02, "RETEST", "RETEST_REQUIRED"),
        ("TRACE-CANON-03", "FAIL", 0.72, "HOLD", "INSUFFICIENT_DATA"),
        ("TRACE-CANON-04", "PASS", 0.04, "REJECT", "FALSE_NEGATIVE_SUSPECTED"),
    ]

    for trace_id, ml_pred, ml_prob, human_disp, reason in combinations:
        register_authoritative_prediction({
            "trace_id": trace_id,
            "component_id": f"COMP-{trace_id[-4:]}",
            "lot_id": "LOT-CANON",
            "prediction": ml_pred,
            "probability": ml_prob,
        })

        record = mgr.record_disposition(
            trace_id=trace_id,
            disposition=human_disp,
            reason_code=reason,
            require_durable_persistence=False,
        )

        assert record["original_ml_decision"] == ml_pred
        assert record["original_ml_probability"] == ml_prob
        assert record["disposition"] == human_disp
        assert record["reason_code"] == reason

        # Authoritative lookup is still original ML
        auth = mgr.lookup_authoritative_prediction(trace_id)
        assert auth["prediction"] == ml_pred
        assert auth["probability"] == ml_prob


# ==============================================================================
# ATTACK CLASS J — CASE ID / DATA TAMPERING
# ==============================================================================

def test_attack_j_canonical_cases_strict_registry():
    """Attack J: Only the 3 certified canonical cases can be queried."""
    assert CANONICAL_DATA_PATH.exists()
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    valid_keys = set(data["cases"].keys())

    assert valid_keys == {"NORMAL", "LATENT_DEFECT", "FALSE_ALARM"}

    malicious_keys = [
        "../package.json", "..%2F..%2Fetc%2Fpasswd", "NORMAL; DROP TABLE",
        "CASE_X", "CUSTOM", "", "null"
    ]
    for k in malicious_keys:
        assert k not in data["cases"], f"Malformed case key '{k}' unexpectedly matched canonical registry!"


# ==============================================================================
# ATTACK CLASS K — AUDIT TRAIL INTEGRITY
# ==============================================================================

def test_attack_k_audit_record_integrity():
    """Attack K: Audit trail preserves full provenance without truncation or mutation."""
    mgr = HumanDispositionManager()
    trace_id = "TRACE-AUDIT-TEST-001"

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-AUDIT-01",
        "lot_id": "LOT-AUDIT-01",
        "prediction": "FAIL",
        "probability": 0.812,
    })

    record = mgr.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        comment="Detailed bench testing audit log comment.",
        operator_id="AUDITOR_01",
        require_durable_persistence=False,
    )

    assert "disposition_id" in record
    assert "created_at" in record or "timestamp" in record
    assert record["trace_id"] == trace_id
    assert record["component_id"] == "COMP-AUDIT-01"
    assert record["lot_id"] == "LOT-AUDIT-01"
    assert record["original_ml_decision"] == "FAIL"
    assert record["original_ml_probability"] == 0.812
    assert record["disposition"] == "ACCEPT"
    assert record["reason_code"] == "MANUAL_ENGINEERING_REVIEW"
    assert record["comment"] == "Detailed bench testing audit log comment."


# ==============================================================================
# ATTACK CLASS L — PROTECTED SCIENTIFIC PROVENANCE
# ==============================================================================

def test_attack_l_scientific_provenance_explicit():
    """Attack L: Provenance must explicitly state 168H evaluation horizon, NOT failure time."""
    from src.governance.taxonomy_mapping import LEAD_TIME_BASIS
    assert LEAD_TIME_BASIS == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"

    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    assert data["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"
    assert data["provenance"] == "PHASE_16_CANONICAL_PROVENANCE"


# ==============================================================================
# ATTACK CLASS M — FIXTURE / ATTRIBUTION INTEGRITY
# ==============================================================================

def test_attack_m_fixture_attribution_disclaimer_and_no_shap():
    """Attack M: Attributions must include explicit disclaimer and zero 'shap' tokens."""
    raw_text = CANONICAL_DATA_PATH.read_text(encoding="utf-8")
    data = json.loads(raw_text)

    # 1. Zero 'shap' tokens in canonical data
    import re
    assert re.search(r"shap", raw_text, re.IGNORECASE) is None

    # 2. Disclaimer present in each case's risk contribution
    for case_key, c in data["cases"].items():
        rc = c["why_flagged"]["evidence_layers"]["risk_contribution"]
        assert rc["disclaimer"] == "MODEL ATTRIBUTION — NOT A CAUSAL CLAIM", f"Missing disclaimer in {case_key}"
        assert "top_features" in rc
        assert rc["status"] == "ATTRIBUTION_COMPUTED"
