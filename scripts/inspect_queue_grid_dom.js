const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const queueStart = html.indexOf('id="investigation-queue-grid"');
console.log(html.substring(queueStart, queueStart + 800));
