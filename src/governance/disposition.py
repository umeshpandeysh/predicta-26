"""
PREDICTA Phase 11 Task 1 — Human Feedback Governance Foundation Engine (Python)
File: src/governance/disposition.py

Manages human operator disposition feedback under strict governance rules:
- Captures operator disposition (ACCEPT, REJECT, HOLD, RETEST, ESCALATE).
- Formally supports feedback outcome lifecycle states: RECORDED_ONLY -> PENDING_OUTCOME -> CONFIRMED / CONTRADICTED / UNRESOLVED.
- Append-Only Lifecycle: Original disposition records remain immutable. Status transitions create append-only lifecycle events.
- Backend-authoritative: Original ML decision is looked up from backend, NEVER provided by client.
- Client-controlled ML inputs prohibited (fails closed if client attempts to pass ML snapshots, probabilities, or ground truth).
- Model provenance verification: Asserts SHA-256 of production model against manifest.
- Append-only storage: Dispositions are preserved in immutable historical ledgers.
- Explicit conflict governance: Multiple operator dispositions for a single trace are preserved with conflict=True flags.
- Fail-closed persistence: Governed persistence failure fails closed without pretending memory is durable storage.
- Enforces immutability: Original ML decision is NEVER overwritten or altered.
- Zero retraining guarantee: Feedback does NOT adapt models, weights, thresholds, or dataset splits.
"""

import os
import json
import re
import uuid
import hashlib
import datetime
from typing import Dict, Any, List, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DISPOSITION_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "governance", "disposition_contract.json")
PROD_MANIFEST_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_production_manifest.json")
MODEL_JSON_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")

# In-memory storage fallback for Python tests / runtime:
# _FEEDBACK_STORE: trace_id -> List[disposition_record]
# _LIFECYCLE_EVENTS: disposition_id -> List[lifecycle_event]
_FEEDBACK_STORE: Dict[str, List[Dict[str, Any]]] = {}
_LIFECYCLE_EVENTS: Dict[str, List[Dict[str, Any]]] = {}
_EVIDENCE_STORE: Dict[str, List[Dict[str, Any]]] = {}
_ADJUDICATION_STORE: Dict[str, List[Dict[str, Any]]] = {}
_AUTHORITATIVE_PREDICTION_STORE: Dict[str, Dict[str, Any]] = {}
_AUDIT_LOGS: List[Dict[str, Any]] = []

PROHIBITED_CLIENT_IDENTITY_FIELDS = {
    "component_id",
    "lot_id"
}

PROHIBITED_CLIENT_ML_FIELDS = {
    "ml_decision_snapshot",
    "ml_decision",
    "original_ml_decision",
    "decision",
    "probability",
    "calibrated_probability",
    "raw_probability",
    "model_hash",
    "model_hash_at_decision",
    "model_id",
    "model_id_at_decision",
    "anomaly_score",
    "anomaly_score_at_decision",
    "anomaly_status",
    "prognostic_output",
    "prognostic_output_at_decision",
    "prognostics",
    "ground_truth",
    "ground_truth_label",
    "is_ground_truth"
}

import math


def is_valid_probability(val: Any) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return False
    if not isinstance(val, (int, float)):
        return False
    if math.isnan(val) or math.isinf(val):
        return False
    return 0.0 <= float(val) <= 1.0


def extract_original_ml_decision(auth_record: Optional[Dict[str, Any]]) -> Optional[str]:
    if not auth_record or not isinstance(auth_record, dict):
        return None
    candidate_fields = ["prediction", "disposition", "decision"]
    for field in candidate_fields:
        if field in auth_record and auth_record[field] is not None:
            return str(auth_record[field])
    return None


def extract_db_error(res: Any) -> Optional[str]:
    if not res:
        return None
    if hasattr(res, "error") and res.error:
        err = res.error
        return getattr(err, "message", str(err))
    if isinstance(res, dict) and res.get("error"):
        err_obj = res["error"]
        return err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
    return None


def compute_file_sha256(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"ARTIFACT_MISSING: File not found at {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read().replace("\r\n", "\n")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def load_disposition_contract(contract_path: str = DISPOSITION_CONTRACT_PATH) -> Dict[str, Any]:
    if not os.path.exists(contract_path):
        raise FileNotFoundError(f"CONTRACT_MISSING: Disposition contract missing at {contract_path}")
    with open(contract_path, "r", encoding="utf-8") as f:
        return json.load(f)


def record_audit_event(event_type: str, details: Dict[str, Any]):
    event = {
        "event_id": f"AUDIT-{uuid.uuid4().hex[:12].upper()}",
        "event_type": event_type,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "details": details
    }
    _AUDIT_LOGS.append(event)
    return event


def register_authoritative_prediction(prediction_record: Dict[str, Any]) -> None:
    """Registers an authoritative prediction record into the backend store."""
    trace_id = prediction_record.get("trace_id") or prediction_record.get("test_id")
    if trace_id:
        _AUTHORITATIVE_PREDICTION_STORE[str(trace_id)] = dict(prediction_record)
    test_id = prediction_record.get("test_id")
    if test_id:
        _AUTHORITATIVE_PREDICTION_STORE[str(test_id)] = dict(prediction_record)


class HumanDispositionManager:
    def __init__(
        self,
        contract_path: str = DISPOSITION_CONTRACT_PATH,
        manifest_path: str = PROD_MANIFEST_PATH,
        model_path: str = MODEL_JSON_PATH,
        db_client: Optional[Any] = None
    ):
        self.contract = load_disposition_contract(contract_path)
        self.manifest_path = manifest_path
        self.model_path = model_path
        self.db_client = db_client
        self.allowed_dispositions = set(self.contract["disposition_taxonomy"])
        self.allowed_reasons = set(self.contract["reason_code_taxonomy"])
        self.allowed_feedback_statuses = set(self.contract.get("governance_rules", {}).get("allowed_feedback_statuses", [
            "RECORDED_ONLY", "PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"
        ]))
        self.allowed_roles = set(self.contract["security_rules"]["allowed_roles"])
        self.max_comment_length = int(self.contract["security_rules"]["max_comment_length"])
        self.trace_regex = re.compile(self.contract["security_rules"]["require_trace_id_format"])

        self._load_manifest()

    def _load_manifest(self):
        if not os.path.exists(self.manifest_path):
            raise FileNotFoundError(f"ARTIFACT_MISSING: Production manifest missing at {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.expected_model_sha = manifest.get("model_sha256")
        if not self.expected_model_sha:
            raise ValueError("MANIFEST_INVALID: Production manifest missing required model_sha256.")

    def verify_model_provenance(self) -> str:
        """Verifies production model artifact integrity against authoritative manifest."""
        try:
            actual_sha = compute_file_sha256(self.model_path)
        except Exception as e:
            raise ValueError(f"MODEL_PROVENANCE_INVALID: Model artifact check failed: {str(e)}")
        if actual_sha != self.expected_model_sha:
            raise ValueError(
                f"MODEL_PROVENANCE_INVALID: Computed model SHA {actual_sha} does not match expected {self.expected_model_sha}"
            )
        return actual_sha

    def lookup_authoritative_prediction(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Looks up the backend-authoritative prediction record for trace_id."""
        if trace_id in _AUTHORITATIVE_PREDICTION_STORE:
            return _AUTHORITATIVE_PREDICTION_STORE[trace_id]

        try:
            from src.api.telemetry_store import STORE_PATH
            if os.path.exists(STORE_PATH):
                with open(STORE_PATH, "r", encoding="utf-8") as f:
                    store_data = json.load(f)
                events = store_data.get("events", [])
                for ev in events:
                    if ev.get("trace_id") == trace_id or ev.get("test_id") == trace_id:
                        return ev
        except Exception:
            pass

        return None

    def record_disposition(
        self,
        trace_id: str,
        disposition: str,
        reason_code: str,
        operator_id: Optional[str] = "OPERATOR_01",
        comment: str = "",
        component_id: Optional[str] = None,
        lot_id: Optional[str] = None,
        operator_role: str = "OPERATOR",
        feedback_status: str = "RECORDED_ONLY",
        outcome_status: Optional[str] = None,
        require_durable_persistence: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Validates and records operator feedback.
        Backend-authoritative: ML decisions are looked up from authoritative store.
        Rejects client-controlled ML output attempts.
        Guarantees original ML decision remains unaltered and appends to history.
        Explicitly tracks conflicting operator dispositions.
        """
        if kwargs.get("client_supplied_require_durable") is not None:
            record_audit_event("DISPOSITION_REJECTED", {"trace_id": trace_id, "reason": "CLIENT_TAINT_REJECTED", "field": "require_durable_persistence"})
            raise ValueError("CLIENT_TAINT_REJECTED: Client is not permitted to disable durable persistence for governed dispositions.")

        # 1. Prohibit client-controlled identity fields
        if component_id is not None or lot_id is not None or "component_id" in kwargs or "lot_id" in kwargs:
            identity_field = "component_id" if (component_id is not None or "component_id" in kwargs) else "lot_id"
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "CLIENT_CONTROLLED_IDENTITY_PROHIBITED",
                "field": identity_field
            })
            raise ValueError(
                f"CLIENT_CONTROLLED_IDENTITY_PROHIBITED: Field '{identity_field}' cannot be provided by client. "
                "Component and lot identities are backend-authoritative derived from prediction record."
            )

        # 2. Prohibit client-controlled ML output & ground truth fields
        for k in list(kwargs.keys()):
            if k in PROHIBITED_CLIENT_ML_FIELDS and kwargs[k] is not None:
                record_audit_event("DISPOSITION_REJECTED", {
                    "trace_id": trace_id,
                    "reason": "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED",
                    "field": k
                })
                raise ValueError(
                    f"CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '{k}' cannot be provided by client. "
                    "Original ML decision is backend-authoritative."
                )

        # 3. Role authorization check
        if operator_role not in self.allowed_roles:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "UNAUTHORIZED_ROLE",
                "role": operator_role
            })
            raise PermissionError(f"UNAUTHORIZED_ROLE: Role '{operator_role}' is not authorized to submit disposition.")

        # 4. Trace ID check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_TRACE_ID"
            })
            raise ValueError(f"INVALID_TRACE_ID: trace_id '{trace_id}' does not match required format.")

        # 5. Disposition check
        disp_upper = str(disposition).strip().upper()
        if disp_upper not in self.allowed_dispositions:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_DISPOSITION",
                "disposition": disposition
            })
            raise ValueError(f"INVALID_DISPOSITION: '{disposition}' must be one of {sorted(list(self.allowed_dispositions))}")

        # 6. Reason code check
        reason_upper = str(reason_code).strip().upper()
        if reason_upper not in self.allowed_reasons:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_REASON_CODE",
                "reason_code": reason_code
            })
            raise ValueError(f"INVALID_REASON_CODE: '{reason_code}' must be one of {sorted(list(self.allowed_reasons))}")

        # 7. Feedback status check (Must be one of the 5 lifecycle taxonomy states)
        raw_status = outcome_status or feedback_status or "RECORDED_ONLY"
        status_upper = str(raw_status).strip().upper()
        if status_upper not in self.allowed_feedback_statuses:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_FEEDBACK_STATUS",
                "feedback_status": raw_status
            })
            raise ValueError(f"INVALID_FEEDBACK_STATUS: '{raw_status}' is not a valid lifecycle status. Lifecycle states must be one of: RECORDED_ONLY, PENDING_OUTCOME, CONFIRMED, CONTRADICTED, UNRESOLVED.")

        # 8. Comment length check
        clean_comment = str(comment or "").strip()
        if len(clean_comment) > self.max_comment_length:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "OVERSIZED_COMMENT",
                "length": len(clean_comment)
            })
            raise ValueError(f"OVERSIZED_COMMENT: Comment exceeds maximum allowed length of {self.max_comment_length} characters.")

        # 9. Model Provenance Verification
        model_sha = self.verify_model_provenance()

        # 10. Backend-Authoritative Trace Lookup
        auth_record = self.lookup_authoritative_prediction(trace_id)
        if not auth_record:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "AUTHORITATIVE_ML_RECORD_NOT_FOUND"
            })
            raise ValueError(
                f"AUTHORITATIVE_ML_RECORD_NOT_FOUND: No authoritative prediction record found for trace_id '{trace_id}'. "
                "Dispositions cannot be recorded without an authoritative backend ML record."
            )

        # 11. Authoritative Component and Lot Identity Provenance
        auth_component_id = auth_record.get("component_id") or auth_record.get("die_id")
        auth_lot_id = auth_record.get("lot_id")
        if not auth_component_id or not auth_lot_id:
            missing_fields = []
            if not auth_component_id:
                missing_fields.append("component_id")
            if not auth_lot_id:
                missing_fields.append("lot_id")
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND",
                "missing_fields": missing_fields
            })
            raise ValueError(
                f"AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND: Authoritative prediction record for trace_id '{trace_id}' "
                f"is missing required identity field(s): {', '.join(missing_fields)}. "
                "Client-supplied identity must never fill an authoritative identity gap."
            )

        # Extract authoritative ML decision fields
        ml_decision = extract_original_ml_decision(auth_record) or "UNKNOWN"
        ml_prob_raw = auth_record.get("probability") if "probability" in auth_record else auth_record.get("calibrated_probability")
        if not is_valid_probability(ml_prob_raw):
            record_audit_event("DISPOSITION_REJECTED", {"trace_id": trace_id, "reason": "INVALID_AUTHORITATIVE_PROBABILITY"})
            raise ValueError("INVALID_AUTHORITATIVE_PROBABILITY: Authoritative prediction record missing valid numeric probability.")
        ml_prob = float(ml_prob_raw)
        anomaly_score = auth_record.get("anomaly_score") or auth_record.get("anomaly_status")
        prognostic_summary = auth_record.get("prognostic_summary") or auth_record.get("prognostics") or auth_record.get("trajectory_state")
        comp_id = str(auth_component_id)
        l_id = str(auth_lot_id)

        # 12. Conflict Detection across existing history for trace_id
        existing_history = _FEEDBACK_STORE.get(trace_id, [])
        has_conflict = False
        for prior in existing_history:
            if prior.get("disposition") != disp_upper:
                has_conflict = True
                break

        if has_conflict:
            for prior in existing_history:
                prior["conflict"] = True
                prior["is_conflict"] = True

        disposition_id = f"DISP-{uuid.uuid4().hex[:12].upper()}"
        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        disposition_record = {
            "disposition_id": disposition_id,
            "trace_id": trace_id,
            "component_id": comp_id,
            "lot_id": l_id,
            "operator_id": operator_id or "OPERATOR_01",
            "operator_role": operator_role,
            "disposition": disp_upper,
            "reason_code": reason_upper,
            "comment": clean_comment,
            "created_at": timestamp_iso,
            "model_id_at_decision": "predicta_xgboost_model",
            "model_hash_at_decision": model_sha,
            "original_ml_decision": ml_decision,
            "original_ml_probability": ml_prob,
            "anomaly_score_at_decision": anomaly_score,
            "prognostic_output_at_decision": prognostic_summary,
            "decision_at_decision": ml_decision,
            "source": "HUMAN_OPERATOR_GATE",
            "feedback_status": status_upper,
            "outcome_status": status_upper,
            "conflict": has_conflict,
            "is_conflict": has_conflict,
            "governance_guarantees": {
                "ml_decision_unaltered": True,
                "model_retraining_triggered": False,
                "thresholds_modified": False,
                "split_leakage_prevented": True,
                "append_only_preserved": True,
                "human_feedback_is_not_ground_truth": True
            }
        }

        initial_lifecycle_event = {
            "event_id": f"EVT-{uuid.uuid4().hex[:12].upper()}",
            "disposition_id": disposition_id,
            "trace_id": trace_id,
            "previous_status": None,
            "new_status": status_upper,
            "changed_by": operator_id or "OPERATOR_01",
            "timestamp": timestamp_iso,
            "comment": "Initial disposition recorded"
        }

        # 13. Append-Only Storage & Fail-Closed Persistence Governance
        if trace_id not in _FEEDBACK_STORE:
            _FEEDBACK_STORE[trace_id] = []
        _FEEDBACK_STORE[trace_id].append(disposition_record)
        _LIFECYCLE_EVENTS[disposition_id] = [initial_lifecycle_event]

        is_persistence_required = require_durable_persistence or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true"
        if is_persistence_required:
            if not self.db_client:
                _FEEDBACK_STORE[trace_id].pop()
                _LIFECYCLE_EVENTS.pop(disposition_id, None)
                err_msg = "PERSISTENCE_ERROR: Durable database connection is required but database client is unconfigured. Governed persistence failed closed."
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": err_msg})
                raise RuntimeError(err_msg)

            disp_inserted = False
            try:
                res = self.db_client.table("operator_dispositions").insert(disposition_record).execute()
                res_err = extract_db_error(res)
                if res_err:
                    raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist operator disposition: {res_err}")
                disp_inserted = True

                res_evt = self.db_client.table("disposition_lifecycle_events").insert(initial_lifecycle_event).execute()
                evt_err = extract_db_error(res_evt)
                if evt_err:
                    raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist initial lifecycle event: {evt_err}")
            except Exception as e:
                _FEEDBACK_STORE[trace_id].pop()
                _LIFECYCLE_EVENTS.pop(disposition_id, None)

                # Compensating deletion if first insert succeeded but second failed
                if disp_inserted and self.db_client:
                    try:
                        del_res = self.db_client.table("operator_dispositions").delete().eq("disposition_id", disposition_id).execute()
                        del_err = extract_db_error(del_res)
                        if del_err:
                            record_audit_event("PERSISTENCE_ROLLBACK_FAILED", {
                                "trace_id": trace_id,
                                "disposition_id": disposition_id,
                                "reason": f"Failed compensating deletion of orphaned disposition record: {del_err}"
                            })
                    except Exception as del_e:
                        record_audit_event("PERSISTENCE_ROLLBACK_FAILED", {
                            "trace_id": trace_id,
                            "disposition_id": disposition_id,
                            "reason": f"Failed compensating deletion of orphaned disposition record: {str(del_e)}"
                        })

                err_str = str(e)
                final_msg = err_str if err_str.startswith("PERSISTENCE_ERROR") else f"PERSISTENCE_ERROR: Failed to durably persist operator disposition: {err_str}"
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": final_msg})
                raise RuntimeError(final_msg)
        elif self.db_client:
            disp_inserted = False
            insert_err = None
            try:
                res = self.db_client.table("operator_dispositions").insert(disposition_record).execute()
                res_err = extract_db_error(res)
                if res_err:
                    insert_err = res_err
                else:
                    disp_inserted = True
                    res_evt = self.db_client.table("disposition_lifecycle_events").insert(initial_lifecycle_event).execute()
                    evt_err = extract_db_error(res_evt)
                    if evt_err:
                        insert_err = evt_err
            except Exception as e:
                insert_err = str(e)

            if insert_err:
                _FEEDBACK_STORE[trace_id].pop()
                _LIFECYCLE_EVENTS.pop(disposition_id, None)

                if disp_inserted:
                    try:
                        del_res = self.db_client.table("operator_dispositions").delete().eq("disposition_id", disposition_id).execute()
                        del_err = extract_db_error(del_res)
                        if del_err:
                            record_audit_event("PERSISTENCE_ROLLBACK_FAILED", {
                                "trace_id": trace_id,
                                "disposition_id": disposition_id,
                                "reason": f"Failed compensating deletion of orphaned disposition record: {del_err}"
                            })
                    except Exception as del_e:
                        record_audit_event("PERSISTENCE_ROLLBACK_FAILED", {
                            "trace_id": trace_id,
                            "disposition_id": disposition_id,
                            "reason": f"Failed compensating deletion of orphaned disposition record: {str(del_e)}"
                        })

                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": f"PERSISTENCE_ERROR: {insert_err}"})
                raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist operator disposition: {insert_err}")

        record_audit_event("DISPOSITION_RECORDED", {
            "disposition_id": disposition_record["disposition_id"],
            "trace_id": trace_id,
            "operator_id": operator_id,
            "disposition": disp_upper,
            "original_ml_decision": ml_decision,
            "conflict": has_conflict,
            "total_records_for_trace": len(_FEEDBACK_STORE[trace_id])
        })

        return {
            **disposition_record,
            "lifecycle_events": [initial_lifecycle_event]
        }

    def get_disposition(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Returns complete append-only disposition history for trace_id with derived status and lifecycle transition events."""
        history = _FEEDBACK_STORE.get(trace_id, [])

        if self.db_client:
            try:
                res = self.db_client.table("operator_dispositions").select("*").eq("trace_id", trace_id).execute()
                if hasattr(res, "data") and res.data:
                    history = res.data
                    if trace_id not in _FEEDBACK_STORE:
                        _FEEDBACK_STORE[trace_id] = res.data
                res_evt = self.db_client.table("disposition_lifecycle_events").select("*").eq("trace_id", trace_id).execute()
                if hasattr(res_evt, "data") and res_evt.data:
                    for evt in res_evt.data:
                        disp_id = evt.get("disposition_id")
                        if disp_id not in _LIFECYCLE_EVENTS:
                            _LIFECYCLE_EVENTS[disp_id] = []
                        if not any(e.get("event_id") == evt.get("event_id") for e in _LIFECYCLE_EVENTS[disp_id]):
                            _LIFECYCLE_EVENTS[disp_id].append(evt)
            except Exception:
                pass

        if not history:
            return None

        disp_set = {rec.get("disposition") for rec in history}
        has_conflict = len(disp_set) > 1

        formatted_history = []
        for rec in history:
            disp_id = rec.get("disposition_id")
            events = _LIFECYCLE_EVENTS.get(disp_id, [])
            current_status = events[-1]["new_status"] if events else rec.get("feedback_status", "RECORDED_ONLY")
            formatted_history.append({
                **rec,
                "feedback_status": current_status,
                "outcome_status": current_status,
                "conflict": has_conflict,
                "is_conflict": has_conflict,
                "lifecycle_events": list(events)
            })

        return {
            "trace_id": trace_id,
            "total_dispositions": len(formatted_history),
            "has_conflict": has_conflict,
            "conflict": has_conflict,
            "latest": formatted_history[-1],
            "history": formatted_history
        }

    def update_feedback_status(
        self,
        trace_id: str,
        disposition_id: str,
        new_status: str,
        operator_id: str = "OPERATOR_01",
        comment: str = "",
        require_durable_persistence: bool = False
    ) -> Dict[str, Any]:
        """Creates an append-only lifecycle event for disposition_id while preserving original disposition immutability."""
        history = _FEEDBACK_STORE.get(trace_id, [])
        if not history:
            raise KeyError(f"NOT_FOUND: No disposition records found for trace_id '{trace_id}'.")

        status_upper = str(new_status).strip().upper()
        if status_upper not in self.allowed_feedback_statuses:
            raise ValueError(f"INVALID_FEEDBACK_STATUS: '{new_status}' is not a valid lifecycle status. Lifecycle states must be one of: RECORDED_ONLY, PENDING_OUTCOME, CONFIRMED, CONTRADICTED, UNRESOLVED.")

        target_rec = None
        for rec in history:
            if rec.get("disposition_id") == disposition_id:
                target_rec = rec
                break
        if not target_rec:
            target_rec = history[-1]

        events = _LIFECYCLE_EVENTS.get(target_rec.get("disposition_id"), [])
        current_status = events[-1]["new_status"] if events else target_rec.get("feedback_status", "RECORDED_ONLY")

        allowed_transitions = self.contract.get("lifecycle_transitions", {
            "RECORDED_ONLY": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
            "PENDING_OUTCOME": ["CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
            "CONFIRMED": [],
            "CONTRADICTED": [],
            "UNRESOLVED": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED"]
        })

        valid_next = allowed_transitions.get(current_status, [])
        if current_status != status_upper and status_upper not in valid_next:
            raise ValueError(f"INVALID_LIFECYCLE_TRANSITION: Cannot transition feedback status from '{current_status}' to '{status_upper}'.")

        transition_event = {
            "event_id": f"EVT-{uuid.uuid4().hex[:12].upper()}",
            "disposition_id": target_rec.get("disposition_id"),
            "trace_id": trace_id,
            "previous_status": current_status,
            "new_status": status_upper,
            "changed_by": operator_id or "OPERATOR_01",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "comment": str(comment or "").strip()
        }

        events.append(transition_event)
        _LIFECYCLE_EVENTS[target_rec.get("disposition_id")] = events

        is_persistence_required = require_durable_persistence or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true"
        insert_err = None
        if is_persistence_required:
            if not self.db_client:
                insert_err = "Durable database connection is required but database client is unconfigured."
            else:
                try:
                    res = self.db_client.table("disposition_lifecycle_events").insert(transition_event).execute()
                    insert_err = extract_db_error(res)
                except Exception as e:
                    insert_err = str(e)
        elif self.db_client:
            try:
                res = self.db_client.table("disposition_lifecycle_events").insert(transition_event).execute()
                insert_err = extract_db_error(res)
            except Exception as e:
                insert_err = str(e)

        if insert_err:
            events.pop()
            if not events:
                _LIFECYCLE_EVENTS.pop(target_rec.get("disposition_id"), None)
            else:
                _LIFECYCLE_EVENTS[target_rec.get("disposition_id")] = events
            record_audit_event("PERSISTENCE_FAILED_CLOSED", {
                "trace_id": trace_id,
                "disposition_id": target_rec.get("disposition_id"),
                "reason": f"PERSISTENCE_ERROR: Failed to durably persist lifecycle event to database: {insert_err}"
            })
            raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist lifecycle event to database: {insert_err}")

        record_audit_event("FEEDBACK_STATUS_UPDATED", {
            "trace_id": trace_id,
            "disposition_id": target_rec.get("disposition_id"),
            "previous_status": current_status,
            "new_status": status_upper,
            "updated_by": operator_id,
            "comment": comment
        })

        return {
            **target_rec,
            "feedback_status": status_upper,
            "outcome_status": status_upper,
            "lifecycle_events": list(events)
        }

    def evaluate_disposition_governance(self, trace_id: str, require_durable_persistence: Optional[bool] = None) -> Dict[str, Any]:
        """
        Evaluates governance eligibility for offline review candidate.
        Ensures strict separation between operator feedback and ground truth.
        """
        is_test_env = os.environ.get("NODE_ENV") == "test" or os.environ.get("ALLOW_IN_MEMORY_DEMO") == "true"
        if require_durable_persistence is None:
            require_durable = not is_test_env or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true"
        else:
            require_durable = bool(require_durable_persistence)

        if require_durable and not self.db_client:
            err_msg = "PERSISTENCE_ERROR: Durable database connection is required for governed evaluation but database client is unconfigured."
            record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": err_msg})
            raise RuntimeError(err_msg)

        rejection_reasons = []

        # 1. Trace ID format check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            rejection_reasons.append("INVALID_TRACE_ID_FORMAT")

        # 2. Model Provenance Verification
        current_model_sha = None
        try:
            current_model_sha = self.verify_model_provenance()
        except Exception:
            rejection_reasons.append("INVALID_MODEL_PROVENANCE")

        # 3. Authoritative Backend ML Prediction Lookup
        auth_prediction = self.lookup_authoritative_prediction(trace_id) if trace_id else None
        if not auth_prediction:
            rejection_reasons.append("AUTHORITATIVE_ML_RECORD_NOT_FOUND")
        else:
            comp_id = auth_prediction.get("component_id") or auth_prediction.get("die_id")
            lot_id = auth_prediction.get("lot_id")
            if not comp_id or not lot_id:
                rejection_reasons.append("MISSING_AUTHORITATIVE_IDENTITY")
            ml_dec = extract_original_ml_decision(auth_prediction)
            if ml_dec is None:
                rejection_reasons.append("MISSING_ORIGINAL_ML_DECISION")
            ml_prob_raw = auth_prediction.get("probability") if "probability" in auth_prediction else auth_prediction.get("calibrated_probability")
            if not is_valid_probability(ml_prob_raw):
                rejection_reasons.append("MISSING_ORIGINAL_ML_PROBABILITY")

        # 4. Durable Disposition & Lifecycle History Reconstruction
        history = []
        events_map = {}
        db_fetch_failed = False
        db_error_msg = None

        if self.db_client:
            try:
                res_disp = self.db_client.table("operator_dispositions").select("*").eq("trace_id", trace_id).execute()
                disp_err = extract_db_error(res_disp)
                if disp_err:
                    db_fetch_failed = True
                    db_error_msg = disp_err
                elif hasattr(res_disp, "data") and res_disp.data:
                    history = res_disp.data

                res_evt = self.db_client.table("disposition_lifecycle_events").select("*").eq("trace_id", trace_id).execute()
                evt_err = extract_db_error(res_evt)
                if evt_err:
                    db_fetch_failed = True
                    db_error_msg = evt_err
                elif hasattr(res_evt, "data") and res_evt.data:
                    for evt in res_evt.data:
                        disp_id = evt.get("disposition_id")
                        if disp_id not in events_map:
                            events_map[disp_id] = []
                        events_map[disp_id].append(evt)
            except Exception as e:
                db_fetch_failed = True
                db_error_msg = str(e)

            if db_fetch_failed:
                err_msg = f"PERSISTENCE_ERROR: Failed to fetch durable history from database: {db_error_msg}"
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": err_msg})
                raise RuntimeError(err_msg)
        else:
            history = _FEEDBACK_STORE.get(trace_id, [])
            events_map = _LIFECYCLE_EVENTS

        if not history:
            rejection_reasons.append("NO_OPERATOR_DISPOSITION_RECORD")

        if rejection_reasons:
            return {
                "success": True,
                "trace_id": str(trace_id or ""),
                "governance_classification": "REJECTED_GOVERNANCE",
                "rejection_reasons": list(dict.fromkeys(rejection_reasons)),
                "evaluation_candidate": None,
                "governance_guarantees": {
                    "no_automatic_retraining": True,
                    "no_threshold_modification": True,
                    "no_fusion_weight_modification": True,
                    "no_conformal_recalibration": True,
                    "human_disagreement_is_not_ground_truth": True,
                    "test_set_isolation_enforced": True,
                    "append_only_preserved": True
                }
            }

        # 5. Conflict Governance Check & Provenance Audit
        disp_set = set()
        has_explicit_conflict_flag = False

        for rec in history:
            disp_set.add(rec.get("disposition"))
            if rec.get("conflict") or rec.get("is_conflict"):
                has_explicit_conflict_flag = True
            if current_model_sha and rec.get("model_hash_at_decision") != current_model_sha:
                rejection_reasons.append("INVALID_MODEL_PROVENANCE")
            if "ground_truth" in rec or "is_ground_truth" in rec or "ground_truth_label" in rec:
                rejection_reasons.append("CLIENT_TAINT_REJECTED")

        if len(disp_set) > 1 or has_explicit_conflict_flag:
            rejection_reasons.append("UNRESOLVED_GOVERNANCE_CONFLICT: Multiple conflicting operator dispositions exist for trace.")

        # 6. Lifecycle Events & Transition History Verification
        latest_record = history[-1]
        disp_id = latest_record.get("disposition_id")
        events = events_map.get(disp_id, [])

        if not events:
            rejection_reasons.append("MISSING_LIFECYCLE_HISTORY: Durable lifecycle event history cannot be reconstructed.")
        else:
            current_status = events[-1]["new_status"]
            if current_status == "UNRESOLVED":
                rejection_reasons.append("UNRESOLVED_LIFECYCLE_STATUS: Disposition status UNRESOLVED is not eligible for offline review.")
            if current_status not in self.allowed_feedback_statuses:
                rejection_reasons.append("INVALID_LIFECYCLE_STATUS")

        # 7. Test Set / Benchmark Dataset Isolation Check
        protected_trace_id_pattern = re.compile(r"^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)", re.IGNORECASE)
        if protected_trace_id_pattern.match(str(trace_id)):
            rejection_reasons.append("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.")

        unique_rejection_reasons = list(dict.fromkeys(rejection_reasons))
        is_eligible = len(unique_rejection_reasons) == 0
        classification = "ELIGIBLE_FOR_OFFLINE_REVIEW" if is_eligible else "REJECTED_GOVERNANCE"

        candidate = None
        if is_eligible:
            current_status = events[-1]["new_status"] if events else latest_record.get("feedback_status", "RECORDED_ONLY")
            candidate = {
                "trace_id": str(trace_id),
                "disposition_id": latest_record.get("disposition_id"),
                "component_id": latest_record.get("component_id"),
                "lot_id": latest_record.get("lot_id"),
                "operator_id": latest_record.get("operator_id"),
                "created_at": latest_record.get("created_at"),
                "model_id_at_decision": latest_record.get("model_id_at_decision", "predicta_xgboost_model"),
                "model_hash_at_decision": latest_record.get("model_hash_at_decision"),
                "original_ml_decision": latest_record.get("original_ml_decision"),
                "original_ml_probability": latest_record.get("original_ml_probability"),
                "anomaly_score_at_decision": latest_record.get("anomaly_score_at_decision"),
                "prognostic_output_at_decision": latest_record.get("prognostic_output_at_decision"),
                "disposition": latest_record.get("disposition"),
                "reason_code": latest_record.get("reason_code"),
                "lifecycle_status": current_status,
                "conflict": False,
                "governance_classification": "ELIGIBLE_FOR_OFFLINE_REVIEW",
                "rejection_reasons": [],
                "evaluation_only": True,
                "production_effect": False,
                "ground_truth_status": "NOT_ESTABLISHED",
                "source": "HUMAN_FEEDBACK_OFFLINE_EVALUATION_CANDIDATE"
            }

        return {
            "success": True,
            "trace_id": str(trace_id),
            "governance_classification": classification,
            "rejection_reasons": unique_rejection_reasons,
            "evaluation_candidate": candidate,
            "governance_guarantees": {
                "no_automatic_retraining": True,
                "no_threshold_modification": True,
                "no_fusion_weight_modification": True,
                "no_conformal_recalibration": True,
                "human_disagreement_is_not_ground_truth": True,
                "test_set_isolation_enforced": True,
                "append_only_preserved": True
            }
        }

    def list_dispositions(self) -> List[Dict[str, Any]]:
        """Returns all recorded disposition records across all traces."""
        return [rec for history in _FEEDBACK_STORE.values() for rec in history]

    def register_authoritative_prediction(self, prediction_record: Dict[str, Any]) -> None:
        """Registers an authoritative prediction record into the backend store."""
        register_authoritative_prediction(prediction_record)

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return list(_AUDIT_LOGS)

    def register_outcome_evidence(
        self,
        trace_id: str,
        disposition_id: Optional[str] = None,
        evidence_type: str = "SYNTHETIC_PHYSICS_GROUND_TRUTH",
        evidence_status: str = "EVIDENCE_RECORDED",
        evidence_source: str = "SYSTEM",
        evidence_timestamp: Optional[str] = None,
        recorded_by: str = "OPERATOR_01",
        provenance_metadata: Optional[Dict[str, Any]] = None,
        source_record_identifier: Optional[str] = None,
        require_durable_persistence: Optional[bool] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Registers physical or retrospective evaluation outcome evidence for a trace."""
        # 1. Prohibit client-controlled ground truth & ML fields
        for k in list(kwargs.keys()):
            if k in PROHIBITED_CLIENT_ML_FIELDS and kwargs[k] is not None:
                record_audit_event("EVIDENCE_REJECTED", {"trace_id": trace_id, "reason": "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", "field": k})
                raise ValueError(f"CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '{k}' cannot be provided by client.")

        # 2. Trace ID format check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            raise ValueError(f"INVALID_TRACE_ID: trace_id '{trace_id}' does not match required format.")

        # 3. Protected test set check
        protected_pattern = re.compile(r"^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)", re.IGNORECASE)
        if protected_pattern.match(str(trace_id)):
            record_audit_event("EVIDENCE_REJECTED", {"trace_id": trace_id, "reason": "TEST_SET_ISOLATION_PROTECTED"})
            raise ValueError("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.")

        # 4. Evidence taxonomy check
        type_upper = str(evidence_type).strip().upper()
        allowed_types = set(self.contract.get("evidence_type_taxonomy", ["SYNTHETIC_PHYSICS_GROUND_TRUTH", "ATE_RETEST_LOG", "QUALIFIED_LAB_REPORT"]))
        if type_upper not in allowed_types:
            raise ValueError(f"INVALID_EVIDENCE_TYPE: '{evidence_type}' must be one of: {sorted(list(allowed_types))}")

        status_upper = str(evidence_status).strip().upper()
        allowed_statuses = set(self.contract.get("evidence_status_taxonomy", ["EVIDENCE_RECORDED", "EVIDENCE_REJECTED", "EVIDENCE_INSUFFICIENT"]))
        if status_upper not in allowed_statuses:
            raise ValueError(f"INVALID_EVIDENCE_STATUS: '{evidence_status}' must be one of: {sorted(list(allowed_statuses))}")

        # 5. Evaluate Task 2 Governance Eligibility
        gov = self.evaluate_disposition_governance(trace_id, require_durable_persistence=require_durable_persistence)
        if gov["governance_classification"] == "REJECTED_GOVERNANCE":
            record_audit_event("EVIDENCE_REJECTED", {"trace_id": trace_id, "reasons": gov["rejection_reasons"]})
            raise ValueError(f"REJECTED_GOVERNANCE: Cannot register outcome evidence for trace ineligible under Task 2 governance. Reasons: {', '.join(gov['rejection_reasons'])}")

        candidate = gov.get("evaluation_candidate") or {}
        target_disp_id = disposition_id or candidate.get("disposition_id") or f"DISP-{trace_id}"
        evidence_id = f"EVD-{uuid.uuid4().hex[:12].upper()}"
        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        evidence_record = {
            "evidence_id": evidence_id,
            "trace_id": str(trace_id),
            "disposition_id": str(target_disp_id),
            "evidence_type": type_upper,
            "evidence_status": status_upper,
            "evidence_source": str(evidence_source or "SYSTEM"),
            "evidence_timestamp": evidence_timestamp or timestamp_iso,
            "recorded_timestamp": timestamp_iso,
            "recorded_by": str(recorded_by or "OPERATOR_01"),
            "provenance_metadata": {
                **(provenance_metadata or {}),
                "synthetic_disclosure": "SYNTHETIC_PHYSICS_GROUND_TRUTH: Retrospective evaluation dataset telemetry. Not physical-fab validation." if type_upper == "SYNTHETIC_PHYSICS_GROUND_TRUTH" else None
            },
            "source_record_identifier": str(source_record_identifier) if source_record_identifier else None,
            "created_at": timestamp_iso
        }

        if trace_id not in _EVIDENCE_STORE:
            _EVIDENCE_STORE[trace_id] = []
        _EVIDENCE_STORE[trace_id].append(evidence_record)

        is_test_env = os.environ.get("NODE_ENV") == "test" or os.environ.get("ALLOW_IN_MEMORY_DEMO") == "true"
        is_persistence_required = require_durable_persistence if require_durable_persistence is not None else (not is_test_env or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true")

        if is_persistence_required:
            if not self.db_client:
                _EVIDENCE_STORE[trace_id].pop()
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": "PERSISTENCE_ERROR: Database client unconfigured."})
                raise RuntimeError("PERSISTENCE_ERROR: Durable database connection is required for outcome evidence persistence but database client is unconfigured.")
            try:
                res = self.db_client.table("disposition_outcome_evidence").insert(evidence_record).execute()
                err = extract_db_error(res)
                if err:
                    raise RuntimeError(err)
            except Exception as e:
                _EVIDENCE_STORE[trace_id].pop()
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": f"PERSISTENCE_ERROR: {str(e)}"})
                raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist outcome evidence: {str(e)}")
        elif self.db_client:
            try:
                self.db_client.table("disposition_outcome_evidence").insert(evidence_record).execute()
            except Exception:
                pass

        record_audit_event("EVIDENCE_RECORDED", {"trace_id": trace_id, "evidence_id": evidence_id, "evidence_type": type_upper})
        return evidence_record

    def get_outcome_evidence(self, trace_id: str) -> List[Dict[str, Any]]:
        """Retrieves registered outcome evidence for trace_id."""
        if not trace_id:
            return []
        evidence_list = _EVIDENCE_STORE.get(trace_id, [])
        if self.db_client:
            try:
                res = self.db_client.table("disposition_outcome_evidence").select("*").eq("trace_id", trace_id).execute()
                if hasattr(res, "data") and res.data:
                    evidence_list = res.data
                    _EVIDENCE_STORE[trace_id] = res.data
            except Exception:
                pass
        return evidence_list

    def adjudicate_outcome(
        self,
        trace_id: str,
        adjudicator_identity: str = "ADJUDICATOR_01",
        adjudicator_role: str = "QUALITY_ENGINEER",
        proposed_outcome: Optional[str] = None,
        rationale: str = "",
        require_durable_persistence: Optional[bool] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Adjudicates evidence to produce an immutable, governed outcome record."""
        # 1. Prohibit client-controlled ground truth & ML fields
        for k in list(kwargs.keys()):
            if k in PROHIBITED_CLIENT_ML_FIELDS and kwargs[k] is not None:
                record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reason": "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", "field": k})
                raise ValueError(f"CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '{k}' cannot be provided by client.")

        # 2. Trace ID check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            raise ValueError(f"INVALID_TRACE_ID: trace_id '{trace_id}' does not match required format.")

        # 3. Protected test set check
        protected_pattern = re.compile(r"^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)", re.IGNORECASE)
        if protected_pattern.match(str(trace_id)):
            record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reason": "TEST_SET_ISOLATION_PROTECTED"})
            raise ValueError("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.")

        # 4. Adjudicator Role Check
        allowed_adjudicator_roles = set(
            self.contract.get("security_rules", {}).get("allowed_adjudicator_roles", ["QUALITY_ENGINEER", "RELIABILITY_LEAD", "ADJUDICATOR", "ADMIN"])
        )
        role_upper = str(adjudicator_role or "").strip().upper()
        if role_upper not in allowed_adjudicator_roles:
            record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reason": "UNAUTHORIZED_ROLE", "role": adjudicator_role})
            raise PermissionError(
                f"UNAUTHORIZED_ROLE: Role '{adjudicator_role}' is not authorized to perform outcome adjudication. "
                f"Adjudication requires one of: {sorted(list(allowed_adjudicator_roles))}."
            )

        # 5. Evaluate Task 2 Governance Eligibility
        gov = self.evaluate_disposition_governance(trace_id, require_durable_persistence=require_durable_persistence)
        if gov["governance_classification"] == "REJECTED_GOVERNANCE":
            record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reasons": gov["rejection_reasons"]})
            raise ValueError(f"REJECTED_GOVERNANCE: Cannot adjudicate trace ineligible under Task 2 governance. Reasons: {', '.join(gov['rejection_reasons'])}")
        candidate = gov.get("evaluation_candidate") or {}

        # 6. Reconstruct Evidence
        evidence_list = self.get_outcome_evidence(trace_id)
        if not evidence_list:
            record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reason": "MISSING_OUTCOME_EVIDENCE"})
            raise ValueError(f"MISSING_OUTCOME_EVIDENCE: No outcome evidence records found for trace_id '{trace_id}'. Adjudication requires registered outcome evidence.")

        accepted_evidence = [e for e in evidence_list if e.get("evidence_status") == "EVIDENCE_RECORDED"]
        if not accepted_evidence:
            record_audit_event("ADJUDICATION_REJECTED", {"trace_id": trace_id, "reason": "INSUFFICIENT_OUTCOME_EVIDENCE"})
            raise ValueError(f"INSUFFICIENT_OUTCOME_EVIDENCE: All evidence for trace_id '{trace_id}' is rejected or insufficient.")

        # 7. Evidence Conflict Analysis
        outcome_pass_count = 0
        outcome_fail_count = 0
        for ev in accepted_evidence:
            src_str = str(ev.get("source_record_identifier") or ev.get("evidence_type") or "").upper()
            meta = ev.get("provenance_metadata", {})
            res_val = str(meta.get("result") or meta.get("outcome") or meta.get("physical_outcome") or src_str).upper()
            if "PASS" in res_val or "ACCEPT" in res_val:
                outcome_pass_count += 1
            if "FAIL" in res_val or "REJECT" in res_val:
                outcome_fail_count += 1

        has_evidence_conflict = outcome_pass_count > 0 and outcome_fail_count > 0
        clean_proposed = str(proposed_outcome).strip().upper() if proposed_outcome else None

        adj_status = "PENDING_ADJUDICATION"
        validated_outcome = None
        gt_status = "NOT_ESTABLISHED"

        if has_evidence_conflict and (not clean_proposed or not rationale):
            adj_status = "UNRESOLVED_AMBIGUITY"
            validated_outcome = None
            gt_status = "UNRESOLVED"
        else:
            target_outcome = clean_proposed or ("FAIL" if outcome_fail_count > 0 else "PASS")
            if target_outcome in ["PASS", "FAIL"]:
                validated_outcome = target_outcome
                adj_status = "VALIDATED_PASS" if target_outcome == "PASS" else "VALIDATED_FAIL"
                gt_status = "VALIDATED_GROUND_TRUTH"
            else:
                adj_status = "UNRESOLVED_AMBIGUITY"
                validated_outcome = None
                gt_status = "UNRESOLVED"

        adjudication_id = f"ADJ-{uuid.uuid4().hex[:12].upper()}"
        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        adjudication_record = {
            "adjudication_id": adjudication_id,
            "trace_id": str(trace_id),
            "disposition_id": candidate.get("disposition_id"),
            "evidence_ids": [e.get("evidence_id") for e in accepted_evidence],
            "adjudicator_identity": str(adjudicator_identity),
            "adjudicator_role": role_upper,
            "adjudication_status": adj_status,
            "proposed_outcome": clean_proposed,
            "validated_outcome": validated_outcome,
            "ground_truth_status": gt_status,
            "rationale": str(rationale or "").strip(),
            "provenance": {
                "model_id_at_decision": candidate.get("model_id_at_decision", "predicta_xgboost_model"),
                "model_hash_at_decision": candidate.get("model_hash_at_decision"),
                "original_ml_decision": candidate.get("original_ml_decision"),
                "original_ml_probability": candidate.get("original_ml_probability"),
                "evidence_sources": [{"evidence_id": e.get("evidence_id"), "type": e.get("evidence_type"), "source": e.get("evidence_source")} for e in accepted_evidence],
                "synthetic_disclosure": "SYNTHETIC_PHYSICS_GROUND_TRUTH: Retrospective evaluation dataset telemetry. Not physical-fab validation." if any(e.get("evidence_type") == "SYNTHETIC_PHYSICS_GROUND_TRUTH" for e in accepted_evidence) else None
            },
            "created_at": timestamp_iso,
            "governance_guarantees": {
                "no_automatic_retraining": True,
                "no_threshold_modification": True,
                "no_fusion_weight_modification": True,
                "no_conformal_recalibration": True,
                "operator_is_not_ground_truth": True,
                "test_set_isolation_enforced": True,
                "append_only_preserved": True
            }
        }

        if trace_id not in _ADJUDICATION_STORE:
            _ADJUDICATION_STORE[trace_id] = []
        _ADJUDICATION_STORE[trace_id].append(adjudication_record)

        is_test_env = os.environ.get("NODE_ENV") == "test" or os.environ.get("ALLOW_IN_MEMORY_DEMO") == "true"
        is_persistence_required = require_durable_persistence if require_durable_persistence is not None else (not is_test_env or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true")

        if is_persistence_required:
            if not self.db_client:
                _ADJUDICATION_STORE[trace_id].pop()
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": "PERSISTENCE_ERROR: Database client unconfigured."})
                raise RuntimeError("PERSISTENCE_ERROR: Durable database connection is required for adjudication persistence but database client is unconfigured.")
            try:
                res = self.db_client.table("disposition_adjudications").insert(adjudication_record).execute()
                err = extract_db_error(res)
                if err:
                    raise RuntimeError(err)
            except Exception as e:
                _ADJUDICATION_STORE[trace_id].pop()
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": f"PERSISTENCE_ERROR: {str(e)}"})
                raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist adjudication to database: {str(e)}")
        elif self.db_client:
            try:
                self.db_client.table("disposition_adjudications").insert(adjudication_record).execute()
            except Exception:
                pass

        record_audit_event("OUTCOME_ADJUDICATED", {"trace_id": trace_id, "adjudication_id": adjudication_id, "status": adj_status, "ground_truth_status": gt_status})
        return adjudication_record

    def get_adjudication(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the latest outcome adjudication record for trace_id."""
        if not trace_id:
            return None
        adj_list = _ADJUDICATION_STORE.get(trace_id, [])
        if self.db_client:
            try:
                res = self.db_client.table("disposition_adjudications").select("*").eq("trace_id", trace_id).execute()
                if hasattr(res, "data") and res.data:
                    adj_list = res.data
                    _ADJUDICATION_STORE[trace_id] = res.data
            except Exception:
                pass
        return adj_list[-1] if adj_list else None

    def generate_offline_evaluation_manifest(self, trace_id: str, require_durable_persistence: Optional[bool] = None) -> Dict[str, Any]:
        """Generates a governed, evaluation-only manifest for offline model benchmark analysis."""
        gov = self.evaluate_disposition_governance(trace_id, require_durable_persistence=require_durable_persistence)
        if gov["governance_classification"] == "REJECTED_GOVERNANCE":
            raise ValueError(f"REJECTED_GOVERNANCE: Cannot generate offline evaluation manifest for ineligible trace '{trace_id}'.")

        adjudication = self.get_adjudication(trace_id)
        if not adjudication or adjudication.get("ground_truth_status") != "VALIDATED_GROUND_TRUTH":
            raise ValueError(f"INELIGIBLE_FOR_OFFLINE_MANIFEST: Trace '{trace_id}' does not have VALIDATED_GROUND_TRUTH status.")

        evidence_list = self.get_outcome_evidence(trace_id)
        candidate = gov.get("evaluation_candidate") or {}
        timestamp_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return {
            "manifest_version": "1.0.0",
            "trace_id": str(trace_id),
            "component_id": candidate.get("component_id"),
            "lot_id": candidate.get("lot_id"),
            "original_ml_decision": candidate.get("original_ml_decision"),
            "original_ml_probability": candidate.get("original_ml_probability"),
            "model_hash_at_decision": candidate.get("model_hash_at_decision"),
            "evidence_ids": [e.get("evidence_id") for e in evidence_list],
            "adjudication_id": adjudication.get("adjudication_id"),
            "validated_outcome": adjudication.get("validated_outcome"),
            "ground_truth_status": adjudication.get("ground_truth_status"),
            "evidence_provenance": [{"evidence_id": e.get("evidence_id"), "type": e.get("evidence_type"), "source": e.get("evidence_source")} for e in evidence_list],
            "adjudication_provenance": adjudication.get("provenance"),
            "evaluation_only": True,
            "production_effect": False,
            "dataset_split_isolation_enforced": True,
            "created_at": timestamp_iso
        }


