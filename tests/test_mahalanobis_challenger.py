"""
PREDICTA Phase 2 — Mahalanobis Challenger Unit & Benchmark Test Suite
Validates mathematical correctness, singular covariance stability, and benchmark separation.
"""

import numpy as np

from src.anomaly_detection.mahalanobis_challenger import (
    MahalanobisChallenger,
    DEFAULT_REJECT_THRESHOLD,
)


def test_mahalanobis_fit_and_deterministic_output():
    """Verify MahalanobisChallenger computes deterministic distance."""
    np.random.seed(42)
    # Generate 100 3D nominal samples
    X_train = np.random.multivariate_normal(
        mean=[2000.0, 300.0, 190.0],
        cov=[[10000.0, 500.0, 200.0], [500.0, 100.0, 50.0], [200.0, 50.0, 40.0]],
        size=100
    )

    detector = MahalanobisChallenger()
    detector.fit(X_train)

    assert detector.is_fitted is True
    assert detector.mean_vector.shape == (3,)
    assert detector.covariance_matrix.shape == (3, 3)

    # Test nominal point at mean
    c_mean = {"iddq": 2000.0, "ileak": 300.0, "tpd": 190.0}
    res_mean = detector.score_single(c_mean)
    assert res_mean["status"] == "PASS"
    assert res_mean["score"] < 1.0

    # Test extreme outlier
    c_outlier = {"iddq": 5000.0, "ileak": 800.0, "tpd": 400.0}
    res_outlier = detector.score_single(c_outlier)
    assert res_outlier["status"] == "REJECT"
    assert res_outlier["score"] > DEFAULT_REJECT_THRESHOLD


def test_mahalanobis_singular_covariance_handling():
    """Verify regularized pseudo-inverse handles rank-deficient / singular matrices without crashing."""
    # Perfectly collinear data: feature 2 is 2*feature 1, feature 3 is 3*feature 1
    f1 = np.linspace(10.0, 50.0, 30)
    f2 = f1 * 2.0
    f3 = f1 * 3.0
    X_singular = np.column_stack([f1, f2, f3])

    detector = MahalanobisChallenger(epsilon=1e-5)
    detector.fit(X_singular)

    assert detector.is_fitted is True
    # Verify no NaNs in inverted covariance
    assert np.all(np.isfinite(detector.inv_covariance))

    # Evaluate a point
    res = detector.score_single({"iddq": 30.0, "ileak": 60.0, "tpd": 90.0})
    assert res["status"] in ["PASS", "MONITOR", "REJECT"]
    assert np.isfinite(res["score"])


def test_mahalanobis_unfitted_fail_safe():
    """Verify unfitted detector returns INSUFFICIENT_EVIDENCE cleanly."""
    detector = MahalanobisChallenger()
    res = detector.score_single({"iddq": 100.0, "ileak": 20.0, "tpd": 10.0})
    assert res["status"] == "INSUFFICIENT_EVIDENCE"
    assert res["score"] is None
