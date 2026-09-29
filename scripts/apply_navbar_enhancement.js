const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Update index.html and frontend/index.html navbar structure
function updateNavbarHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  const currentNavRegex = /<header class="topnav">[\s\S]*?<\/header>/i;
  const newNavbarHtml = `<header class="topnav">
      <div class="topnav-container">
        <div class="brand-section" onclick="window.switchPage('page-home')" role="button" tabindex="0">
          <div class="brand-icon-wrap">
            <svg class="brand-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="14" height="14" rx="2.5" fill="#0D2C54" stroke="#38BDF8" stroke-width="1.5"/>
              <path d="M9 9H15V15H9V9Z" fill="#38BDF8" opacity="0.9"/>
              <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6 2V5M18 2V5M6 19V22M18 19V22M2 6H5M2 18H5M19 6H22M19 18H22" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
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
  console.log('✔ Updated navbar in:', filePath);
}

updateNavbarHtml(path.join(ROOT_DIR, 'index.html'));
updateNavbarHtml(path.join(ROOT_DIR, 'frontend', 'index.html'));

// 2. Update style.css and frontend/style.css navbar rules
function updateNavbarCss(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');

  // Replace topnav styles with dark-blue 3D engineering style
  const topnavSectionRegex = /\/\* Top Navigation Bar[\s\S]*?\.nav-link\.active\s*\{[\s\S]*?\}/i;
  
  const newTopnavCss = `/* Top Navigation Bar — Dark Blue 3D Semiconductor Engineering Header */
.topnav {
  background: linear-gradient(180deg, #0e2246 0%, #09172e 60%, #061124 100%);
  color: #F8FAFC;
  border-bottom: 1px solid rgba(56, 189, 248, 0.25);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 4px 20px -2px rgba(3, 10, 22, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 0 rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.topnav::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(90deg, rgba(56, 189, 248, 0.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(56, 189, 248, 0.035) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: 0;
}

.topnav::after {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.4) 30%, rgba(255, 255, 255, 0.6) 50%, rgba(56, 189, 248, 0.4) 70%, transparent 100%);
  pointer-events: none;
  z-index: 1;
  opacity: 0.65;
  animation: topnavLightDrift 10s ease-in-out infinite alternate;
}

@keyframes topnavLightDrift {
  0% { opacity: 0.45; transform: scaleX(0.92); }
  100% { opacity: 0.75; transform: scaleX(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .topnav::after {
    animation: none !important;
    opacity: 0.55 !important;
  }
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
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(13, 36, 68, 0.85) 100%);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.16);
  flex-shrink: 0;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.brand-section:hover .brand-icon-wrap {
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.6);
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
  letter-spacing: 0.8px;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.brand-sub {
  font-family: var(--font-sans);
  font-size: 11.5px;
  color: #94A3B8;
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
  background: rgba(8, 20, 42, 0.5);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(56, 189, 248, 0.15);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.topnav-spacer {
  display: flex;
  justify-self: end;
}

.nav-link {
  background: transparent;
  border: 1px solid transparent;
  color: #CBD5E1;
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
  background-color: rgba(255, 255, 255, 0.08);
}

.nav-link.active {
  color: #FFFFFF;
  background: linear-gradient(180deg, rgba(25, 118, 184, 0.45) 0%, rgba(13, 44, 84, 0.7) 100%);
  border: 1px solid rgba(56, 189, 248, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.25);
  font-weight: 600;
}`;

  if (topnavSectionRegex.test(css)) {
    css = css.replace(topnavSectionRegex, newTopnavCss);
  } else {
    console.warn('Regex match not found, appending/replacing topnav CSS...');
  }

  fs.writeFileSync(filePath, css, 'utf8');
  console.log('✔ Updated topnav CSS in:', filePath);
}

updateNavbarCss(path.join(ROOT_DIR, 'style.css'));
updateNavbarCss(path.join(ROOT_DIR, 'frontend', 'style.css'));
