const fs = require('fs');

const js = fs.readFileSync('script.js', 'utf8');

function searchPatterns(patterns) {
  patterns.forEach(p => {
    const count = (js.match(new RegExp(p, 'g')) || []).length;
    console.log(`Pattern "${p}": ${count} matches`);
    if (count > 0) {
      const idx = js.indexOf(p);
      console.log('Sample context:\n', js.substring(Math.max(0, idx - 50), Math.min(js.length, idx + 150)));
      console.log('---');
    }
  });
}

searchPatterns([
  'runScreening',
  'predictMeasurementRecord',
  'adm-in-result-content',
  'fetchComponentsList',
  'fetchLiveMonitorReplay',
  'openReliabilityPassport'
]);
