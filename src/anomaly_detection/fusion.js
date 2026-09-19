/**
 * Predicta Semiconductor Intelligence Platform — Multi-Criteria Anomaly Fusion (Node.js)
 * File: src/anomaly_detection/fusion.js
 *
 * Implements authoritative multi-criteria anomaly fusion combining:
 *   1. Robust MAD (Part Average Testing)
 *   2. COPOD (Tail-copula outlier probabilities)
 *   3. Isolation Forest (Multi-dimensional partitioning)
 *
 * Policies:
 *   - CONSERVATIVE_MAX_FUSION: Alarm raised if any active detector exceeds reject threshold
 *   - WEIGHTED_SCORE_FUSION: Calibrated linear combination:
 *       S_fusion = sum_{d in active} (w_d / sum_w) * norm(S_d)
 *   - TWO_THRESHOLD_POLICY: MONITOR_THRESHOLD (0.35) and REJECT_THRESHOLD (0.50)
 *   - ZERO_DETECTOR_FAIL_CLOSED: Emits INSUFFICIENT_EVIDENCE if zero detectors active
 */

const path = require('path');
const fs = require('fs');
const { RobustMADDetectorJS, CANONICAL_ANOMALY_FEATURES } = require('./robust_mad');
const { COPODDetectorJS } = require('./copod');
const { IsolationForestDetectorJS } = require('./isolation_forest');
const {
  DEFAULT_NORMALIZATION_SCALES,
  CALIBRATION_STATUS,
  VALIDATION_STATUS,
  normalizeDetectorScore,
} = require('./normalization');

const CONTRACT_PATH = path.resolve(__dirname, '../../ml/anomaly/fusion_contract.json');

function loadAuthoritativeContract(customContractPath = null) {
  const resolvedPath = customContractPath || CONTRACT_PATH;
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Authoritative anomaly fusion contract not found at ${resolvedPath}`);
  }
  let contract;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    contract = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Authoritative anomaly fusion contract is unreadable or malformed JSON: ${e.message}`);
  }

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error('Authoritative anomaly fusion contract must be a JSON object');
  }

  const fm = contract.fusion_methodology;
  if (!fm || typeof fm !== 'object') {
    throw new Error("Missing 'fusion_methodology' in authoritative anomaly fusion contract");
  }

  const weights = fm.default_weights;
  if (!weights || typeof weights !== 'object') {
    throw new Error("Missing 'default_weights' in authoritative anomaly fusion contract");
  }

  const requiredDetectors = ['robust_mad', 'copod', 'isolation_forest'];
  const parsedWeights = {};
  for (const d of requiredDetectors) {
    if (weights[d] === undefined) {
      throw new Error(`Missing required detector weight for '${d}' in authoritative anomaly fusion contract`);
    }
    const wVal = Number(weights[d]);
    if (!Number.isFinite(wVal) || wVal < 0) {
      throw new Error(`Invalid non-finite or negative weight for '${d}' in authoritative anomaly fusion contract: ${weights[d]}`);
    }
    parsedWeights[d] = wVal;
  }

  const totalWeight = Object.values(parsedWeights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    throw new Error('Total sum of default weights in authoritative anomaly fusion contract must be positive');
  }

  const twoT = fm.two_threshold_policy;
  if (!twoT || typeof twoT !== 'object') {
    throw new Error("Missing 'two_threshold_policy' in authoritative anomaly fusion contract");
  }

  if (twoT.monitor_threshold === undefined) {
    throw new Error("Missing 'monitor_threshold' in authoritative anomaly fusion contract");
  }
  const monVal = Number(twoT.monitor_threshold);
  if (!Number.isFinite(monVal) || monVal < 0 || monVal > 1) {
    throw new Error(`Invalid monitor_threshold in authoritative anomaly fusion contract: ${twoT.monitor_threshold}`);
  }

  if (twoT.reject_threshold === undefined) {
    throw new Error("Missing 'reject_threshold' in authoritative anomaly fusion contract");
  }
  const rejVal = Number(twoT.reject_threshold);
  if (!Number.isFinite(rejVal) || rejVal < 0 || rejVal > 1) {
    throw new Error(`Invalid reject_threshold in authoritative anomaly fusion contract: ${twoT.reject_threshold}`);
  }

  if (monVal > rejVal) {
    throw new Error('monitor_threshold cannot exceed reject_threshold in authoritative anomaly fusion contract');
  }

  return {
    weights: parsedWeights,
    monitor_threshold: monVal,
    reject_threshold: rejVal,
    fusion_threshold: rejVal,
  };
}

class AnomalyFusionEngineJS {
  constructor(config = {}) {
    this.madDetector = config.mad_parameters ? new RobustMADDetectorJS(config.mad_parameters) : null;
    this.copodDetector = config.copod_parameters ? new COPODDetectorJS(config.copod_parameters) : null;
    this.isoDetector = config.isolation_forest_parameters ? new IsolationForestDetectorJS(config.isolation_forest_parameters) : null;

    const needsContract = config.weights === undefined ||
                          config.monitor_threshold === undefined ||
                          config.reject_threshold === undefined ||
                          config.fusion_threshold === undefined;

    const defaults = needsContract ? loadAuthoritativeContract(config.contract_path) : null;

    this.weights = config.weights !== undefined ? Object.assign({}, config.weights) : Object.assign({}, defaults.weights);
    this.monitorThreshold = config.monitor_threshold !== undefined ? Number(config.monitor_threshold) : defaults.monitor_threshold;
    this.rejectThreshold = config.reject_threshold !== undefined ? Number(config.reject_threshold) : defaults.reject_threshold;
    this.fusionThreshold = config.fusion_threshold !== undefined ? Number(config.fusion_threshold) : (config.reject_threshold !== undefined ? Number(config.reject_threshold) : defaults.fusion_threshold);
    this.normScales = config.normalization_scales || DEFAULT_NORMALIZATION_SCALES;
    this.featureNames = CANONICAL_ANOMALY_FEATURES;
  }

  static fromArtifacts(anomalyArtifacts = null, options = {}) {
    const engine = new AnomalyFusionEngineJS(options);
    if (!anomalyArtifacts) {
      return engine;
    }
    const madDetector = anomalyArtifacts.robust_mad
      ? new RobustMADDetectorJS(anomalyArtifacts.robust_mad)
      : null;
    const copodDetector = anomalyArtifacts.copod
      ? new COPODDetectorJS(anomalyArtifacts.copod)
      : null;
    const isoDetector = (anomalyArtifacts.isolation_forest && anomalyArtifacts.isolation_forest.trees)
      ? new IsolationForestDetectorJS(anomalyArtifacts.isolation_forest)
      : null;

    engine.madDetector = madDetector;
    engine.copodDetector = copodDetector;
    engine.isoDetector = isoDetector;
    return engine;
  }

  _cleanLotId(lotId) {
    if (lotId === null || lotId === undefined) return null;
    const s = String(lotId).trim();
    if (!s || s.toLowerCase() === "none" || s.toLowerCase() === "nan" || s.toLowerCase() === "null") {
      return null;
    }
    return s;
  }

  evaluateComponent(features, lotId = null) {
    if (typeof features !== 'object' || features === null || Array.isArray(features)) {
      throw new Error("Input features must be a dictionary object");
    }

    // Strict canonical schema and exact order enforcement
    const featureKeys = Object.keys(features);
    if (
      featureKeys.length !== this.featureNames.length ||
      !this.featureNames.every((col, idx) => featureKeys[idx] === col)
    ) {
      throw new Error(
        `Feature schema/order mismatch. Expected exact canonical keys ${JSON.stringify(this.featureNames)} in exact order, got ${JSON.stringify(featureKeys)}`
      );
    }

    for (const col of this.featureNames) {
      const valRaw = features[col];
      if (
        valRaw === null ||
        valRaw === undefined ||
        typeof valRaw === "string" ||
        typeof valRaw === "boolean" ||
        !Number.isFinite(Number(valRaw))
      ) {
        throw new Error(`Invalid non-numeric or non-finite value for feature '${col}': ${valRaw}`);
      }
    }

    const cleanLot = this._cleanLotId(lotId);

    // Detect active sub-detectors
    const activeDetectors = [];
    const detectorEvidence = {};
    const rawWeights = {};

    const wMad = this.weights.robust_mad !== undefined ? this.weights.robust_mad : this.weights.mad;
    const wCopod = this.weights.copod;
    const wIso = this.weights.isolation_forest !== undefined ? this.weights.isolation_forest : this.weights.iso;
    if (wMad === undefined || wCopod === undefined || wIso === undefined) {
      throw new Error("AnomalyFusionEngineJS weights dictionary is missing required detector weights");
    }

    let madRes = null;
    let copodRes = null;
    let isoRes = null;

    if (this.madDetector !== null) {
      madRes = this.madDetector.scoreSingle(features, cleanLot);
      activeDetectors.push("robust_mad");
      detectorEvidence.robust_mad = madRes;
      rawWeights.robust_mad = wMad;
    }

    if (this.copodDetector !== null) {
      copodRes = this.copodDetector.scoreSingle(features);
      activeDetectors.push("copod");
      detectorEvidence.copod = copodRes;
      rawWeights.copod = wCopod;
    }

    if (this.isoDetector !== null) {
      isoRes = this.isoDetector.scoreSingle(features);
      activeDetectors.push("isolation_forest");
      detectorEvidence.isolation_forest = isoRes;
      rawWeights.isolation_forest = wIso;
    }

    // Policy: Zero active detectors fail-closed
    if (activeDetectors.length === 0) {
      return {
        anomaly_score: null,
        anomaly_status: "INSUFFICIENT_EVIDENCE",
        overall_status: "INSUFFICIENT_EVIDENCE",
        weighted_fusion_score: null,
        conservative_alarm: false,
        fusion_method: "NO_ACTIVE_DETECTORS",
        contributing_detectors: [],
        detector_evidence: {},
        evidence: {},
        reference_status: "INSUFFICIENT_EVIDENCE",
        reference_source: "NONE",
        reference_sample_count: 0,
        lot_id: cleanLot,
        reference_context: {
          lot_id: cleanLot,
          status: "INSUFFICIENT_EVIDENCE",
          source: "NONE",
          sample_count: 0,
        },
        calibration_status: CALIBRATION_STATUS,
        validation_status: VALIDATION_STATUS,
        promotion_status: "BENCHMARK_ONLY",
      };
    }

    // Dynamic weight re-normalization across active detectors
    let totalW = 0.0;
    activeDetectors.forEach(d => { totalW += rawWeights[d]; });
    const normW = {};
    if (totalW <= 0.0) {
      const eqW = 1.0 / activeDetectors.length;
      activeDetectors.forEach(d => { normW[d] = eqW; });
    } else {
      activeDetectors.forEach(d => { normW[d] = rawWeights[d] / totalW; });
    }

    let weightedScore = 0.0;
    for (const d of activeDetectors) {
      const ev = detectorEvidence[d];
      let normS = ev.normalized_score;
      if (normS === undefined || normS === null) {
        normS = normalizeDetectorScore(d, ev.score, this.normScales);
      }
      weightedScore += normW[d] * normS;
    }

    // Two-Threshold & Conservative Alarm Synthesis
    const isReject = activeDetectors.some(d => detectorEvidence[d].status === "REJECT");
    const isMonitor = activeDetectors.some(d => detectorEvidence[d].status === "MONITOR");

    let overallStatus = "PASS";
    if (weightedScore >= this.rejectThreshold || isReject) {
      overallStatus = "REJECT";
    } else if (weightedScore >= this.monitorThreshold || isMonitor) {
      overallStatus = "MONITOR";
    } else {
      overallStatus = "PASS";
    }

    // Reference Context Propagation
    let refStatus = "UNKNOWN_LOT";
    let refSource = "GLOBAL_FALLBACK";
    let refCount = 0;
    let finalLot = cleanLot;

    if (madRes !== null) {
      refStatus = madRes.reference_status || "UNKNOWN_LOT";
      refSource = madRes.reference_source || "GLOBAL_FALLBACK";
      refCount = madRes.reference_sample_count !== undefined ? madRes.reference_sample_count : 0;
      finalLot = madRes.lot_id !== undefined ? madRes.lot_id : cleanLot;
    }

    const legacyEvidence = {
      mad: madRes !== null ? madRes : { score: 0.0, status: "PASS", reference_source: "GLOBAL_FALLBACK" },
      copod: copodRes !== null ? copodRes : { score: 0.0, status: "PASS" },
      isolation_forest: isoRes !== null ? isoRes : { score: 0.0, status: "PASS" },
    };

    return {
      anomaly_score: Number(weightedScore.toFixed(4)),
      anomaly_status: overallStatus,
      overall_status: overallStatus,
      weighted_fusion_score: Number(weightedScore.toFixed(4)),
      conservative_alarm: isReject,
      fusion_method: "WEIGHTED_SCORE_FUSION",
      contributing_detectors: activeDetectors,
      detector_evidence: detectorEvidence,
      evidence: legacyEvidence,
      reference_status: refStatus,
      reference_source: refSource,
      reference_sample_count: refCount,
      lot_id: finalLot,
      reference_context: {
        lot_id: finalLot,
        status: refStatus,
        source: refSource,
        sample_count: refCount,
      },
      calibration_status: CALIBRATION_STATUS,
      validation_status: VALIDATION_STATUS,
      promotion_status: "BENCHMARK_ONLY",
    };
  }
}

module.exports = { AnomalyFusionEngineJS, loadAuthoritativeContract };

