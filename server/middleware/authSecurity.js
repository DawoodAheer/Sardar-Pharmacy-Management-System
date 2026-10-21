import { createHash } from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

export function validateAuthFields(req, res, next) {
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
    return res.status(400).json({ message: 'Send an authentication form as an object.' });
  }
  for (const key of ['name', 'email', 'password', 'phone', 'token', 'otp']) {
    if (req.body[key] !== undefined && (typeof req.body[key] !== 'string' || req.body[key].length > (key === 'password' ? 1024 : 512))) {
      return res.status(400).json({ message: `${key} must be valid text.` });
    }
  }
  next();
}

export function createAuthLimits({ windowMs = 15 * 60 * 1000, loginLimit = 20, publicLimit = 200, resetLimit = 10 } = {}) {
  const common = { windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Please wait and try again.' } };
  // Production trusts only the final Nginx hop; it appends the actual peer IP.
  const accountKey = req => `${ipKeyGenerator(req.ip)}:${createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex')}`;
  return {
    public: rateLimit({ ...common, limit: publicLimit }),
    login: rateLimit({ ...common, limit: loginLimit, keyGenerator: accountKey, skipSuccessfulRequests: true }),
    reset: rateLimit({ ...common, limit: resetLimit, keyGenerator: accountKey }),
  };
}
