"""
Phase 19.3 — Judge Journey, Evidence Validation & SIH GitHub Presentation Test Suite (Python)
=============================================================================================
Validates:
1. Protected Artifacts (Model SHA-256, Dataset SHA-256, Threshold 0.20)
2. Frontend Exact Mirror Byte Parity (index.html, script.js, api.js)
3. Zero SHAP & Prohibited Multipliers in Frontend Code
4. Judge Journey DOM Contract (10 Stages, Stepper, Controls, Quick Launchers)
5. Canonical Case Integrity & Evidence Grounding (NORMAL, LATENT_DEFECT, FALSE_ALARM)
6. README SIH Presentation, Quick Start & Mermaid Diagrams
7. Scientific Disclaimers Preservation
"""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PROD_MODEL_PATH = ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
PROD_DATASET_PATH = ROOT / "ml" / "data" / "synthetic" / "predicta_dataset_v3_50000.csv"
CANONICAL_DATA_PATH = ROOT / "src" / "governance" / "canonical_demo_data.json"
README_PATH = ROOT / "README.md"

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


def test_judge_journey_dom_contract():
    html_content = (ROOT / "index.html").read_text(encoding="utf-8")

    # Topnav button
    assert 'id="nav-btn-judge-journey"' in html_content

    # Container
    assert 'id="judge-journey-dashboard"' in html_content

    # Controls & Stepper
    required_ids = [
        "btn-judge-prev",
        "btn-judge-next",
        "judge-stage-indicator",
        "judge-stepper-pills",
        "judge-stage-content",
        "judge-stage-title",
        "judge-stage-tag",
        "judge-stage-desc",
        "judge-stage-details",
        "btn-judge-load-normal",
        "btn-judge-load-latent",
        "btn-judge-load-false",
    ]
    for dom_id in required_ids:
        assert f'id="{dom_id}"' in html_content, f"Missing Judge Journey DOM element: {dom_id}"

    # 10 stage pills
    for i in range(1, 11):
        assert f'data-stage="{i}"' in html_content, f"Missing stage pill {i}"


def test_canonical_case_data_integrity():
    assert CANONICAL_DATA_PATH.exists()
    data = json.loads(CANONICAL_DATA_PATH.read_text(encoding="utf-8"))
    assert data["lead_time_basis"] == "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"

    cases = data["cases"]
    assert "NORMAL" in cases
    assert "LATENT_DEFECT" in cases
    assert "FALSE_ALARM" in cases

    # Verify Case A: NORMAL
    normal = cases["NORMAL"]
    assert normal["inference_result"]["prediction"] == "PASS"
    assert normal["inference_result"]["risk_level"] == "LOW"
    assert normal["inference_result"]["probability"] < 0.20

    # Verify Case B: LATENT_DEFECT (Static Limit Escape)
    latent = cases["LATENT_DEFECT"]
    assert latent["inference_result"]["prediction"] == "PASS"  # Point-in-time ML alone passed
    assert latent["inference_result"]["anomaly_status"] == "REJECT"  # Independent PAT anomaly flagged
    assert latent["inference_result"]["risk_level"] == "CRITICAL"
    assert latent["operational_recommendation"] == "REJECT"  # Governed multi-evidence decision
    assert latent["why_flagged"]["evidence_layers"]["lot_deviation"]["max_z_score"] > 3.0

    # Verify Case C: FALSE_ALARM
    false_alarm = cases["FALSE_ALARM"]
    assert false_alarm["why_flagged"]["disposition"] == "MONITOR"
    assert false_alarm["inference_result"]["probability"] < 0.20


def test_readme_sih_presentation_and_diagrams():
    assert README_PATH.exists()
    readme = README_PATH.read_text(encoding="utf-8")

    # Check key sections
    assert "# Judge Overview" in readme
    assert "# Judge Quick Start" in readme
    assert "# Demonstration Cases" in readme
    assert "# System Architecture & Manufacturing Data Flow" in readme
    assert "# Multi-Layer Evidence Pipeline" in readme
    assert "# Governed Decision & Disposition Architecture" in readme
    assert "# Digital Reliability Twin & Traceability" in readme
    assert "# Scientific Rigor & Governance Boundaries" in readme
    assert "# Repository Map" in readme

    # Check SIH 2026 PS-170 identification
    assert "Problem Statement 170" in readme or "PS-170" in readme
    assert "ISRO" in readme

    # Check Scientific Disclaimers
    assert "168H_EVALUATION_HORIZON_NOT_FAILURE_TIME" in readme
    assert "MODEL ATTRIBUTION — NOT A CAUSAL CLAIM" in readme

    # Check Mermaid diagrams count (>= 5)
    mermaid_blocks = re.findall(r"```mermaid", readme)
    assert len(mermaid_blocks) >= 5, f"Expected at least 5 Mermaid diagrams, found {len(mermaid_blocks)}"

    # Check no raw local file:/// links or Windows paths
    assert "file:///" not in readme
    assert "C:\\Users" not in readme


def test_script_js_exports_judge_journey():
    script_content = (ROOT / "script.js").read_text(encoding="utf-8")
    assert "window.renderJudgeJourneyStage = renderJudgeJourneyStage;" in script_content
    assert "window.initJudgeJourney = initJudgeJourney;" in script_content
