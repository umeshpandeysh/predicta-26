/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js REST API Server
 * File: src/api/server.js
 */

const http = require('http');
const crypto = require('crypto');
const inferenceService = require('./inference');
const { injectSecurityHeaders, verifyAuthorization, checkRateLimit, sendApiError, createJwtToken, getClientIp } = require('./auth');
const { GovernedCounterfactualExplainerJS } = require('../explainability/counterfactual');
const { HumanDispositionManagerJS } = require('../governance/disposition');
const { ReliabilityTwinManagerJS } = require('../reliability_twin/reliability_twin');

const counterfactualExplainer = new GovernedCounterfactualExplainerJS();
const dispositionManager = new HumanDispositionManagerJS();
const twinManager = new ReliabilityTwinManagerJS();

const PORT = process.env.PORT || 8000;

const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MB Payload Limit

function readRequestBody(req, maxBytes = MAX_PAYLOAD_BYTES) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') {
        const serialized = JSON.stringify(req.body);
        return resolve({
          body: serialized,
          isTooLarge: Buffer.byteLength(serialized, 'utf8') > maxBytes
        });
      }
      if (typeof req.body === 'string') {
        return resolve({
          body: req.body,
          isTooLarge: Buffer.byteLength(req.body, 'utf8') > maxBytes
        });
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

  let endpointTier = "STANDARD";
  if (req.url && req.url.includes('/secondary-test')) endpointTier = "STRICT";
  else if (req.url && req.url.includes('/predict')) endpointTier = "HIGH";

  // Pass the complete request so proxy-aware client identity extraction and
  // rate-limit response headers work correctly behind Vercel/reverse proxies.
  const rateRes = checkRateLimit(req, endpointTier, res);
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

  const suppliedTraceId = Array.isArray(req.headers['x-trace-id'])
    ? req.headers['x-trace-id'][0]
    : req.headers['x-trace-id'];
  const traceId = (typeof suppliedTraceId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedTraceId))
    ? suppliedTraceId
    : `PRED-2026-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  res.setHeader('X-Trace-ID', traceId);

  if (req.method === 'GET' && url === '/api/health') {
    const summary = await inferenceService.getDashboardSummaryAsync().catch(() => ({ persistence_mode: "LOCAL_MEMORY" }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      model: "predicta_xgboost_model",
      version: inferenceService.manifest?.release_version || inferenceService.metadata?.model_version || "2.0_production",
      release_version: inferenceService.manifest?.release_version || inferenceService.metadata?.model_version || "2.0_production",
      authoritative_version: inferenceService.manifest?.authoritative_version || inferenceService.metadata?.authoritative_model_version || "4.0.0_authoritative",
      model_version: inferenceService.metadata?.authoritative_model_version || "4.0.0_authoritative",
      feature_schema_version: inferenceService.metadata?.feature_schema_version || "28_features_v2",
      manifest_version: inferenceService.manifest?.manifest_version || inferenceService.manifest?.authoritative_version || "4.0.0",
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
    const query = new URL(req.url || '/api/prediction/detail', 'http://localhost').searchParams;
    const queryId = query.get('id') || query.get('trace_id') || '';
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
    const userId = String(payload.userId || payload.username || '').trim();
    const password = String(payload.password ?? '');

    const expectedUser = process.env.ADMIN_LOGIN_USER;
    const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

    if (!expectedUser || !expectedPassword || !jwtSecret) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        authenticated: false,
        message: "ADMIN_AUTH_NOT_CONFIGURED"
      }));
      return;
    }

    const safeEqual = (a, b) => {
      const aa = Buffer.from(String(a));
      const bb = Buffer.from(String(b));
      return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
    };

    if (safeEqual(userId, expectedUser) && safeEqual(password, expectedPassword)) {
      const { createJwtToken } = require('./auth');
      const token = createJwtToken({ sub: userId, role: "ADMIN" }, jwtSecret, 3600);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        authenticated: true,
        token,
        user: { userId, role: "admin" }
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

  if (req.method === 'POST' && (url === '/api/prediction/secondary-test/request' || url === '/api/prediction/secondary-test/complete')) {
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error_code: "LEGACY_SECONDARY_TEST_PATH_DISABLED",
      detail: "LEGACY_SECONDARY_TEST_PATH_DISABLED: Legacy secondary test path is disabled under Phase 11 Task 3 governance. Use governed Phase 11 evidence registration (/api/dispositions/:trace_id/evidence) and adjudication (/api/dispositions/:trace_id/adjudicate).",
      guidance: "USE_GOVERNED_PHASE_11_EVIDENCE_AND_ADJUDICATION"
    }));
    return;
  }

  if (req.method === 'POST' && url === '/api/prediction/disposition') {
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error_code: "LEGACY_DISPOSITION_PATH_DISABLED",
      detail: "LEGACY_DISPOSITION_PATH_DISABLED: Legacy disposition path is disabled under Phase 11 Task 3 governance. Use governed Phase 11 disposition endpoints (/api/dispositions/:trace_id) for operator feedback, (/api/dispositions/:trace_id/evidence) for evidence, and (/api/dispositions/:trace_id/adjudicate) for outcome evaluation.",
      guidance: "USE_GOVERNED_PHASE_11_EVIDENCE_AND_ADJUDICATION"
    }));
    return;
  }

  if (req.method === 'GET' && url.startsWith('/api/prediction/history')) {
    const testId = new URL(req.url || '/api/prediction/history', 'http://localhost').searchParams.get('test_id') || '';
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

  // --- STAGE 6 TASK 2 GOVERNED EXPLANATIONS & DISPOSITION ENDPOINTS ---
  if (req.method === 'POST' && url === '/api/explanations/counterfactual') {
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
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (e) {
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      if (payload.record !== undefined) {
        const allowedWrapperKeys = new Set(['record', 'target_condition', 'trace_id']);
        for (const k of Object.keys(payload)) {
          if (!allowedWrapperKeys.has(k)) {
            sendApiError(res, 400, "BAD_REQUEST", `UNKNOWN_FEATURE: Unknown request field '${k}' is not permitted in canonical counterfactual schema.`);
            return;
          }
        }
      }
      const record = payload.record || payload;
      const targetCondition = payload.target_condition || "TARGET_PASS";
      const traceIdHeader = res.getHeader ? res.getHeader('X-Trace-ID') : traceId;
      const explanation = counterfactualExplainer.generateCounterfactual(record, targetCondition, traceIdHeader);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      });
      res.end(JSON.stringify(explanation));
    } catch (err) {
      sendApiError(res, 400, "BAD_REQUEST", err.message);
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/dispositions') {
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
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (e) {
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      if (payload.component_id !== undefined && payload.component_id !== null) {
        sendApiError(res, 400, "BAD_REQUEST", "CLIENT_CONTROLLED_IDENTITY_PROHIBITED: Field 'component_id' cannot be provided by client. Component identity is backend-authoritative.");
        return;
      }
      if (payload.lot_id !== undefined && payload.lot_id !== null) {
        sendApiError(res, 400, "BAD_REQUEST", "CLIENT_CONTROLLED_IDENTITY_PROHIBITED: Field 'lot_id' cannot be provided by client. Lot identity is backend-authoritative.");
        return;
      }

      const prohibitedFields = [
        'ml_decision_snapshot', 'ml_decision', 'original_ml_decision', 'decision',
        'probability', 'calibrated_probability', 'raw_probability',
        'model_hash', 'model_hash_at_decision', 'model_id', 'model_id_at_decision',
        'anomaly_score', 'anomaly_score_at_decision', 'anomaly_status',
        'prognostic_output', 'prognostic_output_at_decision', 'prognostics',
        'ground_truth', 'ground_truth_label', 'is_ground_truth'
      ];
      for (const field of prohibitedFields) {
        if (payload[field] !== undefined && payload[field] !== null) {
          sendApiError(res, 400, "BAD_REQUEST", `CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED: Field '${field}' cannot be provided by client. Authoritative ML decision must be retrieved from backend.`);
          return;
        }
      }

      if (payload.require_durable_persistence !== undefined) {
        sendApiError(res, 400, "CLIENT_TAINT_REJECTED", "CLIENT_TAINT_REJECTED: Client is not permitted to supply require_durable_persistence field.");
        return;
      }

      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DEMO === 'true';
      const requireDurable = isTestEnv ? (dispositionManager.supabase ? true : false) : true;

      const operatorName = payload.operator_id || authCheck.operator || "OPERATOR_01";
      const operatorRole = authCheck.role || "OPERATOR";
      const dispRecord = await dispositionManager.recordDispositionAsync({
        trace_id: payload.trace_id,
        disposition: payload.disposition,
        reason_code: payload.reason_code,
        operator_id: operatorName,
        comment: payload.comment || payload.comments,
        operator_role: operatorRole,
        feedback_status: payload.feedback_status || payload.outcome_status || "RECORDED_ONLY",
        require_durable_persistence: requireDurable
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dispRecord));
    } catch (err) {
      const isPersistenceErr = err.message && err.message.startsWith("PERSISTENCE_ERROR");
      const status = err.statusCode || (isPersistenceErr ? 500 : 400);
      const errType = isPersistenceErr ? "PERSISTENCE_ERROR" : (status === 403 ? "FORBIDDEN" : (status === 404 ? "NOT_FOUND" : "BAD_REQUEST"));
      sendApiError(res, status, errType, err.message);
    }
    return;
  }

  if (req.method === 'GET' && url.includes('/governance') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').replace('/governance', '').split('?')[0].trim();
    try {
      const govResult = await dispositionManager.evaluateDispositionGovernanceAsync(queryTraceId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(govResult));
    } catch (err) {
      const isPersistenceErr = err.message && err.message.startsWith("PERSISTENCE_ERROR");
      const status = err.statusCode || (isPersistenceErr ? 500 : 400);
      const errType = isPersistenceErr ? "PERSISTENCE_ERROR" : (status === 404 ? "NOT_FOUND" : "BAD_REQUEST");
      sendApiError(res, status, errType, err.message);
    }
    return;
  }

  if (req.method === 'POST' && url.includes('/evidence') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').replace('/evidence', '').split('?')[0].trim();
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
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      if (payload.require_durable_persistence !== undefined) {
        sendApiError(res, 400, "CLIENT_TAINT_REJECTED", "CLIENT_TAINT_REJECTED: Client is not permitted to supply require_durable_persistence field.");
        return;
      }
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DEMO === 'true';
      const requireDurable = isTestEnv ? (dispositionManager.supabase ? true : false) : true;

      const evidenceRec = await dispositionManager.registerOutcomeEvidenceAsync({
        trace_id: queryTraceId || payload.trace_id,
        disposition_id: payload.disposition_id,
        evidence_type: payload.evidence_type,
        evidence_status: payload.evidence_status,
        evidence_source: payload.evidence_source || "SYSTEM",
        evidence_timestamp: payload.evidence_timestamp,
        recorded_by: authCheck.operator || payload.recorded_by || "OPERATOR_01",
        provenance_metadata: payload.provenance_metadata || {},
        source_record_identifier: payload.source_record_identifier,
        require_durable_persistence: requireDurable
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(evidenceRec));
    } catch (err) {
      const isPersistenceErr = err.message && err.message.startsWith("PERSISTENCE_ERROR");
      const status = err.statusCode || (isPersistenceErr ? 500 : 400);
      const errType = isPersistenceErr ? "PERSISTENCE_ERROR" : (status === 403 ? "FORBIDDEN" : (status === 404 ? "NOT_FOUND" : "BAD_REQUEST"));
      sendApiError(res, status, errType, err.message);
    }
    return;
  }

  if (req.method === 'POST' && url.includes('/adjudicate') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').replace('/adjudicate', '').split('?')[0].trim();
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
      sendApiError(res, 400, "BAD_REQUEST", "Malformed JSON payload in request body.");
      return;
    }

    try {
      if (payload.require_durable_persistence !== undefined) {
        sendApiError(res, 400, "CLIENT_TAINT_REJECTED", "CLIENT_TAINT_REJECTED: Client is not permitted to supply require_durable_persistence field.");
        return;
      }
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DEMO === 'true';
      const requireDurable = isTestEnv ? (dispositionManager.supabase ? true : false) : true;

      const adjudicatorRole = authCheck.role || payload.adjudicator_role || "OPERATOR";
      const adjRec = await dispositionManager.adjudicateOutcomeAsync(queryTraceId || payload.trace_id, {
        adjudicator_identity: authCheck.operator || payload.adjudicator_identity || "ADJUDICATOR_01",
        adjudicator_role: adjudicatorRole,
        proposed_outcome: payload.proposed_outcome,
        rationale: payload.rationale || payload.comment || "",
        require_durable_persistence: requireDurable
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(adjRec));
    } catch (err) {
      const isPersistenceErr = err.message && err.message.startsWith("PERSISTENCE_ERROR");
      const status = err.statusCode || (isPersistenceErr ? 500 : (err.message.includes("UNAUTHORIZED_ROLE") ? 403 : 400));
      const errType = isPersistenceErr ? "PERSISTENCE_ERROR" : (status === 403 ? "FORBIDDEN" : (status === 404 ? "NOT_FOUND" : "BAD_REQUEST"));
      sendApiError(res, status, errType, err.message);
    }
    return;
  }

  if (req.method === 'GET' && url.includes('/adjudication') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').replace('/adjudication', '').split('?')[0].trim();
    const adjRec = await dispositionManager.getAdjudicationAsync(queryTraceId);
    if (!adjRec) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `No adjudication record found for trace_id '${queryTraceId}'.` }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(adjRec));
    return;
  }

  if (req.method === 'GET' && url.includes('/manifest') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').replace('/manifest', '').split('?')[0].trim();
    try {
      const manifestRec = await dispositionManager.generateOfflineEvaluationManifestAsync(queryTraceId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifestRec));
    } catch (err) {
      sendApiError(res, err.statusCode || 400, "BAD_REQUEST", err.message);
    }
    return;
  }

  if (req.method === 'GET' && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').split('?')[0].trim();
    const record = await dispositionManager.getDispositionAsync(queryTraceId);
    if (!record) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `Disposition for trace_id '${queryTraceId}' not found.` }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(record));
    return;
  }

  if (req.method === 'GET' && (url.startsWith('/api/reliability-twin/') || url.startsWith('/api/reliability-twin'))) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }

    let targetId = '';
    if (url.startsWith('/api/reliability-twin/')) {
      targetId = url.replace('/api/reliability-twin/', '').split('?')[0].trim();
    } else {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        targetId = (parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('component_id') || parsedUrl.searchParams.get('trace_id') || '').trim();
      } catch (e) {
        targetId = '';
      }
    }

    if (!targetId) {
      sendApiError(res, 400, "BAD_REQUEST", "INVALID_IDENTIFIER: Reliability twin request requires a component or trace identifier.");
      return;
    }

    try {
      const twin = await twinManager.buildReliabilityTwinAsync(targetId);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      });
      res.end(JSON.stringify(twin));
    } catch (err) {
      const status = err.statusCode || (err.message && err.message.includes("INVALID_IDENTIFIER") ? 400 : 500);
      sendApiError(res, status, "BAD_REQUEST", err.message);
    }
    return;
  }

  if ((req.method === 'PUT' || req.method === 'PATCH') && url.startsWith('/api/dispositions/')) {
    const authCheck = verifyAuthorization(req, "OPERATOR");
    if (!authCheck.authorized) {
      res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: authCheck.error }));
      return;
    }
    const queryTraceId = url.replace('/api/dispositions/', '').split('?')[0].trim();
    const { body, isTooLarge } = await readRequestBody(req, MAX_PAYLOAD_BYTES);
    if (isTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: "PAYLOAD_TOO_LARGE: Request payload exceeds maximum allowable size (1 MB)." }));
      return;
    }
    try {
      const payload = JSON.parse(body || '{}');
      if (payload.require_durable_persistence !== undefined) {
        sendApiError(res, 400, "CLIENT_TAINT_REJECTED", "CLIENT_TAINT_REJECTED: Client is not permitted to supply require_durable_persistence field.");
        return;
      }
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ALLOW_IN_MEMORY_DEMO === 'true';
      const requireDurable = isTestEnv ? (dispositionManager.supabase ? true : false) : true;
      const updatedRec = await dispositionManager.updateFeedbackStatusAsync(
        queryTraceId,
        payload.disposition_id,
        payload.feedback_status || payload.outcome_status,
        authCheck.operator,
        payload.comment || "",
        requireDurable
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updatedRec));
    } catch (err) {
      const isPersistenceErr = err.message && err.message.startsWith("PERSISTENCE_ERROR");
      const status = err.statusCode || (isPersistenceErr ? 500 : 400);
      const errType = isPersistenceErr ? "PERSISTENCE_ERROR" : (status === 404 ? "NOT_FOUND" : "BAD_REQUEST");
      sendApiError(res, status, errType, err.message);
    }
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
