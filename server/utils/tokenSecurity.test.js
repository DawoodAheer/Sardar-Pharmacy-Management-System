import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, sendRefreshTokenCookie } from './generateToken.js';
import { protect } from '../middleware/authMiddleware.js';

test('new tokens and cookies have bounded lifetimes', () => {
  const access = process.env.JWT_ACCESS_SECRET, refresh = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret'; process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  try {
    const a = jwt.decode(generateAccessToken('user', 'pharmacist'));
    const r = jwt.decode(generateRefreshToken('user'));
    assert.equal(a.exp - a.iat, 900); assert.equal(r.exp - r.iat, 30 * 86400);
    sendRefreshTokenCookie({ cookie: (_name, _value, options) => assert.equal(options.maxAge, 30 * 86400000) }, 'fixture');
  } finally {
    if (access === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = access;
    if (refresh === undefined) delete process.env.JWT_REFRESH_SECRET; else process.env.JWT_REFRESH_SECRET = refresh;
  }
});

test('old long-lived access tokens expire at the enforced age before database lookup', async () => {
  const previous = process.env.JWT_ACCESS_SECRET; process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  try {
    const token = jwt.sign({ id: 'fixture', iat: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_ACCESS_SECRET, { expiresIn: '3650d' });
    let status, body;
    await protect({ headers: { authorization: 'Bearer ' + token } }, { status(value) { status = value; return this; }, json(value) { body = value; } }, () => assert.fail('Old token was accepted'));
    assert.equal(status, 401); assert.equal(body.code, 'TOKEN_EXPIRED');
  } finally { if (previous === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous; }
});
