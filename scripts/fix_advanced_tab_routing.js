const fs = require('fs');
const path = require('path');

console.log("=== FIXING ADVANCED TAB ROUTING & CONTROLLER ===");

// 1. Update script.base.js
const scriptBasePath = path.join(__dirname, '..', 'script.base.js');
let scriptBase = fs.readFileSync(scriptBasePath, 'utf8');

// Fix initAdvancedWorkstation in script.base.js
const oldInitAdv = `  function initAdvancedWorkstation() {
    const advTabs = document.querySelectorAll(".adv-tab-btn");
    advTabs.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const targetPage = btn.getAttribute("data-target");
        if (targetPage) {
          switchPage(targetPage);
        }
      };
    });
  }`;

const newInitAdv = `  function initAdvancedWorkstation() {
    const advTabs = document.querySelectorAll(".adv-tab-btn");
    advTabs.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const targetTab = btn.getAttribute("data-target");
        if (targetTab && typeof window.switchAdvancedTab === "function") {
          window.switchAdvancedTab(targetTab);
        }
      };
    });
  }`;

if (scriptBase.includes(oldInitAdv)) {
  scriptBase = scriptBase.replace(oldInitAdv, newInitAdv);
  fs.writeFileSync(scriptBasePath, scriptBase, 'utf8');
  console.log("✔ Updated initAdvancedWorkstation in script.base.js");
} else {
  console.log("ℹ script.base.js initAdvancedWorkstation check/skip");
}

// 2. Update synth_script.js
const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

// Ensure ROUTE_MAP in synth_script.js contains validation mappings
const oldRouteMap = `"reports": "page-advanced",
    "page-reports": "page-advanced",
    "adv-tab-reports": "page-advanced"`;

const newRouteMap = `"reports": "page-advanced",
    "page-reports": "page-advanced",
    "adv-tab-reports": "page-advanced",
    "validation": "page-advanced",
    "page-validation": "page-advanced",
    "adv-tab-validation": "page-advanced",
    "validation-evidence": "page-advanced",
    "evidence": "page-advanced"`;

if (synthJs.includes(oldRouteMap)) {
  synthJs = synthJs.replace(oldRouteMap, newRouteMap);
  console.log("✔ Added validation routes to ROUTE_MAP in synth_script.js");
}

// Ensure switchPage in synth_script.js handles validation subtab routing
const oldSubTabSwitch = `} else if (cleanRaw === "reports" || cleanRaw === "page-reports" || cleanRaw === "adv-tab-reports") {
        targetSubTab = "adv-tab-reports";
      }`;

const newSubTabSwitch = `} else if (cleanRaw === "reports" || cleanRaw === "page-reports" || cleanRaw === "adv-tab-reports") {
        targetSubTab = "adv-tab-reports";
      } else if (cleanRaw === "validation" || cleanRaw === "page-validation" || cleanRaw === "adv-tab-validation" || cleanRaw === "validation-evidence" || cleanRaw === "evidence") {
        targetSubTab = "adv-tab-validation";
      }`;

if (synthJs.includes(oldSubTabSwitch)) {
  synthJs = synthJs.replace(oldSubTabSwitch, newSubTabSwitch);
  console.log("✔ Added validation subtab branch to switchPage in synth_script.js");
}

// Ensure initAdvancedWorkstation is defined in advWorkstationControllersSnippet in synth_script.js
const oldAdvControllersHeader = `// PREDICTA ADVANCED WORKSTATION CONTROLLERS (AUTHORITATIVE)
// =========================================================================`;

const newAdvControllersHeader = `// PREDICTA ADVANCED WORKSTATION CONTROLLERS (AUTHORITATIVE)
// =========================================================================

window.initAdvancedWorkstation = function initAdvancedWorkstation() {
  const advTabs = document.querySelectorAll(".adv-tab-btn");
  advTabs.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute("data-target");
      if (targetTab && typeof window.switchAdvancedTab === "function") {
        window.switchAdvancedTab(targetTab);
      }
    };
  });
};`;

if (!synthJs.includes('window.initAdvancedWorkstation = function initAdvancedWorkstation')) {
  synthJs = synthJs.replace(oldAdvControllersHeader, newAdvControllersHeader);
  console.log("✔ Added window.initAdvancedWorkstation to advWorkstationControllersSnippet in synth_script.js");
}

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ Successfully updated synth_script.js");
