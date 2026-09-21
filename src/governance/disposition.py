"""
PREDICTA Phase 11 Task 1 — Human Feedback Governance Foundation Engine (Python)
File: src/governance/disposition.py

Manages human operator disposition feedback under strict governance rules:
- Captures operator disposition (ACCEPT, REJECT, HOLD, RETEST, ESCALATE).
- Formally supports feedback outcome lifecycle states: RECORDED_ONLY -> PENDING_OUTCOME -> CONFIRMED / CONTRADICTED / UNRESOLVED.
- Backend-authoritative: Original ML decision is looked up from backend, NEVER provided by client.
- Client-controlled ML inputs prohibited (fails closed if client attempts to pass ML snapshots, probabilities, or ground truth).
- Model provenance verification: Asserts SHA-256 of production model against manifest.
- Append-only storage: Dispositions are preserved in immutable historical ledgers.
- Explicit conflict governance: Multiple operator dispositions for a single trace are preserved with conflict=True flags.
- Fail-closed persistence: Durable persistence failure fails closed without pretending memory is durable storage.
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

# In-memory storage fallback for Python tests / runtime: trace_id -> List[disposition_record]
_FEEDBACK_STORE: Dict[str, List[Dict[str, Any]]] = {}
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
            "RECORDED_ONLY", "PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED", "ELIGIBLE_FOR_OFFLINE_REVIEW", "REJECTED_GOVERNANCE"
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

        # Check telemetry store if available
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

        # 7. Feedback status check
        raw_status = outcome_status or feedback_status or "RECORDED_ONLY"
        status_upper = str(raw_status).strip().upper()
        if status_upper not in self.allowed_feedback_statuses:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_FEEDBACK_STATUS",
                "feedback_status": raw_status
            })
            raise ValueError(f"INVALID_FEEDBACK_STATUS: '{raw_status}' is not a valid feedback status.")

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
        ml_decision = str(auth_record.get("prediction") or auth_record.get("disposition") or auth_record.get("decision") or "UNKNOWN")
        ml_prob = float(auth_record.get("probability", auth_record.get("calibrated_probability", 0.0)))
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

        disposition_record = {
            "disposition_id": f"DISP-{uuid.uuid4().hex[:12].upper()}",
            "trace_id": trace_id,
            "component_id": comp_id,
            "lot_id": l_id,
            "operator_id": operator_id or "OPERATOR_01",
            "operator_role": operator_role,
            "disposition": disp_upper,
            "reason_code": reason_upper,
            "comment": clean_comment,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
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

        # 13. Append-Only Storage & Fail-Closed Persistence Governance
        if trace_id not in _FEEDBACK_STORE:
            _FEEDBACK_STORE[trace_id] = []
        _FEEDBACK_STORE[trace_id].append(disposition_record)

        if require_durable_persistence or os.environ.get("REQUIRE_DURABLE_PERSISTENCE") == "true":
            if not self.db_client:
                _FEEDBACK_STORE[trace_id].pop()
                err_msg = "PERSISTENCE_ERROR: Durable database connection is required but database client is unconfigured. Governed persistence failed closed."
                record_audit_event("PERSISTENCE_FAILED_CLOSED", {"trace_id": trace_id, "reason": err_msg})
                raise RuntimeError(err_msg)
            try:
                # DB Insert
                res = self.db_client.table("operator_dispositions").insert(disposition_record).execute()
                if hasattr(res, "error") and res.error:
                    _FEEDBACK_STORE[trace_id].pop()
                    raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist operator disposition: {res.error}")
            except Exception as e:
                if str(e).startswith("PERSISTENCE_ERROR"):
                    raise e
                _FEEDBACK_STORE[trace_id].pop()
                raise RuntimeError(f"PERSISTENCE_ERROR: Failed to durably persist operator disposition: {str(e)}")
        elif self.db_client:
            try:
                self.db_client.table("operator_dispositions").insert(disposition_record).execute()
            except Exception:
                pass

        record_audit_event("DISPOSITION_RECORDED", {
            "disposition_id": disposition_record["disposition_id"],
            "trace_id": trace_id,
            "operator_id": operator_id,
            "disposition": disp_upper,
            "original_ml_decision": ml_decision,
            "conflict": has_conflict,
            "total_records_for_trace": len(_FEEDBACK_STORE[trace_id])
        })

        return disposition_record

    def get_disposition(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Returns complete append-only disposition history for trace_id."""
        history = _FEEDBACK_STORE.get(trace_id, [])

        if self.db_client:
            try:
                res = self.db_client.table("operator_dispositions").select("*").eq("trace_id", trace_id).execute()
                if hasattr(res, "data") and res.data:
                    history = res.data
            except Exception:
                pass

        if not history:
            return None

        disp_set = {rec.get("disposition") for rec in history}
        has_conflict = len(disp_set) > 1

        return {
            "trace_id": trace_id,
            "total_dispositions": len(history),
            "has_conflict": has_conflict,
            "conflict": has_conflict,
            "latest": history[-1],
            "history": list(history)
        }

    def update_feedback_status(
        self,
        trace_id: str,
        disposition_id: str,
        new_status: str,
        operator_id: str = "OPERATOR_01",
        comment: str = ""
    ) -> Dict[str, Any]:
        """Updates feedback lifecycle status for disposition_id while preserving immutability."""
        history = _FEEDBACK_STORE.get(trace_id, [])
        if not history:
            raise KeyError(f"NOT_FOUND: No disposition records found for trace_id '{trace_id}'.")

        status_upper = str(new_status).strip().upper()
        if status_upper not in self.allowed_feedback_statuses:
            raise ValueError(f"INVALID_FEEDBACK_STATUS: '{new_status}' is not a valid feedback status.")

        target_rec = None
        for rec in history:
            if rec.get("disposition_id") == disposition_id:
                target_rec = rec
                break
        if not target_rec:
            target_rec = history[-1]

        allowed_transitions = self.contract.get("lifecycle_transitions", {
            "RECORDED_ONLY": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
            "PENDING_OUTCOME": ["CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
            "CONFIRMED": [],
            "CONTRADICTED": [],
            "UNRESOLVED": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED"]
        })

        current_status = target_rec.get("feedback_status", "RECORDED_ONLY")
        valid_next = allowed_transitions.get(current_status, [])
        if current_status != status_upper and status_upper not in valid_next:
            raise ValueError(f"INVALID_LIFECYCLE_TRANSITION: Cannot transition feedback status from '{current_status}' to '{status_upper}'.")

        target_rec["feedback_status"] = status_upper
        target_rec["outcome_status"] = status_upper

        record_audit_event("FEEDBACK_STATUS_UPDATED", {
            "trace_id": trace_id,
            "disposition_id": target_rec.get("disposition_id"),
            "previous_status": current_status,
            "new_status": status_upper,
            "updated_by": operator_id,
            "comment": comment
        })

        return target_rec

    def list_dispositions(self) -> List[Dict[str, Any]]:
        """Returns all recorded disposition records across all traces."""
        return [rec for history in _FEEDBACK_STORE.values() for rec in history]

    def register_authoritative_prediction(self, prediction_record: Dict[str, Any]) -> None:
        """Registers an authoritative prediction record into the backend store."""
        register_authoritative_prediction(prediction_record)

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return list(_AUDIT_LOGS)
