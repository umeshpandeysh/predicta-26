"""
Predicta Semiconductor Intelligence Platform — Authoritative Anomaly Normalization
File: src/anomaly_detection/normalization.py

Deterministic normalization layer converting heterogeneous detector raw scores to [0, 1].
Derived strictly from training/validation optimization boundaries without test leakage.
Explicitly marked as uncalibrated (NOT_CALIBRATED).
"""

from typing import Dict, Optional


DEFAULT_NORMALIZATION_SCALES: Dict[str, float] = {
    "mad_scale": 6.0,
    "copod_scale": 9.5,
    "iso_min": 0.40,
    "iso_scale": 0.30,
}

CALIBRATION_STATUS: str = "NOT_CALIBRATED"
VALIDATION_STATUS: str = "PROJECT_DEFINED_SCREENING_CRITERION"


def normalize_detector_score(
    detector_name: str,
    raw_score: float,
    norm_scales: Optional[Dict[str, float]] = None,
) -> float:
    """
    Deterministically normalizes raw anomaly detector scores into [0, 1] range.

    Mapping Rules:
      - robust_mad: min(1.0, max(0.0, raw_score / mad_scale))
      - copod: min(1.0, max(0.0, raw_score / copod_scale))
      - isolation_forest: min(1.0, max(0.0, (raw_score - iso_min) / iso_scale)) if raw_score >= iso_min else 0.0

    Higher normalized score strictly means greater anomaly evidence.
    """
    scales = norm_scales or DEFAULT_NORMALIZATION_SCALES
    det = str(detector_name).strip().lower()

    if raw_score is None:
        return 0.0

    val = float(raw_score)

    if det in ("robust_mad", "mad", "pat_mad"):
        scale = float(scales.get("mad_scale", 6.0))
        return float(round(min(1.0, max(0.0, val / scale)), 4))

    elif det == "copod":
        scale = float(scales.get("copod_scale", 9.5))
        return float(round(min(1.0, max(0.0, val / scale)), 4))

    elif det in ("isolation_forest", "iforest", "iso"):
        iso_min = float(scales.get("iso_min", 0.40))
        iso_scale = float(scales.get("iso_scale", 0.30))
        if val < iso_min:
            return 0.0
        return float(round(min(1.0, max(0.0, (val - iso_min) / iso_scale)), 4))

    else:
        return float(round(min(1.0, max(0.0, val)), 4))
