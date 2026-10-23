import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-to-pass-32-chars';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const { default: app } = await import('../src/app.js');
test('health endpoint returns only service status', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200); assert.deepEqual(response.body, { status: 'ok' });
});
test('authentication endpoints validate input and do not leak account details', async () => {
  const invalid = await request(app).post('/api/auth/register').send({ name: 'x', email: 'bad', password: 'tiny' });
  assert.equal(invalid.status, 400); assert.ok(invalid.body.error);
  const invalidLogin = await request(app).post('/api/auth/login').send({ email: 'bad', password: 'x' });
  assert.equal(invalidLogin.status, 401); assert.equal(invalidLogin.body.error, 'Email or password is incorrect.');
});
test('private history and redaction require authentication', async () => {
  assert.equal((await request(app).get('/api/history')).status, 401);
  assert.equal((await request(app).get('/api/redact/history')).status, 401);
  assert.equal((await request(app).post('/api/redact')).status, 401);
});
test('a valid token reaches the user-scoped history handler', async () => {
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { expiresIn: '1m' });
  const response = await request(app).get('/api/history').set('Authorization', `Bearer ${token}`);
  assert.notEqual(response.status, 401);
  assert.equal(response.status, 500, 'without MongoDB test context the database query fails safely');
  assert.equal(response.body.error, 'Something went wrong. Please try again.');
});
test('CORS rejects unconfigured browser origins', async () => {
  const response = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
  assert.equal(response.status, 500); assert.equal(response.headers['access-control-allow-origin'], undefined);
});
