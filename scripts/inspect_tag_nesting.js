const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const pages = ['page-home', 'page-screening', 'page-monitor', 'page-components', 'page-advanced'];

pages.forEach(p => {
  const openTag = `<section id="${p}"`;
  const openIdx = html.indexOf(openTag);
  console.log(`${p} open tag index: ${openIdx}`);
  
  // Find next </section>
  const closeIdx = html.indexOf('</section>', openIdx);
  console.log(`${p} close tag index: ${closeIdx}`);
});
