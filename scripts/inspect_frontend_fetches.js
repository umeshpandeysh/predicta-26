const fs = require('fs');

const js = fs.readFileSync('script.js', 'utf8') + fs.readFileSync('api.js', 'utf8');

// Check for fetch / xhr / img.src / etc.
const fetchMatches = [...js.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
console.log('=== FETCH CALLS ===');
[...new Set(fetchMatches)].forEach(f => console.log('  ' + f));

const imgMatches = [...js.matchAll(/\.src\s*=\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
console.log('=== IMG SRC SETS ===');
[...new Set(imgMatches)].forEach(i => console.log('  ' + i));
