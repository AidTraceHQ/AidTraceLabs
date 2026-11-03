import assert from 'node:assert/strict';
import { app } from '../server/app.js';
import request from 'supertest';

const healthResponse = await request(app).get('/api/_healthcheck');
assert.equal(healthResponse.status, 200, `Health check should return 200, got ${healthResponse.status}`);
assert.equal(healthResponse.body.ok, true, 'Health check payload should indicate the API is ready.');

const transparencyResponse = await request(app).get('/api/transparency').query({ limit: 1 });
assert.equal(
  transparencyResponse.status,
  200,
  `Transparency route should return 200, got ${transparencyResponse.status}: ${JSON.stringify(transparencyResponse.body)}`,
);

console.log('Smoke test passed: /api/_healthcheck and /api/transparency?limit=1 both returned HTTP 200.');
