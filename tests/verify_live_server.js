const http = require('http');

http.get('http://localhost:8000', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Content-Length:', body.length);
    console.log('Contains 8 stages:', body.includes('id="pipe-input-status"') && body.includes('id="pipe-trace-status"'));
    console.log('Contains Feature Derivation Banner:', body.includes('Derivation Pipeline:'));
    console.log('Contains Admin Login Purged:', !body.includes('Admin Login') && !body.includes('form-admin-login'));
    console.log('Contains SIH Hero Purged:', !body.includes('Smart India Hackathon 2026') && !body.includes('Problem Statement 170'));
    console.log('Contains 6 Distinct Pages:', 
      body.includes('data-page="page-home"') && 
      body.includes('data-page="page-screening"') && 
      body.includes('data-page="page-overview"') && 
      body.includes('data-page="page-component"') && 
      body.includes('data-page="page-judge-journey"') && 
      body.includes('data-page="page-advanced"')
    );
    console.log('Contains Reliability Passport Modal:', body.includes('id="component-passport-modal"'));
    console.log('Contains Compact 8-Input Screening:', 
      body.includes('id="adm-in-temp"') && 
      body.includes('id="adm-in-voltage"') && 
      body.includes('id="adm-in-leakage"') &&
      body.includes('id="adm-in-tpd"') &&
      body.includes('id="adm-in-iddq"') &&
      body.includes('id="adm-in-freq"') &&
      body.includes('id="adm-in-power"')
    );
    console.log('Contains Prominent CSV Intake:', body.includes('id="csv-upload-zone"') && body.includes('id="csv-file-input"'));
  });
}).on('error', (e) => {
  console.error('Server GET Error:', e.message);
  process.exit(1);
});
