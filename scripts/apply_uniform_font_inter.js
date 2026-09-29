const fs = require('fs');
const path = require('path');

function updateCssFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update @import
  content = content.replace(
    /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?[^']+'\);/,
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');"
  );

  // 2. Update CSS variables in :root
  content = content.replace(
    /--font-sans:[^;]+;/,
    "--font-sans: 'Inter', system-ui, -apple-system, sans-serif;"
  );
  content = content.replace(
    /--font-display:[^;]+;/,
    "--font-display: 'Inter', system-ui, -apple-system, sans-serif;"
  );
  content = content.replace(
    /--font-mono:[^;]+;/,
    "--font-mono: 'Inter', system-ui, -apple-system, sans-serif;"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated CSS in ${filePath}`);
}

function updateJsFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace any hardcoded font families in popup/report strings
  content = content.replace(
    /font-family:\s*['"]?Segoe UI['"]?,\s*Tahoma,\s*Geneva,\s*Verdana,\s*sans-serif/g,
    "font-family: 'Inter', system-ui, -apple-system, sans-serif"
  );
  content = content.replace(
    /font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*["']Segoe UI["'],\s*Roboto,\s*sans-serif/g,
    "font-family: 'Inter', system-ui, -apple-system, sans-serif"
  );
  content = content.replace(
    /font-family:\s*monospace/g,
    "font-family: 'Inter', system-ui, -apple-system, sans-serif"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated JS in ${filePath}`);
}

updateCssFile('style.css');
updateCssFile('frontend/style.css');
updateJsFile('script.js');
updateJsFile('frontend/script.js');
