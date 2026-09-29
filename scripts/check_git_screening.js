const fs = require('fs');

// Read index.html from 485eb45 if available, or current
const gitIndex = require('child_process').execSync('git show 485eb45:index.html', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

const scrStart = gitIndex.indexOf('<section id="page-screening"');
const scrEnd = gitIndex.indexOf('</section>', scrStart) + 10;
const scrHtml = gitIndex.substring(scrStart, scrEnd);

console.log('git 485eb45 screening length:', scrHtml.length);
console.log('Has btn-run-screening in 485eb45:', scrHtml.includes('btn-run-screening'));
console.log('Has SECTION 03 marker:', scrHtml.includes('SECTION 03 — GOVERNED QUALIFICATION DECISION'));
console.log('Has Hidden elements marker:', scrHtml.includes('Hidden elements for test harness compatibility'));
