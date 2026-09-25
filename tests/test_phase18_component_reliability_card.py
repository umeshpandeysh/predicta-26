"""
Phase 18.2 — Component Reliability Card & Authoritative Twin Read Model Test Suite
==================================================================================
Tests:
1. Protected Artifact Integrity (Model SHA-256, Dataset SHA-256, Threshold 0.20)
2. Frontend Byte Parity (index.html, script.js, api.js vs frontend/ mirrors)
3. Zero SHAP & Prohibited Multipliers in Frontend Code
4. Component Reliability Card DOM Contract (all 10 questions & required IDs)
5. Authoritative Twin Read Model (Python & JS resolution, zero inference, deterministic hash)
6. Fail-Closed & Loss-Protected Escalation Semantics
"""

import hashlib
import json
import re
from pathlib import Path

from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy

ROOT = Path(__file__).resolve().parent.parent

PROD_MODEL_PATH = ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
PROD_DATASET_PATH = ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v3_50000.csv"

PROTECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
PROTECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"
PROTECTED_THRESHOLD = 0.20


def compute_sha256(path: Path) -> str:
    content = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def test_protected_model_sha256():
    assert PROD_MODEL_PATH.exists(), f"Model file missing at {PROD_MODEL_PATH}"
    computed_sha = compute_sha256(PROD_MODEL_PATH)
    assert computed_sha == PROTECTED_MODEL_SHA, (
        f"Model SHA mismatch: expected {PROTECTED_MODEL_SHA}, got {computed_sha}"
    )


def test_protected_dataset_sha256():
    assert PROD_DATASET_PATH.exists(), f"Dataset file missing at {PROD_DATASET_PATH}"
    computed_sha = compute_sha256(PROD_DATASET_PATH)
    assert computed_sha == PROTECTED_DATASET_SHA, (
        f"Dataset SHA mismatch: expected {PROTECTED_DATASET_SHA}, got {computed_sha}"
    )


def test_protected_operating_threshold():
    contract_path = ROOT / "ml" / "reliability_twin" / "reliability_twin_contract.json"
    assert contract_path.exists()
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    assert contract["immutability_constraints"]["authoritative_operating_threshold"] == PROTECTED_THRESHOLD


def test_frontend_exact_byte_parity():
    pairs = [
        ("index.html", "frontend/index.html"),
        ("script.js", "frontend/script.js"),
        ("api.js", "frontend/api.js"),
    ]
    for root_rel, fe_rel in pairs:
        root_file = ROOT / root_rel
        fe_file = ROOT / fe_rel
        assert root_file.exists(), f"Root file {root_file} missing"
        assert fe_file.exists(), f"Frontend mirror {fe_file} missing"
        root_bytes = root_file.read_bytes()
        fe_bytes = fe_file.read_bytes()
        assert len(root_bytes) == len(fe_bytes), (
            f"Size mismatch {root_rel} ({len(root_bytes)}) vs {fe_rel} ({len(fe_bytes)})"
        )
        assert hashlib.sha256(root_bytes).hexdigest() == hashlib.sha256(fe_bytes).hexdigest(), (
            f"Hash mismatch between {root_rel} and {fe_rel}"
        )


def test_frontend_zero_shap_and_multipliers():
    frontend_files = [
        ROOT / "index.html",
        ROOT / "frontend" / "index.html",
        ROOT / "script.js",
        ROOT / "frontend" / "script.js",
        ROOT / "api.js",
        ROOT / "frontend" / "api.js",
    ]
    shap_pattern = re.compile(r"\bshap\b", re.IGNORECASE)
    prohibited_multipliers = [r"\*\s*1\.2\b", r"\*\s*1\.05\b", r"\*\s*0\.95\b"]

    for file_path in frontend_files:
        content = file_path.read_text(encoding="utf-8")
        assert not shap_pattern.search(content), (
            f"Prohibited SHAP token found in {file_path.name}"
        )
        for pattern in prohibited_multipliers:
            assert not re.search(pattern, content), (
                f"Prohibited client multiplier '{pattern}' found in {file_path.name}"
            )


def test_component_reliability_card_dom_contract():
    html_content = (ROOT / "index.html").read_text(encoding="utf-8")

    # Card container
    assert 'id="component-reliability-card"' in html_content

    # Header & Identity
    required_identity_ids = [
        "crc-twin-id-badge",
        "crc-identity-status",
        "btn-crc-refresh",
        "crc-component-id",
        "crc-lot-id",
        "crc-wafer-id",
        "crc-die-id",
        "crc-equip-id",
        "crc-trace-id",
        "crc-test-id",
    ]
    for dom_id in required_identity_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing identity DOM element: {dom_id}"

    # Governed State & Disposition
    required_gov_ids = [
        "crc-ml-prediction",
        "crc-ml-probability",
        "crc-op-recommendation",
        "crc-backend-state",
        "crc-human-disposition",
        "crc-reason-code",
        "crc-escalation-banner",
    ]
    for dom_id in required_gov_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing governed state DOM element: {dom_id}"

    # Burn-In Timeline
    required_timeline_ids = [
        "crc-tl-0h",
        "crc-tl-24h",
        "crc-tl-96h",
        "crc-tl-168h",
    ]
    for dom_id in required_timeline_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing timeline DOM element: {dom_id}"
    assert "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME" in html_content

    # Anomaly & Degradation
    required_anomaly_ids = [
        "crc-pat-status",
        "crc-pat-zscore",
        "crc-copod-score",
        "crc-drift-status",
    ]
    for dom_id in required_anomaly_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing anomaly DOM element: {dom_id}"

    # Physics Evidence
    required_physics_ids = [
        "crc-phys-bti",
        "crc-phys-timing",
        "crc-phys-leakage",
        "crc-phys-thermal",
        "crc-phys-forecast",
        "crc-phys-status",
        "crc-phys-score",
    ]
    for dom_id in required_physics_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing physics DOM element: {dom_id}"

    # Uncertainty & Risk
    required_risk_ids = [
        "crc-uncert-band",
        "crc-risk-score",
        "crc-risk-level",
    ]
    for dom_id in required_risk_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing risk DOM element: {dom_id}"

    # Model Attribution (Strictly Non-Causal)
    assert 'id="crc-discrim-type"' in html_content
    assert 'id="crc-attrib-list"' in html_content
    assert "MODEL ATTRIBUTION &mdash; NOT A CAUSAL CLAIM" in html_content

    # Traceability Chain
    required_lineage_ids = [
        "crc-tr-lot",
        "crc-tr-wafer",
        "crc-tr-comp",
        "crc-tr-trace",
        "crc-tr-test",
    ]
    for dom_id in required_lineage_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing lineage DOM element: {dom_id}"

    # Provenance
    required_prov_ids = [
        "crc-prov-model-id",
        "crc-prov-model-sha",
        "crc-prov-threshold",
        "crc-prov-timestamp",
    ]
    for dom_id in required_prov_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing provenance DOM element: {dom_id}"

    # 10 Stages Summary
    for i in range(1, 11):
        assert f'id="crc-stage-{i}"' in html_content, f"Missing stage badge: crc-stage-{i}"


def test_twin_read_model_canonical_resolution():
    twin_engine = ReliabilityTwinManagerPy()

    canonical_cases = [
        ("NORMAL", "COMP-NORMAL", "TR-NORMAL-2026"),
        ("LATENT_DEFECT", "COMP-LATENT_DEFECT", "TR-LATENT_DEFECT-2026"),
        ("FALSE_ALARM", "COMP-FALSE_ALARM", "TR-FALSE_ALARM-2026"),
    ]

    for case_key, expected_comp_id, expected_trace_id in canonical_cases:
        # Resolve by case key
        twin_by_key = twin_engine.build_reliability_twin(case_key)
        assert twin_by_key["identity"]["identity_status"] == "REGISTERED"
        assert twin_by_key["identity"]["component_id"] == expected_comp_id
        assert twin_by_key["identity"]["trace_id"] == expected_trace_id
        assert twin_by_key["twin_id"].startswith("TWIN-")

        # Resolve by component ID
        twin_by_comp = twin_engine.build_reliability_twin(expected_comp_id)
        assert twin_by_comp["twin_id"] == twin_by_key["twin_id"], (
            f"Deterministic Twin ID mismatch between key {case_key} and comp {expected_comp_id}"
        )

        # Resolve by trace ID
        twin_by_trace = twin_engine.build_reliability_twin(expected_trace_id)
        assert twin_by_trace["twin_id"] == twin_by_key["twin_id"], (
            f"Deterministic Twin ID mismatch between key {case_key} and trace {expected_trace_id}"
        )

        # Check all 10 stages exist in summary
        summary = twin_by_key["evidence_summary"]
        assert len(summary) >= 10
        assert summary["ml_evaluation"] == "AVAILABLE"
        assert summary["anomaly_evidence"] == "AVAILABLE"
        assert summary["prognostic_evidence"] == "AVAILABLE"
        assert summary["physics_reliability"] == "AVAILABLE"


def test_unregistered_component_resolution_fails_closed():
    twin_engine = ReliabilityTwinManagerPy()
    twin = twin_engine.build_reliability_twin("CMP-UNREGISTERED-999")
    assert twin["identity"]["identity_status"] == "UNREGISTERED"
    assert twin["identity"]["component_id"] is None
    assert twin["identity"]["requested_identifier"] == "CMP-UNREGISTERED-999"
    assert twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_summary"]["manufacturing_observation"] == "INSUFFICIENT_EVIDENCE"


def test_api_client_fetch_reliability_twin_parity():
    api_js = (ROOT / "api.js").read_text(encoding="utf-8")
    assert "async function fetchReliabilityTwin(identifier)" in api_js
    assert "/reliability-twin/" in api_js
    assert "Bearer predicta_op_key_2026" in api_js


def test_script_js_exports_render_component_reliability_card():
    script_content = (ROOT / "script.js").read_text(encoding="utf-8")
    assert "async function renderComponentReliabilityCard(" in script_content
    assert "window.renderComponentReliabilityCard = renderComponentReliabilityCard;" in script_content
    assert "renderComponentReliabilityCard(null, activeTraceRecord);" in script_content
