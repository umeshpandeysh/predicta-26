const fs = require('fs');

function extractScreening(content) {
  const start = content.indexOf('<section id="page-screening"');
  if (start === -1) return null;
  const end = content.indexOf('</section>', start) + 10;
  return content.substring(start, end);
}

const goldenPre = extractScreening(fs.readFileSync('PRE_TYPOGRAPHY_GOLDEN_STATE/index.html', 'utf8'));
const curScreening = extractScreening(fs.readFileSync('index.html', 'utf8'));

console.log('--- Golden Pre Screening Header/First 1000 chars: ---');
console.log(goldenPre.substring(0, 1000));

console.log('\n--- Current Screening Header/First 1000 chars: ---');
console.log(curScreening.substring(0, 1000));
