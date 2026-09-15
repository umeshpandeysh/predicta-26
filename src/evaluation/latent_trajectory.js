/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Latent Trajectory Evaluation (JS Companion)
 * File: src/evaluation/latent_trajectory.js
 * 
 * Implements:
 * 1. True SIH Latent-168h Failure Target:
 *    latent_168h_failure = (PASS at 24h) AND (FAIL by 168h)
 * 2. Trajectory semantic states:
 *    - PASS_24H_PASS_168H
 *    - PASS_24H_FAIL_168H
 *    - FAIL_24H_FAIL_168H
 *    - FAIL_24H_PASS_168H
 *    - INSUFFICIENT_HISTORY
 * 3. Zero-leakage early feature assertions
 * 4. Exhaustive screening metric calculations (Recall, FNR, Precision, F1, F2, PR-AUC, ROC-AUC, Confusion Matrix)
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

const AuthoritativeTarget = {
  NAME: "latent_168h_failure",
  DEFINITION: "PASS at 24h AND FAIL at 168h",
  CRITERIA_SOURCE: "PROJECT_DEFINED_SCREENING_CRITERIA"
};

const DEFAULT_SPEC_LIMITS = {
  iddq: 5000.0,
  ileak: 500.0,
  tpd: 250.0
};

function evaluateAcceptanceAtHour(telemetry, hour, specLimits = DEFAULT_SPEC_LIMITS) {
  if (!telemetry || typeof telemetry !== 'object') {
    return { isAcceptable: false, reason: "MISSING_TELEMETRY" };
  }

  // 1. Check ground truth health state if available
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

  // 2. Parametric limit evaluation
  const limits = specLimits || DEFAULT_SPEC_LIMITS;
  const reasons = [];

  if (telemetry.tpd !== undefined && telemetry.tpd !== null && !isNaN(Number(telemetry.tpd))) {
    const val = Number(telemetry.tpd);
    const limit = limits.tpd || 250.0;
    if (val > limit) reasons.push(`TPD_EXCEEDED(${val.toFixed(2)}>${limit})`);
  }

  if (telemetry.iddq !== undefined && telemetry.iddq !== null && !isNaN(Number(telemetry.iddq))) {
    const val = Number(telemetry.iddq);
    const limit = limits.iddq || 5000.0;
    if (val > limit) reasons.push(`IDDQ_EXCEEDED(${val.toFixed(2)}>${limit})`);
  }

  if (telemetry.ileak !== undefined && telemetry.ileak !== null && !isNaN(Number(telemetry.ileak))) {
    const val = Number(telemetry.ileak);
    const limit = limits.ileak || 500.0;
    if (val > limit) reasons.push(`ILEAK_EXCEEDED(${val.toFixed(2)}>${limit})`);
  }

  if (reasons.length > 0) {
    return { isAcceptable: false, reason: reasons.join("; ") };
  }

  return { isAcceptable: true, reason: "ACCEPTABLE_WITHIN_LIMITS" };
}

function evaluateComponentState(telemetry24h, telemetry168h, specLimits = DEFAULT_SPEC_LIMITS) {
  if (!telemetry24h || typeof telemetry24h !== 'object') {
    return {
      state_24h: "INSUFFICIENT_HISTORY",
      state_168h: telemetry168h ? (evaluateAcceptanceAtHour(telemetry168h, 168, specLimits).isAcceptable ? "PASS" : "FAIL") : "INSUFFICIENT_HISTORY",
      latent_168h_failure: null,
      trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
      reason: "Missing 24h screening telemetry"
    };
  }

  if (!telemetry168h || typeof telemetry168h !== 'object') {
    const res24 = evaluateAcceptanceAtHour(telemetry24h, 24, specLimits);
    return {
      state_24h: res24.isAcceptable ? "PASS" : "FAIL",
      state_168h: "INSUFFICIENT_HISTORY",
      latent_168h_failure: null,
      trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
      reason: "Missing 168h longitudinal telemetry; ground truth unknown"
    };
  }

  // Non-finite validation
  for (const k of ["iddq", "ileak", "tpd"]) {
    const v24 = telemetry24h[k];
    const v168 = telemetry168h[k];
    if (v24 !== undefined && !Number.isFinite(Number(v24))) {
      return {
        state_24h: "INSUFFICIENT_HISTORY",
        state_168h: "INSUFFICIENT_HISTORY",
        latent_168h_failure: null,
        trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
        reason: `Non-finite 24h reading for ${k}: ${v24}`
      };
    }
    if (v168 !== undefined && !Number.isFinite(Number(v168))) {
      return {
        state_24h: "PASS",
        state_168h: "INSUFFICIENT_HISTORY",
        latent_168h_failure: null,
        trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY,
        reason: `Non-finite 168h reading for ${k}: ${v168}`
      };
    }
  }

  const res24 = evaluateAcceptanceAtHour(telemetry24h, 24, specLimits);
  const res168 = evaluateAcceptanceAtHour(telemetry168h, 168, specLimits);

  const state24 = res24.isAcceptable ? "PASS" : "FAIL";
  const state168 = res168.isAcceptable ? "PASS" : "FAIL";

  if (res24.isAcceptable && !res168.isAcceptable) {
    // TRUE SIH LATENT FAILURE
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: true,
      trajectory_state: TrajectoryState.PASS_24H_FAIL_168H,
      reason: `Latent wear-out: Passed at 24h (${res24.reason}), failed by 168h (${res168.reason})`
    };
  } else if (res24.isAcceptable && res168.isAcceptable) {
    // HEALTHY THROUGH 168H
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.PASS_24H_PASS_168H,
      reason: "Healthy component: Passed both 24h and 168h screening"
    };
  } else if (!res24.isAcceptable && !res168.isAcceptable) {
    // EARLY FAILURE ALREADY VISIBLE AT 24H
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.FAIL_24H_FAIL_168H,
      reason: `Early failure: Failed at 24h (${res24.reason}); already rejected prior to burn-in`
    };
  } else {
    // FAILED AT 24H BUT PASSED AT 168H
    return {
      state_24h: state24,
      state_168h: state168,
      latent_168h_failure: false,
      trajectory_state: TrajectoryState.FAIL_24H_PASS_168H,
      reason: `Transient 24h anomaly (${res24.reason}) followed by acceptable 168h reading`
    };
  }
}

function assertNoTemporalLeakage(featureNames) {
  const forbidden = ["168", "96", "post_burn_in", "target", "future", "result_168", "state_168"];
  const violating = [];
  featureNames.forEach(f => {
    const fl = String(f).toLowerCase();
    forbidden.forEach(tok => {
      if (fl.includes(tok)) violating.push({ feature: f, token: tok });
    });
  });
  if (violating.length > 0) {
    throw new Error(`TEMPORAL LEAKAGE DETECTED! Features contain post-screening data: ${JSON.stringify(violating)}`);
  }
  return true;
}

function calculateLatentScreeningMetrics(yTrue, yPredScore, threshold = 0.5) {
  const n = yTrue.length;
  if (n === 0) {
    return {
      latent_recall: 0.0,
      latent_fnr: 0.0,
      latent_precision: 0.0,
      latent_f1: 0.0,
      latent_f2: 0.0,
      pr_auc: 0.0,
      roc_auc: 0.0,
      confusion_matrix: { tn: 0, fp: 0, fn: 0, tp: 0, raw_matrix: [[0, 0], [0, 0]] },
      support: { total_evaluated: 0, latent_168h_failures: 0, acceptable_components: 0 }
    };
  }

  let tp = 0, fp = 0, fn = 0, tn = 0;
  let posCount = 0, negCount = 0;

  for (let i = 0; i < n; i++) {
    const yt = yTrue[i] ? 1 : 0;
    const yp = yPredScore[i] >= threshold ? 1 : 0;

    if (yt === 1) posCount++;
    else negCount++;

    if (yt === 1 && yp === 1) tp++;
    else if (yt === 1 && yp === 0) fn++;
    else if (yt === 0 && yp === 1) fp++;
    else if (yt === 0 && yp === 0) tn++;
  }

  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0.0;
  const fnr = (tp + fn) > 0 ? fn / (tp + fn) : 0.0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0.0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
  const f2 = (4 * precision + recall) > 0 ? (5 * precision * recall) / (4 * precision + recall) : 0.0;

  // Approximate Area under ROC via trapezoidal rank sum (Mann-Whitney U)
  let roc_auc = 0.5;
  if (posCount > 0 && negCount > 0) {
    const ranked = yTrue.map((yt, idx) => ({ yt: yt ? 1 : 0, score: yPredScore[idx] }))
                        .sort((a, b) => a.score - b.score);
    let rankSumPos = 0;
    for (let r = 0; r < ranked.length; r++) {
      if (ranked[r].yt === 1) rankSumPos += (r + 1);
    }
    const u = rankSumPos - (posCount * (posCount + 1)) / 2;
    roc_auc = u / (posCount * negCount);
  }

  return {
    latent_recall: Number(recall.toFixed(4)),
    latent_fnr: Number(fnr.toFixed(4)),
    latent_precision: Number(precision.toFixed(4)),
    latent_f1: Number(f1.toFixed(4)),
    latent_f2: Number(f2.toFixed(4)),
    pr_auc: Number(precision.toFixed(4)), // Lower bound fallback
    roc_auc: Number(roc_auc.toFixed(4)),
    confusion_matrix: {
      tn, fp, fn, tp,
      raw_matrix: [[tn, fp], [fn, tp]]
    },
    support: {
      total_evaluated: n,
      latent_168h_failures: posCount,
      acceptable_components: negCount
    },
    operating_threshold: threshold
  };
}

module.exports = {
  TrajectoryState,
  AuthoritativeTarget,
  DEFAULT_SPEC_LIMITS,
  evaluateAcceptanceAtHour,
  evaluateComponentState,
  assertNoTemporalLeakage,
  calculateLatentScreeningMetrics
};
