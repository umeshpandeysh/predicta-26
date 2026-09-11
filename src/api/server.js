/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js REST API Server
 * File: src/api/server.js
 */

const http = require('http');
const inferenceService = require('./inference');
const { injectSecurityHeaders, verifyAuthorization, checkRateLimit, sendApiError } = require('./auth');

const PORT = process.env.PORT || 8000;

const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MB Payload Limit

function readRequestBody(req, maxBytes = MAX_PAYLOAD_BYTES) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') {
        return resolve({ body: JSON.stringify(req.body), isTooLarge: false });
      }
      if (typeof req.body === 'string') {
        return resolve({ body: req.body, isTooLarge: req.body.length > maxBytes });
      }
    }

    let state = 'READING';
    let size = 0;
    let resolved = false;
    let timer = null;
    const chunks = [];

    function finish(result) {
      if (resolved) return;
      resolved = true;
      if (timer) clearTimeout(timer);
      cleanup();
      resolve(result);
    }

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('close', onClose);
      req.removeListener('aborted', onAborted);
    }

    function startDraining() {
      if (state === 'DRAINING' || resolved) return;
      state = 'DRAINING';
      req.removeListener('data', onData);
      req.resume();

      const onDrainComplete = () => finish({ body: '', isTooLarge: true });
      req.once('end', onDrainComplete);
      req.once('close', onDrainComplete);
      req.once('aborted', onDrainComplete);
      req.once('error', () => finish({ body: '', isTooLarge: true }));

      timer = setTimeout(() => {
        finish({ body: '', isTooLarge: true });
      }, 2000);
    }

    function onData(chunk) {
      size += chunk.length;
      if (size > maxBytes) {
        state = 'TOO_LARGE';
        return startDraining();
      }
      chunks.push(chunk);
    }

    function onEnd() {
      if (state === 'DRAINING' || resolved) return;
      state = 'REQUEST_END';
      const body = Buffer.concat(chunks).toString('utf-8');
      finish({ body, isTooLarge: false });
    }

    function onError(err) {
      finish({ body: '', isTooLarge: false, error: err ? err.message : 'Stream error' });
    }

    function onClose() {
      if (state === 'DRAINING') {
        finish({ body: '', isTooLarge: true });
      } else if (!resolved) {
        finish({ body: '', isTooLarge: false, error: 'Connection closed' });
      }
    }

    function onAborted() {
      finish({ body: '', isTooLarge: false, error: 'Request aborted' });
    }

    const contentLengthStr = req.headers ? req.headers['content-length'] : null;
    const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : NaN;
    if (!isNaN(contentLength) && contentLength > maxBytes) {
      state = 'TOO_LARGE';
      startDraining();
      return;
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
    req.on('aborted', onAborted);
  });
}

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
      model: "predicta_xgboost_model",
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
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
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
    return;
  }

  if (req.method === 'GET' && (url === '/api/usage' || url === '/api/analysis/usage')) {
    try {
      const usage = await inferenceService.getAnalysisUsageAsync();
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      });
      res.end(JSON.stringify(usage));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: err.message }));
    }
    return;
  }

  if (req.method === 'POST' && (url === '/api/login' || url === '/api/auth/login')) {
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (e) {
      payload = {};
    }
    const userId = (payload.userId || payload.username || '').trim();
    const password = (payload.password || '').trim();

    if (password === 'sih26' && (userId === 'admin' || userId === 'admin@predicta.io' || userId !== '')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        authenticated: true,
        token: "demo_admin_jwt_token_2026",
        user: {
          userId: userId,
          role: "admin"
        }
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        authenticated: false,
        message: "Invalid User ID or Password"
      }));
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/predict') {
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
    let record;
    try {
      record = JSON.parse(body || '{}');
    } catch (e) {
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      const result = await inferenceService.predictSingleAsync(record);
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      });
      res.end(JSON.stringify(result));
    } catch (err) {
      sendApiError(res, 400, "BAD_REQUEST", err.message);
    }
    return;
  }

  if (req.method === 'POST' && (url === '/api/predict/batch' || url === '/api/batch')) {
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
    let payload;
    try {
      payload = JSON.parse(body || '[]');
    } catch (e) {
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      const batchList = Array.isArray(payload) ? payload : (payload && payload.records);
      const result = inferenceService.predictBatch(batchList);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      sendApiError(res, 400, "BAD_REQUEST", err.message);
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/secondary-test/request') {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
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
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/secondary-test/complete') {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
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
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/disposition') {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
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
