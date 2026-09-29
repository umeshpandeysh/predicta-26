const fs = require('fs');

function refineCss(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  // Update :root status variables to restrained palette
  css = css.replace(
    /--success:\s*[^;]+;/,
    '--success: #166534;'
  );
  css = css.replace(
    /--success-bg:\s*[^;]+;/,
    '--success-bg: #F0FDF4;'
  );
  css = css.replace(
    /--warning:\s*[^;]+;/,
    '--warning: #92400E;'
  );
  css = css.replace(
    /--warning-bg:\s*[^;]+;/,
    '--warning-bg: #FFFBEB;'
  );
  css = css.replace(
    /--critical:\s*[^;]+;/,
    '--critical: #991B1B;'
  );
  css = css.replace(
    /--critical-bg:\s*[^;]+;/,
    '--critical-bg: #FEF2F2;'
  );

  // Add border variables if missing
  if (!css.includes('--success-border:')) {
    css = css.replace(
      /--success-bg: #F0FDF4;/,
      '--success-bg: #F0FDF4;\n  --success-border: #BBF7D0;'
    );
    css = css.replace(
      /--warning-bg: #FFFBEB;/,
      '--warning-bg: #FFFBEB;\n  --warning-border: #FDE68A;'
    );
    css = css.replace(
      /--critical-bg: #FEF2F2;/,
      '--critical-bg: #FEF2F2;\n  --critical-border: #FECACA;'
    );
  }

  // Update badge styles to include restrained borders
  const badgeSection = `.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
}

.badge.pass,
.badge.success {
  background-color: var(--success-bg);
  color: var(--success);
  border-color: var(--success-border);
}

.badge.monitor,
.badge.warning {
  background-color: var(--warning-bg);
  color: var(--warning);
  border-color: var(--warning-border);
}

.badge.reject,
.badge.critical,
.badge.danger {
  background-color: var(--critical-bg);
  color: var(--critical);
  border-color: var(--critical-border);
}`;

  css = css.replace(
    /\.badge\s*\{[\s\S]*?\.badge\.reject\s*\{[\s\S]*?\}/,
    badgeSection
  );

  // Update disposition-pill-primary to refined restrained engineering styling
  const pillSection = `.disposition-pill-primary.pass {
  background: #F0FDF4;
  color: #166534;
  border: 1.5px solid #BBF7D0;
}

.disposition-pill-primary.monitor {
  background: #FFFBEB;
  color: #92400E;
  border: 1.5px solid #FDE68A;
}

.disposition-pill-primary.reject {
  background: #FEF2F2;
  color: #991B1B;
  border: 1.5px solid #FECACA;
}`;

  css = css.replace(
    /\.disposition-pill-primary\.pass\s*\{[\s\S]*?\.disposition-pill-primary\.reject\s*\{[\s\S]*?\}/,
    pillSection
  );

  // Replace other aggressive color occurrences in CSS
  css = css.replace(/#10B981/g, '#166534');
  css = css.replace(/#059669/g, '#166534');
  css = css.replace(/#16A34A/g, '#166534');
  css = css.replace(/#34D399/g, '#BBF7D0');
  css = css.replace(/#F59E0B/g, '#92400E');
  css = css.replace(/#D97706/g, '#92400E');
  css = css.replace(/#DC2626/g, '#991B1B');
  css = css.replace(/#EF4444/g, '#991B1B');

  fs.writeFileSync(filePath, css, 'utf8');
  console.log(`Refined CSS colors in ${filePath}`);
}

function refineHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Replace non-standard random accent colors (like indigo #6366F1) with technical blue
  html = html.replace(/#6366F1/gi, '#1976B8');

  // 2. Refine status green colors to restrained #166534
  html = html.replace(/color:\s*#059669/gi, 'color: #166534');
  html = html.replace(/color:#059669/gi, 'color:#166534');
  html = html.replace(/background:\s*#ECFDF5/gi, 'background: #F0FDF4');
  html = html.replace(/background:#ECFDF5/gi, 'background:#F0FDF4');

  // 3. Refine status amber colors to restrained #92400E
  html = html.replace(/color:\s*#D97706/gi, 'color: #92400E');
  html = html.replace(/color:#D97706/gi, 'color:#92400E');
  html = html.replace(/color:\s*#F59E0B/gi, 'color: #92400E');
  html = html.replace(/color:#F59E0B/gi, 'color:#92400E');
  html = html.replace(/background:\s*#FEF3C7/gi, 'background: #FFFBEB');
  html = html.replace(/background:#FEF3C7/gi, 'background:#FFFBEB');
  html = html.replace(/background:\s*#FFF3D8/gi, 'background: #FFFBEB');
  html = html.replace(/background:#FFF3D8/gi, 'background:#FFFBEB');
  html = html.replace(/border:1px solid #F0CA6B/gi, 'border:1px solid #FDE68A');

  // 4. Refine status red colors to restrained #991B1B
  html = html.replace(/color:\s*#DC2626/gi, 'color: #991B1B');
  html = html.replace(/color:#DC2626/gi, 'color:#991B1B');
  html = html.replace(/color:\s*#EF4444/gi, 'color: #991B1B');
  html = html.replace(/color:#EF4444/gi, 'color:#991B1B');

  // 5. Refine wafer map dies in Home
  // Monitor dies
  html = html.replace(/fill="#FCD34D"\s+stroke="#D97706"/g, 'fill="#FDE68A" stroke="#B45309"');
  // Reject dies
  html = html.replace(/fill="#DC2626"\s+stroke="#DC2626"/g, 'fill="#FECACA" stroke="#991B1B"');

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Refined HTML colors in ${filePath}`);
}

function refineJs(filePath) {
  if (!fs.existsSync(filePath)) return;
  let js = fs.readFileSync(filePath, 'utf8');

  // Consolidate status colors rendered dynamically
  js = js.replace(/#10B981/g, '#166534');
  js = js.replace(/#059669/g, '#166534');
  js = js.replace(/#16A34A/g, '#166534');
  js = js.replace(/#128A61/g, '#166534');

  js = js.replace(/#F59E0B/g, '#92400E');
  js = js.replace(/#D97706/g, '#92400E');
  js = js.replace(/#C98512/g, '#92400E');
  js = js.replace(/#FFF3D8/g, '#FFFBEB');
  js = js.replace(/#F0CA6B/g, '#FDE68A');

  js = js.replace(/#DC2626/g, '#991B1B');
  js = js.replace(/#EF4444/g, '#991B1B');
  js = js.replace(/#D83D45/g, '#991B1B');

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`Refined JS colors in ${filePath}`);
}

refineCss('style.css');
refineCss('frontend/style.css');
refineHtml('index.html');
refineHtml('frontend/index.html');
refineJs('script.js');
refineJs('frontend/script.js');
