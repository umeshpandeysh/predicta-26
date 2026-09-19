/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostics Foundation (JS Companion)
 * File: src/prognostics/trajectory.js
 * 
 * Implements:
 * 1. Reusable Prognostic Data Builder with explicit separation:
 *    - early_features (0h and 24h observable)
 *    - future_ground_truth (168h retrospective evaluation only)
 *    - metadata (identifiers, lots, wafers)
 * 2. Strict Temporal Leakage Protection:
 *    - Rejection of 168h/future telemetry from early prediction feature sets
 *    - Rejection of target/label leakage
 *    - Strict schema order validation and non-numeric/NaN/Inf protection
 * 3. Authoritative Trajectory Semantics:
 *    - PASS_24H_PASS_168H (Healthy through 168h)
 *    - PASS_24H_FAIL_168H (True Latent Failure)
 *    - FAIL_24H_FAIL_168H (Early Failure visible at 24h)
 *    - FAIL_24H_PASS_168H (Early 24h anomaly, recovered by 168h)
 *    - INSUFFICIENT_HISTORY (Missing 24h or 168h checkpoint)
 * 4. Standardized Prognostic Evaluation Metrics (Recall, FNR, Precision, F1, F2, Specificity, Confusion Matrix)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TrajectoryState = {
  PASS_24H_PASS_168H: "PASS_24H_PASS_168H",
  PASS_24H_FAIL_168H: "PASS_24H_FAIL_168H",
  FAIL_24H_FAIL_168H: "FAIL_24H_FAIL_168H",
  FAIL_24H_PASS_168H: "FAIL_24H_PASS_168H",
  INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY"
};

const FeatureProvenance = {
  EARLY_OBSERVABLE: "EARLY_OBSERVABLE",
  FUTURE_GROUND_TRUTH: "FUTURE_GROUND_TRUTH",
  IDENTIFIER: "IDENTIFIER",
  METADATA: "METADATA",
  TARGET: "TARGET"
};

const CANONICAL_EARLY_FEATURES = [
  "iddq_0h",
  "ileak_0h",
  "tpd_0h",
  "iddq_24h",
  "ileak_24h",
  "tpd_24h",
  "iddq_drift_24h",
  "ileak_drift_24h",
  "tpd_drift_24h"
];

const CANONICAL_FUTURE_FIELDS = [
  "iddq_168h_ground_truth",
  "ileak_168h_ground_truth",
  "tpd_168h_ground_truth",
  "state_168h",
  "latent_168h_failure"
];

const FORBIDDEN_LEAKAGE_TOKENS = [
  "168",
  "96",
  "48",
  "future",
  "ground_truth",
  "post_burn_in",
  "state_168",
  "result_168",
  "target"
];

const CONTRACT_PATH = path.join(__dirname, '..', '..', 'ml', 'prognostics', 'prognostic_contract.json');
const SPLIT_MANIFEST_PATH = path.join(__dirname, '..', '..', 'ml', 'data', 'split_manifest.json');

function computeSha256(filePath) {
  if (!fs.existsSync(filePath)) return "FILE_NOT_FOUND";
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function loadAuthoritativePrognosticContract(contractPath) {
  const pathToUse = contractPath || CONTRACT_PATH;
  if (!fs.existsSync(pathToUse)) {
    throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_MISSING: Contract file not found at ${pathToUse}`);
  }
  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(pathToUse, 'utf-8'));
  } catch (err) {
    throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_MALFORMED: Failed to parse JSON contract: ${err.message}`);
  }

  const requiredKeys = [
    "contract_version",
    "authority_level",
    "target_specification",
    "feature_policy",
    "split_governance",
    "production_and_model_governance"
  ];
  for (const k of requiredKeys) {
    if (!contract[k]) {
      throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required top-level key '${k}'`);
    }
  }

  const targetSpec = contract.target_specification || {};
  const limits = targetSpec.parametric_limits || {};
  for (const limKey of ["iddq_max_uA", "ileak_max_uA", "tpd_max_ns"]) {
    if (limits[limKey] === undefined || limits[limKey] === null) {
      throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing parametric limit '${limKey}'`);
    }
    const val = Number(limits[limKey]);
    if (isNaN(val) || !isFinite(val) || val <= 0) {
      throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Invalid limit value for '${limKey}': ${limits[limKey]}`);
    }
  }

  return contract;
}

function getAuthoritativeSpecLimits(contractPath) {
  const contract = loadAuthoritativePrognosticContract(contractPath);
  const limits = contract.target_specification.parametric_limits;
  return {
    iddq: Number(limits.iddq_max_uA),
    ileak: Number(limits.ileak_max_uA),
    tpd: Number(limits.tpd_max_ns)
  };
}

function validateEarlyFeatureInput(features) {
  if (features && typeof features === 'object' && !Array.isArray(features)) {
    const keys = Object.keys(features);

    // 1. Leakage token check
    for (const k of keys) {
      const kLower = String(k).toLowerCase();
      for (const token of FORBIDDEN_LEAKAGE_TOKENS) {
        if (kLower.includes(token)) {
          throw new Error(`TEMPORAL_LEAKAGE_DETECTED: Forbidden token '${token}' in key '${k}'`);
        }
      }
    }

    // 2. Missing keys check
    const missing = CANONICAL_EARLY_FEATURES.filter(f => !(f in features));
    if (missing.length > 0) {
      throw new Error(`MISSING_REQUIRED_FEATURE: Missing early features: ${missing.join(', ')}`);
    }

    // 3. Extra keys check
    const extra = keys.filter(k => !CANONICAL_EARLY_FEATURES.includes(k));
    if (extra.length > 0) {
      throw new Error(`EXTRA_FEATURE_DETECTED: Unauthorized extra keys: ${extra.join(', ')}`);
    }

    // 4. Strict order check
    for (let i = 0; i < CANONICAL_EARLY_FEATURES.length; i++) {
      if (keys[i] !== CANONICAL_EARLY_FEATURES[i]) {
        throw new Error(`SCHEMA_ORDER_MISMATCH: Expected order [${CANONICAL_EARLY_FEATURES.join(', ')}], got [${keys.join(', ')}]`);
      }
    }

    // 5. Numeric validation
    const values = [];
    for (const f of CANONICAL_EARLY_FEATURES) {
      const val = features[f];
      if (val === null || val === undefined || typeof val === 'boolean' || typeof val === 'string') {
        throw new Error(`INVALID_NUMERIC_VALUE: Feature '${f}' has non-numeric value: ${val}`);
      }
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) {
        throw new Error(`NON_FINITE_VALUE: Feature '${f}' is non-finite (NaN or Infinity): ${val}`);
      }
      values.push(num);
    }
    return values;
  } else if (Array.isArray(features)) {
    if (features.length !== 9) {
      throw new Error(`INVALID_DIMENSIONALITY: Expected 9 early features, got ${features.length}`);
    }
    for (let i = 0; i < 9; i++) {
      const num = Number(features[i]);
      if (isNaN(num) || !isFinite(num)) {
        throw new Error(`NON_FINITE_VALUE: Array contains non-finite values at index ${i}: ${features[i]}`);
      }
    }
    return features.map(Number);
  } else {
    throw new Error(`UNSUPPORTED_INPUT_TYPE: Expected dict or array, got ${typeof features}`);
  }
}

function evaluateAcceptanceAtHour(telemetry, hour, specLimits = null, contractPath = null) {
  if (!telemetry || typeof telemetry !== 'object') {
    return { isAcceptable: false, reason: "MISSING_TELEMETRY" };
  }

  if (telemetry.health_state) {
    const hs = String(telemetry.health_state).toUpperCase();
    if (hs === "FAILED") {
      return { isAcceptable: false, reason: "HEALTH_STATE_FAILED" };
    }
    if (hs === "LATENT_DEFECT") {
      const tpd = Number(telemetry.tpd || 0);
      if (hour >= 96 || (hour >= 24 && tpd > 230.0)) {
        return { isAcceptable: false, reason: "LATENT_DEFECT_MANIFESTED" };
      }
      if (hour === 24 && tpd <= 230.0) {
        return { isAcceptable: true, reason: "ACCEPTABLE_24H_LATENT_CANDIDATE" };
      }
    }
  }

  const limits = specLimits !== null ? specLimits : getAuthoritativeSpecLimits(contractPath);
  const reasons = [];

  for (const param of ["tpd", "iddq", "ileak"]) {
    if (telemetry[param] !== undefined && telemetry[param] !== null) {
      const num = Number(telemetry[param]);
      if (isNaN(num) || !isFinite(num)) {
        return { isAcceptable: false, reason: `NON_FINITE_${param.toUpperCase()}` };
      }
      if (limits[param] === undefined) {
        throw new Error(`MISSING_SPEC_LIMIT: No specification limit defined for parameter '${param}'`);
      }
      const limit = Number(limits[param]);
      if (num > limit) {
        reasons.push(`${param.toUpperCase()}_EXCEEDED(${num.toFixed(2)}>${limit.toFixed(1)})`);
      }
    }
  }

  if (reasons.length > 0) {
    return { isAcceptable: false, reason: reasons.join("; ") };
  }

  return { isAcceptable: true, reason: "ACCEPTABLE_WITHIN_LIMITS" };
}

function evaluateTrajectoryState(telemetry24h, telemetry168h, specLimits = null, contractPath = null) {
  const limits = specLimits !== null ? specLimits : getAuthoritativeSpecLimits(contractPath);

  if (!telemetry24h || typeof telemetry24h !== 'object') {
    return {
      state_24h: "INSUFFICIENT_HISTORY",
      state_168h: telemetry168h ? (evaluateAcceptanceAtHour(telemetry168h, 168, limits).isAcceptable ? "PASS" : "FAIL") : "INSUFFICIENT_HISTORY",
      latent_168h_failure: null,
      trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
      reason: "Missing 24h screening telemetry"
    };
  }

  if (!telemetry168h || typeof telemetry168h !== 'object') {
    const eval24 = evaluateAcceptanceAtHour(telemetry24h, 24, limits);
    return {
      state_24h: eval24.isAcceptable ? "PASS" : "FAIL",
      state_168h: "INSUFFICIENT_HISTORY",
      latent_168h_failure: null,
      trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
      reason: "Missing 168h longitudinal telemetry; ground truth unknown"
    };
  }

  for (const k of ["iddq", "ileak", "tpd"]) {
    if (telemetry24h[k] !== undefined) {
      const num = Number(telemetry24h[k]);
      if (isNaN(num) || !isFinite(num)) {
        return {
          state_24h: "INSUFFICIENT_HISTORY",
          state_168h: "INSUFFICIENT_HISTORY",
          latent_168h_failure: null,
          trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
          reason: `Non-finite 24h reading for ${k}: ${telemetry24h[k]}`
        };
      }
    }
    if (telemetry168h[k] !== undefined) {
      const num = Number(telemetry168h[k]);
      if (isNaN(num) || !isFinite(num)) {
        return {
          state_24h: "PASS",
          state_168h: "INSUFFICIENT_HISTORY",
          latent_168h_failure: null,
          trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
          reason: `Non-finite 168h reading for ${k}: ${telemetry168h[k]}`
        };
      }
    }
  }

  const eval24 = evaluateAcceptanceAtHour(telemetry24h, 24, limits);
  const eval168 = evaluateAcceptanceAtHour(telemetry168h, 168, limits);

  const state24 = eval24.isAcceptable ? "PASS" : "FAIL";
  const state168 = eval168.isAcceptable ? "PASS" : "FAIL";

  if (eval24.isAcceptable && !eval168.isAcceptable) {
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: true,
      trajectory_state: TrajectoryState.PASS_24H_FAIL_168H,
      reason: `Latent wear-out: Passed at 24h (${eval24.reason}), failed by 168h (${eval168.reason})`
    };
  } else if (eval24.isAcceptable && eval168.isAcceptable) {
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.PASS_24H_PASS_168H,
      reason: "Healthy component: Passed both 24h and 168h screening"
    };
  } else if (!eval24.isAcceptable && !eval168.isAcceptable) {
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.FAIL_24H_FAIL_168H,
      reason: `Early failure: Failed at 24h (${eval24.reason}); already quarantined before burn-in`
    };
  } else {
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.FAIL_24H_PASS_168H,
      reason: `Transient 24h anomaly (${eval24.reason}) followed by acceptable 168h reading`
    };
  }
}

function extractPrognosticRecord(row0h, row24h, row168h, componentId, specLimits = null, contractPath = null) {
  const limits = specLimits !== null ? specLimits : getAuthoritativeSpecLimits(contractPath);
  const evalRes = evaluateTrajectoryState(row24h, row168h, limits);

  let lotId = null;
  let waferId = null;
  let manufacturer = null;
  let pkg = null;
  let compFamily = null;
  let compType = null;

  for (const r of [row24h, row0h, row168h]) {
    if (r && typeof r === 'object') {
      lotId = lotId || r.lot_id;
      waferId = waferId || r.wafer_id;
      manufacturer = manufacturer || r.manufacturer;
      pkg = pkg || r.package;
      compFamily = compFamily || r.component_family;
      compType = compType || r.component_type;
    }
  }

  const hasEarly = Boolean(row0h && row24h && typeof row0h === 'object' && typeof row24h === 'object');
  let earlyFeatures = {};

  if (hasEarly) {
    const iddq0 = Number(row0h.iddq);
    const ileak0 = Number(row0h.ileak);
    const tpd0 = Number(row0h.tpd);
    const iddq24 = Number(row24h.iddq);
    const ileak24 = Number(row24h.ileak);
    const tpd24 = Number(row24h.tpd);

    earlyFeatures = {
      iddq_0h: iddq0,
      ileak_0h: ileak0,
      tpd_0h: tpd0,
      iddq_24h: iddq24,
      ileak_24h: ileak24,
      tpd_24h: tpd24,
      iddq_drift_24h: iddq24 - iddq0,
      ileak_drift_24h: ileak24 - ileak0,
      tpd_drift_24h: tpd24 - tpd0
    };
  } else {
    for (const f of CANONICAL_EARLY_FEATURES) {
      earlyFeatures[f] = NaN;
    }
  }

  const has168h = Boolean(row168h && typeof row168h === 'object');
  const futureGt = {
    iddq_168h_ground_truth: has168h ? Number(row168h.iddq) : NaN,
    ileak_168h_ground_truth: has168h ? Number(row168h.ileak) : NaN,
    tpd_168h_ground_truth: has168h ? Number(row168h.tpd) : NaN,
    state_168h: evalRes.state_168h,
    latent_168h_failure: evalRes.latent_168h_failure,
    trajectory_state: evalRes.trajectory_state,
    evaluation_reason: evalRes.reason
  };

  return {
    metadata: {
      component_id: componentId,
      lot_id: lotId,
      wafer_id: waferId,
      manufacturer: manufacturer,
      package: pkg,
      component_family: compFamily,
      component_type: compType,
      has_complete_history: Boolean(row0h && row24h && row168h)
    },
    early_features: earlyFeatures,
    future_ground_truth: futureGt,
    state_24h: evalRes.state_24h
  };
}

function splitPrognosticDataset(records, splitManifestPath) {
  const manifestToUse = splitManifestPath || SPLIT_MANIFEST_PATH;
  if (!fs.existsSync(manifestToUse)) {
    throw new Error(`SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at ${manifestToUse}`);
  }

  let splitManifest;
  try {
    splitManifest = JSON.parse(fs.readFileSync(manifestToUse, 'utf-8'));
  } catch (err) {
    throw new Error(`SPLIT_MANIFEST_MALFORMED: Failed to parse split manifest: ${err.message}`);
  }

  const lotsObj = splitManifest.lots || {};
  const trainLots = new Set(lotsObj.train || []);
  const valTuneLots = new Set(lotsObj.validation_tune || []);
  const calibLots = new Set(lotsObj.calibration || []);
  const testLots = new Set(lotsObj.test || []);

  if (trainLots.size === 0 || valTuneLots.size === 0 || calibLots.size === 0 || testLots.size === 0) {
    throw new Error("SPLIT_MANIFEST_INVALID: Manifest must contain non-empty 'train', 'validation_tune', 'calibration', and 'test' lot sets.");
  }

  // Disjointness check
  for (const l of trainLots) {
    if (valTuneLots.has(l) || calibLots.has(l) || testLots.has(l)) {
      throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in train cohort`);
    }
  }
  for (const l of valTuneLots) {
    if (calibLots.has(l) || testLots.has(l)) {
      throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in validation_tune cohort`);
    }
  }
  for (const l of calibLots) {
    if (testLots.has(l)) {
      throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in calibration cohort`);
    }
  }

  const seenComponents = new Set();
  const trainRecs = [];
  const valTuneRecs = [];
  const calibRecs = [];
  const testRecs = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const meta = r.metadata || {};
    const cId = meta.component_id ? String(meta.component_id).trim() : (r.component_id ? String(r.component_id).trim() : null);
    if (!cId) {
      throw new Error(`MISSING_COMPONENT_ID: Record at index ${i} has missing or empty component_id.`);
    }

    if (seenComponents.has(cId)) {
      throw new Error(`DUPLICATE_COMPONENT_DETECTED: Component '${cId}' appears multiple times in input dataset.`);
    }
    seenComponents.add(cId);

    const lot = meta.lot_id ? String(meta.lot_id).trim() : (r.lot_id ? String(r.lot_id).trim() : null);
    if (!lot) {
      throw new Error(`MISSING_LOT_DETECTED: Component '${cId}' has missing or empty lot_id.`);
    }

    if (trainLots.has(lot)) {
      trainRecs.push(r);
    } else if (valTuneLots.has(lot)) {
      valTuneRecs.push(r);
    } else if (calibLots.has(lot)) {
      calibRecs.push(r);
    } else if (testLots.has(lot)) {
      testRecs.push(r);
    } else {
      throw new Error(`UNKNOWN_LOT_DETECTED: Component '${cId}' has lot '${lot}' not defined in split manifest.`);
    }
  }

  // Strict completeness: assigned == input
  const totalAssigned = trainRecs.length + valTuneRecs.length + calibRecs.length + testRecs.length;
  if (totalAssigned !== records.length) {
    throw new Error(`SPLIT_INCOMPLETE: Expected ${records.length} assigned records, got ${totalAssigned}`);
  }

  // Component disjointness
  const trainComps = new Set(trainRecs.map(r => (r.metadata && r.metadata.component_id) || r.component_id));
  const valComps = new Set(valTuneRecs.map(r => (r.metadata && r.metadata.component_id) || r.component_id));
  const calibComps = new Set(calibRecs.map(r => (r.metadata && r.metadata.component_id) || r.component_id));
  const testComps = new Set(testRecs.map(r => (r.metadata && r.metadata.component_id) || r.component_id));

  for (const c of trainComps) {
    if (valComps.has(c) || calibComps.has(c) || testComps.has(c)) {
      throw new Error(`SPLIT_LEAKAGE: Overlapping components across splits for ${c}`);
    }
  }
  for (const c of valComps) {
    if (calibComps.has(c) || testComps.has(c)) {
      throw new Error(`SPLIT_LEAKAGE: Overlapping components across splits for ${c}`);
    }
  }
  for (const c of calibComps) {
    if (testComps.has(c)) {
      throw new Error(`SPLIT_LEAKAGE: Overlapping components across splits for ${c}`);
    }
  }

  return {
    train: trainRecs,
    validation_tune: valTuneRecs,
    calibration: calibRecs,
    test: testRecs
  };
}

function calculatePrognosticMetrics(yTrue, yPredProb, threshold = 0.5) {
  const nTotal = yTrue.length;
  let nPos = 0;
  let nNeg = 0;

  for (let i = 0; i < nTotal; i++) {
    if (yTrue[i] === 1) nPos++;
    else nNeg++;
  }

  if (nTotal === 0) {
    return {
      support: { total: 0, positives: 0, negatives: 0 },
      latent_recall: 0.0,
      latent_false_negative_rate: 0.0,
      latent_precision: 0.0,
      latent_f1_score: 0.0,
      latent_f2_score: 0.0,
      specificity: 0.0,
      confusion_matrix: { tn: 0, fp: 0, fn: 0, tp: 0 },
      operating_threshold: Number(threshold)
    };
  }

  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;

  for (let i = 0; i < nTotal; i++) {
    const actual = yTrue[i];
    const predicted = yPredProb[i] >= threshold ? 1 : 0;
    if (actual === 1 && predicted === 1) tp++;
    else if (actual === 1 && predicted === 0) fn++;
    else if (actual === 0 && predicted === 1) fp++;
    else tn++;
  }

  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0.0;
  const fnr = (tp + fn) > 0 ? fn / (tp + fn) : 0.0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0.0;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0.0;

  const f1 = (precision + recall) > 0 ? (2.0 * precision * recall) / (precision + recall) : 0.0;
  const f2 = (4.0 * precision + recall) > 0 ? (5.0 * precision * recall) / (4.0 * precision + recall) : 0.0;

  return {
    support: {
      total: nTotal,
      positives: nPos,
      negatives: nNeg
    },
    latent_recall: Number(recall.toFixed(6)),
    latent_false_negative_rate: Number(fnr.toFixed(6)),
    latent_precision: Number(precision.toFixed(6)),
    latent_f1_score: Number(f1.toFixed(6)),
    latent_f2_score: Number(f2.toFixed(6)),
    specificity: Number(specificity.toFixed(6)),
    confusion_matrix: {
      tn,
      fp,
      fn,
      tp
    },
    operating_threshold: Number(threshold)
  };
}

// =============================================================================
// STAGE 5 TASK 2 — CONTINUOUS TRAJECTORY FORECASTING FOUNDATION (Node.js)
// =============================================================================

function getAuthoritativeContinuousSpec(contractPath = null) {
  const contract = loadAuthoritativePrognosticContract(contractPath);
  if (!contract.continuous_trajectory_specification) {
    throw new Error(
      "AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing 'continuous_trajectory_specification' in contract"
    );
  }
  const spec = contract.continuous_trajectory_specification;
  const requiredKeys = [
    "task_name",
    "forecast_origins",
    "supported_horizons",
    "evaluated_ground_truth_horizons",
    "target_parameters",
    "target_units",
    "allowed_early_observation_features",
    "forbidden_future_fields",
    "regression_metrics",
    "screening_criteria_type",
    "parametric_screening_limits",
    "model_status",
    "calibration_status"
  ];
  for (const k of requiredKeys) {
    if (spec[k] === undefined) {
      throw new Error(
        `AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required key '${k}' in continuous specification`
      );
    }
  }
  return spec;
}

function validateContinuousFeatureInput(features) {
  return validateEarlyFeatureInput(features);
}

function calculateContinuousRegressionMetrics(yTrue, yPred) {
  if (!Array.isArray(yTrue) || !Array.isArray(yPred)) {
    throw new Error("INVALID_INPUT: yTrue and yPred must be arrays");
  }
  if (yTrue.length !== yPred.length) {
    throw new Error(`DIMENSION_MISMATCH: yTrue length (${yTrue.length}) != yPred length (${yPred.length})`);
  }
  if (yTrue.length === 0) {
    return {
      mae: 0.0,
      rmse: 0.0,
      median_absolute_error: 0.0,
      max_absolute_error: 0.0,
      normalized_rmse: 0.0,
      sample_count: 0
    };
  }

  let sumAbs = 0.0;
  let sumSq = 0.0;
  let sumY = 0.0;
  let maxAbs = 0.0;
  const absErrors = [];

  for (let i = 0; i < yTrue.length; i++) {
    const yt = Number(yTrue[i]);
    const yp = Number(yPred[i]);
    if (!Number.isFinite(yt) || !Number.isFinite(yp)) {
      throw new Error("NON_FINITE_VALUES: Input contains NaN or Infinity values");
    }
    const diff = yt - yp;
    const absDiff = Math.abs(diff);
    sumAbs += absDiff;
    sumSq += diff * diff;
    sumY += yt;
    if (absDiff > maxAbs) maxAbs = absDiff;
    absErrors.push(absDiff);
  }

  absErrors.sort((a, b) => a - b);
  const mid = Math.floor(absErrors.length / 2);
  const medae = absErrors.length % 2 !== 0 ? absErrors[mid] : (absErrors[mid - 1] + absErrors[mid]) / 2.0;

  const mae = sumAbs / yTrue.length;
  const rmse = Math.sqrt(sumSq / yTrue.length);
  const meanY = sumY / yTrue.length;
  const denominator = Math.abs(meanY) > 1e-6 ? Math.abs(meanY) : 1.0;
  const nrmse = rmse / denominator;

  return {
    mae: Number(mae.toFixed(6)),
    rmse: Number(rmse.toFixed(6)),
    median_absolute_error: Number(medae.toFixed(6)),
    max_absolute_error: Number(maxAbs.toFixed(6)),
    normalized_rmse: Number(nrmse.toFixed(6)),
    sample_count: yTrue.length
  };
}

class ContinuousTrajectoryDatasetBuilder {
  constructor(datasetPath = null, contractPath = null) {
    this.contract = loadAuthoritativePrognosticContract(contractPath);
    this.spec = getAuthoritativeContinuousSpec(contractPath);

    const defaultDsPath = path.resolve(__dirname, "../../data/synthetic/semiconductor_synthetic_full.csv");
    this.dataset_path = datasetPath || defaultDsPath;
    if (!fs.existsSync(this.dataset_path)) {
      throw new Error(`DATASET_NOT_FOUND: Authoritative dataset missing at ${this.dataset_path}`);
    }
  }

  buildDataset() {
    const raw = fs.readFileSync(this.dataset_path, "utf-8");
    const lines = raw.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("DATASET_EMPTY: Dataset file is empty or corrupted");
    }

    const header = lines[0].split(",").map(c => c.trim().replace(/^"/, "").replace(/"$/, ""));
    const colIdx = {};
    for (let i = 0; i < header.length; i++) {
      colIdx[header[i]] = i;
    }

    const reqCols = ["component_id", "lot_id", "burn_in_hour", "iddq", "ileak", "tpd"];
    for (const c of reqCols) {
      if (colIdx[c] === undefined) {
        throw new Error(`MISSING_DATASET_COLUMN: Required column '${c}' not found in dataset`);
      }
    }

    const byComp = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map(p => p.trim().replace(/^"/, "").replace(/"$/, ""));
      const cid = parts[colIdx["component_id"]];
      const hour = parseInt(parts[colIdx["burn_in_hour"]], 10);
      const lot = parts[colIdx["lot_id"]];
      const iddq = parseFloat(parts[colIdx["iddq"]]);
      const ileak = parseFloat(parts[colIdx["ileak"]]);
      const tpd = parseFloat(parts[colIdx["tpd"]]);

      if (!byComp[cid]) {
        byComp[cid] = { lot_id: lot, hours: {} };
      }
      byComp[cid].hours[hour] = { iddq, ileak, tpd };
    }

    const components = Object.keys(byComp).sort();
    const records = [];

    for (const cid of components) {
      const entry = byComp[cid];
      const h0 = entry.hours[0];
      const h24 = entry.hours[24];
      const h96 = entry.hours[96];
      const h168 = entry.hours[168];

      if (!h0 || !h24) {
        throw new Error("MISSING_CHECKPOINT: Dataset lacks required early checkpoints (0h or 24h)");
      }

      const earlyDict = {
        iddq_0h: h0.iddq,
        ileak_0h: h0.ileak,
        tpd_0h: h0.tpd,
        iddq_24h: h24.iddq,
        ileak_24h: h24.ileak,
        tpd_24h: h24.tpd,
        iddq_drift_24h: h24.iddq - h0.iddq,
        ileak_drift_24h: h24.ileak - h0.ileak,
        tpd_drift_24h: h24.tpd - h0.tpd
      };
      const earlyArr = validateContinuousFeatureInput(earlyDict);

      const gtTraj = {
        iddq: { 0: h0.iddq, 24: h24.iddq },
        ileak: { 0: h0.ileak, 24: h24.ileak },
        tpd: { 0: h0.tpd, 24: h24.tpd }
      };
      if (h96) {
        gtTraj.iddq[96] = h96.iddq;
        gtTraj.ileak[96] = h96.ileak;
        gtTraj.tpd[96] = h96.tpd;
      }
      if (h168) {
        gtTraj.iddq[168] = h168.iddq;
        gtTraj.ileak[168] = h168.ileak;
        gtTraj.tpd[168] = h168.tpd;
      }

      records.push({
        component_id: cid,
        lot_id: entry.lot_id,
        early_features_dict: earlyDict,
        early_features_arr: earlyArr,
        ground_truth_trajectories: gtTraj
      });
    }

    return {
      records,
      total_count: records.length,
      feature_names: CANONICAL_EARLY_FEATURES
    };
  }

  splitDataset(records, splitManifestPath = null) {
    const manifestToUse = splitManifestPath || SPLIT_MANIFEST_PATH;
    if (!fs.existsSync(manifestToUse)) {
      throw new Error(`SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at ${manifestToUse}`);
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestToUse, 'utf8'));
    } catch (err) {
      throw new Error(`SPLIT_MANIFEST_MALFORMED: Failed to parse split manifest: ${err.message}`);
    }

    const lots = manifest.lots || {};
    const trainLots = new Set(lots.train || []);
    const valTuneLots = new Set(lots.validation_tune || []);
    const calibLots = new Set(lots.calibration || []);
    const testLots = new Set(lots.test || []);

    if (trainLots.size === 0 || valTuneLots.size === 0 || calibLots.size === 0 || testLots.size === 0) {
      throw new Error("SPLIT_MANIFEST_INVALID: Manifest must contain non-empty 'train', 'validation_tune', 'calibration', and 'test' lot sets.");
    }

    // Check lot disjointness
    for (const l of trainLots) {
      if (valTuneLots.has(l) || calibLots.has(l) || testLots.has(l)) {
        throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in train cohort`);
      }
    }
    for (const l of valTuneLots) {
      if (calibLots.has(l) || testLots.has(l)) {
        throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in validation_tune cohort`);
      }
    }
    for (const l of calibLots) {
      if (testLots.has(l)) {
        throw new Error(`MANIFEST_CORRUPTION: Overlapping lot ${l} in calibration cohort`);
      }
    }

    const trainRecs = [];
    const valTuneRecs = [];
    const calibRecs = [];
    const testRecs = [];

    const seenComps = new Set();
    for (const r of records) {
      const cid = r.component_id || (r.metadata && r.metadata.component_id);
      if (seenComps.has(cid)) {
        throw new Error(`DUPLICATE_COMPONENT_ID: Component ${cid} appears multiple times`);
      }
      seenComps.add(cid);

      const lot = r.lot_id || (r.metadata && r.metadata.lot_id);
      if (trainLots.has(lot)) {
        trainRecs.push(r);
      } else if (valTuneLots.has(lot)) {
        valTuneRecs.push(r);
      } else if (calibLots.has(lot)) {
        calibRecs.push(r);
      } else if (testLots.has(lot)) {
        testRecs.push(r);
      } else {
        throw new Error(`UNKNOWN_LOT_ID: Component ${cid} belongs to unauthorized lot ${lot}`);
      }
    }

    const totalAssigned = trainRecs.length + valTuneRecs.length + calibRecs.length + testRecs.length;
    if (totalAssigned !== records.length) {
      throw new Error(`SPLIT_INCOMPLETE: Total assigned (${totalAssigned}) != total records (${records.length})`);
    }

    return {
      train: trainRecs,
      validation_tune: valTuneRecs,
      calibration: calibRecs,
      test: testRecs
    };
  }
}

class ContinuousPersistenceBaseline {
  constructor() {
    this.name = "Continuous_Persistence_Baseline";
    this.algorithm = "PERSISTENCE_LATEST_OBSERVED_VALUE";
    this.status = "BENCHMARK_ONLY";
    this.supported_horizons = [24, 48, 72, 96, 120, 144, 168];
    this.target_parameters = ["iddq", "ileak", "tpd"];
  }

  forecastTrajectory(earlyFeatures) {
    const val24 = {};
    if (earlyFeatures && typeof earlyFeatures === "object" && !Array.isArray(earlyFeatures)) {
      validateContinuousFeatureInput(earlyFeatures);
      val24.iddq = Number(earlyFeatures.iddq_24h);
      val24.ileak = Number(earlyFeatures.ileak_24h);
      val24.tpd = Number(earlyFeatures.tpd_24h);
    } else if (Array.isArray(earlyFeatures)) {
      const arr = validateContinuousFeatureInput(earlyFeatures);
      val24.iddq = Number(arr[3]);
      val24.ileak = Number(arr[4]);
      val24.tpd = Number(arr[5]);
    } else {
      throw new Error(`UNSUPPORTED_INPUT_TYPE: ${typeof earlyFeatures}`);
    }

    const trajectory = {};
    for (const param of this.target_parameters) {
      trajectory[param] = {};
      for (const h of this.supported_horizons) {
        trajectory[param][h] = val24[param];
      }
    }
    return trajectory;
  }

  evaluate(records, horizons = null) {
    const evalHorizons = horizons || [96, 168];
    const results = {};

    for (const param of this.target_parameters) {
      results[param] = {};
      for (const h of evalHorizons) {
        const yTrue = [];
        const yPred = [];
        for (const r of records) {
          const gt = r.ground_truth_trajectories && r.ground_truth_trajectories[param] ? r.ground_truth_trajectories[param][h] : undefined;
          if (gt !== undefined) {
            const fc = this.forecastTrajectory(r.early_features_dict)[param][h];
            yTrue.push(gt);
            yPred.push(fc);
          }
        }
        results[param][`${h}h`] = calculateContinuousRegressionMetrics(yTrue, yPred);
      }
    }
    return results;
  }
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;
    if (Math.abs(M[i][i]) < 1e-12) throw new Error("Singular matrix");
    for (let k = i + 1; k < n; k++) {
      const c = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= c * M[i][j];
      }
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }
  return x;
}

class DeterministicContinuousDegradationModel {
  constructor(randomState = 42) {
    this.name = "Deterministic_Continuous_Degradation_Forecaster";
    this.algorithm = "DETERMINISTIC_REGULARIZED_TRAJECTORY_REGRESSION";
    this.status = "BENCHMARK_ONLY";
    this.calibration_status = "NOT_CALIBRATED";
    this.supported_horizons = [24, 48, 72, 96, 120, 144, 168];
    this.target_parameters = ["iddq", "ileak", "tpd"];

    this.weights = {};
    this.optimal_alphas = {};
    this.validation_residuals_std = {};
    this.is_frozen = false;
  }

  _fitSingleTarget(X_train, y_train, X_val, y_val) {
    const nFeatures = X_train[0].length; // 4 (1 + 3)
    // Compute A = X_tr_b^T X_tr_b
    const A = Array.from({ length: nFeatures }, () => new Array(nFeatures).fill(0));
    const Xty = new Array(nFeatures).fill(0);

    for (let i = 0; i < X_train.length; i++) {
      const xi = X_train[i];
      const yi = y_train[i];
      for (let j = 0; j < nFeatures; j++) {
        Xty[j] += xi[j] * yi;
        for (let k = 0; k < nFeatures; k++) {
          A[j][k] += xi[j] * xi[k];
        }
      }
    }

    const candidateAlphas = [0.001, 0.01, 0.1, 1.0, 10.0, 100.0];
    let bestAlpha = 1.0;
    let bestRmse = Infinity;
    let bestW = null;

    for (const alpha of candidateAlphas) {
      const A_reg = A.map(row => [...row]);
      for (let j = 1; j < nFeatures; j++) {
        A_reg[j][j] += alpha; // Do not regularize bias (j=0)
      }
      const w = solveLinearSystem(A_reg, Xty);

      let sumSqVal = 0.0;
      for (let i = 0; i < X_val.length; i++) {
        const xi = X_val[i];
        let pred = 0.0;
        for (let j = 0; j < nFeatures; j++) pred += xi[j] * w[j];
        const diff = y_val[i] - pred;
        sumSqVal += diff * diff;
      }
      const rmseVal = Math.sqrt(sumSqVal / X_val.length);
      if (rmseVal < bestRmse) {
        bestRmse = rmseVal;
        bestAlpha = alpha;
        bestW = w;
      }
    }

    // Validation residual standard deviation
    let sumSqRes = 0.0;
    let sumRes = 0.0;
    for (let i = 0; i < X_val.length; i++) {
      const xi = X_val[i];
      let pred = 0.0;
      for (let j = 0; j < nFeatures; j++) pred += xi[j] * bestW[j];
      const res = y_val[i] - pred;
      sumRes += res;
      sumSqRes += res * res;
    }
    const meanRes = sumRes / X_val.length;
    const resStd = Math.sqrt(sumSqRes / X_val.length - meanRes * meanRes);

    return { bestW, bestAlpha, resStd };
  }

  fitAndTune(trainRecords, validationTuneRecords, splitManifestPath = null) {
    if (this.is_frozen) {
      throw new Error("FROZEN_MODEL_MUTATION_PROHIBITED: Cannot refit or mutate an already frozen model.");
    }

    const manifestToUse = splitManifestPath || SPLIT_MANIFEST_PATH;
    let authTrainLots, authValTuneLots, forbiddenCalibLots, forbiddenTestLots;

    if (fs.existsSync(manifestToUse)) {
      const manifest = JSON.parse(fs.readFileSync(manifestToUse, 'utf8'));
      authTrainLots = new Set(manifest.lots && manifest.lots.train ? manifest.lots.train : []);
      authValTuneLots = new Set(manifest.lots && manifest.lots.validation_tune ? manifest.lots.validation_tune : []);
      forbiddenCalibLots = new Set(manifest.lots && manifest.lots.calibration ? manifest.lots.calibration : []);
      forbiddenTestLots = new Set(manifest.lots && manifest.lots.test ? manifest.lots.test : []);
    } else {
      authTrainLots = new Set(Array.from({ length: 35 }, (_, i) => `LOT-SYN-${String(i + 1).padStart(3, "0")}`));
      authValTuneLots = new Set(Array.from({ length: 3 }, (_, i) => `LOT-SYN-${String(i + 36).padStart(3, "0")}`));
      forbiddenCalibLots = new Set(Array.from({ length: 4 }, (_, i) => `LOT-SYN-${String(i + 39).padStart(3, "0")}`));
      forbiddenTestLots = new Set(Array.from({ length: 8 }, (_, i) => `LOT-SYN-${String(i + 43).padStart(3, "0")}`));
    }

    if (!trainRecords || trainRecords.length === 0) {
      throw new Error("EMPTY_TRAINING_RECORDS: Train records cannot be empty.");
    }
    if (!validationTuneRecords || validationTuneRecords.length === 0) {
      throw new Error("EMPTY_VALIDATION_TUNE_RECORDS: Validation tune records cannot be empty.");
    }

    // Validate Train Cohort
    const trainCompIds = new Set();
    for (const r of trainRecords) {
      const cid = r.component_id;
      const lot = r.lot_id;
      if (trainCompIds.has(cid)) {
        throw new Error(`DUPLICATE_COMPONENT_ID: Component ${cid} duplicated in train records`);
      }
      trainCompIds.add(cid);

      if (forbiddenCalibLots.has(lot)) {
        throw new Error(`TRAINING_SET_CONTAMINATION: Calibration lot '${lot}' detected in train records.`);
      }
      if (forbiddenTestLots.has(lot)) {
        throw new Error(`TRAINING_SET_CONTAMINATION: Test lot '${lot}' detected in train records.`);
      }
      if (authValTuneLots.has(lot)) {
        throw new Error(`TRAINING_SET_CONTAMINATION: Validation tune lot '${lot}' detected in train records.`);
      }
      if (!authTrainLots.has(lot)) {
        throw new Error(`TRAINING_SET_CONTAMINATION: Unauthorized lot '${lot}' in train records.`);
      }
    }

    // Validate Validation Tune Cohort
    const valTuneCompIds = new Set();
    for (const r of validationTuneRecords) {
      const cid = r.component_id;
      const lot = r.lot_id;
      if (valTuneCompIds.has(cid)) {
        throw new Error(`DUPLICATE_COMPONENT_ID: Component ${cid} duplicated in validation tune records`);
      }
      valTuneCompIds.add(cid);

      if (forbiddenCalibLots.has(lot)) {
        throw new Error(`TUNING_SET_CONTAMINATION: Calibration lot '${lot}' detected in validation tune records.`);
      }
      if (forbiddenTestLots.has(lot)) {
        throw new Error(`TUNING_SET_CONTAMINATION: Test lot '${lot}' detected in validation tune records.`);
      }
      if (authTrainLots.has(lot)) {
        throw new Error(`TUNING_SET_CONTAMINATION: Train lot '${lot}' detected in validation tune records.`);
      }
      if (!authValTuneLots.has(lot)) {
        throw new Error(`TUNING_SET_CONTAMINATION: Unauthorized lot '${lot}' in validation tune records.`);
      }
    }

    for (const cid of trainCompIds) {
      if (valTuneCompIds.has(cid)) {
        throw new Error("COMPONENT_LEAKAGE_DETECTED: Overlapping components between train and validation tune.");
      }
    }

    this.weights = {};
    this.optimal_alphas = {};
    this.validation_residuals_std = {};

    const paramIndices = {
      iddq: [0, 3, 6],
      ileak: [1, 4, 7],
      tpd: [2, 5, 8]
    };

    for (const param of this.target_parameters) {
      const [i0, i24, idrift] = paramIndices[param];
      this.weights[param] = {};
      this.optimal_alphas[param] = {};
      this.validation_residuals_std[param] = {};

      const X_tr = trainRecords.map(r => [
        1.0,
        r.early_features_arr[i0],
        r.early_features_arr[i24],
        r.early_features_arr[idrift]
      ]);
      const X_v = validationTuneRecords.map(r => [
        1.0,
        r.early_features_arr[i0],
        r.early_features_arr[i24],
        r.early_features_arr[idrift]
      ]);

      for (const h of [96, 168]) {
        const y_tr = trainRecords.map(r => r.ground_truth_trajectories[param][h]);
        const y_v = validationTuneRecords.map(r => r.ground_truth_trajectories[param][h]);

        const { bestW, bestAlpha, resStd } = this._fitSingleTarget(X_tr, y_tr, X_v, y_v);
        this.weights[param][h] = bestW;
        this.optimal_alphas[param][h] = bestAlpha;
        this.validation_residuals_std[param][h] = resStd;
      }
    }

    this.is_frozen = true;
    return this;
  }

  forecastTrajectory(earlyFeatures) {
    if (!this.is_frozen) {
      throw new Error("MODEL_NOT_FITTED: Must fit and tune model before forecasting.");
    }

    const arr = validateContinuousFeatureInput(earlyFeatures);
    const paramIndices = {
      iddq: [0, 3, 6],
      ileak: [1, 4, 7],
      tpd: [2, 5, 8]
    };

    const forecasts = {};
    const intervals = {};

    for (const param of this.target_parameters) {
      const [i0, i24, idrift] = paramIndices[param];
      const x = [1.0, arr[i0], arr[i24], arr[idrift]];
      const p24 = Number(arr[i24]);

      const w96 = this.weights[param][96];
      const w168 = this.weights[param][168];

      let pred_96 = 0.0;
      let pred_168 = 0.0;
      for (let j = 0; j < 4; j++) {
        pred_96 += x[j] * w96[j];
        pred_168 += x[j] * w168[j];
      }

      const traj = {};
      const intv = {};

      for (const h of this.supported_horizons) {
        let val;
        let halfW;
        if (h <= 24) {
          val = p24;
          halfW = 0.0;
        } else if (h <= 96) {
          const frac = (h - 24) / 72.0;
          val = p24 + frac * (pred_96 - p24);
          halfW = frac * 1.6448536269514722 * this.validation_residuals_std[param][96];
        } else {
          const frac = (h - 96) / 72.0;
          val = pred_96 + frac * (pred_168 - pred_96);
          const w_96_std = 1.6448536269514722 * this.validation_residuals_std[param][96];
          const w_168_std = 1.6448536269514722 * this.validation_residuals_std[param][168];
          halfW = w_96_std + frac * (w_168_std - w_96_std);
        }

        traj[h] = Number(val.toFixed(6));
        intv[h] = {
          lower: Number((val - halfW).toFixed(6)),
          upper: Number((val + halfW).toFixed(6)),
          half_width: Number(halfW.toFixed(6)),
          nominal_level: 0.90,
          calibration_status: "NOT_CALIBRATED"
        };
      }

      forecasts[param] = traj;
      intervals[param] = intv;
    }

    return {
      forecast_trajectories: forecasts,
      prediction_intervals: intervals,
      status: "BENCHMARK_ONLY",
      calibration_status: "NOT_CALIBRATED"
    };
  }

  evaluateFrozenTest(testRecords, tuneOnTest = false) {
    if (tuneOnTest) {
      throw new Error("TEST_SET_TUNING_FORBIDDEN: Tuning on test set is prohibited.");
    }
    if (!this.is_frozen) {
      throw new Error("MODEL_NOT_FROZEN: Model must be fitted and frozen before test evaluation.");
    }

    const results = {};
    const coverageResults = {};
    const evalHorizons = [96, 168];

    for (const param of this.target_parameters) {
      results[param] = {};
      coverageResults[param] = {};

      for (const h of evalHorizons) {
        const yTrue = [];
        const yPred = [];
        let coveredCount = 0;

        for (const r of testRecords) {
          const gt = r.ground_truth_trajectories && r.ground_truth_trajectories[param] ? r.ground_truth_trajectories[param][h] : undefined;
          if (gt !== undefined) {
            const fcRes = this.forecastTrajectory(r.early_features_dict);
            const predVal = fcRes.forecast_trajectories[param][h];
            const intv = fcRes.prediction_intervals[param][h];

            yTrue.push(gt);
            yPred.push(predVal);

            if (gt >= intv.lower && gt <= intv.upper) {
              coveredCount++;
            }
          }
        }

        results[param][`${h}h`] = calculateContinuousRegressionMetrics(yTrue, yPred);
        const covPct = yTrue.length > 0 ? (coveredCount / yTrue.length) * 100.0 : 0.0;
        coverageResults[param][`${h}h`] = {
          nominal_level: 0.90,
          observed_coverage_pct: Number(covPct.toFixed(2)),
          sample_count: yTrue.length,
          calibration_status: "NOT_CALIBRATED"
        };
      }
    }

    return {
      metrics: results,
      coverage: coverageResults,
      optimal_alphas: this.optimal_alphas
    };
  }
}

function evaluateThresholdProjections(forecastTrajectories, specLimits = null, contractPath = null) {
  const limits = specLimits || getAuthoritativeSpecLimits(contractPath);
  const projections = {};
  let overallBreach = false;
  let earliestBreachHour = null;

  for (const param of ["iddq", "ileak", "tpd"]) {
    if (!forecastTrajectories[param]) continue;
    const limit = limits[param] !== undefined ? limits[param] : limits[`${param}_max_uA`] || limits.tpd_max_ns;
    if (limit === undefined) {
      throw new Error(`MISSING_SPEC_LIMIT: No limit defined for parameter '${param}'`);
    }

    const paramTraj = forecastTrajectories[param];
    let breachHour = null;
    const hours = Object.keys(paramTraj).map(Number).sort((a, b) => a - b);
    for (const h of hours) {
      const val = Number(paramTraj[h]);
      if (h >= 24 && val > limit) {
        breachHour = h;
        break;
      }
    }

    const isBreach = breachHour !== null;
    if (isBreach) {
      overallBreach = true;
      if (earliestBreachHour === null || breachHour < earliestBreachHour) {
        earliestBreachHour = breachHour;
      }
    }

    projections[param] = {
      breach_projected: isBreach,
      earliest_crossing_hour: breachHour,
      crossing_direction: isBreach ? "UPWARD_BREACH" : "WITHIN_LIMITS",
      applicable_criterion: "PROJECT_DEFINED_SCREENING_CRITERION",
      screening_limit: Number(limit),
      forecast_at_168h: Number(paramTraj[168] !== undefined ? paramTraj[168] : paramTraj["168"] || 0.0),
      forecast_trajectory: paramTraj
    };
  }

  return {
    parameter_projections: projections,
    overall_breach_projected: overallBreach,
    earliest_breach_hour: earliestBreachHour,
    criteria_source: "PROJECT_DEFINED_SCREENING_CRITERION"
  };
}

function evaluateLegacyGprGovernance(gprPath = null) {
  const defaultGprPath = path.resolve(__dirname, "../../ml/models/production/predicta_gpr_kernel_artifacts.json");
  const pathToUse = gprPath || defaultGprPath;
  if (!fs.existsSync(pathToUse)) {
    return {
      model_name: "Predicta Gaussian Process Regressor",
      status: "MISSING_ARTIFACT",
      compatibility_status: "INCOMPATIBLE_TRAINING_SCHEMA",
      rejection_reason: `Artifact not found at ${pathToUse}`
    };
  }

  const sha = computeSha256(pathToUse);
  let split = {};
  try {
    const data = JSON.parse(fs.readFileSync(pathToUse, "utf-8"));
    split = data.lot_split || {};
  } catch (err) {
    return {
      model_name: "Predicta Gaussian Process Regressor",
      status: "CORRUPTED_ARTIFACT",
      compatibility_status: "INCOMPATIBLE_TRAINING_SCHEMA",
      rejection_reason: `Failed to parse artifact JSON: ${err.message}`
    };
  }

  return {
    model_name: "Predicta Gaussian Process Regressor (GPR)",
    model_path: "ml/models/production/predicta_gpr_kernel_artifacts.json",
    model_sha256: sha,
    target_task: "continuous_parametric_drift_forecasting",
    compatibility_status: "INCOMPATIBLE_TRAINING_SCHEMA",
    rejection_reason:
      "Legacy GPR artifact was trained on a non-authoritative lot split (LOT-SYN-001..030) that overlaps the authoritative validation_tune (LOT-SYN-036..038) and calibration (LOT-SYN-039..042) cohorts and lacks multi-horizon (48h..168h) trajectory projection targets.",
    recorded_lot_split: split,
    promotion_eligible: false
  };
}

module.exports = {
  TrajectoryState,
  FeatureProvenance,
  CANONICAL_EARLY_FEATURES,
  CANONICAL_FUTURE_FIELDS,
  FORBIDDEN_LEAKAGE_TOKENS,
  CONTRACT_PATH,
  computeSha256,
  loadAuthoritativePrognosticContract,
  getAuthoritativeSpecLimits,
  getAuthoritativeContinuousSpec,
  validateEarlyFeatureInput,
  validateContinuousFeatureInput,
  evaluateAcceptanceAtHour,
  evaluateTrajectoryState,
  extractPrognosticRecord,
  splitPrognosticDataset,
  calculatePrognosticMetrics,
  calculateContinuousRegressionMetrics,
  ContinuousTrajectoryDatasetBuilder,
  ContinuousPersistenceBaseline,
  DeterministicContinuousDegradationModel,
  evaluateThresholdProjections,
  evaluateLegacyGprGovernance
};
