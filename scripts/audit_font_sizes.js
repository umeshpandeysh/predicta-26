const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// Find all font-size in CSS with selectors
const cssRules = [...css.matchAll(/([^{}]+)\{([^}]+)\}/g)];
const cssFontSizes = [];
for (const rule of cssRules) {
  const selector = rule[1].trim();
  const body = rule[2];
  const fontMatch = body.match(/font-size\s*:\s*([^;]+);/);
  if (fontMatch) {
    cssFontSizes.push({ selector, fontSize: fontMatch[1].trim() });
  }
}

console.log('=== CSS FONT SIZES ===');
cssFontSizes.forEach(item => {
  console.log(`  ${item.selector} -> ${item.fontSize}`);
});

// Find all font-size in HTML inline styles
const htmlMatches = [...html.matchAll(/<([a-zA-Z0-9]+)[^>]*style="([^"]*font-size\s*:\s*([^;"]+)[^"]*)"[^>]*>/gi)];
const htmlFontSizes = {};
htmlMatches.forEach(m => {
  const tag = m[1];
  const style = m[2];
  const size = m[3].trim();
  const key = `${tag} (${size})`;
  htmlFontSizes[key] = (htmlFontSizes[key] || 0) + 1;
});

console.log('\n=== HTML INLINE FONT SIZES (BY TAG & SIZE) ===');
Object.entries(htmlFontSizes).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} occurrences`);
});
