const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const scriptJs = fs.readFileSync('script.js', 'utf8');

const unwantedPatterns = [
  'Smart India Hackathon 2026',
  'Problem Statement 170',
  'Admin Login',
  'form-admin-login',
  'predicta_op_key_2026',
  'predicta_admin_key_2026'
];

unwantedPatterns.forEach(pat => {
  const inHtml = indexHtml.toLowerCase().includes(pat.toLowerCase());
  const inJs = scriptJs.toLowerCase().includes(pat.toLowerCase());
  console.log(`Pattern '${pat}': in HTML = ${inHtml}, in JS = ${inJs}`);
});
