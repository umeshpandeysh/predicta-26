const fs = require('fs');

const js = fs.readFileSync('build_restored_frontend.js', 'utf8');

const subtabs = [
  'adv-tab-registry',
  'adv-tab-mod-a',
  'adv-tab-mod-b',
  'adv-tab-latent-risk',
  'adv-tab-physics',
  'adv-tab-governance',
  'adv-tab-validation',
  'adv-tab-traceability',
  'adv-tab-simulation',
  'adv-tab-reports'
];

for (let i = 0; i < subtabs.length; i++) {
  const current = subtabs[i];
  const start = js.indexOf('id="' + current + '"');
  const nextStart = i < subtabs.length - 1 ? js.indexOf('id="' + subtabs[i+1] + '"') : js.indexOf('</section>', start);
  const chunk = js.slice(start, nextStart);
  const openCount = (chunk.match(/<div[\s>]/gi) || []).length;
  const closeCount = (chunk.match(/<\/div>/gi) || []).length;
  console.log(`[${current}] length=${chunk.length}, open divs=${openCount}, close divs=${closeCount}, balance=${openCount - closeCount}`);
  console.log('Tail of chunk:\n' + chunk.slice(-150) + '\n====================\n');
}
