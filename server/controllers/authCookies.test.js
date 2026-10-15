import test from 'node:test';
import assert from 'node:assert/strict';
import { logoutUser, forgotPassword, resetPassword } from './authController.js';

test('offline public recovery never exposes reset secrets or accepts previously issued codes', async () => {
  const previous = process.env.OFFLINE_MODE;
  process.env.OFFLINE_MODE = 'true';
  try {
    for (const handler of [forgotPassword, resetPassword]) {
      let status, body;
      const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
      await handler({ body: { email: 'admin@example.test', code: '123456' }, params: {} }, res, error => { throw error; });
      assert.equal(status, 503); assert.equal(body.success, false);
      assert.equal(body.offlineInfo, undefined); assert.equal(body.token, undefined); assert.equal(body.code, undefined);
    }
  } finally { if (previous === undefined) delete process.env.OFFLINE_MODE; else process.env.OFFLINE_MODE = previous; }
});
import { sendRefreshTokenCookie } from '../utils/generateToken.js';

for (const secure of ['false', 'true']) {
  test(`production logout clears refresh cookies using COOKIE_SECURE=${secure}`, async () => {
    const originalMode = process.env.NODE_ENV, originalSecure = process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production'; process.env.COOKIE_SECURE = secure;
    const cookies = [];
    const response = { cookie: (name, value, options) => cookies.push({ name, value, options }), status() { return this; }, json() {} };
    try {
      sendRefreshTokenCookie(response, 'test-token');
      await logoutUser({}, response, error => { throw error; });
      assert.equal(cookies[0].options.secure, secure === 'true');
      assert.equal(cookies[1].options.secure, cookies[0].options.secure);
      assert.equal(cookies[1].options.path, cookies[0].options.path);
      assert.equal(cookies[1].options.sameSite, cookies[0].options.sameSite);
      assert.equal(cookies[1].options.expires.getTime(), 0);
    } finally {
      if (originalMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalMode;
      if (originalSecure === undefined) delete process.env.COOKIE_SECURE; else process.env.COOKIE_SECURE = originalSecure;
    }
  });
}
