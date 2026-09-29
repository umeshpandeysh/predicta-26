const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Find all elements with class containing 'page-view'
const lines = html.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('page-view') && line.includes('id=')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
