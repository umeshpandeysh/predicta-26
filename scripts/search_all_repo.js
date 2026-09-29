const fs = require('fs');
const path = require('path');

function searchAllFiles(dir, terms) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.system_generated') {
      searchAllFiles(full, terms);
    } else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.js'))) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        terms.forEach(t => {
          if (content.includes(t)) {
            console.log(`MATCH: "${t}" in ${full}`);
          }
        });
      } catch (e) {}
    }
  }
}

console.log('Searching all files in repo...');
searchAllFiles('.', [
  'Traceable ReliabilityCase Lifecycle Timeline',
  'Qualification Efficiency Opportunity',
  'SCREENING THROUGHPUT ANALYSIS',
  'AUDITABLE DECISION PROVENANCE'
]);
