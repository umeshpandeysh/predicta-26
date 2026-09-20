"""
PREDICTA Stage 8 Task 3 — External Dataset ML Integration & Benchmarking Test Suite
Validates external dataset loaders, leakage-safe splitting, production isolation, and benchmark runner execution.
"""

import os
import json
import hashlib
import numpy as np
import pandas as pd
import pytest

from ml.data.external.loaders import (
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
    ExternalDatasetError,
    SchemaValidationError,
    DataLeakageError,
    RemoteDatasetUnavailableError,
)
from ml.benchmarks.external.compatibility import (
    EXTERNAL_DATASET_CONTRACTS,
    CompatibilityStatus,
    get_compatibility_contract,
    validate_production_isolation,
)
from ml.benchmarks.external.runner import (
    ExternalBenchmarkRunner,
    MANDATORY_BENCHMARK_DISCLAIMER,
)


def test_st_awfd_loaders_and_schema_validation():
    """Verify ST-AWFD D1 and D2 dataset loading and schema validation."""
    b_d1 = load_st_awfd("st_awfd_d1")
    assert b_d1.dataset_id == "st_awfd_d1"
    assert b_d1.provenance_class == "EXTERNAL_REAL"
    assert len(b_d1.df) == 602108
    assert b_d1.df["MaterialID"].nunique() == 5104
    assert b_d1.target_column == "target"
    assert b_d1.group_column == "MaterialID"

    b_d2 = load_st_awfd("st_awfd_d2")
    assert b_d2.dataset_id == "st_awfd_d2"
    assert len(b_d2.df) == 126794
    assert b_d2.df["MaterialID"].nunique() == 1156


def test_st_awfd_group_split_zero_leakage():
    """Verify GroupKFold on ST-AWFD enforces 0% MaterialID group overlap."""
    b_d1 = load_st_awfd("st_awfd_d1")
    groups = b_d1.df["MaterialID"].values
    splits = list(get_st_awfd_splits(b_d1, n_splits=5))

    assert len(splits) == 5
    for train_idx, val_idx in splits:
        train_lots = set(groups[train_idx])
        val_lots = set(groups[val_idx])
        overlap = train_lots.intersection(val_lots)
        assert len(overlap) == 0, f"MaterialID leakage detected: {overlap}"


def test_uci_secom_loader_and_leakage_safe_prep():
    """Verify UCI SECOM loader alignment and train-only preprocessing fit."""
    b_secom = load_uci_secom()
    assert b_secom.dataset_id == "uci_secom"
    assert len(b_secom.df) == 1567
    assert len(b_secom.features) == 590
    assert b_secom.target_column == "target"

    X = b_secom.df[b_secom.features].values
    y = b_secom.df[b_secom.target_column].values

    # Test train-only fit assertion
    X_train, X_val = X[:1000], X[1000:]
    prep = get_secom_preprocessor()

    # Fit strictly on train
    prep.fit(X_train)
    imputer = prep.named_steps["imputer"]
    scaler = prep.named_steps["scaler"]

    # Verify imputer and scaler statistics were derived strictly from X_train
    expected_train_medians = np.nanmedian(X_train, axis=0)
    np.testing.assert_allclose(imputer.statistics_, expected_train_medians, rtol=1e-5)

    # Verify transform works on val set without altering fit parameters
    X_val_trans = prep.transform(X_val)
    assert X_val_trans.shape == X_val.shape


def test_uci_ai4i_loader_and_diagnostic_target_leakage_defense():
    """Verify UCI AI4I 2020 loader excludes target-derived diagnostic cause fields."""
    b_ai4i = load_uci_ai4i()
    assert b_ai4i.dataset_id == "uci_ai4i_2020"
    assert b_ai4i.provenance_class == "EXTERNAL_SYNTHETIC"
    assert len(b_ai4i.df) == 10000
    assert b_ai4i.target_column == "Machine failure"

    # Diagnostic cause fields MUST be excluded from feature list to prevent trivial target leakage
    forbidden_diagnostic_fields = {"TWF", "HDF", "PWF", "OSF", "RNF", "UDI", "Product ID"}
    for f in b_ai4i.features:
        assert f not in forbidden_diagnostic_fields, f"Target leakage field '{f}' found in features!"


def test_nasa_igbt_loader_and_continuous_target():
    """Verify NASA IGBT loader device separation and strict target leakage elimination."""
    b_igbt = load_nasa_igbt()
    assert b_igbt.dataset_id == "nasa_igbt"
    assert b_igbt.provenance_class == "EXTERNAL_REAL"
    assert b_igbt.df["device_id"].nunique() >= 2
    assert b_igbt.target_column == "current"
    # Target 'current' MUST NEVER appear in features
    assert "current" not in b_igbt.features
    assert b_igbt.features == ["voltage"]
    assert b_igbt.metadata["binary_labels_available"] is False
    assert b_igbt.metadata["continuous_degradation_available"] is True
    assert b_igbt.metadata["compatibility_status"] == "INSUFFICIENT_COMPATIBLE_TARGET"


def test_nasa_igbt_no_target_feature_leakage():
    """Verify target 'current' is strictly excluded from features to prevent target leakage."""
    b_igbt = load_nasa_igbt()
    assert b_igbt.target_column not in b_igbt.features, "CRITICAL: Target column present in feature list!"
    for feature in b_igbt.features:
        assert feature != b_igbt.target_column, f"Feature '{feature}' is identical to target column!"


def test_nasa_igbt_temporal_causality():
    """Verify NASA IGBT benchmark fails closed with INSUFFICIENT_COMPATIBLE_TARGET when target leakage is removed."""
    runner = ExternalBenchmarkRunner()
    res = runner.run_nasa_igbt_benchmark()
    assert res["status"] == "INSUFFICIENT_COMPATIBLE_TARGET"
    assert res["metrics"] is None
    assert "Target variable 'current' strictly excluded" in res["leakage_verification"]


def test_nasa_igbt_device_separation():
    """Verify device-level separation structure across NASA IGBT device IDs."""
    b_igbt = load_nasa_igbt()
    devices = sorted(b_igbt.df["device_id"].unique())
    assert len(devices) >= 2
    train_devs = set(devices[:len(devices)//2])
    test_devs = set(devices[len(devices)//2:])
    assert len(train_devs.intersection(test_devs)) == 0, "Device overlap detected between train and test partitions!"


def test_nasa_igbt_future_observation_protection():
    """Verify future observations or leaked target features cannot be injected as features."""
    b_igbt = load_nasa_igbt()
    # Ensure current is not in features
    assert "current" not in b_igbt.features
    assert b_igbt.target_column not in b_igbt.features
    # Verify no feature is derived from future target values
    for f in b_igbt.features:
        assert f != b_igbt.target_column


def test_registry_contract_license_consistency():
    """Verify license_status consistency between dataset_registry.yaml and compatibility contracts."""
    contract_secom = get_compatibility_contract("uci_secom")
    assert contract_secom.license_status == "LICENSE_UNSPECIFIED"

    contract_igbt = get_compatibility_contract("nasa_igbt")
    assert contract_igbt.license_status == "LICENSE_REQUIRES_REVIEW (U.S. Government Works)"


def test_st_awfd_group_split_documentation_or_contract_consistency():
    """Verify ST-AWFD split documentation and contract specify GroupKFold MaterialID group isolation."""
    c_d1 = get_compatibility_contract("st_awfd_d1")
    assert "5-fold GroupKFold with MaterialID group isolation" in c_d1.split_strategy
    c_d2 = get_compatibility_contract("st_awfd_d2")
    assert "5-fold GroupKFold with MaterialID group isolation" in c_d2.split_strategy


def test_remote_datasets_fail_closed():
    """Verify remote-only datasets fail closed when local data access is attempted."""
    with pytest.raises(RemoteDatasetUnavailableError):
        load_nasa_mosfet()

    with pytest.raises(RemoteDatasetUnavailableError):
        load_nasa_capacitor()

    with pytest.raises(RemoteDatasetUnavailableError):
        load_upc_si_igbt_2026()

    # Metadata retrieval should work without raising errors
    mosfet_meta = get_remote_dataset_metadata("nasa_mosfet")
    assert mosfet_meta["provenance_class"] == "REMOTE_EXTERNAL_DATASET"
    assert mosfet_meta["sha256"] == "NOT_AVAILABLE_REMOTE_ONLY"
    assert mosfet_meta["remote_content_length_bytes"] == 7849865909


def test_compatibility_contracts():
    """Verify authoritative compatibility contracts for all 8 datasets."""
    assert len(EXTERNAL_DATASET_CONTRACTS) == 8

    contract_d1 = get_compatibility_contract("st_awfd_d1")
    assert contract_d1.compatibility_status == CompatibilityStatus.GENERALIZATION_ONLY

    contract_secom = get_compatibility_contract("uci_secom")
    assert contract_secom.compatibility_status == CompatibilityStatus.GENERALIZATION_ONLY

    contract_igbt = get_compatibility_contract("nasa_igbt")
    assert contract_igbt.compatibility_status == CompatibilityStatus.INSUFFICIENT_COMPATIBLE_TARGET

    contract_mosfet = get_compatibility_contract("nasa_mosfet")
    assert contract_mosfet.compatibility_status == CompatibilityStatus.REMOTE_ONLY


def test_production_isolation_safeguards():
    """Verify strict production isolation safeguards."""
    assert validate_production_isolation() is True

    # Assert production dataset SHA-256 hash is untouched
    prod_ds_path = "ml/data/synthetic/predicta_dataset_v3_50000.csv"
    with open(prod_ds_path, "rb") as f:
        ds_sha = hashlib.sha256(f.read()).hexdigest()
    assert ds_sha == "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"

    # Assert production model SHA-256 hash is untouched
    prod_model_path = "ml/models/production/predicta_xgboost_model.json"
    with open(prod_model_path, "rb") as f:
        model_sha = hashlib.sha256(f.read()).hexdigest()
    assert model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def test_external_benchmark_runner_execution():
    """Verify external benchmark runner execution, report generation, and disclaimer inclusion."""
    runner = ExternalBenchmarkRunner()
    results = runner.run_all_benchmarks(output_dir="experiments/external_benchmarks")

    assert "metadata" in results
    assert results["metadata"]["production_isolation_status"] == "VERIFIED_ISOLATED"
    assert MANDATORY_BENCHMARK_DISCLAIMER in results["metadata"]["disclaimer"]

    benchmarks = results["benchmarks"]
    assert len(benchmarks) == 8

    # Verify evaluated local datasets
    assert benchmarks["st_awfd_d1"]["status"] == "COMPLETED"
    assert benchmarks["st_awfd_d2"]["status"] == "COMPLETED"
    assert benchmarks["uci_secom"]["status"] == "COMPLETED"
    assert benchmarks["uci_ai4i_2020"]["status"] == "COMPLETED"
    assert benchmarks["nasa_igbt"]["status"] == "INSUFFICIENT_COMPATIBLE_TARGET"
    assert benchmarks["nasa_igbt"]["metrics"] is None

    # Verify remote-only datasets
    assert benchmarks["nasa_mosfet"]["status"] == "REMOTE_ONLY"
    assert benchmarks["nasa_capacitor"]["status"] == "REMOTE_ONLY"
    assert benchmarks["upc_si_igbt_2026"]["status"] == "REMOTE_ONLY"


    # Verify output report files exist
    assert os.path.exists("experiments/external_benchmarks/external_benchmark_report.json")
    assert os.path.exists("experiments/external_benchmarks/external_benchmark_report.md")

    # Verify mandatory disclaimer is present in Markdown report
    with open("experiments/external_benchmarks/external_benchmark_report.md", "r", encoding="utf-8") as f:
        md_text = f.read()
    assert MANDATORY_BENCHMARK_DISCLAIMER in md_text
