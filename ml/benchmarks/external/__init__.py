"""
PREDICTA Stage 8 Task 3 — External Benchmarks Package
Authoritative isolated ML benchmarking layer for external validation datasets.
"""

from ml.benchmarks.external.compatibility import (
    CompatibilityStatus,
    ExternalDatasetContract,
    EXTERNAL_DATASET_CONTRACTS,
    get_compatibility_contract,
    validate_production_isolation,
)
from ml.benchmarks.external.runner import ExternalBenchmarkRunner

__all__ = [
    "CompatibilityStatus",
    "ExternalDatasetContract",
    "EXTERNAL_DATASET_CONTRACTS",
    "get_compatibility_contract",
    "validate_production_isolation",
    "ExternalBenchmarkRunner",
]
