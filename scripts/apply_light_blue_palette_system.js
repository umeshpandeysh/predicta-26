const fs = require('fs');

function updateCssToLightBlue(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  // 1. Update :root variables
  const rootVars = `:root {
  /* PREDICTA Light Blue Engineering Design System */
  --bg-main: #F3F8FD;               /* Very light airy blue page background */
  --bg-topnav: #E2EFF9;             /* Calm light blue header */
  --bg-card: #FFFFFF;               /* Clean white card surface */
  --bg-card-hover: #F2F8FD;         /* Soft light-blue hover surface */
  --bg-surface: #E8F2FA;            /* Light blue section / panel surface */
  --bg-surface-subtle: #F0F6FC;     /* Very soft light blue well surface */
  --bg-input: #FFFFFF;              /* Clean white input surface */
  
  --border-tech: #C5DEF0;           /* Crisp medium-light soft-blue border */
  --border-tech-subtle: #D8EAF6;    /* Very soft light-blue divider */
  --border-tech-highlight: #4B9FD8; /* Active light-medium blue border */
  --border-topnav: #B8D6ED;         /* Light blue header border */
  
  --text-primary: #144A75;          /* Solid clean deep blue heading text */
  --text-secondary: #2B618E;        /* Readable medium-dark blue body text */
  --text-muted: #5687AD;            /* Soft technical blue secondary text */
  --text-subtle: #79A3C2;           /* Subtle blue-gray metadata */
  --text-inverse: #FFFFFF;
  
  --accent: #1E78B8;                /* Clear professional blue action */
  --accent-hover: #17659E;          /* Refined blue hover */
  --accent-light: #EBF4FB;          /* Soft light blue tint */
  --accent-teal: #0284C7;           /* Sky blue highlight */
  
  /* Soft Light Semantic Status Palette */
  --success: #15803D;               /* Soft medium green text */
  --success-bg: #F0FDF4;            /* Soft light green background */
  --success-border: #BBF7D0;        /* Soft green border */
  
  --warning: #92400E;               /* Readable dark amber text */
  --warning-bg: #FFFBEB;            /* Soft light yellow/amber background */
  --warning-border: #FDE68A;        /* Soft amber border */
  
  --critical: #991B1B;              /* Readable red text */
  --critical-bg: #FEF2F2;           /* Soft light red background */
  --critical-border: #FECACA;        /* Soft red border */
  
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Inter', system-ui, -apple-system, sans-serif;
  
  --shadow-sm: 0 1px 3px 0 rgba(20, 74, 117, 0.05);
  --shadow-md: 0 3px 8px -1px rgba(20, 74, 117, 0.08);
}`;

  css = css.replace(/:root\s*\{[\s\S]*?--shadow-md:[^;]+;\s*\}/, rootVars);

  // 2. Update Top Navigation Bar to Light Blue styling
  const topnavCss = `/* Top Navigation Bar — Calm Light Blue Header (Fixed) */
.topnav {
  background: #E2EFF9;
  background: linear-gradient(180deg, #E8F4FC 0%, #DBECF8 100%);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-topnav);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 1000;
  box-shadow: 0 1px 4px rgba(20, 74, 117, 0.06);
}

.topnav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 2;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  justify-self: start;
  user-select: none;
}

.brand-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #FFFFFF;
  border: 1px solid var(--border-tech);
  box-shadow: 0 1px 3px rgba(20, 74, 117, 0.08);
  flex-shrink: 0;
  transition: transform 0.18s ease, background 0.18s ease;
}

.brand-section:hover .brand-icon-wrap {
  transform: translateY(-1px);
  background: #F0F6FC;
}

.brand-icon {
  display: block;
}

.brand-text-block {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 1.2px;
  color: #144A75;
  line-height: 1.15;
}

.brand-sub {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: #5687AD;
  line-height: 1.2;
}

.topnav-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(197, 222, 240, 0.5);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-tech);
}

.nav-link {
  background: transparent;
  border: 1px solid transparent;
  color: #2B618E;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.7);
  color: #144A75;
}

.nav-link.active {
  background: #FFFFFF;
  color: #144A75;
  font-weight: 700;
  border-color: var(--border-tech);
  box-shadow: 0 1px 4px rgba(20, 74, 117, 0.1);
}`;

  css = css.replace(/\/\* Top Navigation Bar[\s\S]*?\.nav-link\.active\s*\{[\s\S]*?\}/i, topnavCss);

  // 3. Update Hero Card background with subtle living light-blue depth
  const heroCardCss = `.hero-card {
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 128px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: var(--bg-surface);
  background: radial-gradient(circle at 75% 45%, rgba(186, 230, 253, 0.45) 0%, rgba(230, 242, 251, 0.75) 50%, #E4EFF9 100%),
              linear-gradient(135deg, #EBF5FC 0%, #E0EFF8 50%, #E7F3FA 100%);
  background-size: 140% 140%;
  border: 1px solid var(--border-tech);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  padding: 40px 36px;
  margin-bottom: 28px;
  box-shadow: var(--shadow-sm);
  animation: heroBgDepthShift 12s ease-in-out infinite alternate;
}`;

  css = css.replace(/\.hero-card\s*\{[\s\S]*?animation:\s*heroBgDepthShift[^;]+;\s*\}/, heroCardCss);

  // 4. Update table th headers to soft light blue
  css = css.replace(
    /\.aips-table th\s*\{[\s\S]*?background-color:\s*[^;]+;/,
    `.aips-table th {\n  background-color: #E8F2FA;`
  );

  fs.writeFileSync(filePath, css, 'utf8');
  console.log(`Updated CSS in ${filePath}`);
}

function updateHtmlToLightBlue(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Update Brand Icon SVG paths inside navbar to use clean professional blue #1976B8
  const oldBrandIconWrap = `<div class="brand-icon-wrap">
            <svg class="brand-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="14" height="14" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="#FFFFFF" stroke-width="1.6"/>
              <path d="M9 9H15V15H9V9Z" fill="#FFFFFF" opacity="0.95"/>
              <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M6 2V5M18 2V5M6 19V22M18 19V22M2 6H5M2 18H5M19 6H22M19 18H22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </div>`;

  const newBrandIconWrap = `<div class="brand-icon-wrap">
            <svg class="brand-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="14" height="14" rx="2.5" fill="#E6F2FA" stroke="#1E78B8" stroke-width="1.6"/>
              <path d="M9 9H15V15H9V9Z" fill="#1E78B8" opacity="0.95"/>
              <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#1E78B8" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M6 2V5M18 2V5M6 19V22M18 19V22M2 6H5M2 18H5M19 6H22M19 18H22" stroke="#1E78B8" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </div>`;

  html = html.replace(oldBrandIconWrap, newBrandIconWrap);

  // Reconcile any remaining legacy border colors to #C5DEF0 or #B8D6ED
  html = html.replace(/#C8DEEE/gi, '#C5DEF0');
  html = html.replace(/#D8E5EF/gi, '#D8EAF6');
  html = html.replace(/#B8D5EB/gi, '#B8D6ED');

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Updated HTML in ${filePath}`);
}

updateCssToLightBlue('style.css');
updateCssToLightBlue('frontend/style.css');
updateHtmlToLightBlue('index.html');
updateHtmlToLightBlue('frontend/index.html');
