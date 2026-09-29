const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Update style.css color palette
function updateStyleCssColors(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');

  // Replace :root variables with comprehensive light technical blue palette
  const rootRegex = /:root\s*\{[\s\S]*?\}/;
  const newRoot = `:root {
  /* PREDICTA Light Technical Blue Design System */
  --bg-main: #F0F6FC;               /* Clean airy light ice-blue workspace */
  --bg-topnav: #1976B8;             /* Clean professional blue header */
  --bg-card: #FFFFFF;               /* Clean white card surface */
  --bg-card-hover: #F2F7FD;          /* Soft light-blue hover surface */
  --bg-surface: #E6F1FA;            /* Soft technical blue container surface */
  --bg-input: #FFFFFF;              /* Clean input surface */
  
  --border-tech: #C8DEEE;           /* Crisp medium soft-blue border */
  --border-tech-highlight: #4B94C8; /* Active medium blue border */
  
  --text-primary: #144A75;          /* Solid clean blue heading text */
  --text-secondary: #2D6491;        /* Readable medium blue body text */
  --text-muted: #5687AD;            /* Soft technical blue secondary text */
  --text-inverse: #FFFFFF;
  
  --accent: #1976B8;                /* Primary action blue */
  --accent-hover: #1565C0;          /* Deep action blue hover */
  --accent-light: #EBF4FB;          /* Soft blue tint */
  --accent-teal: #0284C7;           /* Sky blue secondary highlight */
  
  /* Status colors — Preserved for unambiguous QA risk meaning */
  --success: #16A34A;
  --success-bg: rgba(22, 163, 74, 0.09);
  --warning: #D97706;
  --warning-bg: rgba(217, 119, 6, 0.09);
  --critical: #DC2626;
  --critical-bg: rgba(220, 38, 38, 0.09);
  
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Outfit', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --shadow-sm: 0 1px 3px 0 rgba(20, 74, 117, 0.06);
  --shadow-md: 0 3px 8px -1px rgba(20, 74, 117, 0.09);
}`;

  css = css.replace(rootRegex, newRoot);

  // Update specific CSS color rules to blue palette
  // Replace remaining hardcoded darks or grays with appropriate blue shades
  css = css.replace(/#123B63/g, '#144A75');  // Old navy -> clean blue heading
  css = css.replace(/#475569/g, '#2D6491');  // Old dark slate -> readable medium blue
  css = css.replace(/#64748B/g, '#5687AD');  // Old muted slate -> technical blue muted
  css = css.replace(/#334155/g, '#1D5582');  // Old dark gray -> rich blue
  css = css.replace(/#D8E5EF/g, '#C8DEEE');  // Old gray-blue border -> clean blue border
  css = css.replace(/#F5F9FD/g, '#F0F6FC');  // Old bg -> fresh light blue
  css = css.replace(/#EAF4FB/g, '#E6F1FA');  // Old surface -> soft blue
  css = css.replace(/#0F8B8D/g, '#0284C7');  // Old teal -> sky blue
  css = css.replace(/#CBD5E1/g, '#B8D5EB');  // Old slate border -> medium soft blue border

  fs.writeFileSync(filePath, css, 'utf8');
  console.log('✔ Updated CSS color system in:', filePath);
}

updateStyleCssColors(path.join(ROOT_DIR, 'style.css'));
updateStyleCssColors(path.join(ROOT_DIR, 'frontend', 'style.css'));

// 2. Update index.html inline style colors to the blue palette
function updateIndexHtmlColors(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // Exact color mapping across all inline styles
  // Headings & strong labels: #123B63 -> #144A75 (clean blue)
  html = html.replace(/#123B63/g, '#144A75');
  html = html.replace(/#0F172A/g, '#144A75');
  html = html.replace(/#020617/g, '#144A75');
  html = html.replace(/#1E293B/g, '#165282');
  html = html.replace(/#1E3A8A/g, '#165282');
  html = html.replace(/#172554/g, '#144A75');
  html = html.replace(/#091428/g, '#165282');
  html = html.replace(/#0B1329/g, '#165282');

  // Body & description text: #475569 -> #2D6491 (readable medium blue)
  html = html.replace(/#475569/g, '#2D6491');
  html = html.replace(/#334155/g, '#1D5582');

  // Muted & secondary labels: #64748B -> #5687AD (technical blue muted)
  html = html.replace(/#64748B/g, '#5687AD');
  html = html.replace(/#94A3B8/g, '#5687AD');

  // Borders & Dividers: #D8E5EF, #CBD5E1, #E2E8F0 -> #C8DEEE (clean medium blue border)
  html = html.replace(/#D8E5EF/g, '#C8DEEE');
  html = html.replace(/#CBD5E1/g, '#B8D5EB');
  html = html.replace(/#E2E8F0/g, '#C8DEEE');

  // Background surfaces: #F5F9FD, #F1F5F9 -> #F0F6FC (airy light blue)
  html = html.replace(/#F5F9FD/g, '#F0F6FC');
  html = html.replace(/#F1F5F9/g, '#EBF4FB');
  html = html.replace(/#EAF4FB/g, '#E6F1FA');
  html = html.replace(/#0F8B8D/g, '#0284C7');

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('✔ Updated HTML inline colors in:', filePath);
}

updateIndexHtmlColors(path.join(ROOT_DIR, 'index.html'));
updateIndexHtmlColors(path.join(ROOT_DIR, 'frontend', 'index.html'));
