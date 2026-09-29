const fs = require('fs');

function cleanHtmlHeroCard(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  html = html.replace(
    /<div class="hero-card"\s+style="[^"]*">/,
    '<div class="hero-card">'
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Cleaned hero-card inline style in ${filePath}`);
}

cleanHtmlHeroCard('index.html');
cleanHtmlHeroCard('frontend/index.html');
