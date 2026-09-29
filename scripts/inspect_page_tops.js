const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const pages = ['page-home', 'page-screening', 'page-monitor', 'page-components', 'page-advanced'];

pages.forEach(p => {
  const idx = html.indexOf(`id="${p}"`);
  console.log(`=== ${p} ===`);
  if (idx !== -1) {
    console.log(html.slice(idx, idx + 350));
  } else {
    console.log('NOT FOUND');
  }
  console.log();
});
