const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('Active Wafer Spatial Health') !== -1 
  ? html.indexOf('Active Wafer Spatial Health') - 300 
  : html.indexOf('home-single-wafer') - 500;
const end = html.indexOf('Recent Qualification Activity', start) + 4000;

console.log(html.substring(start, end));
