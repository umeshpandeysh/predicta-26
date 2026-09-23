"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
Governed Out-of-Distribution (OOD) & Distribution Shift Classifier (Python)
File: src/governance/ood_classifier.py

Classifies telemetry into:
1. NORMAL: Within nominal baseline distribution envelope.
2. MILD_SHIFT: Benign lot-to-lot variance within allowable process window.
3. SIGNIFICANT_SHIFT: Noticeable distribution divergence triggering mandatory manual engineering review.
4. OOD: Out-of-distribution observation where automated ML probabilities cannot be safely trusted;
   routes to HOLD / 96H_VERIFICATION.

GOVERNANCE NOTICE:
Baseline feature statistics and distance thresholds in this module are governed
heuristic reference specifications for benchmark/screening isolation, NOT empirically
certified production fab distributions. They must NOT be claimed as production calibration.
"""

from __future__ import annotations

import math
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class ShiftClassification(str, Enum):
    NORMAL = "NORMAL"
    MILD_SHIFT = "MILD_SHIFT"
    SIGNIFICANT_SHIFT = "SIGNIFICANT_SHIFT"
    OOD = "OOD"


OOD_GOVERNANCE_METADATA: Dict[str, Any] = {
    "baseline_type": "GOVERNED_HEURISTIC_SPECIFICATION",
    "calibration_status": "NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE",
    "usage_scope": "BENCHMARK_SCREENING_ONLY",
    "is_production_calibrated": False,
    "is_authoritative_decision_input": False,
    "limitations": (
        "Reference baseline statistics and shift thresholds are governed heuristic specifications "
        "for benchmark/screening isolation, not empirically certified fab baseline distributions. "
        "They must NOT be claimed as production calibration or silently override production ML decisions."
    ),
}

# Heuristic reference population statistics (mean, std) for semiconductor burn-in telemetry
BASELINE_FEATURE_STATS: Dict[str, Dict[str, float]] = {
    "supply_voltage": {"mean": 1.20, "std": 0.04},
    "output_voltage": {"mean": 1.20, "std": 0.04},
    "current": {"mean": 15.0, "std": 2.5},
    "leakage_current": {"mean": 120.0, "std": 35.0},
    "resistance": {"mean": 50.0, "std": 5.0},
    "capacitance": {"mean": 1.0, "std": 0.15},
    "threshold_voltage": {"mean": 0.45, "std": 0.04},
    "frequency": {"mean": 1200.0, "std": 100.0},
    "propagation_delay": {"mean": 85.0, "std": 12.0},
    "temperature": {"mean": 85.0, "std": 8.0},
    "dynamic_power": {"mean": 18.0, "std": 3.0},
    "total_power": {"mean": 25.0, "std": 4.5},
}


def _is_finite(val: Any) -> bool:
    try:
        fval = float(val)
        return math.isfinite(fval)
    except (ValueError, TypeError):
        return False


class OODClassifier:
    def __init__(self, custom_stats: Optional[Dict[str, Dict[str, float]]] = None) -> None:
        self.stats = custom_stats or BASELINE_FEATURE_STATS
        self.governance_metadata = OOD_GOVERNANCE_METADATA

    def classify(
        self,
        telemetry: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates telemetry features for distribution shift and OOD status.
        """
        if not isinstance(telemetry, dict) or not telemetry:
            return {
                "classification": ShiftClassification.OOD.value,
                "shift_score": 1.0,
                "max_z_score": 99.0,
                "rms_z_score": 99.0,
                "copod_score": None,
                "divergent_features": ["MISSING_TELEMETRY"],
                "requires_hold": True,
                "reason": "Missing or empty telemetry feature vector — fail closed to OOD",
                "governance_metadata": self.governance_metadata,
                "feature_z_scores": {},
            }

        opts = options or {}
        z_scores: Dict[str, float] = {}
        divergent_features: List[str] = []
        max_z = 0.0
        sum_sq_z = 0.0
        count = 0

        for key, val in telemetry.items():
            if key in self.stats:
                if _is_finite(val):
                    num_val = float(val)
                    mean = self.stats[key]["mean"]
                    std = self.stats[key]["std"]
                    z = abs((num_val - mean) / std) if std > 0 else 0.0
                    z_scores[key] = round(z, 2)
                    if z > max_z:
                        max_z = z
                    sum_sq_z += z * z
                    count += 1

                    if z > 3.0:
                        divergent_features.append(f"{key} (Z={z:.2f})")

        rms_z = math.sqrt(sum_sq_z / count) if count > 0 else 0.0
        copod_score = float(opts.get("copod_score", 0.0)) if _is_finite(opts.get("copod_score")) else 0.0
        psi_score = float(opts.get("psi", 0.0)) if _is_finite(opts.get("psi")) else 0.0

        raw_shift = max(
            max_z / 6.0,
            rms_z / 4.0,
            copod_score / 12.0,
            psi_score / 0.50,
        )
        shift_score = round(min(1.0, max(0.0, raw_shift)), 3)

        classification = ShiftClassification.NORMAL.value
        requires_hold = False
        reason = "Telemetry lies within nominal 3-sigma process window"

        if max_z > 5.0 or copod_score > 9.0 or psi_score > 0.40 or rms_z > 3.5:
            classification = ShiftClassification.OOD.value
            requires_hold = True
            reason = f"Severe distribution divergence (max_z={max_z:.2f}, RMS_z={rms_z:.2f}); ML automated probability unverified"
        elif max_z > 3.5 or copod_score > 6.5 or psi_score > 0.25 or rms_z > 2.5:
            classification = ShiftClassification.SIGNIFICANT_SHIFT.value
            requires_hold = True
            reason = f"Significant process distribution shift (max_z={max_z:.2f}); engineering review recommended"
        elif max_z > 2.5 or copod_score > 4.5 or psi_score > 0.10 or rms_z > 1.8:
            classification = ShiftClassification.MILD_SHIFT.value
            requires_hold = False
            reason = "Mild lot-to-lot parameter variation within acceptable tolerances"

        return {
            "classification": classification,
            "shift_score": shift_score,
            "max_z_score": round(max_z, 2),
            "rms_z_score": round(rms_z, 2),
            "copod_score": round(copod_score, 2),
            "divergent_features": divergent_features,
            "requires_hold": requires_hold,
            "reason": reason,
            "governance_metadata": self.governance_metadata,
            "feature_z_scores": z_scores,
        }
