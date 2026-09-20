"""
PREDICTA Stage 8 Task 3 — External Dataset Loaders Package
Authoritative isolated data access layer for external validation datasets.
"""

from ml.data.external.loaders import (
    ExternalDatasetBatch,
    ExternalDatasetError,
    SchemaValidationError,
    DataLeakageError,
    RemoteDatasetUnavailableError,
    load_st_awfd,
    get_st_awfd_splits,
    load_uci_secom,
    get_secom_preprocessor,
    load_uci_ai4i,
    load_nasa_igbt,
    load_nasa_mosfet,
    load_nasa_capacitor,
    load_upc_si_igbt_2026,
    get_remote_dataset_metadata,
)

__all__ = [
    "ExternalDatasetBatch",
    "ExternalDatasetError",
    "SchemaValidationError",
    "DataLeakageError",
    "RemoteDatasetUnavailableError",
    "load_st_awfd",
    "get_st_awfd_splits",
    "load_uci_secom",
    "get_secom_preprocessor",
    "load_uci_ai4i",
    "load_nasa_igbt",
    "load_nasa_mosfet",
    "load_nasa_capacitor",
    "load_upc_si_igbt_2026",
    "get_remote_dataset_metadata",
]
