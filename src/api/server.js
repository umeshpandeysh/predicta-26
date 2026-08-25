/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js REST API Server
 * File: src/api/server.js
 */

const http = require('http');
const inferenceService = require('./inference');

const PORT = process.env.PORT || 8000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      model: "predicta_final_xgboost",
      version: "2.0_production",
      threshold: inferenceService.operatingThreshold
    }));
    return;
  }

  if (req.method === 'POST' && url === '/api/predict') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let record;
      try {
        record = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: "Malformed JSON payload in request body." }));
        return;
      }

      try {
        const result = inferenceService.predictSingle(record);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/predict/batch') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body || '[]');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: "Malformed JSON payload in request body." }));
        return;
      }

      try {
        const batchList = Array.isArray(payload) ? payload : (payload && payload.records);
        const result = inferenceService.predictBatch(batchList);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ detail: "Endpoint not found" }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Predicta ML Inference API Server running at http://localhost:${PORT}`);
  });
}

module.exports = server;
