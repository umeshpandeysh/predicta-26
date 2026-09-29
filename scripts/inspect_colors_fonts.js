const fs = require('fs');

const b = fs.readFileSync('build_restored_frontend.js', 'utf8');
const fontMatches = b.match(/font-family:[^;"']+/g) || [];
console.log('Unique font families in build_restored_frontend.js:', Array.from(new Set(fontMatches)));

const colorMatches = b.match(/#[0-9A-Fa-f]{6}/g) || [];
const colorCounts = {};
colorMatches.forEach(c => {
  const upper = c.toUpperCase();
  colorCounts[upper] = (colorCounts[upper] || 0) + 1;
});
console.log('Top colors in build_restored_frontend.js:', Object.entries(colorCounts).sort((a,b) => b[1] - a[1]).slice(0, 25));

const css = fs.readFileSync('style.css', 'utf8');
const cssFontMatches = css.match(/font-family:[^;"']+/g) || [];
console.log('Unique font families in style.css:', Array.from(new Set(cssFontMatches)));
