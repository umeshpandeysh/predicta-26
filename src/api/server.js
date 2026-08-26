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

function handleApiRequest(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Strip trailing slashes and query strings
  let url = (req.url || '/api/health').split('?')[0];
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (url === '/api' || url === '') {
    url = '/api/health';
  }

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

  if (req.method === 'GET' && url === '/api/system/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inferenceService.getSystemStatus()));
    return;
  }

  if (req.method === 'GET' && url.startsWith('/api/prediction/detail')) {
    const queryId = req.url.split('?id=')[1] || req.url.split('?trace_id=')[1] || '';
    const record = inferenceService.getPredictionByTraceId(queryId);
    if (!record) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `Prediction with trace ID / test ID '${queryId}' not found.` }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(record));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/summary') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inferenceService.getDashboardSummary()));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/recent') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inferenceService.getRecentPredictions()));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/equipment') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inferenceService.getEquipmentStats()));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/risk') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(inferenceService.getRiskStats()));
    return;
  }

  if (req.method === 'GET' && url === '/api/ate/status') {
    const ateSim = require('../simulation/ate_simulator');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connection_mode: "SIMULATED_ATE",
      system_status: "SIMULATED_ONLINE",
      disclaimer: "SIMULATED ATE TELEMETRY — FOR DEMO / EVALUATION ONLY",
      equipments: ateSim.getEquipmentStatuses()
    }));
    return;
  }

  if (req.method === 'POST' && url === '/api/ate/simulate') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        payload = {};
      }
      const ateSim = require('../simulation/ate_simulator');
      const scenarioKey = payload.scenario || "NORMAL";
      const simulatedRecord = ateSim.getDemoScenario(scenarioKey);

      try {
        const result = inferenceService.predictSingle(simulatedRecord);
        result.ate_simulation_metadata = {
          connection: "SIMULATED_ATE_ONLINE",
          scenario: scenarioKey,
          lot_id: simulatedRecord.lot_id,
          wafer_id: simulatedRecord.wafer_id,
          die_id: simulatedRecord.die_id,
          disclaimer: "SIMULATED ATE DATA — FOR DEMO / EVALUATION ONLY"
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
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

  if (req.method === 'POST' && url === '/api/prediction/secondary-test/request') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const resRec = inferenceService.requestSecondaryTest(payload.test_id, payload.operator, payload.comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/secondary-test/complete') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const resRec = inferenceService.completeSecondaryTest(payload.test_id, payload.secondary_result, payload.operator, payload.comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/disposition') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const resRec = inferenceService.confirmDisposition(payload.test_id, payload.disposition, payload.operator, payload.comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.startsWith('/api/prediction/history')) {
    const testId = req.url.split('?test_id=')[1] || '';
    const record = inferenceService.predictionStore.find(r => r.test_id === testId);
    if (!record) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `History for test_id '${testId}' not found.` }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ test_id: testId, event_history: record.event_history || [] }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ detail: "Endpoint not found" }));
}

const server = http.createServer(handleApiRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Predicta ML Inference API Server running at http://localhost:${PORT}`);
  });
}

module.exports = server;
module.exports.handleApiRequest = handleApiRequest;
