/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js REST API Server
 * File: src/api/server.js
 */

const http = require('http');
const inferenceService = require('./inference');
const { injectSecurityHeaders, verifyAuthorization, checkRateLimit, sendApiError } = require('./auth');

const PORT = process.env.PORT || 8000;

async function handleApiRequest(req, res) {
  injectSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  let endpointTier = "STANDARD";
  if (req.url && req.url.includes('/secondary-test')) endpointTier = "STRICT";
  else if (req.url && req.url.includes('/predict')) endpointTier = "HIGH";

  const rateRes = checkRateLimit(clientIp, endpointTier);
  if (!rateRes.allowed) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: `TOO_MANY_REQUESTS: Rate limit exceeded. Retry in ${rateRes.retryAfter} seconds.` }));
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

  const traceId = req.headers['x-trace-id'] || `PRED-2026-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  res.setHeader('X-Trace-ID', traceId);

  if (req.method === 'GET' && url === '/api/health') {
    const summary = await inferenceService.getDashboardSummaryAsync().catch(() => ({ persistence_mode: "LOCAL_MEMORY" }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      model: "predicta_final_xgboost",
      version: "2.0_production",
      threshold: inferenceService.operatingThreshold,
      persistence_mode: summary.persistence_mode || "LOCAL_MEMORY",
      subsystems: {
        api_gateway: "ONLINE",
        ml_artifacts: "LOADED",
        database: summary.persistence_mode || "LOCAL_MEMORY",
        auth_guard: "ACTIVE_RBAC"
      }
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
    const record = await inferenceService.getPredictionByTraceIdAsync(queryId);
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
    const data = await inferenceService.getDashboardSummaryAsync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/recent') {
    const data = await inferenceService.getRecentPredictionsAsync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/equipment') {
    const data = await inferenceService.getEquipmentStatsAsync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'GET' && url === '/api/dashboard/risk') {
    const data = await inferenceService.getRiskStatsAsync();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
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
    req.on('end', async () => {
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
        const result = await inferenceService.predictSingleAsync(simulatedRecord);
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
    req.on('end', async () => {
      let record;
      try {
        record = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: "Malformed JSON payload in request body." }));
        return;
      }

      try {
        const result = await inferenceService.predictSingleAsync(record);
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
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const operatorName = payload.operator || authCheck.user.operator;
        const resRec = await inferenceService.requestSecondaryTestAsync(payload.test_id, operatorName, payload.comments);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        const isConflict = err.message.includes("ILLEGAL_TRANSITION") || err.message.includes("already requested");
        const status = isConflict ? 409 : 400;
        const errType = isConflict ? "CONFLICT" : "BAD_REQUEST";
        sendApiError(res, status, errType, err.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/secondary-test/complete') {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const operatorName = payload.operator || authCheck.user.operator;
        const resRec = await inferenceService.completeSecondaryTestAsync(payload.test_id, payload.secondary_result, operatorName, payload.comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        const isConflict = err.message.includes("ILLEGAL_TRANSITION") || err.message.includes("already requested");
        const status = isConflict ? 409 : 400;
        const errType = isConflict ? "CONFLICT" : "BAD_REQUEST";
        sendApiError(res, status, errType, err.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/disposition') {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const operatorName = payload.operator || authCheck.user.operator;
        const resRec = await inferenceService.confirmDispositionAsync(payload.test_id, payload.disposition, operatorName, payload.comments);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resRec));
      } catch (err) {
        const isConflict = err.message.includes("ILLEGAL_TRANSITION") || err.message.includes("Cannot confirm");
        const status = isConflict ? 409 : 400;
        const errType = isConflict ? "CONFLICT" : "BAD_REQUEST";
        sendApiError(res, status, errType, err.message);
      }
    });
    return;
  }

  if (req.method === 'GET' && url.startsWith('/api/prediction/history')) {
    const testId = req.url.split('?test_id=')[1] || '';
    const record = await inferenceService.getPredictionHistoryAsync(testId);
    if (!record) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `History for test_id '${testId}' not found.` }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(record));
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
