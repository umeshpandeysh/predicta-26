// Dependency-free Node.js automated test runner for AIPS registries
const fs = require('fs');
const path = require('path');

console.log("Starting AIPS Registry validation tests...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

// Simple YAML parser for list of objects
function parseYamlList(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const list = [];
  let currentObj = null;
  
  lines.forEach(line => {
    // Ignore comments or empty lines
    if (line.trim().startsWith('#') || line.trim() === '') return;
    
    // Check if new list item starts
    if (line.trim().startsWith('-')) {
      if (currentObj) list.push(currentObj);
      currentObj = {};
      line = line.replace('-', ' ');
    }
    
    if (currentObj && line.includes(':')) {
      const idx = line.indexOf(':');
      let key = line.substring(0, idx).trim();
      let value = line.substring(idx + 1).trim();
      
      // Clean up string quotes
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      
      // Handle array parsing
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/'|"/g, ''));
      }
      
      currentObj[key] = value;
    }
  });
  
  if (currentObj) list.push(currentObj);
  return list;
}

// 1. Validate Component Registry
const componentRegistryPath = path.join(__dirname, '../research/components/component_registry.yaml');
assert(fs.existsSync(componentRegistryPath), "component_registry.yaml exists");

try {
  const components = parseYamlList(componentRegistryPath);
  assert(components.length > 0, `Parsed ${components.length} components from registry`);
  
  components.forEach(c => {
    assert(c.part_number, `Component ${c.part_number || 'unknown'} has part_number`);
    assert(c.manufacturer, `Component ${c.part_number} has manufacturer`);
    assert(c.datasheet_url && c.datasheet_url.startsWith('http'), `Component ${c.part_number} has valid datasheet URL`);
    assert(c.quiescent_current, `Component ${c.part_number} quiescent current is documented`);
    assert(c.propagation_delay, `Component ${c.part_number} propagation delay is documented`);
    assert(c.ps170_relevance, `Component ${c.part_number} has PS170 relevance mapping`);
  });
} catch (e) {
  assert(false, `Failed to validate component registry: ${e.message}`);
}

// 2. Validate Dataset Registry
const datasetRegistryPath = path.join(__dirname, '../data/dataset_registry.yaml');
assert(fs.existsSync(datasetRegistryPath), "dataset_registry.yaml exists");

try {
  const datasets = parseYamlList(datasetRegistryPath);
  assert(datasets.length > 0, `Parsed ${datasets.length} datasets from registry`);
  
  datasets.forEach(d => {
    assert(d.id, `Dataset ${d.id || 'unknown'} has identifier ID`);
    assert(d.name, `Dataset ${d.id} has name`);
    assert(d.source_url && d.source_url.startsWith('http'), `Dataset ${d.id} has source URL`);
    assert(d.license, `Dataset ${d.id} has license type declared`);
    assert(d.source_type, `Dataset ${d.id} has source type declared (proxy/synthetic)`);
    assert(d.download_status, `Dataset ${d.id} has download status declared`);
  });
} catch (e) {
  assert(false, `Failed to validate dataset registry: ${e.message}`);
}

// 3. Validate Evidence Registry
const evidenceRegistryPath = path.join(__dirname, '../research/evidence_registry.yaml');
assert(fs.existsSync(evidenceRegistryPath), "evidence_registry.yaml exists");

try {
  const evidence = parseYamlList(evidenceRegistryPath);
  assert(evidence.length > 0, `Parsed ${evidence.length} evidence items from registry`);
  
  evidence.forEach(ev => {
    assert(ev.id, `Evidence item ${ev.id || 'unknown'} has identifier ID`);
    assert(ev.claim, `Evidence item ${ev.id} has claim text`);
    assert(ev.source, `Evidence item ${ev.id} has source citation`);
    assert(ev.status, `Evidence item ${ev.id} has verification status: ${ev.status}`);
  });
} catch (e) {
  assert(false, `Failed to validate evidence registry: ${e.message}`);
}

console.log(`\nRegistry tests completed. Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All registry schemas and fields validated successfully!");
  process.exit(0);
}
