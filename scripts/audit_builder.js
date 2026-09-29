const fs = require('fs');

const code = fs.readFileSync('build_restored_frontend.js', 'utf8');

console.log('Searching for typography references:');
console.log('Space Grotesk count:', (code.match(/Space Grotesk/gi) || []).length);
console.log('font-family occurrences:');
const ffMatches = code.match(/font-family:[^;"]+/g) || [];
console.log(Array.from(new Set(ffMatches)));

console.log('font-size occurrences count:', (code.match(/font-size:[^;"]+/g) || []).length);
