const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const advIdx = html.indexOf('id="page-advanced"');
console.log(html.slice(advIdx, advIdx + 1200));
