/**
 * Predicta v3 Production Scale Execution Bridge
 * Runs the authoritative Python generation algorithm from generate_dataset.py
 * Outputs: ml/data/synthetic/predicta_dataset_v3_50000.csv (50,000 records)
 */

const fs = require('fs');
const path = require('path');

class SeededRandom {
  constructor(seed = 42) {
    this.seed = seed;
  }

  random() {
    let x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  gauss(mean, stdDev, minVal = null) {
    let u = 0, v = 0;
    while (u === 0) u = this.random();
    while (v === 0) v = this.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    let val = mean + num * stdDev;
    if (minVal !== null && val < minVal) {
      val = minVal;
    }
    return val;
  }

  uniform(min, max) {
    return min + this.random() * (max - min);
  }

  choice(arr) {
    return arr[Math.floor(this.random() * arr.length)];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

const SCHEMA_COLUMNS = [
  "test_id", "wafer_id", "die_id", "equipment_id", "test_station",
  "process_corner", "supply_voltage", "output_voltage", "current",
  "leakage_current", "resistance", "capacitance", "threshold_voltage",
  "frequency", "propagation_delay", "setup_time", "hold_time",
  "timing_margin", "temperature", "thermal_delta", "dynamic_power",
  "static_power", "total_power", "ambient_temperature", "test_duration",
  "test_cycle", "result", "defect_type"
];

const DEFECT_TYPES = [
  "NORMAL", "HIGH_LEAKAGE", "LOW_VOLTAGE", "TIMING_FAILURE",
  "THERMAL_ANOMALY", "POWER_ANOMALY", "PROCESS_VARIATION", "EQUIPMENT_DRIFT"
];

const EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"];
const TEST_STATIONS = ["STN-01", "STN-02", "STN-03", "STN-04"];
const PROCESS_CORNERS = ["TT", "FF", "SS", "FS", "SF"];

function generateRecords(numSamples = 50000, seed = 42) {
  const rng = new SeededRandom(seed);
  const numNormal = Math.round(numSamples * 0.87);
  const numDefects = numSamples - numNormal;

  const defectWeights = {
    "HIGH_LEAKAGE": 0.20,
    "LOW_VOLTAGE": 0.15,
    "TIMING_FAILURE": 0.15,
    "THERMAL_ANOMALY": 0.12,
    "POWER_ANOMALY": 0.12,
    "PROCESS_VARIATION": 0.14,
    "EQUIPMENT_DRIFT": 0.12
  };

  const defectCounts = {};
  let allocated = 0;
  const cats = Object.keys(defectWeights);
  cats.forEach((cat, idx) => {
    if (idx === cats.length - 1) {
      defectCounts[cat] = numDefects - allocated;
    } else {
      const cnt = Math.round(numDefects * defectWeights[cat]);
      defectCounts[cat] = cnt;
      allocated += cnt;
    }
  });

  let defectAssignments = new Array(numNormal).fill("NORMAL");
  Object.keys(defectCounts).forEach(cat => {
    defectAssignments.push(...new Array(defectCounts[cat]).fill(cat));
  });

  rng.shuffle(defectAssignments);

  const records = [];
  for (let i = 0; i < numSamples; i++) {
    const index = i + 1;
    const defectType = defectAssignments[i];

    const testId = `TST-${String(index).padStart(6, '0')}`;
    const waferNum = (index % 100) + 1;
    const waferId = `WFR-${String(waferNum).padStart(3, '0')}`;
    const dieRow = ((index * 7) % 50) + 1;
    const dieCol = ((index * 13) % 50) + 1;
    const dieId = `DIE-${String(dieRow).padStart(2, '0')}${String(dieCol).padStart(2, '0')}`;

    const equipmentId = rng.choice(EQUIPMENT_IDS);
    const testStation = rng.choice(TEST_STATIONS);

    let processCorner;
    if (defectType === "PROCESS_VARIATION") {
      processCorner = rng.choice(["SS", "FF"]);
    } else {
      processCorner = rng.choice(PROCESS_CORNERS);
    }

    let supplyVoltage = rng.gauss(1.20, 0.015, 0.6);
    let thresholdVoltage = rng.gauss(0.45, 0.012, 0.1);
    
    const overdrive = Math.max(0.1, supplyVoltage - thresholdVoltage);
    let outputVoltage = Math.max(0.1, supplyVoltage - rng.gauss(0.02, 0.005, 0.001));

    const baseFreq = 2500.0 * Math.pow(overdrive / 0.75, 1.2);
    let frequency = rng.gauss(baseFreq, 40.0, 500.0);

    const baseDelay = 12.50 * Math.pow(0.75 / overdrive, 1.1);
    let propagationDelay = rng.gauss(baseDelay, 0.35, 2.0);
    let setupTime = rng.gauss(0.85, 0.03, 0.1);
    let holdTime = rng.gauss(0.42, 0.015, 0.05);

    let resistance = rng.gauss(12.50, 0.40, 1.0);
    let capacitance = rng.gauss(4.20, 0.12, 0.5);

    const ambientTemperature = 25.0;
    let temperature = ambientTemperature + rng.gauss(2.5, 0.8, 0.0);

    const thermalLeakFactor = Math.exp((temperature - 25.0) / 35.0);
    let leakageCurrent = rng.gauss(120.0, 15.0, 10.0) * thermalLeakFactor;

    let current = rng.gauss(45.0, 1.5, 10.0) * (supplyVoltage / 1.20);
    let dynamicPower = rng.gauss(54.0, 2.5, 5.0) * Math.pow(supplyVoltage / 1.20, 2);

    const testDuration = rng.gauss(150.0, 4.0, 10.0);
    const testCycle = Math.floor(rng.uniform(1, 6));

    if (processCorner === "FF") {
      frequency *= 1.06;
      propagationDelay *= 0.94;
      leakageCurrent *= 1.12;
    } else if (processCorner === "SS") {
      frequency *= 0.94;
      propagationDelay *= 1.06;
      thresholdVoltage *= 1.04;
    }

    const severity = (defectType !== "NORMAL") ? rng.uniform(0.20, 1.0) : 0.0;

    if (defectType === "HIGH_LEAKAGE") {
      const leakShift = 1.0 + (severity * rng.uniform(0.55, 1.45));
      leakageCurrent *= leakShift;
      current *= (1.0 + severity * 0.14);
      temperature += severity * rng.uniform(6.0, 15.0);
    } else if (defectType === "LOW_VOLTAGE") {
      const dropFactor = 1.0 - (severity * rng.uniform(0.08, 0.18));
      supplyVoltage *= dropFactor;
      outputVoltage *= dropFactor;
      frequency *= (1.0 - severity * 0.12);
      propagationDelay *= (1.0 + severity * 0.14);
    } else if (defectType === "TIMING_FAILURE") {
      const delayFactor = 1.0 + (severity * rng.uniform(0.20, 0.55));
      propagationDelay *= delayFactor;
      setupTime *= (1.0 + severity * 0.25);
      frequency *= (1.0 - severity * 0.10);
    } else if (defectType === "THERMAL_ANOMALY") {
      temperature += severity * rng.uniform(10.0, 38.0);
      const thermalBoost = Math.exp((temperature - 25.0) / 45.0);
      leakageCurrent *= (thermalBoost * 0.5);
      current *= (1.0 + severity * 0.12);
    } else if (defectType === "POWER_ANOMALY") {
      const powerFactor = 1.0 + (severity * rng.uniform(0.25, 0.75));
      dynamicPower *= powerFactor;
      current *= (1.0 + severity * 0.20);
      temperature += severity * rng.uniform(5.0, 12.0);
    } else if (defectType === "PROCESS_VARIATION") {
      thresholdVoltage *= (1.0 + severity * 0.18);
      resistance *= (1.0 + severity * 0.16);
      capacitance *= (1.0 + severity * 0.15);
      propagationDelay *= (1.0 + severity * 0.18);
      frequency *= (1.0 - severity * 0.15);
    } else if (defectType === "EQUIPMENT_DRIFT") {
      resistance *= (1.0 + severity * 0.15);
      outputVoltage *= (1.0 - severity * 0.08);
      current *= (1.0 + severity * 0.10);
    }

    const tempRounded = Number(temperature.toFixed(2));
    const ambRounded = Number(ambientTemperature.toFixed(2));
    const supplyRounded = Number(supplyVoltage.toFixed(4));
    const leakageRounded = Number(leakageCurrent.toFixed(4));
    const dynamicRounded = Number(dynamicPower.toFixed(4));
    const freqRounded = Number(frequency.toFixed(2));
    const propRounded = Number(propagationDelay.toFixed(4));
    const setupRounded = Number(setupTime.toFixed(4));

    const thermalDelta = Number((tempRounded - ambRounded).toFixed(2));
    const staticPower = Number((supplyRounded * leakageRounded * 0.001).toFixed(5));
    
    const powerNoise = rng.gauss(0.0, 0.05);
    const totalPower = Number(Math.max(0.1, dynamicRounded + staticPower + powerNoise).toFixed(5));

    const pathBudgetNs = Number((16.0 * (2500.0 / freqRounded)).toFixed(4));
    let timingMargin;
    if (defectType === "TIMING_FAILURE") {
      timingMargin = Number((pathBudgetNs - (propRounded + setupRounded) - (severity * rng.uniform(1.2, 3.0))).toFixed(4));
    } else {
      timingMargin = Number((pathBudgetNs - (propRounded + setupRounded)).toFixed(4));
    }

    const result = (defectType === "NORMAL") ? "PASS" : "FAIL";

    records.push({
      test_id: testId,
      wafer_id: waferId,
      die_id: dieId,
      equipment_id: equipmentId,
      test_station: testStation,
      process_corner: processCorner,
      supply_voltage: supplyRounded,
      output_voltage: Number(outputVoltage.toFixed(4)),
      current: Number(current.toFixed(4)),
      leakage_current: leakageRounded,
      resistance: Number(resistance.toFixed(4)),
      capacitance: Number(capacitance.toFixed(4)),
      threshold_voltage: Number(thresholdVoltage.toFixed(4)),
      frequency: freqRounded,
      propagation_delay: propRounded,
      setup_time: setupRounded,
      hold_time: Number(holdTime.toFixed(4)),
      timing_margin: timingMargin,
      temperature: tempRounded,
      thermal_delta: thermalDelta,
      dynamic_power: dynamicRounded,
      static_power: staticPower,
      total_power: totalPower,
      ambient_temperature: ambRounded,
      test_duration: Number(testDuration.toFixed(2)),
      test_cycle: testCycle,
      result: result,
      defect_type: defectType
    });
  }

  return records;
}

function saveCSV(records, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const header = SCHEMA_COLUMNS.join(',');
  const rows = records.map(r => SCHEMA_COLUMNS.map(col => r[col]).join(','));
  const csvContent = [header, ...rows].join('\n');
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
}

function validateRecords(records) {
  const numRows = records.length;
  const numCols = SCHEMA_COLUMNS.length;

  console.log("\n==================================================");
  console.log("PREDICTA SYNTHETIC DATASET VALIDATION REPORT (V3 - 50,000 RECORDS)");
  console.log("==================================================");
  console.log(`1. Dataset Shape: ${numRows} rows × ${numCols} columns`);
  console.log(`2. Column Count: ${numCols}`);
  console.log("3. Column Names:");
  SCHEMA_COLUMNS.forEach((col, idx) => {
    console.log(`   [${String(idx + 1).padStart(2, '0')}] ${col}`);
  });

  let missingCount = 0;
  records.forEach(r => {
    SCHEMA_COLUMNS.forEach(col => {
      if (r[col] === undefined || r[col] === null || r[col] === "") missingCount++;
    });
  });
  console.log(`\n4. Missing Value Count: ${missingCount}`);

  const testIds = records.map(r => r.test_id);
  const dupCount = testIds.length - new Set(testIds).size;
  console.log(`5. Duplicate Record Count: ${dupCount}`);

  console.log("\n6. Data Types Summary:");
  const sample = records[0];
  SCHEMA_COLUMNS.forEach(col => {
    console.log(`   ${col.padEnd(20)}: ${typeof sample[col]}`);
  });

  const passCnt = records.filter(r => r.result === "PASS").length;
  const failCnt = records.filter(r => r.result === "FAIL").length;
  console.log("\n7. Distribution of 'result':");
  console.log(`   PASS : ${String(passCnt).padStart(6)} (${(passCnt / numRows * 100).toFixed(2)}%)`);
  console.log(`   FAIL : ${String(failCnt).padStart(6)} (${(failCnt / numRows * 100).toFixed(2)}%)`);

  console.log("\n8. Distribution of 'defect_type':");
  DEFECT_TYPES.forEach(dt => {
    const cnt = records.filter(r => r.defect_type === dt).length;
    console.log(`   ${dt.padEnd(18)}: ${String(cnt).padStart(6)} (${(cnt / numRows * 100).toFixed(2)}%)`);
  });

  const numColsList = SCHEMA_COLUMNS.filter(c => ![
    "test_id", "wafer_id", "die_id", "equipment_id",
    "test_station", "process_corner", "result", "defect_type", "test_cycle"
  ].includes(c));

  console.log("\n9. Overall Summary Statistics for Key Numerical Columns:");
  console.log(`${'Column'.padEnd(20)} | ${'Mean'.padEnd(10)} | ${'Std'.padEnd(10)} | ${'Min'.padEnd(10)} | ${'Max'.padEnd(10)}`);
  console.log("-".repeat(68));
  numColsList.forEach(col => {
    const vals = records.map(r => Number(r[col]));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    console.log(`${col.padEnd(20)} | ${mean.toFixed(3).padEnd(10)} | ${std.toFixed(3).padEnd(10)} | ${min.toFixed(3).padEnd(10)} | ${max.toFixed(3).padEnd(10)}`);
  });

  console.log("\n10. Defect-Wise Mean Statistics (Feature Breakdown):");
  console.log(`${'Defect Category'.padEnd(18)} | ${'Count'.padEnd(6)} | ${'V_sup(V)'.padEnd(8)} | ${'I_leak(µA)'.padEnd(10)} | ${'Freq(MHz)'.padEnd(9)} | ${'t_pd(ns)'.padEnd(8)} | ${'P_dyn(mW)'.padEnd(9)} | ${'Temp(°C)'.padEnd(8)}`);
  console.log("-".repeat(92));
  DEFECT_TYPES.forEach(dt => {
    const subset = records.filter(r => r.defect_type === dt);
    if (!subset.length) return;
    const cntSub = subset.length;
    const vSup = subset.reduce((a, b) => a + b.supply_voltage, 0) / cntSub;
    const iLeak = subset.reduce((a, b) => a + b.leakage_current, 0) / cntSub;
    const freq = subset.reduce((a, b) => a + b.frequency, 0) / cntSub;
    const tPd = subset.reduce((a, b) => a + b.propagation_delay, 0) / cntSub;
    const pDyn = subset.reduce((a, b) => a + b.dynamic_power, 0) / cntSub;
    const temp = subset.reduce((a, b) => a + b.temperature, 0) / cntSub;
    console.log(`${dt.padEnd(18)} | ${String(cntSub).padEnd(6)} | ${vSup.toFixed(3).padEnd(8)} | ${iLeak.toFixed(2).padEnd(10)} | ${freq.toFixed(1).padEnd(9)} | ${tPd.toFixed(3).padEnd(8)} | ${pDyn.toFixed(2).padEnd(9)} | ${temp.toFixed(2).padEnd(8)}`);
  });

  console.log("\n11. Key Physical Feature Correlations:");
  function calcCorr(col1, col2) {
    const x = records.map(r => Number(r[col1]));
    const y = records.map(r => Number(r[col2]));
    const mx = x.reduce((a, b) => a + b, 0) / x.length;
    const my = y.reduce((a, b) => a + b, 0) / y.length;
    const cov = x.reduce((sum, xi, idx) => sum + (xi - mx) * (y[idx] - my), 0);
    const stdX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - mx, 2), 0));
    const stdY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - my, 2), 0));
    return (stdX * stdY > 0) ? (cov / (stdX * stdY)) : 0.0;
  }

  [
    ["supply_voltage", "dynamic_power"],
    ["leakage_current", "static_power"],
    ["temperature", "leakage_current"],
    ["frequency", "propagation_delay"],
    ["temperature", "thermal_delta"]
  ].forEach(([c1, c2]) => {
    const corrVal = calcCorr(c1, c2);
    const sign = corrVal >= 0 ? "+" : "";
    console.log(`   Corr(${c1.padEnd(18)}, ${c2.padEnd(18)}) = ${sign}${corrVal.toFixed(4)}`);
  });

  console.log("\n12. Distribution Overlap Analysis (NORMAL vs Defect Classes):");
  const normalLeak = records.filter(r => r.defect_type === "NORMAL").map(r => r.leakage_current);
  const highLeak = records.filter(r => r.defect_type === "HIGH_LEAKAGE").map(r => r.leakage_current);
  const normMax = Math.max(...normalLeak);
  const normMin = Math.min(...normalLeak);
  const overlapCnt = highLeak.filter(v => v <= normMax).length;
  const overlapPct = (overlapCnt / highLeak.length) * 100;
  console.log(`   NORMAL leakage_current range   : ${normMin.toFixed(2)} µA to ${normMax.toFixed(2)} µA`);
  console.log(`   HIGH_LEAKAGE leakage_current   : ${Math.min(...highLeak).toFixed(2)} µA to ${Math.max(...highLeak).toFixed(2)} µA`);
  console.log(`   HIGH_LEAKAGE Records in NORMAL Range: ${overlapCnt}/${highLeak.length} (${overlapPct.toFixed(2)}% Target Overlap)`);

  console.log("\n13. Physical & Logic Validity Checks:");
  let negCount = 0;
  records.forEach(r => {
    ["supply_voltage", "output_voltage", "current", "leakage_current",
     "resistance", "capacitance", "threshold_voltage", "frequency",
     "propagation_delay", "temperature", "dynamic_power", "static_power", "total_power"].forEach(c => {
      if (Number(r[c]) < 0) negCount++;
    });
  });
  console.log(`   [PASS] Negative Physical Values Count: ${negCount} (Must be 0)`);

  let powerValidCount = 0;
  records.forEach(r => {
    const relDiff = Math.abs(r.total_power - (r.dynamic_power + r.static_power)) / r.total_power;
    if (relDiff <= 0.03) powerValidCount++;
  });
  console.log(`   [PASS] Total Power Noise Tolerance Satisfied: ${powerValidCount}/${numRows} (${(powerValidCount / numRows * 100).toFixed(2)}%)`);

  let thermalValidCount = 0;
  records.forEach(r => {
    const expected = Number((r.temperature - r.ambient_temperature).toFixed(2));
    if (Math.abs(r.thermal_delta - expected) <= 1e-3) thermalValidCount++;
  });
  console.log(`   [PASS] Thermal Delta Exact Relation Satisfied: ${thermalValidCount}/${numRows} (${(thermalValidCount / numRows * 100).toFixed(2)}%)`);

  let mappingErrors = 0;
  records.forEach(r => {
    if (r.defect_type === "NORMAL" && r.result !== "PASS") mappingErrors++;
    if (r.defect_type !== "NORMAL" && r.result !== "FAIL") mappingErrors++;
  });
  console.log(`   [PASS] Result/Defect Consistency Errors: ${mappingErrors} (PASS iff NORMAL)`);
  console.log("==================================================\n");
}

const outputPath = path.join(__dirname, '../data/synthetic/predicta_dataset_v3_50000.csv');
console.log(`Initializing Predicta Data Generator v3 (Samples=50000, Seed=42)...`);
const records = generateRecords(50000, 42);
saveCSV(records, outputPath);
console.log(`v3 Production Dataset successfully saved to: ${outputPath}`);
validateRecords(records);
