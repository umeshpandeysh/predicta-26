const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const waferPos = html.indexOf('Wafer 43 Spatial Health Map');
console.log('Wafer 43 Spatial Health Map position:', waferPos);
console.log(html.substring(waferPos - 300, waferPos + 400));
