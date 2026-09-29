const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const waferIdx = html.indexOf('home-single-wafer');
console.log('home-single-wafer found at:', waferIdx);
console.log(html.substring(waferIdx - 400, waferIdx + 200));
