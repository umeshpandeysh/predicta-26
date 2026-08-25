/**
 * Predicta Semiconductor Test Analytics — Vercel Serverless Function Handler
 * File: api/index.js
 */

const server = require('../src/api/server');

module.exports = (req, res) => {
  server.emit('request', req, res);
};
