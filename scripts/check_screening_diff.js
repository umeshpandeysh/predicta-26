const fs = require('fs');

function extractScreening(content) {
  const start = content.indexOf('<section id="page-screening"');
  if (start === -1) return null;
  const end = content.indexOf('</section>', start) + 10;
  return content.substring(start, end);
}

const goldenPre = extractScreening(fs.readFileSync('PRE_TYPOGRAPHY_GOLDEN_STATE/index.html', 'utf8'));
const curScreening = extractScreening(fs.readFileSync('index.html', 'utf8'));

console.log('Golden Pre length:', goldenPre.length);
console.log('Current length:', curScreening.length);

const goldenLines = goldenPre.split('\n');
const curLines = curScreening.split('\n');
console.log('Golden lines:', goldenLines.length, 'Current lines:', curLines.length);

console.log('Golden contains adm-in-result-content:', goldenPre.includes('adm-in-result-content'));
console.log('Current contains adm-in-result-content:', curScreening.includes('adm-in-result-content'));
