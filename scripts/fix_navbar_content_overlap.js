const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function applyClearance(file) {
  let css = fs.readFileSync(file, 'utf8');

  // Update .main-content padding to account for 64px fixed navbar + 20px clean natural spacing = 84px
  css = css.replace(
    /\.main-content\s*\{[\s\S]*?padding:\s*[^;]+;/i,
    `.main-content {\n  flex: 1;\n  max-width: 1400px;\n  width: 100%;\n  margin: 0 auto;\n  padding: 84px 20px 40px 20px;`
  );

  // Ensure .app-container does not have competing padding
  css = css.replace(
    /\.app-container\s*\{[\s\S]*?padding-top:\s*[^;]+;/i,
    `.app-container {\n  display: flex;\n  flex-direction: column;\n  min-height: 100vh;`
  );

  fs.writeFileSync(file, css, 'utf8');
  console.log('✔ Updated content clearance in:', file);
}

applyClearance(path.join(ROOT_DIR, 'style.css'));
applyClearance(path.join(ROOT_DIR, 'frontend', 'style.css'));
