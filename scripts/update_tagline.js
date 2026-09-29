const fs = require('fs');

function updateTagline(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  const oldTagline = `<div class="home-closing-tagline" style="text-align:center; padding: 40px 20px 20px 20px; color:#64748B;">
          <div style="font-family:var(--font-display); font-size:14px; font-weight:600; color:#123B63; letter-spacing:0.3px; margin-bottom:4px;">
            From qualification telemetry to evidence-driven reliability decisions.
          </div>
          <div style="font-family:var(--font-mono); font-size:11px; color:#94A3B8; letter-spacing:1px; text-transform:uppercase;">
            Observe • Detect • Forecast • Decide
          </div>
        </div>`;

  const newTagline = `<div class="home-closing-tagline" style="text-align:center; padding: 48px 20px 24px 20px; color:#5687AD;">
          <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:#144A75; letter-spacing:-0.3px; margin-bottom:8px;">
            Detect Earlier. Predict Degradation. Qualify with Evidence.
          </div>
          <div style="font-family:var(--font-mono); font-size:14px; font-weight:600; color:#5687AD; letter-spacing:1.5px; text-transform:uppercase;">
            PREDICTA SEMICONDUCTOR RELIABILITY PLATFORM • 168H PROGNOSTIC QUALIFICATION
          </div>
        </div>`;

  if (html.includes('From qualification telemetry to evidence-driven reliability decisions.')) {
    html = html.replace(/<div class="home-closing-tagline"[\s\S]*?<\/div>\s*<\/div>/, newTagline);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Updated tagline in ${filePath}`);
  } else {
    console.warn(`Could not find old tagline in ${filePath}`);
  }
}

updateTagline('index.html');
updateTagline('frontend/index.html');
