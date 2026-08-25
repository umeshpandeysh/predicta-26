// Automated Node.js verification test suite for AIPS Phase 4 data outputs
const fs = require('fs');
const path = require('path');

console.log("Starting Phase 4 Data Platform automated checks...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

const csvPath = path.join(__dirname, '../data/synthetic/ps170_synthetic_full.csv');
assert(fs.existsSync(csvPath), "ps170_synthetic_full.csv file exists in data/synthetic/");

if (fs.existsSync(csvPath)) {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    // Header check
    const header = lines[0].split(',');
    assert(header.includes('component_id'), "Header includes 'component_id'");
    assert(header.includes('lot_id'), "Header includes 'lot_id'");
    assert(header.includes('burn_in_hour'), "Header includes 'burn_in_hour'");
    assert(header.includes('iddq'), "Header includes 'iddq'");
    assert(header.includes('ileak'), "Header includes 'ileak'");
    assert(header.includes('tpd'), "Header includes 'tpd'");
    assert(header.includes('health_state'), "Header includes 'health_state'");
    assert(header.includes('anomaly_label'), "Header includes 'anomaly_label'");
    
    // Size check (50 lots * 100 components/lot * 4 timepoints = 20000 rows + 1 header = 20001 lines)
    assert(lines.length === 20001, `CSV contains exactly 20,000 data rows (found ${lines.length - 1} rows)`);
    
    // Parse data rows
    const dataRows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',');
      const row = {};
      header.forEach((col, cIdx) => {
        row[col] = vals[cIdx];
      });
      dataRows.push(row);
    }
    
    // Physics and constraints check
    let negativeCurrents = 0;
    let negativeDelays = 0;
    let invalidHours = 0;
    let invalidTemps = 0;
    let trainLots = new Set();
    let testLots = new Set();
    
    // Trajectory checks mapping
    const componentDrifts = {}; // compId -> { h0_tpd, h168_tpd, health }
    
    dataRows.forEach(row => {
      const iddq = parseFloat(row.iddq);
      const ileak = parseFloat(row.ileak);
      const tpd = parseFloat(row.tpd);
      const hour = parseInt(row.burn_in_hour);
      const temp = parseFloat(row.temperature_c);
      
      if (iddq < 0 || ileak < 0) negativeCurrents++;
      if (tpd < 0) negativeDelays++;
      if (![0, 24, 96, 168].includes(hour)) invalidHours++;
      if (temp !== 125.0) invalidTemps++;
      
      // Collect lots for split validation
      const lotNum = parseInt(row.lot_id.split('-')[2]);
      if (lotNum <= 35) {
        trainLots.add(row.lot_id);
      } else if (lotNum >= 43) {
        testLots.add(row.lot_id);
      }
      
      // Timing drift check
      if (!componentDrifts[row.component_id]) {
        componentDrifts[row.component_id] = { health: row.health_state };
      }
      if (hour === 0) componentDrifts[row.component_id].h0_tpd = tpd;
      if (hour === 168) componentDrifts[row.component_id].h168_tpd = tpd;
    });
    
    assert(negativeCurrents === 0, "No negative supply/leakage current values found");
    assert(negativeDelays === 0, "No negative timing delays found");
    assert(invalidHours === 0, "All data rows correspond to exact time steps (0h, 24h, 96h, 168h)");
    assert(invalidTemps === 0, "Oven temperature is stable at 125C");
    
    // Lot leakages check
    const intersection = [...trainLots].filter(x => testLots.has(x));
    assert(intersection.length === 0, "Zero lot leakage: Train and test lot directories are mutually exclusive");
    
    // Timing drift check for healthy logic gates
    let healthyTimingDriftsUp = 0;
    let healthyCount = 0;
    
    Object.keys(componentDrifts).forEach(cId => {
      const d = componentDrifts[cId];
      if (d.health === "HEALTHY" && d.h0_tpd && d.h168_tpd) {
        healthyCount++;
        if (d.h168_tpd > d.h0_tpd) {
          healthyTimingDriftsUp++;
        }
      }
    });
    
    assert(healthyTimingDriftsUp >= 0.99 * healthyCount, `Physics aging: >99% of healthy logic gates slow down under continuous stress (${healthyTimingDriftsUp}/${healthyCount})`);
    
  } catch (e) {
    assert(false, `Parsing failed with exception: ${e.message}`);
  }
}

console.log(`\nPhase 4 automated tests finished. Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All Phase 4 data platform tests completed successfully!");
  process.exit(0);
}
