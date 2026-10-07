import test from 'node:test';
import assert from 'node:assert/strict';
import { checkExpiryStatus, getExpiryDaysLeft } from './expiryCheck.js';

const today = new Date('2026-10-06T12:00:00');
const dateAfter = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date;
};

test('expiry status includes the full six-month warning window', () => {
  assert.equal(checkExpiryStatus(dateAfter(180), today), 'CAUTION');
  assert.equal(checkExpiryStatus(dateAfter(181), today), 'SAFE');
  assert.equal(checkExpiryStatus(dateAfter(60), today), 'WARNING');
  assert.equal(checkExpiryStatus(dateAfter(30), today), 'CRITICAL');
  assert.equal(checkExpiryStatus(dateAfter(-1), today), 'EXPIRED');
});

test('expiry day calculation uses calendar-day boundaries', () => {
  assert.equal(getExpiryDaysLeft(dateAfter(180), today), 180);
  assert.equal(getExpiryDaysLeft(null, today), null);
  assert.equal(getExpiryDaysLeft('invalid-date', today), null);
});
