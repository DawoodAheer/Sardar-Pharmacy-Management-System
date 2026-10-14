import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMedicineImportRow, parseMedicineExpiryDate } from './medicineImport.js';

test('normalizes medicine import fields using the manual-entry names and validates required data', () => {
  const result = normalizeMedicineImportRow({
    'Medicine Name': 'Syrup A', Manufacturer: 'Example', 'Expiry Date': '2028-12-31',
    'Purchase Pack Cost': '200', 'Units Per Pack': '1', 'Sale Price / Unit': '250',
    'Quantity (Units)': '5', 'Reorder Level': '2', Category: 'Other', Barcode: '123', Rack: 'A1',
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.medicine.purchasePrice, 200);
  assert.equal(result.medicine.unitsPerPack, 1);
  assert.equal(result.medicine.quantity, 5);
});

test('reports missing, invalid and non-integer fields without coercing them into valid stock', () => {
  const result = normalizeMedicineImportRow({
    name: '', manufacturer: 'Example', expiryDate: '31/02/2028',
    purchasePrice: -10, unitsPerPack: 5, price: 10, quantity: '2.5',
  });
  assert.equal(result.errors.length, 4);
  assert.ok(result.errors.some(error => error.includes('Stock quantity')));
  assert.equal(result.medicine.quantity, 2.5);
  assert.equal(result.medicine.expiryDate, null);
});

test('invalid supplied numbers are rejected rather than silently replaced', () => {
  const result = normalizeMedicineImportRow({ name: 'Test', purchasePrice: 100, unitsPerPack: 0, quantity: -5, price: 'bad' });
  assert.ok(result.errors.some(error => error.includes('Units per pack')));
  assert.ok(result.errors.some(error => error.includes('Sale price')));
  assert.ok(result.errors.some(error => error.includes('Stock quantity')));
});
test('valid grouped numbers and zero stock are accepted', () => {
  const result = normalizeMedicineImportRow({ name: 'Test', purchasePrice: '1,000.50', unitsPerPack: 10, quantity: 0 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.medicine.purchasePrice, 1000.5);
  assert.equal(result.medicine.price, 100.05);
});

test('parses Excel serial dates and common pharmacy date formats', () => {
  assert.equal(parseMedicineExpiryDate('15/08/25').toISOString().slice(0, 10), '2025-08-15');
  assert.equal(parseMedicineExpiryDate(46923).toISOString().slice(0, 10), '2028-06-19');
  assert.equal(parseMedicineExpiryDate('46923').toISOString().slice(0, 10), '2028-06-19');
});
