/**
 * Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect Contract (JS Companion)
 * File: src/evaluation/cost_contract.js
 * 
 * Implements authoritative JS calculations for:
 * 1. Phase 9 Cost Contract (FN=$500, FP=$100, 5:1 ratio)
 * 2. Total cost, cost per sample, normalized cost
 * 3. Class accounting & population eligibility
 * 4. Zero-leakage feature assertions
 * 5. Full reliability & confusion matrix calculation
 */

const TrajectoryState = {
  PASS_24H_PASS_168H: "PASS_24H_PASS_168H",
  PASS_24H_FAIL_168H: "PASS_24H_FAIL_168H",
  FAIL_24H_FAIL_168H: "FAIL_24H_FAIL_168H",
  FAIL_24H_PASS_168H: "FAIL_24H_PASS_168H",
  INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY"
};

const PREDICTOR_NAME = "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE";
const PREDICTOR_TYPE = "HEURISTIC_BASELINE";
const PRODUCTION_MODEL_USED = false;

const Phase9CostContract = {
  false_negative_cost: 500.0,
  false_positive_cost: 100.0,
  cost_ratio_fn_to_fp: 5.0,
  provenance_class: "PROJECT_DEFINED_SYNTHETIC_BENCHMARK",
  cost_description: "Project-defined benchmark cost model: FN=$500, FP=$100. BENCHMARK_ONLY."
};

function computeTotalCost(fn, fp, fnCost = 500.0, fpCost = 100.0) {
  return Number(fn * fnCost + fp * fpCost);
}

function computeCostPerSample(totalCost, totalEligibleSamples) {
  if (!totalEligibleSamples || totalEligibleSamples <= 0) return 0.0;
  return Number(totalCost / totalEligibleSamples);
}

function computeNormalizedCost(totalCost, totalPositives, fnCost = 500.0) {
  const maxPossibleCost = fnCost * totalPositives;
  if (!maxPossibleCost || maxPossibleCost <= 0) return 0.0;
  return Number(totalCost / maxPossibleCost);
}

function auditCohortEligibility(records) {
  let pass24pass168 = 0;
  let pass24fail168 = 0;
  let fail24fail168 = 0;
  let fail24pass168 = 0;
  let insufficientHistory = 0;

  records.forEach(r => {
    const state = r.trajectory_state;
    if (state === TrajectoryState.PASS_24H_PASS_168H) pass24pass168++;
    else if (state === TrajectoryState.PASS_24H_FAIL_168H) pass24fail168++;
    else if (state === TrajectoryState.FAIL_24H_FAIL_168H) fail24fail168++;
    else if (state === TrajectoryState.FAIL_24H_PASS_168H) fail24pass168++;
    else insufficientHistory++;
  });

  const totalCohort = records.length;
  const earlyFailures24h = fail24fail168 + fail24pass168;
  const totalEligible = pass24pass168 + pass24fail168;
  const latentPositives = pass24fail168;
  const nonLatentNegatives = pass24pass168;

  const prevalence = totalEligible > 0 ? latentPositives / totalEligible : 0.0;
  const imbalanceRatio = latentPositives > 0 ? nonLatentNegatives / latentPositives : 0.0;

  return {
    total_cohort_samples: totalCohort,
    excluded_insufficient_samples: insufficientHistory,
    early_failures_24h_samples: earlyFailures24h,
    total_eligible_samples: totalEligible,
    latent_positives: latentPositives,
    non_latent_negatives: nonLatentNegatives,
    latent_prevalence: Number(prevalence.toFixed(6)),
    class_imbalance_ratio: Number(imbalanceRatio.toFixed(4)),
    state_breakdown: {
      PASS_24H_PASS_168H: pass24pass168,
      PASS_24H_FAIL_168H: pass24fail168,
      FAIL_24H_FAIL_168H: fail24fail168,
      FAIL_24H_PASS_168H: fail24pass168,
      INSUFFICIENT_HISTORY: insufficientHistory
    }
  };
}

function assertLeakageSafeFeatureMatrix(featureNames, targetCol = "latent_168h_failure") {
  const forbidden = [
    "48h", "72h", "96h", "120h", "144h", "168h", "168",
    "future", "ground_truth", "target", "post_burn_in",
    "result_168", "state_168", "latent_168h_failure"
  ];
  const violating = [];

  featureNames.forEach(f => {
    const fl = String(f).toLowerCase();
    if (fl === targetCol.toLowerCase()) {
      violating.push({ feature: f, token: "TARGET_COLUMN_IN_FEATURES" });
    }
    forbidden.forEach(tok => {
      if (fl.includes(tok)) violating.push({ feature: f, token: tok });
    });
  });

  if (violating.length > 0) {
    throw new Error(`TEMPORAL LEAKAGE DETECTED! Features contain post-screening data: ${JSON.stringify(violating)}`);
  }
  return true;
}

function evaluateCostSensitivePerformance(yTrue, yProb, threshold = 0.5, fnCost = 500.0, fpCost = 100.0) {
  const n = yTrue.length;
  let tp = 0, fp = 0, fn = 0, tn = 0;
  let posCount = 0, negCount = 0;

  for (let i = 0; i < n; i++) {
    const yt = yTrue[i] ? 1 : 0;
    const yp = yProb[i] >= threshold ? 1 : 0;

    if (yt === 1) posCount++;
    else negCount++;

    if (yt === 1 && yp === 1) tp++;
    else if (yt === 1 && yp === 0) fn++;
    else if (yt === 0 && yp === 1) fp++;
    else if (yt === 0 && yp === 0) tn++;
  }

  const recall = posCount > 0 ? tp / posCount : 0.0;
  const fnr = posCount > 0 ? fn / posCount : 0.0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0.0;
  const specificity = negCount > 0 ? tn / negCount : 0.0;
  const fpr = negCount > 0 ? fp / negCount : 0.0;

  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
  const f2 = (4 * precision + recall) > 0 ? (5 * precision * recall) / (4 * precision + recall) : 0.0;

  const totalCost = computeTotalCost(fn, fp, fnCost, fpCost);
  const costPerSample = computeCostPerSample(totalCost, n);
  const normalizedCost = computeNormalizedCost(totalCost, posCount, fnCost);

  return {
    operating_threshold: Number(threshold.toFixed(4)),
    confusion_matrix: { tp, tn, fp, fn },
    support: {
      total_eligible_samples: n,
      latent_positives: posCount,
      non_latent_negatives: negCount
    },
    reliability_metrics: {
      recall: Number(recall.toFixed(6)),
      false_negative_rate: Number(fnr.toFixed(6)),
      precision: Number(precision.toFixed(6)),
      f1_score: Number(f1.toFixed(6)),
      f2_score: Number(f2.toFixed(6)),
      specificity: Number(specificity.toFixed(6)),
      false_positive_rate: Number(fpr.toFixed(6))
    },
    cost_metrics: {
      false_negative_cost_unit: fnCost,
      false_positive_cost_unit: fpCost,
      fn_count: fn,
      fp_count: fp,
      fn_total_cost: Number((fn * fnCost).toFixed(2)),
      fp_total_cost: Number((fp * fpCost).toFixed(2)),
      total_decision_cost: Number(totalCost.toFixed(2)),
      cost_per_eligible_sample: Number(costPerSample.toFixed(4)),
      normalized_cost: Number(normalizedCost.toFixed(6)),
      cost_provenance: Phase9CostContract.provenance_class
    }
  };
}

module.exports = {
  TrajectoryState,
  PREDICTOR_NAME,
  PREDICTOR_TYPE,
  PRODUCTION_MODEL_USED,
  Phase9CostContract,
  computeTotalCost,
  computeCostPerSample,
  computeNormalizedCost,
  auditCohortEligibility,
  assertLeakageSafeFeatureMatrix,
  evaluateCostSensitivePerformance
};
