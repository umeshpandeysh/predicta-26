const fs = require('fs');

const files = ['style.css', 'frontend/style.css', 'index.html', 'frontend/index.html', 'script.js', 'frontend/script.js'];

let errors = 0;

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');

  // Check for any remaining occurrences of Outfit, JetBrains, monospace, Fira
  const unwanted = content.match(/(Outfit|JetBrains|Fira Code|font-family:\s*monospace)/gi);
  if (unwanted) {
    console.error(`❌ [${f}] Found unwanted font references:`, unwanted);
    errors++;
  } else {
    console.log(`✅ [${f}] No secondary/monospace font definitions found.`);
  }
}

// Check CSS variable definitions in style.css and frontend/style.css
for (const f of ['style.css', 'frontend/style.css']) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const varLines = lines.filter(l => /^\s*--font-[a-zA-Z0-9_-]+\s*:/i.test(l));
  console.log(`\n=== Font variables in ${f} ===`);
  varLines.forEach(v => console.log('  ', v.trim()));
  const nonInter = varLines.filter(v => !v.includes('Inter'));
  if (nonInter.length > 0) {
    console.error(`❌ Non-Inter variables found in ${f}:`, nonInter);
    errors++;
  } else {
    console.log(`✅ All font variables in ${f} point to Inter.`);
  }
}

if (errors === 0) {
  console.log('\n🎉 ALL FONT FAMILIES UNIFORMLY SET TO INTER!');
} else {
  console.error(`\n❌ Found ${errors} issues.`);
  process.exit(1);
}
