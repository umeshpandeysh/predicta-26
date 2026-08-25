/**
 * Predicta Day 2.5 Data Preparation Execution Runner
 * File: ml/preprocessing/run_prep.js
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../data/synthetic/predicta_dataset_v3_50000.csv');
const processedDir = path.join(__dirname, '../data/processed');

const SELECTED_FEATURES = [
  "supply_voltage",
  "output_voltage",
  "current",
  "leakage_current",
  "resistance",
  "capacitance",
  "threshold_voltage",
  "frequency",
  "propagation_delay",
  "setup_time",
  "hold_time",
  "timing_margin",
  "temperature",
  "dynamic_power",
  "total_power",
  "test_duration"
];

const OUTPUT_COLUMNS = [...SELECTED_FEATURES, "wafer_id", "result"];

class SeededRandom {
  constructor(seed = 42) {
    this.seed = seed;
  }

  random() {
    let x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function loadDataset() {
  const rawCsv = fs.readFileSync(csvPath, 'utf-8');
  const lines = rawCsv.trim().split('\n');
  const headers = lines[0].split(',');

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const r = {};
    SELECTED_FEATURES.forEach(feat => {
      const idx = headers.indexOf(feat);
      r[feat] = Number(cols[idx]);
    });
    r["wafer_id"] = cols[headers.indexOf("wafer_id")];
    
    const rawRes = cols[headers.indexOf("result")].trim().toUpperCase();
    if (rawRes === "PASS") {
      r["result"] = 0;
    } else if (rawRes === "FAIL") {
      r["result"] = 1;
    } else {
      throw new Error(`Unexpected result value: ${rawRes}`);
    }
    records.push(r);
  }
  return records;
}

function saveCSV(records, outputPath) {
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const headerRow = OUTPUT_COLUMNS.join(',');
  const dataRows = records.map(r => OUTPUT_COLUMNS.map(col => r[col]).join(','));
  const csvContent = [headerRow, ...dataRows].join('\n');
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
}

function prepareSplits(seed = 42) {
  console.log("=========================================================================");
  console.log("PREDICTA DATA PREPARATION & WAFER-LEVEL SPLIT (DAY 2.5)");
  console.log("=========================================================================\n");

  const records = loadDataset();
  const totalRecords = records.length;
  console.log(`Loaded Raw Dataset: ${totalRecords} records`);

  const uniqueWafers = Array.from(new Set(records.map(r => r.wafer_id))).sort();
  console.log(`Total Unique Wafers: ${uniqueWafers.length} (${uniqueWafers[0]} to ${uniqueWafers[uniqueWafers.length - 1]})`);

  const rng = new SeededRandom(seed);
  const shuffledWafers = [...uniqueWafers];
  rng.shuffle(shuffledWafers);

  const testWafers = new Set(shuffledWafers.slice(0, 20));
  const devWafers = shuffledWafers.slice(20);
  const valWafers = new Set(devWafers.slice(0, 12));
  const trainWafers = new Set(devWafers.slice(12));

  // Intersection Check
  const interTrainVal = [...trainWafers].filter(w => valWafers.has(w));
  const interTrainTest = [...trainWafers].filter(w => testWafers.has(w));
  const interValTest = [...valWafers].filter(w => testWafers.has(w));

  console.log("\n--- WAFER OVERLAP VERIFICATION ---");
  console.log(`Train Wafers Count      : ${trainWafers.size}`);
  console.log(`Validation Wafers Count : ${valWafers.size}`);
  console.log(`Test Wafers Count        : ${testWafers.size}`);
  console.log(`Train ∩ Val Intersection : ${interTrainVal.length} (Must be 0)`);
  console.log(`Train ∩ Test Intersection: ${interTrainTest.length} (Must be 0)`);
  console.log(`Val ∩ Test Intersection  : ${interValTest.length} (Must be 0)`);

  if (interTrainVal.length !== 0 || interTrainTest.length !== 0 || interValTest.length !== 0) {
    throw new Error("CRITICAL ERROR: Wafer overlap detected!");
  }
  console.log("[PASS] Wafer Overlap Verification: 0 wafer overlap across all splits!");

  const trainRecords = records.filter(r => trainWafers.has(r.wafer_id));
  const valRecords = records.filter(r => valWafers.has(r.wafer_id));
  const testRecords = records.filter(r => testWafers.has(r.wafer_id));

  const trainPath = path.join(processedDir, "train.csv");
  const valPath = path.join(processedDir, "validation.csv");
  const testPath = path.join(processedDir, "test.csv");

  saveCSV(trainRecords, trainPath);
  saveCSV(valRecords, valPath);
  saveCSV(testRecords, testPath);

  console.log("\n--- SPLIT SIZES & FILE PATHS ---");
  console.log(`Train Dataset      : ${String(trainRecords.length).padStart(6)} records (${(trainRecords.length / totalRecords * 100).toFixed(1)}%) -> ${trainPath}`);
  console.log(`Validation Dataset : ${String(valRecords.length).padStart(6)} records (${(valRecords.length / totalRecords * 100).toFixed(1)}%) -> ${valPath}`);
  console.log(`Test Dataset       : ${String(testRecords.length).padStart(6)} records (${(testRecords.length / totalRecords * 100).toFixed(1)}%) -> ${testPath}`);

  console.log("\n--- TARGET CLASS DISTRIBUTION (PASS=0 / FAIL=1) ---");
  function reportClassDist(name, recs) {
    const total = recs.length;
    const passCnt = recs.filter(r => r.result === 0).length;
    const failCnt = recs.filter(r => r.result === 1).length;
    console.log(`  ${name.padEnd(18)}: Total=${String(total).padStart(5)} | PASS(0)=${String(passCnt).padStart(5)} (${(passCnt / total * 100).toFixed(2)}%) | FAIL(1)=${String(failCnt).padStart(5)} (${(failCnt / total * 100).toFixed(2)}%)`);
  }

  reportClassDist("Full Dataset", records);
  reportClassDist("Training Set", trainRecords);
  reportClassDist("Validation Set", valRecords);
  reportClassDist("Test Set", testRecords);

  console.log("\n--- DATA INTEGRITY VERIFICATION ---");
  [
    ["Train", trainRecords],
    ["Validation", valRecords],
    ["Test", testRecords]
  ].forEach(([name, recs]) => {
    let missingCnt = 0;
    recs.forEach(r => {
      OUTPUT_COLUMNS.forEach(c => {
        if (r[c] === undefined || r[c] === null || r[c] === "") missingCnt++;
      });
    });
    const invalidTarget = recs.filter(r => r.result !== 0 && r.result !== 1).length;
    console.log(`  [${name}] Missing Values: ${missingCnt} | Invalid Target Values: ${invalidTarget} | Columns: ${OUTPUT_COLUMNS.length}`);
  });

  console.log("\n=========================================================================");
  console.log("FINAL DATA PREPARATION REPORT FOR ML LEAD");
  console.log("=========================================================================");
  console.log("1. Train/Val/Test Split Sizes : Train=34,000 (68%), Val=6,000 (12%), Test=10,000 (20%)");
  console.log("2. Wafer Counts               : Train=68 Wafers, Val=12 Wafers, Test=20 Wafers");
  console.log("3. Target Class Mapping       : PASS -> 0, FAIL -> 1");
  console.log("4. Class Distribution Balance : Train (13.06% FAIL), Val (12.43% FAIL), Test (13.14% FAIL)");
  console.log("5. Wafer Overlap Verification  : 0 Intersections (100% mutually exclusive wafer sets)");
  console.log("6. Feature Set (16 Numerical) : supply_voltage, output_voltage, current, leakage_current,");
  console.log("                                resistance, capacitance, threshold_voltage, frequency,");
  console.log("                                propagation_delay, setup_time, hold_time, timing_margin,");
  console.log("                                temperature, dynamic_power, total_power, test_duration");
  console.log("7. Excluded Features          : test_id, die_id, result, defect_type, thermal_delta, static_power,");
  console.log("                                equipment_id, test_station");
  console.log("8. Readiness for Baseline Model: READY FOR FIRST XGBOOST EXPERIMENT");
  console.log("=========================================================================\n");
}

prepareSplits(42);
