/**
 * Predicta Semiconductor Intelligence Platform — Phase 9 Latent Defect Decision Robustness Contract (JS Companion)
 * File: src/evaluation/robustness_contract.js
 * 
 * Implements JS calculations for:
 * 1. Score perturbation evaluations
 * 2. Classification flip accounting
 * 3. Decision-analysis prevalence sensitivity projections
 */

const { Phase9CostContract } = require('./cost_contract');

function evaluatePrevalenceSensitivity(testRecall, testFpr, prevalences = [0.005, 0.01, 0.02, 0.05, 0.10], fnCost = 500.0, fpCost = 100.0) {
  const tpr = Number(testRecall);
  const fpr = Number(testFpr);
  const fnr = 1.0 - tpr;
  const tnr = 1.0 - fpr;

  const scenarios = prevalences.map(pi => {
    const piVal = Number(pi.toFixed(4));
    const ppvDenom = (piVal * tpr) + ((1.0 - piVal) * fpr);
    const ppv = ppvDenom > 0 ? (piVal * tpr) / ppvDenom : 0.0;

    const npvDenom = ((1.0 - piVal) * tnr) + (piVal * fnr);
    const npv = npvDenom > 0 ? ((1.0 - piVal) * tnr) / npvDenom : 0.0;

    const fpPer1k = 1000.0 * (1.0 - piVal) * fpr;
    const fnPer1k = 1000.0 * piVal * fnr;

    const costPer1k = fnPer1k * fnCost + fpPer1k * fpCost;
    const costPer10k = costPer1k * 10.0;

    return {
      assumed_prevalence_pct: `${(piVal * 100).toFixed(1)}%`,
      assumed_prevalence_float: piVal,
      expected_precision_ppv: Number(ppv.toFixed(6)),
      expected_npv: Number(npv.toFixed(6)),
      expected_fp_per_1k: Number(fpPer1k.toFixed(4)),
      expected_fn_per_1k: Number(fnPer1k.toFixed(4)),
      expected_cost_per_1k_units: Number(costPer1k.toFixed(2)),
      expected_cost_per_10k_units: Number(costPer10k.toFixed(2))
    };
  });

  return {
    analysis_type: "ANALYTICAL_DECISION_PROJECTION",
    input_test_recall: Number(tpr.toFixed(6)),
    input_test_fpr: Number(fpr.toFixed(6)),
    prevalence_scenarios: scenarios
  };
}

function analyzeClassificationFlips(baselinePreds, perturbedPreds, groundTruth) {
  const n = baselinePreds.length;
  let flips = 0;
  let posToNeg = 0;
  let negToPos = 0;
  let latentPosFlips = 0;
  let latentNegFlips = 0;

  for (let i = 0; i < n; i++) {
    const b = baselinePreds[i] ? 1 : 0;
    const p = perturbedPreds[i] ? 1 : 0;
    const gt = groundTruth[i] ? 1 : 0;

    if (b !== p) {
      flips++;
      if (b === 1 && p === 0) posToNeg++;
      if (b === 0 && p === 1) negToPos++;
      if (gt === 1) latentPosFlips++;
      if (gt === 0) latentNegFlips++;
    }
  }

  const flipRate = n > 0 ? flips / n : 0.0;

  return {
    total_eligible_samples: n,
    total_flips: flips,
    flip_rate: Number(flipRate.toFixed(6)),
    positive_to_negative_flips: posToNeg,
    negative_to_positive_flips: negToPos,
    latent_positive_flips: latentPosFlips,
    latent_negative_flips: latentNegFlips
  };
}

module.exports = {
  evaluatePrevalenceSensitivity,
  analyzeClassificationFlips
};
