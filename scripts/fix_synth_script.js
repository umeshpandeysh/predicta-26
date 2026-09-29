const fs = require('fs');
const path = require('path');

const synthJsPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthJsPath, 'utf8');

// Strip any unquoted window.inspectEvidenceGraphNode
const brokenIdx = synthJs.indexOf('\n// =========================================================================\n// PREDICTA ADVANCED WORKSTATION CONTROLLERS (AUTHORITATIVE)\n// =========================================================================\n\nwindow.inspectEvidenceGraphNode');
if (brokenIdx !== -1) {
  synthJs = synthJs.substring(0, brokenIdx);
}

// Strip existing fs.writeFileSync at the end if present
const writeIdx = synthJs.lastIndexOf("fs.writeFileSync('script.js', script, 'utf8');");
if (writeIdx !== -1) {
  synthJs = synthJs.substring(0, writeIdx);
}

const cleanAdvControllersSnippet = `
const advWorkstationControllersSnippet = \`
// =========================================================================
// PREDICTA ADVANCED WORKSTATION CONTROLLERS (AUTHORITATIVE)
// =========================================================================

window.inspectEvidenceGraphNode = function inspectEvidenceGraphNode(nodeKey) {
  const titleEl = document.getElementById("graph-node-title");
  const contentEl = document.getElementById("graph-node-content");
  if (!titleEl || !contentEl) return;

  const nodeMap = {
    telemetry: {
      title: "Node 1 — ATE Telemetry Ingestion (0h / 24h Sensors)",
      content: "16 raw parametric sensor channels captured during automated testing. Verified invariant ranges: Vdd in [0.8, 1.8] V, Temp in [-40, 150] °C, Frequency in [10, 10000] MHz. All sensors validated with zero NaN leakage."
    },
    data_quality: {
      title: "Node 2 — Data Quality & Invariant Gate",
      content: "16/16 physical invariants and non-null bounds verified. Precondition gate guarantees input contract conformance before downstream ML evaluation."
    },
    module_a: {
      title: "Node 3 — Module A Dynamic Anomaly Screening",
      content: "Tri-detector ensemble evaluates spatial and parametric anomalies: Robust PAT-MAD (Median ± 3.0× MAD), COPOD empirical copula tail quantile, and Isolation Forest tree path depth."
    },
    module_b: {
      title: "Node 4 — Module B Prognostic Degradation (GPR)",
      content: "Gaussian Process Regression with Matérn 5/2 covariance kernel projects 0h/24h burn-in telemetry slope to 168h end-of-life horizon, computing earliest specification limit crossing."
    },
    latent_risk: {
      title: "Node 5 — Supervised Latent Risk (XGBoost)",
      content: "28-feature gradient-boosted decision tree architecture evaluates latent defect probability against locked fail-closed operating threshold θ* = 0.20."
    },
    precedence: {
      title: "Node 6 — Fail-Closed Precedence Matrix",
      content: "Hierarchical conflict resolution policy. If any independent stream triggers REJECT (XGBoost P >= 0.20, PAT-MAD Z >= 3.0, or Prognostic breach), final disposition is forced to REJECT."
    },
    decision: {
      title: "Node 7 — Governed Final Verdict & Cryptographic Signature",
      content: "Deterministic qualification outcome synthesized under fail-closed rules. Sealed with SHA-256 model and dataset manifest checksums in the Reliability Passport."
    }
  };

  const info = nodeMap[nodeKey] || {
    title: "Node Inspector: Select a node in the Directed Evidence Graph",
    content: "Directed evidence graph enforces strict forward provenance with zero future telemetry leakage."
  };

  titleEl.textContent = info.title;
  contentEl.textContent = info.content;
};

window.updateAdvAnomalyView = function updateAdvAnomalyView(compId) {
  const isReject = (compId === 'DIE-R20C20');
  const isNominal = (compId === 'DIE-R15C15');
  
  const marker = document.getElementById('adv-mod-a-marker');
  const markerText = document.getElementById('adv-mod-a-marker-text');
  if (marker) {
    const xPos = isReject ? 330 : (isNominal ? 140 : 250);
    marker.setAttribute('transform', 'translate(' + xPos + ', 0)');
  }
  if (markerText) {
    markerText.textContent = isReject ? 'DIE-R20C20 (4.82σ)' : (isNominal ? 'DIE-R15C15 (0.42σ)' : 'DIE-R05C05 (2.10σ)');
  }

  const patScore = document.getElementById('adv-pat-score');
  const patBadge = document.getElementById('adv-pat-badge');
  const copodScore = document.getElementById('adv-copod-score');
  const copodBadge = document.getElementById('adv-copod-badge');
  const ifScore = document.getElementById('adv-if-score');
  const ifBadge = document.getElementById('adv-if-badge');
  const mahalScore = document.getElementById('adv-mahal-score');
  const mahalBadge = document.getElementById('adv-mahal-badge');

  if (patScore) patScore.textContent = isReject ? 'Z = 4.82' : (isNominal ? 'Z = 0.42' : 'Z = 2.10');
  if (patBadge) {
    patBadge.textContent = isReject ? 'OUTLIER' : (isNominal ? 'NOMINAL' : 'WARNING');
    patBadge.className = 'badge ' + (isReject ? 'reject' : (isNominal ? 'pass' : 'warning'));
  }
  if (copodScore) copodScore.textContent = isReject ? 'p = 0.0012' : (isNominal ? 'p = 0.4820' : 'p = 0.0450');
  if (copodBadge) {
    copodBadge.textContent = isReject ? 'TAIL OUTLIER' : (isNominal ? 'NORMAL' : 'ELEVATED');
    copodBadge.className = 'badge ' + (isReject ? 'reject' : (isNominal ? 'pass' : 'warning'));
  }
  if (ifScore) ifScore.textContent = isReject ? 's = 0.41' : (isNominal ? 's = 0.68' : 's = 0.52');
  if (ifBadge) {
    ifBadge.textContent = isReject ? 'ABNORMAL' : (isNominal ? 'NORMAL' : 'MARGINAL');
    ifBadge.className = 'badge ' + (isReject ? 'reject' : (isNominal ? 'pass' : 'warning'));
  }
  if (mahalScore) mahalScore.textContent = isReject ? 'D_M = 14.82' : (isNominal ? 'D_M = 3.12' : 'D_M = 7.45');
  if (mahalBadge) {
    mahalBadge.textContent = isReject ? 'EXCEEDS χ²_0.99' : (isNominal ? 'NOMINAL (< 11.345)' : 'MODERATE');
    mahalBadge.className = 'badge ' + (isReject ? 'reject' : (isNominal ? 'pass' : 'warning'));
  }
};
\`;

script += '\\n' + advWorkstationControllersSnippet;

fs.writeFileSync('script.js', script, 'utf8');
console.log("✔ Successfully synthesized clean workstation script.js with Advanced Controllers");
`;

synthJs = synthJs.trim() + '\n' + cleanAdvControllersSnippet;
fs.writeFileSync(synthJsPath, synthJs, 'utf8');
console.log("✔ Cleaned synth_script.js structure.");
