const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

let idx = 0;
while ((idx = html.indexOf('Queue', idx)) !== -1) {
  console.log('Match for Queue at offset:', idx);
  console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 400)));
  console.log('====================================');
  idx += 5;
}

idx = 0;
while ((idx = html.indexOf('queue', idx)) !== -1) {
  console.log('Match for queue (lowercase) at offset:', idx);
  console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 400)));
  console.log('====================================');
  idx += 5;
}
