const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const scrStart = html.indexOf('<section id="page-screening"');
const scrEnd = html.indexOf('</section>', scrStart) + 10;
const curScr = html.substring(scrStart, scrEnd);

console.log('Current screening length:', curScr.length);
console.log('Has adm-decision-command-panel:', curScr.includes('adm-decision-command-panel'));
console.log('Has btn-run-screening:', curScr.includes('btn-run-screening'));
console.log('Has adm-in-result-content:', curScr.includes('adm-in-result-content'));

// Also check queue section
const compStart = html.indexOf('<section id="page-components"');
const compEnd = html.indexOf('</section>', compStart) + 10;
const curComp = html.substring(compStart, compEnd);
console.log('Has investigation-queue-grid:', curComp.includes('investigation-queue-grid'));
console.log('Queue grid cards count:', (curComp.match(/class="queue-card/g) || []).length);
