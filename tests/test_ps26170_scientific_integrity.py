"""
Regression Test Suite: PS-26170 Scientific Integrity & Leakage Audits
======================================================================
Validates:
1. Exact & near-duplicate contamination audit
2. Explicit identifier overlap audit (lot, wafer, die, component, trajectory)
3. Programmatic temporal-leakage rejection & feature contract audit
4. Threshold provenance & test-set tuning prohibition audit
5. Actual P95 latency calculation & boundary verification (< 50ms)
"""

import os
import sys

# Ensure project root is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.evaluation.ps26170_final_benchmark import PS26170FinalBenchmarkEngine


def test_ps26170_duplicate_and_identifier_integrity():
    """Test 1: Verifies zero exact duplicate contamination and zero lot/wafer/die overlap."""
    engine = PS26170FinalBenchmarkEngine()
    df_test, _ = engine.load_and_verify_test_data()
    audit = engine.audit_scientific_integrity(df_test)

    dup = audit["duplicate_contamination_audit"]
    assert dup["exact_duplicate_count"] == 0, f"Expected 0 exact duplicates, found {dup['exact_duplicate_count']}"
    assert dup["duplicate_audit_status"] == "PASS"
    assert dup["near_duplicate_status"] == "NOT_VERIFIED — NO_DEFENSIBLE_EXISTING_METHOD"

    ident = audit["identifier_overlap_audit"]
    assert ident["lot_overlap_count"] == 0, f"Expected 0 lot overlap, found {ident['lot_overlap_count']}"
    assert ident["wafer_overlap_count"] == 0, f"Expected 0 wafer overlap, found {ident['wafer_overlap_count']}"
    assert ident["die_overlap_count"] == 0, f"Expected 0 die overlap, found {ident['die_overlap_count']}"
    assert ident["component_overlap_count"] == "NOT_PRESENT"
    assert ident["trajectory_overlap_count"] == "NOT_PRESENT"
    assert ident["identifier_overlap_status"] == "PASS"


def test_ps26170_temporal_feature_contract_integrity():
    """Test 2: Verifies zero temporal future features in input vector beyond 24h cutoff."""
    engine = PS26170FinalBenchmarkEngine()
    df_test, _ = engine.load_and_verify_test_data()
    audit = engine.audit_scientific_integrity(df_test)

    temp = audit["temporal_leakage_audit"]
    assert len(temp["detected_future_features_in_input"]) == 0, f"Future features detected: {temp['detected_future_features_in_input']}"
    assert temp["declared_screening_cutoff_hour"] == 24
    assert temp["declared_evaluation_horizon_hour"] == 168
    assert temp["ground_truth_targets_separated"] is True
    assert temp["temporal_leakage_status"] == "PASS"


def test_ps26170_threshold_provenance_and_tuning_prohibition():
    """Test 3: Verifies authoritative operating threshold θ* = 0.20 and prohibition of test tuning."""
    engine = PS26170FinalBenchmarkEngine()
    df_test, _ = engine.load_and_verify_test_data()
    audit = engine.audit_scientific_integrity(df_test)

    thresh = audit["threshold_provenance_audit"]
    assert thresh["authoritative_production_threshold"] == 0.20
    assert thresh["expected_threshold"] == 0.20
    assert thresh["test_set_threshold_tuning_permitted"] is False
    assert thresh["threshold_provenance_status"] == "PASS"


def test_ps26170_warm_latency_p95_bounds():
    """Test 4: Verifies warm inference P95 latency is measured and strictly < 50ms."""
    engine = PS26170FinalBenchmarkEngine()
    df_test, _ = engine.load_and_verify_test_data()
    audit = engine.audit_scientific_integrity(df_test)

    lat = audit["latency_measurement_audit"]
    assert lat["sample_count"] == 500
    assert lat["warm_inference_p95_ms"] < 50.0, f"P95 latency {lat['warm_inference_p95_ms']}ms exceeded 50ms limit"
    assert lat["latency_requirement_status"] == "PASS"
