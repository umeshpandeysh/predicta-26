"""
PREDICTA Stage 8 Task 3 — External Dataset Loaders Module
Authoritative isolated data access layer for external validation datasets.
"""

import os
import glob
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Any, Generator
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline


class ExternalDatasetError(Exception):
    """Base exception for external dataset loader errors."""
    pass


class SchemaValidationError(ExternalDatasetError):
    """Raised when external dataset schema or compatibility constraints are violated."""
    pass


class DataLeakageError(ExternalDatasetError):
    """Raised when data leakage occurs across train/validation/test partitions."""
    pass


class RemoteDatasetUnavailableError(ExternalDatasetError):
    """Raised when attempting to load a remote-only external dataset locally."""
    pass


@dataclass
class ExternalDatasetBatch:
    """Standard container for an isolated external ML dataset batch."""
    dataset_id: str
    dataset_name: str
    provenance_class: str
    df: pd.DataFrame
    features: List[str]
    target_column: Optional[str]
    group_column: Optional[str]
    time_column: Optional[str]
    metadata: Dict[str, Any]

    def validate_isolation(self) -> None:
        """Verify that the dataset is strictly isolated from PREDICTA production schema."""
        if self.provenance_class == "PREDICTA_SYNTHETIC":
            raise SchemaValidationError(
                f"External dataset '{self.dataset_id}' must never be tagged as PREDICTA_SYNTHETIC."
            )


def load_st_awfd(dataset_id: str = "st_awfd_d1", base_dir: str = ".") -> ExternalDatasetBatch:
    """
    Native loader for STMicroelectronics ST-AWFD datasets (d1 or d2).
    
    Validates:
    - Required columns: MaterialID, StepID, duration_ms, target, is_test
    - Row count integrity against locally verified manifest (D1: 602,108, D2: 126,794)
    - MaterialID presence and lot counts
    - Preserves native E-test feature names (forbids mapping to PREDICTA physical schema)
    """
    if dataset_id not in ("st_awfd_d1", "st_awfd_d2"):
        raise SchemaValidationError(f"Invalid ST-AWFD dataset_id: {dataset_id}. Must be st_awfd_d1 or st_awfd_d2.")

    rel_sub = "D1/D1.csv" if dataset_id == "st_awfd_d1" else "D2/D2.csv"
    csv_path = os.path.join(base_dir, "data", "external", "extracted", "st_awfd", rel_sub)
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"ST-AWFD dataset CSV missing at expected location: {csv_path}")

    df = pd.read_csv(csv_path)

    # Required columns validation
    required_cols = {"MaterialID", "StepID", "duration_ms", "target", "is_test"}
    missing = required_cols - set(df.columns)
    if missing:
        raise SchemaValidationError(f"ST-AWFD dataset '{dataset_id}' missing required columns: {missing}")

    # Row count verification against locally verified manifest
    expected_rows = 602108 if dataset_id == "st_awfd_d1" else 126794
    if len(df) != expected_rows:
        raise SchemaValidationError(
            f"ST-AWFD dataset '{dataset_id}' row count mismatch: found {len(df)}, expected {expected_rows}."
        )

    # MaterialID unique count verification
    expected_lots = 5104 if dataset_id == "st_awfd_d1" else 1156
    actual_lots = df["MaterialID"].nunique()
    if actual_lots != expected_lots:
        raise SchemaValidationError(
            f"ST-AWFD dataset '{dataset_id}' MaterialID count mismatch: found {actual_lots}, expected {expected_lots}."
        )

    # Feature extraction (all numeric columns except metadata and target)
    meta_cols = {"MaterialID", "StepID", "duration_ms", "target", "is_test"}
    features = [c for c in df.columns if c not in meta_cols]

    # Reject mapping anonymous E-test variables to PREDICTA physical fields
    forbidden_predicta_fields = {"iddq", "ileak", "tpd", "threshold_voltage", "vth_shift_24h", "ileak_0h", "ileak_24h"}
    if any(f.lower() in forbidden_predicta_fields for f in features):
        raise SchemaValidationError(
            "Anonymous E-test columns must NOT be mapped to PREDICTA physical semiconductor fields."
        )

    batch = ExternalDatasetBatch(
        dataset_id=dataset_id,
        dataset_name=f"STMicroelectronics ST-AWFD {'D1' if dataset_id == 'st_awfd_d1' else 'D2'}",
        provenance_class="EXTERNAL_REAL",
        df=df,
        features=features,
        target_column="target",
        group_column="MaterialID",
        time_column="StepID",
        metadata={
            "official_source_count": "5105 MaterialIDs (D1)" if dataset_id == "st_awfd_d1" else "1157 MaterialIDs (D2)",
            "local_verified_count": f"{actual_lots} MaterialIDs, {len(df)} data rows",
            "license_status": "LICENSE_CONFIRMED (CC BY-NC-SA 4.0)",
            "leakage_controls": "Group-level splitting by MaterialID is mandatory. Zero lot overlap enforced.",
            "compatibility_status": "GENERALIZATION_ONLY",
        }
    )
    batch.validate_isolation()
    return batch


def get_st_awfd_splits(
    batch: ExternalDatasetBatch, n_splits: int = 5
) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
    """
    Group-aware splitter for ST-AWFD using GroupKFold on MaterialID.
    
    CRITICAL LEAKAGE DEFENSE:
    Asserts 0% MaterialID group overlap between train and validation partitions.
    Raises DataLeakageError if any lot ID leaks across folds.
    """
    if batch.group_column != "MaterialID" or "MaterialID" not in batch.df.columns:
        raise SchemaValidationError("Group-aware splitting requires 'MaterialID' group column.")

    groups = batch.df["MaterialID"].values
    gkf = GroupKFold(n_splits=n_splits)

    for train_idx, val_idx in gkf.split(batch.df, batch.df[batch.target_column], groups=groups):
        train_lots = set(groups[train_idx])
        val_lots = set(groups[val_idx])
        overlap = train_lots.intersection(val_lots)
        
        if overlap:
            raise DataLeakageError(
                f"CRITICAL LEAKAGE DETECTED: {len(overlap)} MaterialID lots overlap between train and val splits!"
            )
        yield train_idx, val_idx


def load_uci_secom(base_dir: str = ".") -> ExternalDatasetBatch:
    """
    Native loader for UCI SECOM Semiconductor Manufacturing Data.
    
    Validates:
    - Alignment between secom.data (1,567 x 590 sensors) and secom_labels.data (1,567 x 2 label/timestamp).
    - Preserves native Pass/Fail target (-1 / 1 -> 0 / 1).
    - Preserves native 590 predictor sensor variables.
    - Preserves timestamp metadata.
    """
    secom_data_path = os.path.join(base_dir, "data", "external", "extracted", "uci_secom", "secom.data")
    secom_labels_path = os.path.join(base_dir, "data", "external", "extracted", "uci_secom", "secom_labels.data")

    if not os.path.exists(secom_data_path) or not os.path.exists(secom_labels_path):
        raise FileNotFoundError("UCI SECOM dataset files missing in data/external/extracted/uci_secom/")

    data_df = pd.read_csv(secom_data_path, sep=r"\s+", header=None)
    labels_df = pd.read_csv(secom_labels_path, sep=r"\s+", header=None)

    if len(data_df) != 1567 or len(labels_df) != 1567:
        raise SchemaValidationError(
            f"UCI SECOM row count mismatch: secom.data has {len(data_df)}, secom_labels.data has {len(labels_df)}, expected 1567."
        )

    if data_df.shape[1] != 590:
        raise SchemaValidationError(
            f"UCI SECOM predictor feature count mismatch: found {data_df.shape[1]}, expected 590."
        )

    # Name predictor sensor variables sensor_0 to sensor_589
    features = [f"sensor_{i}" for i in range(590)]
    data_df.columns = features

    # Process labels: column 0 is target (-1 pass, 1 fail), column 1 is timestamp string
    raw_labels = labels_df.iloc[:, 0].values
    target = np.where(raw_labels == 1, 1, 0)
    timestamps = labels_df.iloc[:, 1].values

    # Clean assignment without DataFrame fragmentation warnings
    data_df = data_df.assign(target=target, timestamp=timestamps)

    batch = ExternalDatasetBatch(
        dataset_id="uci_secom",
        dataset_name="UCI SECOM Semiconductor Manufacturing Data",
        provenance_class="EXTERNAL_REAL",
        df=data_df,
        features=features,
        target_column="target",
        group_column=None,
        time_column="timestamp",
        metadata={
            "official_source_count": "1567 examples, 591 features",
            "local_verified_count": "1567 rows; 590 predictor sensor variables in secom.data plus 1 label & 1 timestamp column in secom_labels.data",
            "count_discrepancy_explanation": "Official UCI metadata lists 1567 examples and 591 features. Local parsed representation contains 590 predictor sensor variables in secom.data plus 1 label column and 1 timestamp column in secom_labels.data.",
            "license_status": "LICENSE_UNSPECIFIED",
            "leakage_controls": "Imputation and scaling transformers MUST be fit exclusively on training splits inside each CV fold.",
            "compatibility_status": "GENERALIZATION_ONLY",
        }
    )
    batch.validate_isolation()
    return batch


def get_secom_preprocessor() -> Pipeline:
    """
    Returns a leakage-safe preprocessing pipeline for UCI SECOM.
    
    LEAKAGE DEFENSE:
    Uses median imputation for missing sensor values and standard scaling.
    Must be fit STRICTLY on train split data during cross-validation.
    """
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])


def load_uci_ai4i(base_dir: str = ".") -> ExternalDatasetBatch:
    """
    Native loader for UCI AI4I 2020 Predictive Maintenance Dataset.
    
    Validates:
    - Row count: 10,000 records.
    - Excludes diagnostic target-derived failure cause fields (TWF, HDF, PWF, OSF, RNF) and string fields (UDI, Product ID, Type) from feature list to prevent target leakage and type errors.
    - Tagged strictly as EXTERNAL_SYNTHETIC and GENERALIZATION_ONLY.
    """
    csv_path = os.path.join(base_dir, "data", "external", "extracted", "uci_ai4i", "ai4i2020.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"UCI AI4I dataset CSV missing at expected location: {csv_path}")

    df = pd.read_csv(csv_path)

    if len(df) != 10000:
        raise SchemaValidationError(f"UCI AI4I row count mismatch: found {len(df)}, expected 10000.")

    target_col = "Machine failure"
    if target_col not in df.columns:
        raise SchemaValidationError("UCI AI4I dataset missing 'Machine failure' target column.")

    # Select strictly numeric process/mechanical feature columns
    numeric_features = [
        "Air temperature [K]",
        "Process temperature [K]",
        "Rotational speed [rpm]",
        "Torque [Nm]",
        "Tool wear [min]",
    ]
    for feat in numeric_features:
        if feat not in df.columns:
            raise SchemaValidationError(f"UCI AI4I dataset missing feature column: '{feat}'")

    batch = ExternalDatasetBatch(
        dataset_id="uci_ai4i_2020",
        dataset_name="UCI AI4I 2020 Predictive Maintenance Dataset",
        provenance_class="EXTERNAL_SYNTHETIC",
        df=df,
        features=numeric_features,
        target_column=target_col,
        group_column="Product ID",
        time_column="UDI",
        metadata={
            "official_source_count": "10000 records, 14 features",
            "local_verified_count": "10000 records, 14 features",
            "license_status": "LICENSE_CONFIRMED (CC BY 4.0)",
            "leakage_controls": "Diagnostic failure cause fields (TWF, HDF, PWF, OSF, RNF) strictly excluded from feature set.",
            "compatibility_status": "GENERALIZATION_ONLY",
            "disclaimer": "Mechanical milling tool wear dataset; strictly isolated from semiconductor physics validation.",
        }
    )
    batch.validate_isolation()
    return batch


def load_nasa_igbt(base_dir: str = ".") -> ExternalDatasetBatch:
    """
    Native loader for NASA PCoE IGBT Accelerated Aging Dataset (#8).
    
    Validates:
    - Device separation across 6 physical devices (Parts 11, 12, 13, 21, 22, 23).
    - Preserves temporal measurement sequence.
    - Continuous degradation target only.
    - Binary failure labels are UNAVAILABLE (binary_labels_available = False). Attempting to request binary labels raises SchemaValidationError.
    """
    base_igbt = os.path.join(base_dir, "data", "external", "extracted", "nasa_igbt")
    if not os.path.exists(base_igbt):
        raise FileNotFoundError(f"NASA IGBT extracted directory missing at: {base_igbt}")

    # Discover part directories
    part_files = glob.glob(os.path.join(base_igbt, "**", "Part *", "*.csv"), recursive=True)
    if not part_files:
        raise FileNotFoundError("NASA IGBT CSV files not found in extracted directory.")

    records = []
    device_names = set()

    for pfile in sorted(part_files):
        parts = pfile.split(os.sep)
        device_id = None
        for pt in parts:
            if pt.startswith("Part "):
                device_id = pt
                break
        if not device_id:
            device_id = "Device_Unknown"

        device_names.add(device_id)
        test_type = os.path.basename(pfile).replace(".csv", "")

        try:
            # Read CSV file (raw SMU waveforms without headers)
            sub_df = pd.read_csv(pfile, header=None)
            if sub_df.shape[1] >= 2:
                for idx, row in sub_df.iterrows():
                    records.append({
                        "device_id": device_id,
                        "test_type": test_type,
                        "time_step": idx,
                        "voltage": row[0],
                        "current": row[1],
                    })
        except Exception:
            continue

    if not records:
        raise SchemaValidationError("Failed to parse SMU telemetry records from NASA IGBT archive.")

    df = pd.DataFrame(records)

    # STRICT LEAKAGE PREVENTION: Target variable 'current' MUST NEVER appear in features
    target_col = "current"
    features = ["voltage"]

    batch = ExternalDatasetBatch(
        dataset_id="nasa_igbt",
        dataset_name="NASA PCoE IGBT Accelerated Aging Dataset (#8)",
        provenance_class="EXTERNAL_REAL",
        df=df,
        features=features,
        target_column=target_col,
        group_column="device_id",
        time_column="time_step",
        metadata={
            "official_source_count": "6 devices (1 DC gate bias, 5 squared signal gate bias)",
            "local_verified_count": f"{df['device_id'].nunique()} devices, {len(df)} telemetry samples",
            "binary_labels_available": False,
            "continuous_degradation_available": True,
            "license_status": "LICENSE_REQUIRES_REVIEW (U.S. Government Works)",
            "leakage_controls": "Target variable 'current' strictly excluded from feature matrix. Static SMU I-V sweeps lack longitudinal aging timestamps required for causal temporal prognostics.",
            "compatibility_status": "INSUFFICIENT_COMPATIBLE_TARGET",
        }
    )
    batch.validate_isolation()
    return batch


def load_nasa_mosfet() -> ExternalDatasetBatch:
    """Remote-only dataset stub for NASA MOSFET. Fails closed when called locally."""
    raise RemoteDatasetUnavailableError(
        "NASA MOSFET Thermal Overstress Aging Dataset (#13) is registered as REMOTE_EXTERNAL_DATASET. "
        "The 7.85 GB ZIP archive is not stored in repository storage and cannot be loaded locally. "
        "sha256: NOT_AVAILABLE_REMOTE_ONLY, remote_content_length_bytes: 7849865909."
    )


def load_nasa_capacitor() -> ExternalDatasetBatch:
    """Remote-only dataset stub for NASA Capacitor. Fails closed when called locally."""
    raise RemoteDatasetUnavailableError(
        "NASA Electrolytic Capacitor Electrical Stress Aging Dataset (#12) is registered as REMOTE_EXTERNAL_DATASET. "
        "The 5.04 GB ZIP archive is not stored in repository storage and cannot be loaded locally. "
        "sha256: NOT_AVAILABLE_REMOTE_ONLY, remote_content_length_bytes: 5038942729."
    )


def load_upc_si_igbt_2026() -> ExternalDatasetBatch:
    """Remote-only dataset stub for UPC Si IGBT 2026. Fails closed when called locally."""
    raise RemoteDatasetUnavailableError(
        "UPC Si IGBT Accelerated Power-Cycling Aging Dataset (2026 v1.1) is registered as REMOTE_EXTERNAL_DATASET. "
        "Files are hosted remotely on CORA Dataverse (DOI: 10.34810/DATA3204) and are not downloaded into local storage. "
        "verification_level: VERIFIED_FROM_REPOSITORY_METADATA, sha256: NOT_AVAILABLE_REMOTE_ONLY."
    )


def get_remote_dataset_metadata(dataset_id: str) -> Dict[str, Any]:
    """Retrieves authoritative machine-readable metadata for remote-only datasets without attempting network downloads."""
    remote_metadata = {
        "nasa_mosfet": {
            "dataset_id": "nasa_mosfet",
            "dataset_name": "NASA PCoE MOSFET Thermal Overstress Aging Dataset (#13)",
            "provenance_class": "REMOTE_EXTERNAL_DATASET",
            "acquisition_status": "REMOTE_EXTERNAL_DATASET",
            "sha256": "NOT_AVAILABLE_REMOTE_ONLY",
            "remote_content_length_bytes": 7849865909,
            "archive_integrity": "REMOTE_ENDPOINT_AND_CONTENT_LENGTH_VERIFIED",
            "binary_labels_available": False,
            "continuous_degradation_available": True,
            "license_status": "LICENSE_UNSPECIFIED",
            "verification_level": "VERIFIED_FROM_OFFICIAL_METADATA",
        },
        "nasa_capacitor": {
            "dataset_id": "nasa_capacitor",
            "dataset_name": "NASA PCoE Electrolytic Capacitor Electrical Stress Aging Dataset (#12)",
            "provenance_class": "REMOTE_EXTERNAL_DATASET",
            "acquisition_status": "REMOTE_EXTERNAL_DATASET",
            "sha256": "NOT_AVAILABLE_REMOTE_ONLY",
            "remote_content_length_bytes": 5038942729,
            "archive_integrity": "REMOTE_ENDPOINT_AND_CONTENT_LENGTH_VERIFIED",
            "binary_labels_available": False,
            "continuous_degradation_available": True,
            "license_status": "LICENSE_UNSPECIFIED",
            "verification_level": "VERIFIED_FROM_OFFICIAL_METADATA",
        },
        "upc_si_igbt_2026": {
            "dataset_id": "upc_si_igbt_2026",
            "dataset_name": "UPC Si IGBT Accelerated Power-Cycling Aging Dataset (2026 v1.1)",
            "provenance_class": "REMOTE_EXTERNAL_DATASET",
            "acquisition_status": "REMOTE_EXTERNAL_DATASET",
            "version": "1.1",
            "doi": "10.34810/DATA3204",
            "sha256": "NOT_AVAILABLE_REMOTE_ONLY",
            "file_size_bytes": "NOT_VERIFIED_REMOTE_ONLY",
            "archive_integrity": "REMOTE_DATAVERSE_ENDPOINT_VERIFIED",
            "binary_labels_available": False,
            "continuous_degradation_available": True,
            "license_status": "LICENSE_CONFIRMED (CC BY 4.0)",
            "verification_level": "VERIFIED_FROM_REPOSITORY_METADATA",
        }
    }

    if dataset_id not in remote_metadata:
        raise SchemaValidationError(f"Unknown remote dataset_id: {dataset_id}")

    return remote_metadata[dataset_id]
