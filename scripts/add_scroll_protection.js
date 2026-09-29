const fs = require('fs');

function addScrollPadding(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  if (!css.includes('scroll-padding-top')) {
    css = css.replace(
      /html, body \{/,
      'html {\n  scroll-padding-top: 84px;\n}\n\nhtml, body {'
    );
  }

  if (!css.includes('scroll-margin-top')) {
    css = css.replace(
      /\.page-view \{/,
      '.page-view {\n  scroll-margin-top: 84px;'
    );
  }

  fs.writeFileSync(filePath, css, 'utf8');
  console.log(`Added scroll protection to ${filePath}`);
}

addScrollPadding('style.css');
addScrollPadding('frontend/style.css');
