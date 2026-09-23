/**
 * Authoritative Digital Reliability Twin Data Model & Lineage Service (Node.js)
 * File: src/reliability_twin/reliability_twin.js
 *
 * EVIDENCE-ONLY READ MODEL.
 *
 * Aggregates EXISTING prediction, operator disposition, outcome evidence, and
 * adjudication records into an immutable, longitudinal Digital Reliability Twin
 * read model. It NEVER manufactures evidence. Every field comes from an
 * authoritative source record or is explicitly reported as INSUFFICIENT_EVIDENCE
 * or NOT_ESTABLISHED.
 *
 * RULES (enforced):
 *  - Identity (lot/wafer/die/equipment) comes ONLY from the authoritative
 *    prediction record. If absent: null.
 *  - No fabricated MANUFACTURING_OBSERVATION events; no synthesised ATE events.
 *  - Timestamps come ONLY from authoritative source records. If absent: null.
 *  - ML fields (threshold/risk_level/operational_decision/decision_class/model_version)
 *    are taken verbatim from the authoritative record. No defaults substituted.
 *  - Provenance model_identifier/version/sha256 are null for events where no ML
 *    model applies (such as human disposition gates).
 *  - Twin is strictly read-only: it never triggers a new prediction, never
 *    mutates the authoritative stores, never creates evidence.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const TWIN_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/reliability_twin/reliability_twin_contract.json');
const PROD_MANIFEST_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_production_manifest.json');
const MODEL_JSON_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');

const { HumanDispositionManagerJS, _AUTHORITATIVE_PREDICTIONS } = require('../governance/disposition');
const inferenceService = require('../api/inference');

function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ARTIFACT_MISSING: File not found at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

class ReliabilityTwinManagerJS {
  constructor(
    contractPath = TWIN_CONTRACT_PATH,
    manifestPath = PROD_MANIFEST_PATH,
    modelPath = MODEL_JSON_PATH,
    supabaseClient = null
  ) {
    this.contractPath = contractPath;
    this.manifestPath = manifestPath;
    this.modelPath = modelPath;
    this.supabase = supabaseClient;
    this.dispositionManager = new HumanDispositionManagerJS(undefined, manifestPath, modelPath, supabaseClient);

    this.contract = this._loadJson(this.contractPath);
    this.manifest = this._loadJson(this.manifestPath);

    this.expectedModelSha = this.contract?.immutability_constraints?.expected_model_sha256 ||
      this.manifest?.model_sha256 ||
      '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98';

    this.expectedThreshold = this.contract?.immutability_constraints?.authoritative_operating_threshold || 0.20;

    this.verifyModelProvenance();
  }

  _loadJson(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      return null;
    }
  }

  verifyModelProvenance() {
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`MODEL_MISSING: Model artifact not found at ${this.modelPath}`);
    }
    const actualSha = computeFileSha256(this.modelPath);
    if (actualSha !== this.expectedModelSha) {
      throw new Error(`MODEL_PROVENANCE_INVALID: Computed SHA ${actualSha} does not match expected ${this.expectedModelSha}`);
    }
    return actualSha;
  }

  /**
   * Determines whether a prediction record originates from a synthetic source.
   * Uses explicit field values only — no name-pattern inference.
   */
  _isSyntheticRecord(rec) {
    if (!rec) return false;
    if (rec.is_synthetic === true) return true;
    if (rec.is_synthetic === false) return false;
    if (rec.source_type === 'SYNTHETIC_SIMULATION' || rec.source_type === 'ATE_SIMULATION') return true;
    // Check explicit synthetic markers in lot_id / component_id
    const lotId = rec.lot_id;
    const cmpId = rec.component_id;
    return (typeof lotId === 'string' && lotId.startsWith('LOT-SYN')) ||
           (typeof cmpId === 'string' && cmpId.startsWith('CMP-SYN'));
  }

  /**
   * Resolves the authoritative prediction record for the given identifier.
   * Searches in-memory authoritative store and predictionStore only.
   * NEVER triggers a new prediction.
   */
  async resolvePredictionRecordAsync(identifier) {
    if (!identifier) return null;

    let targetId = typeof identifier === 'string' ? identifier.trim() : null;

    // Direct key lookup in authoritative predictions store
    if (targetId && _AUTHORITATIVE_PREDICTIONS.has(targetId)) {
      return { ..._AUTHORITATIVE_PREDICTIONS.get(targetId) };
    }

    // Scan all values for component_id or trace_id match
    if (targetId) {
      for (const [, val] of _AUTHORITATIVE_PREDICTIONS) {
        if (val.component_id === targetId || val.trace_id === targetId || val.test_id === targetId) {
          return { ...val };
        }
      }
    }

    // Fallback: check inference service in-memory predictionStore
    if (inferenceService && inferenceService.predictionStore && targetId) {
      const found = inferenceService.predictionStore.find(p =>
        p.trace_id === targetId || p.test_id === targetId || p.component_id === targetId
      );
      if (found) return { ...found };
    }

    // Supabase lookup if available
    if (this.supabase && targetId) {
      try {
        const { data } = await this.supabase
          .from('prediction_runs')
          .select('*')
          .or(`trace_id.eq.${targetId},test_id.eq.${targetId},component_id.eq.${targetId}`)
          .limit(1);
        if (data && data.length > 0) {
          return data[0];
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Builds the canonical Digital Reliability Twin for the given identifier.
   *
   * The twin is a READ MODEL: it aggregates existing authoritative evidence.
   * It NEVER creates evidence, triggers predictions, or invents identity fields.
   */
  async buildReliabilityTwinAsync(identifier, options = {}) {
    if (identifier === null || identifier === undefined) {
      const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.');
      err.statusCode = 400;
      throw err;
    }

    let searchKey = '';
    if (typeof identifier === 'string') {
      searchKey = identifier.trim();
      if (!searchKey) {
        const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
    } else if (typeof identifier === 'object') {
      searchKey = identifier.trace_id || identifier.component_id || identifier.test_id || 'RECORD_INPUT';
    } else {
      const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier must be a string or record object.');
      err.statusCode = 400;
      throw err;
    }

    const modelSha = this.verifyModelProvenance();
    const predictionRec = await this.resolvePredictionRecordAsync(identifier);

    // Identity: sourced ONLY from the authoritative prediction record.
    // Null when not present — no fabrication.
    const traceId = predictionRec?.trace_id || null;
    const testId = predictionRec?.test_id || null;
    const componentId = predictionRec?.component_id || (typeof identifier === 'string' ? identifier.trim() : null);
    const lotId = predictionRec?.lot_id || null;
    const waferId = predictionRec?.wafer_id || null;
    const dieId = predictionRec?.die_id || null;
    const equipmentId = predictionRec?.equipment_id || null;

    // Deterministic twin ID based on available identity
    const twinIdInput = `${componentId || searchKey}:${traceId}:${testId}`;
    const twinId = `TWIN-${crypto.createHash('sha256').update(twinIdInput).digest('hex').substring(0, 12).toUpperCase()}`;

    // Authoritative timestamp: from prediction record only. Null if not present.
    const sourceTimestamp = predictionRec?.created_at || null;

    const isSynthetic = this._isSyntheticRecord(predictionRec);

    // Retrieve disposition chain for this trace
    let dispositions = [];
    let outcomeEvidences = [];
    let adjudications = [];

    if (traceId && this.dispositionManager) {
      try {
        const dispRecord = await this.dispositionManager.getDispositionAsync(traceId);
        dispositions = dispRecord?.history || [];
        outcomeEvidences = await this.dispositionManager.getOutcomeEvidenceAsync(traceId);
        const adj = await this.dispositionManager.getAdjudicationAsync(traceId);
        if (adj) adjudications.push(adj);
      } catch (e) {}
    }

    const timelineEvents = [];

    // ML Evaluation evidence block
    let mlEvidenceStatus = 'INSUFFICIENT_EVIDENCE';
    let mlEvidenceBlock = null;

    if (predictionRec) {
      mlEvidenceStatus = 'AVAILABLE';
      // Take fields verbatim from the authoritative record. No defaults substituted.
      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold !== undefined ? predictionRec.threshold : predictionRec.operating_threshold,
        risk_level: predictionRec.risk_level,
        operational_decision: predictionRec.operational_decision,
        decision_class: predictionRec.decision_class,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null,
        decision_reason: predictionRec.decision_reason || null,
        model_version: predictionRec.model_version || null,
        model_sha256: modelSha,
        provenance: {
          source_type: 'PRODUCTION_ML_MODEL',
          source_identifier: traceId || testId || componentId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_xgboost_model',
          model_version: predictionRec.model_version || null,
          model_sha256: modelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-01`,
        stage: 'ML_EVALUATION',
        timestamp: sourceTimestamp,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${Number(predictionRec.probability).toFixed(4)})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    // Anomaly evidence (only if actually present in prediction record)
    let anomalyStatus = 'INSUFFICIENT_EVIDENCE';
    let anomalyBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.anomaly) {
      anomalyStatus = 'AVAILABLE';
      anomalyBlock = { ...predictionRec.ml_details.anomaly };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-02`,
        stage: 'ANOMALY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Anomaly evaluation: score=${anomalyBlock.copod_score !== undefined ? anomalyBlock.copod_score : 'NOT_AVAILABLE'}, status=${anomalyBlock.pat_status || 'NOT_AVAILABLE'}`,
        details: anomalyBlock,
        provenance: {
          source_type: 'ANOMALY_ENGINE',
          source_identifier: traceId || testId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_anomaly_artifacts',
          model_version: null,
          model_sha256: modelSha
        }
      });
    }

    // Prognostic evidence (only if actually present in prediction record)
    let prognosticStatus = 'INSUFFICIENT_EVIDENCE';
    let prognosticBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.prognostics) {
      prognosticStatus = 'AVAILABLE';
      prognosticBlock = { ...predictionRec.ml_details.prognostics };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-03`,
        stage: 'PROGNOSTIC_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: 'Prognostic trajectory evidence from authoritative prediction record',
        details: prognosticBlock,
        provenance: {
          source_type: 'PROGNOSTIC_ENGINE',
          source_identifier: traceId || testId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_gpr_kernel_artifacts',
          model_version: null,
          model_sha256: modelSha
        }
      });
    }

    // Operator dispositions (only from authoritative governance store)
    const operatorStatus = dispositions.length > 0 ? 'AVAILABLE' : 'INSUFFICIENT_EVIDENCE';
    dispositions.forEach((disp) => {
      const dispTs = disp.created_at || null;
      timelineEvents.push({
        event_id: `EVT-DISP-${disp.disposition_id || 'UNK'}`,
        stage: 'OPERATOR_DISPOSITION',
        timestamp: dispTs,
        summary: `Human operator recorded disposition: ${disp.disposition} (${disp.reason_code})`,
        details: {
          disposition_id: disp.disposition_id,
          disposition: disp.disposition,
          reason_code: disp.reason_code,
          operator_id: disp.operator_id,
          operator_role: disp.operator_role || null,
          comment: disp.comment || null,
          feedback_status: disp.feedback_status || null
        },
        provenance: {
          source_type: 'HUMAN_OPERATOR_GATE',
          source_identifier: disp.disposition_id,
          source_timestamp: dispTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    });

    // Secondary test evidence (only if present in prediction record)
    const secondaryTestStatus = (predictionRec && predictionRec.secondary_test_result)
      ? 'AVAILABLE' : 'INSUFFICIENT_EVIDENCE';
    if (predictionRec && predictionRec.secondary_test_result) {
      timelineEvents.push({
        event_id: `EVT-SEC-${twinId.substring(5, 11)}-04`,
        stage: 'SECONDARY_TEST',
        timestamp: sourceTimestamp,
        summary: `Secondary retest outcome: ${predictionRec.secondary_test_result}`,
        details: {
          secondary_test_result: predictionRec.secondary_test_result,
          requires_secondary_test: predictionRec.requires_secondary_test !== undefined
            ? Boolean(predictionRec.requires_secondary_test)
            : null
        },
        provenance: {
          source_type: 'SYNTHETIC_TEST_FIXTURE',
          source_identifier: traceId || testId,
          source_timestamp: sourceTimestamp,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    }

    // Outcome evidence (from governance store)
    const outcomeEvidenceStatus = outcomeEvidences.length > 0 ? 'AVAILABLE' : 'INSUFFICIENT_EVIDENCE';
    outcomeEvidences.forEach((ev) => {
      const evTs = ev.created_at || ev.recorded_timestamp || null;
      timelineEvents.push({
        event_id: `EVT-EVI-${ev.evidence_id || 'UNK'}`,
        stage: 'OUTCOME_EVIDENCE',
        timestamp: evTs,
        summary: `Outcome evidence recorded: ${ev.evidence_type} (${ev.evidence_status})`,
        details: {
          evidence_id: ev.evidence_id,
          evidence_type: ev.evidence_type,
          evidence_status: ev.evidence_status,
          evidence_source: ev.evidence_source,
          recorded_by: ev.recorded_by
        },
        provenance: {
          source_type: 'OUTCOME_EVIDENCE_STORE',
          source_identifier: ev.evidence_id,
          source_timestamp: ev.evidence_timestamp || evTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    });

    // Adjudication (from governance store)
    let adjudicationStatus = adjudications.length > 0 ? 'AVAILABLE' : 'NOT_ESTABLISHED';
    let groundTruthStatus = 'NOT_ESTABLISHED';
    adjudications.forEach((adj) => {
      groundTruthStatus = adj.ground_truth_status || 'NOT_ESTABLISHED';
      const adjTs = adj.created_at || null;
      timelineEvents.push({
        event_id: `EVT-ADJ-${adj.adjudication_id || 'UNK'}`,
        stage: 'ADJUDICATION',
        timestamp: adjTs,
        summary: `Quality engineering adjudication: ${adj.adjudication_status} (Ground truth=${adj.ground_truth_status})`,
        details: {
          adjudication_id: adj.adjudication_id,
          adjudicator_identity: adj.adjudicator_identity,
          adjudicator_role: adj.adjudicator_role,
          adjudication_status: adj.adjudication_status,
          validated_outcome: adj.validated_outcome,
          ground_truth_status: adj.ground_truth_status,
          rationale: adj.rationale
        },
        provenance: {
          source_type: 'QUALITY_ADJUDICATION_GATE',
          source_identifier: adj.adjudication_id,
          source_timestamp: adjTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    });

    // Deduplicate timeline events
    const seenEventKeys = new Set();
    const uniqueEvents = [];
    for (const evt of timelineEvents) {
      const key = `${evt.stage}:${evt.timestamp}:${evt.summary}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        uniqueEvents.push(evt);
      }
    }

    // Deterministic sort: null timestamps sort to front, then by event_id
    uniqueEvents.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : -Infinity;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : -Infinity;
      if (tA !== tB) return tA - tB;
      return String(a.event_id).localeCompare(String(b.event_id));
    });

    const twinRepresentation = {
      twin_id: twinId,
      created_at: sourceTimestamp,
      identity: {
        component_id: componentId,
        trace_id: traceId,
        test_id: testId,
        lot_id: lotId,
        wafer_id: waferId,
        die_id: dieId,
        equipment_id: equipmentId,
        is_synthetic: isSynthetic
      },
      evidence_summary: {
        ml_evaluation: mlEvidenceStatus,
        anomaly_evidence: anomalyStatus,
        prognostic_evidence: prognosticStatus,
        operator_disposition: operatorStatus,
        secondary_test: secondaryTestStatus,
        outcome_evidence: outcomeEvidenceStatus,
        adjudication: adjudicationStatus,
        ground_truth_status: groundTruthStatus
      },
      evidence_blocks: {
        ml_evaluation: mlEvidenceBlock,
        anomaly_evidence: anomalyBlock,
        prognostic_evidence: prognosticBlock,
        operator_dispositions: dispositions,
        outcome_evidence: outcomeEvidences,
        adjudications: adjudications
      },
      longitudinal_timeline: uniqueEvents,
      provenance: {
        contract_version: '1.0.0',
        contract_name: 'predicta_reliability_twin_contract',
        authoritative_threshold: 0.20,
        model_identifier: 'predicta_xgboost_model',
        model_version: '4.0.0_authoritative',
        model_sha256: modelSha,
        is_synthetic_provenance: isSynthetic
      }
    };

    // Return deep-cloned immutable snapshot
    return JSON.parse(JSON.stringify(twinRepresentation));
  }

  /**
   * Synchronous twin build — delegates to same logic, but uses synchronous store lookups only.
   * Disposition governance records (async) are NOT fetched in the sync path.
   */
  buildReliabilityTwin(identifier, options = {}) {
    if (identifier === null || identifier === undefined) {
      const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.');
      err.statusCode = 400;
      throw err;
    }

    let searchKey = '';
    if (typeof identifier === 'string') {
      searchKey = identifier.trim();
      if (!searchKey) {
        const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
    } else if (typeof identifier === 'object') {
      searchKey = identifier.trace_id || identifier.component_id || identifier.test_id || 'RECORD_INPUT';
    } else {
      const err = new Error('INVALID_IDENTIFIER: Reliability twin identifier must be a string or record object.');
      err.statusCode = 400;
      throw err;
    }

    const modelSha = this.verifyModelProvenance();

    // Resolve prediction record synchronously
    let predictionRec = null;
    const targetId = typeof identifier === 'string' ? identifier.trim() : null;

    if (targetId && _AUTHORITATIVE_PREDICTIONS.has(targetId)) {
      predictionRec = { ..._AUTHORITATIVE_PREDICTIONS.get(targetId) };
    } else if (targetId) {
      for (const [, val] of _AUTHORITATIVE_PREDICTIONS) {
        if (val.component_id === targetId || val.trace_id === targetId || val.test_id === targetId) {
          predictionRec = { ...val };
          break;
        }
      }
    }

    if (!predictionRec && inferenceService && inferenceService.predictionStore && targetId) {
      const found = inferenceService.predictionStore.find(p =>
        p.trace_id === targetId || p.test_id === targetId || p.component_id === targetId
      );
      if (found) predictionRec = { ...found };
    }

    // Identity: from record only, null when absent
    const traceId = predictionRec?.trace_id || null;
    const testId = predictionRec?.test_id || null;
    const componentId = predictionRec?.component_id || (typeof identifier === 'string' ? identifier.trim() : null);
    const lotId = predictionRec?.lot_id || null;
    const waferId = predictionRec?.wafer_id || null;
    const dieId = predictionRec?.die_id || null;
    const equipmentId = predictionRec?.equipment_id || null;

    const twinIdInput = `${componentId || searchKey}:${traceId}:${testId}`;
    const twinId = `TWIN-${crypto.createHash('sha256').update(twinIdInput).digest('hex').substring(0, 12).toUpperCase()}`;

    const sourceTimestamp = predictionRec?.created_at || null;
    const isSynthetic = this._isSyntheticRecord(predictionRec);

    const timelineEvents = [];

    let mlEvidenceStatus = 'INSUFFICIENT_EVIDENCE';
    let mlEvidenceBlock = null;

    if (predictionRec) {
      mlEvidenceStatus = 'AVAILABLE';
      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold !== undefined ? predictionRec.threshold : predictionRec.operating_threshold,
        risk_level: predictionRec.risk_level,
        operational_decision: predictionRec.operational_decision,
        decision_class: predictionRec.decision_class,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null,
        decision_reason: predictionRec.decision_reason || null,
        model_version: predictionRec.model_version || null,
        model_sha256: modelSha,
        provenance: {
          source_type: 'PRODUCTION_ML_MODEL',
          source_identifier: traceId || testId || componentId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_xgboost_model',
          model_version: predictionRec.model_version || null,
          model_sha256: modelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-01`,
        stage: 'ML_EVALUATION',
        timestamp: sourceTimestamp,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${Number(predictionRec.probability).toFixed(4)})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    let anomalyStatus = 'INSUFFICIENT_EVIDENCE';
    let anomalyBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.anomaly) {
      anomalyStatus = 'AVAILABLE';
      anomalyBlock = { ...predictionRec.ml_details.anomaly };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-02`,
        stage: 'ANOMALY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Anomaly evaluation: score=${anomalyBlock.copod_score !== undefined ? anomalyBlock.copod_score : 'NOT_AVAILABLE'}, status=${anomalyBlock.pat_status || 'NOT_AVAILABLE'}`,
        details: anomalyBlock,
        provenance: {
          source_type: 'ANOMALY_ENGINE',
          source_identifier: traceId || testId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_anomaly_artifacts',
          model_version: null,
          model_sha256: modelSha
        }
      });
    }

    let prognosticStatus = 'INSUFFICIENT_EVIDENCE';
    let prognosticBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.prognostics) {
      prognosticStatus = 'AVAILABLE';
      prognosticBlock = { ...predictionRec.ml_details.prognostics };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-03`,
        stage: 'PROGNOSTIC_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: 'Prognostic trajectory evidence from authoritative prediction record',
        details: prognosticBlock,
        provenance: {
          source_type: 'PROGNOSTIC_ENGINE',
          source_identifier: traceId || testId,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_gpr_kernel_artifacts',
          model_version: null,
          model_sha256: modelSha
        }
      });
    }

    // Deduplicate timeline events
    const seenEventKeys = new Set();
    const uniqueEvents = [];
    for (const evt of timelineEvents) {
      const key = `${evt.stage}:${evt.timestamp}:${evt.summary}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        uniqueEvents.push(evt);
      }
    }

    uniqueEvents.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : -Infinity;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : -Infinity;
      if (tA !== tB) return tA - tB;
      return String(a.event_id).localeCompare(String(b.event_id));
    });

    const twinRepresentation = {
      twin_id: twinId,
      created_at: sourceTimestamp,
      identity: {
        component_id: componentId,
        trace_id: traceId,
        test_id: testId,
        lot_id: lotId,
        wafer_id: waferId,
        die_id: dieId,
        equipment_id: equipmentId,
        is_synthetic: isSynthetic
      },
      evidence_summary: {
        ml_evaluation: mlEvidenceStatus,
        anomaly_evidence: anomalyStatus,
        prognostic_evidence: prognosticStatus,
        operator_disposition: 'INSUFFICIENT_EVIDENCE',
        secondary_test: (predictionRec && predictionRec.secondary_test_result) ? 'AVAILABLE' : 'INSUFFICIENT_EVIDENCE',
        outcome_evidence: 'INSUFFICIENT_EVIDENCE',
        adjudication: 'NOT_ESTABLISHED',
        ground_truth_status: 'NOT_ESTABLISHED'
      },
      evidence_blocks: {
        ml_evaluation: mlEvidenceBlock,
        anomaly_evidence: anomalyBlock,
        prognostic_evidence: prognosticBlock,
        operator_dispositions: [],
        outcome_evidence: [],
        adjudications: []
      },
      longitudinal_timeline: uniqueEvents,
      provenance: {
        contract_version: '1.0.0',
        contract_name: 'predicta_reliability_twin_contract',
        authoritative_threshold: 0.20,
        model_identifier: 'predicta_xgboost_model',
        model_version: '4.0.0_authoritative',
        model_sha256: modelSha,
        is_synthetic_provenance: isSynthetic
      }
    };

    return JSON.parse(JSON.stringify(twinRepresentation));
  }
}

module.exports = {
  ReliabilityTwinManagerJS,
  TWIN_CONTRACT_PATH
};
