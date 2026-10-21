import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import helmet from 'helmet';
import { createAuthLimits, validateAuthFields } from './authSecurity.js';

async function withApp(run) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: false }));
  app.use(express.json());
  const limits = createAuthLimits({ loginLimit: 2, publicLimit: 20, windowMs: 1000 });
  app.post('/login', limits.public, validateAuthFields, limits.login, (req, res) => res.status(req.body.password === 'accepted-fixture' ? 200 : 401).json({}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = async (body, headers = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.10', ...headers }, body: JSON.stringify(body),
    });
    await response.json(); return response;
  };
  try { await run(request); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('malformed authentication fields and operator objects return 400', async () => {
  await withApp(async request => {
    for (const body of [[], { email: { $ne: null }, password: 'x' }, { email: 'a', password: ['x'] }, { email: 'x'.repeat(513) }]) {
      assert.equal((await request(body)).status, 400);
    }
  });
});

test('failed login rate limit cannot be evaded by email case or forwarded IP headers', async () => {
  await withApp(async request => {
    assert.equal((await request({ email: ' A@test.local ', password: 'bad' })).status, 401);
    assert.equal((await request({ email: 'a@test.local', password: 'bad' })).status, 401);
    const blocked = await request({ email: 'A@TEST.LOCAL', password: 'bad' }, { 'X-Forwarded-For': '8.8.8.8, 198.51.100.10' });
    assert.equal(blocked.status, 429); assert.ok(blocked.headers.get('retry-after'));
    assert.equal((await request({ email: 'other@test.local', password: 'bad' })).status, 401);
  });
});

test('successful counter logins do not exhaust the failed-login allowance', async () => {
  await withApp(async request => {
    for (let i = 0; i < 4; i++) assert.equal((await request({ email: 'staff@test.local', password: 'accepted-fixture' })).status, 200);
    assert.equal((await request({ email: 'staff@test.local', password: 'bad' })).status, 401);
  });
});

test('API security headers protect responses without forcing HTTPS on offline HTTP', async () => {
  await withApp(async request => {
    const response = await request({ email: 'a', password: 'bad' });
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('strict-transport-security'), null);
  });
});
