const fs = require('fs');
const path = require('path');

const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthCode = fs.readFileSync(synthPath, 'utf8');

// In router triggers, clean up page-components trigger
const oldRouterTrigger = `    if (targetPageId === "page-components" || targetPageId === "page-component") {
      if (typeof window.renderLotTable === "function") window.renderLotTable();
      if (typeof window.handleComponentDossierChange === "function") {
        const sel = document.getElementById("comp-investigation-selector");
        window.handleComponentDossierChange(sel ? sel.value : "DIE-R20C20");
      }
      if (typeof window.selectComponentTimelineStage === "function") {
        window.selectComponentTimelineStage(1);
      }
    }`;

const newRouterTrigger = `    if (targetPageId === "page-components" || targetPageId === "page-component") {
      if (typeof window.renderLotTable === "function") window.renderLotTable();
      if (typeof window.handleComponentDossierChange === "function") {
        const sel = document.getElementById("comp-investigation-selector");
        window.handleComponentDossierChange(sel ? sel.value : "DIE-R20C20");
      }
    }`;

if (synthCode.includes(oldRouterTrigger)) {
  synthCode = synthCode.replace(oldRouterTrigger, newRouterTrigger);
  console.log("✔ Cleaned router trigger for page-components in synth_script.js");
}

fs.writeFileSync(synthPath, synthCode, 'utf8');
