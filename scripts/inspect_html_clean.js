const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

console.log('--- Inspecting index.html ---');
console.log('Length:', html.length);
console.log('Contains Space Grotesk:', html.includes('Space Grotesk'));
console.log('Contains Google Fonts Outfit/Inter:', html.includes('fonts.googleapis.com'));
console.log('Font link match:', html.match(/<link[^>]+fonts\.googleapis\.com[^>]+>/g));
console.log('Style tags match count:', (html.match(/<style[\s\S]*?<\/style>/gi) || []).length);
console.log('Build marker:', (html.match(/PREDICTA-[A-Z0-9_-]+/g) || []));
console.log('Active Pages:', (html.match(/id="page-[^"]+"/g) || []));
console.log('Advanced Subtabs:', (html.match(/id="adv-tab-[^"]+"/g) || []));
