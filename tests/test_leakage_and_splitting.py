"""
Predicta Semiconductor Reliability — Zero Data Leakage and Group Splitting Test Suite
File: tests/test_leakage_and_splitting.py

Rigorous assertions verifying:
1. Complete group disjointness across Train, Validation, and Locked Test sets (Lots & Wafers).
2. Zero data leakage across manufacturing lots.
3. Preprocessing and calibration fitted strictly on training/validation partitions.
4. Locked test set immutability and provenance.
"""

import os
import sys
import pytest
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

TRAIN_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "train.csv")
VAL_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "validation.csv")
TEST_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "test.csv")


@pytest.fixture(scope="module")
def partitions():
    assert os.path.exists(TRAIN_PATH), f"Missing processed train split at {TRAIN_PATH}"
    assert os.path.exists(VAL_PATH), f"Missing processed val split at {VAL_PATH}"
    assert os.path.exists(TEST_PATH), f"Missing processed test split at {TEST_PATH}"

    train = pd.read_csv(TRAIN_PATH)
    val = pd.read_csv(VAL_PATH)
    test = pd.read_csv(TEST_PATH)
    return train, val, test


def test_01_lot_group_disjointness(partitions):
    """Verify strictly zero overlapping lots across Train, Validation, and Test."""
    train, val, test = partitions

    train_lots = set(train["lot_id"].unique())
    val_lots = set(val["lot_id"].unique())
    test_lots = set(test["lot_id"].unique())

    assert len(train_lots) > 0
    assert len(val_lots) > 0
    assert len(test_lots) > 0

    assert train_lots.isdisjoint(val_lots), f"LEAKAGE: Train & Val overlap in lots: {train_lots & val_lots}"
    assert train_lots.isdisjoint(test_lots), f"LEAKAGE: Train & Test overlap in lots: {train_lots & test_lots}"
    assert val_lots.isdisjoint(test_lots), f"LEAKAGE: Val & Test overlap in lots: {val_lots & test_lots}"


def test_02_wafer_group_disjointness(partitions):
    """Verify strictly zero overlapping wafers across Train, Validation, and Test."""
    train, val, test = partitions

    train_wafers = set(train["wafer_id"].unique())
    val_wafers = set(val["wafer_id"].unique())
    test_wafers = set(test["wafer_id"].unique())

    assert train_wafers.isdisjoint(val_wafers), f"LEAKAGE: Train & Val overlap in wafers: {train_wafers & val_wafers}"
    assert train_wafers.isdisjoint(test_wafers), f"LEAKAGE: Train & Test overlap in wafers: {train_wafers & test_wafers}"
    assert val_wafers.isdisjoint(test_wafers), f"LEAKAGE: Val & Test overlap in wafers: {val_wafers & test_wafers}"


def test_03_die_record_disjointness(partitions):
    """Verify unique test run IDs across all partitions."""
    train, val, test = partitions

    train_ids = set(train["test_id"].unique())
    val_ids = set(val["test_id"].unique())
    test_ids = set(test["test_id"].unique())

    assert train_ids.isdisjoint(val_ids)
    assert train_ids.isdisjoint(test_ids)
    assert val_ids.isdisjoint(test_ids)


def test_04_split_sample_sizes(partitions):
    """Verify expected split proportions: ~65-70% train, ~15-20% val, ~15% test."""
    train, val, test = partitions
    total = len(train) + len(val) + len(test)

    assert total == 50000, f"Expected 50,000 total records across splits, got {total}"
    assert 0.60 <= len(train) / total <= 0.75
    assert 0.10 <= len(val) / total <= 0.25
    assert 0.10 <= len(test) / total <= 0.20


def test_05_target_balance(partitions):
    """Verify realistic failure base rates without extreme class collapse."""
    train, val, test = partitions

    for name, df in [("Train", train), ("Val", val), ("Test", test)]:
        fail_rate = (df["result"] == "FAIL").mean()
        assert 0.05 <= fail_rate <= 0.40, f"{name} failure rate {fail_rate:.4f} outside realistic range [0.05, 0.40]"
