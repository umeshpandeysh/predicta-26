const fs = require('fs');

function inspectHTMLFonts(filepath) {
  const html = fs.readFileSync(filepath, 'utf8');
  const lines = html.split('\n');
  console.log(`=== Inspecting ${filepath} ===`);
  lines.forEach((line, idx) => {
    if (/font-family|fonts\.googleapis|font-face|Inter|Outfit|JetBrains|monospace/i.test(line)) {
      console.log(`L${idx+1}: ${line.trim()}`);
    }
  });
}

inspectHTMLFonts('index.html');
