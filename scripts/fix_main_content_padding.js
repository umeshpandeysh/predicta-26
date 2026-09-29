const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function fixMainPadding(htmlFile, cssFile) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  html = html.replace(
    /id="main-content"\s*style="[^"]*"/i,
    'id="main-content" style="max-width:1400px; margin:0 auto; padding:84px 20px 40px 20px; width:100%;"'
  );
  fs.writeFileSync(htmlFile, html, 'utf8');
  console.log('✔ Updated inline padding in:', htmlFile);

  let css = fs.readFileSync(cssFile, 'utf8');
  css = css.replace(
    /\.main-content\s*\{[\s\S]*?padding:\s*[^;]+;/i,
    '.main-content {\n  flex: 1;\n  max-width: 1400px;\n  width: 100%;\n  margin: 0 auto;\n  padding: 84px 20px 40px 20px !important;'
  );
  fs.writeFileSync(cssFile, css, 'utf8');
  console.log('✔ Updated CSS padding in:', cssFile);
}

fixMainPadding(path.join(ROOT_DIR, 'index.html'), path.join(ROOT_DIR, 'style.css'));
fixMainPadding(path.join(ROOT_DIR, 'frontend', 'index.html'), path.join(ROOT_DIR, 'frontend', 'style.css'));
