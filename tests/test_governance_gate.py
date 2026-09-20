"""
PREDICTA Stage 6 Task 4 — Prognostic Governance Gate Test Suite (Python)
=========================================================================
Adversarial behavioral tests A through P:

Attack A:  Correct governance result produced — EVIDENCE_COMPLETE, REVIEW_REQUIRED
Attack B:  Governance state is always REVIEW_REQUIRED (never PRODUCTION_APPROVED)
Attack C:  model_status is always BENCHMARK_ONLY
Attack D:  calibration_status is always NOT_CALIBRATED
Attack E:  promotion_locked=True enforced
Attack F:  Dataset SHA-256 mismatch rejected fail-closed (GOV001)
Attack G:  Split manifest SHA-256 mismatch rejected fail-closed (GOV002)
Attack H:  Model artifact SHA mismatch rejected fail-closed (GOV003)
Attack I:  Calibration artifact SHA mismatch rejected fail-closed (GOV004)
Attack J:  Missing Task 1 calibration report rejected fail-closed (GOV005)
Attack K:  Corrupted disposition contract rejected fail-closed (GOV007/GOV008)
Attack L:  Tampered Task 3 stability report (lots missing) rejected (GOV010)
Attack M:  Tampered Task 3 report (wrong split SHA) rejected (GOV011)
Attack N:  Unsupported horizon accounting violation rejected (GOV012)
Attack O:  Test isolation violation rejected (GOV014)
Attack P:  Python/Node parity — identical evidence completeness and governance state
"""

import copy
import json
import os
import subprocess
import sys
import tempfile
import pytest

# Ensure project root on path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.prognostics.evaluate_governance_gate import (
    run_governance_gate_evaluation,
    GOVERNANCE_CONTRACT_PATH,
    DATASET_MANIFEST_PATH,
    SPLIT_MANIFEST_PATH,
    PRODUCTION_MANIFEST_PATH,
    CALIBRATION_ARTIFACT_PATH,
    TASK1_CALIBRATION_REPORT_PATH,
    TASK2_DISPOSITION_CONTRACT_PATH,
    TASK3_STABILITY_REPORT_PATH,
    TASK3_STABILITY_CONTRACT_PATH,
    EXPECTED_DATASET_SHA256,
    EXPECTED_SPLIT_MANIFEST_SHA256,
    EXPECTED_CALIBRATION_ARTIFACT_SHA256,
    EXPECTED_MODEL_SHA256,
    REQUIRED_TEST_LOTS,
    check_gov001_dataset_provenance,
    check_gov002_split_manifest_provenance,
    check_gov003_model_provenance,
    check_gov004_calibration_artifact_provenance,
    check_gov005_task1_calibration_evidence,
    check_gov006_task1_leakage_security,
    check_gov007_task2_identity_provenance,
    check_gov008_task2_append_only,
    check_gov009_task2_disposition_semantics,
    check_gov010_task3_stability_evidence,
    check_gov011_task3_provenance_validation,
    check_gov012_unsupported_horizon_accounting,
    check_gov014_test_isolation,
    check_gov015_threshold_governance,
    check_gov016_promotion_lock,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def canonical_report():
    """Run the governance gate evaluator once and cache the result."""
    return run_governance_gate_evaluation()


@pytest.fixture(scope="module")
def task3_report():
    with open(TASK3_STABILITY_REPORT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def dataset_manifest():
    with open(DATASET_MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ─── Attack A: Correct governance result ──────────────────────────────────────

def test_attack_a_correct_governance_result(canonical_report):
    """Attack A: Full evaluation produces EVIDENCE_COMPLETE, REVIEW_REQUIRED."""
    result = canonical_report["governance_result"]
    assert result["evidence_completeness"] == "EVIDENCE_COMPLETE", (
        f"Expected EVIDENCE_COMPLETE, got '{result['evidence_completeness']}'"
    )
    assert result["governance_state"] == "REVIEW_REQUIRED", (
        f"Expected REVIEW_REQUIRED, got '{result['governance_state']}'"
    )
    assert result["evidence_checks_passed"] == 18, (
        f"Expected 18 checks passed, got {result['evidence_checks_passed']}"
    )
    assert result["evidence_checks_failed"] == 0


# ─── Attack B: Governance state always REVIEW_REQUIRED ────────────────────────

def test_attack_b_governance_state_never_production_approved(canonical_report):
    """Attack B: governance_state is always REVIEW_REQUIRED, never PRODUCTION_APPROVED."""
    result = canonical_report["governance_result"]
    prohibited = ["PRODUCTION_APPROVED", "CALIBRATED", "PRODUCTION_READY", "EXTERNALLY_VALIDATED"]
    for prohibited_state in prohibited:
        assert result["governance_state"] != prohibited_state, (
            f"FORBIDDEN: governance_state='{result['governance_state']}'"
        )
    assert result["governance_state"] == "REVIEW_REQUIRED"


# ─── Attack C: model_status always BENCHMARK_ONLY ─────────────────────────────

def test_attack_c_model_status_benchmark_only(canonical_report):
    """Attack C: model_status is always BENCHMARK_ONLY."""
    result = canonical_report["governance_result"]
    assert result["model_status"] == "BENCHMARK_ONLY", (
        f"model_status must be BENCHMARK_ONLY, got '{result['model_status']}'"
    )


# ─── Attack D: calibration_status always NOT_CALIBRATED ──────────────────────

def test_attack_d_calibration_status_not_calibrated(canonical_report):
    """Attack D: calibration_status is always NOT_CALIBRATED."""
    result = canonical_report["governance_result"]
    assert result["calibration_status"] == "NOT_CALIBRATED", (
        f"calibration_status must be NOT_CALIBRATED, got '{result['calibration_status']}'"
    )


# ─── Attack E: promotion_locked=True ──────────────────────────────────────────

def test_attack_e_promotion_locked(canonical_report):
    """Attack E: promotion_locked=True, production_promotion_permitted=False."""
    result = canonical_report["governance_result"]
    assert result["promotion_locked"] is True
    assert result["production_promotion_permitted"] is False


# ─── Attack F: Dataset SHA mismatch rejected (GOV-001) ────────────────────────

def test_attack_f_dataset_sha_mismatch_rejected(dataset_manifest):
    """Attack F: Tampered dataset SHA in manifest causes GOV-001 FAIL."""
    tampered = copy.deepcopy(dataset_manifest)
    tampered["primary_latent_trajectory_dataset"]["dataset_sha256"] = (
        "a" * 64
    )
    entry, passed = check_gov001_dataset_provenance(tampered)
    assert not passed, "GOV-001 must fail on dataset SHA mismatch"
    assert entry["result"] == "FAIL"
    assert entry["failure_code"] == "GOV001_DATASET_PROVENANCE_FAILED"


# ─── Attack G: Split manifest SHA mismatch rejected (GOV-002) ─────────────────

def test_attack_g_split_manifest_sha_mismatch_rejected():
    """Attack G: Non-existent split manifest path triggers GOV-002 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        bad_path = os.path.join(tmpdir, "split_manifest.json")
        # Write a file with different bytes to cause SHA mismatch
        with open(bad_path, "w") as f:
            json.dump({"manifest_version": "tampered"}, f)

        # Temporarily monkey-patch the module constant
        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.SPLIT_MANIFEST_PATH
        mod.SPLIT_MANIFEST_PATH = bad_path
        try:
            entry, passed = check_gov002_split_manifest_provenance()
            assert not passed, "GOV-002 must fail on split manifest SHA mismatch"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV002_SPLIT_MANIFEST_PROVENANCE_FAILED"
        finally:
            mod.SPLIT_MANIFEST_PATH = orig


# ─── Attack H: Model artifact SHA mismatch rejected (GOV-003) ─────────────────

def test_attack_h_model_sha_mismatch_rejected():
    """Attack H: Tampered production manifest model SHA causes GOV-003 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write manifest pointing to a tampered artifact with wrong SHA
        manifest = {
            "release_version": "2.0_production",
            "model_sha256": "b" * 64,  # Wrong SHA
            "xgboost_model": PRODUCTION_MANIFEST_PATH,  # Points to manifest (different file)
        }
        bad_manifest_path = os.path.join(tmpdir, "bad_manifest.json")
        with open(bad_manifest_path, "w") as f:
            json.dump(manifest, f)

        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.PRODUCTION_MANIFEST_PATH
        mod.PRODUCTION_MANIFEST_PATH = bad_manifest_path
        try:
            entry, passed, _ = check_gov003_model_provenance()
            assert not passed, "GOV-003 must fail on model SHA mismatch"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV003_MODEL_PROVENANCE_FAILED"
        finally:
            mod.PRODUCTION_MANIFEST_PATH = orig


# ─── Attack I: Calibration artifact SHA mismatch rejected (GOV-004) ───────────

def test_attack_i_calibration_artifact_sha_mismatch_rejected():
    """Attack I: Tampered calibration artifact triggers GOV-004 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        bad_path = os.path.join(tmpdir, "cal_artifact.json")
        with open(bad_path, "w") as f:
            json.dump({"status": "tampered"}, f)

        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.CALIBRATION_ARTIFACT_PATH
        mod.CALIBRATION_ARTIFACT_PATH = bad_path
        try:
            entry, passed = check_gov004_calibration_artifact_provenance()
            assert not passed, "GOV-004 must fail on calibration artifact SHA mismatch"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV004_CALIBRATION_ARTIFACT_PROVENANCE_FAILED"
        finally:
            mod.CALIBRATION_ARTIFACT_PATH = orig


# ─── Attack J: Missing Task 1 calibration report rejected (GOV-005) ───────────

def test_attack_j_missing_task1_report_rejected():
    """Attack J: Missing Task 1 calibration report triggers GOV-005 FAIL."""
    import src.prognostics.evaluate_governance_gate as mod
    orig = mod.TASK1_CALIBRATION_REPORT_PATH
    mod.TASK1_CALIBRATION_REPORT_PATH = "/nonexistent/path/conformal_calibration_report.json"
    try:
        entry, passed = check_gov005_task1_calibration_evidence()
        assert not passed, "GOV-005 must fail on missing calibration report"
        assert entry["result"] == "FAIL"
        assert entry["failure_code"] == "GOV005_TASK1_CALIBRATION_EVIDENCE_FAILED"
    finally:
        mod.TASK1_CALIBRATION_REPORT_PATH = orig


# ─── Attack K: Corrupted disposition contract rejected (GOV-007/GOV-008) ──────

def test_attack_k_corrupted_disposition_contract_rejected():
    """Attack K: Disposition contract with wrong identity policy causes GOV-007 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tampered_contract = {
            "governance_rules": {
                "client_controlled_identity_policy": "ALLOW_CLIENT_IDENTIFIERS",  # Wrong
                "client_controlled_ml_output_policy": "REJECT_CLIENT_ML_SNAPSHOTS",
                "prohibited_client_identity_fields": ["component_id", "lot_id"],
                "storage_policy": "APPEND_ONLY_HISTORY",
            },
            "immutability_rules": {"original_ml_decision_immutable": True},
            "disclaimer": "Human dispositions are NOT ground truth",
        }
        bad_path = os.path.join(tmpdir, "disposition_contract.json")
        with open(bad_path, "w") as f:
            json.dump(tampered_contract, f)

        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.TASK2_DISPOSITION_CONTRACT_PATH
        mod.TASK2_DISPOSITION_CONTRACT_PATH = bad_path
        try:
            entry, passed = check_gov007_task2_identity_provenance()
            assert not passed, "GOV-007 must fail on wrong identity policy"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV007_TASK2_IDENTITY_PROVENANCE_FAILED"
        finally:
            mod.TASK2_DISPOSITION_CONTRACT_PATH = orig


# ─── Attack L: Task 3 report with missing lots rejected (GOV-010) ─────────────

def test_attack_l_task3_missing_lots_rejected(task3_report):
    """Attack L: Task 3 report with only 7 lots causes GOV-010 FAIL."""
    tampered = copy.deepcopy(task3_report)
    tampered["report_metadata"]["test_lots"] = REQUIRED_TEST_LOTS[:7]  # Remove last lot
    entry, passed = check_gov010_task3_stability_evidence(tampered)
    assert not passed, "GOV-010 must fail on missing lots"
    assert entry["result"] == "FAIL"
    assert entry["failure_code"] == "GOV010_TASK3_STABILITY_EVIDENCE_FAILED"


# ─── Attack M: Task 3 report with wrong split SHA rejected (GOV-011) ──────────

def test_attack_m_task3_wrong_split_sha_rejected(task3_report):
    """Attack M: Task 3 report with tampered split_manifest_sha256 causes GOV-011 FAIL."""
    tampered = copy.deepcopy(task3_report)
    tampered["report_metadata"]["split_manifest_sha256"] = "c" * 64
    entry, passed = check_gov011_task3_provenance_validation(tampered)
    assert not passed, "GOV-011 must fail on wrong split manifest SHA"
    assert entry["result"] == "FAIL"
    assert entry["failure_code"] == "GOV011_TASK3_PROVENANCE_VALIDATION_FAILED"


# ─── Attack N: Unsupported horizon accounting violation rejected (GOV-012) ─────

def test_attack_n_unsupported_horizon_accounting_violation_rejected(task3_report):
    """Attack N: Task 3 report with wrong DATA_UNAVAILABLE status causes GOV-012 FAIL."""
    tampered = copy.deepcopy(task3_report)
    tampered.setdefault("unsupported_groups_accounting", {}).setdefault(
        "missing_telemetry_horizons", {}
    )["status"] = "EVALUATED"  # Wrong: should be DATA_UNAVAILABLE
    entry, passed = check_gov012_unsupported_horizon_accounting(tampered)
    assert not passed, "GOV-012 must fail on wrong unsupported horizon status"
    assert entry["result"] == "FAIL"
    assert entry["failure_code"] == "GOV012_UNSUPPORTED_HORIZON_ACCOUNTING_FAILED"


# ─── Attack O: Test isolation violation rejected (GOV-014) ────────────────────

def test_attack_o_test_isolation_violation_rejected():
    """Attack O: Stability contract with test_tuning_permitted=true causes GOV-014 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tampered_contract = {
            "contract_name": "tampered",
            "contract_version": "1.0.0",
            "authority_level": "test",
            "task_name": "test",
            "methodology": {"target_parameters": ["iddq", "ileak", "tpd"]},
            "cohort_specification": {},
            "governance_specification": {
                "test_tuning_permitted": True,  # Violation!
                "arbitrary_threshold_permitted": False,
            },
        }
        bad_path = os.path.join(tmpdir, "lot_stability_contract.json")
        with open(bad_path, "w") as f:
            json.dump(tampered_contract, f)

        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.TASK3_STABILITY_CONTRACT_PATH
        mod.TASK3_STABILITY_CONTRACT_PATH = bad_path
        try:
            entry, passed = check_gov014_test_isolation()
            assert not passed, "GOV-014 must fail on test_tuning_permitted=True"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV014_TEST_ISOLATION_FAILED"
        finally:
            mod.TASK3_STABILITY_CONTRACT_PATH = orig


# ─── Attack P: Python/Node parity ─────────────────────────────────────────────

def test_attack_p_python_node_parity(canonical_report):
    """Attack P: Node.js evaluator produces identical governance_result fields."""
    # Run the Node.js evaluator
    node_script = os.path.join(
        project_root, "src", "prognostics", "evaluate_governance_gate.js"
    )
    result = subprocess.run(
        ["node", "-e",
         f"const m=require('{node_script.replace(chr(92), '/')}');"
         "const r=m.runGovernanceGateEvaluation();"
         "console.log(JSON.stringify(r.governance_result));"],
        capture_output=True,
        text=True,
        cwd=project_root,
    )
    assert result.returncode == 0, (
        f"Node.js governance gate evaluator failed: {result.stderr}"
    )

    node_result = json.loads(result.stdout.strip())
    py_result = canonical_report["governance_result"]

    assert node_result["governance_state"] == py_result["governance_state"], (
        f"Parity FAIL: governance_state: Node='{node_result['governance_state']}' "
        f"Python='{py_result['governance_state']}'"
    )
    assert node_result["evidence_completeness"] == py_result["evidence_completeness"], (
        f"Parity FAIL: evidence_completeness: Node='{node_result['evidence_completeness']}' "
        f"Python='{py_result['evidence_completeness']}'"
    )
    assert node_result["model_status"] == py_result["model_status"]
    assert node_result["calibration_status"] == py_result["calibration_status"]
    assert node_result["promotion_locked"] == py_result["promotion_locked"]
    assert node_result["production_promotion_permitted"] == py_result["production_promotion_permitted"]
    assert node_result["evidence_checks_total"] == py_result["evidence_checks_total"], (
        f"Parity FAIL: total checks: Node={node_result['evidence_checks_total']} "
        f"Python={py_result['evidence_checks_total']}"
    )
    assert node_result["evidence_checks_passed"] == py_result["evidence_checks_passed"], (
        f"Parity FAIL: passed checks: Node={node_result['evidence_checks_passed']} "
        f"Python={py_result['evidence_checks_passed']}"
    )


# ─── Attack Q: Tampered calibration artifact bytes rejected (GOV-004) ─────────

def test_attack_q_tampered_calibration_artifact_bytes_rejected():
    """Attack Q: Tampered calibration artifact bytes while keeping internal SHA field unchanged causes GOV-004 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Load real artifact and tamper with quantiles while keeping internal SHA untouched
        with open(CALIBRATION_ARTIFACT_PATH, "r", encoding="utf-8") as f:
            artifact = json.load(f)
        
        tampered_artifact = copy.deepcopy(artifact)
        # Modify quantiles table byte values
        tampered_artifact["conformal_quantiles"]["iddq"]["96h"]["0.80"] = 9999.99
        # Keep internal SHA untouched (198eaa...)
        
        bad_path = os.path.join(tmpdir, "tampered_cal_artifact.json")
        with open(bad_path, "w", encoding="utf-8") as f:
            json.dump(tampered_artifact, f)

        import src.prognostics.evaluate_governance_gate as mod
        orig = mod.CALIBRATION_ARTIFACT_PATH
        mod.CALIBRATION_ARTIFACT_PATH = bad_path
        try:
            entry, passed = check_gov004_calibration_artifact_provenance()
            assert not passed, "GOV-004 must fail on tampered calibration artifact bytes"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV004_CALIBRATION_ARTIFACT_PROVENANCE_FAILED"
        finally:
            mod.CALIBRATION_ARTIFACT_PATH = orig


# ─── Attack R: Tampered dataset file bytes rejected (GOV-001) ──────────────────

def test_attack_r_tampered_dataset_bytes_rejected(dataset_manifest):
    """Attack R: Tampered dataset file bytes while keeping dataset_manifest.json declared SHA unchanged causes GOV-001 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a tampered CSV dataset file
        bad_csv = os.path.join(tmpdir, "tampered_dataset.csv")
        with open(bad_csv, "w", encoding="utf-8") as f:
            f.write("component_id,lot_id,t,iddq,ileak,tpd,label\nCMP0001,LOT-SYN-001,0,0,0,0,0\n")
        
        tampered_manifest = copy.deepcopy(dataset_manifest)
        tampered_manifest["primary_latent_trajectory_dataset"]["dataset_path"] = bad_csv
        # Keep declared SHA unchanged (e2b969...)

        entry, passed = check_gov001_dataset_provenance(tampered_manifest)
        assert not passed, "GOV-001 must fail on tampered dataset file bytes"
        assert entry["result"] == "FAIL"
        assert entry["failure_code"] == "GOV001_DATASET_PROVENANCE_FAILED"


# ─── Attack S: Python/Node governance_result disagreement rejected (GOV-013) ──

def test_attack_s_python_node_result_disagreement_rejected():
    """Attack S: Forced Python/Node governance_result disagreement causes GOV-013 FAIL."""
    # Pass a mismatched reference py_result
    mismatched_py_result = {
        "governance_state": "PRODUCTION_APPROVED",  # Mismatched!
        "evidence_completeness": "EVIDENCE_COMPLETE",
        "model_status": "BENCHMARK_ONLY",
        "calibration_status": "NOT_CALIBRATED",
        "promotion_locked": True,
        "production_promotion_permitted": False,
        "acceptance_threshold_status": "NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED",
        "evidence_checks_total": 18,
        "evidence_checks_passed": 18,
        "evidence_checks_failed": 0,
    }
    from src.prognostics.evaluate_governance_gate import check_gov013_python_node_parity
    entry, passed = check_gov013_python_node_parity(mismatched_py_result)
    assert not passed, "GOV-013 must fail when Python and Node governance results disagree"
    assert entry["result"] == "FAIL"
    assert entry["failure_code"] == "GOV013_PYTHON_NODE_PARITY_FAILED"


# ─── Attack T: Node evaluator failure / invalid JSON output (GOV-013) ─────────

def test_attack_t_node_evaluator_failure_rejected():
    """Attack T: Node evaluator error or invalid output causes GOV-013 FAIL."""
    with tempfile.TemporaryDirectory() as tmpdir:
        bad_node_script = os.path.join(tmpdir, "broken_evaluator.js")
        with open(bad_node_script, "w", encoding="utf-8") as f:
            f.write("console.log('INVALID JSON OUTPUT'); process.exit(1);\n")

        # Monkey-patch path to test error handling
        import src.prognostics.evaluate_governance_gate as mod
        orig_script = os.path.join(mod.project_root, "src", "prognostics", "evaluate_governance_gate.js")
        try:
            # We temporarily overwrite the file content to test non-zero exit / bad json
            original_code = open(orig_script, "r", encoding="utf-8").read()
            with open(orig_script, "w", encoding="utf-8") as f:
                f.write("console.error('FATAL NODE ERROR'); process.exit(1);")
            
            entry, passed = mod.check_gov013_python_node_parity()
            assert not passed, "GOV-013 must fail when Node process fails"
            assert entry["result"] == "FAIL"
            assert entry["failure_code"] == "GOV013_PYTHON_NODE_PARITY_FAILED"
        finally:
            with open(orig_script, "w", encoding="utf-8") as f:
                f.write(original_code)
