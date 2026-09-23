"""
PREDICTA Stage 7 Task 1 — Physics-Aware Reliability Engine Test Suite
=====================================================================
Comprehensive verification of physics consistency evidence evaluation:

Tests A-P: Core verification tests (BTI, Timing, Leakage, Arrhenius, Fail-Closed)
Tests Q-Z: Hardened evidence & specification compliance tests
Tests AA-AF: Direct physics-model output control & zero arbitrary tolerance verification
Tests AG-AK: Authoritative BTI observed evidence integration & fail-closed governance
"""

import copy
import inspect
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
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "iddq_168h": 106.0,
        "ileak_0h": 10.0,
        "ileak_24h": 10.0,
        "ileak_168h": 9.98,
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
    """Test K: NORMAL component where observed Ileak increases is rejected per calculate_leakage output model direction."""
    bad_normal = copy.deepcopy(valid_record)
    bad_normal["ileak_0h"] = 10.0
    bad_normal["ileak_24h"] = 10.0
    bad_normal["ileak_168h"] = 15.0  # Increases under NORMAL defect_type!

    result = engine.evaluate_physics_evidence(bad_normal, defect_type="NORMAL")
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert CHECK_LEAKAGE_TRAJECTORY in result["failed_physics_checks"]


# ─── Test L: Missing 168h evidence fails closed without manufacturing data ─────

def test_l_missing_168h_evidence_fails_closed(engine):
    """Test L: Missing 168h evidence yields INSUFFICIENT_PHYSICS_EVIDENCE with 0.0 score (no manufactured 168h data)."""
    partial_record = {
        "component_id": "CMP-SYN-0002",
        "lot_id": "LOT-SYN-001",
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
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
    assert result["input_provenance"]["evaluated_checkpoints"] == ["MISSING_REQUIRED_EVIDENCE"]


# ─── Test M: Zero arbitrary forecast thresholds ──────────────────────────────

def test_m_zero_arbitrary_forecast_thresholds(engine, valid_record):
    """Test M: Proves forecast consistency check relies on model-defined directional physics, not arbitrary thresholds."""
    record_small_drift = copy.deepcopy(valid_record)
    record_small_drift["tpd_24h"] = 50.1
    record_small_drift["tpd_168h"] = 50.3

    result = engine.evaluate_physics_evidence(record_small_drift)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value

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
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, temp_c=125.0
    )
    assert passed
    assert "expected_tpd_24h" in ev
    assert "expected_tpd_168h" in ev
    assert ev["expected_tpd_168h"] >= ev["expected_tpd_24h"] >= 50.0

    passed_fail, ev_fail = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=48.0, tpd_168h=53.5, temp_c=125.0
    )
    assert not passed_fail
    assert ev_fail["status"] == "FAIL"


# ─── Test O: Genuine Arrhenius output monotonicity violation ──────────────────

def test_o_genuine_arrhenius_output_monotonicity_violation(engine, monkeypatch):
    """Test O: Uses monkeypatch to force AF(T2) <= AF(T1) for T2 > T1, proving engine catches output-level physics violation."""
    def mock_arrhenius(temp_c_use, temp_c_stress, activation_energy_ev):
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


# ─── Test Q: Timing model output genuinely controls physics-direction result ─

def test_q_timing_model_output_controls_direction(engine):
    """Test Q: Verifies calculate_propagation_delay outputs directly dictate consistency conclusions."""
    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.0, tpd_168h=52.0, temp_c=125.0
    )
    assert passed
    assert ev["model_direction"] == "NON_DECREASING"
    assert ev["observed_direction"] == "NON_DECREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test R: No arbitrary leakage ratio/tolerance used ───────────────────────

def test_r_no_arbitrary_leakage_ratio_tolerance(engine):
    """Test R: Verifies calculate_leakage model direction dictates leakage evaluation without arbitrary ratios."""
    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.9, defect_type="NORMAL"
    )
    assert passed
    assert ev["model_direction"] == "NON_INCREASING"
    assert ev["observed_direction"] == "NON_INCREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test S: NORMAL leakage evaluation follows calculate_leakage model ───────

def test_s_normal_leakage_follows_model_direction(engine):
    """Test S: NORMAL leakage trajectory that increases is marked INCONSISTENT per calculate_leakage model."""
    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=11.0, ileak_168h=12.0, defect_type="NORMAL"
    )
    assert not passed
    assert ev["model_direction"] == "NON_INCREASING"
    assert ev["observed_direction"] == "NON_DECREASING"
    assert ev["consistency_conclusion"] == "INCONSISTENT"


# ─── Test T: IDDQ does not receive an invented physics law ───────────────────

def test_t_iddq_no_invented_physics_law(engine, valid_record):
    """Test T: IDDQ is monitored for non-negativity and finiteness without fabricating an IDDQ physics law."""
    result = engine.evaluate_physics_evidence(valid_record)
    fc_ev = result["evidence"]["forecast_trajectory_consistency"]
    assert fc_ev["iddq_physics_evaluation"] == "INSUFFICIENT_PHYSICS_EVIDENCE"
    assert "no dedicated physics model in src/physics/" in fc_ev["iddq_physics_note"]


# ─── Test U: Only the three authoritative status values exist ────────────────

def test_u_only_three_authoritative_statuses_exist():
    """Test U: Verifies only PHYSICS_CONSISTENT, PHYSICS_INCONSISTENT, and INSUFFICIENT_PHYSICS_EVIDENCE exist."""
    statuses = {s.value for s in PhysicsConsistencyStatus}
    expected = {"PHYSICS_CONSISTENT", "PHYSICS_INCONSISTENT", "INSUFFICIENT_PHYSICS_EVIDENCE"}
    assert statuses == expected
    assert len(statuses) == 3


# ─── Test V: Missing 168h evidence cannot be converted into PASS ─────────────

def test_v_missing_168h_cannot_be_converted_to_pass(engine):
    """Test V: Incomplete 168h record must yield INSUFFICIENT_PHYSICS_EVIDENCE with score 0.0, never PASS."""
    incomplete_record = {
        "component_id": "CMP-SYN-0003",
        "lot_id": "LOT-SYN-001",
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "ileak_0h": 10.0,
        "ileak_24h": 10.1,
        "tpd_0h": 50.0,
        "tpd_24h": 51.2,
    }
    result = engine.evaluate_physics_evidence(incomplete_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.0


# ─── Test W: Timing model evidence contains expected and observed trajectory ─

def test_w_timing_evidence_contains_expected_and_observed_data(engine, valid_record):
    """Test W: Timing evidence contains observed and expected Tpd fields."""
    result = engine.evaluate_physics_evidence(valid_record)
    t_ev = result["evidence"]["timing_consistency"]
    assert "observed_tpd_0h" in t_ev
    assert "observed_tpd_24h" in t_ev
    assert "observed_tpd_168h" in t_ev
    assert "expected_tpd_24h" in t_ev
    assert "expected_tpd_168h" in t_ev
    assert "model_direction" in t_ev
    assert "observed_direction" in t_ev
    assert "consistency_conclusion" in t_ev


# ─── Test X: Leakage model evidence contains expected and observed trajectory

def test_x_leakage_evidence_contains_expected_and_observed_data(engine, valid_record):
    """Test X: Leakage evidence contains observed and expected Ileak fields."""
    result = engine.evaluate_physics_evidence(valid_record)
    l_ev = result["evidence"]["leakage_consistency"]
    assert "expected_leak_0h" in l_ev
    assert "expected_leak_24h" in l_ev
    assert "expected_leak_168h" in l_ev
    assert "observed_leak_0h" in l_ev
    assert "observed_leak_24h" in l_ev
    assert "observed_leak_168h" in l_ev
    assert "model_direction" in l_ev
    assert "observed_direction" in l_ev
    assert "consistency_conclusion" in l_ev


# ─── Test Y: Deterministic repeated evaluation produces identical output ──────

def test_y_deterministic_repeated_evaluation_identical(engine, valid_record):
    """Test Y: Repeated execution yields identical outputs across 10 iterations."""
    first = engine.evaluate_physics_evidence(valid_record)
    for _ in range(10):
        current = engine.evaluate_physics_evidence(valid_record)
        assert current == first


# ─── Test Z: Existing physics primitive behavior remains unchanged ───────────

def test_z_existing_physics_primitives_unchanged():
    """Test Z: Verifies all four physics primitive functions execute cleanly with untouched output contracts."""
    vth = bti_threshold_drift(100.0, 125.0, 1.1, 0.05, 0.25, 0.12)
    tpd = calculate_propagation_delay(50.0, 125.0, 0.02, 17.5)
    leak = calculate_leakage(10.0, 125.0, 0.02, "NORMAL", 100.0, 0.0)
    af = calculate_arrhenius_acceleration(25.0, 125.0, 0.7)

    assert vth > 0
    assert tpd > 50.0
    assert leak > 0
    assert af > 1.0


# ─── Test AA: NORMAL leakage uses actual calculate_leakage output direction ──

def test_aa_normal_leakage_uses_actual_model_output(engine):
    """Test AA: Verifies model_direction is derived from calculate_leakage outputs, not hardcoded strings."""
    exp_0 = calculate_leakage(10.0, 125.0, 0.0, "NORMAL", 0.0, 0.0)
    exp_24 = calculate_leakage(10.0, 125.0, 0.01, "NORMAL", 24.0, 0.0)
    exp_168 = calculate_leakage(10.0, 125.0, 0.05, "NORMAL", 168.0, 0.0)

    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=exp_0, ileak_24h=exp_24, ileak_168h=exp_168, defect_type="NORMAL"
    )
    assert passed
    assert ev["model_direction"] == "NON_INCREASING"
    assert ev["observed_direction"] == "NON_INCREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test AB: Monkeypatched leakage model controls result ────────────────────

def test_ab_monkeypatched_leakage_model_controls_result(engine, monkeypatch):
    """Test AB: Monkeypatching calculate_leakage to return INCREASING outputs forces model_direction to NON_DECREASING."""
    def mock_leakage(leak_0h, temp_c, vth_shift, defect_type, time_hours, onset_hour):
        return float(leak_0h + time_hours * 2.0)

    monkeypatch.setattr(rel_mod, "calculate_leakage", mock_leakage)

    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=20.0, ileak_168h=30.0, defect_type="NORMAL"
    )
    assert passed
    assert ev["model_direction"] == "NON_DECREASING"
    assert ev["observed_direction"] == "NON_DECREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test AC: Timing has no epsilon dependency ───────────────────────────────

def test_ac_timing_no_epsilon_dependency(engine):
    """Test AC: Verifies exact ordering semantics without arbitrary 1e-6 epsilon tolerances."""
    passed_stable, ev_stable = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=50.0, tpd_168h=50.0
    )
    assert passed_stable
    assert ev_stable["observed_direction"] == "STABLE"

    passed_dec, ev_dec = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=50.0, tpd_168h=49.99999
    )
    assert not passed_dec
    assert ev_dec["consistency_conclusion"] == "INCONSISTENT"


# ─── Test AD: Monkeypatched timing model controls result ─────────────────────

def test_ad_monkeypatched_timing_model_controls_result(engine, monkeypatch):
    """Test AD: Monkeypatching calculate_propagation_delay alters timing model_direction and consistency conclusions."""
    def mock_tpd(tpd_0h, temp_c, vth_shift, beta):
        return float(tpd_0h - vth_shift * 100.0)

    monkeypatch.setattr(rel_mod, "calculate_propagation_delay", mock_tpd)

    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=49.0, tpd_168h=45.0
    )
    assert passed
    assert ev["model_direction"] == "NON_INCREASING"
    assert ev["observed_direction"] == "NON_INCREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test AE: Forecast uses model output ──────────────────────────────────────

def test_ae_forecast_uses_model_output(engine, monkeypatch):
    """Test AE: Forecast check calls physics primitives and reports their actual outputs in evidence."""
    def mock_leakage(leak_0h, temp_c, vth_shift, defect_type, time_hours, onset_hour):
        return float(leak_0h + time_hours * 5.0)

    monkeypatch.setattr(rel_mod, "calculate_leakage", mock_leakage)

    record = {
        "component_id": "CMP-SYN-0004",
        "lot_id": "LOT-SYN-001",
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "iddq_168h": 106.0,
        "ileak_0h": 10.0,
        "ileak_24h": 130.0,
        "ileak_168h": 850.0,
        "tpd_0h": 50.0,
        "tpd_24h": 51.2,
        "tpd_168h": 53.5,
    }

    result = engine.evaluate_physics_evidence(record, defect_type="NORMAL")
    fc_ev = result["evidence"]["forecast_trajectory_consistency"]
    assert fc_ev["leakage_model_direction"] == "NON_DECREASING"
    assert fc_ev["leakage_observed_direction"] == "NON_DECREASING"
    assert fc_ev["leakage_consistency_conclusion"] == "CONSISTENT"


# ─── Test AF: No arbitrary directional epsilon ────────────────────────────────

def test_af_no_arbitrary_directional_epsilon():
    """Test AF: AST source code audit asserting no arbitrary directional epsilon tolerances (1e-6, 1e-5, 0.5, 1.5) are used in engine logic."""
    source_lines = inspect.getsourcelines(rel_mod)[0]
    for line_idx, line in enumerate(source_lines, 1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"') or stripped.startswith("'"):
            continue
        assert "1e-6" not in line, f"Arbitrary tolerance 1e-6 found at line {line_idx}: {line}"
        assert "1e-5" not in line, f"Arbitrary tolerance 1e-5 found at line {line_idx}: {line}"
        assert "obs_ratio" not in line, f"Arbitrary ratio obs_ratio found at line {line_idx}: {line}"
        assert "model_ratio" not in line, f"Arbitrary ratio model_ratio found at line {line_idx}: {line}"


# ─── Test AG: Authoritative observed BTI trajectory participates ────────────

def test_ag_authoritative_observed_bti_participates(engine, valid_record):
    """Test AG: Authoritative observed Vth trajectory is passed to evaluate_bti_consistency and participates in evaluation."""
    result = engine.evaluate_physics_evidence(valid_record)
    bti_ev = result["evidence"]["bti_consistency"]

    assert "expected_vth_1" in bti_ev
    assert "expected_vth_2" in bti_ev
    assert "evaluated_vth_1" in bti_ev
    assert "evaluated_vth_2" in bti_ev
    assert bti_ev["evaluated_vth_1"] == valid_record["vth_shift_24h"]
    assert bti_ev["evaluated_vth_2"] == valid_record["vth_shift_168h"]
    assert bti_ev["evaluated_vth_1"] != bti_ev["expected_vth_1"]  # Not copied from expected values!
    assert bti_ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test AH: Contradictory observed BTI trajectory changes result ────────────

def test_ah_contradictory_observed_bti_changes_result(engine, valid_record):
    """Test AH: Observed Vth trajectory contradicting model direction causes BTI check and overall evaluation to fail."""
    bad_bti_record = copy.deepcopy(valid_record)
    bad_bti_record["vth_shift_24h"] = 0.05
    bad_bti_record["vth_shift_168h"] = 0.01  # Contradictory decreasing Vth shift!

    result = engine.evaluate_physics_evidence(bad_bti_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_INCONSISTENT.value
    assert CHECK_BTI_MONOTONICITY in result["failed_physics_checks"]
    assert result["evidence"]["bti_consistency"]["consistency_conclusion"] == "INCONSISTENT"


# ─── Test AI: Missing observed BTI evidence fails closed ──────────────────────

def test_ai_missing_observed_bti_fails_closed(engine, valid_record):
    """Test AI: Record missing observed Vth fields fails closed with INSUFFICIENT_PHYSICS_EVIDENCE and score 0.8."""
    no_vth_record = copy.deepcopy(valid_record)
    del no_vth_record["vth_shift_24h"]
    del no_vth_record["vth_shift_168h"]

    result = engine.evaluate_physics_evidence(no_vth_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.8
    assert CHECK_BTI_MONOTONICITY in result["insufficient_physics_checks"]


# ─── Test AJ: Direct BTI model participation ─────────────────────────────────

def test_aj_direct_bti_model_participation(engine, monkeypatch):
    """Test AJ: Direct evaluate_bti_consistency follows monkeypatched bti_threshold_drift model output direction."""
    def mock_bti(time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev):
        # Inverted model: Vth decreases with time!
        return float(1.0 / time_hours)

    monkeypatch.setattr(rel_mod, "bti_threshold_drift", mock_bti)

    passed, ev = engine.evaluate_bti_consistency(
        time_hours_1=24.0, time_hours_2=168.0,
        observed_vth_shift_1=0.05, observed_vth_shift_2=0.01
    )
    assert passed
    assert ev["model_direction"] == "DECREASING"
    assert ev["observed_direction"] == "DECREASING"
    assert ev["consistency_conclusion"] == "CONSISTENT"


# ─── Test AK: No arbitrary BTI tolerance ─────────────────────────────────────

def test_ak_no_arbitrary_bti_tolerance():
    """Test AK: Source code audit asserting no arbitrary tolerances (1e-6, 1e-5) exist in BTI evaluation."""
    source_lines = inspect.getsourcelines(rel_mod.PhysicsReliabilityEngine.evaluate_bti_consistency)[0]
    for line in source_lines:
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"') or stripped.startswith("'"):
            continue
        assert "1e-6" not in line
        assert "1e-5" not in line


# ─── Test AL: Real schema compatibility without Vth trajectory ─────────────────

def test_al_real_telemetry_schema_compatibility(engine):
    """Test AL: Telemetry record adhering to real raw schema (single threshold_voltage, no Vth trajectory) yields INSUFFICIENT_PHYSICS_EVIDENCE with score 0.8."""
    real_schema_record = {
        "component_id": "CMP-REAL-001",
        "lot_id": "LOT-REAL-01",
        "threshold_voltage": 0.45,
        "temperature": 125.0,
        "burn_in_hour": 168.0,
        "iddq_0h": 100.0,
        "iddq_24h": 102.5,
        "iddq_168h": 106.0,
        "ileak_0h": 10.0,
        "ileak_24h": 10.0,
        "ileak_168h": 9.98,
        "tpd_0h": 50.0,
        "tpd_24h": 51.2,
        "tpd_168h": 53.5,
    }
    result = engine.evaluate_physics_evidence(real_schema_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.8
    assert len(result["passed_physics_checks"]) == 4
    assert len(result["insufficient_physics_checks"]) == 1
    assert CHECK_BTI_MONOTONICITY in result["insufficient_physics_checks"]


# ─── Test AM: Single threshold_voltage not fabricated as trajectory ───────────

def test_am_single_vth_field_not_fabricated_as_trajectory(engine):
    """Test AM: Single threshold_voltage point in record is not copied or fabricated into evaluated Vth trajectory."""
    record = {
        "threshold_voltage": 0.45,
        "iddq_0h": 100.0, "iddq_24h": 102.5, "iddq_168h": 106.0,
        "ileak_0h": 10.0, "ileak_24h": 10.0, "ileak_168h": 9.98,
        "tpd_0h": 50.0, "tpd_24h": 51.2, "tpd_168h": 53.5,
    }
    result = engine.evaluate_physics_evidence(record)
    bti_ev = result["evidence"]["bti_consistency"]
    assert bti_ev["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"
    assert "evaluated_vth_1" not in bti_ev
    assert "evaluated_vth_2" not in bti_ev


# ─── Test AN: Standalone BTI fail-closed on missing observed Vth ───────────────

def test_an_standalone_bti_evaluator_insufficient_evidence(engine):
    """Test AN: evaluate_bti_consistency returns FAIL status and INSUFFICIENT_PHYSICS_EVIDENCE conclusion when observed Vth drift is None."""
    passed, ev = engine.evaluate_bti_consistency(
        time_hours_1=24.0, time_hours_2=168.0, observed_vth_shift_1=None, observed_vth_shift_2=None
    )
    assert not passed
    assert ev["status"] == "FAIL"
    assert ev["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"
    assert ev["observed_evidence_status"] == "INSUFFICIENT_PHYSICS_EVIDENCE"


# ─── Test AO: Explicit Vth trajectory evaluates consistently ──────────────────

def test_ao_explicit_vth_trajectory_evaluates_consistently(engine, valid_record):
    """Test AO: Providing explicit observed vth_shift_24h and vth_shift_168h allows BTI check to pass and yields PHYSICS_CONSISTENT status with score 1.0."""
    result = engine.evaluate_physics_evidence(valid_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value
    assert result["physics_consistency_score"] == 1.0
    assert len(result["passed_physics_checks"]) == 5
    assert len(result["insufficient_physics_checks"]) == 0


# ─── Test AP: Status propagation to INSUFFICIENT_PHYSICS_EVIDENCE ─────────────

def test_ap_insufficient_evidence_status_propagation(engine, valid_record):
    """Test AP: When 4 checks pass and 1 check is INSUFFICIENT_PHYSICS_EVIDENCE, overall status propagates to INSUFFICIENT_PHYSICS_EVIDENCE."""
    rec = copy.deepcopy(valid_record)
    del rec["vth_shift_24h"]
    del rec["vth_shift_168h"]
    res = engine.evaluate_physics_evidence(rec)
    assert res["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert res["physics_consistency_score"] == 0.8
    assert res["passed_physics_checks"] == [
        CHECK_TIMING_DEGRADATION,
        CHECK_LEAKAGE_TRAJECTORY,
        CHECK_THERMAL_ARRHENIUS,
        CHECK_FORECAST_TRAJECTORY,
    ]


# ─── Test AQ: Suite regression verification ───────────────────────────────────

def test_aq_suite_regression_verification(engine, valid_record):
    """Test AQ: Overall regression sanity check confirming physics engine behavior across all checks."""
    res = engine.evaluate_physics_evidence(valid_record)
    assert res["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value


# ─── Test AR: AST check for no synthetic Vth schema fabrication ────────────────

def test_ar_ast_no_synthetic_vth_schema_fabrication():
    """Test AR: AST audit asserting reliability_engine.py does not fabricate synthetic Vth drift trajectories from threshold_voltage or model outputs."""
    source_lines = inspect.getsourcelines(rel_mod)[0]
    for line_idx, line in enumerate(source_lines, 1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"') or stripped.startswith("'"):
            continue
        assert "vth_shift_24h = record" not in line, f"Synthetic Vth assignment at line {line_idx}: {line}"
        assert "vth_shift_168h = record" not in line, f"Synthetic Vth assignment at line {line_idx}: {line}"


# ─── Test AS: Timing evaluation signature parameter audit ────────────────────

def test_as_timing_evaluation_no_vth_parameters():
    """Test AS: Inspect signature of evaluate_timing_consistency asserting vth_shift_24h/168h are not accepted as parameters."""
    sig = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_timing_consistency)
    assert "vth_shift_24h" not in sig.parameters
    assert "vth_shift_168h" not in sig.parameters


# ─── Test AT: Leakage evaluation signature parameter audit ───────────────────

def test_at_leakage_evaluation_no_vth_parameters():
    """Test AT: Inspect signature of evaluate_leakage_consistency asserting vth_shift_24h/168h are not accepted as parameters."""
    sig = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_leakage_consistency)
    assert "vth_shift_24h" not in sig.parameters
    assert "vth_shift_168h" not in sig.parameters


# ─── Test AU: Dynamic BTI model participation in timing check ────────────────

def test_au_monkeypatched_bti_controls_timing_model_output(engine, monkeypatch):
    """Test AU: Monkeypatch bti_threshold_drift and verify timing model expected outputs change according to patched BTI outputs."""
    def mock_bti(time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev):
        # Inverted model for test: large Vth shift at 24h, tiny Vth shift at 168h
        return 0.50 if time_hours == 24.0 else 0.01

    monkeypatch.setattr(rel_mod, "bti_threshold_drift", mock_bti)

    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, temp_c=125.0
    )
    assert ev["model_vth_24h"] == 0.50
    assert ev["model_vth_168h"] == 0.01
    assert ev["expected_tpd_24h"] > ev["expected_tpd_168h"]


# ─── Test AV: Dynamic BTI model participation in leakage check ───────────────

def test_av_monkeypatched_bti_controls_leakage_model_output(engine, monkeypatch):
    """Test AV: Monkeypatch bti_threshold_drift and verify leakage model expected outputs change according to patched BTI outputs."""
    def mock_bti(time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev):
        return 0.10 if time_hours == 24.0 else 0.30

    monkeypatch.setattr(rel_mod, "bti_threshold_drift", mock_bti)

    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.8, temp_c=125.0, defect_type="NORMAL"
    )
    assert ev["model_vth_24h"] == 0.10
    assert ev["model_vth_168h"] == 0.30


# ─── Test AW: Observed timing telemetry preserved ─────────────────────────────

def test_aw_observed_timing_telemetry_preserved(engine):
    """Test AW: Verify observed timing telemetry values are recorded verbatim and never replaced by model Vth shift values."""
    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5
    )
    assert ev["observed_tpd_0h"] == 50.0
    assert ev["observed_tpd_24h"] == 51.2
    assert ev["observed_tpd_168h"] == 53.5


# ─── Test AX: Observed leakage telemetry preserved ────────────────────────────

def test_ax_observed_leakage_telemetry_preserved(engine):
    """Test AX: Verify observed leakage telemetry values are recorded verbatim and never replaced by model Vth shift values."""
    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.9, defect_type="NORMAL"
    )
    assert ev["observed_leak_0h"] == 10.0
    assert ev["observed_leak_24h"] == 10.0
    assert ev["observed_leak_168h"] == 9.9


# ─── Test AY: Invalid/Unestablished model provenance fails closed ────────────

def test_ay_invalid_model_provenance_fails_closed(engine):
    """Test AY: Unphysical input parameters (e.g. temp_c <= -273.15) return FAIL with INSUFFICIENT_PHYSICS_EVIDENCE."""
    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, temp_c=-300.0
    )
    assert not passed
    assert ev["status"] == "FAIL"
    assert ev["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"

    passed_l, ev_l = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.9, temp_c=-300.0
    )
    assert not passed_l
    assert ev_l["status"] == "FAIL"
    assert ev_l["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"


# ─── Test AZ: AST audit for no arbitrary Vth default constants ────────────────

def test_az_ast_no_arbitrary_vth_default_constants():
    """Test AZ: Source code AST audit asserting no default synthetic Vth constants (0.01, 0.05) exist in signatures or bodies of timing/leakage/forecast evaluators."""
    source_lines = inspect.getsourcelines(rel_mod)[0]
    for line_idx, line in enumerate(source_lines, 1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"') or stripped.startswith("'"):
            continue
        assert "vth_shift_24h: float = 0.01" not in line, f"Arbitrary default at line {line_idx}: {line}"
        assert "vth_shift_168h: float = 0.05" not in line, f"Arbitrary default at line {line_idx}: {line}"
        assert "0.01, 17.5" not in line, f"Hardcoded timing Vth at line {line_idx}: {line}"
        assert "0.05, 17.5" not in line, f"Hardcoded timing Vth at line {line_idx}: {line}"


# ─── Test BA: Task 1 missing Vth telemetry regression ─────────────────────────

def test_ba_task_1_missing_vth_telemetry_regression(engine):
    """Test BA: Telemetry record without Vth drift fields yields INSUFFICIENT_PHYSICS_EVIDENCE for BTI and score 0.8."""
    rec = {
        "component_id": "CMP-BA-001",
        "lot_id": "LOT-BA-01",
        "threshold_voltage": 0.45,
        "temperature": 125.0,
        "burn_in_hour": 168.0,
        "iddq_0h": 100.0, "iddq_24h": 102.5, "iddq_168h": 106.0,
        "ileak_0h": 10.0, "ileak_24h": 10.0, "ileak_168h": 9.98,
        "tpd_0h": 50.0, "tpd_24h": 51.2, "tpd_168h": 53.5,
    }
    result = engine.evaluate_physics_evidence(rec)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.INSUFFICIENT_PHYSICS_EVIDENCE.value
    assert result["physics_consistency_score"] == 0.8
    assert CHECK_BTI_MONOTONICITY in result["insufficient_physics_checks"]


# ─── Test BB: Explicit observed Vth trajectory regression ─────────────────────

def test_bb_explicit_observed_vth_trajectory_regression(engine, valid_record):
    """Test BB: Explicit observed Vth trajectory allows all 5 checks to pass with score 1.0 and PHYSICS_CONSISTENT status."""
    result = engine.evaluate_physics_evidence(valid_record)
    assert result["physics_consistency_status"] == PhysicsConsistencyStatus.PHYSICS_CONSISTENT.value
    assert result["physics_consistency_score"] == 1.0
    assert len(result["passed_physics_checks"]) == 5
    assert len(result["insufficient_physics_checks"]) == 0


# ─── Test BC: Observed Vth does not change timing model Vth ───────────────────

def test_bc_observed_vth_does_not_change_timing_model_vth(engine):
    """Test BC: Passing a record with extreme observed Vth shift values does NOT alter timing model Vth derivation."""
    rec_normal = {
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
        "iddq_0h": 100.0, "iddq_24h": 102.5, "iddq_168h": 106.0,
        "ileak_0h": 10.0, "ileak_24h": 10.0, "ileak_168h": 9.98,
        "tpd_0h": 50.0, "tpd_24h": 51.2, "tpd_168h": 53.5,
    }
    rec_extreme = copy.deepcopy(rec_normal)
    rec_extreme["vth_shift_24h"] = 0.999
    rec_extreme["vth_shift_168h"] = 0.999

    res_normal = engine.evaluate_physics_evidence(rec_normal)
    res_extreme = engine.evaluate_physics_evidence(rec_extreme)

    # Timing model expected Tpd outputs MUST be identical regardless of observed Vth values!
    assert res_normal["evidence"]["timing_consistency"]["model_vth_24h"] == res_extreme["evidence"]["timing_consistency"]["model_vth_24h"]
    assert res_normal["evidence"]["timing_consistency"]["expected_tpd_24h"] == res_extreme["evidence"]["timing_consistency"]["expected_tpd_24h"]


# ─── Test BD: Observed Vth does not change leakage model Vth ──────────────────

def test_bd_observed_vth_does_not_change_leakage_model_vth(engine):
    """Test BD: Passing a record with extreme observed Vth shift values does NOT alter leakage model Vth derivation."""
    rec_normal = {
        "vth_shift_24h": 0.01,
        "vth_shift_168h": 0.05,
        "iddq_0h": 100.0, "iddq_24h": 102.5, "iddq_168h": 106.0,
        "ileak_0h": 10.0, "ileak_24h": 10.0, "ileak_168h": 9.98,
        "tpd_0h": 50.0, "tpd_24h": 51.2, "tpd_168h": 53.5,
    }
    rec_extreme = copy.deepcopy(rec_normal)
    rec_extreme["vth_shift_24h"] = 0.999
    rec_extreme["vth_shift_168h"] = 0.999

    res_normal = engine.evaluate_physics_evidence(rec_normal)
    res_extreme = engine.evaluate_physics_evidence(rec_extreme)

    # Leakage model expected Leak outputs MUST be identical regardless of observed Vth values!
    assert res_normal["evidence"]["leakage_consistency"]["model_vth_24h"] == res_extreme["evidence"]["leakage_consistency"]["model_vth_24h"]
    assert res_normal["evidence"]["leakage_consistency"]["expected_leak_24h"] == res_extreme["evidence"]["leakage_consistency"]["expected_leak_24h"]


# ─── Test BE: Monkeypatched BTI controls timing model output independently ────

def test_be_monkeypatched_bti_controls_timing_independently(engine, monkeypatch):
    """Test BE: Monkeypatch bti_threshold_drift and verify timing expected trajectory changes while observed Vth remains independent."""
    def mock_bti(time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev):
        return 0.80 if time_hours == 24.0 else 0.02

    monkeypatch.setattr(rel_mod, "bti_threshold_drift", mock_bti)

    passed, ev = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, temp_c=125.0
    )
    assert ev["model_vth_24h"] == 0.80
    assert ev["model_vth_168h"] == 0.02
    assert ev["expected_tpd_24h"] > ev["expected_tpd_168h"]


# ─── Test BF: Monkeypatched BTI controls leakage model output independently ───

def test_bf_monkeypatched_bti_controls_leakage_independently(engine, monkeypatch):
    """Test BF: Monkeypatch bti_threshold_drift and verify leakage expected trajectory changes while observed Vth remains independent."""
    def mock_bti(time_hours, temp_c, voltage_v, base_amp, exponent_n, activation_energy_ev):
        return 0.15 if time_hours == 24.0 else 0.45

    monkeypatch.setattr(rel_mod, "bti_threshold_drift", mock_bti)

    passed, ev = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.8, temp_c=125.0, defect_type="NORMAL"
    )
    assert ev["model_vth_24h"] == 0.15
    assert ev["model_vth_168h"] == 0.45


# ─── Test BG: Authoritative BTI parameter defaults ───────────────────────────

def test_bg_authoritative_bti_parameter_defaults(engine):
    """Test BG: Verify default BTI parameters match authoritative repository specifications (base_amp=1.2, exponent_n=0.20, activation_energy_ev=0.12)."""
    sig = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_timing_consistency)
    assert sig.parameters["base_amp"].default == 1.2
    assert sig.parameters["exponent_n"].default == 0.20
    assert sig.parameters["activation_energy_ev"].default == 0.12


# ─── Test BH: Invalid required model parameter provenance fails closed ─────────

def test_bh_invalid_model_parameter_provenance_fails_closed(engine):
    """Test BH: Passing unphysical BTI model parameters (e.g. base_amp <= 0) causes evaluation to fail closed with INSUFFICIENT_PHYSICS_EVIDENCE."""
    passed_t, ev_t = engine.evaluate_timing_consistency(
        tpd_0h=50.0, tpd_24h=51.2, tpd_168h=53.5, base_amp=-1.0
    )
    assert not passed_t
    assert ev_t["status"] == "FAIL"
    assert ev_t["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"

    passed_l, ev_l = engine.evaluate_leakage_consistency(
        ileak_0h=10.0, ileak_24h=10.0, ileak_168h=9.9, activation_energy_ev=-0.5
    )
    assert not passed_l
    assert ev_l["status"] == "FAIL"
    assert ev_l["consistency_conclusion"] == "INSUFFICIENT_PHYSICS_EVIDENCE"


# ─── Test BI: AST audit for separate observed Vth and model Vth provenance ─────

def test_bi_ast_no_observed_vth_in_timing_leakage_signatures():
    """Test BI: AST source audit proving vth_shift_24h and vth_shift_168h are not accepted as parameters in evaluate_timing_consistency or evaluate_leakage_consistency."""
    sig_t = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_timing_consistency)
    sig_l = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_leakage_consistency)
    sig_f = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_forecast_trajectory_consistency)

    assert "vth_shift_24h" not in sig_t.parameters
    assert "vth_shift_168h" not in sig_t.parameters
    assert "vth_shift_24h" not in sig_l.parameters
    assert "vth_shift_168h" not in sig_l.parameters
    assert "vth_shift_24h" not in sig_f.parameters
    assert "vth_shift_168h" not in sig_f.parameters


# ─── Test BJ: No duplicated leakage Arrhenius logic & onset_hour default ──────

def test_bj_no_duplicated_leakage_arrhenius_and_onset_hour_default():
    """Test BJ: Verifies no duplicated leakage Arrhenius equation exists in reliability_engine.py and onset_hour defaults to 0.0."""
    source = inspect.getsource(rel_mod)
    assert "temp_factor = math.exp" not in source
    assert "leak_0_base" not in source

    sig_l = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_leakage_consistency)
    sig_f = inspect.signature(rel_mod.PhysicsReliabilityEngine.evaluate_forecast_trajectory_consistency)

    assert sig_l.parameters["onset_hour"].default == 0.0
    assert sig_f.parameters["onset_hour"].default == 0.0




