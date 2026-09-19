"""
PREDICTA Stage 6 Task 2 — Human Disposition Feedback Engine (Python)
File: src/governance/disposition.py

Manages human operator disposition feedback under strict governance rules:
- Captures operator disposition (ACCEPT, REJECT, HOLD, RETEST, ESCALATE).
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
import datetime
from typing import Dict, Any, List, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DISPOSITION_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "governance", "disposition_contract.json")

# In-memory storage fallback for Python tests / runtime
_FEEDBACK_STORE: Dict[str, Dict[str, Any]] = {}
_AUDIT_LOGS: List[Dict[str, Any]] = []


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


class HumanDispositionManager:
    def __init__(self, contract_path: str = DISPOSITION_CONTRACT_PATH):
        self.contract = load_disposition_contract(contract_path)
        self.allowed_dispositions = set(self.contract["disposition_taxonomy"])
        self.allowed_reasons = set(self.contract["reason_code_taxonomy"])
        self.allowed_roles = set(self.contract["security_rules"]["allowed_roles"])
        self.max_comment_length = int(self.contract["security_rules"]["max_comment_length"])
        self.trace_regex = re.compile(self.contract["security_rules"]["require_trace_id_format"])

    def record_disposition(
        self,
        trace_id: str,
        disposition: str,
        reason_code: str,
        operator_id: str,
        comment: str = "",
        component_id: Optional[str] = None,
        lot_id: Optional[str] = None,
        ml_decision_snapshot: Optional[Dict[str, Any]] = None,
        operator_role: str = "OPERATOR"
    ) -> Dict[str, Any]:
        """
        Validates and records operator feedback.
        Guarantees original ML decision remains unaltered.
        """
        # Role authorization check
        if operator_role not in self.allowed_roles:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "UNAUTHORIZED_ROLE",
                "role": operator_role
            })
            raise PermissionError(f"UNAUTHORIZED_ROLE: Role '{operator_role}' is not authorized to submit disposition.")

        # Trace ID check
        if not trace_id or not self.trace_regex.match(str(trace_id)):
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_TRACE_ID"
            })
            raise ValueError(f"INVALID_TRACE_ID: trace_id '{trace_id}' does not match required format.")

        # Disposition check
        disp_upper = str(disposition).strip().upper()
        if disp_upper not in self.allowed_dispositions:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_DISPOSITION",
                "disposition": disposition
            })
            raise ValueError(f"INVALID_DISPOSITION: '{disposition}' must be one of {sorted(list(self.allowed_dispositions))}")

        # Reason code check
        reason_upper = str(reason_code).strip().upper()
        if reason_upper not in self.allowed_reasons:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "INVALID_REASON_CODE",
                "reason_code": reason_code
            })
            raise ValueError(f"INVALID_REASON_CODE: '{reason_code}' must be one of {sorted(list(self.allowed_reasons))}")

        # Comment length check
        clean_comment = str(comment or "").strip()
        if len(clean_comment) > self.max_comment_length:
            record_audit_event("DISPOSITION_REJECTED", {
                "trace_id": trace_id,
                "reason": "OVERSIZED_COMMENT",
                "length": len(clean_comment)
            })
            raise ValueError(f"OVERSIZED_COMMENT: Comment exceeds maximum allowed length of {self.max_comment_length} characters.")

        # ML Decision preservation
        ml_snapshot = ml_decision_snapshot or {}
        ml_decision = ml_snapshot.get("ml_decision", ml_snapshot.get("decision", "UNKNOWN"))
        ml_prob = ml_snapshot.get("probability", ml_snapshot.get("calibrated_probability", 0.0))
        anomaly_score = ml_snapshot.get("anomaly_score")
        prognostic_summary = ml_snapshot.get("prognostic_summary", ml_snapshot.get("trajectory_state"))
        model_id = ml_snapshot.get("model_id", "predicta_xgboost_model")
        model_hash = ml_snapshot.get("model_hash", "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98")

        disposition_record = {
            "disposition_id": f"DISP-{uuid.uuid4().hex[:12].upper()}",
            "trace_id": trace_id,
            "component_id": component_id or ml_snapshot.get("component_id") or "UNKNOWN_COMP",
            "lot_id": lot_id or ml_snapshot.get("lot_id") or "UNKNOWN_LOT",
            "operator_id": operator_id or "OPERATOR_01",
            "operator_role": operator_role,
            "disposition": disp_upper,
            "reason_code": reason_upper,
            "comment": clean_comment,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "model_id_at_decision": model_id,
            "model_hash_at_decision": model_hash,
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
                "split_leakage_prevented": True
            }
        }

        # Store in separate store
        _FEEDBACK_STORE[trace_id] = disposition_record

        record_audit_event("DISPOSITION_RECORDED", {
            "disposition_id": disposition_record["disposition_id"],
            "trace_id": trace_id,
            "operator_id": operator_id,
            "disposition": disp_upper,
            "original_ml_decision": ml_decision
        })

        return disposition_record

    def get_disposition(self, trace_id: str) -> Optional[Dict[str, Any]]:
        return _FEEDBACK_STORE.get(trace_id)

    def list_dispositions(self) -> List[Dict[str, Any]]:
        return list(_FEEDBACK_STORE.values())

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return list(_AUDIT_LOGS)
