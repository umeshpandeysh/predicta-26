/**
 * PREDICTA SIH 2026 — Data Validation & Lineage Engine
 * File: src/data/validator.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function validateDatasetHash(filePath, expectedSha256) {
  if (!fs.existsSync(filePath)) {
    return { passed: false, error: `Dataset file not found: ${filePath}` };
  }
  const actualHash = computeFileSha256(filePath);
  if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
    return {
      passed: false,
      error: `Hash mismatch! Expected ${expectedSha256}, got ${actualHash}`,
      actualHash,
      expectedSha256
    };
  }
  return { passed: true, hash: actualHash };
}

function validateTemporalLeakage(featureNames, forbiddenTokens = ['168', '96', '48', 'future', 'ground_truth', 'post_burn_in', 'state_168', 'result_168', 'target']) {
  const violating = [];
  for (const f of featureNames) {
    const fLower = f.toLowerCase();
    for (const token of forbiddenTokens) {
      if (fLower.includes(token)) {
        violating.push({ feature: f, token });
      }
    }
  }
  if (violating.length > 0) {
    return {
      passed: false,
      error: `Temporal leakage detected in features: ${JSON.stringify(violating)}`,
      violating
    };
  }
  return { passed: true };
}

function validateSplitDisjointness(trainIds, valIds, testIds) {
  const trainSet = new Set(trainIds);
  const valSet = new Set(valIds);
  const testSet = new Set(testIds);

  const errors = [];
  for (const id of valSet) {
    if (trainSet.has(id)) {
      errors.push(`Train & Val overlap: ${id}`);
    }
  }
  for (const id of testSet) {
    if (trainSet.has(id)) {
      errors.push(`Train & Test overlap: ${id}`);
    }
    if (valSet.has(id)) {
      errors.push(`Val & Test overlap: ${id}`);
    }
  }

  if (errors.length > 0) {
    return { passed: false, error: errors.join('; '), details: errors };
  }
  return { passed: true };
}

module.exports = {
  computeFileSha256,
  validateDatasetHash,
  validateTemporalLeakage,
  validateSplitDisjointness
};
