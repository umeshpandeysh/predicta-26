const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Find all font-size declarations with their surrounding context
const regex = /<([a-zA-Z0-9]+)([^>]*style="[^"]*font-size\s*:\s*([^;"]+)[^"]*"[^>]*)>/gi;

let m;
const categorized = {
  headings: [],
  smallText: [],
  largeText: []
};

while ((m = regex.exec(html)) !== null) {
  const tag = m[1].toLowerCase();
  const fullAttrs = m[2];
  const sizeStr = m[3].trim();
  const numSize = parseFloat(sizeStr);
  const isHeadingTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
  const isHeadingClass = /class="[^"]*(?:title|heading|brand|stat-value|disposition-pill)[^"]*"/i.test(fullAttrs);

  if (isHeadingTag || isHeadingClass || numSize >= 15) {
    categorized.headings.push({ tag, sizeStr, numSize, fullAttrs: fullAttrs.substring(0, 80) });
  } else if (numSize <= 14) {
    categorized.smallText.push({ tag, sizeStr, numSize, fullAttrs: fullAttrs.substring(0, 80) });
  } else {
    categorized.largeText.push({ tag, sizeStr, numSize, fullAttrs: fullAttrs.substring(0, 80) });
  }
}

console.log(`Found ${categorized.headings.length} headings / large elements (WILL KEEP UNCHANGED)`);
console.log(`Found ${categorized.smallText.length} small text elements (CANDIDATES FOR READABILITY INCREASE)`);

const sizeDist = {};
categorized.smallText.forEach(item => {
  sizeDist[item.sizeStr] = (sizeDist[item.sizeStr] || 0) + 1;
});
console.log('\nSmall text distribution:');
console.table(sizeDist);
