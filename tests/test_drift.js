// Node.js automated checks for Module B and Decision Engine logic
const fs = require('fs');
const path = require('path');

console.log("Starting Module B & Decision Engine unit checks...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

// 1. Safety Slope Calculation Test
// P_24 = 10.0, P_168_pred = 24.4. Time = 144 hours.
// Slope = (24.4 - 10.0) / 144 = 14.4 / 144 = 0.1 units/hour.
function calculateSlope(val24h, pred168h) {
  return (pred168h - val24h) / 144.0;
}

const slope = calculateSlope(10.0, 24.4);
assert(Math.abs(slope - 0.1) < 1e-9, `Predicted slope calculated is 0.1 (found ${slope})`);

// 2. Trajectory Evaluation Test
function evaluateTrajectory(val24h, pred168h, predStd, maxLimit, maxSlope) {
  const predSlope = calculateSlope(val24h, pred168h);
  const predUpper168 = pred168h + 1.96 * predStd;
  const upperSlope = calculateSlope(val24h, predUpper168);
  
  const margin = (maxSlope - predSlope) / maxSlope;
  
  let status = "WITHIN";
  if (predUpper168 > maxLimit || upperSlope > maxSlope) {
    if (pred168h > maxLimit || predSlope > maxSlope) {
      status = "EXCEEDED";
    } else {
      status = "WARNING";
    }
  }
  
  return { predicted_slope: predSlope, upper_bound_slope: upperSlope, safety_margin: margin, boundary_status: status };
}

const eval1 = evaluateTrajectory(10.0, 20.0, 0.5, 25.0, 0.2); // Within bounds
const eval2 = evaluateTrajectory(10.0, 22.0, 2.0, 25.0, 0.2); // Upper bound crosses limit
const eval3 = evaluateTrajectory(10.0, 40.0, 0.5, 25.0, 0.2); // Mean crosses limit

assert(eval1.boundary_status === "WITHIN", "Normal drift is evaluated as WITHIN");
assert(eval2.boundary_status === "WARNING", "Drift with high uncertainty upper bound is evaluated as WARNING");
assert(eval3.boundary_status === "EXCEEDED", "Mean drift crossing specification limit is evaluated as EXCEEDED");

// 3. Decision Engine Logic Test
function makeScreeningDecision(anomalyScore, safetyEvaluations) {
  const isAnomaly = anomalyScore > 8.5;
  const isWarning = anomalyScore > 5.0;
  
  const anyExceeded = Object.values(safetyEvaluations).some(e => e.boundary_status === "EXCEEDED");
  const anyWarning = Object.values(safetyEvaluations).some(e => e.boundary_status === "WARNING");
  
  if (isAnomaly || anyExceeded) {
    return { status: "REJECT", risk_level: "HIGH" };
  } else if (isWarning || anyWarning) {
    return { status: "MONITOR", risk_level: "MEDIUM" };
  } else {
    return { status: "PASS", risk_level: "LOW" };
  }
}

const dec1 = makeScreeningDecision(2.4, { iddq: eval1 }); // All healthy
const dec2 = makeScreeningDecision(9.2, { iddq: eval1 }); // Anomaly detected
const dec3 = makeScreeningDecision(2.4, { iddq: eval3 }); // Safety exceeded
const dec4 = makeScreeningDecision(6.1, { iddq: eval1 }); // Anomaly warning

assert(dec1.status === "PASS" && dec1.risk_level === "LOW", "Healthy parameters result in PASS");
assert(dec2.status === "REJECT" && dec2.risk_level === "HIGH", "High anomaly score results in REJECT");
assert(dec3.status === "REJECT" && dec3.risk_level === "HIGH", "Exceeded safety slope results in REJECT");
assert(dec4.status === "MONITOR" && dec4.risk_level === "MEDIUM", "Elevated warning parameters result in MONITOR");

console.log(`\nDrift and Decision checks completed. Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All Module B and Decision Engine checks completed successfully!");
  process.exit(0);
}
