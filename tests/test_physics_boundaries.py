import os
import sys
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.physics.temperature import calculate_arrhenius_acceleration
from src.physics.leakage import calculate_leakage
from src.physics.timing import calculate_propagation_delay
from src.physics.aging import bti_threshold_drift


def test_temperature_arrhenius_valid():
    """Verify nominal Arrhenius acceleration factor calculation."""
    af = calculate_arrhenius_acceleration(temp_c_use=25.0, temp_c_stress=125.0, activation_energy_ev=0.7)
    assert np.isfinite(af)
    assert af > 1.0, f"Stress temperature should accelerate degradation (AF={af})"


def test_temperature_arrhenius_absolute_zero():
    """Verify rejection of temperatures below or at absolute zero (-273.15 C)."""
    with pytest.raises(ValueError, match="strictly above absolute zero"):
        calculate_arrhenius_acceleration(-273.15, 125.0, 0.7)
    with pytest.raises(ValueError, match="strictly above absolute zero"):
        calculate_arrhenius_acceleration(25.0, -300.0, 0.7)


def test_temperature_arrhenius_negative_ea():
    """Verify rejection of negative activation energy."""
    with pytest.raises(ValueError, match="non-negative"):
        calculate_arrhenius_acceleration(25.0, 125.0, -0.5)


def test_temperature_arrhenius_non_finite():
    """Verify rejection of NaN and infinite inputs."""
    with pytest.raises(ValueError, match="finite numbers"):
        calculate_arrhenius_acceleration(float('nan'), 125.0, 0.7)
    with pytest.raises(ValueError, match="finite numbers"):
        calculate_arrhenius_acceleration(25.0, float('inf'), 0.7)


def test_leakage_boundaries():
    """Verify leakage current calculation boundaries and physics contracts."""
    # Nominal healthy leakage
    leak = calculate_leakage(leak_0h=100.0, temp_c=25.0, vth_shift=0.05, defect_type="NONE", time_hours=168.0, onset_hour=999.0)
    assert np.isfinite(leak)
    assert leak > 0.0

    # Defect breakdown path
    leak_defect = calculate_leakage(leak_0h=100.0, temp_c=85.0, vth_shift=0.1, defect_type="GATE_OXIDE_SHORT", time_hours=200.0, onset_hour=100.0)
    assert np.isfinite(leak_defect)
    assert leak_defect > leak

    # Negative inputs rejected
    with pytest.raises(ValueError, match="non-negative"):
        calculate_leakage(-10.0, 25.0, 0.0, "NONE", 10.0, 10.0)
    with pytest.raises(ValueError, match="non-negative"):
        calculate_leakage(10.0, 25.0, 0.0, "NONE", -5.0, 10.0)
    with pytest.raises(ValueError, match="strictly above absolute zero"):
        calculate_leakage(10.0, -280.0, 0.0, "NONE", 10.0, 10.0)


def test_timing_boundaries():
    """Verify propagation delay calculation boundaries."""
    tpd = calculate_propagation_delay(tpd_0h=12.0, temp_c=85.0, vth_shift=0.05, beta=45.0)
    assert np.isfinite(tpd)
    assert tpd > 12.0, "Temperature and trap stress must increase propagation delay"

    with pytest.raises(ValueError, match="must be positive"):
        calculate_propagation_delay(0.0, 25.0, 0.0, 45.0)
    with pytest.raises(ValueError, match="must be positive"):
        calculate_propagation_delay(-5.0, 25.0, 0.0, 45.0)
    with pytest.raises(ValueError, match="strictly above absolute zero"):
        calculate_propagation_delay(12.0, -300.0, 0.0, 45.0)


def test_bti_aging_drift():
    """Verify BTI aging drift power law physics."""
    drift = bti_threshold_drift(time_hours=168.0, temp_c=125.0, voltage_v=1.5, base_amp=1.5, exponent_n=0.2, activation_energy_ev=0.12)
    assert np.isfinite(drift)
    assert drift > 0.0

    # Drift at t=0 should be 0
    drift_0 = bti_threshold_drift(time_hours=0.0, temp_c=125.0, voltage_v=1.5, base_amp=1.5, exponent_n=0.2, activation_energy_ev=0.12)
    assert drift_0 == 0.0

    with pytest.raises(ValueError, match="non-negative"):
        bti_threshold_drift(-10.0, 25.0, 1.2, 1.0, 0.2, 0.12)
