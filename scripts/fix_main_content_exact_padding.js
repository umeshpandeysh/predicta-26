const fs = require('fs');

function fixMainContentPadding(filePath, isHtml) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (isHtml) {
    content = content.replace(
      /<main class="main-content" id="main-content"[^>]*>/,
      '<main class="main-content" id="main-content" style="max-width:1400px; margin:0 auto; padding:84px 20px 40px 20px; width:100%;">'
    );
  } else {
    content = content.replace(
      /\.main-content\s*\{[\s\S]*?padding:\s*[^;]+;\s*\}/,
      `.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 84px 20px 40px 20px;
}`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated main-content padding in ${filePath}`);
}

fixMainContentPadding('style.css', false);
fixMainContentPadding('frontend/style.css', false);
fixMainContentPadding('index.html', true);
fixMainContentPadding('frontend/index.html', true);
