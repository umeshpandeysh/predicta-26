const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function findColors(text) {
  const hex = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgb = text.match(/rgba?\([^)]+\)/g) || [];
  const counts = {};
  [...hex, ...rgb].forEach(c => counts[c] = (counts[c] || 0) + 1);
  return counts;
}

console.log('=== CSS COLORS ===');
console.table(findColors(css));

console.log('\n=== HTML INLINE COLORS ===');
console.table(findColors(html));
