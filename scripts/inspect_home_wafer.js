const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const homeStart = html.indexOf('<section id="page-home"');
const homeEnd = html.indexOf('</section>', homeStart) + 10;
const homeHtml = html.substring(homeStart, homeEnd);

console.log('--- Home HTML Wafer Section Search ---');
const waferIdx = homeHtml.indexOf('Wafer') !== -1 ? homeHtml.indexOf('Wafer') : homeHtml.indexOf('wafer');
console.log('Wafer index in homeHtml:', waferIdx);

let searchIdx = 0;
while ((searchIdx = homeHtml.indexOf('wafer', searchIdx)) !== -1) {
  console.log('Found wafer match at offset:', searchIdx);
  console.log(homeHtml.substring(Math.max(0, searchIdx - 100), Math.min(homeHtml.length, searchIdx + 400)));
  console.log('====================================');
  searchIdx += 5;
}
