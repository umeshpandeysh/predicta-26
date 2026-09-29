const fs = require('fs');

function inspectCSSFonts(filepath) {
  const css = fs.readFileSync(filepath, 'utf8');
  const lines = css.split('\n');
  console.log(`=== Inspecting ${filepath} ===`);
  lines.forEach((line, idx) => {
    if (/font-family/i.test(line)) {
      console.log(`L${idx+1}: ${line.trim()}`);
    }
  });
}

inspectCSSFonts('style.css');
