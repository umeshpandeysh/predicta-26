const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');

let idx = 0;
while ((idx = css.indexOf('.queue', idx)) !== -1) {
  console.log('Match for .queue in style.css at offset:', idx);
  console.log(css.substring(idx, Math.min(css.length, idx + 400)));
  console.log('====================================');
  idx += 6;
}
