import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createMedicineInventoryWorkbook } from './medicineExport.js';
import { extractMedicineWorkbookRows, parseMedicineWorkbook } from './excelImport.js';

test('5,000 medicine rows round-trip without importing the instruction sheet', () => {
  const medicines = Array.from({ length: 5000 }, (_, i) => ({ name: `Workbook test ${i}`, manufacturer: 'Test',
    purchasePrice: 100, unitsPerPack: 10, price: 12.5, quantity: 20, expiryDate: '2099-01-01', rackLocation: 'A1' }));
  const workbook = createMedicineInventoryWorkbook(medicines);
  const parsed = parseMedicineWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  assert.equal(parsed.rows.length, 5000);
  assert.deepEqual(parsed.ignoredSheets, ['Instructions']);
  assert.equal(parsed.rows[4999]['Medicine name'], 'Workbook test 4999');
  assert.equal(parsed.rows[0]['Stock quantity (units)'], 20);
});
test('Excel dates retain their actual day even when formatted as US dates', () => {
  const worksheet = XLSX.utils.aoa_to_sheet([['Medicine Name', 'Purchase Price', 'Expiry Date'], ['Test', 100, 46923]]);
  worksheet.C2.z = 'm/d/yyyy';
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
  const parsed = parseMedicineWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  assert.equal(parsed.rows[0]['Expiry Date'], '2028-06-19');
});
test('workbooks using the 1904 date system are normalized correctly', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Purchase Price', 'Expiry Date'], ['Test', 100, 1]]), 'Medicines');
  workbook.Workbook = { WBProps: { date1904: true } };
  assert.equal(extractMedicineWorkbookRows(workbook).rows[0]['Expiry Date'], '1904-01-02');
});
test('an instruction-only workbook is rejected', () => {
  const workbook = createMedicineInventoryWorkbook([]);
  assert.throws(() => extractMedicineWorkbookRows(workbook), /No medicine rows/);
});
