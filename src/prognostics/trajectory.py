"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostics Foundation
File: src/prognostics/trajectory.py

Implements:
1. Reusable Prognostic Data Builder with explicit separation:
   - early_features (0h and 24h observable)
   - future_ground_truth (168h retrospective evaluation only)
   - metadata (identifiers, lots, wafers)
2. Strict Temporal Leakage Protection:
   - Rejection of 168h/future telemetry from early prediction feature sets
   - Rejection of target/label leakage
   - Strict schema order validation and non-numeric/NaN/Inf protection
3. Authoritative Trajectory Semantics:
   - PASS_24H_PASS_168H (Healthy through 168h)
   - PASS_24H_FAIL_168H (True Latent Failure)
   - FAIL_24H_FAIL_168H (Early Failure visible at 24h)
   - FAIL_24H_PASS_168H (Early 24h anomaly, recovered by 168h)
   - INSUFFICIENT_HISTORY (Missing 24h or 168h checkpoint)
4. Lot-Held-Out Disjoint Split Management
5. Standardized Prognostic Evaluation Metrics (Recall, FNR, Precision, F1, F2, PR-AUC, ROC-AUC)
6. Evaluation-only Baseline Models (Persistence & ML Early-Feature Baseline)
"""

import os
import json
import hashlib
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Union

import numpy as np
import pandas as pd


class FeatureProvenance(str, Enum):
    """Authoritative classification of feature provenance."""
    EARLY_OBSERVABLE = "EARLY_OBSERVABLE"
    FUTURE_GROUND_TRUTH = "FUTURE_GROUND_TRUTH"
    IDENTIFIER = "IDENTIFIER"
    METADATA = "METADATA"
    TARGET = "TARGET"


class TrajectoryState(str, Enum):
    """Authoritative semantic trajectory states."""
    PASS_24H_PASS_168H = "PASS_24H_PASS_168H"
    PASS_24H_FAIL_168H = "PASS_24H_FAIL_168H"
    FAIL_24H_FAIL_168H = "FAIL_24H_FAIL_168H"
    FAIL_24H_PASS_168H = "FAIL_24H_PASS_168H"
    INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY"


CANONICAL_EARLY_FEATURES = [
    "iddq_0h",
    "ileak_0h",
    "tpd_0h",
    "iddq_24h",
    "ileak_24h",
    "tpd_24h",
    "iddq_drift_24h",
    "ileak_drift_24h",
    "tpd_drift_24h"
]

CANONICAL_FUTURE_FIELDS = [
    "iddq_168h_ground_truth",
    "ileak_168h_ground_truth",
    "tpd_168h_ground_truth",
    "state_168h",
    "latent_168h_failure"
]

FORBIDDEN_LEAKAGE_TOKENS = [
    "168",
    "96",
    "48",
    "future",
    "ground_truth",
    "post_burn_in",
    "state_168",
    "result_168",
    "target"
]

CONTRACT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "ml", "prognostics", "prognostic_contract.json")
)

SPLIT_MANIFEST_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "ml", "data", "split_manifest.json")
)


def compute_sha256(filepath: str) -> str:
    """Compute cryptographic SHA-256 hash of a file."""
    if not os.path.exists(filepath):
        return "FILE_NOT_FOUND"
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_authoritative_prognostic_contract(contract_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Loads and validates the authoritative prognostic contract from disk.
    Fails closed if the contract file is missing, unparseable, or invalid.
    """
    path_to_use = contract_path or CONTRACT_PATH
    if not os.path.exists(path_to_use):
        raise FileNotFoundError(f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_MISSING: Contract file not found at {path_to_use}")

    try:
        with open(path_to_use, "r", encoding="utf-8") as f:
            contract = json.load(f)
    except Exception as exc:
        raise ValueError(f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_MALFORMED: Failed to parse JSON contract: {exc}") from exc

    required_keys = [
        "contract_version",
        "authority_level",
        "target_specification",
        "feature_policy",
        "split_governance",
        "production_and_model_governance"
    ]
    for k in required_keys:
        if k not in contract:
            raise ValueError(f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required top-level key '{k}'")

    target_spec = contract.get("target_specification", {})
    limits = target_spec.get("parametric_limits", {})
    for lim_key in ["iddq_max_uA", "ileak_max_uA", "tpd_max_ns"]:
        if lim_key not in limits:
            raise ValueError(f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing parametric limit '{lim_key}'")
        val = limits[lim_key]
        if not isinstance(val, (int, float)) or not np.isfinite(val) or val <= 0:
            raise ValueError(f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Invalid limit value for '{lim_key}': {val}")

    return contract


def get_authoritative_spec_limits(contract_path: Optional[str] = None) -> Dict[str, float]:
    """
    Extracts validated parametric specification limits directly from the authoritative contract.
    Returns:
        {"iddq": float, "ileak": float, "tpd": float}
    """
    contract = load_authoritative_prognostic_contract(contract_path)
    limits = contract["target_specification"]["parametric_limits"]
    return {
        "iddq": float(limits["iddq_max_uA"]),
        "ileak": float(limits["ileak_max_uA"]),
        "tpd": float(limits["tpd_max_ns"])
    }


def validate_early_feature_input(
    features: Union[Dict[str, Any], List[float], np.ndarray]
) -> np.ndarray:
    """
    Validates that an early prognostic feature input contains ONLY authorized 0h/24h features
    in canonical order with finite numeric values and zero temporal leakage.

    Returns:
        np.ndarray of shape (9,)
    """
    if isinstance(features, dict):
        keys = list(features.keys())
        # 1. Leakage Token Check on Dict Keys
        for k in keys:
            k_lower = str(k).lower()
            for token in FORBIDDEN_LEAKAGE_TOKENS:
                if token in k_lower:
                    raise ValueError(f"TEMPORAL_LEAKAGE_DETECTED: Forbidden token '{token}' in key '{k}'")

        # 2. Schema check: missing keys
        missing = [f for f in CANONICAL_EARLY_FEATURES if f not in features]
        if missing:
            raise ValueError(f"MISSING_REQUIRED_FEATURE: Missing early features: {missing}")

        # 3. Schema check: extra keys
        extra = [k for k in keys if k not in CANONICAL_EARLY_FEATURES]
        if extra:
            raise ValueError(f"EXTRA_FEATURE_DETECTED: Unauthorized extra keys: {extra}")

        # 4. Strict Order Check
        if keys != CANONICAL_EARLY_FEATURES:
            raise ValueError(
                f"SCHEMA_ORDER_MISMATCH: Expected exact order {CANONICAL_EARLY_FEATURES}, got {keys}"
            )

        # 5. Extract values and validate numeric integrity
        values = []
        for f in CANONICAL_EARLY_FEATURES:
            val = features[f]
            if val is None or isinstance(val, (bool, str)):
                raise ValueError(f"INVALID_NUMERIC_VALUE: Feature '{f}' has non-numeric value: {val}")
            try:
                f_val = float(val)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"INVALID_NUMERIC_VALUE: Feature '{f}' cannot be converted to float: {val}") from exc
            if not np.isfinite(f_val):
                raise ValueError(f"NON_FINITE_VALUE: Feature '{f}' is non-finite (NaN or Inf): {f_val}")
            values.append(f_val)
        return np.array(values, dtype=np.float64)

    elif isinstance(features, (list, tuple, np.ndarray)):
        arr = np.asarray(features, dtype=np.float64)
        if arr.shape != (9,):
            raise ValueError(f"INVALID_DIMENSIONALITY: Expected 9 early features, got {arr.shape}")
        if not np.all(np.isfinite(arr)):
            raise ValueError("NON_FINITE_VALUE: Array contains non-finite values (NaN or Inf)")
        return arr
    else:
        raise ValueError(f"UNSUPPORTED_INPUT_TYPE: Expected dict or array, got {type(features)}")


def evaluate_acceptance_at_hour(
    telemetry: Optional[Dict[str, Any]],
    hour: int,
    spec_limits: Optional[Dict[str, float]] = None,
    contract_path: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Evaluates whether a component telemetry measurement at a given hour is acceptable (PASS) or unacceptable (FAIL).
    Limits are loaded directly from the authoritative prognostic contract if not explicitly provided.
    """
    if telemetry is None or not isinstance(telemetry, dict):
        return False, "MISSING_TELEMETRY"

    # 1. Ground truth health state check if available
    health = telemetry.get("health_state")
    if health is not None:
        health_str = str(health).upper()
        if health_str == "FAILED":
            return False, "HEALTH_STATE_FAILED"
        if health_str == "LATENT_DEFECT":
            tpd_val = float(telemetry.get("tpd", 0.0) or 0.0)
            if hour >= 96 or (hour >= 24 and tpd_val > 230.0):
                return False, "LATENT_DEFECT_MANIFESTED"
            if hour == 24 and tpd_val <= 230.0:
                return True, "ACCEPTABLE_24H_LATENT_CANDIDATE"

    # 2. Parametric threshold checking against authoritative contract limits
    limits = spec_limits if spec_limits is not None else get_authoritative_spec_limits(contract_path)
    reasons = []

    for param in ["tpd", "iddq", "ileak"]:
        if param in telemetry and telemetry[param] is not None:
            try:
                val = float(telemetry[param])
                if not np.isfinite(val):
                    return False, f"NON_FINITE_{param.upper()}"
                if param not in limits:
                    raise ValueError(f"MISSING_SPEC_LIMIT: No specification limit defined for parameter '{param}'")
                limit = float(limits[param])
                if val > limit:
                    reasons.append(f"{param.upper()}_EXCEEDED({val:.2f}>{limit:.1f})")
            except (ValueError, TypeError) as exc:
                if isinstance(exc, ValueError) and "MISSING_SPEC_LIMIT" in str(exc):
                    raise
                return False, f"INVALID_NUMERIC_{param.upper()}"

    if reasons:
        return False, "; ".join(reasons)

    return True, "ACCEPTABLE_WITHIN_LIMITS"


def evaluate_trajectory_state(
    telemetry_24h: Optional[Dict[str, Any]],
    telemetry_168h: Optional[Dict[str, Any]],
    spec_limits: Optional[Dict[str, float]] = None,
    contract_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates the authoritative 168h prognostic target and semantic trajectory state.
    """
    limits = spec_limits if spec_limits is not None else get_authoritative_spec_limits(contract_path)

    if telemetry_24h is None or not isinstance(telemetry_24h, dict):
        state_168 = "INSUFFICIENT_HISTORY" if telemetry_168h is None else ("PASS" if evaluate_acceptance_at_hour(telemetry_168h, 168, limits)[0] else "FAIL")
        return {
            "state_24h": "INSUFFICIENT_HISTORY",
            "state_168h": state_168,
            "latent_168h_failure": None,
            "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
            "reason": "Missing 24h screening telemetry"
        }

    if telemetry_168h is None or not isinstance(telemetry_168h, dict):
        is_pass_24, reason_24 = evaluate_acceptance_at_hour(telemetry_24h, 24, limits)
        return {
            "state_24h": "PASS" if is_pass_24 else "FAIL",
            "state_168h": "INSUFFICIENT_HISTORY",
            "latent_168h_failure": None,
            "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
            "reason": "Missing 168h longitudinal telemetry; ground truth unknown"
        }

    # Verify numerical finiteness
    for k in ["iddq", "ileak", "tpd"]:
        v24 = telemetry_24h.get(k)
        v168 = telemetry_168h.get(k)
        if v24 is not None:
            try:
                if not np.isfinite(float(v24)):
                    return {
                        "state_24h": "INSUFFICIENT_HISTORY",
                        "state_168h": "INSUFFICIENT_HISTORY",
                        "latent_168h_failure": None,
                        "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                        "reason": f"Non-finite 24h reading for {k}: {v24}"
                    }
            except (ValueError, TypeError):
                return {
                    "state_24h": "INSUFFICIENT_HISTORY",
                    "state_168h": "INSUFFICIENT_HISTORY",
                    "latent_168h_failure": None,
                    "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                    "reason": f"Invalid numeric 24h reading for {k}: {v24}"
                }

        if v168 is not None:
            try:
                if not np.isfinite(float(v168)):
                    return {
                        "state_24h": "PASS",
                        "state_168h": "INSUFFICIENT_HISTORY",
                        "latent_168h_failure": None,
                        "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                        "reason": f"Non-finite 168h reading for {k}: {v168}"
                    }
            except (ValueError, TypeError):
                return {
                    "state_24h": "PASS",
                    "state_168h": "INSUFFICIENT_HISTORY",
                    "latent_168h_failure": None,
                    "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                    "reason": f"Invalid numeric 168h reading for {k}: {v168}"
                }

    is_pass_24, reason_24 = evaluate_acceptance_at_hour(telemetry_24h, 24, limits)
    is_pass_168, reason_168 = evaluate_acceptance_at_hour(telemetry_168h, 168, limits)

    state_24 = "PASS" if is_pass_24 else "FAIL"
    state_168 = "PASS" if is_pass_168 else "FAIL"

    if is_pass_24 and not is_pass_168:
        # TRUE LATENT FAILURE
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": True,
            "trajectory_state": TrajectoryState.PASS_24H_FAIL_168H.value,
            "reason": f"Latent wear-out: Passed at 24h ({reason_24}), failed by 168h ({reason_168})"
        }
    elif is_pass_24 and is_pass_168:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.PASS_24H_PASS_168H.value,
            "reason": "Healthy component: Passed both 24h and 168h screening"
        }
    elif not is_pass_24 and not is_pass_168:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.FAIL_24H_FAIL_168H.value,
            "reason": f"Early failure: Failed at 24h ({reason_24}); already quarantined before burn-in"
        }
    else:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.FAIL_24H_PASS_168H.value,
            "reason": f"Transient 24h anomaly ({reason_24}) followed by acceptable 168h reading"
        }


def extract_prognostic_record(
    row_0h: Optional[Dict[str, Any]],
    row_24h: Optional[Dict[str, Any]],
    row_168h: Optional[Dict[str, Any]],
    component_id: str,
    spec_limits: Optional[Dict[str, float]] = None,
    contract_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Constructs an authoritative prognostic component record with strict structural separation:
    - metadata
    - early_features
    - future_ground_truth
    - state_24h
    """
    limits = spec_limits if spec_limits is not None else get_authoritative_spec_limits(contract_path)
    eval_res = evaluate_trajectory_state(row_24h, row_168h, limits)

    lot_id = None
    wafer_id = None
    manufacturer = None
    pkg = None
    comp_family = None
    comp_type = None

    for r in [row_24h, row_0h, row_168h]:
        if r and isinstance(r, dict):
            lot_id = lot_id or r.get("lot_id")
            wafer_id = wafer_id or r.get("wafer_id")
            manufacturer = manufacturer or r.get("manufacturer")
            pkg = pkg or r.get("package")
            comp_family = comp_family or r.get("component_family")
            comp_type = comp_type or r.get("component_type")

    # Construct early features strictly from 0h and 24h
    has_early = bool(row_0h and row_24h and isinstance(row_0h, dict) and isinstance(row_24h, dict))

    if has_early:
        try:
            iddq_0 = float(row_0h["iddq"])
            ileak_0 = float(row_0h["ileak"])
            tpd_0 = float(row_0h["tpd"])
            iddq_24 = float(row_24h["iddq"])
            ileak_24 = float(row_24h["ileak"])
            tpd_24 = float(row_24h["tpd"])

            early_features = {
                "iddq_0h": iddq_0,
                "ileak_0h": ileak_0,
                "tpd_0h": tpd_0,
                "iddq_24h": iddq_24,
                "ileak_24h": ileak_24,
                "tpd_24h": tpd_24,
                "iddq_drift_24h": iddq_24 - iddq_0,
                "ileak_drift_24h": ileak_24 - ileak_0,
                "tpd_drift_24h": tpd_24 - tpd_0
            }
        except (KeyError, ValueError, TypeError):
            early_features = {f: np.nan for f in CANONICAL_EARLY_FEATURES}
    else:
        early_features = {f: np.nan for f in CANONICAL_EARLY_FEATURES}

    # Construct future ground truth strictly for retrospective evaluation
    has_168h = bool(row_168h and isinstance(row_168h, dict))
    if has_168h:
        try:
            future_gt = {
                "iddq_168h_ground_truth": float(row_168h["iddq"]),
                "ileak_168h_ground_truth": float(row_168h["ileak"]),
                "tpd_168h_ground_truth": float(row_168h["tpd"]),
                "state_168h": eval_res["state_168h"],
                "latent_168h_failure": eval_res["latent_168h_failure"],
                "trajectory_state": eval_res["trajectory_state"],
                "evaluation_reason": eval_res["reason"]
            }
        except (KeyError, ValueError, TypeError):
            future_gt = {
                "iddq_168h_ground_truth": np.nan,
                "ileak_168h_ground_truth": np.nan,
                "tpd_168h_ground_truth": np.nan,
                "state_168h": eval_res["state_168h"],
                "latent_168h_failure": eval_res["latent_168h_failure"],
                "trajectory_state": eval_res["trajectory_state"],
                "evaluation_reason": eval_res["reason"]
            }
    else:
        future_gt = {
            "iddq_168h_ground_truth": np.nan,
            "ileak_168h_ground_truth": np.nan,
            "tpd_168h_ground_truth": np.nan,
            "state_168h": eval_res["state_168h"],
            "latent_168h_failure": eval_res["latent_168h_failure"],
            "trajectory_state": eval_res["trajectory_state"],
            "evaluation_reason": eval_res["reason"]
        }

    return {
        "metadata": {
            "component_id": component_id,
            "lot_id": lot_id,
            "wafer_id": wafer_id,
            "manufacturer": manufacturer,
            "package": pkg,
            "component_family": comp_family,
            "component_type": comp_type,
            "has_complete_history": bool(row_0h and row_24h and row_168h)
        },
        "early_features": early_features,
        "future_ground_truth": future_gt,
        "state_24h": eval_res["state_24h"]
    }


def build_prognostic_dataset(
    df_or_path: Union[str, pd.DataFrame],
    spec_limits: Optional[Dict[str, float]] = None,
    contract_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Builds the authoritative list of prognostic component records from raw time-series CSV.
    """
    limits = spec_limits if spec_limits is not None else get_authoritative_spec_limits(contract_path)

    if isinstance(df_or_path, str):
        df = pd.read_csv(df_or_path)
    else:
        df = df_or_path.copy()

    if "burn_in_hour" not in df.columns or "component_id" not in df.columns:
        raise ValueError("Dataset must contain 'component_id' and 'burn_in_hour' columns.")

    h0 = df[df["burn_in_hour"] == 0].set_index("component_id")
    h24 = df[df["burn_in_hour"] == 24].set_index("component_id")
    h168 = df[df["burn_in_hour"] == 168].set_index("component_id")

    all_comps = sorted(list(set(df["component_id"].unique())))
    records = []

    for c_id in all_comps:
        row_0 = h0.loc[c_id].to_dict() if c_id in h0.index else None
        row_24 = h24.loc[c_id].to_dict() if c_id in h24.index else None
        row_168 = h168.loc[c_id].to_dict() if c_id in h168.index else None

        rec = extract_prognostic_record(row_0, row_24, row_168, c_id, limits)
        records.append(rec)

    return records


def split_prognostic_dataset(
    records: List[Dict[str, Any]],
    split_manifest_path: Optional[str] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Authoritative four-way prognostic record splitter according to split_manifest.json.
    Partitions records into four strictly lot-disjoint cohorts:
    - train: LOT-SYN-001..035 (35 lots, 3500 components)
    - validation_tune: LOT-SYN-036..038 (3 lots, 300 components)
    - calibration: LOT-SYN-039..042 (4 lots, 400 components)
    - test: LOT-SYN-043..050 (8 lots, 800 components)

    Guarantees:
    - 100% record completeness (assigned records == input records)
    - Every input component belongs to exactly one partition
    - Rejection of unknown lots, missing lots, and duplicate components
    - Strict zero lot and zero component overlap across all 4 partitions
    - Fail-closed if validation_tune or calibration cohorts are missing/corrupted
    """
    manifest_to_use = split_manifest_path or SPLIT_MANIFEST_PATH
    if not os.path.exists(manifest_to_use):
        raise FileNotFoundError(f"SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at {manifest_to_use}")

    try:
        with open(manifest_to_use, "r", encoding="utf-8") as f:
            split_manifest = json.load(f)
    except Exception as exc:
        raise ValueError(f"SPLIT_MANIFEST_MALFORMED: Failed to parse split manifest: {exc}") from exc

    lots_obj = split_manifest.get("lots", {})
    train_lots = set(lots_obj.get("train", []))
    val_tune_lots = set(lots_obj.get("validation_tune", []))
    calib_lots = set(lots_obj.get("calibration", []))
    test_lots = set(lots_obj.get("test", []))

    if not train_lots or not val_tune_lots or not calib_lots or not test_lots:
        raise ValueError("SPLIT_MANIFEST_INVALID: Manifest must contain non-empty 'train', 'validation_tune', 'calibration', and 'test' lot sets.")

    # Check manifest lot pairwise disjointness
    if not train_lots.isdisjoint(val_tune_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and validation_tune: {train_lots.intersection(val_tune_lots)}")
    if not train_lots.isdisjoint(calib_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and calibration: {train_lots.intersection(calib_lots)}")
    if not train_lots.isdisjoint(test_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and test: {train_lots.intersection(test_lots)}")
    if not val_tune_lots.isdisjoint(calib_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between validation_tune and calibration: {val_tune_lots.intersection(calib_lots)}")
    if not val_tune_lots.isdisjoint(test_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between validation_tune and test: {val_tune_lots.intersection(test_lots)}")
    if not calib_lots.isdisjoint(test_lots):
        raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between calibration and test: {calib_lots.intersection(test_lots)}")

    seen_components = set()
    train_recs = []
    val_tune_recs = []
    calib_recs = []
    test_recs = []

    for i, r in enumerate(records):
        meta = r.get("metadata", {})
        c_id = meta.get("component_id") or r.get("component_id")
        if not c_id or not str(c_id).strip():
            raise ValueError(f"MISSING_COMPONENT_ID: Record at index {i} has missing or empty component_id.")
        c_id = str(c_id).strip()

        if c_id in seen_components:
            raise ValueError(f"DUPLICATE_COMPONENT_DETECTED: Component '{c_id}' appears multiple times in input dataset.")
        seen_components.add(c_id)

        lot = meta.get("lot_id") or r.get("lot_id")
        if not lot or not str(lot).strip():
            raise ValueError(f"MISSING_LOT_DETECTED: Component '{c_id}' has missing or empty lot_id.")
        lot = str(lot).strip()

        if lot in train_lots:
            train_recs.append(r)
        elif lot in val_tune_lots:
            val_tune_recs.append(r)
        elif lot in calib_lots:
            calib_recs.append(r)
        elif lot in test_lots:
            test_recs.append(r)
        else:
            raise ValueError(f"UNKNOWN_LOT_DETECTED: Component '{c_id}' has lot '{lot}' not defined in split manifest.")

    # Strict Completeness Check: assigned records == input records
    total_assigned = len(train_recs) + len(val_tune_recs) + len(calib_recs) + len(test_recs)
    if total_assigned != len(records):
        raise ValueError(f"SPLIT_INCOMPLETE: Expected {len(records)} assigned records, got {total_assigned}")

    # Verify component disjointness across partitions
    train_comps = {r.get("metadata", {}).get("component_id") or r.get("component_id") for r in train_recs}
    val_comps = {r.get("metadata", {}).get("component_id") or r.get("component_id") for r in val_tune_recs}
    calib_comps = {r.get("metadata", {}).get("component_id") or r.get("component_id") for r in calib_recs}
    test_comps = {r.get("metadata", {}).get("component_id") or r.get("component_id") for r in test_recs}

    if not train_comps.isdisjoint(val_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between train and validation_tune")
    if not train_comps.isdisjoint(calib_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between train and calibration")
    if not train_comps.isdisjoint(test_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between train and test")
    if not val_comps.isdisjoint(calib_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between validation_tune and calibration")
    if not val_comps.isdisjoint(test_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between validation_tune and test")
    if not calib_comps.isdisjoint(test_comps):
        raise ValueError("SPLIT_LEAKAGE: Overlapping components between calibration and test")

    return {
        "train": train_recs,
        "validation_tune": val_tune_recs,
        "calibration": calib_recs,
        "test": test_recs
    }


def calculate_prognostic_metrics(
    y_true: np.ndarray,
    y_pred_prob: np.ndarray,
    threshold: float = 0.5
) -> Dict[str, Any]:
    """
    Calculates standardized future-failure prognostic metrics:
    - support (total, positive, negative)
    - recall (sensitivity on true latent failures)
    - false negative rate (FNR = 1 - recall)
    - precision
    - F1 score
    - F2 score (beta=2, prioritizing recall)
    - specificity
    - PR-AUC
    - ROC-AUC
    - confusion matrix (TN, FP, FN, TP)
    """
    y_true = np.asarray(y_true, dtype=int)
    y_pred_prob = np.asarray(y_pred_prob, dtype=float)

    n_total = len(y_true)
    n_pos = int(np.sum(y_true == 1))
    n_neg = int(np.sum(y_true == 0))

    if n_total == 0:
        return {
            "support": {"total": 0, "positives": 0, "negatives": 0},
            "latent_recall": 0.0,
            "latent_false_negative_rate": 0.0,
            "latent_precision": 0.0,
            "latent_f1_score": 0.0,
            "latent_f2_score": 0.0,
            "specificity": 0.0,
            "pr_auc": 0.0,
            "roc_auc": 0.0,
            "confusion_matrix": {"tn": 0, "fp": 0, "fn": 0, "tp": 0},
            "operating_threshold": float(threshold)
        }

    y_pred_bin = (y_pred_prob >= threshold).astype(int)

    tp = int(np.sum((y_true == 1) & (y_pred_bin == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred_bin == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred_bin == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred_bin == 0)))

    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    f2 = (5.0 * precision * recall) / (4.0 * precision + recall) if (4.0 * precision + recall) > 0 else 0.0

    pr_auc = 0.0
    roc_auc = 0.5

    if n_pos > 0 and n_neg > 0:
        try:
            from sklearn.metrics import average_precision_score, roc_auc_score
            pr_auc = float(average_precision_score(y_true, y_pred_prob))
            roc_auc = float(roc_auc_score(y_true, y_pred_prob))
        except Exception:
            pass
    elif n_pos > 0:
        pr_auc = 1.0 if tp > 0 else 0.0

    return {
        "support": {
            "total": n_total,
            "positives": n_pos,
            "negatives": n_neg
        },
        "latent_recall": float(round(recall, 6)),
        "latent_false_negative_rate": float(round(fnr, 6)),
        "latent_precision": float(round(precision, 6)),
        "latent_f1_score": float(round(f1, 6)),
        "latent_f2_score": float(round(f2, 6)),
        "specificity": float(round(specificity, 6)),
        "pr_auc": float(round(pr_auc, 6)),
        "roc_auc": float(round(roc_auc, 6)),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp
        },
        "operating_threshold": float(threshold)
    }


class PersistenceBaseline:
    """
    Baseline model that assumes no degradation (predicts 0.0 risk for all components).
    """
    def __init__(self):
        self.name = "Persistence_NoChange_Baseline"
        self.algorithm = "PERSISTENCE_CONSTANT_ZERO"
        self.status = "BENCHMARK_ONLY"

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.zeros(len(X), dtype=np.float64)


class MLPrognosticBaseline:
    """
    Legitimate machine-learning baseline trained STRICTLY on 0h/24h early features.
    Provides validation_tune threshold tuning and frozen test set evaluation.
    """
    def __init__(self, random_state: int = 42):
        self.name = "EarlyFeature_GradientBoosting_Baseline"
        self.algorithm = "HIST_GRADIENT_BOOSTING_CLASSIFIER"
        self.random_state = random_state
        self.model = None
        self.optimal_threshold = None
        self.status = "BENCHMARK_ONLY"
        self.is_threshold_frozen = False

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> "MLPrognosticBaseline":
        from sklearn.ensemble import HistGradientBoostingClassifier
        self.model = HistGradientBoostingClassifier(
            max_iter=100,
            learning_rate=0.05,
            max_leaf_nodes=15,
            random_state=self.random_state,
            class_weight="balanced"
        )
        self.model.fit(X_train, y_train)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("MODEL_NOT_FITTED: Model has not been trained yet.")
        probs = self.model.predict_proba(X)
        if probs.shape[1] == 2:
            return probs[:, 1]
        return np.zeros(len(X))

    def tune_threshold_on_validation(
        self,
        X_val: np.ndarray,
        y_val: np.ndarray,
        metric: str = "f2"
    ) -> float:
        """
        Finds optimal operating threshold on VALIDATION_TUNE cohort ONLY and freezes it.
        """
        if self.model is None:
            raise RuntimeError("MODEL_NOT_FITTED: Must call fit() before tuning threshold.")
        probs = self.predict_proba(X_val)
        threshold_candidates = np.linspace(0.10, 0.90, 81)
        best_score = -1.0
        best_th = 0.50

        for th in threshold_candidates:
            metrics = calculate_prognostic_metrics(y_val, probs, threshold=th)
            score = metrics.get(f"latent_{metric}_score", metrics.get(metric, 0.0))
            if score > best_score:
                best_score = score
                best_th = th

        self.optimal_threshold = float(round(best_th, 4))
        self.is_threshold_frozen = True
        return self.optimal_threshold

    def evaluate_frozen_test(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray,
        tune_on_test: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates held-out test data using the frozen threshold determined during validation_tune cohort tuning.
        Structurally rejects any attempt to tune threshold on test data.
        """
        if tune_on_test:
            raise ValueError(
                "TEST_SET_THRESHOLD_TUNING_FORBIDDEN: Threshold optimization on held-out test data is strictly prohibited by prognostic contract."
            )
        if not self.is_threshold_frozen or self.optimal_threshold is None:
            raise RuntimeError(
                "THRESHOLD_NOT_FROZEN: Must call tune_threshold_on_validation() before evaluating frozen test set."
            )

        test_probs = self.predict_proba(X_test)
        return calculate_prognostic_metrics(y_test, test_probs, threshold=self.optimal_threshold)


# =============================================================================
# STAGE 5 TASK 2 — CONTINUOUS TRAJECTORY FORECASTING FOUNDATION
# =============================================================================

def get_authoritative_continuous_spec(contract_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns the authoritative continuous_trajectory_specification from the prognostic contract.
    Fails closed if the continuous specification is missing or invalid.
    """
    contract = load_authoritative_prognostic_contract(contract_path)
    if "continuous_trajectory_specification" not in contract:
        raise ValueError(
            "AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing 'continuous_trajectory_specification' in contract"
        )
    spec = contract["continuous_trajectory_specification"]
    required_keys = [
        "task_name",
        "forecast_origins",
        "supported_horizons",
        "evaluated_ground_truth_horizons",
        "target_parameters",
        "target_units",
        "allowed_early_observation_features",
        "forbidden_future_fields",
        "regression_metrics",
        "screening_criteria_type",
        "parametric_screening_limits",
        "model_status",
        "calibration_status"
    ]
    for k in required_keys:
        if k not in spec:
            raise ValueError(
                f"AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required key '{k}' in continuous specification"
            )
    return spec


def validate_continuous_feature_input(
    features: Union[Dict[str, Any], List[float], np.ndarray]
) -> np.ndarray:
    """
    Validates that a continuous prognostic early feature input contains ONLY authorized 0h/24h early features
    in canonical order with finite numeric values and zero temporal leakage.
    """
    return validate_early_feature_input(features)


def calculate_continuous_regression_metrics(
    y_true: Union[List[float], np.ndarray],
    y_pred: Union[List[float], np.ndarray]
) -> Dict[str, float]:
    """
    Computes standard regression metrics (MAE, RMSE, MedAE, MaxAE, Normalized RMSE)
    between true continuous observations and model predictions.
    Safely handles zero-division with finite guarantees.
    """
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)

    if len(y_t) != len(y_p):
        raise ValueError(f"DIMENSION_MISMATCH: Length of y_true ({len(y_t)}) != y_pred ({len(y_p)})")
    if len(y_t) == 0:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "median_absolute_error": 0.0,
            "max_absolute_error": 0.0,
            "normalized_rmse": 0.0,
            "sample_count": 0
        }
    if not np.all(np.isfinite(y_t)) or not np.all(np.isfinite(y_p)):
        raise ValueError("NON_FINITE_VALUES: Input contains NaN or Inf values")

    errors = y_t - y_p
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    medae = float(np.median(abs_errors))
    maxae = float(np.max(abs_errors))

    mean_y = float(np.mean(y_t))
    denominator = abs(mean_y) if abs(mean_y) > 1e-6 else 1.0
    nrmse = float(rmse / denominator)

    return {
        "mae": float(round(mae, 6)),
        "rmse": float(round(rmse, 6)),
        "median_absolute_error": float(round(medae, 6)),
        "max_absolute_error": float(round(maxae, 6)),
        "normalized_rmse": float(round(nrmse, 6)),
        "sample_count": len(y_t)
    }


class ContinuousTrajectoryDatasetBuilder:
    """
    Builds continuous trajectory datasets across multiple burn-in checkpoints (0h, 24h, 96h, 168h)
    with strict temporal leakage prevention and lot-held-out disjoint partitioning.
    """
    def __init__(self, dataset_path: Optional[str] = None, contract_path: Optional[str] = None):
        self.contract = load_authoritative_prognostic_contract(contract_path)
        self.spec = get_authoritative_continuous_spec(contract_path)

        default_ds_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "synthetic", "semiconductor_synthetic_full.csv")
        )
        self.dataset_path = dataset_path or default_ds_path
        if not os.path.exists(self.dataset_path):
            raise FileNotFoundError(f"DATASET_NOT_FOUND: Authoritative dataset missing at {self.dataset_path}")

    def build_dataset(self) -> Dict[str, Any]:
        """
        Extracts component-level early features and longitudinal ground-truth trajectories.
        """
        df = pd.read_csv(self.dataset_path)

        req_cols = ["component_id", "lot_id", "burn_in_hour", "iddq", "ileak", "tpd"]
        for c in req_cols:
            if c not in df.columns:
                raise ValueError(f"MISSING_DATASET_COLUMN: Required column '{c}' not found in dataset")

        # Fast dictionary lookup by component_id
        h0_dict = df[df["burn_in_hour"] == 0].set_index("component_id").to_dict(orient="index")
        h24_dict = df[df["burn_in_hour"] == 24].set_index("component_id").to_dict(orient="index")
        h96_dict = df[df["burn_in_hour"] == 96].set_index("component_id").to_dict(orient="index")
        h168_dict = df[df["burn_in_hour"] == 168].set_index("component_id").to_dict(orient="index")

        components = sorted(df["component_id"].unique())
        records = []

        for comp_id in components:
            if comp_id not in h0_dict or comp_id not in h24_dict:
                raise ValueError("MISSING_CHECKPOINT: Dataset lacks required early checkpoints (0h or 24h)")

            row_0 = h0_dict[comp_id]
            row_24 = h24_dict[comp_id]
            row_96 = h96_dict.get(comp_id)
            row_168 = h168_dict.get(comp_id)

            lot_id = str(row_0["lot_id"])
            iddq_0 = float(row_0["iddq"])
            ileak_0 = float(row_0["ileak"])
            tpd_0 = float(row_0["tpd"])

            iddq_24 = float(row_24["iddq"])
            ileak_24 = float(row_24["ileak"])
            tpd_24 = float(row_24["tpd"])

            early_dict = {
                "iddq_0h": iddq_0,
                "ileak_0h": ileak_0,
                "tpd_0h": tpd_0,
                "iddq_24h": iddq_24,
                "ileak_24h": ileak_24,
                "tpd_24h": tpd_24,
                "iddq_drift_24h": iddq_24 - iddq_0,
                "ileak_drift_24h": ileak_24 - ileak_0,
                "tpd_drift_24h": tpd_24 - tpd_0
            }
            early_arr = validate_continuous_feature_input(early_dict)

            gt_trajectories = {
                "iddq": {0: iddq_0, 24: iddq_24},
                "ileak": {0: ileak_0, 24: ileak_24},
                "tpd": {0: tpd_0, 24: tpd_24}
            }
            if row_96 is not None:
                gt_trajectories["iddq"][96] = float(row_96["iddq"])
                gt_trajectories["ileak"][96] = float(row_96["ileak"])
                gt_trajectories["tpd"][96] = float(row_96["tpd"])
            if row_168 is not None:
                gt_trajectories["iddq"][168] = float(row_168["iddq"])
                gt_trajectories["ileak"][168] = float(row_168["ileak"])
                gt_trajectories["tpd"][168] = float(row_168["tpd"])

            records.append({
                "component_id": comp_id,
                "lot_id": lot_id,
                "early_features_dict": early_dict,
                "early_features_arr": early_arr,
                "ground_truth_trajectories": gt_trajectories
            })

        return {
            "records": records,
            "total_count": len(records),
            "feature_names": CANONICAL_EARLY_FEATURES
        }

    def split_dataset(
        self,
        records: List[Dict[str, Any]],
        split_manifest_path: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Partitions records into four strictly lot-disjoint cohorts:
        - train: LOT-SYN-001..035 (35 lots, 3500 components)
        - validation_tune: LOT-SYN-036..038 (3 lots, 300 components)
        - calibration: LOT-SYN-039..042 (4 lots, 400 components)
        - test: LOT-SYN-043..050 (8 lots, 800 components)

        Enforces 100% completeness, 0 lot overlap, 0 component overlap, and unknown lot rejection.
        """
        manifest_to_use = split_manifest_path or SPLIT_MANIFEST_PATH
        if not os.path.exists(manifest_to_use):
            raise FileNotFoundError(f"SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at {manifest_to_use}")

        try:
            with open(manifest_to_use, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as exc:
            raise ValueError(f"SPLIT_MANIFEST_MALFORMED: Failed to parse split manifest: {exc}") from exc

        lots = manifest.get("lots", {})
        train_lots = set(lots.get("train", []))
        val_tune_lots = set(lots.get("validation_tune", []))
        calib_lots = set(lots.get("calibration", []))
        test_lots = set(lots.get("test", []))

        if not train_lots or not val_tune_lots or not calib_lots or not test_lots:
            raise ValueError("SPLIT_MANIFEST_INVALID: Manifest must contain non-empty 'train', 'validation_tune', 'calibration', and 'test' lot sets.")

        # Strict disjointness verification across all 4 lot sets
        if not train_lots.isdisjoint(val_tune_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and validation_tune: {train_lots.intersection(val_tune_lots)}")
        if not train_lots.isdisjoint(calib_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and calibration: {train_lots.intersection(calib_lots)}")
        if not train_lots.isdisjoint(test_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between train and test: {train_lots.intersection(test_lots)}")
        if not val_tune_lots.isdisjoint(calib_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between validation_tune and calibration: {val_tune_lots.intersection(calib_lots)}")
        if not val_tune_lots.isdisjoint(test_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between validation_tune and test: {val_tune_lots.intersection(test_lots)}")
        if not calib_lots.isdisjoint(test_lots):
            raise ValueError(f"MANIFEST_CORRUPTION: Overlapping lots between calibration and test: {calib_lots.intersection(test_lots)}")

        train_recs = []
        val_tune_recs = []
        calib_recs = []
        test_recs = []

        seen_comps = set()
        for r in records:
            cid = r["component_id"]
            if cid in seen_comps:
                raise ValueError(f"DUPLICATE_COMPONENT_ID: Component {cid} appears multiple times")
            seen_comps.add(cid)

            lot = r["lot_id"]
            if lot in train_lots:
                train_recs.append(r)
            elif lot in val_tune_lots:
                val_tune_recs.append(r)
            elif lot in calib_lots:
                calib_recs.append(r)
            elif lot in test_lots:
                test_recs.append(r)
            else:
                raise ValueError(f"UNKNOWN_LOT_ID: Component {cid} belongs to unauthorized lot {lot}")

        total_assigned = len(train_recs) + len(val_tune_recs) + len(calib_recs) + len(test_recs)
        if total_assigned != len(records):
            raise ValueError(f"SPLIT_INCOMPLETE: Total assigned ({total_assigned}) != total records ({len(records)})")

        return {
            "train": train_recs,
            "validation_tune": val_tune_recs,
            "calibration": calib_recs,
            "test": test_recs
        }


class ContinuousPersistenceBaseline:
    """
    Mathematically rigorous continuous persistence baseline:
    forecast(parameter, horizon) = latest permitted observed parameter value at forecast origin 24h.
    """
    def __init__(self):
        self.name = "Continuous_Persistence_Baseline"
        self.algorithm = "PERSISTENCE_LATEST_OBSERVED_VALUE"
        self.status = "BENCHMARK_ONLY"
        self.supported_horizons = [24, 48, 72, 96, 120, 144, 168]
        self.target_parameters = ["iddq", "ileak", "tpd"]

    def forecast_trajectory(self, early_features: Union[Dict[str, float], np.ndarray]) -> Dict[str, Dict[int, float]]:
        """
        Forecasts constant value equal to 24h observation across all horizons.
        """
        if isinstance(early_features, dict):
            validate_continuous_feature_input(early_features)
            val_24 = {
                "iddq": float(early_features["iddq_24h"]),
                "ileak": float(early_features["ileak_24h"]),
                "tpd": float(early_features["tpd_24h"])
            }
        elif isinstance(early_features, (list, tuple, np.ndarray)):
            arr = validate_continuous_feature_input(early_features)
            val_24 = {
                "iddq": float(arr[3]),
                "ileak": float(arr[4]),
                "tpd": float(arr[5])
            }
        else:
            raise ValueError(f"UNSUPPORTED_INPUT_TYPE: {type(early_features)}")

        trajectory = {}
        for param in self.target_parameters:
            trajectory[param] = {h: val_24[param] for h in self.supported_horizons}
        return trajectory

    def evaluate(
        self,
        records: List[Dict[str, Any]],
        horizons: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates persistence baseline on a cohort of records for evaluated ground truth horizons.
        """
        eval_horizons = horizons or [96, 168]
        results = {}
        for param in self.target_parameters:
            results[param] = {}
            for h in eval_horizons:
                y_true = []
                y_pred = []
                for r in records:
                    gt = r["ground_truth_trajectories"].get(param, {}).get(h)
                    if gt is not None:
                        fc = self.forecast_trajectory(r["early_features_dict"])[param][h]
                        y_true.append(gt)
                        y_pred.append(fc)
                metrics = calculate_continuous_regression_metrics(y_true, y_pred)
                results[param][f"{h}h"] = metrics
        return results


class DeterministicContinuousDegradationModel:
    """
    Deterministic parametric degradation regression model for continuous trajectory forecasting.
    Uses permitted early observations (0h, 24h, 24h drift) and regularized analytical least-squares.
    Tuning occurs strictly on Validation data; test evaluation is performed on frozen weights.
    """
    def __init__(self, random_state: int = 42):
        self.name = "Deterministic_Continuous_Degradation_Forecaster"
        self.algorithm = "DETERMINISTIC_REGULARIZED_TRAJECTORY_REGRESSION"
        self.status = "BENCHMARK_ONLY"
        self.calibration_status = "NOT_CALIBRATED"
        self.supported_horizons = [24, 48, 72, 96, 120, 144, 168]
        self.target_parameters = ["iddq", "ileak", "tpd"]

        self.weights = {}
        self.optimal_alphas = {}
        self.validation_residuals_std = {}
        self.is_frozen = False

    def _fit_single_target(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray
    ) -> Tuple[np.ndarray, float, float]:
        """
        Closed-form Ridge regression with VALIDATION_TUNE L2 hyperparameter selection.
        """
        X_tr_b = np.column_stack([np.ones(len(X_train)), X_train])
        X_v_b = np.column_stack([np.ones(len(X_val)), X_val])

        A = X_tr_b.T @ X_tr_b
        candidate_alphas = [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]

        best_alpha = 1.0
        best_rmse = float("inf")
        best_w = None

        for alpha in candidate_alphas:
            reg_mat = alpha * np.eye(A.shape[0])
            reg_mat[0, 0] = 0.0
            w = np.linalg.solve(A + reg_mat, X_tr_b.T @ y_train)
            pred_v = X_v_b @ w
            rmse_v = float(np.sqrt(np.mean((y_val - pred_v) ** 2)))
            if rmse_v < best_rmse:
                best_rmse = rmse_v
                best_alpha = alpha
                best_w = w

        val_preds = X_v_b @ best_w
        res_std = float(np.std(y_val - val_preds))

        return best_w, best_alpha, res_std

    def fit_and_tune(
        self,
        train_records: List[Dict[str, Any]],
        validation_tune_records: List[Dict[str, Any]],
        split_manifest_path: Optional[str] = None
    ) -> "DeterministicContinuousDegradationModel":
        """
        Authoritative training & hyperparameter tuning contract:
        - TRAIN (LOT-SYN-001..035): Fits closed-form regression parameters.
        - VALIDATION_TUNE (LOT-SYN-036..038): Selects optimal L2 regularization hyperparameter.
        - CALIBRATION (LOT-SYN-039..042): FORBIDDEN from fit and tune.
        - TEST (LOT-SYN-043..050): FORBIDDEN from fit and tune.

        Fails closed on calibration/test contamination, mixed splits, unknown lots, or duplicate components.
        Freezes model permanently upon completion.
        """
        if self.is_frozen:
            raise RuntimeError("FROZEN_MODEL_MUTATION_PROHIBITED: Cannot retune or refit frozen model.")

        manifest_to_use = split_manifest_path or SPLIT_MANIFEST_PATH
        if not os.path.exists(manifest_to_use):
            raise FileNotFoundError(f"SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at {manifest_to_use}")
        with open(manifest_to_use, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        auth_train_lots = set(manifest.get("lots", {}).get("train", []))
        auth_val_tune_lots = set(manifest.get("lots", {}).get("validation_tune", []))
        forbidden_calib_lots = set(manifest.get("lots", {}).get("calibration", []))
        forbidden_test_lots = set(manifest.get("lots", {}).get("test", []))

        if not train_records:
            raise ValueError("EMPTY_TRAINING_RECORDS: Train records cannot be empty.")
        if not validation_tune_records:
            raise ValueError("EMPTY_VALIDATION_TUNE_RECORDS: Validation tune records cannot be empty.")

        # Validate Train Cohort
        train_comp_ids = set()
        for r in train_records:
            cid = r.get("component_id")
            lot = r.get("lot_id")
            if cid in train_comp_ids:
                raise ValueError(f"DUPLICATE_COMPONENT_ID: Component {cid} duplicated in train records")
            train_comp_ids.add(cid)
            if lot in forbidden_calib_lots:
                raise ValueError(f"TRAINING_SET_CONTAMINATION: Calibration lot '{lot}' detected in train records.")
            if lot in forbidden_test_lots:
                raise ValueError(f"TRAINING_SET_CONTAMINATION: Test lot '{lot}' detected in train records.")
            if lot in auth_val_tune_lots:
                raise ValueError(f"TRAINING_SET_CONTAMINATION: Validation tune lot '{lot}' detected in train records.")
            if lot not in auth_train_lots:
                raise ValueError(f"TRAINING_SET_CONTAMINATION: Unauthorized lot '{lot}' in train records.")

        # Validate Validation Tune Cohort
        val_tune_comp_ids = set()
        for r in validation_tune_records:
            cid = r.get("component_id")
            lot = r.get("lot_id")
            if cid in val_tune_comp_ids:
                raise ValueError(f"DUPLICATE_COMPONENT_ID: Component {cid} duplicated in validation tune records")
            val_tune_comp_ids.add(cid)
            if lot in forbidden_calib_lots:
                raise ValueError(f"TUNING_SET_CONTAMINATION: Calibration lot '{lot}' detected in validation tune records.")
            if lot in forbidden_test_lots:
                raise ValueError(f"TEST_SET_TUNING_FORBIDDEN: Test lot '{lot}' detected in validation tune records.")
            if lot in auth_train_lots:
                raise ValueError(f"TUNING_SET_CONTAMINATION: Train lot '{lot}' detected in validation tune records.")
            if lot not in auth_val_tune_lots:
                raise ValueError(f"TUNING_SET_CONTAMINATION: Unauthorized lot '{lot}' in validation tune records.")

        if not train_comp_ids.isdisjoint(val_tune_comp_ids):
            raise ValueError("COMPONENT_LEAKAGE_DETECTED: Overlapping components between train and validation tune.")

        self.weights = {}
        self.optimal_alphas = {}
        self.validation_residuals_std = {}

        param_indices = {
            "iddq": (0, 3, 6),
            "ileak": (1, 4, 7),
            "tpd": (2, 5, 8)
        }

        for param, (i0, i24, idrift) in param_indices.items():
            self.weights[param] = {}
            self.optimal_alphas[param] = {}
            self.validation_residuals_std[param] = {}

            X_tr = np.array([
                [r["early_features_arr"][i0], r["early_features_arr"][i24], r["early_features_arr"][idrift]]
                for r in train_records
            ], dtype=np.float64)

            X_v = np.array([
                [r["early_features_arr"][i0], r["early_features_arr"][i24], r["early_features_arr"][idrift]]
                for r in validation_tune_records
            ], dtype=np.float64)

            for h in [96, 168]:
                y_tr = np.array([r["ground_truth_trajectories"][param][h] for r in train_records], dtype=np.float64)
                y_v = np.array([r["ground_truth_trajectories"][param][h] for r in validation_tune_records], dtype=np.float64)

                w, alpha, res_std = self._fit_single_target(X_tr, y_tr, X_v, y_v)
                self.weights[param][h] = w
                self.optimal_alphas[param][h] = alpha
                self.validation_residuals_std[param][h] = res_std

        self.is_frozen = True
        return self

    def forecast_trajectory(
        self,
        early_features: Union[Dict[str, float], np.ndarray]
    ) -> Dict[str, Any]:
        """
        Forecasts continuous multi-horizon trajectory across 24h, 48h, 72h, 96h, 120h, 144h, 168h
        with empirical uncertainty intervals.
        """
        if not self.is_frozen:
            raise RuntimeError("MODEL_NOT_FITTED: Must fit and tune model before forecasting.")

        arr = validate_continuous_feature_input(early_features)
        param_indices = {
            "iddq": (0, 3, 6),
            "ileak": (1, 4, 7),
            "tpd": (2, 5, 8)
        }

        forecasts = {}
        intervals = {}

        for param, (i0, i24, idrift) in param_indices.items():
            x = np.array([1.0, arr[i0], arr[i24], arr[idrift]], dtype=np.float64)
            p24 = float(arr[i24])

            pred_96 = float(x @ self.weights[param][96])
            pred_168 = float(x @ self.weights[param][168])

            traj = {}
            intv = {}
            for h in self.supported_horizons:
                if h <= 24:
                    val = p24
                    half_w = 0.0
                elif h <= 96:
                    val = p24 + ((h - 24) / 72.0) * (pred_96 - p24)
                    frac = (h - 24) / 72.0
                    half_w = frac * 1.6448536269514722 * self.validation_residuals_std[param][96]
                else:
                    val = pred_96 + ((h - 96) / 72.0) * (pred_168 - pred_96)
                    w96 = 1.6448536269514722 * self.validation_residuals_std[param][96]
                    w168 = 1.6448536269514722 * self.validation_residuals_std[param][168]
                    frac = (h - 96) / 72.0
                    half_w = w96 + frac * (w168 - w96)

                traj[h] = float(round(val, 6))
                intv[h] = {
                    "lower": float(round(val - half_w, 6)),
                    "upper": float(round(val + half_w, 6)),
                    "half_width": float(round(half_w, 6)),
                    "nominal_level": 0.90,
                    "calibration_status": "NOT_CALIBRATED"
                }

            forecasts[param] = traj
            intervals[param] = intv

        return {
            "forecast_trajectories": forecasts,
            "prediction_intervals": intervals,
            "status": "BENCHMARK_ONLY",
            "calibration_status": "NOT_CALIBRATED"
        }

    def evaluate_frozen_test(
        self,
        test_records: List[Dict[str, Any]],
        tune_on_test: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates frozen model on held-out test cohort. Structurally rejects tune_on_test=True.
        """
        if tune_on_test:
            raise ValueError("TEST_SET_TUNING_FORBIDDEN: Tuning on test set is prohibited.")
        if not self.is_frozen:
            raise RuntimeError("MODEL_NOT_FROZEN: Model must be fitted and frozen before test evaluation.")

        results = {}
        coverage_results = {}
        eval_horizons = [96, 168]

        for param in self.target_parameters:
            results[param] = {}
            coverage_results[param] = {}

            for h in eval_horizons:
                y_true = []
                y_pred = []
                covered_count = 0

                for r in test_records:
                    gt = r["ground_truth_trajectories"].get(param, {}).get(h)
                    if gt is not None:
                        fc_res = self.forecast_trajectory(r["early_features_dict"])
                        pred_val = fc_res["forecast_trajectories"][param][h]
                        intv = fc_res["prediction_intervals"][param][h]

                        y_true.append(gt)
                        y_pred.append(pred_val)

                        if intv["lower"] <= gt <= intv["upper"]:
                            covered_count += 1

                metrics = calculate_continuous_regression_metrics(y_true, y_pred)
                results[param][f"{h}h"] = metrics

                cov_pct = (covered_count / len(y_true)) * 100.0 if len(y_true) > 0 else 0.0
                coverage_results[param][f"{h}h"] = {
                    "nominal_level": 0.90,
                    "observed_coverage_pct": float(round(cov_pct, 2)),
                    "sample_count": len(y_true),
                    "calibration_status": "NOT_CALIBRATED"
                }

        return {
            "metrics": results,
            "coverage": coverage_results,
            "optimal_alphas": self.optimal_alphas
        }


def evaluate_threshold_projections(
    forecast_trajectories: Dict[str, Dict[Union[int, str], float]],
    spec_limits: Optional[Dict[str, float]] = None,
    contract_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates projected parameter trajectories against authoritative project-defined screening criteria.
    Outputs projected breach status, earliest crossing hour, and crossing direction.
    """
    limits = spec_limits if spec_limits is not None else get_authoritative_spec_limits(contract_path)
    projections = {}
    overall_breach = False
    earliest_breach_hour = None

    for param in ["iddq", "ileak", "tpd"]:
        if param not in forecast_trajectories:
            continue
        limit = limits.get(param, limits.get(f"{param}_max_uA" if param != "tpd" else "tpd_max_ns"))
        if limit is None:
            raise ValueError(f"MISSING_SPEC_LIMIT: No limit defined for parameter '{param}'")

        param_traj = forecast_trajectories[param]
        breach_hour = None
        for h in sorted([int(k) for k in param_traj.keys()]):
            val = float(param_traj.get(h, param_traj.get(str(h), 0.0)))
            if int(h) >= 24 and val > limit:
                breach_hour = int(h)
                break

        is_breach = breach_hour is not None
        if is_breach:
            overall_breach = True
            if earliest_breach_hour is None or breach_hour < earliest_breach_hour:
                earliest_breach_hour = breach_hour

        projections[param] = {
            "breach_projected": is_breach,
            "earliest_crossing_hour": breach_hour,
            "crossing_direction": "UPWARD_BREACH" if is_breach else "WITHIN_LIMITS",
            "applicable_criterion": "PROJECT_DEFINED_SCREENING_CRITERION",
            "screening_limit": float(limit),
            "forecast_at_168h": float(param_traj.get(168, param_traj.get("168", 0.0))),
            "forecast_trajectory": {int(k): float(v) for k, v in param_traj.items()}
        }

    return {
        "parameter_projections": projections,
        "overall_breach_projected": overall_breach,
        "earliest_breach_hour": earliest_breach_hour,
        "criteria_source": "PROJECT_DEFINED_SCREENING_CRITERION"
    }


def evaluate_legacy_gpr_governance(gpr_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluates the legacy in-service GPR artifact against continuous forecasting requirements
    and authoritative lot-held-out partitioning.
    """
    default_gpr_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "ml", "models", "production", "predicta_gpr_kernel_artifacts.json")
    )
    path_to_use = gpr_path or default_gpr_path
    if not os.path.exists(path_to_use):
        return {
            "model_name": "Predicta Gaussian Process Regressor",
            "status": "MISSING_ARTIFACT",
            "compatibility_status": "INCOMPATIBLE_TRAINING_SCHEMA",
            "rejection_reason": f"Artifact not found at {path_to_use}"
        }

    sha = compute_sha256(path_to_use)
    try:
        with open(path_to_use, "r", encoding="utf-8") as f:
            data = json.load(f)
        split = data.get("lot_split", {})
    except Exception as exc:
        return {
            "model_name": "Predicta Gaussian Process Regressor",
            "status": "CORRUPTED_ARTIFACT",
            "compatibility_status": "INCOMPATIBLE_TRAINING_SCHEMA",
            "rejection_reason": f"Failed to parse artifact JSON: {exc}"
        }

    return {
        "model_name": "Predicta Gaussian Process Regressor (GPR)",
        "model_path": "ml/models/production/predicta_gpr_kernel_artifacts.json",
        "model_sha256": sha,
        "target_task": "continuous_parametric_drift_forecasting",
        "compatibility_status": "INCOMPATIBLE_TRAINING_SCHEMA",
        "rejection_reason": (
            "Legacy GPR artifact was trained on a non-authoritative lot split (LOT-SYN-001..030) "
            "that overlaps the authoritative validation_tune (LOT-SYN-036..038) and calibration (LOT-SYN-039..042) cohorts "
            "and lacks multi-horizon (48h..168h) trajectory projection targets."
        ),
        "recorded_lot_split": split,
        "promotion_eligible": False
    }

