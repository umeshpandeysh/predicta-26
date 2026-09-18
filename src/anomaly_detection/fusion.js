/**
 * Predicta Semiconductor Intelligence Platform — Multi-Criteria Anomaly Fusion (Node.js)
 * File: src/anomaly_detection/fusion.js
 */

const { RobustMADDetectorJS } = require('./robust_mad');
const { COPODDetectorJS } = require('./copod');
const { IsolationForestDetectorJS } = require('./isolation_forest');

class AnomalyFusionEngineJS {
  constructor(config = {}) {
    this.madDetector = config.mad_parameters ? new RobustMADDetectorJS(config.mad_parameters) : null;
    this.copodDetector = config.copod_parameters ? new COPODDetectorJS(config.copod_parameters) : null;
    this.isoDetector = config.isolation_forest_parameters ? new IsolationForestDetectorJS(config.isolation_forest_parameters) : null;
    this.weights = config.weights || { mad: 0.35, copod: 0.35, isolation_forest: 0.30 };
    this.fusionThreshold = config.fusion_threshold !== undefined ? Number(config.fusion_threshold) : 0.50;
    this.normScales = config.normalization_scales || {
      mad_scale: 6.0,
      copod_scale: 9.5,
      iso_min: 0.40,
      iso_scale: 0.30,
    };
  }

  evaluateComponent(features, lotId = null) {
    const madRes = this.madDetector ? this.madDetector.scoreSingle(features, lotId) : { score: 0.0, status: "PASS" };
    const copodRes = this.copodDetector ? this.copodDetector.scoreSingle(features) : { score: 0.0, status: "PASS" };
    const isoRes = this.isoDetector ? this.isoDetector.scoreSingle(features) : { score: 0.0, status: "PASS" };

    const madScale = this.normScales.mad_scale || 6.0;
    const copodScale = this.normScales.copod_scale || 9.5;
    const isoMin = this.normScales.iso_min !== undefined ? this.normScales.iso_min : 0.40;
    const isoScale = this.normScales.iso_scale || 0.30;

    const normMad = Math.min(1.0, Math.max(0.0, madRes.score / madScale));
    const normCopod = Math.min(1.0, Math.max(0.0, copodRes.score / copodScale));
    const normIso = isoRes.score >= isoMin ? Math.min(1.0, Math.max(0.0, (isoRes.score - isoMin) / isoScale)) : 0.0;

    const wMad = this.weights.mad || 0.35;
    const wCopod = this.weights.copod || 0.35;
    const wIso = this.weights.isolation_forest || 0.30;
    const totalW = wMad + wCopod + wIso;

    const weightedScore = ((wMad / totalW) * normMad) + ((wCopod / totalW) * normCopod) + ((wIso / totalW) * normIso);

    const conservativeReject = (
      madRes.status === "REJECT" ||
      copodRes.status === "REJECT" ||
      isoRes.status === "REJECT"
    );
    const conservativeMonitor = (
      madRes.status === "MONITOR" ||
      copodRes.status === "MONITOR" ||
      isoRes.status === "MONITOR"
    );

    const overallStatus = conservativeReject ? "REJECT" : (conservativeMonitor ? "MONITOR" : "PASS");

    return {
      overall_status: overallStatus,
      weighted_fusion_score: Number(weightedScore.toFixed(4)),
      conservative_alarm: conservativeReject,
      evidence: {
        mad: madRes,
        copod: copodRes,
        isolation_forest: isoRes,
      },
    };
  }
}

module.exports = { AnomalyFusionEngineJS };
