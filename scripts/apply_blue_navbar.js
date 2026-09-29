const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Update HTML in index.html and frontend/index.html
function updateNavbarHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  const currentNavRegex = /<header class="topnav">[\s\S]*?<\/header>/i;
  const newNavbarHtml = `<header class="topnav">
      <div class="topnav-container">
        <div class="brand-section" onclick="window.switchPage('page-home')" role="button" tabindex="0">
          <div class="brand-icon-wrap">
            <svg class="brand-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="14" height="14" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="#FFFFFF" stroke-width="1.6"/>
              <path d="M9 9H15V15H9V9Z" fill="#FFFFFF" opacity="0.95"/>
              <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M6 2V5M18 2V5M6 19V22M18 19V22M2 6H5M2 18H5M19 6H22M19 18H22" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="brand-text-block">
            <div class="brand-name">PREDICTA</div>
            <div class="brand-sub">Semiconductor Reliability Workstation</div>
          </div>
        </div>

        <nav class="topnav-menu" id="topnav-menu">
          <button class="nav-link active" data-page="page-home" onclick="window.switchPage('page-home')">Home</button>
          <button class="nav-link" data-page="page-screening" onclick="window.switchPage('page-screening')">Screening</button>
          <button class="nav-link" data-page="page-monitor" onclick="window.switchPage('page-monitor')">Live Monitor</button>
          <button class="nav-link" data-page="page-components" onclick="window.switchPage('page-components')">Components</button>
          <button class="nav-link" data-page="page-advanced" onclick="window.switchPage('page-advanced')">Advanced</button>
        </nav>

        <div class="topnav-spacer"></div>
      </div>
    </header>`;

  html = html.replace(currentNavRegex, newNavbarHtml);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log('✔ Updated navbar HTML in:', filePath);
}

updateNavbarHtml(path.join(ROOT_DIR, 'index.html'));
updateNavbarHtml(path.join(ROOT_DIR, 'frontend', 'index.html'));

// 2. Update CSS in style.css and frontend/style.css
function updateNavbarCss(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');

  const topnavSectionRegex = /\/\* Top Navigation Bar[\s\S]*?\.nav-link\.active\s*\{[\s\S]*?\}/i;
  
  const newTopnavCss = `/* Top Navigation Bar — Clean Professional Blue Header (Fixed/Sticky) */
.topnav {
  background: #1976B8;
  background: linear-gradient(180deg, #1A7BC0 0%, #156CAE 100%);
  color: #FFFFFF;
  border-bottom: 1px solid #125B91;
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  box-shadow: 0 2px 10px rgba(18, 59, 99, 0.18);
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
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.32);
  box-shadow: 0 2px 6px rgba(18, 59, 99, 0.2);
  flex-shrink: 0;
  transition: transform 0.18s ease, background 0.18s ease;
}

.brand-section:hover .brand-icon-wrap {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.24);
}

.brand-text-block {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  line-height: 1.1;
  letter-spacing: 0.6px;
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(18, 59, 99, 0.35);
}

.brand-sub {
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1.2;
  margin-top: 1px;
}

.topnav-menu {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: center;
  background: rgba(18, 59, 99, 0.28);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.topnav-spacer {
  display: flex;
  justify-self: end;
}

.nav-link {
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  padding: 7px 15px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.nav-link:hover {
  color: #FFFFFF;
  background-color: rgba(255, 255, 255, 0.15);
}

.nav-link.active {
  color: #125B91;
  background: #FFFFFF;
  border: 1px solid #FFFFFF;
  box-shadow: 0 2px 6px rgba(18, 59, 99, 0.2);
  font-weight: 600;
}`;

  if (topnavSectionRegex.test(css)) {
    css = css.replace(topnavSectionRegex, newTopnavCss);
  } else {
    console.warn('Regex match not found in CSS');
  }

  fs.writeFileSync(filePath, css, 'utf8');
  console.log('✔ Updated topnav CSS in:', filePath);
}

updateNavbarCss(path.join(ROOT_DIR, 'style.css'));
updateNavbarCss(path.join(ROOT_DIR, 'frontend', 'style.css'));
