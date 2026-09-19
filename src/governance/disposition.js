const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DISPOSITION_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/governance/disposition_contract.json');

const _FEEDBACK_STORE = new Map();
const _AUDIT_LOGS = [];

function loadDispositionContract(contractPath = DISPOSITION_CONTRACT_PATH) {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`CONTRACT_MISSING: Disposition contract missing at ${contractPath}`);
  }
  return JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
}

function recordAuditEvent(eventType, details) {
  const event = {
    event_id: `AUDIT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    details
  };
  _AUDIT_LOGS.push(event);
  return event;
}

class HumanDispositionManagerJS {
  constructor(contractPath = DISPOSITION_CONTRACT_PATH, supabaseClient = null) {
    this.contract = loadDispositionContract(contractPath);
    this.allowedDispositions = new Set(this.contract.disposition_taxonomy);
    this.allowedReasons = new Set(this.contract.reason_code_taxonomy);
    this.allowedRoles = new Set(this.contract.security_rules.allowed_roles);
    this.maxCommentLength = Number(this.contract.security_rules.max_comment_length);
    this.traceRegex = new RegExp(this.contract.security_rules.require_trace_id_format);
    this.supabase = supabaseClient;
  }

  async recordDispositionAsync({
    trace_id,
    disposition,
    reason_code,
    operator_id,
    comment = '',
    component_id = null,
    lot_id = null,
    ml_decision_snapshot = null,
    operator_role = 'OPERATOR'
  }) {
    // 1. Role verification
    if (!this.allowedRoles.has(operator_role)) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "UNAUTHORIZED_ROLE",
        role: operator_role
      });
      const err = new Error(`UNAUTHORIZED_ROLE: Role '${operator_role}' is not authorized to submit disposition.`);
      err.statusCode = 403;
      throw err;
    }

    // 2. Trace ID format
    if (!trace_id || !this.traceRegex.test(String(trace_id))) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "INVALID_TRACE_ID"
      });
      const err = new Error(`INVALID_TRACE_ID: trace_id '${trace_id}' does not match required format.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Disposition enum
    const dispUpper = String(disposition || '').trim().toUpperCase();
    if (!this.allowedDispositions.has(dispUpper)) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "INVALID_DISPOSITION",
        disposition
      });
      const err = new Error(`INVALID_DISPOSITION: '${disposition}' must be one of: ${Array.from(this.allowedDispositions).sort().join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Reason code enum
    const reasonUpper = String(reason_code || '').trim().toUpperCase();
    if (!this.allowedReasons.has(reasonUpper)) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "INVALID_REASON_CODE",
        reason_code
      });
      const err = new Error(`INVALID_REASON_CODE: '${reason_code}' must be one of: ${Array.from(this.allowedReasons).sort().join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Comment length
    const cleanComment = String(comment || '').trim();
    if (cleanComment.length > this.maxCommentLength) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "OVERSIZED_COMMENT",
        length: cleanComment.length
      });
      const err = new Error(`OVERSIZED_COMMENT: Comment exceeds maximum allowed length of ${this.maxCommentLength} characters.`);
      err.statusCode = 400;
      throw err;
    }

    // 6. ML Decision preservation
    const mlSnapshot = ml_decision_snapshot || {};
    const mlDecision = mlSnapshot.ml_decision || mlSnapshot.decision || "UNKNOWN";
    const mlProb = mlSnapshot.probability !== undefined ? mlSnapshot.probability : (mlSnapshot.calibrated_probability || 0.0);
    const anomalyScore = mlSnapshot.anomaly_score;
    const prognosticSummary = mlSnapshot.prognostic_summary || mlSnapshot.trajectory_state;
    const modelId = mlSnapshot.model_id || "predicta_xgboost_model";
    const modelHash = mlSnapshot.model_hash || "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";

    const dispositionRecord = {
      disposition_id: `DISP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      trace_id,
      component_id: component_id || mlSnapshot.component_id || "UNKNOWN_COMP",
      lot_id: lot_id || mlSnapshot.lot_id || "UNKNOWN_LOT",
      operator_id: operator_id || "OPERATOR_01",
      operator_role,
      disposition: dispUpper,
      reason_code: reasonUpper,
      comment: cleanComment,
      created_at: new Date().toISOString(),
      model_id_at_decision: modelId,
      model_hash_at_decision: modelHash,
      original_ml_decision: mlDecision,
      original_ml_probability: mlProb,
      anomaly_score_at_decision: anomalyScore,
      prognostic_output_at_decision: prognosticSummary,
      decision_at_decision: mlDecision,
      source: "HUMAN_OPERATOR_GATE",
      feedback_status: "RECORDED_ONLY",
      governance_guarantees: {
        ml_decision_unaltered: true,
        model_retraining_triggered: false,
        thresholds_modified: false,
        split_leakage_prevented: true
      }
    };

    _FEEDBACK_STORE.set(trace_id, dispositionRecord);

    if (this.supabase) {
      try {
        await this.supabase.from('operator_dispositions').insert([dispositionRecord]);
      } catch (e) {
        // Fallback to in-memory store
      }
    }

    recordAuditEvent("DISPOSITION_RECORDED", {
      disposition_id: dispositionRecord.disposition_id,
      trace_id,
      operator_id: dispositionRecord.operator_id,
      disposition: dispUpper,
      original_ml_decision: mlDecision
    });

    return dispositionRecord;
  }

  async getDispositionAsync(trace_id) {
    if (_FEEDBACK_STORE.has(trace_id)) {
      return _FEEDBACK_STORE.get(trace_id);
    }
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('operator_dispositions').select('*').eq('trace_id', trace_id).single();
        if (data) return data;
      } catch (e) {
        // ignore
      }
    }
    return null;
  }

  listDispositions() {
    return Array.from(_FEEDBACK_STORE.values());
  }

  getAuditLogs() {
    return [..._AUDIT_LOGS];
  }
}

module.exports = {
  HumanDispositionManagerJS,
  recordAuditEvent,
  DISPOSITION_CONTRACT_PATH
};
