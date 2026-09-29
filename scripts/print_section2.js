const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('SILICON WAFER');
const end = html.indexOf('WORKSTATION CAPABILITIES', start);

console.log('Start index:', start, 'End index:', end);
console.log(html.substring(start - 30, end));
