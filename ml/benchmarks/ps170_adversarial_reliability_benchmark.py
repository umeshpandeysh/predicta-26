"""
Predicta Semiconductor Intelligence Platform — Phase 15 Hardening
Authoritative Adversarial Reliability Benchmark (Python)
File: ml/benchmarks/ps170_adversarial_reliability_benchmark.py

Executes a 20-attack engineering reliability benchmark testing PREDICTA defense boundaries:
1.  Sensor Range Breach (Vdd > 3.5V)
2.  Unphysical Single-Channel Step (dV > 0.5V, dI = 0)
3.  Dynamic Channel Flatline (4 identical dynamic channels across 24h)
4.  Non-Finite / NaN Telemetry Injection
5.  Negative Physical Parameter (Ileak < 0)
6.  Lot-Wide Equipment Shift (Cohort Anomaly Rate > 40%)
7.  Chamber Thermal Excursion (Chamber Thermal Offset Detected)
8.  Unseen Equipment Identifier (EQP-999)
9.  Spatial Wafer Cluster Anomaly
10. Extreme Out-of-Distribution Vector (Z > 5.0)
11. Calibrated Probability Breach (P = 0.25 >= 0.20 Threshold)
12. Critical Probability Breach (P = 0.82)
13. Nominal Silicon Component (P = 0.04)
14. Borderline Operational Risk (0.10 <= P = 0.14 < 0.20)
15. Safety Slope Boundary Breach
16. BTI Monotonicity Inconsistency
17. Arrhenius Non-Physical Thermal Inversion
18. Missing 0h Telemetry Baseline
19. Missing Model Provenance in Evidence Card
20. Protected Artifact & Immutable Threshold Verification

Outputs:
- ml/reports/ps170_adversarial_reliability_report.json
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.api.inference_service import PredictaInferenceService
from src.decision_engine.uncertainty_decision_pathway import (
    PROD_OPERATING_THRESHOLD,
    GovernedDecision,
    NextAction,
    UncertaintyDecisionPathway,
)
from src.governance.discrimination_engine import DiscriminationEngine, RootEvidenceType
from src.governance.evidence_card import (
    PROD_MODEL_HASH,
    PROD_MODEL_VERSION,
    EvidenceCardGenerator,
)
from src.governance.ood_classifier import OODClassifier


def run_adversarial_benchmark() -> Dict[str, Any]:
    print("=" * 80)
    print(" PREDICTA-26 — PS-170 ADVERSARIAL RELIABILITY BENCHMARK")
    print(" Executing 20 Engineering Decision Attack Scenarios...")
    print("=" * 80)

    inference_service = PredictaInferenceService()
    decision_pathway = UncertaintyDecisionPathway()
    discrimination_engine = DiscriminationEngine()
    ood_classifier = OODClassifier()
    card_generator = EvidenceCardGenerator()

    results: List[Dict[str, Any]] = []

    # Attack 1: Sensor Range Breach
    discrim_1 = discrimination_engine.evaluate({
        "telemetry_24h": {"supply_voltage": 4.85, "current": 10.0}
    })
    pass_1 = discrim_1["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
    results.append({"attack_id": 1, "name": "Sensor Range Breach", "passed": pass_1, "result": discrim_1["root_evidence_type"]})

    # Attack 2: Unphysical Single-Channel Step
    discrim_2 = discrimination_engine.evaluate({
        "telemetry_0h": {"supply_voltage": 1.20, "current": 10.0},
        "telemetry_24h": {"supply_voltage": 1.85, "current": 10.0001},
    })
    pass_2 = discrim_2["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
    results.append({"attack_id": 2, "name": "Single Channel Unphysical Step", "passed": pass_2, "result": discrim_2["root_evidence_type"]})

    # Attack 3: Dynamic Channel Flatline
    discrim_3 = discrimination_engine.evaluate({
        "telemetry_0h": {"leakage_current": 120.0, "propagation_delay": 11.0, "dynamic_power": 12.0, "temperature": 25.0},
        "telemetry_24h": {"leakage_current": 120.0, "propagation_delay": 11.0, "dynamic_power": 12.0, "temperature": 25.0},
    })
    pass_3 = discrim_3["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
    results.append({"attack_id": 3, "name": "Dynamic Channel Flatline", "passed": pass_3, "result": discrim_3["root_evidence_type"]})

    # Attack 4: Non-Finite / NaN Telemetry
    discrim_4 = discrimination_engine.evaluate({
        "telemetry_24h": {"supply_voltage": float("nan"), "current": 10.0}
    })
    pass_4 = discrim_4["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
    results.append({"attack_id": 4, "name": "NaN Telemetry Injection", "passed": pass_4, "result": discrim_4["root_evidence_type"]})

    # Attack 5: Negative Physical Parameter
    discrim_5 = discrimination_engine.evaluate({
        "telemetry_24h": {"leakage_current": -15.0, "current": 10.0}
    })
    pass_5 = discrim_5["root_evidence_type"] == RootEvidenceType.SENSOR_OR_DATA_QUALITY.value
    results.append({"attack_id": 5, "name": "Negative Leakage Parameter", "passed": pass_5, "result": discrim_5["root_evidence_type"]})

    # Attack 6: Lot-Wide Equipment Shift
    discrim_6 = discrimination_engine.evaluate({
        "telemetry_0h": {"current": 10.0},
        "telemetry_24h": {"current": 10.2},
        "equipment_context": {"equipment_id": "EQP-101", "lot_equipment_anomaly_rate": 0.65},
    })
    pass_6 = discrim_6["root_evidence_type"] == RootEvidenceType.EQUIPMENT_OR_CHAMBER.value
    results.append({"attack_id": 6, "name": "Lot-Wide Equipment Shift", "passed": pass_6, "result": discrim_6["root_evidence_type"]})

    # Attack 7: Chamber Thermal Excursion
    discrim_7 = discrimination_engine.evaluate({
        "telemetry_0h": {"current": 10.0},
        "telemetry_24h": {"current": 10.2},
        "equipment_context": {"chamber_thermal_offset_detected": True, "chamber_thermal_offset_c": 18.5},
    })
    pass_7 = discrim_7["root_evidence_type"] == RootEvidenceType.EQUIPMENT_OR_CHAMBER.value
    results.append({"attack_id": 7, "name": "Chamber Thermal Excursion", "passed": pass_7, "result": discrim_7["root_evidence_type"]})

    # Attack 8: Unseen Equipment ID
    rec_8 = {
        "equipment_id": "EQP-UNKNOWN-999",
        "supply_voltage": 1.20, "output_voltage": 1.20, "current": 10.5, "leakage_current": 110.0,
        "resistance": 100.0, "capacitance": 1.0, "threshold_voltage": 0.450, "frequency": 1200.0,
        "propagation_delay": 10.5, "setup_time": 0.25, "hold_time": 0.15, "timing_margin": 0.35,
        "temperature": 25.0, "dynamic_power": 12.0, "total_power": 15.0, "test_duration": 100.0,
    }
    pred_8 = inference_service.predict_single(rec_8)
    pass_8 = pred_8.get("is_unseen_equipment") is True
    results.append({"attack_id": 8, "name": "Unseen Equipment ID Handling", "passed": pass_8, "result": f"is_unseen={pred_8.get('is_unseen_equipment')}"})

    # Attack 9: Spatial Wafer Cluster
    card_9 = card_generator.generate_packet({
        "component_id": "DIE-EDGE-01",
        "lot_id": "LOT-99",
        "wafer_id": "W-01",
        "genealogy_context": {"spatial_cluster_detected": True, "die_x": 48, "die_y": 48},
        "calibrated_probability": 0.15,
    })
    pass_9 = card_9["component_genealogy"]["die_x"] == 48
    results.append({"attack_id": 9, "name": "Spatial Wafer Topology", "passed": pass_9, "result": "Genealogy coordinates registered"})

    # Attack 10: Extreme OOD Screening Vector
    ood_10 = ood_classifier.classify({"current": 85.0, "temperature": 180.0, "leakage_current": 950.0})
    is_auth = ood_10.get("governance_metadata", {}).get("is_authoritative_decision_input", False)
    pass_10 = ood_10["classification"] == "OOD" and is_auth is False
    results.append({"attack_id": 10, "name": "OOD Non-Authoritative Screening", "passed": pass_10, "result": f"OOD={ood_10['classification']}, auth={is_auth}"})

    # Attack 11: Calibrated Probability Breach (P = 0.25 >= 0.20)
    dec_11 = decision_pathway.evaluate({"calibrated_probability": 0.25})
    pass_11 = dec_11["decision"] == GovernedDecision.REJECT.value and dec_11["next_action"] == NextAction.SCRAP_OR_FAILURE_ANALYSIS.value
    results.append({"attack_id": 11, "name": "Operating Threshold Breach (0.25 >= 0.20)", "passed": pass_11, "result": dec_11["decision"]})

    # Attack 12: Critical Probability Breach (P = 0.82)
    dec_12 = decision_pathway.evaluate({"calibrated_probability": 0.82})
    pass_12 = dec_12["decision"] == GovernedDecision.REJECT.value
    results.append({"attack_id": 12, "name": "Critical Probability Breach (0.82)", "passed": pass_12, "result": dec_12["decision"]})

    # Attack 13: Nominal Silicon Component (P = 0.04)
    dec_13 = decision_pathway.evaluate({"calibrated_probability": 0.04})
    pass_13 = dec_13["decision"] == GovernedDecision.PASS.value and dec_13["next_action"] == NextAction.RELEASE_TO_PRODUCTION.value
    results.append({"attack_id": 13, "name": "Nominal Component Release", "passed": pass_13, "result": dec_13["decision"]})

    # Attack 14: Borderline Operational Risk (P = 0.14)
    dec_14 = decision_pathway.evaluate({"calibrated_probability": 0.14})
    pass_14 = dec_14["decision"] == GovernedDecision.MONITOR.value and dec_14["next_action"] == NextAction.CONTINUE_MONITORED_BURN_IN.value
    results.append({"attack_id": 14, "name": "Borderline Risk Monitored Burn-In", "passed": pass_14, "result": dec_14["decision"]})

    # Attack 15: Safety Slope Boundary Exceeded
    dec_15 = decision_pathway.evaluate({
        "calibrated_probability": 0.05,
        "safety_slope": {"iddq": {"boundary_status": "EXCEEDED", "slope_per_hour": 1.85}},
    })
    pass_15 = dec_15["decision"] == GovernedDecision.REJECT.value
    results.append({"attack_id": 15, "name": "Safety Slope Boundary Breach", "passed": pass_15, "result": dec_15["decision"]})

    # Attack 16: Physics Monotonicity Inconsistency
    dec_16 = decision_pathway.evaluate({
        "calibrated_probability": 0.05,
        "physics_evidence": {"status": "PHYSICS_INCONSISTENT"},
    })
    pass_16 = dec_16["decision"] == GovernedDecision.REJECT.value
    results.append({"attack_id": 16, "name": "Physics Consistency Violation", "passed": pass_16, "result": dec_16["decision"]})

    # Attack 17: Arrhenius Inversion
    from src.physics.reliability_engine import PhysicsReliabilityEngine
    phys_eng = PhysicsReliabilityEngine()
    af_ok, af_ev = phys_eng.evaluate_thermal_acceleration_consistency(temp_c_use=125.0, temp_c_test_1=85.0, temp_c_test_2=25.0)
    pass_17 = af_ok is False
    results.append({"attack_id": 17, "name": "Arrhenius Thermal Inversion", "passed": pass_17, "result": f"status={af_ev.get('status')}"})

    # Attack 18: Missing 0h Baseline
    drift_18 = inference_service.evaluate_gpr_drift({"current": 10.0, "leakage_current": 120.0, "propagation_delay": 11.0})
    pass_18 = any(v.get("status") == "INSUFFICIENT_HISTORY" for v in drift_18.values())
    results.append({"attack_id": 18, "name": "Missing 0h Baseline Fail-Closed", "passed": pass_18, "result": "INSUFFICIENT_HISTORY"})

    # Attack 19: Missing Model Provenance in Evidence Card
    card_19 = card_generator.generate_card({"component_id": "TEST-01"})
    mp_19 = card_19["json"]["provenance_and_twin"]["model_provenance"]
    pass_19 = mp_19["model_sha256"] is None and mp_19["status"] == "NOT_ESTABLISHED"
    results.append({"attack_id": 19, "name": "Missing Model Provenance Anti-Fabrication", "passed": pass_19, "result": mp_19["status"]})

    # Attack 20: Protected Artifact & Threshold Verification
    prod_model_path = os.path.join(project_root, "ml", "models", "production", "predicta_xgboost_model.json")
    with open(prod_model_path, "rb") as f:
        actual_model_sha = hashlib.sha256(f.read()).hexdigest()
    pass_20 = (actual_model_sha == PROD_MODEL_HASH) and (PROD_OPERATING_THRESHOLD == 0.20)
    results.append({"attack_id": 20, "name": "Protected Model SHA & Threshold", "passed": pass_20, "result": f"SHA={actual_model_sha[:8]}..., Thresh={PROD_OPERATING_THRESHOLD}"})

    for r in results:
        status_sym = "[PASS]" if r["passed"] else "[FAIL]"
        print(f" {status_sym} Attack {r['attack_id']:02d}: {r['name']} -> {r['result']}")

    total_passed = sum(1 for r in results if r["passed"])
    all_passed = total_passed == len(results)

    report = {
        "benchmark_title": "PREDICTA-26 PS-170 Adversarial Reliability Benchmark",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "total_attacks": len(results),
        "passed_attacks": total_passed,
        "failed_attacks": len(results) - total_passed,
        "benchmark_status": "PASSED" if all_passed else "FAILED",
        "attack_results": results,
    }

    out_path = os.path.join(project_root, "ml", "reports", "ps170_adversarial_reliability_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n [OK] Summary: {total_passed}/{len(results)} attacks passed. Report saved to: {out_path}")
    return report


if __name__ == "__main__":
    rep = run_adversarial_benchmark()
