import test from 'node:test';
import assert from 'node:assert/strict';
import { getInventoryPurchaseValue } from './medicinePricing.js';

test('inventory valuation sums each batch cost instead of the medicine default', () => {
  assert.equal(getInventoryPurchaseValue({ quantity: 3, purchasePrice: 10, unitsPerPack: 1,
    batches: [{ quantity: 1, purchaseCost: 10 }, { quantity: 2, purchaseCost: 20 }] }), 50);
});
test('valuation uses remaining batch units, including empty batches', () => {
  assert.equal(getInventoryPurchaseValue({ quantity: 2, purchasePrice: 999,
    batches: [{ quantity: 0, purchaseCost: 100 }, { quantity: 2, purchaseCost: 7.5 }] }), 15);
});
test('legacy medicines without batches use pack cost divided by pack size', () => {
  assert.equal(getInventoryPurchaseValue({ quantity: 3, purchasePrice: 100, unitsPerPack: 10 }), 30);
  assert.equal(getInventoryPurchaseValue({ quantity: 3, purchasePrice: 100, unitsPerPack: 10, batches: [] }), 30);
});
