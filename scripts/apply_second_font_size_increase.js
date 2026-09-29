const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Update style.css
let css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');

const cssFontMap = {
  '12px': '13.5px',
  '12.5px': '14px',
  '13px': '14.5px',
  '14px': '15.5px',
  '10px': '12px',
  '11px': '12.5px',
  '11.5px': '13px'
};

// Selectors to keep unchanged: headings, titles, brand, large buttons, pills, and nav-link
const preserveSelectors = [
  'brand', 'hero-title', 'page-title', 'card-title', 'stat-value', 'disposition-pill',
  'nav-link', 'btn-primary', 'hero-title'
];

let replacedCssCount = 0;
css = css.replace(/([^{}]+)\{([^}]+)\}/g, (match, selector, body) => {
  const selLower = selector.toLowerCase();
  if (preserveSelectors.some(p => selLower.includes(p))) {
    return match;
  }
  
  let newBody = body.replace(/font-size\s*:\s*([^;!]+)(!important)?;/g, (fMatch, sizeVal, important) => {
    const trimmed = sizeVal.trim();
    if (cssFontMap[trimmed]) {
      replacedCssCount++;
      const imp = important ? ' !important' : '';
      return `font-size: ${cssFontMap[trimmed]}${imp};`;
    }
    return fMatch;
  });
  
  return `${selector}{${newBody}}`;
});

fs.writeFileSync(path.join(ROOT_DIR, 'style.css'), css, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'frontend', 'style.css'), css, 'utf8');
console.log(`✔ Applied ${replacedCssCount} CSS font size increases in style.css and frontend/style.css`);

// 2. Update index.html inline font-sizes
let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

// Mapping from current sizes in index.html to +1.5px / +2px enhanced sizes
const htmlFontMap = {
  '9.5px': '11.5px',
  '10px': '12px',
  '10.5px': '12.5px',
  '11px': '13px',
  '11.5px': '13.5px',
  '12px': '14px',
  '12.5px': '14.5px',
  '13px': '15px',
  '13.5px': '15px',
  '14px': '15.5px'
};

let htmlChangedCount = 0;
html = html.replace(/<([a-zA-Z0-9]+)([^>]*style="[^"]*font-size\s*:\s*([^;"]+)[^"]*"[^>]*)>/gi, (match, tag, attrs, sizeStr) => {
  const t = tag.toLowerCase();
  const trimmedSize = sizeStr.trim();
  
  // Guard 1: Do NOT change heading tags (h1-h6)
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(t)) {
    return match;
  }
  
  // Guard 2: Do NOT change heading/title/brand/large value classes
  if (/class="[^"]*(?:page-title|hero-title|card-title|brand|stat-value|disposition-pill)[^"]*"/i.test(attrs)) {
    return match;
  }
  
  // Guard 3: Only replace sizes present in our map
  if (htmlFontMap[trimmedSize]) {
    const newSize = htmlFontMap[trimmedSize];
    htmlChangedCount++;
    const updatedAttrs = attrs.replace(new RegExp(`font-size\\s*:\\s*${trimmedSize.replace('.', '\\.')}`, 'i'), `font-size:${newSize}`);
    return `<${tag}${updatedAttrs}>`;
  }
  
  return match;
});

fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'frontend', 'index.html'), html, 'utf8');
console.log(`✔ Applied ${htmlChangedCount} inline font size increases to index.html and frontend/index.html`);
