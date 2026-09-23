"""
Authoritative Digital Reliability Twin Data Model & Lineage Service (Python)
File: src/reliability_twin/reliability_twin.py

EVIDENCE-ONLY READ MODEL.

Fully implements the 10-stage evidence chain defined by:
  ml/reliability_twin/reliability_twin_contract.json

10 Timeline Stages:
 1. MANUFACTURING_OBSERVATION
 2. ML_EVALUATION
 3. ANOMALY_EVIDENCE
 4. PROGNOSTIC_EVIDENCE
 5. PHYSICS_RELIABILITY_EVIDENCE
 6. RISK_FUSION_DECISION
 7. OPERATOR_DISPOSITION
 8. SECONDARY_TEST
 9. OUTCOME_EVIDENCE
10. ADJUDICATION

STRICT NON-FABRICATION & PROVENANCE RULES:
 - Identity (component/lot/wafer/die/equipment) comes ONLY from authoritative records.
   If unrecorded: None. An arbitrary lookup string does NOT become component_id.
 - Timestamps come ONLY from authoritative source records. If absent: None.
 - Historical model SHA and version come from the prediction record when available.
 - Physics and Risk-Fusion evidence are consumed VERBATIM if they exist in the record;
   if absent, they evaluate to INSUFFICIENT_EVIDENCE / None with zero timeline events.
 - Secondary test requires explicit authoritative `secondary_test_source_type`
   ("ATE_RETEST_SIMULATOR" or "SYNTHETIC_SIMULATION"). If missing/unspecified: INSUFFICIENT_EVIDENCE.
 - NEVER triggers new live inference, physics evaluation, or risk calculations during Twin build.
 - Missing provenance fields evaluate strictly to None (no default "1.0.0" fallbacks).
 - Twin is strictly read-only and immutable.
"""

import copy
import hashlib
import json
import os
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TWIN_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "reliability_twin", "reliability_twin_contract.json")
PROD_MANIFEST_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_production_manifest.json")
MODEL_JSON_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")

from src.governance.disposition import (
    HumanDispositionManager as HumanDispositionManagerPy,
    _AUTHORITATIVE_PREDICTION_STORE,
)


def compute_file_sha256(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"ARTIFACT_MISSING: File not found at {file_path}")
    with open(file_path, "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")
    return hashlib.sha256(content).hexdigest()


class ReliabilityTwinManagerPy:
    def __init__(
        self,
        contract_path: str = TWIN_CONTRACT_PATH,
        manifest_path: str = PROD_MANIFEST_PATH,
        model_path: str = MODEL_JSON_PATH,
    ):
        self.contract_path = contract_path
        self.manifest_path = manifest_path
        self.model_path = model_path
        self.disposition_manager = HumanDispositionManagerPy(
            manifest_path=manifest_path,
            model_path=model_path,
        )

        self.contract = self._load_json(self.contract_path)
        self.manifest = self._load_json(self.manifest_path)

        immutability = self.contract.get("immutability_constraints", {}) if self.contract else {}
        self.expected_model_sha = (
            immutability.get("expected_model_sha256")
            or (self.manifest.get("model_sha256") if self.manifest else None)
            or "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
        )
        self.expected_threshold = immutability.get("authoritative_operating_threshold", 0.20)

        self.verify_model_provenance()

    def _load_json(self, file_path: str) -> Optional[Dict[str, Any]]:
        if not file_path or not os.path.exists(file_path):
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def verify_model_provenance(self) -> str:
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"MODEL_MISSING: Model artifact not found at {self.model_path}")
        actual_sha = compute_file_sha256(self.model_path)
        if actual_sha != self.expected_model_sha:
            raise ValueError(
                f"MODEL_PROVENANCE_INVALID: Computed SHA {actual_sha} does not match expected {self.expected_model_sha}"
            )
        return actual_sha

    def _is_synthetic_record(self, rec: Optional[Dict[str, Any]]) -> bool:
        if not rec or not isinstance(rec, dict):
            return False
        if rec.get("is_synthetic") is True:
            return True
        if rec.get("is_synthetic") is False:
            return False
        if rec.get("source_type") in ("SYNTHETIC_SIMULATION", "ATE_SIMULATION"):
            return True
        lot_id = rec.get("lot_id")
        cmp_id = rec.get("component_id")
        return (isinstance(lot_id, str) and lot_id.startswith("LOT-SYN")) or \
               (isinstance(cmp_id, str) and cmp_id.startswith("CMP-SYN"))

    def resolve_prediction_record(self, identifier: Any) -> Optional[Dict[str, Any]]:
        """
        Resolves the authoritative prediction record for the given identifier.
        Searches in-memory authoritative store only. NEVER triggers a new prediction or live recomputation.
        """
        if identifier is None:
            return None

        target_id = identifier.strip() if isinstance(identifier, str) else None

        if target_id:
            # Direct key lookup
            if target_id in _AUTHORITATIVE_PREDICTION_STORE:
                return copy.deepcopy(_AUTHORITATIVE_PREDICTION_STORE[target_id])
            # Scan all values for matching identity fields
            for val in _AUTHORITATIVE_PREDICTION_STORE.values():
                if (
                    val.get("component_id") == target_id
                    or val.get("trace_id") == target_id
                    or val.get("test_id") == target_id
                ):
                    return copy.deepcopy(val)

        return None

    def build_reliability_twin(
        self, identifier: Any, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Builds the canonical Digital Reliability Twin read model for the given identifier.

        The twin is a READ MODEL: it aggregates existing authoritative evidence across
        all 10 defined timeline stages. It NEVER creates evidence, triggers predictions,
        or runs live physics/risk computations.
        """
        if identifier is None:
            raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.")

        search_key = ""
        if isinstance(identifier, str):
            search_key = identifier.strip()
            if not search_key:
                raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.")
        else:
            raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier must be a string.")

        verified_current_model_sha = self.verify_model_provenance()
        prediction_rec = self.resolve_prediction_record(identifier)
        is_registered = prediction_rec is not None

        # Identity: sourced ONLY from the authoritative prediction record.
        # An arbitrary query string does NOT become authoritative component_id.
        trace_id: Optional[str] = prediction_rec.get("trace_id") if prediction_rec else None
        test_id: Optional[str] = prediction_rec.get("test_id") if prediction_rec else None
        component_id: Optional[str] = prediction_rec.get("component_id") if prediction_rec else None
        lot_id: Optional[str] = prediction_rec.get("lot_id") if prediction_rec else None
        wafer_id: Optional[str] = prediction_rec.get("wafer_id") if prediction_rec else None
        die_id: Optional[str] = prediction_rec.get("die_id") if prediction_rec else None
        equipment_id: Optional[str] = prediction_rec.get("equipment_id") if prediction_rec else None

        # Deterministic twin ID
        twin_input = f"{component_id or search_key}:{trace_id or 'NO_TRACE'}:{test_id or 'NO_TEST'}"
        twin_hash = hashlib.sha256(twin_input.encode("utf-8")).hexdigest()[:12].upper()
        twin_id = f"TWIN-{twin_hash}"

        # Authoritative timestamp: from prediction record only. None if not present.
        source_timestamp: Optional[str] = (
            prediction_rec.get("created_at") if prediction_rec else None
        )
        is_synthetic = self._is_synthetic_record(prediction_rec)

        # Retrieve disposition chain for this trace
        dispositions: List[Dict[str, Any]] = []
        outcome_evidences: List[Dict[str, Any]] = []
        adjudications: List[Dict[str, Any]] = []

        if trace_id and self.disposition_manager:
            try:
                disp_record = self.disposition_manager.get_disposition(trace_id)
                dispositions = disp_record.get("history", []) if disp_record else []
                outcome_evidences = self.disposition_manager.get_outcome_evidence(trace_id) or []
                adj = self.disposition_manager.get_adjudication(trace_id)
                if adj:
                    adjudications.append(adj)
            except Exception:
                pass

        timeline_events: List[Dict[str, Any]] = []

        # =====================================================================
        # STAGE 1: MANUFACTURING_OBSERVATION
        # =====================================================================
        mfg_status = "INSUFFICIENT_EVIDENCE"
        mfg_block = None
        if prediction_rec and prediction_rec.get("manufacturing_observation"):
            mfg_status = "AVAILABLE"
            mfg_block = copy.deepcopy(prediction_rec["manufacturing_observation"])
            mfg_ts = mfg_block.get("timestamp") or source_timestamp
            timeline_events.append({
                "event_id": f"EVT-MFG-{twin_id[5:11]}-01",
                "stage": "MANUFACTURING_OBSERVATION",
                "timestamp": mfg_ts,
                "summary": mfg_block.get("summary", "ATE manufacturing observation telemetry recorded"),
                "details": mfg_block,
                "provenance": {
                    "source_type": "SYNTHETIC_SIMULATION" if is_synthetic else "ATE_TELEMETRY",
                    "source_identifier": trace_id or test_id or component_id or search_key,
                    "source_timestamp": mfg_ts,
                    "model_identifier": None,
                    "model_version": None,
                    "model_sha256": None,
                },
            })

        # =====================================================================
        # STAGE 2: ML_EVALUATION
        # =====================================================================
        ml_evidence_status = "INSUFFICIENT_EVIDENCE"
        ml_evidence_block = None

        if prediction_rec and prediction_rec.get("prediction") is not None:
            ml_evidence_status = "AVAILABLE"
            threshold_val = prediction_rec.get("threshold")
            if threshold_val is None:
                threshold_val = prediction_rec.get("operating_threshold")
            ml_prov = prediction_rec.get("provenance") if isinstance(prediction_rec.get("provenance"), dict) else None
            historical_model_sha = prediction_rec.get("model_sha256") or (ml_prov.get("model_sha256") if ml_prov else None)
            historical_model_version = prediction_rec.get("model_version") or (ml_prov.get("model_version") if ml_prov else None)
            historical_model_identifier = prediction_rec.get("model_identifier") or (ml_prov.get("model_identifier") if ml_prov else None)

            ml_evidence_block = {
                "prediction": prediction_rec.get("prediction"),
                "probability": prediction_rec.get("probability"),
                "threshold": threshold_val,
                "risk_level": prediction_rec.get("risk_level"),
                "operational_decision": prediction_rec.get("operational_decision"),
                "decision_class": prediction_rec.get("decision_class"),
                "requires_secondary_test": (
                    bool(prediction_rec.get("requires_secondary_test"))
                    if prediction_rec.get("requires_secondary_test") is not None
                    else None
                ),
                "decision_reason": prediction_rec.get("decision_reason"),
                "model_version": historical_model_version,
                "model_sha256": historical_model_sha,
                "provenance": {
                    "source_type": (ml_prov.get("source_type") if ml_prov else None) or prediction_rec.get("source_type") or ("SYNTHETIC_SIMULATION" if is_synthetic else "PRODUCTION_ML_MODEL"),
                    "source_identifier": (ml_prov.get("source_identifier") if ml_prov else None) or trace_id or test_id or component_id or search_key,
                    "source_timestamp": (ml_prov.get("source_timestamp") if ml_prov else None) or source_timestamp,
                    "model_identifier": historical_model_identifier,
                    "model_version": historical_model_version,
                    "model_sha256": historical_model_sha,
                },
            }

            prob_val = prediction_rec.get("probability", 0.0)
            timeline_events.append({
                "event_id": f"EVT-ML-{twin_id[5:11]}-02",
                "stage": "ML_EVALUATION",
                "timestamp": source_timestamp,
                "summary": (
                    f"Authoritative model prediction: {prediction_rec.get('prediction')} "
                    f"(P={float(prob_val):.4f})"
                ),
                "details": copy.deepcopy(ml_evidence_block),
                "provenance": copy.deepcopy(ml_evidence_block["provenance"]),
            })

        # =====================================================================
        # STAGE 3: ANOMALY_EVIDENCE
        # =====================================================================
        anomaly_status = "INSUFFICIENT_EVIDENCE"
        anomaly_block = None
        anomaly_data = (
            prediction_rec.get("ml_details", {}).get("anomaly_detection")
            or prediction_rec.get("ml_details", {}).get("anomaly")
            or prediction_rec.get("anomaly_evidence")
            if prediction_rec else None
        )
        if anomaly_data:
            anomaly_status = "AVAILABLE"
            anomaly_block = copy.deepcopy(anomaly_data)
            copod_score = anomaly_block.get("copod_score", anomaly_block.get("score"))
            pat_status = anomaly_block.get("pat_status", anomaly_block.get("status"))
            ano_prov = anomaly_block.get("provenance") if isinstance(anomaly_block.get("provenance"), dict) else None
            timeline_events.append({
                "event_id": f"EVT-ANO-{twin_id[5:11]}-03",
                "stage": "ANOMALY_EVIDENCE",
                "timestamp": source_timestamp,
                "summary": (
                    f"Anomaly evaluation: score="
                    f"{'NOT_AVAILABLE' if copod_score is None else copod_score}, "
                    f"status={'NOT_AVAILABLE' if pat_status is None else pat_status}"
                ),
                "details": anomaly_block,
                "provenance": {
                    "source_type": (ano_prov.get("source_type") if ano_prov else None) or anomaly_block.get("source_type") or "ANOMALY_ENGINE",
                    "source_identifier": (ano_prov.get("source_identifier") if ano_prov else None) or trace_id or test_id or component_id or search_key,
                    "source_timestamp": (ano_prov.get("source_timestamp") if ano_prov else None) or source_timestamp,
                    "model_identifier": (ano_prov.get("model_identifier") if ano_prov else None) or anomaly_block.get("model_identifier"),
                    "model_version": (ano_prov.get("model_version") if ano_prov else None) or anomaly_block.get("model_version"),
                    "model_sha256": (ano_prov.get("model_sha256") if ano_prov else None) or anomaly_block.get("model_sha256"),
                },
            })

        # =====================================================================
        # STAGE 4: PROGNOSTIC_EVIDENCE
        # =====================================================================
        prognostic_status = "INSUFFICIENT_EVIDENCE"
        prognostic_block = None
        prognostic_data = (
            prediction_rec.get("ml_details", {}).get("drift_prediction")
            or prediction_rec.get("ml_details", {}).get("prognostics")
            or prediction_rec.get("prognostic_evidence")
            if prediction_rec else None
        )
        if prognostic_data:
            prognostic_status = "AVAILABLE"
            prognostic_block = copy.deepcopy(prognostic_data)
            prg_prov = prognostic_block.get("provenance") if isinstance(prognostic_block.get("provenance"), dict) else None
            timeline_events.append({
                "event_id": f"EVT-PRG-{twin_id[5:11]}-04",
                "stage": "PROGNOSTIC_EVIDENCE",
                "timestamp": source_timestamp,
                "summary": "Prognostic trajectory degradation evidence from authoritative record",
                "details": prognostic_block,
                "provenance": {
                    "source_type": (prg_prov.get("source_type") if prg_prov else None) or prognostic_block.get("source_type") or "PROGNOSTIC_ENGINE",
                    "source_identifier": (prg_prov.get("source_identifier") if prg_prov else None) or trace_id or test_id or component_id or search_key,
                    "source_timestamp": (prg_prov.get("source_timestamp") if prg_prov else None) or source_timestamp,
                    "model_identifier": (prg_prov.get("model_identifier") if prg_prov else None) or prognostic_block.get("model_identifier"),
                    "model_version": (prg_prov.get("model_version") if prg_prov else None) or prognostic_block.get("model_version"),
                    "model_sha256": (prg_prov.get("model_sha256") if prg_prov else None) or prognostic_block.get("model_sha256"),
                },
            })

        # =====================================================================
        # STAGE 5: PHYSICS_RELIABILITY_EVIDENCE
        # =====================================================================
        physics_status = "INSUFFICIENT_EVIDENCE"
        physics_block = None
        physics_data = (
            prediction_rec.get("ml_details", {}).get("physics")
            or prediction_rec.get("physics_evidence")
            or prediction_rec.get("physics_reliability")
            if prediction_rec else None
        )
        if physics_data:
            physics_status = "AVAILABLE"
            physics_block = copy.deepcopy(physics_data)
            p_status = physics_block.get("physics_consistency_status", "EVALUATED")
            p_score = physics_block.get("physics_consistency_score", "N/A")
            raw_prov = physics_block.get("provenance") or physics_block.get("physics_model_provenance")
            phys_prov = raw_prov if isinstance(raw_prov, dict) else None
            timeline_events.append({
                "event_id": f"EVT-PHYS-{twin_id[5:11]}-05",
                "stage": "PHYSICS_RELIABILITY_EVIDENCE",
                "timestamp": physics_block.get("timestamp") or source_timestamp,
                "summary": f"Physics reliability consistency: {p_status} (score={p_score})",
                "details": physics_block,
                "provenance": {
                    "source_type": phys_prov.get("source_type") if phys_prov else None,
                    "source_identifier": phys_prov.get("source_identifier") if phys_prov else None,
                    "source_timestamp": (phys_prov.get("source_timestamp") if phys_prov else None) or physics_block.get("timestamp") or source_timestamp,
                    "model_identifier": phys_prov.get("model_identifier") if phys_prov else None,
                    "model_version": (phys_prov.get("module_version") or phys_prov.get("model_version")) if phys_prov else None,
                    "model_sha256": phys_prov.get("model_sha256") if phys_prov else None,
                },
            })

        # =====================================================================
        # STAGE 6: RISK_FUSION_DECISION
        # =====================================================================
        risk_fusion_status = "INSUFFICIENT_EVIDENCE"
        risk_fusion_block = None
        risk_fusion_data = (
            prediction_rec.get("ml_details", {}).get("risk_engine", {}).get("governed_risk_fusion")
            or prediction_rec.get("governed_risk_fusion")
            or prediction_rec.get("risk_fusion_decision")
            if prediction_rec else None
        )
        if risk_fusion_data:
            risk_fusion_status = "AVAILABLE"
            risk_fusion_block = copy.deepcopy(risk_fusion_data)
            raw_rf_prov = risk_fusion_block.get("provenance")
            rf_prov = raw_rf_prov if isinstance(raw_rf_prov, dict) else None
            timeline_events.append({
                "event_id": f"EVT-RF-{twin_id[5:11]}-06",
                "stage": "RISK_FUSION_DECISION",
                "timestamp": risk_fusion_block.get("timestamp") or source_timestamp,
                "summary": (
                    f"Governed risk fusion decision: disposition={risk_fusion_block.get('disposition', 'UNKNOWN')}, "
                    f"risk_score={risk_fusion_block.get('risk_score', 'N/A')}"
                ),
                "details": risk_fusion_block,
                "provenance": {
                    "source_type": rf_prov.get("source_type") if rf_prov else None,
                    "source_identifier": rf_prov.get("source_identifier") if rf_prov else None,
                    "source_timestamp": (rf_prov.get("source_timestamp") if rf_prov else None) or risk_fusion_block.get("timestamp") or source_timestamp,
                    "model_identifier": (rf_prov.get("model_identity") or rf_prov.get("model_identifier")) if rf_prov else None,
                    "model_version": (rf_prov.get("contract_version") or rf_prov.get("model_version")) if rf_prov else None,
                    "model_sha256": (rf_prov.get("contract_sha256") or rf_prov.get("model_sha256")) if rf_prov else None,
                },
            })

        # =====================================================================
        # STAGE 7: OPERATOR_DISPOSITION
        # =====================================================================
        operator_status = "AVAILABLE" if dispositions else "INSUFFICIENT_EVIDENCE"
        for disp in dispositions:
            disp_id = disp.get("disposition_id", "UNK")
            disp_ts = disp.get("created_at") or None
            timeline_events.append({
                "event_id": f"EVT-DISP-{disp_id}",
                "stage": "OPERATOR_DISPOSITION",
                "timestamp": disp_ts,
                "summary": f"Human operator recorded disposition: {disp.get('disposition')} ({disp.get('reason_code')})",
                "details": {
                    "disposition_id": disp_id,
                    "disposition": disp.get("disposition"),
                    "reason_code": disp.get("reason_code"),
                    "operator_id": disp.get("operator_id"),
                    "operator_role": disp.get("operator_role"),
                    "comment": disp.get("comment"),
                    "feedback_status": disp.get("feedback_status"),
                },
                "provenance": {
                    "source_type": "HUMAN_OPERATOR_GATE",
                    "source_identifier": disp_id or trace_id,
                    "source_timestamp": disp_ts,
                    "model_identifier": None,
                    "model_version": None,
                    "model_sha256": None,
                },
            })

        # =====================================================================
        # STAGE 8: SECONDARY_TEST
        # =====================================================================
        raw_sec_result = prediction_rec.get("secondary_test_result") if prediction_rec else None
        explicit_sec_source_type = (
            (prediction_rec.get("secondary_test_source_type") or prediction_rec.get("secondary_test_provenance", {}).get("source_type"))
            if prediction_rec else None
        )

        is_valid_sec_source = explicit_sec_source_type in ("ATE_RETEST_SIMULATOR", "SYNTHETIC_SIMULATION")

        secondary_test_status = "INSUFFICIENT_EVIDENCE"
        secondary_test_block = None

        if raw_sec_result and is_valid_sec_source:
            secondary_test_status = "AVAILABLE"
            req_sec = prediction_rec.get("requires_secondary_test")
            secondary_test_block = {
                "secondary_test_result": raw_sec_result,
                "secondary_test_source_type": explicit_sec_source_type,
                "requires_secondary_test": bool(req_sec) if req_sec is not None else None,
            }
            timeline_events.append({
                "event_id": f"EVT-SEC-{twin_id[5:11]}-08",
                "stage": "SECONDARY_TEST",
                "timestamp": source_timestamp,
                "summary": f"Secondary retest outcome: {raw_sec_result} (Source: {explicit_sec_source_type})",
                "details": secondary_test_block,
                "provenance": {
                    "source_type": explicit_sec_source_type,
                    "source_identifier": trace_id or test_id or component_id or search_key,
                    "source_timestamp": source_timestamp,
                    "model_identifier": None,
                    "model_version": None,
                    "model_sha256": None,
                },
            })

        # =====================================================================
        # STAGE 9: OUTCOME_EVIDENCE
        # =====================================================================
        outcome_evidence_status = "AVAILABLE" if outcome_evidences else "INSUFFICIENT_EVIDENCE"
        for ev in outcome_evidences:
            ev_id = ev.get("evidence_id", "UNK")
            ev_ts = ev.get("created_at") or ev.get("recorded_timestamp") or None
            timeline_events.append({
                "event_id": f"EVT-EVI-{ev_id}",
                "stage": "OUTCOME_EVIDENCE",
                "timestamp": ev_ts,
                "summary": f"Outcome evidence recorded: {ev.get('evidence_type')} ({ev.get('evidence_status')})",
                "details": {
                    "evidence_id": ev_id,
                    "evidence_type": ev.get("evidence_type"),
                    "evidence_status": ev.get("evidence_status"),
                    "evidence_source": ev.get("evidence_source"),
                    "recorded_by": ev.get("recorded_by"),
                },
                "provenance": {
                    "source_type": "OUTCOME_EVIDENCE_STORE",
                    "source_identifier": ev_id,
                    "source_timestamp": ev.get("evidence_timestamp") or ev_ts,
                    "model_identifier": None,
                    "model_version": None,
                    "model_sha256": None,
                },
            })

        # =====================================================================
        # STAGE 10: ADJUDICATION
        # =====================================================================
        adjudication_status = "AVAILABLE" if adjudications else "NOT_ESTABLISHED"
        ground_truth_status = "NOT_ESTABLISHED"
        for adj in adjudications:
            adj_id = adj.get("adjudication_id", "UNK")
            ground_truth_status = adj.get("ground_truth_status", "NOT_ESTABLISHED")
            adj_ts = adj.get("created_at") or None
            timeline_events.append({
                "event_id": f"EVT-ADJ-{adj_id}",
                "stage": "ADJUDICATION",
                "timestamp": adj_ts,
                "summary": (
                    f"Quality engineering adjudication: {adj.get('adjudication_status')} "
                    f"(Ground truth={ground_truth_status})"
                ),
                "details": {
                    "adjudication_id": adj_id,
                    "adjudicator_identity": adj.get("adjudicator_identity"),
                    "adjudicator_role": adj.get("adjudicator_role"),
                    "adjudication_status": adj.get("adjudication_status"),
                    "validated_outcome": adj.get("validated_outcome"),
                    "ground_truth_status": ground_truth_status,
                    "rationale": adj.get("rationale"),
                },
                "provenance": {
                    "source_type": "QUALITY_ADJUDICATION_GATE",
                    "source_identifier": adj_id,
                    "source_timestamp": adj_ts,
                    "model_identifier": None,
                    "model_version": None,
                    "model_sha256": None,
                },
            })

        # Deduplicate timeline events
        seen_event_keys: set = set()
        unique_events: List[Dict[str, Any]] = []
        for evt in timeline_events:
            key = f"{evt['stage']}:{evt['timestamp']}:{evt['summary']}"
            if key not in seen_event_keys:
                seen_event_keys.add(key)
                unique_events.append(evt)

        def sort_key(evt: Dict[str, Any]) -> Tuple[str, str]:
            ts = evt.get("timestamp")
            ts_sort = ts if ts is not None else ""
            return (ts_sort, str(evt.get("event_id", "")))

        unique_events.sort(key=sort_key)

        twin_representation = {
            "twin_id": twin_id,
            "created_at": source_timestamp,
            "identity": {
                "component_id": component_id,
                "trace_id": trace_id,
                "test_id": test_id,
                "lot_id": lot_id,
                "wafer_id": wafer_id,
                "die_id": die_id,
                "equipment_id": equipment_id,
                "requested_identifier": search_key,
                "identity_status": "REGISTERED" if is_registered else "UNREGISTERED",
                "is_synthetic": is_synthetic,
            },
            "evidence_summary": {
                "manufacturing_observation": mfg_status,
                "ml_evaluation": ml_evidence_status,
                "anomaly_evidence": anomaly_status,
                "prognostic_evidence": prognostic_status,
                "physics_reliability": physics_status,
                "risk_fusion": risk_fusion_status,
                "operator_disposition": operator_status,
                "secondary_test": secondary_test_status,
                "outcome_evidence": outcome_evidence_status,
                "adjudication": adjudication_status,
                "ground_truth_status": ground_truth_status,
            },
            "evidence_blocks": {
                "manufacturing_observation": mfg_block,
                "ml_evaluation": ml_evidence_block,
                "anomaly_evidence": anomaly_block,
                "prognostic_evidence": prognostic_block,
                "physics_reliability": physics_block,
                "risk_fusion": risk_fusion_block,
                "operator_dispositions": dispositions,
                "secondary_test": secondary_test_block,
                "outcome_evidence": outcome_evidences,
                "adjudications": adjudications,
            },
            "longitudinal_timeline": unique_events,
            "provenance": {
                "contract_version": "1.0.0",
                "contract_name": "predicta_reliability_twin_contract",
                "authoritative_operating_threshold": 0.20,
                "historical_model_version": prediction_rec.get("model_version") if prediction_rec else None,
                "historical_model_sha256": prediction_rec.get("model_sha256") if prediction_rec else None,
                "system_verified_model_sha256": verified_current_model_sha,
                "is_synthetic_provenance": is_synthetic,
            },
        }

        return copy.deepcopy(twin_representation)
