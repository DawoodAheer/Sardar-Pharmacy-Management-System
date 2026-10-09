import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import MedicineImportIssue from './MedicineImportIssue.js';

test('invalid medicine import rows remain pending with their source row and correction data', () => {
  const issue = new MedicineImportIssue({
    sourceFile: 'stock.xlsx', rowNumber: 4, originalRow: { 'Medicine Name': 'Example' },
    normalizedRow: { name: 'Example', quantity: null }, validationErrors: ['Stock quantity is invalid.'],
    createdBy: new mongoose.Types.ObjectId(),
  });
  assert.equal(issue.status, 'pending');
  assert.equal(issue.rowNumber, 4);
  assert.equal(issue.originalRow['Medicine Name'], 'Example');
  assert.equal(issue.validateSync(), undefined);
});

test('import review model only accepts pending or resolved states', () => {
  const issue = new MedicineImportIssue({
    rowNumber: 2, originalRow: {}, status: 'approved', createdBy: new mongoose.Types.ObjectId(),
  });
  assert.ok(issue.validateSync().errors.status);
});
