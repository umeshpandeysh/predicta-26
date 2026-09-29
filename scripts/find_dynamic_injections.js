const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

const lines = script.split('\n');
console.log(`Total lines in script.js: ${lines.length}`);

lines.forEach((l, idx) => {
  if (l.includes('innerHTML') || l.includes('insertAdjacentHTML') || l.includes('appendChild')) {
    if (l.includes('timeline') || l.includes('efficiency') || l.includes('tstep') || l.includes('throughput') || l.includes('lifecycle') || l.includes('stage') || l.includes('drawer')) {
      console.log(`Line ${idx+1}: ${l.trim()}`);
    }
  }
});
