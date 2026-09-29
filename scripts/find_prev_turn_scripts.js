const fs = require('fs');

// Let's inspect the files in scripts/ from around 04:45Z - 04:47Z (when Live Monitor & Font Size was completed)
const files = fs.readdirSync('scripts')
  .map(f => ({ name: f, mtime: fs.statSync('scripts/' + f).mtime }))
  .filter(f => f.mtime.toISOString().startsWith('2026-09-29T04:'))
  .sort((a,b) => a.mtime - b.mtime);

console.log('Scripts from previous turn (04:xxZ):');
files.forEach(f => console.log('  ' + f.name + ' (' + f.mtime.toISOString() + ')'));
