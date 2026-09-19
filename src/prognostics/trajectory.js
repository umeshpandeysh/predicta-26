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
  if (!fs.existsSync(splitManifestPath)) {
    throw new Error(`SPLIT_MANIFEST_NOT_FOUND: Split manifest not found at ${splitManifestPath}`);
  }

  let splitManifest;
  try {
    splitManifest = JSON.parse(fs.readFileSync(splitManifestPath, 'utf-8'));
  } catch (err) {
    throw new Error(`SPLIT_MANIFEST_MALFORMED: Failed to parse split manifest: ${err.message}`);
  }

  const lotsObj = splitManifest.lots || {};
  const trainLots = new Set(lotsObj.train || []);
  const valLots = new Set(lotsObj.validation || []);
  const testLots = new Set(lotsObj.test || []);

  const seenComponents = new Set();
  const trainRecs = [];
  const valRecs = [];
  const testRecs = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const meta = r.metadata || {};
    const cId = meta.component_id ? String(meta.component_id).trim() : null;
    if (!cId) {
      throw new Error(`MISSING_COMPONENT_ID: Record at index ${i} has missing or empty component_id.`);
    }

    if (seenComponents.has(cId)) {
      throw new Error(`DUPLICATE_COMPONENT_DETECTED: Component '${cId}' appears multiple times in input dataset.`);
    }
    seenComponents.add(cId);

    const lot = meta.lot_id ? String(meta.lot_id).trim() : null;
    if (!lot) {
      throw new Error(`MISSING_LOT_DETECTED: Component '${cId}' has missing or empty lot_id.`);
    }

    if (trainLots.has(lot)) {
      trainRecs.push(r);
    } else if (valLots.has(lot)) {
      valRecs.push(r);
    } else if (testLots.has(lot)) {
      testRecs.push(r);
    } else {
      throw new Error(`UNKNOWN_LOT_DETECTED: Component '${cId}' has lot '${lot}' not defined in split manifest.`);
    }
  }

  // Strict completeness: assigned == input
  const totalAssigned = trainRecs.length + valRecs.length + testRecs.length;
  if (totalAssigned !== records.length) {
    throw new Error(`SPLIT_INCOMPLETE: Expected ${records.length} assigned records, got ${totalAssigned}`);
  }

  // Disjointness check
  const trainComps = new Set(trainRecs.map(r => r.metadata.component_id));
  const valComps = new Set(valRecs.map(r => r.metadata.component_id));
  const testComps = new Set(testRecs.map(r => r.metadata.component_id));

  for (const c of trainComps) {
    if (valComps.has(c) || testComps.has(c)) {
      throw new Error(`SPLIT_LEAKAGE: Overlapping components across splits for ${c}`);
    }
  }
  for (const c of valComps) {
    if (testComps.has(c)) {
      throw new Error(`SPLIT_LEAKAGE: Overlapping components across splits for ${c}`);
    }
  }

  return { trainRecs, valRecs, testRecs };
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
  validateEarlyFeatureInput,
  evaluateAcceptanceAtHour,
  evaluateTrajectoryState,
  extractPrognosticRecord,
  splitPrognosticDataset,
  calculatePrognosticMetrics
};
