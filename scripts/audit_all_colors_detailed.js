const fs = require('fs');

const files = ['style.css', 'index.html', 'script.js'];

const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(colorRegex) || [];
  const freq = {};
  matches.forEach(c => {
    const norm = c.toLowerCase();
    freq[norm] = (freq[norm] || 0) + 1;
  });
  console.log(`=== Colors in ${f} (Top 25) ===`);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 25).forEach(([c, count]) => {
    console.log(`  ${c}: ${count}`);
  });
}
