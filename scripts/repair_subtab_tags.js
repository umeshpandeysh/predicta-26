const fs = require('fs');

let js = fs.readFileSync('build_restored_frontend.js', 'utf8');

const targets = [
  '<!-- ── SUBTAB 2: MODULE A',
  '<!-- ── SUBTAB 3: MODULE B',
  '<!-- ── SUBTAB 4: LATENT RISK',
  '<!-- ── SUBTAB 8: TRACEABILITY',
  '<!-- ── SUBTAB 9: WHAT-IF SIMULATION'
];

for (const t of targets) {
  const idx = js.indexOf(t);
  if (idx !== -1) {
    js = js.slice(0, idx) + '</div>\n\n        ' + js.slice(idx);
    console.log(`✔ Added closing </div> before ${t}`);
  } else {
    console.warn(`❌ Could not find ${t}`);
  }
}

fs.writeFileSync('build_restored_frontend.js', js, 'utf8');
console.log('✔ Updated build_restored_frontend.js');
