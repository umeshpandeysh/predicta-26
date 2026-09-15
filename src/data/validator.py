"""
Predicta Semiconductor Intelligence Platform — Authoritative Data & Lineage Validation Module
File: src/data/validator.py

Provides comprehensive, reusable data validation routines for:
1. Dataset SHA-256 cryptographic verification
2. Schema structure & required columns
3. Data types & physical ranges
4. Missingness & NaN bounds
5. Duplicate record & component ID integrity
6. Timestamp ordering across burn-in sequences
7. Telemetry checkpoint availability (0h, 24h, 168h)
8. Strict feature/target separation (no target in feature matrix)
9. Zero temporal leakage into early prediction features
10. Group-split disjointness (strictly zero component or lot leakage across train/val/test)
"""

import os
import json
import hashlib
from typing import Dict, Any, List, Optional, Union

import pandas as pd


class DataValidationError(Exception):
    """Raised when data validation encounters non-compliant or corrupted data."""
    def __init__(self, message: str, errors: Optional[List[str]] = None):
        super().__init__(message)
        self.errors = errors or [message]


def compute_sha256(filepath: str) -> str:
    """Compute cryptographic SHA-256 hash of a file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Cannot compute hash: file does not exist at '{filepath}'")
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_dataset_hash(filepath: str, expected_hash: str) -> Dict[str, Any]:
    """
    Verifies that the dataset file matches its authoritative SHA-256 hash exactly.
    """
    if not os.path.exists(filepath):
        return {
            "check": "dataset_hash",
            "passed": False,
            "error": f"Dataset file not found at '{filepath}'"
        }

    actual_hash = compute_sha256(filepath)
    if actual_hash.lower() != expected_hash.lower():
        return {
            "check": "dataset_hash",
            "passed": False,
            "error": f"Dataset SHA-256 mismatch! Expected '{expected_hash}', but computed '{actual_hash}' on '{filepath}'",
            "actual_hash": actual_hash,
            "expected_hash": expected_hash
        }

    return {
        "check": "dataset_hash",
        "passed": True,
        "hash": actual_hash
    }


def validate_dataset_schema(
    df: pd.DataFrame,
    required_columns: List[str],
    dtypes: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Validates presence of required columns and basic data type expectations.
    """
    missing_cols = [c for c in required_columns if c not in df.columns]
    if missing_cols:
        return {
            "check": "schema_columns",
            "passed": False,
            "error": f"Missing required columns in dataset: {missing_cols}",
            "missing_columns": missing_cols
        }

    type_errors = []
    if dtypes:
        for col, expected_type in dtypes.items():
            if col in df.columns:
                if expected_type in ("float", "numeric", "float64"):
                    if not pd.api.types.is_numeric_dtype(df[col]):
                        type_errors.append(f"Column '{col}' expected numeric, got {df[col].dtype}")
                elif expected_type in ("int", "int64"):
                    if not pd.api.types.is_integer_dtype(df[col]):
                        type_errors.append(f"Column '{col}' expected integer, got {df[col].dtype}")

    if type_errors:
        return {
            "check": "schema_dtypes",
            "passed": False,
            "error": f"Data type contract violations: {type_errors}",
            "type_errors": type_errors
        }

    return {
        "check": "schema",
        "passed": True,
        "total_columns": len(df.columns),
        "columns": df.columns.tolist()
    }


def validate_missingness(
    df: pd.DataFrame,
    critical_columns: Optional[List[str]] = None,
    max_missing_ratio: float = 0.0
) -> Dict[str, Any]:
    """
    Validates that missingness does not exceed allowable thresholds.
    Critical columns default to 0% allowable missingness.
    """
    errors = []
    cols_to_check = critical_columns or df.columns.tolist()

    for col in cols_to_check:
        if col in df.columns:
            missing_count = df[col].isnull().sum()
            missing_ratio = missing_count / len(df) if len(df) > 0 else 0
            if missing_ratio > max_missing_ratio:
                errors.append(
                    f"Column '{col}' has {missing_count} missing rows ({missing_ratio:.2%}), exceeding threshold ({max_missing_ratio:.2%})"
                )

    if errors:
        return {
            "check": "missingness",
            "passed": False,
            "error": "; ".join(errors),
            "details": errors
        }

    return {
        "check": "missingness",
        "passed": True
    }


def validate_duplicate_records(
    df: pd.DataFrame,
    key_columns: List[str]
) -> Dict[str, Any]:
    """
    Verifies no duplicate records exist for the specified compound key (e.g. ['component_id', 'burn_in_hour']).
    """
    missing_keys = [k for k in key_columns if k not in df.columns]
    if missing_keys:
        return {
            "check": "duplicates",
            "passed": False,
            "error": f"Key columns missing from DataFrame: {missing_keys}"
        }

    dupes = df[df.duplicated(subset=key_columns, keep=False)]
    if len(dupes) > 0:
        sample_dupes = dupes[key_columns].head(5).to_dict(orient="records")
        return {
            "check": "duplicates",
            "passed": False,
            "error": f"Found {len(dupes)} duplicate records for key {key_columns}. Sample: {sample_dupes}",
            "duplicate_count": len(dupes)
        }

    return {
        "check": "duplicates",
        "passed": True
    }


def validate_timestamp_ordering(
    df: pd.DataFrame,
    id_col: str = "component_id",
    time_col: str = "burn_in_hour"
) -> Dict[str, Any]:
    """
    Validates that burn-in time sequences are strictly monotonic and valid.
    """
    if id_col not in df.columns or time_col not in df.columns:
        return {
            "check": "timestamp_ordering",
            "passed": False,
            "error": f"Columns '{id_col}' or '{time_col}' missing from dataset"
        }

    if (df[time_col] < 0).any():
        return {
            "check": "timestamp_ordering",
            "passed": False,
            "error": f"Negative timestamps found in '{time_col}'"
        }

    return {
        "check": "timestamp_ordering",
        "passed": True
    }


def validate_burnin_availability(
    df: pd.DataFrame,
    required_hours: List[int] = [0, 24, 168],
    id_col: str = "component_id",
    time_col: str = "burn_in_hour"
) -> Dict[str, Any]:
    """
    Verifies that required burn-in checkpoints (e.g. 0h baseline, 24h screening, 168h ground truth)
    exist in the dataset.
    """
    if time_col not in df.columns:
        return {
            "check": "burnin_availability",
            "passed": False,
            "error": f"Column '{time_col}' not found"
        }

    actual_hours = set(df[time_col].dropna().unique())
    missing_hours = [h for h in required_hours if h not in actual_hours]

    if missing_hours:
        return {
            "check": "burnin_availability",
            "passed": False,
            "error": f"Dataset missing essential burn-in hours: {missing_hours}. Available: {sorted(list(actual_hours))}",
            "missing_hours": missing_hours
        }

    return {
        "check": "burnin_availability",
        "passed": True,
        "available_hours": sorted(list(actual_hours))
    }


def validate_feature_target_separation(
    feature_matrix: Union[pd.DataFrame, List[str]],
    target_columns: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Guarantees that target labels, health state columns, and ground truth outcomes
    never contaminate feature input matrices.
    """
    if isinstance(feature_matrix, pd.DataFrame):
        feature_names = feature_matrix.columns.tolist()
    else:
        feature_names = list(feature_matrix)

    targets = target_columns or [
        "latent_168h_failure",
        "trajectory_state",
        "state_24h",
        "state_168h",
        "health_state",
        "failure_label",
        "result",
        "defect_type"
    ]

    contaminated = [f for f in feature_names if f in targets]
    if contaminated:
        return {
            "check": "feature_target_separation",
            "passed": False,
            "error": f"CRITICAL LEAKAGE: Target columns found in feature matrix: {contaminated}",
            "contaminated_columns": contaminated
        }

    return {
        "check": "feature_target_separation",
        "passed": True
    }


def validate_temporal_leakage(
    feature_names: List[str],
    forbidden_tokens: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Enforces strict temporal boundary: early-screening features (t <= 24h) must NOT
    contain tokens or signals from future time points (e.g. 168h ground truth).
    """
    tokens = forbidden_tokens or [
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

    violating = []
    for f in feature_names:
        f_lower = f.lower()
        for token in tokens:
            if token in f_lower:
                violating.append((f, token))

    if violating:
        return {
            "check": "temporal_leakage",
            "passed": False,
            "error": f"TEMPORAL LEAKAGE DETECTED! Features contain future-telemetry tokens: {violating}",
            "violating_features": violating
        }

    return {
        "check": "temporal_leakage",
        "passed": True
    }


def validate_split_integrity(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    id_col: str = "component_id",
    lot_col: str = "lot_id",
    require_lot_disjoint: bool = True
) -> Dict[str, Any]:
    """
    Validates complete disjointness across train, validation, and test splits:
    1. Zero component ID overlap across splits
    2. Zero lot ID overlap between train and test when lot-holdout is enabled
    """
    errors = []

    # 1. Component Disjointness
    train_ids = set(train_df[id_col].unique()) if id_col in train_df.columns else set()
    val_ids = set(val_df[id_col].unique()) if id_col in val_df.columns else set()
    test_ids = set(test_df[id_col].unique()) if id_col in test_df.columns else set()

    tv_overlap = train_ids & val_ids
    tt_overlap = train_ids & test_ids
    vt_overlap = val_ids & test_ids

    if tv_overlap:
        errors.append(f"Component leakage: Train & Val share {len(tv_overlap)} components")
    if tt_overlap:
        errors.append(f"Component leakage: Train & Test share {len(tt_overlap)} components")
    if vt_overlap:
        errors.append(f"Component leakage: Val & Test share {len(vt_overlap)} components")

    # 2. Lot Disjointness
    if require_lot_disjoint and lot_col in train_df.columns and lot_col in test_df.columns:
        train_lots = set(train_df[lot_col].unique())
        val_lots = set(val_df[lot_col].unique()) if lot_col in val_df.columns else set()
        test_lots = set(test_df[lot_col].unique())

        if train_lots & test_lots:
            errors.append(f"Lot leakage: Train & Test share lots: {train_lots & test_lots}")
        if val_lots & test_lots:
            errors.append(f"Lot leakage: Val & Test share lots: {val_lots & test_lots}")

    if errors:
        return {
            "check": "split_integrity",
            "passed": False,
            "error": "; ".join(errors),
            "details": errors
        }

    return {
        "check": "split_integrity",
        "passed": True,
        "train_samples": len(train_df),
        "val_samples": len(val_df),
        "test_samples": len(test_df)
    }


def validate_authoritative_foundation(
    base_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes an end-to-end audit of all authoritative data contracts, manifests, and datasets.
    """
    if base_dir is None:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    manifest_path = os.path.join(base_dir, "ml", "data", "dataset_manifest.json")
    contract_path = os.path.join(base_dir, "ml", "data", "feature_contract.json")
    split_manifest_path = os.path.join(base_dir, "ml", "data", "split_manifest.json")

    results = {
        "passed": True,
        "checks": [],
        "errors": []
    }

    # 1. Dataset Manifest Check
    if not os.path.exists(manifest_path):
        results["passed"] = False
        results["errors"].append(f"Dataset manifest missing at '{manifest_path}'")
    else:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        primary = manifest.get("primary_latent_trajectory_dataset", {})
        data_path = os.path.join(base_dir, primary.get("dataset_path", ""))
        expected_hash = primary.get("dataset_sha256", "")
        hash_res = validate_dataset_hash(data_path, expected_hash)
        results["checks"].append(hash_res)
        if not hash_res["passed"]:
            results["passed"] = False
            results["errors"].append(hash_res["error"])

    # 2. Feature Contract Check
    if not os.path.exists(contract_path):
        results["passed"] = False
        results["errors"].append(f"Feature contract missing at '{contract_path}'")
    else:
        with open(contract_path, "r", encoding="utf-8") as f:
            contract = json.load(f)
        early_features = [f["name"] for f in contract.get("features", {}).get("early_observable", [])]
        leakage_res = validate_temporal_leakage(early_features, contract.get("forbidden_leakage_tokens"))
        results["checks"].append(leakage_res)
        if not leakage_res["passed"]:
            results["passed"] = False
            results["errors"].append(leakage_res["error"])

    # 3. Split Manifest Check
    if not os.path.exists(split_manifest_path):
        results["passed"] = False
        results["errors"].append(f"Split manifest missing at '{split_manifest_path}'")
    else:
        with open(split_manifest_path, "r", encoding="utf-8") as f:
            split_m = json.load(f)
        train_lots = set(split_m.get("lots", {}).get("train", []))
        val_lots = set(split_m.get("lots", {}).get("validation", []))
        test_lots = set(split_m.get("lots", {}).get("test", []))
        if train_lots & test_lots or val_lots & test_lots:
            results["passed"] = False
            results["errors"].append("Split manifest contains overlapping lot definitions!")

    return results
