const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

console.log('CSS fonts:');
const fontMatches = css.match(/font-family:[^;]+;/g) || [];
console.log([...new Set(fontMatches)]);

const fontImports = css.match(/@import[^;]+;/g) || [];
console.log('CSS imports:', fontImports);

const rootVars = css.match(/--font-[^:]+:[^;]+;/g) || [];
console.log('CSS root font vars:', rootVars);

console.log('\nHTML font links:');
const fontLinks = html.match(/<link[^>]+fonts[^>]+>/g) || [];
console.log(fontLinks);

console.log('\nHTML inline font-family:');
const inlineFonts = html.match(/font-family:[^;\"']+/g) || [];
console.log([...new Set(inlineFonts)]);
