const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const queueStart = html.indexOf('queue-card');
const sectionStart = html.lastIndexOf('<section', queueStart);
const sectionEnd = html.indexOf('</section>', queueStart) + 10;

console.log('Section containing queue-card:');
console.log(html.substring(sectionStart, sectionStart + 1500));
console.log('\n--- Section Header & Filter controls ---');
console.log(html.substring(sectionStart + 500, queueStart + 2000));
