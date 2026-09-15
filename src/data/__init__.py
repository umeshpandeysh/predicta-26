"""
PREDICTA — Data Engineering, Lineage & Validation Module
"""

from .validator import (
    DataValidationError,
    compute_sha256,
    validate_dataset_hash,
    validate_dataset_schema,
    validate_missingness,
    validate_duplicate_records,
    validate_timestamp_ordering,
    validate_burnin_availability,
    validate_feature_target_separation,
    validate_temporal_leakage,
    validate_split_integrity,
    validate_authoritative_foundation,
)

__all__ = [
    "DataValidationError",
    "compute_sha256",
    "validate_dataset_hash",
    "validate_dataset_schema",
    "validate_missingness",
    "validate_duplicate_records",
    "validate_timestamp_ordering",
    "validate_burnin_availability",
    "validate_feature_target_separation",
    "validate_temporal_leakage",
    "validate_split_integrity",
    "validate_authoritative_foundation",
]
