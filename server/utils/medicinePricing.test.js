import test from 'node:test';
import assert from 'node:assert/strict';
import { getPurchaseCostPerUnit, isValidUnitsPerPack } from './medicinePricing.js';

test('converts a full pack purchase cost into the cost for one sellable unit', () => {
  assert.equal(getPurchaseCostPerUnit(100, 10), 10);
  assert.equal(getPurchaseCostPerUnit(100, 20), 5);
});

test('keeps legacy medicine costs as per-unit costs when pack size is omitted', () => {
  assert.equal(getPurchaseCostPerUnit(100), 100);
});

test('requires a positive whole number of units in each pack', () => {
  assert.equal(isValidUnitsPerPack(10), true);
  assert.equal(isValidUnitsPerPack(0), false);
  assert.equal(isValidUnitsPerPack(2.5), false);
});
