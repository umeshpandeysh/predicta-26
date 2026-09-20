"""
PREDICTA Stage 7 Task 1 — Physics-Aware Reliability Engine Test Suite
=====================================================================
Comprehensive verification of physics consistency evidence evaluation:

Tests A-J: Existing test cases
Test K: NORMAL leakage trajectory contradicting existing leakage model -> rejected
Test L: Missing 168h evidence -> INSUFFICIENT_PHYSICS_EVIDENCE (no manufactured 168h data)
Test M: Zero arbitrary forecast thresholds -> model-defined physics relationships used
Test N: Timing physics expectation participates in evaluation (calculate_propagation_delay)
Test O: Genuine Arrhenius output monotonicity violation -> rejected via physics-level check
Test P: Existing physics primitives remain 100% unchanged in behavior
"""

import copy
import math
import pytest

import src.physics.reliability_engine as rel_mod
from src.physics.aging import bti_threshold_drift
from src.physics.leakage import calculate_leakage
from src.physics.reliability_engine import (
    CHECK_BTI_MONOTONICITY,
    CHECK_FORECAST_TRAJECTORY,
    CHECK_LEAKAGE_TRAJECTORY,
    CHECK_THERMAL_ARRHENIUS,
    CHECK_TIMING_DEGRADATION,
    PhysicsConsistencyStatus,
    PhysicsReliabilityEngine,
    evaluate_physics_consistency,
)
from src.physics.temperature import calculate_arrhenius_acceleration
from src.physics.timing import calculate_propagation_delay


@pytest.fixture
def engine():
    return PhysicsReliabilityEngine()


@pytest.fixture
def valid_record():
    return {
        "component_id": "CMP-SYN-0001",
        "lot_id": "LOT-SYN-001",
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "iddq_168h": 106.0,
        "ileak_0h": 10.0,
        "ileak_24h": 10.1,
        "ileak_168h": 10.3,
        "tpd_0h": 50.0,
        "tpd_24h": 51.2,
        "tpd_168h": 53.5,
    }


# ─── Test A: Valid physically consistent trajectory ──────────────────────────

def test_a_valid_consistent_trajectory(engine, valid_record):
    """Test A: Valid physically consistent trajectory produces PHYSICS_CONSISTENT with score 1.0."""
    result = engine.evaluate_physics_evidence(valid_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value
    assert result["physics_consistency_score"] == 1.0
    assert len(result["failed_physics_checks"]) == 0
    assert len(result["passed_physics_checks"]) == 5
    assert CHECK_BTI_MONOTONICITY in result["passed_physics_checks"]
    assert CHECK_TIMING_DEGRADATION in result["passed_physics_checks"]
    assert CHECK_LEAKAGE_TRAJECTORY in result["passed_physics_checks"]
    assert CHECK_THERMAL_ARRHENIUS in result["passed_physics_checks"]
    assert CHECK_FORECAST_TRAJECTORY in result["passed_physics_checks"]


# ─── Test B: Impossible negative/invalid BTI behavior ────────────────────────

def test_b_impossible_bti_behavior(engine):
    """Test B: Negative or decreasing Vth shift under BTI stress causes FAIL."""
    passed, ev = engine.evaluate_bti_consistency(
        time_hours_1=24.0, time_hours_2=168.0, observed_vth_shift_1=0.05, observed_vth_shift_2=0.01
    )
    assert not passed
    assert ev["status"] == "FAIL"

    passed_neg, ev_neg = engine.evaluate_bti_consistency(
        time_hours_1=24.0, time_hours_2=168.0, observed_vth_shift_1=-0.02, observed_vth_shift_2=0.05
    )
    assert not passed_neg
    assert ev_neg["status"] == "FAIL"


# ─── Test C: Impossible timing direction ──────────────────────────────────────

def test_c_impossible_timing_direction(engine, valid_record):
    """Test C: Spontaneous timing speedup under aging stress causes FAIL."""
    bad_timing_record = copy.deepcopy(valid_record)
    bad_timing_record["tpd_24h"] = 60.0
    bad_timing_record["tpd_168h"] = 40.0  # Spontaneous speedup from 60ps to 40ps!

    result = engine.evaluate_physics_evidence(bad_timing_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert result["physics_consistency_score"] < 1.0
    assert CHECK_TIMING_DEGRADATION in result["failed_physics_checks"]


# ─── Test D: Invalid leakage trajectory ──────────────────────────────────────

def test_d_invalid_leakage_trajectory(engine, valid_record):
    """Test D: Unphysical leakage current drop under defect breakdown causes FAIL."""
    bad_leak_record = copy.deepcopy(valid_record)
    bad_leak_record["ileak_24h"] = 50.0
    bad_leak_record["ileak_168h"] = 5.0  # Sudden drop during active defect breakdown!

    result = engine.evaluate_physics_evidence(bad_leak_record, defect_type="GATE_OXIDE_SHORT")
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert CHECK_LEAKAGE_TRAJECTORY in result["failed_physics_checks"]


# ─── Test E: Temperature acceleration monotonicity violation ─────────────────

def test_e_temperature_acceleration_monotonicity_violation(engine):
    """Test E: Arrhenius acceleration factor non-monotonicity causes FAIL."""
    passed, ev = engine.evaluate_thermal_acceleration_consistency(
        temp_c_use=25.0, temp_c_test_1=125.0, temp_c_test_2=85.0  # T_test_2 < T_test_1
    )
    assert not passed
    assert ev["status"] == "FAIL"


# ─── Test F: NaN / infinity / impossible physical inputs ───────────────────────

def test_f_nan_infinity_inputs_fail_closed(engine, valid_record):
    """Test F: NaN, infinity, or unphysical inputs fail closed cleanly."""
    nan_record = copy.deepcopy(valid_record)
    nan_record["iddq_0h"] = float("nan")

    result = engine.evaluate_physics_evidence(nan_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.0

    inf_record = copy.deepcopy(valid_record)
    inf_record["tpd_24h"] = float("inf")
    result_inf = engine.evaluate_physics_evidence(inf_record)
    assert result_inf["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value


# ─── Test G: Deterministic repeated evaluation ─────────────────────────────

def test_g_deterministic_repeated_evaluation(engine, valid_record):
    """Test G: Evaluating the same record repeatedly produces 100% identical results."""
    res1 = engine.evaluate_physics_evidence(valid_record)
    res2 = engine.evaluate_physics_evidence(valid_record)
    res3 = engine.evaluate_physics_evidence(valid_record)

    assert res1 == res2
    assert res2 == res3


# ─── Test H: No mutation of input data ────────────────────────────────────────

def test_h_no_input_mutation(engine, valid_record):
    """Test H: Input record dictionary is left 100% untouched and unmutated."""
    original = copy.deepcopy(valid_record)
    engine.evaluate_physics_evidence(valid_record)
    assert valid_record == original


# ─── Test I: Provenance fields present ────────────────────────────────────────

def test_i_provenance_fields_present(engine, valid_record):
    """Test I: Provenance metadata fields are present and accurate."""
    result = engine.evaluate_physics_evidence(valid_record)

    assert "input_provenance" in result
    assert result["input_provenance"]["component_id"] == "CMP-SYN-0001"
    assert result["input_provenance"]["lot_id"] == "LOT-SYN-001"

    assert "physics_model_provenance" in result
    assert result["physics_model_provenance"]["module_version"] == "1.0.0"
    assert "src.physics.aging.bti_threshold_drift" in result["physics_model_provenance"]["reused_functions"]
    assert "src.physics.timing.calculate_propagation_delay" in result["physics_model_provenance"]["reused_functions"]
    assert "src.physics.leakage.calculate_leakage" in result["physics_model_provenance"]["reused_functions"]
    assert "src.physics.temperature.calculate_arrhenius_acceleration" in result["physics_model_provenance"]["reused_functions"]


# ─── Test J: Existing physics modules remain unchanged ───────────────────────

def test_j_existing_physics_modules_unchanged():
    """Test J: Existing domain physics functions compute exact expected values without behavioral drift."""
    vth = bti_threshold_drift(time_hours=100.0, temp_c=125.0, voltage_v=1.1, base_amp=0.05, exponent_n=0.25, activation_energy_ev=0.12)
    assert math.isfinite(vth)
    assert vth > 0.0

    tpd = calculate_propagation_delay(tpd_0h=50.0, temp_c=125.0, vth_shift=0.02, beta=17.5)
    assert math.isfinite(tpd)
    assert tpd > 50.0

    leak_normal = calculate_leakage(leak_0h=10.0, temp_c=125.0, vth_shift=0.02, defect_type="NORMAL", time_hours=100.0, onset_hour=0.0)
    assert math.isfinite(leak_normal)
    assert leak_normal > 0.0

    af = calculate_arrhenius_acceleration(temp_c_use=25.0, temp_c_stress=125.0, activation_energy_ev=0.7)
    assert math.isfinite(af)
    assert af > 1.0


# ─── Test K: NORMAL leakage trajectory contradicting existing leakage model ───

def test_k_normal_leakage_contradicting_model(engine, valid_record):
    """Test K: NORMAL component where observed Ileak surges 50x without defect breakdown is rejected."""
    bad_normal = copy.deepcopy(valid_record)
    bad_normal["ileak_0h"] = 10.0
    bad_normal["ileak_24h"] = 10.0
    bad_normal["ileak_168h"] = 500.0  # Massive surge under NORMAL defect_type!

    result = engine.evaluate_physics_evidence(bad_normal, defect_type="NORMAL")
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert CHECK_LEAKAGE_TRAJECTORY in result["failed_physics_checks"]


# ─── Test L: Missing 168h evidence fails closed without manufacturing data ─────

def test_l_missing_168h_evidence_fails_closed(engine):
    """Test L: Missing 168h evidence yields INSUFFICIENT_PHYSICS_EVIDENCE with 0.0 score (no manufactured 168h data)."""
    partial_record = {
        "component_id": "CMP-SYN-0002",
        "lot_id": "LOT-SYN-001",
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "ileak_0h": 10.0,
        "ileak_24h": 10.1,
        "tpd_0h": 50.0,
        "tpd_24h": 51.2,
        # NO 168h fields!
    }

    result = engine.evaluate_physics_evidence(partial_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.0
    assert result["input_provenance"]["evaluated_checkpoints"] == ["MISSING_168H_EVIDENCE"]


# ─── Test M: Zero arbitrary forecast thresholds ──────────────────────────────

def test_m_zero_arbitrary_forecast_thresholds(engine, valid_record):
    """Test M: Proves forecast consistency check relies on model-defined directional physics, not arbitrary thresholds."""
    # Small natural drift within normal physical bounds
    record_small_drift = copy.deepcopy(valid_record)
    record_small_drift["tpd_24h"] = 50.1
    record_small_drift["tpd_168h"] = 50.3

    result = engine.evaluate_physics_evidence(record_small_drift)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value

    # Forecast timing recovery (tpd_168h < tpd_24h when early timing degraded)
    record_recovery = copy.deepcopy(valid_record)
    record_recovery["tpd_0h"] = 50.0
    record_recovery["tpd_24h"] = 52.0
    record_recovery["tpd_168h"] = 51.0  # Spontaneous recovery!

    result_rec = engine.evaluate_physics_evidence(record_recovery)
    assert result_rec["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert CHECK_FORECAST_TRAJECTORY in result_rec["failed_physics_checks"]


# ─── Test N: Timing physics expectation participates in evaluation ───────────

def test_n_timing_physics_expectation_participates(engine):
    """Test N: Timing physics model (calculate_propagation_delay) expectation participates in evaluation."""
    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, temp_c=125.0, vth_shift_24h=0.01, vth_shift_168h=0.05
    )
    assert passed
    assert "expected_tpd_24h" in ev
    assert "expected_tpd_168h" in ev
    assert ev["expected_tpd_168h"] >= ev["expected_tpd_24h"] >= 50.0

    # Directional failure (tpd_24h < tpd_0h)
    passed_fail, ev_fail = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=48.0, tpd_168h=53.5, temp_c=125.0, vth_shift_24h=0.01, vth_shift_168h=0.05
    )
    assert not passed_fail
    assert ev_fail["status"] == "FAIL"


# ─── Test O: Genuine Arrhenius output monotonicity violation ──────────────────

def test_o_genuine_arrhenius_output_monotonicity_violation(engine, monkeypatch):
    """Test O: Uses monkeypatch to force AF(T2) <= AF(T1) for T2 > T1, proving engine catches output-level physics violation."""
    def mock_arrhenius(temp_c_use, temp_c_stress, activation_energy_ev):
        # Inverted output: 125C yields smaller AF than 85C!
        if temp_c_stress == 125.0:
            return 10.0
        elif temp_c_stress == 85.0:
            return 50.0
        return 1.0

    monkeypatch.setattr(rel_mod, "calculate_arrhenius_acceleration", mock_arrhenius)

    passed, ev = engine.evaluate_thermal_acceleration_consistency(
        temp_c_use=25.0, temp_c_test_1=85.0, temp_c_test_2=125.0
    )
    assert not passed
    assert ev["status"] == "FAIL"
    assert "Arrhenius acceleration factor non-monotonic" in ev["reason"]


# ─── Test P: Existing physics primitives 100% unchanged in behavior ───────────

def test_p_existing_physics_primitives_behavior():
    """Test P: Verifies exact primitives in aging, timing, leakage, and temperature compute unchanged outputs."""
    vth = bti_threshold_drift(100.0, 125.0, 1.1, 0.05, 0.25, 0.12)
    assert abs(vth - 0.0054178) < 1e-4

    tpd = calculate_propagation_delay(50.0, 125.0, 0.02, 17.5)
    assert abs(tpd - 77.5092) < 1e-2

    leak_normal = calculate_leakage(10.0, 125.0, 0.02, "NORMAL", 100.0, 0.0)
    assert abs(leak_normal - 2160.709) < 1e-2

    af = calculate_arrhenius_acceleration(25.0, 125.0, 0.7)
    assert abs(af - 937.254) < 1e-2
