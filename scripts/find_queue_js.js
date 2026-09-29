const fs = require('fs');

const js = fs.readFileSync('script.js', 'utf8');

let idx = 0;
while ((idx = js.indexOf('investigation-queue', idx)) !== -1) {
  console.log('Match for investigation-queue in script.js at offset:', idx);
  console.log(js.substring(Math.max(0, idx - 50), Math.min(js.length, idx + 400)));
  console.log('====================================');
  idx += 19;
}

idx = 0;
while ((idx = js.indexOf('filterInvestigationQueue', idx)) !== -1) {
  console.log('Match for filterInvestigationQueue in script.js at offset:', idx);
  console.log(js.substring(Math.max(0, idx - 50), Math.min(js.length, idx + 600)));
  console.log('====================================');
  idx += 24;
}
