const fs = require('fs');

function extractScreening(content) {
  const start = content.indexOf('<section id="page-screening"');
  if (start === -1) return null;
  const end = content.indexOf('</section>', start) + 10;
  return content.substring(start, end);
}

const goldenPre = extractScreening(fs.readFileSync('PRE_TYPOGRAPHY_GOLDEN_STATE/index.html', 'utf8'));
console.log('PRE_TYPOGRAPHY_GOLDEN_STATE screening length:', goldenPre ? goldenPre.length : 'NULL');

if (fs.existsSync('temp_screening_4336b7d.html')) {
  console.log('temp_screening_4336b7d.html length:', fs.readFileSync('temp_screening_4336b7d.html', 'utf8').length);
}

const curScreening = extractScreening(fs.readFileSync('index.html', 'utf8'));
console.log('current index.html screening length:', curScreening ? curScreening.length : 'NULL');

if (fs.existsSync('temp_historical_4336b7d_index.html')) {
  const hist = extractScreening(fs.readFileSync('temp_historical_4336b7d_index.html', 'utf8'));
  console.log('temp_historical_4336b7d_index.html screening length:', hist ? hist.length : 'NULL');
}

console.log('Is PRE_TYPOGRAPHY_GOLDEN_STATE == temp_screening_4336b7d.html?', goldenPre === fs.readFileSync('temp_screening_4336b7d.html', 'utf8'));
console.log('Is PRE_TYPOGRAPHY_GOLDEN_STATE == current index.html screening?', goldenPre === curScreening);
