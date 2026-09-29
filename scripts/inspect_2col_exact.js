const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const heading = '<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->';
const start = html.indexOf(heading);
const end = html.indexOf('<!-- 3. WORKSTATION CAPABILITIES', start) !== -1
  ? html.indexOf('<!-- 3. WORKSTATION CAPABILITIES', start)
  : html.indexOf('</section>', start);

console.log('Heading start:', start, 'End:', end);
console.log(html.substring(start, end));
