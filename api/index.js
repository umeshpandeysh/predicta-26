/**
 * Predicta Semiconductor Test Analytics — Vercel Serverless Function Handler
 * File: api/index.js
 */

const { handleApiRequest } = require('../src/api/server');

module.exports = (req, res) => {
  return handleApiRequest(req, res);
};
