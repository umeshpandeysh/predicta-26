const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const waferPos = html.indexOf('Wafer 43 Spatial Health Map');
const gridStart = html.lastIndexOf('<div style="display:grid;', waferPos);
const nextSection = html.indexOf('<!-- 3. WORKSTATION CAPABILITIES', waferPos) !== -1
  ? html.indexOf('<!-- 3. WORKSTATION CAPABILITIES', waferPos)
  : html.indexOf('<!-- Static vs. Dynamic', waferPos);

console.log('gridStart:', gridStart, 'nextSection:', nextSection);
console.log(html.substring(gridStart, nextSection));
