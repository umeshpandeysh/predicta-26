const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const inferenceService = require('../api/inference');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DISPOSITION_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/governance/disposition_contract.json');
const PROD_MANIFEST_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_production_manifest.json');
const MODEL_JSON_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');

// In-memory append-only stores:
// _FEEDBACK_STORE: trace_id -> Array of immutable disposition records
// _LIFECYCLE_EVENTS: disposition_id -> Array of immutable status transition events
const _FEEDBACK_STORE = new Map();
const _LIFECYCLE_EVENTS = new Map();
const _AUTHORITATIVE_PREDICTIONS = new Map();
const _AUDIT_LOGS = [];

const PROHIBITED_CLIENT_ML_FIELDS = [
  'ml_decision_snapshot',
  'ml_decision',
  'original_ml_decision',
  'decision',
  'probability',
  'calibrated_probability',
  'raw_probability',
  'model_hash',
  'model_hash_at_decision',
  'model_id',
  'model_id_at_decision',
  'anomaly_score',
  'anomaly_score_at_decision',
  'anomaly_status',
  'prognostic_output',
  'prognostic_output_at_decision',
  'prognostics',
  'ground_truth',
  'ground_truth_label',
  'is_ground_truth'
];

function isValidProbability(val) {
  if (val === null || val === undefined) return false;
  if (typeof val !== 'number') return false;
  if (!Number.isFinite(val)) return false;
  if (isNaN(val)) return false;
  return val >= 0.0 && val <= 1.0;
}

function extractOriginalMlDecision(authRecord) {
  if (!authRecord || typeof authRecord !== 'object') return null;
  const candidateFields = ['prediction', 'disposition', 'decision'];
  for (const field of candidateFields) {
    if (authRecord[field] !== undefined && authRecord[field] !== null) {
      return String(authRecord[field]);
    }
  }
  return null;
}

function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ARTIFACT_MISSING: File not found at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

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

function registerAuthoritativePrediction(predictionRecord) {
  if (!predictionRecord || typeof predictionRecord !== 'object') return;
  const traceId = predictionRecord.trace_id || predictionRecord.test_id;
  if (traceId) {
    _AUTHORITATIVE_PREDICTIONS.set(String(traceId), { ...predictionRecord });
  }
  const testId = predictionRecord.test_id;
  if (testId) {
    _AUTHORITATIVE_PREDICTIONS.set(String(testId), { ...predictionRecord });
  }
  if (inferenceService && inferenceService.predictionStore) {
    inferenceService.predictionStore.unshift(predictionRecord);
  }
}

class HumanDispositionManagerJS {
  constructor(
    contractPath = DISPOSITION_CONTRACT_PATH,
    manifestPath = PROD_MANIFEST_PATH,
    modelPath = MODEL_JSON_PATH,
    supabaseClient = null
  ) {
    this.contractPath = contractPath;
    this.manifestPath = manifestPath;
    this.modelPath = modelPath;
    this.contract = loadDispositionContract(contractPath);
    this.allowedDispositions = new Set(this.contract.disposition_taxonomy);
    this.allowedReasons = new Set(this.contract.reason_code_taxonomy);
    this.allowedFeedbackStatuses = new Set(this.contract.governance_rules.allowed_feedback_statuses || [
      'RECORDED_ONLY', 'PENDING_OUTCOME', 'CONFIRMED', 'CONTRADICTED', 'UNRESOLVED'
    ]);
    this.allowedRoles = new Set(this.contract.security_rules.allowed_roles);
    this.maxCommentLength = Number(this.contract.security_rules.max_comment_length);
    this.traceRegex = new RegExp(this.contract.security_rules.require_trace_id_format);
    this.supabaseClient = supabaseClient;
    this.inferenceService = inferenceService;

    this.loadManifest();
  }

  get supabase() {
    return this.supabaseClient || (this.inferenceService && this.inferenceService.supabase ? this.inferenceService.supabase : null);
  }

  set supabase(client) {
    this.supabaseClient = client;
  }

  loadManifest() {
    if (!fs.existsSync(this.manifestPath)) {
      throw new Error(`ARTIFACT_MISSING: Manifest not found at ${this.manifestPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
    if (!manifest.model_sha256) {
      throw new Error("MANIFEST_INVALID: Production manifest missing required model_sha256.");
    }
    this.expectedModelSha = manifest.model_sha256;
  }

  verifyModelProvenance() {
    try {
      const actualSha = computeFileSha256(this.modelPath);
      if (actualSha !== this.expectedModelSha) {
        throw new Error(`MODEL_PROVENANCE_INVALID: Computed model SHA ${actualSha} does not match expected ${this.expectedModelSha}`);
      }
      return actualSha;
    } catch (e) {
      if (e.message.startsWith('MODEL_PROVENANCE_INVALID')) throw e;
      throw new Error(`MODEL_PROVENANCE_INVALID: Model artifact check failed: ${e.message}`);
    }
  }

  lookupAuthoritativePrediction(traceId) {
    if (_AUTHORITATIVE_PREDICTIONS.has(traceId)) {
      return _AUTHORITATIVE_PREDICTIONS.get(traceId);
    }
    if (this.inferenceService && typeof this.inferenceService.getPredictionByTraceId === 'function') {
      const rec = this.inferenceService.getPredictionByTraceId(traceId);
      if (rec) return rec;
    }
    return null;
  }

  async lookupAuthoritativePredictionAsync(traceId) {
    if (!traceId) return null;
    if (_AUTHORITATIVE_PREDICTIONS.has(traceId)) {
      return _AUTHORITATIVE_PREDICTIONS.get(traceId);
    }
    if (this.inferenceService && typeof this.inferenceService.getPredictionByTraceIdAsync === 'function') {
      try {
        const rec = await this.inferenceService.getPredictionByTraceIdAsync(traceId);
        if (rec) {
          _AUTHORITATIVE_PREDICTIONS.set(traceId, rec);
          return rec;
        }
      } catch (e) {}
    }
    return this.lookupAuthoritativePrediction(traceId);
  }

  async recordDispositionAsync(payload = {}) {
    const {
      trace_id,
      disposition,
      reason_code,
      operator_id = 'OPERATOR_01',
      comment = '',
      component_id = null,
      lot_id = null,
      operator_role = 'OPERATOR',
      feedback_status = 'RECORDED_ONLY',
      outcome_status = null,
      require_durable_persistence = false
    } = payload;

    // Reject client attempt to override/disable durable persistence if prohibited
    if (payload.client_supplied_require_durable !== undefined) {
      recordAuditEvent("DISPOSITION_REJECTED", { trace_id, reason: "CLIENT_TAINT_REJECTED", field: "require_durable_persistence" });
      const err = new Error("CLIENT_TAINT_REJECTED: Client is not permitted to disable durable persistence for governed dispositions.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Prohibit client-controlled identity fields
    if (payload.component_id !== undefined && payload.component_id !== null) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "CLIENT_CONTROLLED_IDENTITY_PROHIBITED",
        field: "component_id"
      });
      const err = new Error("CLIENT_CONTROLLED_IDENTITY_PROHIBITED: Field 'component_id' cannot be provided by client. Component identity is backend-authoritative.");
      err.statusCode = 400;
      throw err;
    }
    if (payload.lot_id !== undefined && payload.lot_id !== null) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "CLIENT_CONTROLLED_IDENTITY_PROHIBITED",
        field: "lot_id"
      });
      const err = new Error("CLIENT_CONTROLLED_IDENTITY_PROHIBITED: Field 'lot_id' cannot be provided by client. Lot identity is backend-authoritative.");
      err.statusCode = 400;
      throw err;
    }

    // 2. Prohibit client-controlled ML output & ground truth fields
    for (const field of PROHIBITED_CLIENT_ML_FIELDS) {
      if (payload[field] !== undefined && payload[field] !== null) {
        recordAuditEvent("DISPOSITION_REJECTED", {
          trace_id,
          reason: "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED",
          field
        });
        const err = new Error(`CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '${field}' cannot be provided by client. Original ML decision is backend-authoritative.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Role verification
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

    // 4. Trace ID format
    if (!trace_id || !this.traceRegex.test(String(trace_id))) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "INVALID_TRACE_ID"
      });
      const err = new Error(`INVALID_TRACE_ID: trace_id '${trace_id}' does not match required format.`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Disposition enum
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

    // 6. Reason code enum
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

    // 7. Feedback status enum (Must be one of the 5 lifecycle taxonomy states)
    const rawStatus = outcome_status || feedback_status || 'RECORDED_ONLY';
    const statusUpper = String(rawStatus).trim().toUpperCase();
    if (!this.allowedFeedbackStatuses.has(statusUpper)) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "INVALID_FEEDBACK_STATUS",
        feedback_status: rawStatus
      });
      const err = new Error(`INVALID_FEEDBACK_STATUS: '${rawStatus}' is not a valid lifecycle status. Lifecycle states must be one of: RECORDED_ONLY, PENDING_OUTCOME, CONFIRMED, CONTRADICTED, UNRESOLVED.`);
      err.statusCode = 400;
      throw err;
    }

    // 8. Comment length
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

    // 9. Model Provenance Verification
    const modelSha = this.verifyModelProvenance();

    // 10. Backend-Authoritative Trace Lookup
    const authRecord = await this.lookupAuthoritativePredictionAsync(trace_id);
    if (!authRecord) {
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "AUTHORITATIVE_ML_RECORD_NOT_FOUND"
      });
      const err = new Error(`AUTHORITATIVE_ML_RECORD_NOT_FOUND: No authoritative prediction record found for trace_id '${trace_id}'. Dispositions cannot be recorded without an authoritative backend ML record.`);
      err.statusCode = 404;
      throw err;
    }

    // 11. Authoritative Component and Lot Identity Provenance
    const authComponentId = authRecord.component_id || authRecord.die_id;
    const authLotId = authRecord.lot_id;
    if (!authComponentId || !authLotId) {
      const missing = [];
      if (!authComponentId) missing.push("component_id");
      if (!authLotId) missing.push("lot_id");
      recordAuditEvent("DISPOSITION_REJECTED", {
        trace_id,
        reason: "AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND",
        missing_fields: missing
      });
      const err = new Error(`AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND: Authoritative prediction record for trace_id '${trace_id}' is missing required identity field(s): ${missing.join(', ')}. Client-supplied identity must never fill an authoritative identity gap.`);
      err.statusCode = 400;
      throw err;
    }

    // Extract authoritative ML decision fields
    const mlDecision = extractOriginalMlDecision(authRecord) || "UNKNOWN";
    const mlProbRaw = authRecord.probability !== undefined ? authRecord.probability : authRecord.calibrated_probability;
    if (!isValidProbability(mlProbRaw)) {
      recordAuditEvent("DISPOSITION_REJECTED", { trace_id, reason: "INVALID_AUTHORITATIVE_PROBABILITY" });
      const err = new Error("INVALID_AUTHORITATIVE_PROBABILITY: Authoritative prediction record missing valid numeric probability.");
      err.statusCode = 400;
      throw err;
    }
    const mlProb = Number(mlProbRaw);
    const anomalyScore = authRecord.anomaly_score !== undefined ? authRecord.anomaly_score : (authRecord.anomaly_status || null);
    const prognosticSummary = authRecord.prognostic_summary || authRecord.prognostics || authRecord.trajectory_state || null;
    const compId = String(authComponentId);
    const lId = String(authLotId);

    // 12. Conflict Detection across existing disposition history for this trace_id
    const existingHistory = _FEEDBACK_STORE.get(trace_id) || [];
    let hasConflict = false;
    for (const prior of existingHistory) {
      if (prior.disposition !== dispUpper) {
        hasConflict = true;
        break;
      }
    }

    // Mark prior history as having conflict if conflict detected
    if (hasConflict) {
      for (const prior of existingHistory) {
        prior.conflict = true;
        prior.is_conflict = true;
      }
    }

    const dispositionId = `DISP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const timestampIso = new Date().toISOString();

    const dispositionRecord = {
      disposition_id: dispositionId,
      trace_id,
      component_id: compId,
      lot_id: lId,
      operator_id: operator_id || "OPERATOR_01",
      operator_role,
      disposition: dispUpper,
      reason_code: reasonUpper,
      comment: cleanComment,
      created_at: timestampIso,
      model_id_at_decision: "predicta_xgboost_model",
      model_hash_at_decision: modelSha,
      original_ml_decision: mlDecision,
      original_ml_probability: mlProb,
      anomaly_score_at_decision: anomalyScore,
      prognostic_output_at_decision: prognosticSummary,
      decision_at_decision: mlDecision,
      source: "HUMAN_OPERATOR_GATE",
      feedback_status: statusUpper,
      outcome_status: statusUpper,
      conflict: hasConflict,
      is_conflict: hasConflict,
      governance_guarantees: {
        ml_decision_unaltered: true,
        model_retraining_triggered: false,
        thresholds_modified: false,
        split_leakage_prevented: true,
        append_only_preserved: true,
        human_feedback_is_not_ground_truth: true
      }
    };

    // Initial lifecycle event
    const initialLifecycleEvent = {
      event_id: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      disposition_id: dispositionId,
      trace_id,
      previous_status: null,
      new_status: statusUpper,
      changed_by: operator_id || "OPERATOR_01",
      timestamp: timestampIso,
      comment: "Initial disposition recorded"
    };

    // 13. Append-Only In-Memory & Governed Durable DB Storage
    if (!_FEEDBACK_STORE.has(trace_id)) {
      _FEEDBACK_STORE.set(trace_id, []);
    }
    _FEEDBACK_STORE.get(trace_id).push(dispositionRecord);
    _LIFECYCLE_EVENTS.set(dispositionId, [initialLifecycleEvent]);

    const { conflict: _omitConflict, ...dbRecord } = dispositionRecord;

    // Fail-Closed Governed Durable Persistence
    const isPersistenceRequired = require_durable_persistence || process.env.REQUIRE_DURABLE_PERSISTENCE === 'true';
    if (isPersistenceRequired) {
      if (!this.supabase) {
        _FEEDBACK_STORE.get(trace_id).pop();
        _LIFECYCLE_EVENTS.delete(dispositionId);
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id, reason: "PERSISTENCE_ERROR: Durable database connection is required but Supabase client is unconfigured." });
        const err = new Error("PERSISTENCE_ERROR: Durable database connection is required but Supabase client is unconfigured. Governed persistence failed closed.");
        err.statusCode = 500;
        throw err;
      }

      let dispInserted = false;
      try {
        const resDisp = await this.supabase.from('operator_dispositions').insert([dbRecord]);
        if (resDisp && resDisp.error) {
          const msg = resDisp.error.message || String(resDisp.error);
          throw new Error(`PERSISTENCE_ERROR: Failed to durably persist operator disposition to database: ${msg}`);
        }
        dispInserted = true;

        const resEvt = await this.supabase.from('disposition_lifecycle_events').insert([initialLifecycleEvent]);
        if (resEvt && resEvt.error) {
          const msg = resEvt.error.message || String(resEvt.error);
          throw new Error(`PERSISTENCE_ERROR: Failed to durably persist initial lifecycle event to database: ${msg}`);
        }
      } catch (e) {
        // Roll back in-memory state
        _FEEDBACK_STORE.get(trace_id).pop();
        _LIFECYCLE_EVENTS.delete(dispositionId);

        /* Compensating deletion is strictly a failed-transaction cleanup before the disposition has been successfully committed as governed history. It targets only the single generated disposition_id. */
        if (dispInserted && this.supabase) {
          try {
            const delRes = await this.supabase.from('operator_dispositions').delete().eq('disposition_id', dispositionId);
            if (delRes && delRes.error) {
              const delMsg = delRes.error.message || String(delRes.error);
              recordAuditEvent("PERSISTENCE_ROLLBACK_FAILED", {
                trace_id,
                disposition_id: dispositionId,
                reason: `Failed compensating deletion of orphaned disposition record: ${delMsg}`
              });
            }
          } catch (delErr) {
            recordAuditEvent("PERSISTENCE_ROLLBACK_FAILED", {
              trace_id,
              disposition_id: dispositionId,
              reason: `Failed compensating deletion of orphaned disposition record: ${delErr.message || String(delErr)}`
            });
          }
        }

        const msg = e.message || String(e);
        const finalMsg = msg.startsWith('PERSISTENCE_ERROR') ? msg : `PERSISTENCE_ERROR: Failed to durably persist operator disposition: ${msg}`;
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id, reason: finalMsg });
        const err = new Error(finalMsg);
        err.statusCode = 500;
        throw err;
      }
    } else if (this.supabase) {
      let dispInserted = false;
      let insertErr = null;
      try {
        const resDisp = await this.supabase.from('operator_dispositions').insert([dbRecord]);
        if (resDisp && resDisp.error) {
          insertErr = resDisp.error.message || String(resDisp.error);
        } else {
          dispInserted = true;
          const resEvt = await this.supabase.from('disposition_lifecycle_events').insert([initialLifecycleEvent]);
          if (resEvt && resEvt.error) {
            insertErr = resEvt.error.message || String(resEvt.error);
          }
        }
      } catch (e) {
        insertErr = e.message || String(e);
      }
      if (insertErr) {
        _FEEDBACK_STORE.get(trace_id).pop();
        _LIFECYCLE_EVENTS.delete(dispositionId);

        /* Compensating deletion is strictly a failed-transaction cleanup before the disposition has been successfully committed as governed history. It targets only the single generated disposition_id. */
        if (dispInserted && this.supabase) {
          try {
            const delRes = await this.supabase.from('operator_dispositions').delete().eq('disposition_id', dispositionId);
            if (delRes && delRes.error) {
              const delMsg = delRes.error.message || String(delRes.error);
              recordAuditEvent("PERSISTENCE_ROLLBACK_FAILED", {
                trace_id,
                disposition_id: dispositionId,
                reason: `Failed compensating deletion of orphaned disposition record: ${delMsg}`
              });
            }
          } catch (delErr) {
            recordAuditEvent("PERSISTENCE_ROLLBACK_FAILED", {
              trace_id,
              disposition_id: dispositionId,
              reason: `Failed compensating deletion of orphaned disposition record: ${delErr.message || String(delErr)}`
            });
          }
        }

        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id, reason: `PERSISTENCE_ERROR: ${insertErr}` });
        const err = new Error(`PERSISTENCE_ERROR: Failed to durably persist operator disposition to database: ${insertErr}`);
        err.statusCode = 500;
        throw err;
      }
    }

    recordAuditEvent("DISPOSITION_RECORDED", {
      disposition_id: dispositionRecord.disposition_id,
      trace_id,
      operator_id: dispositionRecord.operator_id,
      disposition: dispUpper,
      original_ml_decision: mlDecision,
      conflict: hasConflict,
      total_records_for_trace: _FEEDBACK_STORE.get(trace_id).length
    });

    return {
      ...dispositionRecord,
      lifecycle_events: [initialLifecycleEvent]
    };
  }

  async getDispositionAsync(traceId) {
    if (!traceId) return null;
    let history = _FEEDBACK_STORE.get(traceId) || [];
    
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('operator_dispositions').select('*').eq('trace_id', traceId);
        if (data && data.length > 0) {
          history = data;
          if (!_FEEDBACK_STORE.has(traceId)) {
            _FEEDBACK_STORE.set(traceId, data);
          }
        }
        const { data: evtData } = await this.supabase.from('disposition_lifecycle_events').select('*').eq('trace_id', traceId);
        if (evtData && evtData.length > 0) {
          for (const evt of evtData) {
            if (!_LIFECYCLE_EVENTS.has(evt.disposition_id)) {
              _LIFECYCLE_EVENTS.set(evt.disposition_id, []);
            }
            const list = _LIFECYCLE_EVENTS.get(evt.disposition_id);
            if (!list.some(e => e.event_id === evt.event_id)) {
              list.push(evt);
            }
          }
        }
      } catch (e) {
        // Fall back to in-memory
      }
    }

    if (!history || history.length === 0) {
      return null;
    }

    let hasConflict = false;
    const dispSet = new Set();
    for (const rec of history) {
      dispSet.add(rec.disposition);
    }
    hasConflict = dispSet.size > 1;

    const formattedHistory = history.map(rec => {
      const events = _LIFECYCLE_EVENTS.get(rec.disposition_id) || [];
      const currentStatus = events.length > 0 ? events[events.length - 1].new_status : (rec.feedback_status || 'RECORDED_ONLY');
      return {
        ...rec,
        feedback_status: currentStatus,
        outcome_status: currentStatus,
        conflict: hasConflict,
        is_conflict: hasConflict,
        lifecycle_events: [...events]
      };
    });

    return {
      trace_id: traceId,
      total_dispositions: formattedHistory.length,
      has_conflict: hasConflict,
      conflict: hasConflict,
      latest: formattedHistory[formattedHistory.length - 1],
      history: formattedHistory
    };
  }

  async updateFeedbackStatusAsync(traceId, dispositionId, newStatus, operatorId = "OPERATOR_01", comment = "", require_durable_persistence = false) {
    const history = _FEEDBACK_STORE.get(traceId);
    if (!history || history.length === 0) {
      const err = new Error(`NOT_FOUND: No disposition records found for trace_id '${traceId}'.`);
      err.statusCode = 404;
      throw err;
    }

    const statusUpper = String(newStatus).trim().toUpperCase();
    if (!this.allowedFeedbackStatuses.has(statusUpper)) {
      const err = new Error(`INVALID_FEEDBACK_STATUS: '${newStatus}' is not a valid lifecycle status. Lifecycle states must be one of: RECORDED_ONLY, PENDING_OUTCOME, CONFIRMED, CONTRADICTED, UNRESOLVED.`);
      err.statusCode = 400;
      throw err;
    }

    const targetRec = history.find(r => r.disposition_id === dispositionId) || history[history.length - 1];

    // Retrieve existing lifecycle transition events for target disposition
    let events = _LIFECYCLE_EVENTS.get(targetRec.disposition_id) || [];
    const currentStatus = events.length > 0 ? events[events.length - 1].new_status : (targetRec.feedback_status || "RECORDED_ONLY");

    // Lifecycle state transition validation
    const allowedTransitions = this.contract.lifecycle_transitions || {
      "RECORDED_ONLY": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
      "PENDING_OUTCOME": ["CONFIRMED", "CONTRADICTED", "UNRESOLVED"],
      "CONFIRMED": [],
      "CONTRADICTED": [],
      "UNRESOLVED": ["PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED"]
    };

    const validNext = allowedTransitions[currentStatus] || [];
    if (currentStatus !== statusUpper && !validNext.includes(statusUpper)) {
      const err = new Error(`INVALID_LIFECYCLE_TRANSITION: Cannot transition feedback status from '${currentStatus}' to '${statusUpper}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Append-Only Status Update Event creation (ORIGINAL DISPOSITION RECORD REMAINS UNMUTATED)
    const transitionEvent = {
      event_id: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      disposition_id: targetRec.disposition_id,
      trace_id: traceId,
      previous_status: currentStatus,
      new_status: statusUpper,
      changed_by: operatorId || "OPERATOR_01",
      timestamp: new Date().toISOString(),
      comment: String(comment || '').trim()
    };

    events.push(transitionEvent);
    _LIFECYCLE_EVENTS.set(targetRec.disposition_id, events);

    // Fail-Closed Durable Persistence for Lifecycle Event
    const isPersistenceRequired = require_durable_persistence || process.env.REQUIRE_DURABLE_PERSISTENCE === 'true';
    let insertErr = null;
    if (isPersistenceRequired) {
      if (!this.supabase) {
        insertErr = "Durable database connection is required but Supabase client is unconfigured.";
      } else {
        try {
          const res = await this.supabase.from('disposition_lifecycle_events').insert([transitionEvent]);
          if (res && res.error) {
            insertErr = res.error.message || String(res.error);
          }
        } catch (e) {
          insertErr = e.message || String(e);
        }
      }
    } else if (this.supabase) {
      try {
        const res = await this.supabase.from('disposition_lifecycle_events').insert([transitionEvent]);
        if (res && res.error) {
          insertErr = res.error.message || String(res.error);
        }
      } catch (e) {
        insertErr = e.message || String(e);
      }
    }

    if (insertErr) {
      // Rollback in-memory lifecycle event append
      events.pop();
      if (events.length === 0) {
        _LIFECYCLE_EVENTS.delete(targetRec.disposition_id);
      } else {
        _LIFECYCLE_EVENTS.set(targetRec.disposition_id, events);
      }
      recordAuditEvent("PERSISTENCE_FAILED_CLOSED", {
        trace_id: traceId,
        disposition_id: targetRec.disposition_id,
        reason: `PERSISTENCE_ERROR: Failed to durably persist lifecycle event to database: ${insertErr}`
      });
      const err = new Error(`PERSISTENCE_ERROR: Failed to durably persist lifecycle event to database: ${insertErr}`);
      err.statusCode = 500;
      throw err;
    }

    recordAuditEvent("FEEDBACK_STATUS_UPDATED", {
      trace_id: traceId,
      disposition_id: targetRec.disposition_id,
      previous_status: currentStatus,
      new_status: statusUpper,
      updated_by: operatorId,
      comment
    });

    return {
      ...targetRec,
      feedback_status: statusUpper,
      outcome_status: statusUpper,
      lifecycle_events: [...events]
    };
  }

  async evaluateDispositionGovernanceAsync(traceId, options = {}) {
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DEMO === 'true';
    const requireDurable = options.require_durable_persistence !== undefined
      ? Boolean(options.require_durable_persistence)
      : (!isTestEnv || process.env.REQUIRE_DURABLE_PERSISTENCE === 'true');

    if (requireDurable && !this.supabase) {
      const err = new Error("PERSISTENCE_ERROR: Durable database connection is required for governed evaluation but Supabase client is unconfigured.");
      err.statusCode = 500;
      throw err;
    }

    const rejectionReasons = [];

    // 1. Trace ID format validation
    if (!traceId || !this.traceRegex.test(String(traceId))) {
      rejectionReasons.push("INVALID_TRACE_ID_FORMAT");
    }

    // 2. Model Provenance Verification
    let currentModelSha = null;
    try {
      currentModelSha = this.verifyModelProvenance();
    } catch (e) {
      rejectionReasons.push("INVALID_MODEL_PROVENANCE");
    }

    // 3. Authoritative Backend ML Prediction Lookup
    const authPrediction = traceId ? await this.lookupAuthoritativePredictionAsync(traceId) : null;
    if (!authPrediction) {
      rejectionReasons.push("AUTHORITATIVE_ML_RECORD_NOT_FOUND");
    } else {
      const compId = authPrediction.component_id || authPrediction.die_id;
      const lotId = authPrediction.lot_id;
      if (!compId || !lotId) {
        rejectionReasons.push("MISSING_AUTHORITATIVE_IDENTITY");
      }
      const mlDec = extractOriginalMlDecision(authPrediction);
      if (mlDec === null) {
        rejectionReasons.push("MISSING_ORIGINAL_ML_DECISION");
      }
      const mlProbRaw = authPrediction.probability !== undefined ? authPrediction.probability : authPrediction.calibrated_probability;
      if (!isValidProbability(mlProbRaw)) {
        rejectionReasons.push("MISSING_ORIGINAL_ML_PROBABILITY");
      }
    }

    // 4. Durable Disposition & Lifecycle History Reconstruction
    let history = [];
    let eventsMap = new Map();
    let dbFetchFailed = false;
    let dbErrorMsg = null;

    if (this.supabase) {
      try {
        const { data: dispData, error: dispErr } = await this.supabase.from('operator_dispositions').select('*').eq('trace_id', traceId);
        if (dispErr) {
          dbFetchFailed = true;
          dbErrorMsg = dispErr.message || String(dispErr);
        } else {
          history = dispData || [];
        }

        const { data: evtData, error: evtErr } = await this.supabase.from('disposition_lifecycle_events').select('*').eq('trace_id', traceId);
        if (evtErr) {
          dbFetchFailed = true;
          dbErrorMsg = evtErr.message || String(evtErr);
        } else if (evtData && evtData.length > 0) {
          for (const evt of evtData) {
            if (!eventsMap.has(evt.disposition_id)) {
              eventsMap.set(evt.disposition_id, []);
            }
            eventsMap.get(evt.disposition_id).push(evt);
          }
        }
      } catch (e) {
        dbFetchFailed = true;
        dbErrorMsg = e.message || String(e);
      }

      if (dbFetchFailed) {
        const err = new Error(`PERSISTENCE_ERROR: Failed to reconstruct durable history from database: ${dbErrorMsg}`);
        err.statusCode = 500;
        throw err;
      }
    } else {
      history = _FEEDBACK_STORE.get(traceId) || [];
      eventsMap = _LIFECYCLE_EVENTS;
    }

    if (!history || history.length === 0) {
      rejectionReasons.push("NO_OPERATOR_DISPOSITION_RECORD");
    }

    if (rejectionReasons.length > 0) {
      return {
        success: true,
        trace_id: String(traceId || ''),
        governance_classification: "REJECTED_GOVERNANCE",
        rejection_reasons: Array.from(new Set(rejectionReasons)),
        evaluation_candidate: null,
        governance_guarantees: {
          no_automatic_retraining: true,
          no_threshold_modification: true,
          no_fusion_weight_modification: true,
          no_conformal_recalibration: true,
          human_disagreement_is_not_ground_truth: true,
          test_set_isolation_enforced: true,
          append_only_preserved: true
        }
      };
    }

    // 5. Conflict Governance Check & Provenance Audit across operator history
    const dispSet = new Set();
    let hasExplicitConflictFlag = false;

    for (const rec of history) {
      dispSet.add(rec.disposition);
      if (rec.conflict || rec.is_conflict) {
        hasExplicitConflictFlag = true;
      }
      if (currentModelSha && rec.model_hash_at_decision !== currentModelSha) {
        rejectionReasons.push("INVALID_MODEL_PROVENANCE");
      }
      if (rec.ground_truth !== undefined || rec.is_ground_truth !== undefined || rec.ground_truth_label !== undefined) {
        rejectionReasons.push("CLIENT_TAINT_REJECTED");
      }
    }

    if (dispSet.size > 1 || hasExplicitConflictFlag) {
      rejectionReasons.push("UNRESOLVED_GOVERNANCE_CONFLICT: Multiple conflicting operator dispositions exist for trace.");
    }

    // 6. Lifecycle Events & Transition History Verification
    const latestRecord = history[history.length - 1];
    const events = (eventsMap instanceof Map ? eventsMap.get(latestRecord.disposition_id) : eventsMap[latestRecord.disposition_id]) || [];

    if (!events || events.length === 0) {
      rejectionReasons.push("MISSING_LIFECYCLE_HISTORY: Durable lifecycle event history cannot be reconstructed.");
    } else {
      const currentStatus = events[events.length - 1].new_status;
      if (currentStatus === 'UNRESOLVED') {
        rejectionReasons.push("UNRESOLVED_LIFECYCLE_STATUS: Disposition status UNRESOLVED is not eligible for offline review.");
      }
      if (!this.allowedFeedbackStatuses.has(currentStatus)) {
        rejectionReasons.push("INVALID_LIFECYCLE_STATUS");
      }
    }

    // 7. Test Set / Benchmark Dataset Isolation Check
    const protectedTraceIdRegex = /^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)/i;
    if (protectedTraceIdRegex.test(String(traceId))) {
      rejectionReasons.push("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.");
    }

    const uniqueRejectionReasons = Array.from(new Set(rejectionReasons));
    const isEligible = uniqueRejectionReasons.length === 0;
    const classification = isEligible ? "ELIGIBLE_FOR_OFFLINE_REVIEW" : "REJECTED_GOVERNANCE";

    let candidate = null;
    if (isEligible) {
      const currentStatus = events.length > 0 ? events[events.length - 1].new_status : (latestRecord.feedback_status || 'RECORDED_ONLY');
      candidate = {
        trace_id: String(traceId),
        disposition_id: latestRecord.disposition_id,
        component_id: latestRecord.component_id,
        lot_id: latestRecord.lot_id,
        operator_id: latestRecord.operator_id,
        created_at: latestRecord.created_at,
        model_id_at_decision: latestRecord.model_id_at_decision || "predicta_xgboost_model",
        model_hash_at_decision: latestRecord.model_hash_at_decision,
        original_ml_decision: latestRecord.original_ml_decision,
        original_ml_probability: latestRecord.original_ml_probability,
        anomaly_score_at_decision: latestRecord.anomaly_score_at_decision || null,
        prognostic_output_at_decision: latestRecord.prognostic_output_at_decision || null,
        disposition: latestRecord.disposition,
        reason_code: latestRecord.reason_code,
        lifecycle_status: currentStatus,
        conflict: false,
        governance_classification: "ELIGIBLE_FOR_OFFLINE_REVIEW",
        rejection_reasons: [],
        evaluation_only: true,
        production_effect: false,
        ground_truth_status: "NOT_ESTABLISHED",
        source: "HUMAN_FEEDBACK_OFFLINE_EVALUATION_CANDIDATE"
      };
    }

    return {
      success: true,
      trace_id: String(traceId),
      governance_classification: classification,
      rejection_reasons: uniqueRejectionReasons,
      evaluation_candidate: candidate,
      governance_guarantees: {
        no_automatic_retraining: true,
        no_threshold_modification: true,
        no_fusion_weight_modification: true,
        no_conformal_recalibration: true,
        human_disagreement_is_not_ground_truth: true,
        test_set_isolation_enforced: true,
        append_only_preserved: true
      }
    };
  }

  listDispositions() {
    const all = [];
    for (const history of _FEEDBACK_STORE.values()) {
      all.push(...history);
    }
    return all;
  }

  registerAuthoritativePrediction(predictionRecord) {
    registerAuthoritativePrediction(predictionRecord);
  }

  getAuditLogs() {
    return [..._AUDIT_LOGS];
  }

  async registerOutcomeEvidenceAsync(payload = {}) {
    const {
      trace_id,
      disposition_id,
      evidence_type = 'SYNTHETIC_PHYSICS_GROUND_TRUTH',
      evidence_status = 'EVIDENCE_RECORDED',
      evidence_source = 'SYSTEM',
      evidence_timestamp = new Date().toISOString(),
      recorded_by = 'OPERATOR_01',
      provenance_metadata = {},
      source_record_identifier = null,
      require_durable_persistence = false
    } = payload;

    // 1. Prohibit client-controlled ground truth & ML fields
    const prohibitedFields = [
      'ground_truth', 'ground_truth_label', 'is_ground_truth',
      'ml_decision_snapshot', 'ml_decision', 'original_ml_decision', 'decision',
      'probability', 'calibrated_probability', 'raw_probability',
      'model_hash', 'model_hash_at_decision', 'model_id', 'model_id_at_decision'
    ];
    for (const field of prohibitedFields) {
      if (payload[field] !== undefined && payload[field] !== null) {
        recordAuditEvent("EVIDENCE_REJECTED", { trace_id, reason: "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", field });
        const err = new Error(`CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '${field}' cannot be provided by client.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 2. Trace ID format check
    if (!trace_id || !this.traceRegex.test(String(trace_id))) {
      const err = new Error(`INVALID_TRACE_ID: trace_id '${trace_id}' does not match required format.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Protected test set check
    const protectedTraceIdRegex = /^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)/i;
    if (protectedTraceIdRegex.test(String(trace_id))) {
      recordAuditEvent("EVIDENCE_REJECTED", { trace_id, reason: "TEST_SET_ISOLATION_PROTECTED" });
      const err = new Error("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.");
      err.statusCode = 400;
      throw err;
    }

    // 4. Evidence taxonomy check
    const typeUpper = String(evidence_type).trim().toUpperCase();
    const allowedTypes = new Set(this.contract.evidence_type_taxonomy || ['SYNTHETIC_PHYSICS_GROUND_TRUTH', 'ATE_RETEST_LOG', 'QUALIFIED_LAB_REPORT']);
    if (!allowedTypes.has(typeUpper)) {
      const err = new Error(`INVALID_EVIDENCE_TYPE: '${evidence_type}' must be one of: ${Array.from(allowedTypes).sort().join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const statusUpper = String(evidence_status).trim().toUpperCase();
    const allowedStatuses = new Set(this.contract.evidence_status_taxonomy || ['EVIDENCE_RECORDED', 'EVIDENCE_REJECTED', 'EVIDENCE_INSUFFICIENT']);
    if (!allowedStatuses.has(statusUpper)) {
      const err = new Error(`INVALID_EVIDENCE_STATUS: '${evidence_status}' must be one of: ${Array.from(allowedStatuses).sort().join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Evaluate Task 2 Governance Eligibility
    const gov = await this.evaluateDispositionGovernanceAsync(trace_id, { require_durable_persistence });
    if (gov.governance_classification === 'REJECTED_GOVERNANCE') {
      recordAuditEvent("EVIDENCE_REJECTED", { trace_id, reasons: gov.rejection_reasons });
      const err = new Error(`REJECTED_GOVERNANCE: Cannot register outcome evidence for trace ineligible under Task 2 governance. Reasons: ${gov.rejection_reasons.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const candidate = gov.evaluation_candidate;
    const targetDispId = disposition_id || (candidate ? candidate.disposition_id : `DISP-${trace_id}`);
    const evidenceId = `EVD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const timestampIso = new Date().toISOString();

    const evidenceRecord = {
      evidence_id: evidenceId,
      trace_id: String(trace_id),
      disposition_id: String(targetDispId),
      evidence_type: typeUpper,
      evidence_status: statusUpper,
      evidence_source: String(evidence_source || 'SYSTEM'),
      evidence_timestamp: evidence_timestamp || timestampIso,
      recorded_timestamp: timestampIso,
      recorded_by: String(recorded_by || 'OPERATOR_01'),
      provenance_metadata: {
        ...(provenance_metadata || {}),
        synthetic_disclosure: typeUpper === 'SYNTHETIC_PHYSICS_GROUND_TRUTH'
          ? "SYNTHETIC_PHYSICS_GROUND_TRUTH: Retrospective evaluation dataset telemetry. Not physical-fab validation."
          : null
      },
      source_record_identifier: source_record_identifier ? String(source_record_identifier) : null,
      created_at: timestampIso
    };

    if (!_EVIDENCE_STORE.has(trace_id)) {
      _EVIDENCE_STORE.set(trace_id, []);
    }
    _EVIDENCE_STORE.get(trace_id).push(evidenceRecord);

    const isPersistenceRequired = require_durable_persistence || process.env.REQUIRE_DURABLE_PERSISTENCE === 'true';
    if (isPersistenceRequired) {
      if (!this.supabase) {
        _EVIDENCE_STORE.get(trace_id).pop();
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id, reason: "PERSISTENCE_ERROR: Supabase client unconfigured." });
        const err = new Error("PERSISTENCE_ERROR: Durable database connection is required for outcome evidence persistence but Supabase client is unconfigured.");
        err.statusCode = 500;
        throw err;
      }
      try {
        const res = await this.supabase.from('disposition_outcome_evidence').insert([evidenceRecord]);
        if (res && res.error) {
          throw new Error(res.error.message || String(res.error));
        }
      } catch (e) {
        _EVIDENCE_STORE.get(trace_id).pop();
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id, reason: `PERSISTENCE_ERROR: ${e.message}` });
        const err = new Error(`PERSISTENCE_ERROR: Failed to durably persist outcome evidence to database: ${e.message}`);
        err.statusCode = 500;
        throw err;
      }
    } else if (this.supabase) {
      try {
        await this.supabase.from('disposition_outcome_evidence').insert([evidenceRecord]);
      } catch (e) {
        // Log & proceed in memory-only test mode
      }
    }

    recordAuditEvent("EVIDENCE_RECORDED", { trace_id, evidence_id: evidenceId, evidence_type: typeUpper });
    return evidenceRecord;
  }

  async getOutcomeEvidenceAsync(traceId) {
    if (!traceId) return [];
    let list = _EVIDENCE_STORE.get(traceId) || [];
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('disposition_outcome_evidence').select('*').eq('trace_id', traceId);
        if (data && data.length > 0) {
          list = data;
          _EVIDENCE_STORE.set(traceId, data);
        }
      } catch (e) {}
    }
    return list;
  }

  async adjudicateOutcomeAsync(traceId, payload = {}) {
    const {
      adjudicator_identity = 'ADJUDICATOR_01',
      adjudicator_role = 'QUALITY_ENGINEER',
      proposed_outcome = null,
      rationale = '',
      require_durable_persistence = false
    } = payload;

    // 1. Prohibit client-controlled ground truth & ML fields
    const prohibitedFields = [
      'ground_truth', 'ground_truth_label', 'is_ground_truth',
      'ml_decision_snapshot', 'ml_decision', 'original_ml_decision', 'decision',
      'probability', 'calibrated_probability', 'raw_probability',
      'model_hash', 'model_hash_at_decision', 'model_id', 'model_id_at_decision'
    ];
    for (const field of prohibitedFields) {
      if (payload[field] !== undefined && payload[field] !== null) {
        recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reason: "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", field });
        const err = new Error(`CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '${field}' cannot be provided by client.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 2. Trace ID format check
    if (!traceId || !this.traceRegex.test(String(traceId))) {
      const err = new Error(`INVALID_TRACE_ID: trace_id '${traceId}' does not match required format.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Protected test set check
    const protectedTraceIdRegex = /^(BENCHMARK_|TEST_SET_|PROTECTED_SPLIT_)/i;
    if (protectedTraceIdRegex.test(String(traceId))) {
      recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reason: "TEST_SET_ISOLATION_PROTECTED" });
      const err = new Error("TEST_SET_ISOLATION_PROTECTED: Trace is part of protected evaluation/benchmark split.");
      err.statusCode = 400;
      throw err;
    }

    // 4. Adjudicator Role Check
    const allowedAdjudicatorRoles = new Set(
      (this.contract.security_rules && this.contract.security_rules.allowed_adjudicator_roles) ||
      ['QUALITY_ENGINEER', 'RELIABILITY_LEAD', 'ADJUDICATOR', 'ADMIN']
    );
    const roleUpper = String(adjudicator_role || '').trim().toUpperCase();
    if (!allowedAdjudicatorRoles.has(roleUpper)) {
      recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reason: "UNAUTHORIZED_ROLE", role: adjudicator_role });
      const err = new Error(`UNAUTHORIZED_ROLE: Role '${adjudicator_role}' is not authorized to perform outcome adjudication. Adjudication requires one of: ${Array.from(allowedAdjudicatorRoles).sort().join(', ')}.`);
      err.statusCode = 403;
      throw err;
    }

    // 5. Evaluate Task 2 Governance Eligibility
    const gov = await this.evaluateDispositionGovernanceAsync(traceId, { require_durable_persistence });
    if (gov.governance_classification === 'REJECTED_GOVERNANCE') {
      recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reasons: gov.rejection_reasons });
      const err = new Error(`REJECTED_GOVERNANCE: Cannot adjudicate trace ineligible under Task 2 governance. Reasons: ${gov.rejection_reasons.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    const candidate = gov.evaluation_candidate;

    // 6. Reconstruct Evidence
    const evidenceList = await this.getOutcomeEvidenceAsync(traceId);
    if (!evidenceList || evidenceList.length === 0) {
      recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reason: "MISSING_OUTCOME_EVIDENCE" });
      const err = new Error(`MISSING_OUTCOME_EVIDENCE: No outcome evidence records found for trace_id '${traceId}'. Adjudication requires registered outcome evidence.`);
      err.statusCode = 400;
      throw err;
    }

    const acceptedEvidence = evidenceList.filter(e => e.evidence_status === 'EVIDENCE_RECORDED');
    if (acceptedEvidence.length === 0) {
      recordAuditEvent("ADJUDICATION_REJECTED", { trace_id: traceId, reason: "INSUFFICIENT_OUTCOME_EVIDENCE" });
      const err = new Error(`INSUFFICIENT_OUTCOME_EVIDENCE: All evidence for trace_id '${traceId}' is rejected or insufficient.`);
      err.statusCode = 400;
      throw err;
    }

    // 7. Evidence & Operator Conflict Analysis
    let outcomePassCount = 0;
    let outcomeFailCount = 0;
    for (const ev of acceptedEvidence) {
      const srcStr = String(ev.source_record_identifier || ev.evidence_type || '').toUpperCase();
      const meta = ev.provenance_metadata || {};
      const resVal = String(meta.result || meta.outcome || meta.physical_outcome || srcStr).toUpperCase();
      if (resVal.includes('PASS') || resVal.includes('ACCEPT')) outcomePassCount++;
      if (resVal.includes('FAIL') || resVal.includes('REJECT')) outcomeFailCount++;
    }

    const hasEvidenceConflict = outcomePassCount > 0 && outcomeFailCount > 0;
    const cleanProposed = proposed_outcome ? String(proposed_outcome).trim().toUpperCase() : null;

    let adjStatus = "PENDING_ADJUDICATION";
    let validatedOutcome = null;
    let gtStatus = "NOT_ESTABLISHED";

    if (hasEvidenceConflict && (!cleanProposed || !rationale)) {
      adjStatus = "UNRESOLVED_AMBIGUITY";
      validatedOutcome = null;
      gtStatus = "UNRESOLVED";
    } else {
      const targetOutcome = cleanProposed || (outcomeFailCount > 0 ? "FAIL" : "PASS");
      if (targetOutcome === "PASS" || targetOutcome === "FAIL") {
        validatedOutcome = targetOutcome;
        adjStatus = targetOutcome === "PASS" ? "VALIDATED_PASS" : "VALIDATED_FAIL";
        gtStatus = "VALIDATED_GROUND_TRUTH";
      } else {
        adjStatus = "UNRESOLVED_AMBIGUITY";
        validatedOutcome = null;
        gtStatus = "UNRESOLVED";
      }
    }

    const adjudicationId = `ADJ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const timestampIso = new Date().toISOString();

    const adjudicationRecord = {
      adjudication_id: adjudicationId,
      trace_id: String(traceId),
      disposition_id: candidate.disposition_id,
      evidence_ids: acceptedEvidence.map(e => e.evidence_id),
      adjudicator_identity: String(adjudicator_identity),
      adjudicator_role: roleUpper,
      adjudication_status: adjStatus,
      proposed_outcome: cleanProposed,
      validated_outcome: validatedOutcome,
      ground_truth_status: gtStatus,
      rationale: String(rationale || '').trim(),
      provenance: {
        model_id_at_decision: candidate.model_id_at_decision || 'predicta_xgboost_model',
        model_hash_at_decision: candidate.model_hash_at_decision,
        original_ml_decision: candidate.original_ml_decision,
        original_ml_probability: candidate.original_ml_probability,
        evidence_sources: acceptedEvidence.map(e => ({ evidence_id: e.evidence_id, type: e.evidence_type, source: e.evidence_source })),
        synthetic_disclosure: acceptedEvidence.some(e => e.evidence_type === 'SYNTHETIC_PHYSICS_GROUND_TRUTH')
          ? "SYNTHETIC_PHYSICS_GROUND_TRUTH: Retrospective evaluation dataset telemetry. Not physical-fab validation."
          : null
      },
      created_at: timestampIso,
      governance_guarantees: {
        no_automatic_retraining: true,
        no_threshold_modification: true,
        no_fusion_weight_modification: true,
        no_conformal_recalibration: true,
        operator_is_not_ground_truth: true,
        test_set_isolation_enforced: true,
        append_only_preserved: true
      }
    };

    if (!_ADJUDICATION_STORE.has(traceId)) {
      _ADJUDICATION_STORE.set(traceId, []);
    }
    _ADJUDICATION_STORE.get(traceId).push(adjudicationRecord);

    const isPersistenceRequired = require_durable_persistence || process.env.REQUIRE_DURABLE_PERSISTENCE === 'true';
    if (isPersistenceRequired) {
      if (!this.supabase) {
        _ADJUDICATION_STORE.get(traceId).pop();
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id: traceId, reason: "PERSISTENCE_ERROR: Supabase client unconfigured." });
        const err = new Error("PERSISTENCE_ERROR: Durable database connection is required for adjudication persistence but Supabase client is unconfigured.");
        err.statusCode = 500;
        throw err;
      }
      try {
        const res = await this.supabase.from('disposition_adjudications').insert([adjudicationRecord]);
        if (res && res.error) {
          throw new Error(res.error.message || String(res.error));
        }
      } catch (e) {
        _ADJUDICATION_STORE.get(traceId).pop();
        recordAuditEvent("PERSISTENCE_FAILED_CLOSED", { trace_id: traceId, reason: `PERSISTENCE_ERROR: ${e.message}` });
        const err = new Error(`PERSISTENCE_ERROR: Failed to durably persist adjudication to database: ${e.message}`);
        err.statusCode = 500;
        throw err;
      }
    } else if (this.supabase) {
      try {
        await this.supabase.from('disposition_adjudications').insert([adjudicationRecord]);
      } catch (e) {}
    }

    recordAuditEvent("OUTCOME_ADJUDICATED", { trace_id: traceId, adjudication_id: adjudicationId, status: adjStatus, ground_truth_status: gtStatus });
    return adjudicationRecord;
  }

  async getAdjudicationAsync(traceId) {
    if (!traceId) return null;
    let list = _ADJUDICATION_STORE.get(traceId) || [];
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('disposition_adjudications').select('*').eq('trace_id', traceId);
        if (data && data.length > 0) {
          list = data;
          _ADJUDICATION_STORE.set(traceId, data);
        }
      } catch (e) {}
    }
    return list.length > 0 ? list[list.length - 1] : null;
  }

  async generateOfflineEvaluationManifestAsync(traceId, options = {}) {
    const gov = await this.evaluateDispositionGovernanceAsync(traceId, options);
    if (gov.governance_classification === 'REJECTED_GOVERNANCE') {
      const err = new Error(`REJECTED_GOVERNANCE: Cannot generate offline evaluation manifest for ineligible trace '${traceId}'.`);
      err.statusCode = 400;
      throw err;
    }

    const adjudication = await this.getAdjudicationAsync(traceId);
    if (!adjudication || adjudication.ground_truth_status !== 'VALIDATED_GROUND_TRUTH') {
      const err = new Error(`INELIGIBLE_FOR_OFFLINE_MANIFEST: Trace '${traceId}' does not have VALIDATED_GROUND_TRUTH status.`);
      err.statusCode = 400;
      throw err;
    }

    const evidenceList = await this.getOutcomeEvidenceAsync(traceId);
    const candidate = gov.evaluation_candidate;
    const timestampIso = new Date().toISOString();

    return {
      manifest_version: "1.0.0",
      trace_id: String(traceId),
      component_id: candidate.component_id,
      lot_id: candidate.lot_id,
      original_ml_decision: candidate.original_ml_decision,
      original_ml_probability: candidate.original_ml_probability,
      model_hash_at_decision: candidate.model_hash_at_decision,
      evidence_ids: evidenceList.map(e => e.evidence_id),
      adjudication_id: adjudication.adjudication_id,
      validated_outcome: adjudication.validated_outcome,
      ground_truth_status: adjudication.ground_truth_status,
      evidence_provenance: evidenceList.map(e => ({ evidence_id: e.evidence_id, type: e.evidence_type, source: e.evidence_source })),
      adjudication_provenance: adjudication.provenance,
      evaluation_only: true,
      production_effect: false,
      dataset_split_isolation_enforced: true,
      created_at: timestampIso
    };
  }
}

const _EVIDENCE_STORE = new Map();
const _ADJUDICATION_STORE = new Map();

module.exports = {
  HumanDispositionManagerJS,
  recordAuditEvent,
  registerAuthoritativePrediction,
  DISPOSITION_CONTRACT_PATH,
  _FEEDBACK_STORE,
  _LIFECYCLE_EVENTS,
  _AUTHORITATIVE_PREDICTIONS,
  _EVIDENCE_STORE,
  _ADJUDICATION_STORE,
  isValidProbability,
  extractOriginalMlDecision
};
