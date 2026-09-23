"""
Authoritative Digital Reliability Twin Data Model & Lineage Service (Python)
File: src/reliability_twin/reliability_twin.py

Aggregates existing prediction, telemetry, anomaly, prognostic, physics,
operator disposition, outcome evidence, and adjudication records into an
immutable, longitudinal Digital Reliability Twin read model.
"""

import os
import json
import hashlib
import copy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TWIN_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "reliability_twin", "reliability_twin_contract.json")
PROD_MANIFEST_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_production_manifest.json")
MODEL_JSON_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")

from src.api.inference_service import PredictaInferenceService
from src.governance.disposition import (
    HumanDispositionManager as HumanDispositionManagerPy,
    _AUTHORITATIVE_PREDICTION_STORE,
    _FEEDBACK_STORE,
    _EVIDENCE_STORE,
    _ADJUDICATION_STORE
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
            model_path=model_path
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
            raise ValueError(f"MODEL_PROVENANCE_INVALID: Computed SHA {actual_sha} does not match expected {self.expected_model_sha}")
        return actual_sha

    def _is_synthetic_record(self, rec: Optional[Dict[str, Any]]) -> bool:
        if not rec or not isinstance(rec, dict):
            return False
        if rec.get("is_synthetic") is True:
            return True
        if rec.get("source_type") in ("SYNTHETIC_SIMULATION", "ATE_SIMULATION"):
            return True
        rec_str = json.dumps(rec)
        return "SYN-" in rec_str or "LOT-SYN" in rec_str or "SIMULATED" in rec_str

    def resolve_prediction_record(self, identifier: Any) -> Optional[Dict[str, Any]]:
        if identifier is None:
            return None

        target_id = identifier.strip() if isinstance(identifier, str) else None
        raw_record = identifier if isinstance(identifier, dict) else None

        if raw_record:
            target_id = raw_record.get("trace_id") or raw_record.get("test_id") or raw_record.get("component_id")

        if target_id and target_id in _AUTHORITATIVE_PREDICTION_STORE:
            return copy.deepcopy(_AUTHORITATIVE_PREDICTION_STORE[target_id])

        # Also scan store values for component_id match
        if target_id:
            for val in _AUTHORITATIVE_PREDICTION_STORE.values():
                if val.get("component_id") == target_id:
                    return copy.deepcopy(val)

        if raw_record and ("supply_voltage" in raw_record or "equipment_id" in raw_record or "voltage" in raw_record):
            try:
                svc = PredictaInferenceService()
                pred = svc.predict_single(raw_record)
                return pred
            except Exception:
                pass

        return None

    def build_reliability_twin(self, identifier: Any, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if identifier is None:
            raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.")

        search_key = ""
        if isinstance(identifier, str):
            search_key = identifier.strip()
            if not search_key:
                raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.")
        elif isinstance(identifier, dict):
            search_key = identifier.get("trace_id") or identifier.get("component_id") or identifier.get("test_id") or "RECORD_INPUT"
        else:
            raise ValueError("INVALID_IDENTIFIER: Reliability twin identifier must be a string or record object.")

        model_sha = self.verify_model_provenance()
        prediction_rec = self.resolve_prediction_record(identifier)

        trace_id = (
            (prediction_rec.get("trace_id") if prediction_rec else None)
            or (identifier.get("trace_id") if isinstance(identifier, dict) else None)
            or (search_key if search_key.startswith("TR-") else None)
        )
        test_id = (
            (prediction_rec.get("test_id") if prediction_rec else None)
            or (identifier.get("test_id") if isinstance(identifier, dict) else None)
            or (search_key if search_key.startswith("TST-") else None)
        )
        component_id = (
            (prediction_rec.get("component_id") if prediction_rec else None)
            or (identifier.get("component_id") if isinstance(identifier, dict) else None)
            or (search_key if search_key.startswith("CMP-") else search_key)
        )

        lot_id = (
            (prediction_rec.get("lot_id") if prediction_rec else None)
            or (identifier.get("lot_id") if isinstance(identifier, dict) else None)
            or (f"LOT-{component_id.replace('CMP-', '')}" if component_id else "UNKNOWN_LOT")
        )
        wafer_id = (
            (prediction_rec.get("wafer_id") if prediction_rec else None)
            or (identifier.get("wafer_id") if isinstance(identifier, dict) else None)
            or (f"{lot_id}-W01" if lot_id else "UNKNOWN_WAFER")
        )
        die_id = (
            (prediction_rec.get("die_id") if prediction_rec else None)
            or (identifier.get("die_id") if isinstance(identifier, dict) else None)
            or (f"DIE-{component_id.replace('CMP-', '')}" if component_id else "UNKNOWN_DIE")
        )
        equipment_id = (
            (prediction_rec.get("equipment_id") if prediction_rec else None)
            or (identifier.get("equipment_id") if isinstance(identifier, dict) else None)
            or "EQP-101"
        )

        twin_hash = hashlib.sha256(f"{component_id}:{trace_id}:{test_id}".encode("utf-8")).hexdigest()[:12].upper()
        twin_id = f"TWIN-{twin_hash}"

        created_at_iso = (
            (prediction_rec.get("created_at") if prediction_rec else None)
            or (identifier.get("created_at") if isinstance(identifier, dict) else None)
            or datetime.now(timezone.utc).isoformat()
        )

        is_synthetic = (
            self._is_synthetic_record(prediction_rec)
            or self._is_synthetic_record(identifier)
            or "SYN" in str(lot_id)
            or "SYN" in str(component_id)
        )

        dispositions = []
        outcome_evidences = []
        adjudications = []

        if trace_id and self.disposition_manager:
            try:
                disp_record = self.disposition_manager.get_disposition(trace_id)
                dispositions = disp_record.get("history", []) if disp_record else []
                outcome_evidences = self.disposition_manager.get_outcome_evidence(trace_id)
                adj = self.disposition_manager.get_adjudication(trace_id)
                if adj:
                    adjudications.append(adj)
            except Exception:
                pass

        timeline_events: List[Dict[str, Any]] = []

        timeline_events.append({
            "event_id": f"EVT-OBS-{twin_id[5:11]}-01",
            "stage": "MANUFACTURING_OBSERVATION",
            "timestamp": created_at_iso,
            "summary": "Telemetry observation recorded at automated test equipment (ATE)",
            "details": {
                "equipment_id": equipment_id,
                "lot_id": lot_id,
                "wafer_id": wafer_id,
                "die_id": die_id,
                "component_id": component_id,
                "is_synthetic": is_synthetic,
            },
            "provenance": {
                "source_type": "SYNTHETIC_SIMULATION" if is_synthetic else "ATE_TELEMETRY",
                "source_identifier": search_key,
                "source_timestamp": created_at_iso,
                "model_identifier": "N/A",
                "model_version": "N/A",
                "model_sha256": "N/A",
            }
        })

        ml_evidence_status = "INSUFFICIENT_EVIDENCE"
        ml_evidence_block = None

        if prediction_rec:
            ml_evidence_status = "AVAILABLE"
            ml_evidence_block = {
                "prediction": prediction_rec.get("prediction"),
                "probability": prediction_rec.get("probability"),
                "threshold": prediction_rec.get("threshold", 0.20),
                "risk_level": prediction_rec.get("risk_level", "LOW"),
                "operational_decision": prediction_rec.get("operational_decision", "PASS"),
                "decision_class": prediction_rec.get("decision_class", "LOW_RISK"),
                "requires_secondary_test": bool(prediction_rec.get("requires_secondary_test")),
                "decision_reason": prediction_rec.get("decision_reason"),
                "model_version": prediction_rec.get("model_version", "4.0.0_authoritative"),
                "model_sha256": model_sha,
                "provenance": {
                    "source_type": "PRODUCTION_ML_MODEL",
                    "source_identifier": trace_id or test_id or component_id,
                    "source_timestamp": created_at_iso,
                    "model_identifier": "predicta_xgboost_model",
                    "model_version": prediction_rec.get("model_version", "4.0.0_authoritative"),
                    "model_sha256": model_sha,
                }
            }

            timeline_events.append({
                "event_id": f"EVT-ML-{twin_id[5:11]}-02",
                "stage": "ML_EVALUATION",
                "timestamp": created_at_iso,
                "summary": f"Authoritative model prediction: {prediction_rec.get('prediction')} (P={float(prediction_rec.get('probability', 0.0)):.4f}, Risk={prediction_rec.get('risk_level')})",
                "details": copy.deepcopy(ml_evidence_block),
                "provenance": copy.deepcopy(ml_evidence_block["provenance"]),
            })

        anomaly_status = "INSUFFICIENT_EVIDENCE"
        anomaly_block = None
        if prediction_rec and prediction_rec.get("ml_details", {}).get("anomaly"):
            anomaly_status = "AVAILABLE"
            anomaly_block = copy.deepcopy(prediction_rec["ml_details"]["anomaly"])
            timeline_events.append({
                "event_id": f"EVT-ANO-{twin_id[5:11]}-03",
                "stage": "ANOMALY_EVIDENCE",
                "timestamp": created_at_iso,
                "summary": f"Anomaly evaluation score={anomaly_block.get('copod_score', 'N/A')}, status={anomaly_block.get('pat_status', 'PASS')}",
                "details": anomaly_block,
                "provenance": {
                    "source_type": "ANOMALY_ENGINE",
                    "source_identifier": trace_id or test_id,
                    "source_timestamp": created_at_iso,
                    "model_identifier": "predicta_anomaly_artifacts",
                    "model_version": "1.0.0",
                    "model_sha256": model_sha,
                }
            })

        prognostic_status = "INSUFFICIENT_EVIDENCE"
        prognostic_block = None
        if prediction_rec and prediction_rec.get("ml_details", {}).get("prognostics"):
            prognostic_status = "AVAILABLE"
            prognostic_block = copy.deepcopy(prediction_rec["ml_details"]["prognostics"])
            timeline_events.append({
                "event_id": f"EVT-PRG-{twin_id[5:11]}-04",
                "stage": "PROGNOSTIC_EVIDENCE",
                "timestamp": created_at_iso,
                "summary": "168h Prognostic trajectory degradation forecast",
                "details": prognostic_block,
                "provenance": {
                    "source_type": "PROGNOSTIC_ENGINE",
                    "source_identifier": trace_id or test_id,
                    "source_timestamp": created_at_iso,
                    "model_identifier": "predicta_gpr_kernel_artifacts",
                    "model_version": "1.0.0",
                    "model_sha256": model_sha,
                }
            })

        operator_status = "AVAILABLE" if dispositions else "INSUFFICIENT_EVIDENCE"
        for idx, disp in enumerate(dispositions):
            disp_id = disp.get("disposition_id", str(idx))
            disp_ts = disp.get("created_at") or created_at_iso
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
                    "source_identifier": disp_id,
                    "source_timestamp": disp_ts,
                    "model_identifier": "N/A",
                    "model_version": "N/A",
                    "model_sha256": "N/A",
                }
            })

        secondary_test_status = (
            "AVAILABLE"
            if (prediction_rec and (prediction_rec.get("secondary_test_result") or prediction_rec.get("requires_secondary_test")))
            else "INSUFFICIENT_EVIDENCE"
        )
        if prediction_rec and prediction_rec.get("secondary_test_result"):
            timeline_events.append({
                "event_id": f"EVT-SEC-{twin_id[5:11]}-05",
                "stage": "SECONDARY_TEST",
                "timestamp": created_at_iso,
                "summary": f"Secondary ATE retest outcome: {prediction_rec.get('secondary_test_result')}",
                "details": {
                    "secondary_test_result": prediction_rec.get("secondary_test_result"),
                    "requires_secondary_test": prediction_rec.get("requires_secondary_test"),
                },
                "provenance": {
                    "source_type": "ATE_RETEST_SIMULATOR",
                    "source_identifier": trace_id or test_id,
                    "source_timestamp": created_at_iso,
                    "model_identifier": "N/A",
                    "model_version": "N/A",
                    "model_sha256": "N/A",
                }
            })

        outcome_evidence_status = "AVAILABLE" if outcome_evidences else "INSUFFICIENT_EVIDENCE"
        for idx, ev in enumerate(outcome_evidences):
            ev_id = ev.get("evidence_id", str(idx))
            ev_ts = ev.get("created_at") or ev.get("recorded_timestamp") or created_at_iso
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
                    "source_timestamp": ev.get("evidence_timestamp") or created_at_iso,
                    "model_identifier": "N/A",
                    "model_version": "N/A",
                    "model_sha256": "N/A",
                }
            })

        adjudication_status = "AVAILABLE" if adjudications else "NOT_ESTABLISHED"
        ground_truth_status = "NOT_ESTABLISHED"
        for idx, adj in enumerate(adjudications):
            adj_id = adj.get("adjudication_id", str(idx))
            ground_truth_status = adj.get("ground_truth_status", "NOT_ESTABLISHED")
            adj_ts = adj.get("created_at") or created_at_iso
            timeline_events.append({
                "event_id": f"EVT-ADJ-{adj_id}",
                "stage": "ADJUDICATION",
                "timestamp": adj_ts,
                "summary": f"Quality engineering adjudication: {adj.get('adjudication_status')} (Ground truth={ground_truth_status})",
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
                    "model_identifier": "N/A",
                    "model_version": "N/A",
                    "model_sha256": "N/A",
                }
            })

        # Deduplicate timeline events
        seen_event_keys = set()
        unique_events = []
        for evt in timeline_events:
            key = f"{evt['stage']}:{evt['timestamp']}:{evt['summary']}"
            if key not in seen_event_keys:
                seen_event_keys.add(key)
                unique_events.append(evt)

        def sort_key(evt: Dict[str, Any]) -> Tuple[str, str]:
            return (str(evt.get("timestamp", "")), str(evt.get("event_id", "")))

        unique_events.sort(key=sort_key)

        twin_representation = {
            "twin_id": twin_id,
            "created_at": created_at_iso,
            "identity": {
                "component_id": component_id,
                "trace_id": trace_id or "UNASSIGNED",
                "test_id": test_id or "UNASSIGNED",
                "lot_id": lot_id,
                "wafer_id": wafer_id,
                "die_id": die_id,
                "equipment_id": equipment_id,
                "is_synthetic": is_synthetic,
            },
            "evidence_summary": {
                "ml_evaluation": ml_evidence_status,
                "anomaly_evidence": anomaly_status,
                "prognostic_evidence": prognostic_status,
                "operator_disposition": operator_status,
                "secondary_test": secondary_test_status,
                "outcome_evidence": outcome_evidence_status,
                "adjudication": adjudication_status,
                "ground_truth_status": ground_truth_status,
            },
            "evidence_blocks": {
                "ml_evaluation": ml_evidence_block,
                "anomaly_evidence": anomaly_block,
                "prognostic_evidence": prognostic_block,
                "operator_dispositions": dispositions,
                "outcome_evidence": outcome_evidences,
                "adjudications": adjudications,
            },
            "longitudinal_timeline": unique_events,
            "provenance": {
                "contract_version": "1.0.0",
                "contract_name": "predicta_reliability_twin_contract",
                "authoritative_threshold": 0.20,
                "model_identifier": "predicta_xgboost_model",
                "model_version": "4.0.0_authoritative",
                "model_sha256": model_sha,
                "is_synthetic_provenance": is_synthetic,
            },
        }

        return copy.deepcopy(twin_representation)
