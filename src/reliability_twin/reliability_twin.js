/**
 * Authoritative Digital Reliability Twin Data Model & Lineage Service (Node.js)
 * File: src/reliability_twin/reliability_twin.js
 * 
 * Aggregates existing prediction, telemetry, anomaly, prognostic, physics,
 * operator disposition, outcome evidence, and adjudication records into an
 * immutable, longitudinal Digital Reliability Twin read model.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const TWIN_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/reliability_twin/reliability_twin_contract.json');
const PROD_MANIFEST_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_production_manifest.json');
const MODEL_JSON_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');

const inferenceService = require('../api/inference');
const { HumanDispositionManagerJS, _AUTHORITATIVE_PREDICTIONS } = require('../governance/disposition');
const riskFusionModule = require('../risk_fusion/risk_fusion');

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
      "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";

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

  _isSyntheticRecord(rec) {
    if (!rec) return false;
    if (rec.is_synthetic === true || rec.is_synthetic === false) return rec.is_synthetic;
    if (rec.source_type === 'SYNTHETIC_SIMULATION' || rec.source_type === 'ATE_SIMULATION') return true;
    const recStr = JSON.stringify(rec);
    return recStr.includes('SYN-') || recStr.includes('LOT-SYN') || recStr.includes('SIMULATED');
  }

  async resolvePredictionRecordAsync(identifier) {
    if (!identifier) return null;

    let targetId = typeof identifier === 'string' ? identifier.trim() : null;
    let rawRecord = typeof identifier === 'object' ? identifier : null;

    if (rawRecord) {
      targetId = rawRecord.trace_id || rawRecord.test_id || rawRecord.component_id;
    }

    if (!targetId && !rawRecord) return null;

    if (targetId && _AUTHORITATIVE_PREDICTIONS.has(targetId)) {
      return { ..._AUTHORITATIVE_PREDICTIONS.get(targetId) };
    }

    // Also scan prediction values for component_id match
    if (targetId) {
      for (const [, val] of _AUTHORITATIVE_PREDICTIONS) {
        if (val.component_id === targetId) {
          return { ...val };
        }
      }
    }

    if (inferenceService && inferenceService.predictionStore) {
      const found = inferenceService.predictionStore.find(p =>
        p.trace_id === targetId || p.test_id === targetId || p.component_id === targetId
      );
      if (found) return { ...found };
    }

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

    if (rawRecord && (rawRecord.supply_voltage !== undefined || rawRecord.voltage !== undefined || rawRecord.equipment_id !== undefined)) {
      try {
        const pred = await inferenceService.predictSingleAsync(rawRecord);
        return pred;
      } catch (e) {}
    }

    return null;
  }

  async buildReliabilityTwinAsync(identifier, options = {}) {
    if (identifier === null || identifier === undefined) {
      const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.");
      err.statusCode = 400;
      throw err;
    }

    let searchKey = "";
    if (typeof identifier === 'string') {
      searchKey = identifier.trim();
      if (!searchKey) {
        const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.");
        err.statusCode = 400;
        throw err;
      }
    } else if (typeof identifier === 'object') {
      searchKey = identifier.trace_id || identifier.component_id || identifier.test_id || "RECORD_INPUT";
    } else {
      const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier must be a string or record object.");
      err.statusCode = 400;
      throw err;
    }

    const modelSha = this.verifyModelProvenance();
    const predictionRec = await this.resolvePredictionRecordAsync(identifier);

    const traceId = predictionRec?.trace_id || (typeof identifier === 'object' ? identifier.trace_id : (searchKey.startsWith('TR-') ? searchKey : null));
    const testId = predictionRec?.test_id || (typeof identifier === 'object' ? identifier.test_id : (searchKey.startsWith('TST-') ? searchKey : null));
    const componentId = predictionRec?.component_id || (typeof identifier === 'object' ? identifier.component_id : (searchKey.startsWith('CMP-') ? searchKey : searchKey));
    const lotId = predictionRec?.lot_id || (typeof identifier === 'object' ? identifier.lot_id : null) || (componentId ? `LOT-${componentId.replace('CMP-', '')}` : 'UNKNOWN_LOT');
    const waferId = predictionRec?.wafer_id || (typeof identifier === 'object' ? identifier.wafer_id : null) || (lotId ? `${lotId}-W01` : 'UNKNOWN_WAFER');
    const dieId = predictionRec?.die_id || (typeof identifier === 'object' ? identifier.die_id : null) || (componentId ? `DIE-${componentId.replace(/^CMP-/, '')}` : 'UNKNOWN_DIE');
    const equipmentId = predictionRec?.equipment_id || (typeof identifier === 'object' ? identifier.equipment_id : null) || 'EQP-101';

    const twinId = `TWIN-${crypto.createHash('sha256').update(`${componentId}:${traceId}:${testId}`).digest('hex').substring(0, 12).toUpperCase()}`;

    const createdAtIso = predictionRec?.created_at || (typeof identifier === 'object' && identifier.created_at) || new Date().toISOString();

    const isSynthetic = this._isSyntheticRecord(predictionRec) || this._isSyntheticRecord(identifier) || String(lotId).includes('SYN') || String(componentId).includes('SYN');

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

    timelineEvents.push({
      event_id: `EVT-OBS-${twinId.substring(5, 11)}-01`,
      stage: "MANUFACTURING_OBSERVATION",
      timestamp: createdAtIso,
      summary: "Telemetry observation recorded at automated test equipment (ATE)",
      details: {
        equipment_id: equipmentId,
        lot_id: lotId,
        wafer_id: waferId,
        die_id: dieId,
        component_id: componentId,
        is_synthetic: isSynthetic
      },
      provenance: {
        source_type: isSynthetic ? "SYNTHETIC_SIMULATION" : "ATE_TELEMETRY",
        source_identifier: searchKey,
        source_timestamp: createdAtIso,
        model_identifier: "N/A",
        model_version: "N/A",
        model_sha256: "N/A"
      }
    });

    let mlEvidenceStatus = "INSUFFICIENT_EVIDENCE";
    let mlEvidenceBlock = null;

    if (predictionRec) {
      mlEvidenceStatus = "AVAILABLE";
      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold || 0.20,
        risk_level: predictionRec.risk_level || "LOW",
        operational_decision: predictionRec.operational_decision || "PASS",
        decision_class: predictionRec.decision_class || "LOW_RISK",
        requires_secondary_test: Boolean(predictionRec.requires_secondary_test),
        decision_reason: predictionRec.decision_reason || null,
        model_version: predictionRec.model_version || "4.0.0_authoritative",
        model_sha256: modelSha,
        provenance: {
          source_type: "PRODUCTION_ML_MODEL",
          source_identifier: traceId || testId || componentId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_xgboost_model",
          model_version: predictionRec.model_version || "4.0.0_authoritative",
          model_sha256: modelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-02`,
        stage: "ML_EVALUATION",
        timestamp: createdAtIso,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${predictionRec.probability.toFixed(4)}, Risk=${predictionRec.risk_level})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    let anomalyStatus = "INSUFFICIENT_EVIDENCE";
    let anomalyBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.anomaly) {
      anomalyStatus = "AVAILABLE";
      anomalyBlock = { ...predictionRec.ml_details.anomaly };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-03`,
        stage: "ANOMALY_EVIDENCE",
        timestamp: createdAtIso,
        summary: `Anomaly evaluation score=${anomalyBlock.copod_score || 'N/A'}, status=${anomalyBlock.pat_status || 'PASS'}`,
        details: anomalyBlock,
        provenance: {
          source_type: "ANOMALY_ENGINE",
          source_identifier: traceId || testId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_anomaly_artifacts",
          model_version: "1.0.0",
          model_sha256: modelSha
        }
      });
    }

    let prognosticStatus = "INSUFFICIENT_EVIDENCE";
    let prognosticBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.prognostics) {
      prognosticStatus = "AVAILABLE";
      prognosticBlock = { ...predictionRec.ml_details.prognostics };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-04`,
        stage: "PROGNOSTIC_EVIDENCE",
        timestamp: createdAtIso,
        summary: `168h Prognostic trajectory degradation forecast`,
        details: prognosticBlock,
        provenance: {
          source_type: "PROGNOSTIC_ENGINE",
          source_identifier: traceId || testId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_gpr_kernel_artifacts",
          model_version: "1.0.0",
          model_sha256: modelSha
        }
      });
    }

    let operatorStatus = dispositions.length > 0 ? "AVAILABLE" : "INSUFFICIENT_EVIDENCE";
    dispositions.forEach((disp, idx) => {
      timelineEvents.push({
        event_id: `EVT-DISP-${disp.disposition_id || idx}`,
        stage: "OPERATOR_DISPOSITION",
        timestamp: disp.created_at || createdAtIso,
        summary: `Human operator recorded disposition: ${disp.disposition} (${disp.reason_code})`,
        details: {
          disposition_id: disp.disposition_id,
          disposition: disp.disposition,
          reason_code: disp.reason_code,
          operator_id: disp.operator_id,
          operator_role: disp.operator_role,
          comment: disp.comment,
          feedback_status: disp.feedback_status
        },
        provenance: {
          source_type: "HUMAN_OPERATOR_GATE",
          source_identifier: disp.disposition_id,
          source_timestamp: disp.created_at || createdAtIso,
          model_identifier: "N/A",
          model_version: "N/A",
          model_sha256: "N/A"
        }
      });
    });

    let secondaryTestStatus = (predictionRec && (predictionRec.secondary_test_result || predictionRec.requires_secondary_test)) ? "AVAILABLE" : "INSUFFICIENT_EVIDENCE";
    if (predictionRec && predictionRec.secondary_test_result) {
      timelineEvents.push({
        event_id: `EVT-SEC-${twinId.substring(5, 11)}-05`,
        stage: "SECONDARY_TEST",
        timestamp: createdAtIso,
        summary: `Secondary ATE retest outcome: ${predictionRec.secondary_test_result}`,
        details: {
          secondary_test_result: predictionRec.secondary_test_result,
          requires_secondary_test: predictionRec.requires_secondary_test
        },
        provenance: {
          source_type: "ATE_RETEST_SIMULATOR",
          source_identifier: traceId || testId,
          source_timestamp: createdAtIso,
          model_identifier: "N/A",
          model_version: "N/A",
          model_sha256: "N/A"
        }
      });
    }

    let outcomeEvidenceStatus = outcomeEvidences.length > 0 ? "AVAILABLE" : "INSUFFICIENT_EVIDENCE";
    outcomeEvidences.forEach((ev, idx) => {
      timelineEvents.push({
        event_id: `EVT-EVI-${ev.evidence_id || idx}`,
        stage: "OUTCOME_EVIDENCE",
        timestamp: ev.created_at || ev.recorded_timestamp || createdAtIso,
        summary: `Outcome evidence recorded: ${ev.evidence_type} (${ev.evidence_status})`,
        details: {
          evidence_id: ev.evidence_id,
          evidence_type: ev.evidence_type,
          evidence_status: ev.evidence_status,
          evidence_source: ev.evidence_source,
          recorded_by: ev.recorded_by
        },
        provenance: {
          source_type: "OUTCOME_EVIDENCE_STORE",
          source_identifier: ev.evidence_id,
          source_timestamp: ev.evidence_timestamp || createdAtIso,
          model_identifier: "N/A",
          model_version: "N/A",
          model_sha256: "N/A"
        }
      });
    });

    let adjudicationStatus = adjudications.length > 0 ? "AVAILABLE" : "NOT_ESTABLISHED";
    let groundTruthStatus = "NOT_ESTABLISHED";
    adjudications.forEach((adj, idx) => {
      groundTruthStatus = adj.ground_truth_status || "NOT_ESTABLISHED";
      timelineEvents.push({
        event_id: `EVT-ADJ-${adj.adjudication_id || idx}`,
        stage: "ADJUDICATION",
        timestamp: adj.created_at || createdAtIso,
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
          source_type: "QUALITY_ADJUDICATION_GATE",
          source_identifier: adj.adjudication_id,
          source_timestamp: adj.created_at || createdAtIso,
          model_identifier: "N/A",
          model_version: "N/A",
          model_sha256: "N/A"
        }
      });
    });

    // Deduplicate duplicate timeline events based on stage + summary + timestamp
    const seenEventKeys = new Set();
    const uniqueEvents = [];
    for (const evt of timelineEvents) {
      const key = `${evt.stage}:${evt.timestamp}:${evt.summary}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        uniqueEvents.push(evt);
      }
    }

    // Deterministic sorting: Primary key = ISO timestamp, Secondary key = event_id
    uniqueEvents.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.event_id).localeCompare(String(b.event_id));
    });

    const twinRepresentation = {
      twin_id: twinId,
      created_at: createdAtIso,
      identity: {
        component_id: componentId,
        trace_id: traceId || "UNASSIGNED",
        test_id: testId || "UNASSIGNED",
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
        contract_version: "1.0.0",
        contract_name: "predicta_reliability_twin_contract",
        authoritative_threshold: 0.20,
        model_identifier: "predicta_xgboost_model",
        model_version: "4.0.0_authoritative",
        model_sha256: modelSha,
        is_synthetic_provenance: isSynthetic
      }
    };

    // Deep freeze / immutable clone
    return JSON.parse(JSON.stringify(twinRepresentation));
  }

  buildReliabilityTwin(identifier, options = {}) {
    if (identifier === null || identifier === undefined) {
      const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier cannot be null or undefined.");
      err.statusCode = 400;
      throw err;
    }

    let searchKey = "";
    if (typeof identifier === 'string') {
      searchKey = identifier.trim();
      if (!searchKey) {
        const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier string cannot be empty.");
        err.statusCode = 400;
        throw err;
      }
    } else if (typeof identifier === 'object') {
      searchKey = identifier.trace_id || identifier.component_id || identifier.test_id || "RECORD_INPUT";
    } else {
      const err = new Error("INVALID_IDENTIFIER: Reliability twin identifier must be a string or record object.");
      err.statusCode = 400;
      throw err;
    }

    const modelSha = this.verifyModelProvenance();

    let predictionRec = null;
    let targetId = typeof identifier === 'string' ? identifier.trim() : null;
    let rawRecord = typeof identifier === 'object' ? identifier : null;

    if (rawRecord) {
      targetId = rawRecord.trace_id || rawRecord.test_id || rawRecord.component_id;
    }

    if (targetId && _AUTHORITATIVE_PREDICTIONS.has(targetId)) {
      predictionRec = { ..._AUTHORITATIVE_PREDICTIONS.get(targetId) };
    } else if (inferenceService && inferenceService.predictionStore) {
      const found = inferenceService.predictionStore.find(p =>
        p.trace_id === targetId || p.test_id === targetId || p.component_id === targetId
      );
      if (found) predictionRec = { ...found };
    }

    if (!predictionRec && rawRecord && (rawRecord.supply_voltage !== undefined || rawRecord.voltage !== undefined || rawRecord.equipment_id !== undefined)) {
      try {
        predictionRec = inferenceService.predictSingle(rawRecord);
      } catch (e) {}
    }

    const traceId = predictionRec?.trace_id || (typeof identifier === 'object' ? identifier.trace_id : (searchKey.startsWith('TR-') ? searchKey : null));
    const testId = predictionRec?.test_id || (typeof identifier === 'object' ? identifier.test_id : (searchKey.startsWith('TST-') ? searchKey : null));
    const componentId = predictionRec?.component_id || (typeof identifier === 'object' ? identifier.component_id : (searchKey.startsWith('CMP-') ? searchKey : searchKey));
    const lotId = predictionRec?.lot_id || (typeof identifier === 'object' ? identifier.lot_id : null) || (componentId ? `LOT-${componentId.replace('CMP-', '')}` : 'UNKNOWN_LOT');
    const waferId = predictionRec?.wafer_id || (typeof identifier === 'object' ? identifier.wafer_id : null) || (lotId ? `${lotId}-W01` : 'UNKNOWN_WAFER');
    const dieId = predictionRec?.die_id || (typeof identifier === 'object' ? identifier.die_id : null) || (componentId ? `DIE-${componentId.replace(/^CMP-/, '')}` : 'UNKNOWN_DIE');
    const equipmentId = predictionRec?.equipment_id || (typeof identifier === 'object' ? identifier.equipment_id : null) || 'EQP-101';

    const twinId = `TWIN-${crypto.createHash('sha256').update(`${componentId}:${traceId}:${testId}`).digest('hex').substring(0, 12).toUpperCase()}`;

    const createdAtIso = predictionRec?.created_at || (typeof identifier === 'object' && identifier.created_at) || new Date().toISOString();

    const isSynthetic = this._isSyntheticRecord(predictionRec) || this._isSyntheticRecord(identifier) || String(lotId).includes('SYN') || String(componentId).includes('SYN');

    const timelineEvents = [];

    timelineEvents.push({
      event_id: `EVT-OBS-${twinId.substring(5, 11)}-01`,
      stage: "MANUFACTURING_OBSERVATION",
      timestamp: createdAtIso,
      summary: "Telemetry observation recorded at automated test equipment (ATE)",
      details: {
        equipment_id: equipmentId,
        lot_id: lotId,
        wafer_id: waferId,
        die_id: dieId,
        component_id: componentId,
        is_synthetic: isSynthetic
      },
      provenance: {
        source_type: isSynthetic ? "SYNTHETIC_SIMULATION" : "ATE_TELEMETRY",
        source_identifier: searchKey,
        source_timestamp: createdAtIso,
        model_identifier: "N/A",
        model_version: "N/A",
        model_sha256: "N/A"
      }
    });

    let mlEvidenceStatus = "INSUFFICIENT_EVIDENCE";
    let mlEvidenceBlock = null;

    if (predictionRec) {
      mlEvidenceStatus = "AVAILABLE";
      mlEvidenceBlock = {
        prediction: predictionRec.prediction,
        probability: predictionRec.probability,
        threshold: predictionRec.threshold || 0.20,
        risk_level: predictionRec.risk_level || "LOW",
        operational_decision: predictionRec.operational_decision || "PASS",
        decision_class: predictionRec.decision_class || "LOW_RISK",
        requires_secondary_test: Boolean(predictionRec.requires_secondary_test),
        decision_reason: predictionRec.decision_reason || null,
        model_version: predictionRec.model_version || "4.0.0_authoritative",
        model_sha256: modelSha,
        provenance: {
          source_type: "PRODUCTION_ML_MODEL",
          source_identifier: traceId || testId || componentId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_xgboost_model",
          model_version: predictionRec.model_version || "4.0.0_authoritative",
          model_sha256: modelSha
        }
      };

      timelineEvents.push({
        event_id: `EVT-ML-${twinId.substring(5, 11)}-02`,
        stage: "ML_EVALUATION",
        timestamp: createdAtIso,
        summary: `Authoritative model prediction: ${predictionRec.prediction} (P=${predictionRec.probability.toFixed(4)}, Risk=${predictionRec.risk_level})`,
        details: { ...mlEvidenceBlock },
        provenance: { ...mlEvidenceBlock.provenance }
      });
    }

    let anomalyStatus = "INSUFFICIENT_EVIDENCE";
    let anomalyBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.anomaly) {
      anomalyStatus = "AVAILABLE";
      anomalyBlock = { ...predictionRec.ml_details.anomaly };
      timelineEvents.push({
        event_id: `EVT-ANO-${twinId.substring(5, 11)}-03`,
        stage: "ANOMALY_EVIDENCE",
        timestamp: createdAtIso,
        summary: `Anomaly evaluation score=${anomalyBlock.copod_score || 'N/A'}, status=${anomalyBlock.pat_status || 'PASS'}`,
        details: anomalyBlock,
        provenance: {
          source_type: "ANOMALY_ENGINE",
          source_identifier: traceId || testId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_anomaly_artifacts",
          model_version: "1.0.0",
          model_sha256: modelSha
        }
      });
    }

    let prognosticStatus = "INSUFFICIENT_EVIDENCE";
    let prognosticBlock = null;
    if (predictionRec && predictionRec.ml_details && predictionRec.ml_details.prognostics) {
      prognosticStatus = "AVAILABLE";
      prognosticBlock = { ...predictionRec.ml_details.prognostics };
      timelineEvents.push({
        event_id: `EVT-PRG-${twinId.substring(5, 11)}-04`,
        stage: "PROGNOSTIC_EVIDENCE",
        timestamp: createdAtIso,
        summary: `168h Prognostic trajectory degradation forecast`,
        details: prognosticBlock,
        provenance: {
          source_type: "PROGNOSTIC_ENGINE",
          source_identifier: traceId || testId,
          source_timestamp: createdAtIso,
          model_identifier: "predicta_gpr_kernel_artifacts",
          model_version: "1.0.0",
          model_sha256: modelSha
        }
      });
    }

    // Deduplicate duplicate timeline events based on stage + summary + timestamp
    const seenEventKeys = new Set();
    const uniqueEvents = [];
    for (const evt of timelineEvents) {
      const key = `${evt.stage}:${evt.timestamp}:${evt.summary}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        uniqueEvents.push(evt);
      }
    }

    // Deterministic sorting: Primary key = ISO timestamp, Secondary key = event_id
    uniqueEvents.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.event_id).localeCompare(String(b.event_id));
    });

    const twinRepresentation = {
      twin_id: twinId,
      created_at: createdAtIso,
      identity: {
        component_id: componentId,
        trace_id: traceId || "UNASSIGNED",
        test_id: testId || "UNASSIGNED",
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
        operator_disposition: "INSUFFICIENT_EVIDENCE",
        secondary_test: "INSUFFICIENT_EVIDENCE",
        outcome_evidence: "INSUFFICIENT_EVIDENCE",
        adjudication: "NOT_ESTABLISHED",
        ground_truth_status: "NOT_ESTABLISHED"
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
        contract_version: "1.0.0",
        contract_name: "predicta_reliability_twin_contract",
        authoritative_threshold: 0.20,
        model_identifier: "predicta_xgboost_model",
        model_version: "4.0.0_authoritative",
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
