const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');

console.log('=== HTML HEAD / ASSETS ===');
const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
if (headMatch) {
  console.log(headMatch[0]);
}

console.log('\n=== SCRIPTS IN HTML ===');
const scriptMatches = [...html.matchAll(/<script[\s\S]*?<\/script>/gi)];
scriptMatches.forEach(s => console.log(s[0]));
