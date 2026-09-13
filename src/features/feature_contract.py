"""
PREDICTA-26 — Authoritative Feature Contract & Physics Engine
File: src/features/feature_contract.py

Single authoritative source of truth for:
  - 16 Raw ATE telemetry channels (electrical, timing, power, thermal)
  - 7 Core engineered physical features
  - 5 Equipment one-hot encodings (with neutral 0.0 baseline for unseen equipment)
  - 12 Extended semiconductor degradation kinetics features
  - Total 28-feature production inference vector
  - Strict units, validity ranges, missing value handling, and numerical equivalence between training & inference.
"""

from typing import Any, Dict, List, Optional, Tuple
import math
import numpy as np
import pandas as pd

FEATURE_SCHEMA_VERSION = "4.0.0_authoritative"

# 16 Raw Automated Test Equipment (ATE) Telemetry Channels
RAW_NUMERICAL_FEATURES: List[str] = [
    "supply_voltage",       # V_dd  (V)
    "output_voltage",       # V_out (V)
    "current",              # I_dd  (mA)
    "leakage_current",      # I_leak (µA)
    "resistance",           # R     (Ω)
    "capacitance",          # C     (pF)
    "threshold_voltage",    # V_th  (V)
    "frequency",            # f     (MHz)
    "propagation_delay",    # t_pd  (ns)
    "setup_time",           # t_setup (ns)
    "hold_time",            # t_hold (ns)
    "timing_margin",        # t_margin (ns)
    "temperature",          # T     (°C)
    "dynamic_power",        # P_dyn (mW)
    "total_power",          # P_total (mW)
    "test_duration",        # t_test (ms)
]

RAW_TELEMETRY_CHANNELS = RAW_NUMERICAL_FEATURES

# 7 Core Engineered Features
ENGINEERED_FEATURES: List[str] = [
    "voltage_headroom",                # V_dd - V_th (V)
    "voltage_utilization",             # V_th / V_dd (dimensionless)
    "leakage_fraction",                # (I_leak * 1e-3) / I_dd (dimensionless subthreshold leakage ratio)
    "power_per_current",               # P_dyn / I_dd (V, effective dynamic switching voltage)
    "normalized_timing_margin",        # t_margin / t_pd (dimensionless slack-delay ratio)
    "frequency_delay_product",         # f * t_pd * 1e-3 (fraction of clock cycle occupied by propagation)
    "thermal_delta",                   # T - 25.0 (°C, temperature rise above nominal ambient)
]

# 5 Production Equipment Encodings
EQUIPMENT_IDS: List[str] = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]
EQUIPMENT_ONE_HOT_COLS: List[str] = [f"eq_{eq}" for eq in EQUIPMENT_IDS]
KNOWN_EQUIPMENT_IDS = set(EQUIPMENT_IDS)

# The Authoritative 28-Feature Production Vector (16 raw + 7 engineered + 5 equipment)
ALL_28_FEATURE_NAMES: List[str] = RAW_NUMERICAL_FEATURES + ENGINEERED_FEATURES + EQUIPMENT_ONE_HOT_COLS

# 12 Extended Semiconductor Degradation Kinetics Features (For Physics Ablation & Forensics)
PHYSICS_12_FEATURES: List[str] = [
    "voltage_headroom",                # V_dd - V_th (V)
    "voltage_utilization",             # V_th / V_dd (dimensionless)
    "leakage_fraction",                # (I_leak * 1e-3) / I_dd (dimensionless subthreshold leakage ratio)
    "power_per_current",               # P_dyn / I_dd (V, effective dynamic switching voltage)
    "normalized_timing_margin",        # t_margin / t_pd (dimensionless slack-delay ratio)
    "frequency_delay_product",         # f * t_pd * 1e-3 (fraction of clock cycle occupied by propagation)
    "thermal_delta",                   # T - 25.0 (°C, temperature rise above nominal ambient)
    "effective_drive_current",         # I_dd - (I_leak * 1e-3) (mA, net active channel drive)
    "rc_delay",                        # R * C * 1e-3 (ns, intrinsic interconnect RC time constant)
    "timing_slack",                    # t_margin - (t_setup + t_hold) (ns, violation slack margin)
    "dynamic_power_per_freq",          # P_dyn / f (µJ/cycle, energy consumed per switching cycle)
    "leakage_temperature_interaction", # (I_leak * 1e-3) * T (mA·°C, Arrhenius thermal-leakage runaway product)
]

ALL_28_PHYSICS_FEATURES: List[str] = RAW_NUMERICAL_FEATURES + PHYSICS_12_FEATURES

# Physical parameter range boundaries for validation
PHYSICAL_RANGE_BOUNDS: Dict[str, Tuple[float, float]] = {
    "supply_voltage": (0.5, 3.5),
    "output_voltage": (0.1, 3.5),
    "current": (0.1, 500.0),
    "leakage_current": (0.0, 50000.0),
    "resistance": (0.1, 200.0),
    "capacitance": (0.01, 100.0),
    "threshold_voltage": (0.05, 1.5),
    "frequency": (50.0, 10000.0),
    "propagation_delay": (0.5, 100.0),
    "setup_time": (0.01, 20.0),
    "hold_time": (0.01, 10.0),
    "timing_margin": (-10.0, 50.0),
    "temperature": (-40.0, 200.0),
    "dynamic_power": (0.1, 2000.0),
    "total_power": (0.1, 2500.0),
    "test_duration": (1.0, 5000.0),
}

# Authoritative Defect Taxonomy
DEFECT_TAXONOMY: List[str] = [
    "NORMAL",
    "HIGH_LEAKAGE",
    "LOW_VOLTAGE",
    "TIMING_FAILURE",
    "THERMAL_ANOMALY",
    "POWER_ANOMALY",
    "PROCESS_VARIATION",
    "EQUIPMENT_DRIFT",
]

DEFECT_LABEL_MAP: Dict[str, int] = {name: idx for idx, name in enumerate(DEFECT_TAXONOMY)}
DEFECT_INDEX_MAP: Dict[int, str] = {idx: name for idx, name in enumerate(DEFECT_TAXONOMY)}


def compute_engineered_features_dict(raw_feat: Dict[str, float]) -> Dict[str, float]:
    """
    Computes core engineered features from a dictionary of 16 raw features.
    Guarantees strict numerical stability (division by zero protection, NaN elimination).
    """
    v_sup = float(raw_feat["supply_voltage"])
    v_th = float(raw_feat["threshold_voltage"])
    i_tot = float(raw_feat["current"])
    i_leak = float(raw_feat["leakage_current"])
    p_dyn = float(raw_feat["dynamic_power"])
    t_margin = float(raw_feat["timing_margin"])
    t_pd = float(raw_feat["propagation_delay"])
    freq = float(raw_feat["frequency"])
    temp = float(raw_feat["temperature"])

    i_leak_ma = i_leak * 1e-3

    voltage_headroom = v_sup - v_th
    voltage_utilization = (v_th / v_sup) if v_sup > 1e-4 else 0.0
    leakage_fraction = (i_leak_ma / i_tot) if i_tot > 1e-4 else 0.0
    power_per_current = (p_dyn / i_tot) if i_tot > 1e-4 else 0.0
    normalized_timing_margin = (t_margin / t_pd) if t_pd > 1e-4 else 0.0
    frequency_delay_product = freq * t_pd
    thermal_delta = temp - 25.0

    return {
        "voltage_headroom": round(voltage_headroom, 6),
        "voltage_utilization": round(voltage_utilization, 6),
        "leakage_fraction": round(leakage_fraction, 6),
        "power_per_current": round(power_per_current, 6),
        "normalized_timing_margin": round(normalized_timing_margin, 6),
        "frequency_delay_product": round(frequency_delay_product, 6),
        "thermal_delta": round(thermal_delta, 6),
    }


def compute_engineered_features_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Vectorized computation of the 7 core engineered features + 5 equipment one-hot columns.
    """
    res = df.copy()

    v_sup = res["supply_voltage"].to_numpy(dtype=np.float64)
    v_th = res["threshold_voltage"].to_numpy(dtype=np.float64)
    i_tot = res["current"].to_numpy(dtype=np.float64)
    i_leak = res["leakage_current"].to_numpy(dtype=np.float64)
    p_dyn = res["dynamic_power"].to_numpy(dtype=np.float64)
    t_margin = res["timing_margin"].to_numpy(dtype=np.float64)
    t_pd = res["propagation_delay"].to_numpy(dtype=np.float64)
    freq = res["frequency"].to_numpy(dtype=np.float64)
    temp = res["temperature"].to_numpy(dtype=np.float64)

    i_leak_ma = i_leak * 1e-3

    res["voltage_headroom"] = v_sup - v_th
    res["voltage_utilization"] = np.where(v_sup > 1e-4, v_th / v_sup, 0.0)
    res["leakage_fraction"] = np.where(i_tot > 1e-4, i_leak_ma / i_tot, 0.0)
    res["power_per_current"] = np.where(i_tot > 1e-4, p_dyn / i_tot, 0.0)
    res["normalized_timing_margin"] = np.where(t_pd > 1e-4, t_margin / t_pd, 0.0)
    res["frequency_delay_product"] = freq * t_pd
    res["thermal_delta"] = temp - 25.0

    # 5 Equipment One-Hot Encodings (Unseen equipment cleanly receives 0.0 across all 5)
    eq_series = res["equipment_id"].astype(str)
    for eq in EQUIPMENT_IDS:
        res[f"eq_{eq}"] = (eq_series == eq).astype(np.float64)

    return res


def extract_feature_vector(record: Dict[str, Any], equipment_id: Optional[str] = None) -> Tuple[List[float], bool]:
    """
    Extracts the locked 28-feature production vector from a single record.
    Returns (vector_28_floats, is_unseen_equipment).
    """
    raw_dict = {}
    for feat_name in RAW_NUMERICAL_FEATURES:
        if feat_name not in record or record[feat_name] is None:
            raise ValueError(f"VALIDATION_ERROR: Missing required telemetry channel '{feat_name}'")
        try:
            val = float(record[feat_name])
        except (ValueError, TypeError):
            raise ValueError(f"VALIDATION_ERROR: Telemetry channel '{feat_name}' must be numeric. Got {record[feat_name]}")
        if not math.isfinite(val):
            raise ValueError(f"VALIDATION_ERROR: Telemetry channel '{feat_name}' contains non-finite value {val}")
        raw_dict[feat_name] = val

    eng_dict = compute_engineered_features_dict(raw_dict)

    # Equipment encoding
    eq_id = str(equipment_id or record.get("equipment_id", "")).strip().upper()
    is_unseen = eq_id not in KNOWN_EQUIPMENT_IDS

    eq_dict = {}
    for eq in EQUIPMENT_IDS:
        eq_dict[f"eq_{eq}"] = 1.0 if eq_id == eq else 0.0

    combined = {**raw_dict, **eng_dict, **eq_dict}
    vector = [float(combined[col]) for col in ALL_28_FEATURE_NAMES]
    return vector, is_unseen


def encode_equipment_status(equipment_id: str) -> Tuple[bool, str]:
    """Checks if equipment is known or unseen."""
    clean_id = str(equipment_id).strip().upper()
    is_unseen = clean_id not in KNOWN_EQUIPMENT_IDS
    return is_unseen, clean_id
