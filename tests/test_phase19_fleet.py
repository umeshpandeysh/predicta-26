"""
Phase 19.2 — Operational Fleet Monitoring & Evidence Integration Test Suite (Python)
=====================================================================================
Validates:
1. Protected Artifacts (Model SHA-256, Dataset SHA-256, Threshold 0.20)
2. Frontend Byte Parity (index.html, script.js, api.js mirrors)
3. Zero SHAP & Prohibited Multipliers in Frontend Code
4. Fleet Monitoring Dashboard DOM Contract
5. Authoritative Fleet Manager Engine (50 Lots, 100 Wafers, 5000 Dies, 5 Stations)
6. Disjoint Cohort Splits & Canonical Genealogy Resolution
7. Fail-Closed Behavior for Invalid / Unregistered Entities
"""

import hashlib
import json
import re
from pathlib import Path

from src.fleet.fleet_manager import FleetManagerPy, VALID_EQUIPMENT_IDS

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


def test_fleet_monitoring_dashboard_dom_contract():
    html_content = (ROOT / "index.html").read_text(encoding="utf-8")

    # Container
    assert 'id="fleet-monitoring-dashboard"' in html_content

    # KPI elements
    required_kpi_ids = [
        "fleet-total-lots",
        "fleet-total-wafers",
        "fleet-total-components",
        "fleet-total-equipment",
        "fleet-operating-threshold",
    ]
    for dom_id in required_kpi_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing KPI DOM element: {dom_id}"

    # Controls & Table
    required_control_ids = [
        "fleet-cohort-filter",
        "btn-fleet-refresh",
        "fleet-lots-table",
        "fleet-lots-tbody",
        "fleet-lot-detail-panel",
        "fleet-selected-lot-id",
        "fleet-selected-lot-cohort",
        "fleet-selected-lot-station",
        "fleet-selected-lot-wafers",
        "fleet-selected-lot-components",
        "btn-fleet-close-detail",
    ]
    for dom_id in required_control_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing control DOM element: {dom_id}"


def test_fleet_manager_summary_resolution():
    mgr = FleetManagerPy()
    summary = mgr.get_fleet_summary()

    assert summary["fleet_id"] == "PREDICTA_FLEET_QUALIFICATION_COHORT_2026"
    assert summary["total_lots"] == 50
    assert summary["total_wafers"] >= 100
    assert summary["total_components"] == 5000
    assert summary["total_equipment"] == 5
    assert summary["provenance"]["operating_threshold"] == 0.20
    assert summary["provenance"]["is_synthetic"] is True

    # Check cohort breakdown
    cohort_dist = summary["lot_cohort_distribution"]
    assert cohort_dist["TRAIN"] == 35
    assert cohort_dist["VALIDATION_TUNE"] == 3
    assert cohort_dist["CALIBRATION"] == 4
    assert cohort_dist["TEST"] == 8


def test_fleet_manager_lot_queries():
    mgr = FleetManagerPy()
    lots = mgr.get_fleet_lots()
    assert len(lots) == 50

    # Test LOT-SYN-001 (Demo lot with canonical components)
    lot1 = mgr.get_lot_detail("LOT-SYN-001")
    assert lot1 is not None
    assert lot1["lot_id"] == "LOT-SYN-001"
    assert lot1["cohort_type"] == "TRAIN"
    assert lot1["equipment_id"] in VALID_EQUIPMENT_IDS
    assert "WFR-001" in lot1["wafers"]
    assert "WFR-002" in lot1["wafers"]
    assert "W-2026-01" in lot1["wafers"]
    assert len(lot1["canonical_components"]) == 3
    comp_ids = [c["component_id"] for c in lot1["canonical_components"]]
    assert "COMP-NORMAL" in comp_ids
    assert "COMP-LATENT_DEFECT" in comp_ids
    assert "COMP-FALSE_ALARM" in comp_ids

    # Test Test cohort lot
    lot45 = mgr.get_lot_detail("LOT-SYN-045")
    assert lot45 is not None
    assert lot45["cohort_type"] == "TEST"
    assert lot45["component_count"] == 100


def test_fleet_manager_wafer_queries():
    mgr = FleetManagerPy()

    wfr1 = mgr.get_wafer_detail("WFR-001")
    assert wfr1 is not None
    assert wfr1["wafer_id"] == "WFR-001"
    assert wfr1["lot_id"] == "LOT-SYN-001"
    assert wfr1["die_count"] == 50

    wfrDemo = mgr.get_wafer_detail("W-2026-01")
    assert wfrDemo is not None
    assert wfrDemo["lot_id"] == "LOT-SYN-001"
    assert "COMP-NORMAL" in wfrDemo["canonical_components"]


def test_fleet_manager_fails_closed_on_invalid_entities():
    mgr = FleetManagerPy()

    assert mgr.get_lot_detail("LOT-INVALID-999") is None
    assert mgr.get_lot_detail("") is None
    assert mgr.get_lot_detail(None) is None

    assert mgr.get_wafer_detail("WFR-INVALID-999") is None
    assert mgr.get_wafer_detail("") is None
    assert mgr.get_wafer_detail(None) is None


def test_script_js_exports_render_fleet_monitoring():
    script_content = (ROOT / "script.js").read_text(encoding="utf-8")
    assert "window.renderFleetMonitoringDashboard = renderFleetMonitoringDashboard;" in script_content
