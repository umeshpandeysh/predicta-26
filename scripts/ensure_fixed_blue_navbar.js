const fs = require('fs');

function applyFixedBlueNavbar(cssPath) {
  if (!fs.existsSync(cssPath)) return;
  let css = fs.readFileSync(cssPath, 'utf8');

  // Replace topnav css
  const topnavCss = `/* Top Navigation Bar — Clean Professional Blue Header (Fixed) */
.topnav {
  background: #1976B8;
  background: linear-gradient(180deg, #1A7BC0 0%, #156CAE 100%);
  color: #FFFFFF;
  border-bottom: 1px solid #125B91;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 1000;
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
  color: #FFFFFF;
  line-height: 1.15;
  text-shadow: 0 1px 2px rgba(18, 59, 99, 0.3);
}

.brand-sub {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.2;
}

.topnav-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(18, 59, 99, 0.28);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
}

.nav-link {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.9);
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
  background: rgba(255, 255, 255, 0.14);
  color: #FFFFFF;
}

.nav-link.active {
  background: #FFFFFF;
  color: #144A75;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(18, 59, 99, 0.25);
}`;

  css = css.replace(/\/\* Top Navigation Bar[\s\S]*?\.nav-link\.active\s*\{[\s\S]*?\}/i, topnavCss);
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log(`Updated blue fixed navbar in ${cssPath}`);
}

applyFixedBlueNavbar('style.css');
applyFixedBlueNavbar('frontend/style.css');
