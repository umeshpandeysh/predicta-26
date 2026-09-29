const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Update style.css
let css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');

// Map of CSS selector/rule replacements for small text
const cssReplacements = [
  // Topnav status
  { target: '.topnav-status {\n  font-size: 11px;', replace: '.topnav-status {\n  font-size: 12px;' },
  { target: '.topnav-status { font-size: 11px;', replace: '.topnav-status { font-size: 12px;' },
  
  // Breadcrumb
  { target: '.breadcrumb {\n  font-size: 12px;', replace: '.breadcrumb {\n  font-size: 13px;' },
  
  // Page subtitle (non-heading)
  { target: '.page-subtitle {\n  font-size: 13px;', replace: '.page-subtitle {\n  font-size: 14px;' },
  
  // Stat label
  { target: '.stat-label {\n  font-size: 12px;', replace: '.stat-label {\n  font-size: 13px;' },
  
  // Badges
  { target: '.badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 3px 8px;\n  border-radius: 9999px;\n  font-size: 11px;', replace: '.badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 3px 8px;\n  border-radius: 9999px;\n  font-size: 12px;' },
  
  // Table typography
  { target: '.aips-table {\n  width: 100%;\n  border-collapse: separate;\n  border-spacing: 0;\n  font-size: 13px;', replace: '.aips-table {\n  width: 100%;\n  border-collapse: separate;\n  border-spacing: 0;\n  font-size: 14px;' },
  { target: '.aips-table th {\n  background: var(--color-surface-subtle);\n  padding: 10px 14px;\n  text-align: left;\n  font-size: 11px;', replace: '.aips-table th {\n  background: var(--color-surface-subtle);\n  padding: 10px 14px;\n  text-align: left;\n  font-size: 12px;' },
  
  // Form controls
  { target: '.form-control {\n  width: 100%;\n  padding: 9px 12px;\n  border: 1px solid var(--color-border);\n  border-radius: 7px;\n  font-size: 13px;', replace: '.form-control {\n  width: 100%;\n  padding: 9px 12px;\n  border: 1px solid var(--color-border);\n  border-radius: 7px;\n  font-size: 14px;' },
  
  // Timeline nodes
  { target: '.timeline-node-label {\n  font-size: 11px;', replace: '.timeline-node-label {\n  font-size: 12px;' },
  { target: '.timeline-prediction-flag {\n  font-size: 9px;', replace: '.timeline-prediction-flag {\n  font-size: 10px;' },
  
  // Tooltips & Dropdown items
  { target: '.tech-tooltip-icon { font-size: 9px;', replace: '.tech-tooltip-icon { font-size: 10px;' },
  { target: '.tech-tooltip-box {\n  display: none;\n  position: absolute;\n  bottom: calc(100% + 8px);\n  left: 50%;\n  transform: translateX(-50%);\n  width: 260px;\n  padding: 10px 12px;\n  background: #0f172a;\n  color: #f8fafc;\n  font-size: 11px;', replace: '.tech-tooltip-box {\n  display: none;\n  position: absolute;\n  bottom: calc(100% + 8px);\n  left: 50%;\n  transform: translateX(-50%);\n  width: 260px;\n  padding: 10px 12px;\n  background: #0f172a;\n  color: #f8fafc;\n  font-size: 12px;' },
  { target: '.nav-dropdown-item {\n  padding: 7px 12px;\n  font-size: 12px;', replace: '.nav-dropdown-item {\n  padding: 7px 12px;\n  font-size: 13px;' },
  
  // Pipeline banner
  { target: '.sih-pipeline-badge {\n  font-size: 11px;', replace: '.sih-pipeline-badge {\n  font-size: 12px;' },
  { target: '.sih-step-num { font-size: 10px;', replace: '.sih-step-num { font-size: 11px;' },
  { target: '.sih-step-label { font-size: 12px;', replace: '.sih-step-label { font-size: 13px;' },
  { target: '.sih-step-sub { font-size: 10px;', replace: '.sih-step-sub { font-size: 11px;' },
  
  // Cards & spotlight typography
  { target: '.queue-card-evidence-row {\n  font-size: 11.5px;', replace: '.queue-card-evidence-row {\n  font-size: 12.5px;' },
  { target: '.spotlight-cell-label { font-size: 10.5px;', replace: '.spotlight-cell-label { font-size: 11.5px;' },
  { target: '.spotlight-cell-desc { font-size: 11px;', replace: '.spotlight-cell-desc { font-size: 12px;' }
];

let cssChangedCount = 0;
for (const rep of cssReplacements) {
  if (css.includes(rep.target)) {
    css = css.replace(rep.target, rep.replace);
    cssChangedCount++;
  }
}

fs.writeFileSync(path.join(ROOT_DIR, 'style.css'), css, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'frontend', 'style.css'), css, 'utf8');
console.log(`✔ Applied ${cssChangedCount} CSS font size increases to style.css and frontend/style.css`);

// 2. Update index.html inline font-sizes for small text (<15px)
let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

// Mapping for non-heading inline styles:
// 8.5px -> 9.5px
// 9px -> 10px
// 9.5px -> 10.5px
// 10px -> 11px
// 10.5px -> 11.5px
// 11px -> 12px
// 11.5px -> 12.5px
// 12px -> 13px
// 12.5px -> 13.5px
// 13px -> 14px
// 13.5px -> 14px

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

let htmlChangedCount = 0;
// Use regex replacer that avoids modifying heading tags (h1-h6) or heading class elements
html = html.replace(/<([a-zA-Z0-9]+)([^>]*style="[^"]*font-size\s*:\s*([^;"]+)[^"]*"[^>]*)>/gi, (match, tag, attrs, sizeStr) => {
  const t = tag.toLowerCase();
  const trimmedSize = sizeStr.trim();
  
  // Guard 1: Do NOT change heading tags
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(t)) {
    return match;
  }
  
  // Guard 2: Do NOT change heading/title/brand classes
  if (/class="[^"]*(?:page-title|hero-title|card-title|brand|stat-value|disposition-pill)[^"]*"/i.test(attrs)) {
    return match;
  }
  
  // Guard 3: Only replace sizes present in our small text map
  if (fontMap[trimmedSize]) {
    const newSize = fontMap[trimmedSize];
    htmlChangedCount++;
    // Replace font-size: X with font-size: Y within the matched tag
    const updatedAttrs = attrs.replace(new RegExp(`font-size\\s*:\\s*${trimmedSize.replace('.', '\\.')}`, 'i'), `font-size:${newSize}`);
    return `<${tag}${updatedAttrs}>`;
  }
  
  return match;
});

fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'frontend', 'index.html'), html, 'utf8');
console.log(`✔ Applied ${htmlChangedCount} inline font size increases to index.html and frontend/index.html`);
