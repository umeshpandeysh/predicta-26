const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('id="component-investigation-queue-container"');
const end = html.indexOf('<!-- 256-Row Comprehensive Population Ledger Table -->', start);

console.log(html.substring(start, end));
