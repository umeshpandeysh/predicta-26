const fs = require('fs');

function fixSvgFontSizes(filename) {
  let content = fs.readFileSync(filename, 'utf8');
  content = content.replace(/font-size=["'](?:8|8\.5|9|9\.5)(?:px)?["']/g, 'font-size="11.5"');
  content = content.replace(/font-size=["'](?:10|10\.5)(?:px)?["']/g, 'font-size="12"');
  content = content.replace(/font-size=["']11(?:px)?["']/g, 'font-size="12.5"');
  fs.writeFileSync(filename, content, 'utf8');
}

fixSvgFontSizes('index.html');
fixSvgFontSizes('frontend/index.html');
fixSvgFontSizes('script.js');
fixSvgFontSizes('frontend/script.js');

console.log('SVG font-size attributes upgraded across all files.');
