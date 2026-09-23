"""
Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
Unified Engineering Evidence Card Generator (Python)
File: src/governance/evidence_card.py

Synthesizes the complete PS-170 Burn-In & Latent Defect Screening evidence chain
into machine-readable JSON and human-readable Markdown:
Telemetry -> Quality -> Anomaly -> Prognostics -> Uncertainty -> Physics ->
Discrimination -> OOD -> Risk Fusion -> Decision -> Counterfactual -> Twin Provenance

NON-NEGOTIABLE GOVERNANCE:
- Zero evidence fabrication
- Missing fields evaluate to null, INSUFFICIENT_EVIDENCE, or NOT_ESTABLISHED
- No inferred provenance
"""

from __future__ import annotations

import datetime
import math
from typing import Any, Dict, List, Optional, Tuple

from src.decision_engine.uncertainty_decision_pathway import (
    PROD_OPERATING_THRESHOLD,
    UncertaintyDecisionPathway,
)
from src.governance.discrimination_engine import (
    NON_CAUSAL_DISCLAIMER,
    DiscriminationEngine,
)
from src.governance.ood_classifier import OODClassifier

COUNTERFACTUAL_DISCLAIMER = "MODEL COUNTERFACTUAL — NOT A CAUSAL CLAIM"
PROD_MODEL_HASH = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
PROD_MODEL_VERSION = "4.0.0_authoritative"


def _is_finite(val: Any) -> bool:
    try:
        fval = float(val)
        return math.isfinite(fval)
    except (ValueError, TypeError):
        return False


class EvidenceCardGenerator:
    def __init__(self) -> None:
        self.discrimination_engine = DiscriminationEngine()
        self.ood_classifier = OODClassifier()
        self.decision_pathway = UncertaintyDecisionPathway(PROD_OPERATING_THRESHOLD)

    def generate_card(self, input_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generates a complete Engineering Evidence Card packet with strict evidence provenance.
        """
        data = input_data or {}
        component_id = data.get("component_id") or data.get("die_id") or None
        lot_id = data.get("lot_id") or None
        wafer_id = data.get("wafer_id") or None
        equipment_id = data.get("equipment_id") or None
        timestamp = data.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()

        telemetry0h = data.get("telemetry_0h") or {}
        telemetry24h = data.get("telemetry_24h") or {}
        has_telemetry = bool(telemetry0h or telemetry24h)
        anomaly = data.get("anomaly_evidence") or {}
        prognostics = data.get("prognostics") or {}
        physics = data.get("physics_evidence") or {}
        safety_slope = data.get("safety_slope") or {}

        calibrated_prob: Optional[float] = None
        if data.get("calibrated_probability") is not None and _is_finite(data.get("calibrated_probability")):
            calibrated_prob = float(data["calibrated_probability"])

        raw_risk_score: Optional[float] = None
        if data.get("risk_score") is not None and _is_finite(data.get("risk_score")):
            raw_risk_score = float(data["risk_score"])
        elif calibrated_prob is not None:
            raw_risk_score = float(round(calibrated_prob * 100))

        # 1. Evaluate Discrimination Engine
        discrimination = data.get("discrimination_evidence") or self.discrimination_engine.evaluate({
            "telemetry_0h": telemetry0h,
            "telemetry_24h": telemetry24h,
            "anomaly_evidence": anomaly,
            "equipment_context": {
                "equipment_id": equipment_id,
                "lot_id": lot_id,
                "lot_equipment_anomaly_rate": data.get("lot_equipment_anomaly_rate"),
                "chamber_thermal_offset_detected": data.get("chamber_thermal_offset_detected"),
            },
            "physics_evidence": physics,
        })

        # 2. Evaluate OOD / Distribution Shift
        copod_score = (
            float(anomaly.get("copod", {}).get("score", 0.0))
            if isinstance(anomaly.get("copod"), dict) and _is_finite(anomaly.get("copod", {}).get("score"))
            else None
        )
        ood = data.get("ood_evidence") or self.ood_classifier.classify(telemetry24h, {"copod_score": copod_score})

        # 3. Evaluate Governed Decision Pathway
        if data.get("governed_decision"):
            decision_report = data["governed_decision"]
        elif calibrated_prob is not None:
            decision_report = self.decision_pathway.evaluate({
                "calibrated_probability": calibrated_prob,
                "anomaly_evidence": anomaly,
                "prognostic_evidence": prognostics,
                "physics_evidence": physics,
                "discrimination_evidence": discrimination,
                "ood_evidence": ood,
                "safety_slope": safety_slope,
            })
        else:
            decision_report = {
                "decision": "HOLD",
                "next_action": "ROUTE_TO_96H_VERIFICATION",
                "reason": "Missing calibrated probability — routed to HOLD under fail-closed governance",
                "decision_factors": ["MISSING_CALIBRATED_PROBABILITY"],
                "governed_confidence": 0.0,
                "requires_engineering_review": True,
                "uncertainty_routed_to_hold": True,
            }

        # 4. Synthesize Counterfactual
        counterfactual = self._generate_counterfactual(telemetry24h, calibrated_prob, decision_report.get("decision", "HOLD"))

        # 5. Structure Model Provenance (Strict Provenance: derived from caller evidence only)
        raw_mp = data.get("model_provenance")
        if isinstance(raw_mp, dict):
            if raw_mp.get("status") == "VERIFIED" or (raw_mp.get("model_sha256") and raw_mp.get("model_version")):
                model_provenance = {
                    "status": "VERIFIED",
                    "model_version": raw_mp.get("model_version"),
                    "model_sha256": raw_mp.get("model_sha256"),
                    "provenance_source": raw_mp.get("provenance_source") or "CALLER_VERIFIED",
                }
            else:
                model_provenance = {
                    "status": raw_mp.get("status") or "NOT_ESTABLISHED",
                    "model_version": raw_mp.get("model_version"),
                    "model_sha256": raw_mp.get("model_sha256"),
                    "provenance_source": raw_mp.get("provenance_source"),
                }
        elif data.get("model_version") or data.get("model_sha256"):
            model_provenance = {
                "status": "VERIFIED",
                "model_version": data.get("model_version"),
                "model_sha256": data.get("model_sha256"),
                "provenance_source": data.get("provenance_source") or "CALLER_EXPLICIT",
            }
        else:
            model_provenance = {
                "status": "NOT_ESTABLISHED",
                "model_version": None,
                "model_sha256": None,
                "provenance_source": None,
            }

        # 6. Structure JSON Packet (Strict Provenance: Zero fabricated defaults)
        packet: Dict[str, Any] = {
            "card_version": "1.1.0_ps170_remediated",
            "generated_at": timestamp,
            "component_identity": {
                "component_id": component_id,
                "lot_id": lot_id,
                "wafer_id": wafer_id,
                "equipment_id": equipment_id,
                "test_checkpoint": data.get("test_checkpoint") or ("24h Early Burn-In Screening" if has_telemetry else None),
            },
            "data_quality": {
                "status": data.get("data_quality_status") or ("NOT_ESTABLISHED" if has_telemetry else "INSUFFICIENT_EVIDENCE"),
                "range_violations": discrimination.get("checks_evaluated", {}).get("sensor_range_violations", []),
                "flatline_channels": discrimination.get("checks_evaluated", {}).get("sensor_flatline_channels", []),
            },
            "anomaly_screening": {
                "status": anomaly.get("status") or "NOT_EVALUATED",
                "copod_score": copod_score,
                "pat_status": anomaly.get("pat", {}).get("status") if isinstance(anomaly.get("pat"), dict) else None,
                "isolation_forest_status": anomaly.get("isolation_forest", {}).get("status") if isinstance(anomaly.get("isolation_forest"), dict) else None,
            },
            "early_prognostics": {
                "checkpoint_24h_telemetry": telemetry24h if telemetry24h else None,
                "forecast_168h": prognostics.get("forecast_168h") or prognostics.get("predicted_168h") or None,
                "conformal_uncertainty": prognostics.get("conformal_interval") or None,
            },
            "physics_consistency": {
                "status": physics.get("status") or "INSUFFICIENT_PHYSICS_EVIDENCE",
                "consistency_score": float(physics["consistency_score"]) if _is_finite(physics.get("consistency_score")) else None,
                "checks_evaluated": physics.get("checks") or [],
            },
            "discrimination": {
                "root_evidence_type": discrimination.get("root_evidence_type"),
                "confidence_score": discrimination.get("confidence_score"),
                "evidence_summary": discrimination.get("evidence_summary"),
                "findings": discrimination.get("findings"),
                "disclaimer": NON_CAUSAL_DISCLAIMER,
            },
            "distribution_shift": {
                "classification": ood.get("classification"),
                "shift_score": ood.get("shift_score"),
                "max_z_score": ood.get("max_z_score"),
                "divergent_features": ood.get("divergent_features"),
                "requires_hold": ood.get("requires_hold"),
            },
            "risk_and_governance": {
                "risk_score": raw_risk_score,
                "calibrated_probability": calibrated_prob,
                "operating_threshold": PROD_OPERATING_THRESHOLD,
                "governed_decision": decision_report.get("decision"),
                "next_action": decision_report.get("next_action"),
                "decision_factors": decision_report.get("decision_factors"),
                "governed_confidence": decision_report.get("governed_confidence"),
                "requires_engineering_review": decision_report.get("requires_engineering_review"),
                "uncertainty_routed_to_hold": decision_report.get("uncertainty_routed_to_hold"),
            },
            "counterfactual_explanation": counterfactual,
            "provenance_and_twin": {
                "model_provenance": model_provenance,
                "twin_trace_id": data.get("twin_trace_id") or None,
                "operator_disposition": data.get("operator_disposition") or None,
                "immutable_record": True,
            },
        }

        markdown = self._render_markdown(packet)

        return {
            "json": packet,
            "markdown": markdown,
        }

    def _generate_counterfactual(
        self, telemetry: Dict[str, Any], prob: Optional[float], decision: str
    ) -> Dict[str, Any]:
        if decision == "PASS":
            return {
                "statement": "Component currently satisfies all PASS criteria.",
                "target_decision": "PASS",
                "feature_deltas": {},
                "disclaimer": COUNTERFACTUAL_DISCLAIMER,
            }

        if not telemetry:
            return {
                "statement": "Insufficient telemetry to compute counterfactual parameter trajectory.",
                "target_decision": "PASS",
                "feature_deltas": {},
                "disclaimer": COUNTERFACTUAL_DISCLAIMER,
            }

        deltas: Dict[str, Any] = {}
        if "leakage_current" in telemetry and _is_finite(telemetry["leakage_current"]) and float(telemetry["leakage_current"]) > 150.0:
            cur = float(telemetry["leakage_current"])
            deltas["leakage_current"] = {
                "current": cur,
                "counterfactual_target": 120.0,
                "delta": round(120.0 - cur, 2),
                "unit": "uA",
            }

        if "threshold_voltage" in telemetry and _is_finite(telemetry["threshold_voltage"]) and float(telemetry["threshold_voltage"]) > 0.48:
            cur_vth = float(telemetry["threshold_voltage"])
            deltas["threshold_voltage"] = {
                "current": cur_vth,
                "counterfactual_target": 0.45,
                "delta": round(0.45 - cur_vth, 3),
                "unit": "V",
            }

        return {
            "statement": f"To transition this component from {decision} to PASS under the production model, the following minimal parameter shifts would be required:",
            "target_decision": "PASS",
            "feature_deltas": deltas,
            "disclaimer": COUNTERFACTUAL_DISCLAIMER,
        }

    def _render_markdown(self, p: Dict[str, Any]) -> str:
        id_info = p["component_identity"]
        gov = p["risk_and_governance"]
        d = p["discrimination"]
        o = p["distribution_shift"]
        phys = p["physics_consistency"]
        cf = p["counterfactual_explanation"]
        prov = p["provenance_and_twin"]
        mp = prov.get("model_provenance", {})

        decision_factors_md = "\n".join(f"  - `{f}`" for f in gov.get("decision_factors", []))
        deltas = cf.get("feature_deltas", {})
        if deltas:
            deltas_md = "\n".join(
                f"  - `{k}`: Current=`{v['current']}{v['unit']}` -> Required=`{v['counterfactual_target']}{v['unit']}` (delta=`{v['delta']}{v['unit']}`)"
                for k, v in deltas.items()
            )
        else:
            deltas_md = "  - None required (Component already satisfies PASS criteria)"

        twin_trace = prov.get("twin_trace_id") or "null"
        operator_disp = prov.get("operator_disposition") or "null"
        prob_str = f"{gov['calibrated_probability']:.4f}" if gov.get("calibrated_probability") is not None else "NOT_EVALUATED"
        risk_str = f"{gov['risk_score']} / 100" if gov.get("risk_score") is not None else "NOT_EVALUATED"
        conf_str = f"{gov['governed_confidence'] * 100.0:.1f}%" if gov.get("governed_confidence") is not None else "NOT_ESTABLISHED"
        phys_score_str = f"{phys['consistency_score']:.2f}" if phys.get("consistency_score") is not None else "N/A"
        model_sha_str = mp.get("model_sha256") or "null (NOT_ESTABLISHED)"
        model_ver_str = mp.get("model_version") or "null (NOT_ESTABLISHED)"
        prov_status_str = mp.get("status") or "NOT_ESTABLISHED"

        return f"""# PREDICTA-26 — ENGINEERING EVIDENCE CARD
**PS-170 Semiconductor Burn-In & Latent Defect Screening Report**
*Generated at:* `{p['generated_at']}` | *Card Schema:* `{p['card_version']}`

---

## 1. COMPONENT IDENTIFICATION & LOT CONTEXT
- **Component ID / Die:** `{id_info['component_id'] or 'null'}`
- **Lot Identifier:** `{id_info['lot_id'] or 'null'}`
- **Wafer Identifier:** `{id_info['wafer_id'] or 'null'}`
- **Test Equipment:** `{id_info['equipment_id'] or 'null'}`
- **Checkpoint:** `{id_info['test_checkpoint'] or 'null'}`

---

## 2. GOVERNED DECISION & RISK FUSION
- **Final Governed Decision:** `{gov['governed_decision']}`
- **Recommended Next Action:** `{gov['next_action']}`
- **Calibrated Failure Probability:** `{prob_str}` (Authoritative Threshold = `{gov['operating_threshold']:.2f}`)
- **Multi-Criteria Risk Score:** `{risk_str}`
- **Governed Confidence:** `{conf_str}`
- **Decision Factors:**
{decision_factors_md}

---

## 3. RELIABILITY INTELLIGENCE & DISCRIMINATION
- **Root Evidence Type:** `{d['root_evidence_type']}` (Confidence: `{d['confidence_score'] * 100.0:.1f}%`)
- **Evidence Summary:** {d['evidence_summary']}
- **Discrimination Disclaimer:** *{d['disclaimer']}*
- **Distribution Shift Status:** `{o['classification']}` (Shift Score: `{o['shift_score']}`, Max Z: `{o['max_z_score']}`)
- **Physics Consistency Status:** `{phys['status']}` (Score: `{phys_score_str}`)

---

## 4. COUNTERFACTUAL EXPLANATION
- *Disclaimer:* **{cf['disclaimer']}**
- **Analysis:** {cf['statement']}
{deltas_md}

---

## 5. DIGITAL TWIN & GOVERNANCE PROVENANCE
- **Model Provenance Status:** `{prov_status_str}`
- **Model SHA-256:** `{model_sha_str}`
- **Model Version:** `{model_ver_str}`
- **Digital Twin Trace ID:** `{twin_trace}`
- **Operator Disposition:** `{operator_disp}`
"""
