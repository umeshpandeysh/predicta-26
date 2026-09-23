/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
 * Authoritative Sensor / Equipment / Component Discrimination Engine (Node.js)
 * File: src/governance/discrimination_engine.js
 * 
 * Classifies root-anomaly evidence into:
 * 1. SENSOR_OR_DATA_QUALITY: Range breaches, single-channel unphysical steps, flatlines, corrupted data.
 * 2. EQUIPMENT_OR_CHAMBER: Lot-wide or equipment-correlated baseline shifts across dies.
 * 3. COMPONENT_SILICON: Isolated single-die multi-parameter physical degradation (BTI, Arrhenius leakage).
 * 4. INSUFFICIENT_EVIDENCE: Fail-closed fallback when telemetry, metadata, or lot context is incomplete.
 * 
 * DISCLAIMER:
 * Non-causal evidence classification — NOT a definitive claim of physical causation.
 */

'use strict';

const RootEvidenceType = Object.freeze({
  SENSOR_OR_DATA_QUALITY: 'SENSOR_OR_DATA_QUALITY',
  EQUIPMENT_OR_CHAMBER: 'EQUIPMENT_OR_CHAMBER',
  COMPONENT_SILICON: 'COMPONENT_SILICON',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const TopologyPattern = Object.freeze({
  ISOLATED_COMPONENT_PATTERN: 'ISOLATED_COMPONENT_PATTERN',
  EQUIPMENT_WIDE_PATTERN: 'EQUIPMENT_WIDE_PATTERN',
  CHAMBER_WIDE_PATTERN: 'CHAMBER_WIDE_PATTERN',
  WAFER_CLUSTER_PATTERN: 'WAFER_CLUSTER_PATTERN',
  INSUFFICIENT_TOPOLOGY_EVIDENCE: 'INSUFFICIENT_TOPOLOGY_EVIDENCE'
});

const PHYSICAL_RANGES = Object.freeze({
  supply_voltage: { min: 0.5, max: 2.5 },       // V
  output_voltage: { min: 0.0, max: 2.5 },       // V
  current: { min: 0.0, max: 100.0 },            // mA
  leakage_current: { min: 0.0, max: 2000.0 },   // uA
  resistance: { min: 0.01, max: 10000.0 },      // Ohm
  capacitance: { min: 0.001, max: 100.0 },      // nF
  threshold_voltage: { min: 0.1, max: 1.5 },    // V
  frequency: { min: 1.0, max: 5000.0 },         // MHz
  propagation_delay: { min: 10.0, max: 500.0 }, // ps
  temperature: { min: -40.0, max: 175.0 },      // C
  dynamic_power: { min: 0.0, max: 50.0 },       // mW
  total_power: { min: 0.0, max: 100.0 }         // mW
});

const NON_CAUSAL_DISCLAIMER = 'NON-CAUSAL EVIDENCE CLASSIFICATION — NOT A DEFINITIVE CLAIM OF PHYSICAL CAUSATION';

class DiscriminationEngine {
  constructor() {
    this.disclaimer = NON_CAUSAL_DISCLAIMER;
  }

  /**
   * Discriminate anomaly evidence from telemetry, anomaly scores, and lot context.
   * 
   * @param {Object} params
   * @param {Object} params.telemetry_0h - 0h checkpoint measurements (or baseline)
   * @param {Object} params.telemetry_24h - 24h checkpoint measurements
   * @param {Object} [params.anomaly_evidence] - Anomaly detector outputs (PAT, COPOD, IF)
   * @param {Object} [params.equipment_context] - Equipment / chamber metadata & lot statistics
   * @param {Object} [params.physics_evidence] - Physics consistency evaluation results
   * @param {Object} [params.genealogy_context] - Genealogy / lot / wafer / chamber topology metadata
   * @returns {Object} Discrimination report
   */
  evaluate(params = {}) {
    if (!params || typeof params !== 'object') {
      return this._fallbackReport('Invalid or missing input parameters');
    }

    const t0 = params.telemetry_0h || {};
    const t24 = params.telemetry_24h || {};
    const anomaly = params.anomaly_evidence || {};
    const eqContext = params.equipment_context || {};
    const physics = params.physics_evidence || {};

    // If both telemetry checkpoints are missing or empty, fail closed
    if (Object.keys(t0).length === 0 && Object.keys(t24).length === 0) {
      return this._fallbackReport('Zero telemetry data provided');
    }

    const checks = {
      sensor_range_violations: [],
      sensor_flatline_channels: [],
      sensor_single_channel_steps: [],
      equipment_lot_shifts: [],
      equipment_chamber_correlations: [],
      silicon_physical_indicators: [],
      physics_consistency_status: physics.status || 'UNKNOWN'
    };

    // 1. Check Sensor & Data Quality
    let sensorIssueDetected = false;

    // A. Range violations on t0 and t24
    const evalData = Object.keys(t24).length > 0 ? t24 : t0;
    for (const [param, val] of Object.entries(evalData)) {
      if (PHYSICAL_RANGES[param]) {
        const numVal = Number(val);
        if (isNaN(numVal) || !Number.isFinite(numVal)) {
          checks.sensor_range_violations.push(`${param}=${val} (NaN/Non-finite)`);
          sensorIssueDetected = true;
        } else if (numVal < PHYSICAL_RANGES[param].min || numVal > PHYSICAL_RANGES[param].max) {
          checks.sensor_range_violations.push(
            `${param}=${numVal} outside physical range [${PHYSICAL_RANGES[param].min}, ${PHYSICAL_RANGES[param].max}]`
          );
          sensorIssueDetected = true;
        }
      }
    }

    // B. Check flatline / zero variance across multiple dynamic parameters if both t0 and t24 provided
    if (Object.keys(t0).length > 0 && Object.keys(t24).length > 0) {
      const dynamicParams = ['leakage_current', 'propagation_delay', 'dynamic_power', 'temperature'];
      let exactMatches = 0;
      let evaluatedCount = 0;
      for (const p of dynamicParams) {
        if (t0[p] !== undefined && t24[p] !== undefined) {
          evaluatedCount++;
          if (Number(t0[p]) === Number(t24[p]) && Number(t0[p]) !== 0) {
            exactMatches++;
            checks.sensor_flatline_channels.push(p);
          }
        }
      }
      if (evaluatedCount >= 3 && exactMatches >= 3) {
        sensorIssueDetected = true;
      }

      // C. Unphysical single-channel step: massive shift on 1 channel with 0 change on correlated channels
      if (t0.supply_voltage !== undefined && t24.supply_voltage !== undefined &&
          t0.current !== undefined && t24.current !== undefined) {
        const vDiff = Math.abs(Number(t24.supply_voltage) - Number(t0.supply_voltage));
        const iDiff = Math.abs(Number(t24.current) - Number(t0.current));
        if (vDiff > 0.5 && iDiff < 0.001) {
          checks.sensor_single_channel_steps.push('Severe supply_voltage step without correlated current change');
          sensorIssueDetected = true;
        }
      }
    }

    // 2. Check Equipment / Chamber correlation
    let equipmentIssueDetected = false;
    if (eqContext && typeof eqContext === 'object') {
      if (eqContext.lot_equipment_anomaly_rate !== undefined && eqContext.lot_equipment_anomaly_rate !== null &&
          !isNaN(Number(eqContext.lot_equipment_anomaly_rate)) && Number(eqContext.lot_equipment_anomaly_rate) > 0.40) {
        checks.equipment_lot_shifts.push(
          `High anomaly rate (${(Number(eqContext.lot_equipment_anomaly_rate) * 100).toFixed(1)}%) across dies on equipment ${eqContext.equipment_id || 'UNKNOWN'}`
        );
        equipmentIssueDetected = true;
      }
      if (eqContext.chamber_thermal_offset_detected === true) {
        checks.equipment_chamber_correlations.push(
          `Chamber thermal offset detected in test run: offset=${eqContext.chamber_thermal_offset_c || 0}C`
        );
        equipmentIssueDetected = true;
      }
      if (eqContext.equipment_shift_zscore !== undefined && eqContext.equipment_shift_zscore !== null &&
          !isNaN(Number(eqContext.equipment_shift_zscore)) && Number(eqContext.equipment_shift_zscore) > 3.0) {
        checks.equipment_lot_shifts.push(
          `Lot-level baseline parameter shift z-score=${Number(eqContext.equipment_shift_zscore).toFixed(2)} on equipment ${eqContext.equipment_id || 'UNKNOWN'}`
        );
        equipmentIssueDetected = true;
      }
    }

    // 3. Check Component Silicon Physical Degradation
    let siliconIssueDetected = false;
    // BTI Signature: Vth positive drift + Tpd increase
    if (t0.threshold_voltage !== undefined && t24.threshold_voltage !== undefined) {
      const vth0 = Number(t0.threshold_voltage);
      const vth24 = Number(t24.threshold_voltage);
      const deltaVth = vth24 - vth0;
      if (deltaVth > 0.02) { // >20mV drift
        checks.silicon_physical_indicators.push(`Positive Vth drift (dVth=+${(deltaVth * 1000).toFixed(1)}mV) indicating BTI aging`);
        siliconIssueDetected = true;
      }
    }

    // Arrhenius Leakage Signature: Ileak increase correlated with temperature
    if (t0.leakage_current !== undefined && t24.leakage_current !== undefined) {
      const ileak0 = Number(t0.leakage_current);
      const ileak24 = Number(t24.leakage_current);
      const ratio = ileak0 > 0 ? (ileak24 / ileak0) : 1.0;
      if (ratio > 1.25) {
        checks.silicon_physical_indicators.push(`Leakage current elevation (${ratio.toFixed(2)}x baseline) indicating dielectric/junction degradation`);
        siliconIssueDetected = true;
      }
    }

    // Anomaly detector signals (PAT / COPOD / IF)
    if (anomaly.status === 'REJECT' || anomaly.status === 'MONITOR' ||
        (anomaly.copod && anomaly.copod.score > 6.0) ||
        (anomaly.pat && anomaly.pat.status === 'REJECT')) {
      if (!sensorIssueDetected && !equipmentIssueDetected) {
        checks.silicon_physical_indicators.push('Multi-parameter outlier localized to single die under nominal equipment baseline');
        siliconIssueDetected = true;
      }
    }

    // 4. Topology Pattern Analysis
    const genealogyCtx = params.genealogy_context || {};
    const hasGenealogy = Boolean(
      genealogyCtx.lot_id ||
      genealogyCtx.wafer_id ||
      eqContext.equipment_id ||
      genealogyCtx.chamber_id ||
      genealogyCtx.socket_id
    );

    let topologyPattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE;
    const topologyAnalytics = {
      lot_id: genealogyCtx.lot_id || eqContext.lot_id || null,
      wafer_id: genealogyCtx.wafer_id || null,
      tester_id: eqContext.equipment_id || genealogyCtx.tester_id || null,
      chamber_id: genealogyCtx.chamber_id || null,
      socket_id: genealogyCtx.socket_id || null,
      die_x: genealogyCtx.die_x !== undefined ? genealogyCtx.die_x : null,
      die_y: genealogyCtx.die_y !== undefined ? genealogyCtx.die_y : null,
      spatial_cluster_detected: Boolean(genealogyCtx.spatial_cluster_detected),
      chamber_synchronization_detected: Boolean(genealogyCtx.chamber_synchronization_detected)
    };

    if (!hasGenealogy) {
      topologyPattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE;
    } else if (genealogyCtx.spatial_cluster_detected) {
      topologyPattern = TopologyPattern.WAFER_CLUSTER_PATTERN;
    } else if (genealogyCtx.chamber_synchronization_detected || eqContext.chamber_thermal_offset_detected) {
      topologyPattern = TopologyPattern.CHAMBER_WIDE_PATTERN;
    } else if (
      (eqContext.lot_equipment_anomaly_rate && Number(eqContext.lot_equipment_anomaly_rate) > 0.40) ||
      (eqContext.equipment_shift_zscore && Number(eqContext.equipment_shift_zscore) > 3.0)
    ) {
      topologyPattern = TopologyPattern.EQUIPMENT_WIDE_PATTERN;
    } else if (siliconIssueDetected) {
      topologyPattern = TopologyPattern.ISOLATED_COMPONENT_PATTERN;
    } else {
      topologyPattern = TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE;
    }

    // 5. Synthesize Discrimination Result
    if (sensorIssueDetected) {
      return {
        root_evidence_type: RootEvidenceType.SENSOR_OR_DATA_QUALITY,
        topology_pattern: topologyPattern,
        topology_analytics: topologyAnalytics,
        confidence_score: 0.90,
        evidence_summary: `Sensor or data quality anomaly detected: ${checks.sensor_range_violations.concat(checks.sensor_single_channel_steps).concat(checks.sensor_flatline_channels).join('; ')}`,
        findings: checks.sensor_range_violations.concat(checks.sensor_single_channel_steps),
        checks_evaluated: checks,
        disclaimer: this.disclaimer
      };
    }

    if (equipmentIssueDetected) {
      return {
        root_evidence_type: RootEvidenceType.EQUIPMENT_OR_CHAMBER,
        topology_pattern: topologyPattern,
        topology_analytics: topologyAnalytics,
        confidence_score: 0.85,
        evidence_summary: `Equipment/chamber level shift detected across test cohort: ${checks.equipment_lot_shifts.concat(checks.equipment_chamber_correlations).join('; ')}`,
        findings: checks.equipment_lot_shifts.concat(checks.equipment_chamber_correlations),
        checks_evaluated: checks,
        disclaimer: this.disclaimer
      };
    }

    if (siliconIssueDetected) {
      return {
        root_evidence_type: RootEvidenceType.COMPONENT_SILICON,
        topology_pattern: topologyPattern,
        topology_analytics: topologyAnalytics,
        confidence_score: 0.88,
        evidence_summary: `Silicon-level localized degradation detected: ${checks.silicon_physical_indicators.join('; ')}`,
        findings: checks.silicon_physical_indicators,
        checks_evaluated: checks,
        disclaimer: this.disclaimer
      };
    }

    // If no anomalies or issues detected across all layers: absence of fault evidence must NOT become COMPONENT_SILICON
    return {
      root_evidence_type: RootEvidenceType.INSUFFICIENT_EVIDENCE,
      topology_pattern: topologyPattern,
      topology_analytics: topologyAnalytics,
      confidence_score: 0.0,
      evidence_summary: 'Nominal operating telemetry within allowable baseline; insufficient fault evidence to attribute sensor, equipment, or silicon failure.',
      findings: ['Nominal operating envelope — no fault discrimination required'],
      checks_evaluated: checks,
      disclaimer: this.disclaimer
    };
  }

  _fallbackReport(reason) {
    return {
      root_evidence_type: RootEvidenceType.INSUFFICIENT_EVIDENCE,
      topology_pattern: TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE,
      topology_analytics: {},
      confidence_score: 0.0,
      evidence_summary: `Fail-closed discrimination fallback: ${reason}`,
      findings: [reason],
      checks_evaluated: {
        sensor_range_violations: [],
        sensor_flatline_channels: [],
        sensor_single_channel_steps: [],
        equipment_lot_shifts: [],
        equipment_chamber_correlations: [],
        silicon_physical_indicators: [],
        physics_consistency_status: 'INSUFFICIENT_PHYSICS_EVIDENCE'
      },
      disclaimer: this.disclaimer
    };
  }
}

module.exports = {
  DiscriminationEngine,
  RootEvidenceType,
  TopologyPattern,
  PHYSICAL_RANGES,
  NON_CAUSAL_DISCLAIMER
};
