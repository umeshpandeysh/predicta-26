/**
 * Authoritative Digital Reliability Twin Data Model & Lineage Service (Node.js)
 * File: src/reliability_twin/reliability_twin.js
 *
 * EVIDENCE-ONLY READ MODEL.
 *
 * Fully implements the 10-stage evidence chain defined by:
 *   ml/reliability_twin/reliability_twin_contract.json
 *
 * 10 Timeline Stages:
 *  1. MANUFACTURING_OBSERVATION
 *  2. ML_EVALUATION
 *  3. ANOMALY_EVIDENCE
 *  4. PROGNOSTIC_EVIDENCE
 *  5. PHYSICS_RELIABILITY_EVIDENCE
 *  6. RISK_FUSION_DECISION
 *  7. OPERATOR_DISPOSITION
 *  8. SECONDARY_TEST
 *  9. OUTCOME_EVIDENCE
 * 10. ADJUDICATION
 *
 * STRICT NON-FABRICATION RULES (enforced):
 *  - Identity (component/lot/wafer/die/equipment) comes ONLY from authoritative records.
 *    If unrecorded: null. An arbitrary lookup string does NOT become component_id.
 *  - Timestamps come ONLY from authoritative source records. If absent: null.
 *  - Historical model SHA and version come from the prediction record when available.
 *  - Physics and Risk-Fusion evidence are consumed VERBATIM if they exist in the record;
 *    if absent, they evaluate to INSUFFICIENT_EVIDENCE / null with zero timeline events.
 *  - NEVER triggers new live inference, physics evaluation, or risk calculations during Twin build.
 *  - Twin is strictly read-only and immutable.
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
   */
  _isSyntheticRecord(rec) {
    if (!rec) return false;
    if (rec.is_synthetic === true) return true;
    if (rec.is_synthetic === false) return false;
    if (rec.source_type === 'SYNTHETIC_SIMULATION' || rec.source_type === 'ATE_SIMULATION') return true;
    const lotId = rec.lot_id;
    const cmpId = rec.component_id;
    return (typeof lotId === 'string' && lotId.startsWith('LOT-SYN')) ||
           (typeof cmpId === 'string' && cmpId.startsWith('CMP-SYN'));
  }

  /**
   * Resolves the authoritative prediction record for the given identifier.
   * Searches in-memory authoritative store and predictionStore only.
   * NEVER triggers a new prediction or live recomputation.
   */
  async resolvePredictionRecordAsync(identifier) {
    if (!identifier) return null;

    let targetId = typeof identifier === 'string' ? identifier.trim() : null;

    // Direct key lookup in authoritative predictions store
    if (targetId && _AUTHORITATIVE_PREDICTIONS.has(targetId)) {
      return { ..._AUTHORITATIVE_PREDICTIONS.get(targetId) };
    }

    // Scan all values for component_id, trace_id, or test_id match
    if (targetId) {
      for (const [, val] of _AUTHORITATIVE_PREDICTIONS) {
        if (val.component_id === targetId || val.trace_id === targetId || val.test_id === targetId) {
          return { ...val };
        }
      }
    }

    // Check inference service in-memory predictionStore
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
   * Builds the canonical Digital Reliability Twin read model for the given identifier.
   *
   * The twin is a READ MODEL: it aggregates existing authoritative evidence across
   * all 10 defined timeline stages. It NEVER creates evidence, triggers predictions,
   * or runs live physics/risk computations.
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

    const verifiedCurrentModelSha = this.verifyModelProvenance();
    const predictionRec = await this.resolvePredictionRecordAsync(identifier);
    const isRegistered = predictionRec !== null && predictionRec !== undefined;

    // Identity: sourced ONLY from the authoritative prediction record.
    // An arbitrary query string does NOT become authoritative component_id.
    const traceId = predictionRec?.trace_id || null;
    const testId = predictionRec?.test_id || null;
    const componentId = predictionRec?.component_id || null;
    const lotId = predictionRec?.lot_id || null;
    const waferId = predictionRec?.wafer_id || null;
    const dieId = predictionRec?.die_id || null;
    const equipmentId = predictionRec?.equipment_id || null;

    // Deterministic twin ID based on available identity
    const twinIdInput = `${componentId || searchKey}:${traceId || 'NO_TRACE'}:${testId || 'NO_TEST'}`;
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

    // =========================================================================
    // STAGE 1: MANUFACTURING_OBSERVATION
    // =========================================================================
    let mfgStatus = 'INSUFFICIENT_EVIDENCE';
    let mfgBlock = null;
    if (predictionRec && predictionRec.manufacturing_observation) {
      mfgStatus = 'AVAILABLE';
      mfgBlock = { ...predictionRec.manufacturing_observation };
      const mfgTs = mfgBlock.timestamp || sourceTimestamp;
      timelineEvents.push({
        event_id: `EVT-MFG-${twinId.substring(5, 11)}-01`,
        stage: 'MANUFACTURING_OBSERVATION',
        timestamp: mfgTs,
        summary: mfgBlock.summary || 'ATE manufacturing observation telemetry recorded',
        details: mfgBlock,
        provenance: {
          source_type: isSynthetic ? 'SYNTHETIC_SIMULATION' : 'ATE_TELEMETRY',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: mfgTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    }

    // =========================================================================
    // STAGE 2: ML_EVALUATION
    // =========================================================================
    let mlEvidenceStatus = 'INSUFFICIENT_EVIDENCE';
    let mlEvidenceBlock = null;

    if (predictionRec && predictionRec.prediction !== undefined) {
      mlEvidenceStatus = 'AVAILABLE';
      const historicalModelSha = predictionRec.model_sha256 || null;
      const historicalModelVersion = predictionRec.model_version || null;

      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold !== undefined ? predictionRec.threshold : predictionRec.operating_threshold,
        risk_level: predictionRec.risk_level || null,
        operational_decision: predictionRec.operational_decision || null,
        decision_class: predictionRec.decision_class || null,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null,
        decision_reason: predictionRec.decision_reason || null,
        model_version: historicalModelVersion,
        model_sha256: historicalModelSha,
        provenance: {
          source_type: 'PRODUCTION_ML_MODEL',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_xgboost_model',
          model_version: historicalModelVersion,
          model_sha256: historicalModelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-02`,
        stage: 'ML_EVALUATION',
        timestamp: sourceTimestamp,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${Number(predictionRec.probability).toFixed(4)})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    // =========================================================================
    // STAGE 3: ANOMALY_EVIDENCE
    // =========================================================================
    let anomalyStatus = 'INSUFFICIENT_EVIDENCE';
    let anomalyBlock = null;
    const anomalyData = predictionRec?.ml_details?.anomaly_detection ||
                        predictionRec?.ml_details?.anomaly ||
                        predictionRec?.anomaly_evidence;
    if (anomalyData) {
      anomalyStatus = 'AVAILABLE';
      anomalyBlock = { ...anomalyData };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-03`,
        stage: 'ANOMALY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Anomaly evaluation: score=${anomalyBlock.copod_score !== undefined ? anomalyBlock.copod_score : (anomalyBlock.score !== undefined ? anomalyBlock.score : 'NOT_AVAILABLE')}, status=${anomalyBlock.pat_status || anomalyBlock.status || 'NOT_AVAILABLE'}`,
        details: anomalyBlock,
        provenance: {
          source_type: 'ANOMALY_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_anomaly_artifacts',
          model_version: null,
          model_sha256: null
        }
      });
    }

    // =========================================================================
    // STAGE 4: PROGNOSTIC_EVIDENCE
    // =========================================================================
    let prognosticStatus = 'INSUFFICIENT_EVIDENCE';
    let prognosticBlock = null;
    const prognosticData = predictionRec?.ml_details?.drift_prediction ||
                           predictionRec?.ml_details?.prognostics ||
                           predictionRec?.prognostic_evidence;
    if (prognosticData) {
      prognosticStatus = 'AVAILABLE';
      prognosticBlock = { ...prognosticData };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-04`,
        stage: 'PROGNOSTIC_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: 'Prognostic trajectory degradation evidence from authoritative record',
        details: prognosticBlock,
        provenance: {
          source_type: 'PROGNOSTIC_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_gpr_kernel_artifacts',
          model_version: null,
          model_sha256: null
        }
      });
    }

    // =========================================================================
    // STAGE 5: PHYSICS_RELIABILITY_EVIDENCE
    // =========================================================================
    let physicsStatus = 'INSUFFICIENT_EVIDENCE';
    let physicsBlock = null;
    const physicsData = predictionRec?.ml_details?.physics ||
                        predictionRec?.physics_evidence ||
                        predictionRec?.physics_reliability;
    if (physicsData) {
      physicsStatus = 'AVAILABLE';
      physicsBlock = { ...physicsData };
      timelineEvents.push({
        event_id: `EVT-PHYS-${twinId.substring(5, 11)}-05`,
        stage: 'PHYSICS_RELIABILITY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Physics reliability consistency: ${physicsBlock.physics_consistency_status || 'EVALUATED'} (score=${physicsBlock.physics_consistency_score !== undefined ? physicsBlock.physics_consistency_score : 'N/A'})`,
        details: physicsBlock,
        provenance: {
          source_type: 'PHYSICS_AGING_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_physics_reliability_engine',
          model_version: '1.0.0',
          model_sha256: null
        }
      });
    }

    // =========================================================================
    // STAGE 6: RISK_FUSION_DECISION
    // =========================================================================
    let riskFusionStatus = 'INSUFFICIENT_EVIDENCE';
    let riskFusionBlock = null;
    const riskFusionData = predictionRec?.ml_details?.risk_engine?.governed_risk_fusion ||
                           predictionRec?.governed_risk_fusion ||
                           predictionRec?.risk_fusion_decision;
    if (riskFusionData) {
      riskFusionStatus = 'AVAILABLE';
      riskFusionBlock = { ...riskFusionData };
      timelineEvents.push({
        event_id: `EVT-RF-${twinId.substring(5, 11)}-06`,
        stage: 'RISK_FUSION_DECISION',
        timestamp: sourceTimestamp,
        summary: `Governed risk fusion decision: disposition=${riskFusionBlock.disposition || 'UNKNOWN'}, risk_score=${riskFusionBlock.risk_score !== undefined ? riskFusionBlock.risk_score : 'N/A'}`,
        details: riskFusionBlock,
        provenance: {
          source_type: 'RISK_FUSION_GATE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_governed_risk_fusion',
          model_version: riskFusionBlock.contract_version || '1.0.0',
          model_sha256: riskFusionBlock.contract_sha256 || null
        }
      });
    }

    // =========================================================================
    // STAGE 7: OPERATOR_DISPOSITION
    // =========================================================================
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
          source_identifier: disp.disposition_id || traceId,
          source_timestamp: dispTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    });

    // =========================================================================
    // STAGE 8: SECONDARY_TEST
    // =========================================================================
    const secondaryTestStatus = (predictionRec && predictionRec.secondary_test_result)
      ? 'AVAILABLE' : 'INSUFFICIENT_EVIDENCE';
    let secondaryTestBlock = null;
    if (predictionRec && predictionRec.secondary_test_result) {
      secondaryTestBlock = {
        secondary_test_result: predictionRec.secondary_test_result,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null
      };
      // Allowed source types from contract: ATE_RETEST_SIMULATOR or SYNTHETIC_SIMULATION
      const secSourceType = isSynthetic ? 'SYNTHETIC_SIMULATION' : 'ATE_RETEST_SIMULATOR';
      timelineEvents.push({
        event_id: `EVT-SEC-${twinId.substring(5, 11)}-08`,
        stage: 'SECONDARY_TEST',
        timestamp: sourceTimestamp,
        summary: `Secondary retest outcome: ${predictionRec.secondary_test_result}`,
        details: secondaryTestBlock,
        provenance: {
          source_type: secSourceType,
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    }

    // =========================================================================
    // STAGE 9: OUTCOME_EVIDENCE
    // =========================================================================
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

    // =========================================================================
    // STAGE 10: ADJUDICATION
    // =========================================================================
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
        requested_identifier: searchKey,
        identity_status: isRegistered ? 'REGISTERED' : 'UNREGISTERED',
        is_synthetic: isSynthetic
      },
      evidence_summary: {
        manufacturing_observation: mfgStatus,
        ml_evaluation: mlEvidenceStatus,
        anomaly_evidence: anomalyStatus,
        prognostic_evidence: prognosticStatus,
        physics_reliability: physicsStatus,
        risk_fusion: riskFusionStatus,
        operator_disposition: operatorStatus,
        secondary_test: secondaryTestStatus,
        outcome_evidence: outcomeEvidenceStatus,
        adjudication: adjudicationStatus,
        ground_truth_status: groundTruthStatus
      },
      evidence_blocks: {
        manufacturing_observation: mfgBlock,
        ml_evaluation: mlEvidenceBlock,
        anomaly_evidence: anomalyBlock,
        prognostic_evidence: prognosticBlock,
        physics_reliability: physicsBlock,
        risk_fusion: riskFusionBlock,
        operator_dispositions: dispositions,
        secondary_test: secondaryTestBlock,
        outcome_evidence: outcomeEvidences,
        adjudications: adjudications
      },
      longitudinal_timeline: uniqueEvents,
      provenance: {
        contract_version: '1.0.0',
        contract_name: 'predicta_reliability_twin_contract',
        authoritative_operating_threshold: 0.20,
        historical_model_version: predictionRec?.model_version || null,
        historical_model_sha256: predictionRec?.model_sha256 || null,
        system_verified_model_sha256: verifiedCurrentModelSha,
        is_synthetic_provenance: isSynthetic
      }
    };

    // Return deep-cloned immutable snapshot
    return JSON.parse(JSON.stringify(twinRepresentation));
  }

  /**
   * Synchronous twin build — delegates to synchronous store lookups only.
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

    const verifiedCurrentModelSha = this.verifyModelProvenance();

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

    const isRegistered = predictionRec !== null && predictionRec !== undefined;
    const traceId = predictionRec?.trace_id || null;
    const testId = predictionRec?.test_id || null;
    const componentId = predictionRec?.component_id || null;
    const lotId = predictionRec?.lot_id || null;
    const waferId = predictionRec?.wafer_id || null;
    const dieId = predictionRec?.die_id || null;
    const equipmentId = predictionRec?.equipment_id || null;

    const twinIdInput = `${componentId || searchKey}:${traceId || 'NO_TRACE'}:${testId || 'NO_TEST'}`;
    const twinId = `TWIN-${crypto.createHash('sha256').update(twinIdInput).digest('hex').substring(0, 12).toUpperCase()}`;

    const sourceTimestamp = predictionRec?.created_at || null;
    const isSynthetic = this._isSyntheticRecord(predictionRec);

    const timelineEvents = [];

    // Stage 1: Manufacturing Observation
    let mfgStatus = 'INSUFFICIENT_EVIDENCE';
    let mfgBlock = null;
    if (predictionRec && predictionRec.manufacturing_observation) {
      mfgStatus = 'AVAILABLE';
      mfgBlock = { ...predictionRec.manufacturing_observation };
      const mfgTs = mfgBlock.timestamp || sourceTimestamp;
      timelineEvents.push({
        event_id: `EVT-MFG-${twinId.substring(5, 11)}-01`,
        stage: 'MANUFACTURING_OBSERVATION',
        timestamp: mfgTs,
        summary: mfgBlock.summary || 'ATE manufacturing observation telemetry recorded',
        details: mfgBlock,
        provenance: {
          source_type: isSynthetic ? 'SYNTHETIC_SIMULATION' : 'ATE_TELEMETRY',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: mfgTs,
          model_identifier: null,
          model_version: null,
          model_sha256: null
        }
      });
    }

    // Stage 2: ML Evaluation
    let mlEvidenceStatus = 'INSUFFICIENT_EVIDENCE';
    let mlEvidenceBlock = null;

    if (predictionRec && predictionRec.prediction !== undefined) {
      mlEvidenceStatus = 'AVAILABLE';
      const historicalModelSha = predictionRec.model_sha256 || null;
      const historicalModelVersion = predictionRec.model_version || null;

      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold !== undefined ? predictionRec.threshold : predictionRec.operating_threshold,
        risk_level: predictionRec.risk_level || null,
        operational_decision: predictionRec.operational_decision || null,
        decision_class: predictionRec.decision_class || null,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null,
        decision_reason: predictionRec.decision_reason || null,
        model_version: historicalModelVersion,
        model_sha256: historicalModelSha,
        provenance: {
          source_type: 'PRODUCTION_ML_MODEL',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_xgboost_model',
          model_version: historicalModelVersion,
          model_sha256: historicalModelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-02`,
        stage: 'ML_EVALUATION',
        timestamp: sourceTimestamp,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${Number(predictionRec.probability).toFixed(4)})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    // Stage 3: Anomaly Evidence
    let anomalyStatus = 'INSUFFICIENT_EVIDENCE';
    let anomalyBlock = null;
    const anomalyData = predictionRec?.ml_details?.anomaly_detection ||
                        predictionRec?.ml_details?.anomaly ||
                        predictionRec?.anomaly_evidence;
    if (anomalyData) {
      anomalyStatus = 'AVAILABLE';
      anomalyBlock = { ...anomalyData };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-03`,
        stage: 'ANOMALY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Anomaly evaluation: score=${anomalyBlock.copod_score !== undefined ? anomalyBlock.copod_score : (anomalyBlock.score !== undefined ? anomalyBlock.score : 'NOT_AVAILABLE')}, status=${anomalyBlock.pat_status || anomalyBlock.status || 'NOT_AVAILABLE'}`,
        details: anomalyBlock,
        provenance: {
          source_type: 'ANOMALY_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_anomaly_artifacts',
          model_version: null,
          model_sha256: null
        }
      });
    }

    // Stage 4: Prognostic Evidence
    let prognosticStatus = 'INSUFFICIENT_EVIDENCE';
    let prognosticBlock = null;
    const prognosticData = predictionRec?.ml_details?.drift_prediction ||
                           predictionRec?.ml_details?.prognostics ||
                           predictionRec?.prognostic_evidence;
    if (prognosticData) {
      prognosticStatus = 'AVAILABLE';
      prognosticBlock = { ...prognosticData };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-04`,
        stage: 'PROGNOSTIC_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: 'Prognostic trajectory degradation evidence from authoritative record',
        details: prognosticBlock,
        provenance: {
          source_type: 'PROGNOSTIC_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_gpr_kernel_artifacts',
          model_version: null,
          model_sha256: null
        }
      });
    }

    // Stage 5: Physics Reliability Evidence
    let physicsStatus = 'INSUFFICIENT_EVIDENCE';
    let physicsBlock = null;
    const physicsData = predictionRec?.ml_details?.physics ||
                        predictionRec?.physics_evidence ||
                        predictionRec?.physics_reliability;
    if (physicsData) {
      physicsStatus = 'AVAILABLE';
      physicsBlock = { ...physicsData };
      timelineEvents.push({
        event_id: `EVT-PHYS-${twinId.substring(5, 11)}-05`,
        stage: 'PHYSICS_RELIABILITY_EVIDENCE',
        timestamp: sourceTimestamp,
        summary: `Physics reliability consistency: ${physicsBlock.physics_consistency_status || 'EVALUATED'} (score=${physicsBlock.physics_consistency_score !== undefined ? physicsBlock.physics_consistency_score : 'N/A'})`,
        details: physicsBlock,
        provenance: {
          source_type: 'PHYSICS_AGING_ENGINE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_physics_reliability_engine',
          model_version: '1.0.0',
          model_sha256: null
        }
      });
    }

    // Stage 6: Risk Fusion Decision
    let riskFusionStatus = 'INSUFFICIENT_EVIDENCE';
    let riskFusionBlock = null;
    const riskFusionData = predictionRec?.ml_details?.risk_engine?.governed_risk_fusion ||
                           predictionRec?.governed_risk_fusion ||
                           predictionRec?.risk_fusion_decision;
    if (riskFusionData) {
      riskFusionStatus = 'AVAILABLE';
      riskFusionBlock = { ...riskFusionData };
      timelineEvents.push({
        event_id: `EVT-RF-${twinId.substring(5, 11)}-06`,
        stage: 'RISK_FUSION_DECISION',
        timestamp: sourceTimestamp,
        summary: `Governed risk fusion decision: disposition=${riskFusionBlock.disposition || 'UNKNOWN'}, risk_score=${riskFusionBlock.risk_score !== undefined ? riskFusionBlock.risk_score : 'N/A'}`,
        details: riskFusionBlock,
        provenance: {
          source_type: 'RISK_FUSION_GATE',
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: 'predicta_governed_risk_fusion',
          model_version: riskFusionBlock.contract_version || '1.0.0',
          model_sha256: riskFusionBlock.contract_sha256 || null
        }
      });
    }

    // Stage 8: Secondary Test
    let secondaryTestStatus = 'INSUFFICIENT_EVIDENCE';
    let secondaryTestBlock = null;
    if (predictionRec && predictionRec.secondary_test_result) {
      secondaryTestStatus = 'AVAILABLE';
      secondaryTestBlock = {
        secondary_test_result: predictionRec.secondary_test_result,
        requires_secondary_test: predictionRec.requires_secondary_test !== undefined
          ? Boolean(predictionRec.requires_secondary_test)
          : null
      };
      const secSourceType = isSynthetic ? 'SYNTHETIC_SIMULATION' : 'ATE_RETEST_SIMULATOR';
      timelineEvents.push({
        event_id: `EVT-SEC-${twinId.substring(5, 11)}-08`,
        stage: 'SECONDARY_TEST',
        timestamp: sourceTimestamp,
        summary: `Secondary retest outcome: ${predictionRec.secondary_test_result}`,
        details: secondaryTestBlock,
        provenance: {
          source_type: secSourceType,
          source_identifier: traceId || testId || componentId || searchKey,
          source_timestamp: sourceTimestamp,
          model_identifier: null,
          model_version: null,
          model_sha256: null
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
        requested_identifier: searchKey,
        identity_status: isRegistered ? 'REGISTERED' : 'UNREGISTERED',
        is_synthetic: isSynthetic
      },
      evidence_summary: {
        manufacturing_observation: mfgStatus,
        ml_evaluation: mlEvidenceStatus,
        anomaly_evidence: anomalyStatus,
        prognostic_evidence: prognosticStatus,
        physics_reliability: physicsStatus,
        risk_fusion: riskFusionStatus,
        operator_disposition: 'INSUFFICIENT_EVIDENCE',
        secondary_test: secondaryTestStatus,
        outcome_evidence: 'INSUFFICIENT_EVIDENCE',
        adjudication: 'NOT_ESTABLISHED',
        ground_truth_status: 'NOT_ESTABLISHED'
      },
      evidence_blocks: {
        manufacturing_observation: mfgBlock,
        ml_evaluation: mlEvidenceBlock,
        anomaly_evidence: anomalyBlock,
        prognostic_evidence: prognosticBlock,
        physics_reliability: physicsBlock,
        risk_fusion: riskFusionBlock,
        operator_dispositions: [],
        secondary_test: secondaryTestBlock,
        outcome_evidence: [],
        adjudications: []
      },
      longitudinal_timeline: uniqueEvents,
      provenance: {
        contract_version: '1.0.0',
        contract_name: 'predicta_reliability_twin_contract',
        authoritative_operating_threshold: 0.20,
        historical_model_version: predictionRec?.model_version || null,
        historical_model_sha256: predictionRec?.model_sha256 || null,
        system_verified_model_sha256: verifiedCurrentModelSha,
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
