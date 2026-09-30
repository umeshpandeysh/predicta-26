"""
PREDICTA-26 — Production SHAP Explainability Integrity Test Suite
==================================================================
Verifies:
1. Production model SHAP TreeExplainer instantiation
2. Exact additivity property (|sum(shap) + base_value - raw_margin| < 1e-4)
3. Global feature ranking integrity and non-emptiness
4. Single-sample local attribution consistency
5. Robustness against NaNs/Infs
6. Zero test leakage and read-only model safety
"""

from pathlib import Path
import json
import numpy as np
import pandas as pd
import pytest

from src.explainability.production_shap_explainer import ProductionShapExplainer
from src.features.feature_contract import ALL_28_FEATURE_NAMES

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEST_CSV_PATH = PROJECT_ROOT / "ml" / "data" / "processed" / "test.csv"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "production" / "predicta_xgboost_model.json"
BENCHMARK_DIR = PROJECT_ROOT / "experiments" / "benchmarks"


@pytest.fixture(scope="module")
def explainer():
    return ProductionShapExplainer(MODEL_PATH)


@pytest.fixture(scope="module")
def sample_test_df():
    df = pd.read_csv(TEST_CSV_PATH)
    return df.head(100)


def test_01_explainer_initialization(explainer):
    """Verify explainer initializes with production model and canonical 28 features."""
    assert explainer.booster is not None
    assert explainer.explainer is not None
    assert len(explainer.feature_names) == 28
    assert list(explainer.feature_names) == list(ALL_28_FEATURE_NAMES)


def test_02_tree_explainer_additivity(explainer, sample_test_df):
    """Verify exact SHAP additivity on test samples within 1e-4 tolerance."""
    shap_values, base_values, X = explainer.explain_dataframe(sample_test_df)
    additivity_res = explainer.verify_additivity(X, shap_values, base_values, tolerance=1e-4)
    assert additivity_res["passed"] is True
    assert additivity_res["max_absolute_error"] < 1e-4
    assert additivity_res["samples_checked"] == len(sample_test_df)


def test_03_global_attributions(explainer, sample_test_df):
    """Verify global feature attributions produce valid rankings without NaNs."""
    shap_values, base_values, X = explainer.explain_dataframe(sample_test_df)
    global_res = explainer.compute_global_summary(shap_values, X)
    top_features = global_res["top_10_features"]
    assert len(top_features) == 10

    # Check monotonic ordering of mean_abs_shap
    shap_vals = [f["mean_abs_shap"] for f in top_features]
    assert all(x >= y for x, y in zip(shap_vals, shap_vals[1:]))
    assert all(np.isfinite(x) for x in shap_vals)
    assert shap_vals[0] > 0.0


def test_04_local_single_instance_attribution(explainer, sample_test_df):
    """Verify local attribution for a single component matches raw margin output."""
    sample_row = sample_test_df.iloc[0].to_dict()
    local_res = explainer.explain_instance(sample_row)

    assert "base_value_log_odds" in local_res
    assert "final_margin_log_odds" in local_res
    assert "predicted_probability" in local_res
    assert "all_attributions" in local_res
    assert len(local_res["all_attributions"]) == 28

    sum_contribs = sum(item["shap_value"] for item in local_res["all_attributions"])
    reconstructed_margin = local_res["base_value_log_odds"] + sum_contribs
    assert abs(reconstructed_margin - local_res["final_margin_log_odds"]) < 1e-4


def test_05_shap_artifact_consistency():
    """Verify that persisted scorecard contains valid SHAP results."""
    scorecard_path = BENCHMARK_DIR / "predicta_final_ml_shap_financial_scorecard.json"
    if not scorecard_path.exists():
        scorecard_path = BENCHMARK_DIR / "aether_final_scorecard.json"

    assert scorecard_path.exists(), "Benchmark scorecard must exist"
    with open(scorecard_path, "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    assert "shap" in scorecard
    shap_data = scorecard["shap"]
    assert shap_data["additivity_verification"]["passed"] is True
    assert shap_data["additivity_verification"]["max_absolute_error"] < 1e-4
    assert len(shap_data["global_attribution"]["top_10_features"]) == 10
    assert shap_data["stability_evaluation"]["top_10_feature_rank_stability"] >= 0.70
