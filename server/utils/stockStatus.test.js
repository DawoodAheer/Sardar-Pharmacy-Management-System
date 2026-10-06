import test from 'node:test';
import assert from 'node:assert/strict';
import { getStockStatus } from './stockStatus.js';

test('stock labels use the requested quantity ranges', () => {
  assert.equal(getStockStatus(0), 'End Stock');
  assert.equal(getStockStatus(1), 'Low Stock');
  assert.equal(getStockStatus(4), 'Low Stock');
  assert.equal(getStockStatus(5), 'Stock Available');
  assert.equal(getStockStatus(20), 'Stock Available');
  assert.equal(getStockStatus(21), 'High Stock');
});
