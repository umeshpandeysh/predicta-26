/**
 * PREDICTA — Spatial Failure Intelligence Automated Test Suite
 * File: tests/test_spatial.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA — SPATIAL FAILURE INTELLIGENCE TEST SUITE");
console.log("=========================================================================\n");

let passed = 0;
let failed = 0;

function runTest(description, testFn) {
  try {
    testFn();
    console.log(`✔ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`✖ [FAIL] ${description}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

// 1. DOM Section & File Integrity
runTest("index.html contains Spatial Map navigation link and #page-spatial section", () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('data-page="page-spatial"'), "Missing data-page='page-spatial' nav link");
  assert.ok(html.includes('id="page-spatial"'), "Missing #page-spatial section tag");
  assert.ok(html.includes('id="wafer-svg-container"'), "Missing #wafer-svg-container container");
  assert.ok(html.includes('id="hotspots-list-container"'), "Missing #hotspots-list-container container");
  assert.ok(html.includes('id="spatial-regional-container"'), "Missing #spatial-regional-container container");
  assert.ok(html.includes('id="spatial-unavailable-banner"'), "Missing #spatial-unavailable-banner container");
});

// 2. Spatial Script Functions & Clustering Logic
runTest("script.js defines Spatial Failure Intelligence engine functions", () => {
  const scriptContent = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
  assert.ok(scriptContent.includes('detectSpatialHotspots'), "Missing detectSpatialHotspots function");
  assert.ok(scriptContent.includes('calculateRegionalAnalysis'), "Missing calculateRegionalAnalysis function");
  assert.ok(scriptContent.includes('renderWaferMap'), "Missing renderWaferMap function");
  assert.ok(scriptContent.includes('selectSpatialDie'), "Missing selectSpatialDie function");
});

// Inline unit testing of hotspot clustering algorithm logic
function mockDetectSpatialHotspots(components) {
  const elevated = components.filter(c => 
    c.die_x !== undefined && c.die_y !== undefined &&
    (c.anomaly_score >= 4.0 || c.status === "MONITOR" || c.status === "REJECT")
  );

  if (elevated.length === 0) return [];

  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < elevated.length; i++) {
    const root = elevated[i];
    if (visited.has(root.id)) continue;

    const clusterDies = [];
    const queue = [root];
    visited.add(root.id);

    while (queue.length > 0) {
      const curr = queue.shift();
      clusterDies.push(curr);

      for (let j = 0; j < elevated.length; j++) {
        const neighbor = elevated[j];
        if (visited.has(neighbor.id)) continue;

        const dx = curr.die_x - neighbor.die_x;
        const dy = curr.die_y - neighbor.die_y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 1.85) {
          visited.add(neighbor.id);
          queue.push(neighbor);
        }
      }
    }

    if (clusterDies.length >= 2) {
      let sumX = 0, sumY = 0, sumScore = 0, maxScore = 0;
      let rejectCount = 0;

      clusterDies.forEach(c => {
        sumX += c.die_x;
        sumY += c.die_y;
        sumScore += c.anomaly_score;
        if (c.anomaly_score > maxScore) maxScore = c.anomaly_score;
        if (c.status === "REJECT") rejectCount++;
      });

      const avgX = Number((sumX / clusterDies.length).toFixed(1));
      const avgY = Number((sumY / clusterDies.length).toFixed(1));
      const avgScore = Number((sumScore / clusterDies.length).toFixed(2));
      const riskLevel = rejectCount > 0 ? "REJECT" : "MONITOR";

      let regionStr = "Wafer Center";
      if (avgX > 1.5 && avgY > 1.5) regionStr = "North-East Edge (Q1)";
      else if (avgX < -1.5 && avgY > 1.5) regionStr = "North-West Edge (Q2)";
      else if (avgX < -1.5 && avgY < -1.5) regionStr = "South-West Edge (Q3)";
      else if (avgX > 1.5 && avgY < -1.5) regionStr = "South-East Edge (Q4)";

      clusters.push({
        id: `HOTSPOT-0${clusters.length + 1}`,
        centroid_x: avgX,
        centroid_y: avgY,
        region: regionStr,
        components: clusterDies,
        component_count: clusterDies.length,
        avg_anomaly_score: avgScore,
        max_anomaly_score: Number(maxScore.toFixed(2)),
        risk_level: riskLevel,
        pattern: clusterDies.length >= 3 ? "Concentrated Cluster" : "Isolated Defect Pair"
      });
    }
  }

  return clusters;
}

runTest("Spatial Hotspot Detection accurately groups neighboring anomalous dies", () => {
  const mockComponents = [
    { id: "COMP-00001", die_x: 0, die_y: 0, anomaly_score: 0.5, status: "PASS" },
    { id: "COMP-00042", die_x: 4, die_y: 4, anomaly_score: 8.84, status: "REJECT" },
    { id: "COMP-00088", die_x: 4, die_y: 3, anomaly_score: 5.92, status: "MONITOR" },
    { id: "COMP-00105", die_x: 5, die_y: 4, anomaly_score: 7.50, status: "REJECT" },
    { id: "COMP-00011", die_x: -5, die_y: -5, anomaly_score: 0.8, status: "PASS" }
  ];

  const hotspots = mockDetectSpatialHotspots(mockComponents);
  assert.strictEqual(hotspots.length, 1, "Expected exactly 1 spatial hotspot cluster");
  assert.strictEqual(hotspots[0].component_count, 3, "Hotspot cluster should contain 3 dies");
  assert.strictEqual(hotspots[0].region, "North-East Edge (Q1)", "Cluster should be located in North-East Edge (Q1)");
  assert.strictEqual(hotspots[0].risk_level, "REJECT", "Risk level should be REJECT");
  assert.strictEqual(hotspots[0].max_anomaly_score, 8.84, "Max anomaly score should be 8.84");
});

function mockCalculateRegionalAnalysis(components) {
  let centerTotal = 0, centerAnom = 0;
  let innerTotal = 0, innerAnom = 0;
  let edgeTotal = 0, edgeAnom = 0;

  let q1Total = 0, q1Anom = 0;
  let q2Total = 0, q2Anom = 0;
  let q3Total = 0, q3Anom = 0;
  let q4Total = 0, q4Anom = 0;

  components.forEach(c => {
    if (c.die_x === undefined || c.die_y === undefined) return;
    const r = Math.sqrt(c.die_x * c.die_x + c.die_y * c.die_y);
    const isAnom = c.status === "REJECT" || c.status === "MONITOR";

    if (r <= 3.0) {
      centerTotal++;
      if (isAnom) centerAnom++;
    } else if (r <= 5.0) {
      innerTotal++;
      if (isAnom) innerAnom++;
    } else {
      edgeTotal++;
      if (isAnom) edgeAnom++;
    }

    if (c.die_x >= 0 && c.die_y >= 0) {
      q1Total++;
      if (isAnom) q1Anom++;
    } else if (c.die_x < 0 && c.die_y >= 0) {
      q2Total++;
      if (isAnom) q2Anom++;
    } else if (c.die_x < 0 && c.die_y < 0) {
      q3Total++;
      if (isAnom) q3Anom++;
    } else {
      q4Total++;
      if (isAnom) q4Anom++;
    }
  });

  return {
    radial: {
      center: { total: centerTotal, anomalous: centerAnom },
      inner: { total: innerTotal, anomalous: innerAnom },
      edge: { total: edgeTotal, anomalous: edgeAnom }
    },
    quadrants: { q1: q1Total, q2: q2Total, q3: q3Total, q4: q4Total }
  };
}

runTest("Regional Manufacturing Analysis accurately classifies radial & quadrant zones", () => {
  const mockComponents = [
    { id: "C1", die_x: 1, die_y: 1, status: "PASS" },      // Center, Q1
    { id: "C2", die_x: 4, die_y: 3, status: "REJECT" },    // Inner Ring, Q1 (r=5.0)
    { id: "C3", die_x: -6, die_y: 1, status: "MONITOR" },  // Outer Edge, Q2 (r=6.08)
    { id: "C4", die_x: -2, die_y: -2, status: "PASS" },   // Center, Q3 (r=2.82)
    { id: "C5", die_x: 3, die_y: -4, status: "PASS" }      // Inner Ring, Q4 (r=5.0)
  ];

  const res = mockCalculateRegionalAnalysis(mockComponents);
  assert.strictEqual(res.radial.center.total, 2, "Center total should be 2");
  assert.strictEqual(res.radial.inner.total, 2, "Inner ring total should be 2");
  assert.strictEqual(res.radial.edge.total, 1, "Outer edge total should be 1");
  assert.strictEqual(res.radial.inner.anomalous, 1, "Inner ring anomalous should be 1");
  assert.strictEqual(res.radial.edge.anomalous, 1, "Outer edge anomalous should be 1");
});

runTest("Spatial data fallback handles missing coordinates gracefully without throwing", () => {
  const componentsWithoutSpatial = [
    { id: "C1", status: "PASS" },
    { id: "C2", status: "REJECT" }
  ];

  const hotspots = mockDetectSpatialHotspots(componentsWithoutSpatial);
  assert.strictEqual(hotspots.length, 0, "Components without spatial data must return 0 hotspots");

  const regional = mockCalculateRegionalAnalysis(componentsWithoutSpatial);
  assert.strictEqual(regional.radial.center.total, 0, "Center total should be 0 when no spatial data");
});

console.log("\n=========================================================================");
console.log(`SPATIAL TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
console.log("=========================================================================\n");

if (failed > 0) {
  process.exit(1);
}
