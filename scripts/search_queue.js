const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
let idx = 0;
while ((idx = html.indexOf('queue', idx)) !== -1) {
  console.log('Match at offset:', idx);
  console.log(html.substring(Math.max(0, idx - 40), Math.min(html.length, idx + 100)));
  idx += 6;
}
