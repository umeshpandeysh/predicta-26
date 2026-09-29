const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
let css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');

const fontMap = {
  '8.5px': '9.5px',
  '9px': '10px',
  '9.5px': '10.5px',
  '10px': '11px',
  '10.5px': '11.5px',
  '11px': '12px',
  '11.5px': '12.5px',
  '12px': '13px',
  '12.5px': '13.5px',
  '13px': '14px',
  '13.5px': '14px'
};

// Selectors to keep unchanged (headings, hero, brand, large buttons, pills)
const preserveSelectors = [
  'brand', 'hero-title', 'page-title', 'card-title', 'stat-value', 'disposition-pill'
];

let replacedCount = 0;
css = css.replace(/([^{}]+)\{([^}]+)\}/g, (match, selector, body) => {
  const selLower = selector.toLowerCase();
  if (preserveSelectors.some(p => selLower.includes(p))) {
    return match;
  }
  
  let newBody = body.replace(/font-size\s*:\s*([^;!]+)(!important)?;/g, (fMatch, sizeVal, important) => {
    const trimmed = sizeVal.trim();
    if (fontMap[trimmed]) {
      replacedCount++;
      const imp = important ? ' !important' : '';
      return `font-size: ${fontMap[trimmed]}${imp};`;
    }
    return fMatch;
  });
  
  return `${selector}{${newBody}}`;
});

fs.writeFileSync(path.join(ROOT_DIR, 'style.css'), css, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'frontend', 'style.css'), css, 'utf8');
console.log(`✔ Applied ${replacedCount} CSS font size increases in style.css and frontend/style.css`);
