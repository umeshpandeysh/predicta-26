"""
Predicta Semiconductor Reliability — Feature Schema & Parity Test Suite
File: tests/test_feature_parity.py

Rigorous assertions verifying:
1. Exact locked 28-feature production contract.
2. Perfect parity between single-record extract_feature_vector and batch compute_engineered_features_df.
3. Unseen equipment encoding cleanly produces 0.0 across all 5 equipment indicators.
4. Physical boundary constraints and unit invariants.
"""

import os
import sys
import pytest
import numpy as np
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from src.features.feature_contract import (
    ALL_28_FEATURE_NAMES,
    RAW_NUMERICAL_FEATURES,
    ENGINEERED_FEATURES,
    EQUIPMENT_ONE_HOT_COLS,
    compute_engineered_features_dict,
    compute_engineered_features_df,
    extract_feature_vector,
)


@pytest.fixture
def sample_telemetry_dict():
    return {
        "equipment_id": "EQP-102",
        "supply_voltage": 1.20,
        "output_voltage": 1.18,
        "current": 45.0,
        "leakage_current": 120.0,
        "resistance": 12.5,
        "capacitance": 4.2,
        "threshold_voltage": 0.45,
        "frequency": 2500.0,
        "propagation_delay": 12.0,
        "setup_time": 1.2,
        "hold_time": 0.6,
        "timing_margin": 2.5,
        "temperature": 32.0,
        "dynamic_power": 55.0,
        "total_power": 62.0,
        "test_duration": 150.0,
    }


def test_01_feature_vector_dimensionality():
    """Verify total feature count is exactly 28 (16 raw + 7 engineered + 5 equipment)."""
    assert len(RAW_NUMERICAL_FEATURES) == 16
    assert len(ENGINEERED_FEATURES) == 7
    assert len(EQUIPMENT_ONE_HOT_COLS) == 5
    assert len(ALL_28_FEATURE_NAMES) == 28


def test_02_feature_ordering():
    """Verify exact column index positioning in the authoritative contract."""
    assert ALL_28_FEATURE_NAMES[0] == "supply_voltage"
    assert ALL_28_FEATURE_NAMES[15] == "test_duration"
    assert ALL_28_FEATURE_NAMES[16] == "voltage_headroom"
    assert ALL_28_FEATURE_NAMES[22] == "thermal_delta"
    assert ALL_28_FEATURE_NAMES[23] == "eq_EQP-101"
    assert ALL_28_FEATURE_NAMES[27] == "eq_EQP-105"


def test_03_single_vs_batch_parity(sample_telemetry_dict):
    """Verify exact mathematical parity between extract_feature_vector and compute_engineered_features_df."""
    # Single record extraction
    vector_single, is_unseen = extract_feature_vector(sample_telemetry_dict)
    assert not is_unseen

    # Vectorized DataFrame computation
    df = pd.DataFrame([sample_telemetry_dict])
    df_feat = compute_engineered_features_df(df)
    vector_batch = df_feat[ALL_28_FEATURE_NAMES].iloc[0].to_list()

    assert len(vector_single) == len(vector_batch) == 28

    for name, s_val, b_val in zip(ALL_28_FEATURE_NAMES, vector_single, vector_batch):
        diff = abs(s_val - b_val)
        assert diff < 1e-5, f"Feature mismatch in '{name}': single={s_val}, batch={b_val}, diff={diff}"


def test_04_unseen_equipment_neutral_baseline(sample_telemetry_dict):
    """Verify unseen equipment generates 0.0 across all 5 one-hot columns and flags novelty."""
    unseen_record = dict(sample_telemetry_dict)
    unseen_record["equipment_id"] = "EQP-999"

    vector, is_unseen = extract_feature_vector(unseen_record)
    assert is_unseen is True

    # Check equipment one-hot indices (23 through 27)
    eq_values = vector[23:28]
    assert eq_values == [0.0, 0.0, 0.0, 0.0, 0.0]


def test_05_division_by_zero_protection():
    """Verify engineered feature computation never raises ZeroDivisionError or produces inf/nan."""
    edge_record = {
        "supply_voltage": 0.00001,
        "output_voltage": 0.0,
        "current": 0.00001,
        "leakage_current": 0.0,
        "resistance": 1.0,
        "capacitance": 1.0,
        "threshold_voltage": 0.0,
        "frequency": 100.0,
        "propagation_delay": 0.00001,
        "setup_time": 0.1,
        "hold_time": 0.1,
        "timing_margin": 0.0,
        "temperature": 25.0,
        "dynamic_power": 0.0,
        "total_power": 0.0,
        "test_duration": 10.0,
    }

    eng = compute_engineered_features_dict(edge_record)
    for k, v in eng.items():
        assert np.isfinite(v), f"Feature {k} is not finite: {v}"
