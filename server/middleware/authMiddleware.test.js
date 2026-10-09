import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize } from './authMiddleware.js';

const runAuthorization = (role, allowed) => {
  let nextCalled = false;
  let statusCode = 200;
  let payload;
  const req = { user: role ? { role } : null };
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  authorize(...allowed)(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, payload };
};

test('Admin and Pharmacist can access shared staff workflow APIs', () => {
  for (const role of ['superadmin', 'pharmacist']) {
    assert.equal(runAuthorization(role, ['superadmin', 'pharmacist']).nextCalled, true);
  }
});

test('only Admin can access user management APIs', () => {
  assert.equal(runAuthorization('superadmin', ['superadmin']).nextCalled, true);
  const pharmacistAttempt = runAuthorization('pharmacist', ['superadmin']);
  assert.equal(pharmacistAttempt.nextCalled, false);
  assert.equal(pharmacistAttempt.statusCode, 403);
});

test('only Admin can review and approve deletion requests', () => {
  assert.equal(runAuthorization('superadmin', ['superadmin']).nextCalled, true);
  const pharmacistAttempt = runAuthorization('pharmacist', ['superadmin']);
  assert.equal(pharmacistAttempt.nextCalled, false);
  assert.equal(pharmacistAttempt.statusCode, 403);
});

test('only Admin can directly archive medicines; pharmacists use approval requests', () => {
  assert.equal(runAuthorization('superadmin', ['superadmin']).nextCalled, true);
  const pharmacistAttempt = runAuthorization('pharmacist', ['superadmin']);
  assert.equal(pharmacistAttempt.nextCalled, false);
  assert.equal(pharmacistAttempt.statusCode, 403);
});

test('only Admin can view refund and Udhar payment audit feeds', () => {
  assert.equal(runAuthorization('superadmin', ['superadmin']).nextCalled, true);
  const pharmacistAttempt = runAuthorization('pharmacist', ['superadmin']);
  assert.equal(pharmacistAttempt.nextCalled, false);
  assert.equal(pharmacistAttempt.statusCode, 403);
});

test('Admin and Pharmacist can review and resolve medicine import issues', () => {
  for (const role of ['superadmin', 'pharmacist']) {
    assert.equal(runAuthorization(role, ['pharmacist', 'superadmin']).nextCalled, true);
  }
  const customerAttempt = runAuthorization('customer', ['pharmacist', 'superadmin']);
  assert.equal(customerAttempt.nextCalled, false);
  assert.equal(customerAttempt.statusCode, 403);
});
