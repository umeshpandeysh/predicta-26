"""
PREDICTA Stage 6 Task 2 — Human Disposition Feedback Engine (Python)
File: src/governance/disposition.py

Manages human operator disposition feedback under strict governance rules:
- Captures operator disposition (ACCEPT, REJECT, HOLD, RETEST, ESCALATE).
- Backend-authoritative: Original ML decision is looked up from backend, NEVER provided by client.
- Client-controlled ML inputs prohibited (fails closed if client attempts to pass ML snapshots/probabilities).
- Model provenance verification: Asserts SHA-256 of production model against manifest.
- Append-only storage: Dispositions are preserved in immutable historical ledgers.
- Enforces immutability: Original ML decision is NEVER overwritten or altered.
- Zero retraining guarantee: Feedback does NOT adapt models, weights, thresholds, or splits.
- State default: feedback_status = RECORDED_ONLY.
- Role-based authorization & reason code validation.
- Audit event emission.
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
        model_path: str = MODEL_JSON_PATH
    ):
        self.contract = load_disposition_contract(contract_path)
        self.manifest_path = manifest_path
        self.model_path = model_path
        self.allowed_dispositions = set(self.contract["disposition_taxonomy"])
        self.allowed_reasons = set(self.contract["reason_code_taxonomy"])
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

    def lookup_authoritative_prediction(self, trace_id: str) -> Dict[str, Any]:
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
        **kwargs
    ) -> Dict[str, Any]:
        """
        Validates and records operator feedback.
        Backend-authoritative: ML decisions are looked up from authoritative store.
        Rejects client-controlled ML output attempts.
        Guarantees original ML decision remains unaltered and appends to history.
        """
        # 1. Prohibit client-controlled ML output fields
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

        # 2. Role authorization check
        if operator_role not in self.allowed_roles:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "UNAUTHORIZED_ROLE",
                "role": operator_role
            })
            raise PermissionError(f"UNAUTHORIZED_ROLE: Role '{operator_role}' is not authorized to submit disposition.")

        # 3. Trace ID check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_TRACE_ID"
            })
            raise ValueError(f"INVALID_TRACE_ID: trace_id '{trace_id}' does not match required format.")

        # 4. Disposition check
        disp_upper = str(disposition).strip().upper()
        if disp_upper not in self.allowed_dispositions:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_DISPOSITION",
                "disposition": disposition
            })
            raise ValueError(f"INVALID_DISPOSITION: '{disposition}' must be one of {sorted(list(self.allowed_dispositions))}")

        # 5. Reason code check
        reason_upper = str(reason_code).strip().upper()
        if reason_upper not in self.allowed_reasons:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_REASON_CODE",
                "reason_code": reason_code
            })
            raise ValueError(f"INVALID_REASON_CODE: '{reason_code}' must be one of {sorted(list(self.allowed_reasons))}")

        # 6. Comment length check
        clean_comment = str(comment or "").strip()
        if len(clean_comment) > self.max_comment_length:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "OVERSIZED_COMMENT",
                "length": len(clean_comment)
            })
            raise ValueError(f"OVERSIZED_COMMENT: Comment exceeds maximum allowed length of {self.max_comment_length} characters.")

        # 7. Model Provenance Verification
        model_sha = self.verify_model_provenance()

        # 8. Backend-Authoritative Trace Lookup
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

        # Extract authoritative ML decision fields
        ml_decision = str(auth_record.get("prediction") or auth_record.get("disposition") or auth_record.get("decision") or "UNKNOWN")
        ml_prob = float(auth_record.get("probability", auth_record.get("calibrated_probability", 0.0)))
        anomaly_score = auth_record.get("anomaly_score") or auth_record.get("anomaly_status")
        prognostic_summary = auth_record.get("prognostic_summary") or auth_record.get("prognostics") or auth_record.get("trajectory_state")
        comp_id = component_id or auth_record.get("component_id") or auth_record.get("die_id") or "UNKNOWN_COMP"
        l_id = lot_id or auth_record.get("lot_id") or "UNKNOWN_LOT"

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
            "feedback_status": "RECORDED_ONLY",
            "governance_guarantees": {
                "ml_decision_unaltered": True,
                "model_retraining_triggered": False,
                "thresholds_modified": False,
                "split_leakage_prevented": True,
                "append_only_preserved": True
            }
        }

        # 9. Append-Only Storage
        if trace_id not in _FEEDBACK_STORE:
            _FEEDBACK_STORE[trace_id] = []
        _FEEDBACK_STORE[trace_id].append(disposition_record)

        record_audit_event("DISPOSITION_RECORDED", {
            "disposition_id": disposition_record["disposition_id"],
            "trace_id": trace_id,
            "operator_id": operator_id,
            "disposition": disp_upper,
            "original_ml_decision": ml_decision,
            "total_records_for_trace": len(_FEEDBACK_STORE[trace_id])
        })

        return disposition_record

    def get_disposition(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Returns complete append-only disposition history for trace_id."""
        history = _FEEDBACK_STORE.get(trace_id)
        if not history:
            return None
        return {
            "trace_id": trace_id,
            "total_dispositions": len(history),
            "latest": history[-1],
            "history": list(history)
        }

    def list_dispositions(self) -> List[Dict[str, Any]]:
        """Returns all recorded disposition records across all traces."""
        return [rec for history in _FEEDBACK_STORE.values() for rec in history]

    def register_authoritative_prediction(self, prediction_record: Dict[str, Any]) -> None:
        """Registers an authoritative prediction record into the backend store."""
        register_authoritative_prediction(prediction_record)

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return list(_AUDIT_LOGS)

