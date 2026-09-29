const http = require('http');

http.get('http://localhost:8000/', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Server response status:', res.statusCode);
    console.log('HTML size:', data.length);
    console.log('Has page-home:', data.includes('id="page-home"'));
    console.log('Has page-screening:', data.includes('id="page-screening"'));
    console.log('Has page-monitor:', data.includes('id="page-monitor"'));
    console.log('Has page-components:', data.includes('id="page-components"'));
    console.log('Has page-advanced:', data.includes('id="page-advanced"'));
    console.log('Monitor breadcrumb present?:', data.includes('Live Monitor</span></div>'));
    console.log('Components breadcrumb present?:', data.includes('Components</span></div>'));
    console.log('Identity-only monitor selector option?:', data.includes('<option value="DIE-R20C20">DIE-R20C20 — LOT-SYN-048</option>'));
    console.log('Identity-only components selector option?:', data.includes('<option value="DIE-R20C20">DIE-R20C20 — LOT-SYN-048</option>'));
    console.log('Has comp-vs-lot-svg-box:', data.includes('id="comp-vs-lot-svg-box"'));
    console.log('Has component-identity-dossier-card:', data.includes('id="component-identity-dossier-card"'));
    console.log('Has component-telemetry-stream-card:', data.includes('id="component-telemetry-stream-card"'));
    console.log('Has component-reliability-evidence-card:', data.includes('id="component-reliability-evidence-card"'));
    console.log('Has component-timeline-section:', data.includes('id="component-timeline-section"'));
    console.log('Has component-qualification-efficiency-panel:', data.includes('id="component-qualification-efficiency-panel"'));
    console.log('Has component-investigation-queue-container:', data.includes('id="component-investigation-queue-container"'));
    console.log('Has components-inventory-table:', data.includes('id="components-inventory-table"'));
  });
}).on('error', (err) => {
  console.error('Connection error:', err.message);
});
