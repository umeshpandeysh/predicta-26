const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const regex = /style="([^"]*)"/g;
let match;
const inlineStyles = [];
while ((match = regex.exec(html)) !== null) {
  inlineStyles.push(match[1]);
}

console.log('Total elements with style="" in index.html:', inlineStyles.length);

const oldHexMatches = {};
const hexRegex = /#[0-9A-Fa-f]{6}/g;
inlineStyles.forEach(s => {
  const matches = s.match(hexRegex) || [];
  matches.forEach(h => {
    const up = h.toUpperCase();
    oldHexMatches[up] = (oldHexMatches[up] || 0) + 1;
  });
});

console.log('Hex colors in inline styles:');
console.log(Object.entries(oldHexMatches).sort((a,b) => b[1] - a[1]));

const fontSizes = {};
inlineStyles.forEach(s => {
  const m = s.match(/font-size:\s*([0-9]+px)/g) || [];
  m.forEach(f => {
    fontSizes[f] = (fontSizes[f] || 0) + 1;
  });
});
console.log('\nFont sizes in inline styles:');
console.log(Object.entries(fontSizes).sort((a,b) => b[1] - a[1]).slice(0, 20));
