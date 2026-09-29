const fs = require('fs');

function findOffColors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Inspecting non-standard colors in ${filePath} ===`);

  // Target colors: purples, saturated yellows, neon greens, non-semantic reds, etc.
  const regex = /#(?:6366f1|8b5cf6|ec4899|a855f7|f43f5e|10b981|059669|16a34a|dc2626|ef4444|f59e0b|d97706|c98512|d83d45)/gi;

  const found = {};
  lines.forEach((line, idx) => {
    let match;
    while ((match = regex.exec(line)) !== null) {
      const c = match[0].toLowerCase();
      found[c] = (found[c] || 0) + 1;
    }
  });
  console.log(found);
}

findOffColors('index.html');
findOffColors('style.css');
findOffColors('script.js');
