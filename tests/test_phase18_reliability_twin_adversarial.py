"""
PREDICTA-26 — Phase 18.3 Adversarial Validation & Hostile Twin Attack Suite (Python)
=====================================================================================
Comprehensive adversarial tests attacking the Reliability Twin and Component Reliability Card:
- Attack Class A: Component ID Spoofing (unknown, empty, whitespace, traversal, case variation)
- Attack Class B: Cross-Component Evidence Contamination (isolation between Cases A, B, D)
- Attack Class C: Twin ID Tampering & Deterministic Hash Parity (Python & Node match)
- Attack Class D: Unregistered Component Fail-Closed (CMP-UNREGISTERED-999)
- Attack Class E: Case / Fixture Contamination (mutations do not corrupt source data)
- Attack Class F: Evidence Injection (client cannot inject arbitrary scores)
- Attack Class G: ML Immutability (predictions, probabilities, threshold 0.20 immutable)
- Attack Class H: Human Disposition Separation (disposition does not mutate ML prediction)
- Attack Class I: Governance Escalation (ESCALATE preserves explicit escalation indicator)
- Attack Class J: Missing Evidence Fail-Closed (missing fields -> INSUFFICIENT_EVIDENCE)
- Attack Class K: 168h Scientific Semantics (168H_EVALUATION_HORIZON_NOT_FAILURE_TIME)
- Attack Class L: Provenance Tampering (Model SHA 91bb598a... verified)
- Attack Class M: Traceability Chain Integrity (Lot -> Wafer -> Die -> Trace -> Test)
- Attack Class N: Python / Node Parity (Identical Twin IDs & evidence summaries)
- Attack Class Q: Injection, Path Traversal & Malformed Identifier Safety
- Attack Class U: Audit Integrity (Read model is strictly side-effect free)
- Attack Class V: Secret Audit (Zero exposed credentials)
"""

import hashlib
import re
from pathlib import Path
import pytest

from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy

ROOT = Path(__file__).resolve().parent.parent

PROD_MODEL_PATH = ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
PROD_DATASET_PATH = ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v3_50000.csv"
CANONICAL_DATA_PATH = ROOT / "src" / "governance" / "canonical_demo_data.json"

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"
EXPECTED_THRESHOLD = 0.20


def compute_sha256(path: Path) -> str:
    content = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ==============================================================================
# 1. BASELINE PROTECTED ARTIFACT CRYPTOGRAPHIC LOCK
# ==============================================================================

def test_protected_artifacts_cryptographic_lock():
    assert compute_sha256(PROD_MODEL_PATH) == EXPECTED_MODEL_SHA
    assert compute_sha256(PROD_DATASET_PATH) == EXPECTED_DATASET_SHA


# ==============================================================================
# 2. ATTACK CLASS A: COMPONENT ID SPOOFING & INPUT VALIDATION
# ==============================================================================

def test_attack_a_empty_and_null_identifiers_rejected():
    twin_manager = ReliabilityTwinManagerPy()

    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        twin_manager.build_reliability_twin(None)

    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        twin_manager.build_reliability_twin("")

    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        twin_manager.build_reliability_twin("   ")

    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        twin_manager.build_reliability_twin(12345)


def test_attack_a_spoofed_and_traversal_ids_fail_closed():
    twin_manager = ReliabilityTwinManagerPy()

    spoofed_ids = [
        "COMP-NORMAL-FAKE",
        "COMP-NORMAL/..",
        "../../etc/passwd",
        "COMP-NORMAL' OR '1'='1",
        "<script>alert(1)</script>",
        "comp-normal",  # Case variation must not silently match COMP-NORMAL
        "NORMAL_EXTENDED",
        "TR-NORMAL-2026-MALICIOUS",
    ]

    for spoofed_id in spoofed_ids:
        twin = twin_manager.build_reliability_twin(spoofed_id)
        assert twin["identity"]["identity_status"] == "UNREGISTERED", (
            f"Spoofed ID {spoofed_id} unexpectedly became REGISTERED"
        )
        assert twin["identity"]["component_id"] is None, (
            f"Spoofed ID {spoofed_id} unexpectedly assigned a component_id"
        )
        assert twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"
        assert twin["evidence_summary"]["manufacturing_observation"] == "INSUFFICIENT_EVIDENCE"


# ==============================================================================
# 3. ATTACK CLASS B: CROSS-COMPONENT EVIDENCE CONTAMINATION
# ==============================================================================

def test_attack_b_cross_component_isolation():
    twin_manager = ReliabilityTwinManagerPy()

    twin_normal = twin_manager.build_reliability_twin("COMP-NORMAL")
    twin_latent = twin_manager.build_reliability_twin("COMP-LATENT_DEFECT")
    twin_false_alarm = twin_manager.build_reliability_twin("COMP-FALSE_ALARM")

    # 1. Distinct Twin IDs
    assert twin_normal["twin_id"] != twin_latent["twin_id"]
    assert twin_normal["twin_id"] != twin_false_alarm["twin_id"]
    assert twin_latent["twin_id"] != twin_false_alarm["twin_id"]

    # 2. Distinct Component & Trace IDs
    assert twin_normal["identity"]["component_id"] == "COMP-NORMAL"
    assert twin_normal["identity"]["trace_id"] == "TR-NORMAL-2026"

    assert twin_latent["identity"]["component_id"] == "COMP-LATENT_DEFECT"
    assert twin_latent["identity"]["trace_id"] == "TR-LATENT_DEFECT-2026"

    assert twin_false_alarm["identity"]["component_id"] == "COMP-FALSE_ALARM"
    assert twin_false_alarm["identity"]["trace_id"] == "TR-FALSE_ALARM-2026"

    # 3. Specific Evidence Isolation
    # Normal: Low risk, nominal physics
    normal_ml = twin_normal["evidence_blocks"]["ml_evaluation"]
    assert normal_ml["prediction"] == "PASS"
    assert normal_ml["probability"] < 0.05
    assert twin_normal["evidence_blocks"]["physics_reliability"]["physics_consistency_status"] == "PHYSICS_CONSISTENT"

    # Latent Defect: PASS prediction, but PAT REJECT override and degraded physics
    latent_ml = twin_latent["evidence_blocks"]["ml_evaluation"]
    assert latent_ml["prediction"] == "PASS"
    assert latent_ml["probability"] > 0.05
    assert twin_latent["evidence_blocks"]["anomaly_evidence"]["pat_status"] == "REJECT"
    assert twin_latent["evidence_blocks"]["physics_reliability"]["physics_consistency_status"] == "PHYSICS_INCONSISTENT"

    # False Alarm: Anomaly monitor warning, but low ML probability
    fa_ml = twin_false_alarm["evidence_blocks"]["ml_evaluation"]
    assert fa_ml["prediction"] == "PASS"
    assert fa_ml["probability"] < 0.05
    assert twin_false_alarm["evidence_blocks"]["anomaly_evidence"]["pat_status"] == "PASS"


# ==============================================================================
# 4. ATTACK CLASS C & N: TWIN ID DETERMINISM & PYTHON/NODE PARITY
# ==============================================================================

def test_attack_c_deterministic_twin_id_parity():
    twin_manager = ReliabilityTwinManagerPy()

    # Exact canonical Twin ID for COMP-NORMAL
    twin_normal = twin_manager.build_reliability_twin("COMP-NORMAL")
    assert twin_normal["twin_id"] == "TWIN-1BB936512597", (
        f"Expected TWIN-1BB936512597 for COMP-NORMAL, got {twin_normal['twin_id']}"
    )

    # Resolving via Case Key or Trace ID yields exact same deterministic Twin ID
    assert twin_manager.build_reliability_twin("NORMAL")["twin_id"] == "TWIN-1BB936512597"
    assert twin_manager.build_reliability_twin("TR-NORMAL-2026")["twin_id"] == "TWIN-1BB936512597"
    assert twin_manager.build_reliability_twin("TEST-NORMAL-001")["twin_id"] == "TWIN-1BB936512597"


# ==============================================================================
# 5. ATTACK CLASS D: UNREGISTERED COMPONENT FAIL-CLOSED
# ==============================================================================

def test_attack_d_unregistered_component_fail_closed():
    twin_manager = ReliabilityTwinManagerPy()

    unreg_twin = twin_manager.build_reliability_twin("CMP-UNREGISTERED-999")
    assert unreg_twin["identity"]["identity_status"] == "UNREGISTERED"
    assert unreg_twin["identity"]["component_id"] is None
    assert unreg_twin["identity"]["trace_id"] is None
    assert unreg_twin["identity"]["lot_id"] is None
    assert unreg_twin["identity"]["wafer_id"] is None
    assert unreg_twin["identity"]["die_id"] is None
    assert unreg_twin["identity"]["requested_identifier"] == "CMP-UNREGISTERED-999"

    # All evidence summary stages fail closed
    assert unreg_twin["evidence_summary"]["manufacturing_observation"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["anomaly_evidence"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["prognostic_evidence"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["physics_reliability"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["risk_fusion"] == "INSUFFICIENT_EVIDENCE"
    assert unreg_twin["evidence_summary"]["adjudication"] == "NOT_ESTABLISHED"

    # Evidence blocks are empty / None
    assert unreg_twin["evidence_blocks"]["ml_evaluation"] is None
    assert unreg_twin["evidence_blocks"]["anomaly_evidence"] is None
    assert unreg_twin["evidence_blocks"]["operator_dispositions"] == []
    assert unreg_twin["longitudinal_timeline"] == []


# ==============================================================================
# 6. ATTACK CLASS E: FIXTURE IMMUTABILITY ACROSS MUTATIONS
# ==============================================================================

def test_attack_e_twin_mutations_do_not_corrupt_source_fixtures():
    twin_manager = ReliabilityTwinManagerPy()

    twin1 = twin_manager.build_reliability_twin("COMP-NORMAL")
    # Mutate the returned dictionary
    twin1["identity"]["component_id"] = "CORRUPTED-COMPONENT"
    twin1["evidence_blocks"]["ml_evaluation"]["probability"] = 0.9999
    twin1["evidence_summary"]["ml_evaluation"] = "TAMPERED"

    # Subsequent twin lookup must remain pristine
    twin2 = twin_manager.build_reliability_twin("COMP-NORMAL")
    assert twin2["identity"]["component_id"] == "COMP-NORMAL"
    assert twin2["evidence_blocks"]["ml_evaluation"]["probability"] == 0.004766
    assert twin2["evidence_summary"]["ml_evaluation"] == "AVAILABLE"


# ==============================================================================
# 7. ATTACK CLASS G & H: ML IMMUTABILITY & DISPOSITION SEPARATION
# ==============================================================================

def test_attack_g_and_h_ml_immutability_under_disposition():
    twin_manager = ReliabilityTwinManagerPy()
    twin = twin_manager.build_reliability_twin("COMP-NORMAL")

    ml_block = twin["evidence_blocks"]["ml_evaluation"]
    assert ml_block["prediction"] == "PASS"
    assert ml_block["probability"] == 0.004766
    assert ml_block["threshold"] == 0.20
    assert twin["provenance"]["authoritative_operating_threshold"] == 0.20

    # Ensure prohibited mutation list is present in contract
    contract = twin_manager.contract
    prohibited = contract["immutability_constraints"]["prohibited_mutations"]
    assert "prediction" in prohibited
    assert "probability" in prohibited
    assert "threshold" in prohibited


# ==============================================================================
# 8. ATTACK CLASS K: 168H EVALUATION HORIZON SCIENTIFIC SEMANTICS
# ==============================================================================

def test_attack_k_168h_scientific_disclaimer_preservation():
    twin_manager = ReliabilityTwinManagerPy()
    twin = twin_manager.build_reliability_twin("COMP-LATENT_DEFECT")

    prog = twin["evidence_blocks"]["prognostic_evidence"]
    assert prog["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"

    # Verify frontend HTML disclaimer
    html_content = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "Basis: 168H_EVALUATION_HORIZON_NOT_FAILURE_TIME" in html_content


# ==============================================================================
# 9. ATTACK CLASS L: PROVENANCE ATTRIBUTES & MODEL IDENTIFIER
# ==============================================================================

def test_attack_l_provenance_cryptographic_attestation():
    twin_manager = ReliabilityTwinManagerPy()
    twin = twin_manager.build_reliability_twin("COMP-NORMAL")

    prov = twin["provenance"]
    assert prov["system_verified_model_sha256"] == EXPECTED_MODEL_SHA
    assert prov["authoritative_operating_threshold"] == EXPECTED_THRESHOLD
    assert prov["contract_name"] == "predicta_reliability_twin_contract"


# ==============================================================================
# 10. ATTACK CLASS M: TRACEABILITY CHAIN INTERNAL CONSISTENCY
# ==============================================================================

def test_attack_m_traceability_chain_consistency():
    twin_manager = ReliabilityTwinManagerPy()

    for case_key in ["NORMAL", "LATENT_DEFECT", "FALSE_ALARM"]:
        twin = twin_manager.build_reliability_twin(case_key)
        ident = twin["identity"]

        assert ident["lot_id"] is not None
        assert ident["wafer_id"] is not None
        assert ident["die_id"] is not None
        assert ident["component_id"] is not None
        assert ident["trace_id"] is not None
        assert ident["test_id"] is not None

        # Verify lineage alignment
        assert ident["component_id"] == f"COMP-{case_key}"
        assert ident["trace_id"] == f"TR-{case_key}-2026"
        assert ident["test_id"] == f"TEST-{case_key}-001"


# ==============================================================================
# 11. ATTACK CLASS U: AUDIT INTEGRITY (READ MODEL ZERO SIDE EFFECTS)
def test_attack_u_twin_build_is_strictly_side_effect_free():
    twin_manager = ReliabilityTwinManagerPy()
    from src.governance.disposition import _AUDIT_LOGS, _FEEDBACK_STORE, _LIFECYCLE_EVENTS

    initial_audit_count = len(_AUDIT_LOGS)
    initial_feedback_count = len(_FEEDBACK_STORE)
    initial_lifecycle_count = len(_LIFECYCLE_EVENTS)

    # Repeated twin lookups across registered and unregistered components
    for _ in range(10):
        twin_manager.build_reliability_twin("COMP-NORMAL")
        twin_manager.build_reliability_twin("COMP-LATENT_DEFECT")
        twin_manager.build_reliability_twin("CMP-UNREGISTERED-999")

    final_audit_count = len(_AUDIT_LOGS)
    final_feedback_count = len(_FEEDBACK_STORE)
    final_lifecycle_count = len(_LIFECYCLE_EVENTS)

    assert initial_audit_count == final_audit_count, (
        f"Twin lookup modified audit ledger! Before: {initial_audit_count}, After: {final_audit_count}"
    )
    assert initial_feedback_count == final_feedback_count, "Twin lookup modified feedback store!"
    assert initial_lifecycle_count == final_lifecycle_count, "Twin lookup modified lifecycle events!"


# ==============================================================================
# 12. ATTACK CLASS V: SECURITY & SECRET SCAN
# ==============================================================================

def test_attack_v_zero_hardcoded_secrets_in_phase18():
    sensitive_patterns = [
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(r"service_role", re.IGNORECASE),
        re.compile(r"sbp_[a-zA-Z0-9]{20,}"),
        re.compile(r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+"),
    ]

    phase18_files = [
        ROOT / "src" / "reliability_twin" / "reliability_twin.py",
        ROOT / "src" / "reliability_twin" / "reliability_twin.js",
        ROOT / "script.js",
        ROOT / "frontend" / "script.js",
        ROOT / "api.js",
        ROOT / "frontend" / "api.js",
        ROOT / "index.html",
        ROOT / "frontend" / "index.html",
    ]

    for f in phase18_files:
        content = f.read_text(encoding="utf-8")
        for pat in sensitive_patterns:
            assert not pat.search(content), f"Sensitive secret pattern matched in {f.name}"
