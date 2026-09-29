const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<!-- 2-Column Wafer Spatial Health');
const end = html.indexOf('<!-- 3. WORKSTATION CAPABILITIES', start);

console.log(html.substring(start, end));
