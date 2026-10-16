import test from 'node:test';
import assert from 'node:assert/strict';
import { importIssueForm } from './importIssueForm.js';

test('current Excel headings prefill correction fields, including legitimate zeros', () => {
  assert.deepEqual(importIssueForm({ originalRow: { 'Medicine name': 'Example', Manufacturer: 'Company', 'Expiry date': '22/05/2028',
    'Purchase cost per pack (PKR)': 100, 'Units per pack': 10, 'Sale price per unit (PKR)': 0, 'Stock quantity (units)': 0, 'Rack / shelf location': 'A1' } }),
  { name: 'Example', manufacturer: 'Company', expiryDate: '2028-05-22', purchasePrice: 100, unitsPerPack: 10, price: 0, quantity: 0, rackLocation: 'A1' });
});
test('normalized values take priority while blank legacy values fall back to the sheet', () => {
  const form = importIssueForm({ normalizedRow: { name: '', quantity: 0, expiryDate: '2028-05-22T00:00:00.000Z' }, originalRow: { 'Medicine Name': 'Legacy', Quantity: 30, 'Purchase Price': 40 } });
  assert.equal(form.name, 'Legacy'); assert.equal(form.quantity, 0); assert.equal(form.purchasePrice, 40); assert.equal(form.expiryDate, '2028-05-22');
});
