import test from 'node:test';
import assert from 'node:assert/strict';
import Medicine from '../models/Medicine.js';
import { allocateBatches, addBatch, restoreReturnedBatches } from './batchInventory.js';
import { getBillReturnSummary } from './billReturnSummary.js';

const medicine = () => new Medicine({ name: 'Batch test', quantity: 0, purchasePrice: 10, batches: [
  { batchNumber: 'EXPIRED', quantity: 5, purchaseCost: 1, expiryDate: '2000-01-01' },
  { batchNumber: 'LATER', quantity: 5, purchaseCost: 20, expiryDate: '2099-06-01' },
  { batchNumber: 'FIRST', quantity: 3, purchaseCost: 10, expiryDate: '2099-01-01' },
] });
test('sales allocate unexpired lots in expiry order and preserve costs', () => {
  const med = medicine();
  const result = allocateBatches(med, 4);
  assert.deepEqual(result.map(b => [b.batchNumber, b.quantity, b.purchaseCost]), [['FIRST', 3, 10], ['LATER', 1, 20]]);
  assert.equal(med.quantity, 9);
  assert.throws(() => allocateBatches(med, 5), /unexpired stock/);
});
test('partial returns restore the original lot and profit uses remaining lot costs', () => {
  const med = medicine();
  const allocations = allocateBatches(med, 4);
  const item = { medicineId: med._id, quantity: 4, unitPrice: 30, purchasePrice: 12.5, batchAllocations: allocations };
  restoreReturnedBatches(med, [item], 3, 0);
  assert.equal(med.batches.find(b => b.batchNumber === 'FIRST').quantity, 3);
  const summary = getBillReturnSummary({ items: [item], returns: [{ medicineId: med._id, quantityReturned: 3, refundAmount: 90 }], subtotal: 120, total: 120, totalRefunded: 90 });
  assert.equal(summary.netItems[0].netQuantity, 1);
  assert.equal(summary.netItems[0].purchasePrice, 20);
});
test('receipts reject expired stock, duplicate lots and fractional quantities', () => {
  const med = medicine();
  assert.throws(() => addBatch(med, { batchNumber: 'NEW', quantity: 1, purchaseCost: 10, expiryDate: '2000-01-01' }), /unexpired/);
  assert.throws(() => addBatch(med, { batchNumber: 'FIRST', quantity: 1, purchaseCost: 10, expiryDate: '2099-01-01' }), /already exists/);
  assert.throws(() => addBatch(med, { batchNumber: 'NEW', quantity: 1.5, purchaseCost: 10, expiryDate: '2099-01-01' }), /whole units/);
});
