const fs = require('fs');

function updateHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Update Title Size and prominence
  html = html.replace(
    /<h1 class="page-title"[^>]*>Predictive Semiconductor<br>Qualification Intelligence<\/h1>/,
    `<h1 class="page-title" style="font-size: 36px; color: #144A75; margin-bottom: 14px; font-weight: 800; line-height: 1.2; letter-spacing: -0.5px;">Predictive Semiconductor<br>Qualification Intelligence</h1>`
  );

  // 2. Update SVG width & height for larger chip (from 240x150 to 340x222)
  html = html.replace(
    /<svg width="240" height="150" viewBox="0 0 260 170"/,
    `<svg width="340" height="222" viewBox="0 0 260 170"`
  );

  // 3. Remove the 3 Feature Callouts below the chip (Detect Early, Predict Drift, Governed Decision)
  const calloutsRegex = /\s*<!-- 3 Feature Callouts -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- 2\. ACTIVE WAFER/;
  if (calloutsRegex.test(html)) {
    html = html.replace(
      calloutsRegex,
      `
            </div>
          </div>
        </div>

        <!-- 2. ACTIVE WAFER`
    );
  } else {
    console.warn(`Callouts regex did not match in ${filePath}`);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Updated HTML in ${filePath}`);
}

function updateCss(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  // 1. Update .hero-card background with subtle living depth gradient and shift
  const heroCardRegex = /\.hero-card\s*\{[\s\S]*?box-shadow:\s*var\(--shadow-sm\);\s*\}/;
  const newHeroCardCss = `.hero-card {
  position: relative;
  overflow: hidden;
  background-color: var(--bg-surface);
  background: radial-gradient(circle at 75% 45%, rgba(186, 230, 253, 0.45) 0%, rgba(230, 241, 250, 0.75) 50%, #E6F1FA 100%),
              linear-gradient(135deg, #EBF4FB 0%, #E2EEF8 50%, #E8F3FA 100%);
  background-size: 140% 140%;
  border: 1px solid var(--border-tech);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  padding: 32px 28px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  animation: heroBgDepthShift 12s ease-in-out infinite alternate;
}`;
  css = css.replace(heroCardRegex, newHeroCardCss);

  // 2. Update the Hero Chip section at bottom of CSS
  const heroChipSectionRegex = /\/\* ─── HERO CHIP CENTERING & SUBTLE FLOATING MOTION ─── \*\/[\s\S]*$/;
  const newHeroChipCss = `/* ─── HERO CHIP CENTERING & SUBTLE FLOATING MOTION ─── */
@keyframes heroBgDepthShift {
  0% {
    background-position: 0% 40%;
  }
  50% {
    background-position: 100% 60%;
  }
  100% {
    background-position: 0% 40%;
  }
}

.hero-chip-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.hero-chip-illustration-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin: 0 auto;
  text-align: center;
}

.hero-chip-svg-wrap {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 340px;
  height: auto;
  overflow: visible;
}

@keyframes heroChipFloating {
  0% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-9px) rotate(0.8deg);
  }
  100% {
    transform: translateY(0px) rotate(0deg);
  }
}

@keyframes heroChipShadow {
  0% {
    transform: scale(1);
    opacity: 0.18;
  }
  50% {
    transform: scale(0.91) translateY(4px);
    opacity: 0.11;
  }
  100% {
    transform: scale(1);
    opacity: 0.18;
  }
}

.hero-chip-floating-group {
  animation: heroChipFloating 5.5s ease-in-out infinite;
  transform-origin: 130px 90px;
  will-change: transform;
}

.hero-chip-shadow {
  animation: heroChipShadow 5.5s ease-in-out infinite;
  transform-origin: 130px 148px;
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .hero-card {
    animation: none !important;
    background-position: 0% 0% !important;
  }
  .hero-chip-floating-group,
  .hero-chip-shadow {
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 768px) {
  .hero-chip-card {
    margin-top: 20px;
  }
  .hero-chip-svg-wrap {
    max-width: 260px;
  }
  .page-title {
    font-size: 28px !important;
  }
}
`;
  css = css.replace(heroChipSectionRegex, newHeroChipCss);

  fs.writeFileSync(filePath, css, 'utf8');
  console.log(`Updated CSS in ${filePath}`);
}

updateHtml('index.html');
updateHtml('frontend/index.html');
updateCss('style.css');
updateCss('frontend/style.css');
