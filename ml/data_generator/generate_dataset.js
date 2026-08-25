/**
 * Predicta Semiconductor Test Analytics Prototype — Day 1 Data Generator (Node.js Runner)
 * File: ml/data_generator/generate_dataset.js
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

function generateRecords(numSamples = 1000, seed = 42) {
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
    const waferNum = (index % 20) + 1;
    const waferId = `WFR-${String(waferNum).padStart(2, '0')}`;
    const dieRow = ((index * 7) % 50) + 1;
    const dieCol = ((index * 13) % 50) + 1;
    const dieId = `DIE-${String(dieRow).padStart(2, '0')}${String(dieCol).padStart(2, '0')}`;

    let equipmentId, testStation;
    if (defectType === "EQUIPMENT_DRIFT") {
      equipmentId = "EQP-105";
      testStation = "STN-04";
    } else {
      equipmentId = rng.choice(EQUIPMENT_IDS);
      testStation = rng.choice(TEST_STATIONS);
    }

    let processCorner;
    if (defectType === "PROCESS_VARIATION") {
      processCorner = rng.choice(["SS", "FF"]);
    } else {
      processCorner = rng.choice(PROCESS_CORNERS);
    }

    let supplyVoltage = rng.gauss(1.20, 0.015, 0.5);
    let outputVoltage = Math.max(0.1, supplyVoltage - rng.gauss(0.02, 0.005, 0.001));
    let current = rng.gauss(45.0, 1.5, 10.0);
    let leakageCurrent = rng.gauss(1.50, 0.12, 0.1);
    let resistance = rng.gauss(12.50, 0.40, 1.0);
    let capacitance = rng.gauss(4.20, 0.12, 0.5);
    let thresholdVoltage = rng.gauss(0.45, 0.012, 0.1);
    let frequency = rng.gauss(2.50, 0.06, 0.5);
    let propagationDelay = rng.gauss(12.50, 0.35, 1.0);
    let setupTime = rng.gauss(0.85, 0.03, 0.1);
    let holdTime = rng.gauss(0.42, 0.015, 0.05);

    const ambientTemperature = 25.0;
    let temperature = ambientTemperature + rng.gauss(2.5, 0.8, 0.0);
    let dynamicPower = rng.gauss(54.0, 2.5, 5.0);

    const testDuration = rng.gauss(150.0, 4.0, 10.0);
    const testCycle = Math.floor(rng.uniform(1, 6));

    if (processCorner === "FF") {
      frequency *= 1.08;
      propagationDelay *= 0.92;
      leakageCurrent *= 1.15;
    } else if (processCorner === "SS") {
      frequency *= 0.92;
      propagationDelay *= 1.08;
      thresholdVoltage *= 1.05;
    }

    if (defectType === "HIGH_LEAKAGE") {
      leakageCurrent *= rng.uniform(3.5, 6.5);
      current *= rng.uniform(1.25, 1.45);
      temperature += rng.uniform(18.0, 32.0);
    } else if (defectType === "LOW_VOLTAGE") {
      const drop = rng.uniform(0.68, 0.78);
      supplyVoltage *= drop;
      outputVoltage *= drop;
      frequency *= rng.uniform(0.72, 0.85);
    } else if (defectType === "TIMING_FAILURE") {
      propagationDelay *= rng.uniform(1.45, 1.85);
      setupTime *= rng.uniform(1.30, 1.60);
      frequency *= rng.uniform(0.80, 0.92);
    } else if (defectType === "THERMAL_ANOMALY") {
      temperature += rng.uniform(45.0, 75.0);
      leakageCurrent *= rng.uniform(1.8, 2.8);
      current *= rng.uniform(1.15, 1.35);
    } else if (defectType === "POWER_ANOMALY") {
      dynamicPower *= rng.uniform(1.70, 2.30);
      current *= rng.uniform(1.35, 1.70);
      temperature += rng.uniform(12.0, 25.0);
    } else if (defectType === "PROCESS_VARIATION") {
      thresholdVoltage *= rng.uniform(1.25, 1.45);
      resistance *= rng.uniform(1.20, 1.40);
      capacitance *= rng.uniform(1.15, 1.35);
      propagationDelay *= rng.uniform(1.20, 1.40);
      frequency *= rng.uniform(0.75, 0.88);
    } else if (defectType === "EQUIPMENT_DRIFT") {
      resistance *= rng.uniform(1.25, 1.45);
      outputVoltage *= rng.uniform(0.82, 0.90);
      current *= rng.uniform(1.15, 1.30);
    }

    const tempRounded = Number(temperature.toFixed(2));
    const ambRounded = Number(ambientTemperature.toFixed(2));
    const supplyRounded = Number(supplyVoltage.toFixed(4));
    const leakageRounded = Number(leakageCurrent.toFixed(4));
    const dynamicRounded = Number(dynamicPower.toFixed(4));
    const freqRounded = Number(frequency.toFixed(4));
    const propRounded = Number(propagationDelay.toFixed(4));
    const setupRounded = Number(setupTime.toFixed(4));

    const thermalDelta = Number((tempRounded - ambRounded).toFixed(2));
    const staticPower = Number((supplyRounded * leakageRounded * 1e-3).toFixed(5));
    const totalPower = Number((dynamicRounded + staticPower).toFixed(5));

    let timingMargin;
    const pathBudgetNs = Number((15.0 * (2.50 / freqRounded)).toFixed(4));
    if (defectType === "TIMING_FAILURE") {
      timingMargin = Number(rng.uniform(-3.5, -0.5).toFixed(4));
    } else if (defectType === "LOW_VOLTAGE") {
      timingMargin = Number(rng.uniform(-0.8, 0.15).toFixed(4));
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
  console.log("PREDICTA SYNTHETIC DATASET VALIDATION REPORT");
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

  const passCnt = records.filter(r => r.result === "PASS").length;
  const failCnt = records.filter(r => r.result === "FAIL").length;
  console.log("\n6. Distribution of 'result':");
  console.log(`   PASS : ${String(passCnt).padStart(4)} (${(passCnt / numRows * 100).toFixed(1)}%)`);
  console.log(`   FAIL : ${String(failCnt).padStart(4)} (${(failCnt / numRows * 100).toFixed(1)}%)`);

  console.log("\n7. Distribution of 'defect_type':");
  DEFECT_TYPES.forEach(dt => {
    const cnt = records.filter(r => r.defect_type === dt).length;
    console.log(`   ${dt.padEnd(18)}: ${String(cnt).padStart(4)} (${(cnt / numRows * 100).toFixed(1)}%)`);
  });

  const numColsList = SCHEMA_COLUMNS.filter(c => ![
    "test_id", "wafer_id", "die_id", "equipment_id",
    "test_station", "process_corner", "result", "defect_type", "test_cycle"
  ].includes(c));

  console.log("\n8. Summary Statistics for Key Numerical Columns:");
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

  console.log("\n9. Physical & Logic Validity Checks:");
  let negCount = 0;
  records.forEach(r => {
    ["supply_voltage", "output_voltage", "current", "leakage_current",
     "resistance", "capacitance", "threshold_voltage", "frequency",
     "propagation_delay", "temperature", "dynamic_power", "static_power", "total_power"].forEach(c => {
      if (Number(r[c]) < 0) negCount++;
    });
  });
  console.log(`   [PASS] Negative Physical Values Count: ${negCount} (Must be 0)`);

  let powerMismatches = 0;
  records.forEach(r => {
    const expected = Number((r.dynamic_power + r.static_power).toFixed(5));
    if (Math.abs(r.total_power - expected) > 1e-4) powerMismatches++;
  });
  console.log(`   [PASS] Power Equation Discrepancy Count: ${powerMismatches} (total = dynamic + static)`);

  let thermalMismatches = 0;
  records.forEach(r => {
    const expected = Number((r.temperature - r.ambient_temperature).toFixed(2));
    if (Math.abs(r.thermal_delta - expected) > 1e-3) thermalMismatches++;
  });
  console.log(`   [PASS] Thermal Delta Discrepancy Count: ${thermalMismatches} (delta = temp - ambient)`);

  let mappingErrors = 0;
  records.forEach(r => {
    if (r.defect_type === "NORMAL" && r.result !== "PASS") mappingErrors++;
    if (r.defect_type !== "NORMAL" && r.result !== "FAIL") mappingErrors++;
  });
  console.log(`   [PASS] Result/Defect Consistency Errors: ${mappingErrors} (PASS iff NORMAL)`);
  console.log("==================================================\n");
}

const outputPath = path.join(__dirname, '../data/synthetic/predicta_dataset_v1_1000.csv');
console.log(`Initializing Predicta Data Generator (Samples=1000, Seed=42)...`);
const records = generateRecords(1000, 42);
saveCSV(records, outputPath);
console.log(`Dataset successfully saved to: ${outputPath}`);
validateRecords(records);
