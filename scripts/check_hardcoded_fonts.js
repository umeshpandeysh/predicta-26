const fs = require('fs');

const files = ['style.css', 'frontend/style.css', 'index.html', 'frontend/index.html'];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=== Hardcoded fonts check in ${f} ===`);
  const regex = /font-family\s*:\s*([^;\"'>]+)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const val = match[1].trim();
    if (!val.includes('var(--font-')) {
      console.log(`Found non-var font: "${val}" around position ${match.index}`);
    }
  }
  // Also check for 'Outfit', 'JetBrains', 'monospace', 'Fira Code', 'Segoe UI'
  const explicit = content.match(/(Outfit|JetBrains|monospace|Fira Code|Segoe UI)/gi) || [];
  console.log(`Explicit occurrences of other font names in ${f}:`, [...new Set(explicit)]);
}
