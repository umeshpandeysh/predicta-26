const fs = require('fs');
const path = require('path');

const synthJsPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthJsPath, 'utf8');

// Update switchAdvancedTab mapping
synthJs = synthJs.replace(
  '"latent-risk": "adv-tab-latent-risk"',
  '"latent-risk": "adv-tab-latent-risk",\n    "validation": "adv-tab-validation",\n    "page-validation": "adv-tab-validation",\n    "adv-tab-validation": "adv-tab-validation"'
);

// Update marker positioning in updateAdvAnomalyView
const oldAnomalyView = `window.updateAdvAnomalyView = function updateAdvAnomalyView(compId) {
  const isReject = (compId === 'DIE-R20C20');
  const isNominal = (compId === 'DIE-R15C15');
  
  const marker = document.getElementById('adv-mod-a-marker');
  const markerText = document.getElementById('adv-mod-a-marker-text');
  if (marker) {
    const xPos = isReject ? 330 : (isNominal ? 140 : 250);
    marker.setAttribute('transform', 'translate(' + xPos + ', 0)');
  }`;

const newAnomalyView = `window.updateAdvAnomalyView = function updateAdvAnomalyView(compId) {
  const isReject = (compId === 'DIE-R20C20');
  const isNominal = (compId === 'DIE-R15C15');
  
  const marker = document.getElementById('adv-mod-a-marker');
  const markerText = document.getElementById('adv-mod-a-marker-text');
  if (marker) {
    const xPos = isReject ? 385 : (isNominal ? 160 : 280);
    marker.setAttribute('transform', 'translate(' + xPos + ', 0)');
  }`;

synthJs = synthJs.replace(oldAnomalyView, newAnomalyView);

fs.writeFileSync(synthJsPath, synthJs, 'utf8');
console.log("✔ Successfully updated synth_script.js for validation tab and unclipped graph geometry.");
