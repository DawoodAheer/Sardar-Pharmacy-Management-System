import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createMedicineInventoryWorkbook, MEDICINE_IMPORT_COLUMNS } from './medicineExport.js';

test('exports every supplied medicine with import-compatible columns and exact numeric values', () => {
  const medicines = Array.from({ length: 50 }, (_, index) => ({
    name: `Medicine ${index + 1}`, manufacturer: 'Example Pharma',
    expiryDate: '2028-06-30T00:00:00.000Z', purchasePrice: 133.45, unitsPerPack: 10,
    price: 150.75, quantity: index, rackLocation: `R-${index}`,
  }));
  const workbook = createMedicineInventoryWorkbook(medicines);
  assert.equal(workbook.SheetNames[0], 'Medicines');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true });
  assert.deepEqual(rows[0], MEDICINE_IMPORT_COLUMNS);
  assert.equal(rows.length, 51);
  assert.deepEqual(rows[1], [
    'Medicine 1', 'Example Pharma', '2028-06-30', 133.45, 10, 150.75,
    0, 'R-0',
  ]);
  assert.equal(rows.at(-1)[0], 'Medicine 50');
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { raw: false })[0], {
    'Medicine name': 'Medicine 1',
    Manufacturer: 'Example Pharma',
    'Expiry date': '2028-06-30',
    'Purchase cost per pack (PKR)': '133.45',
    'Units per pack': '10',
    'Sale price per unit (PKR)': '150.75',
    'Stock quantity (units)': '0',
    'Rack / shelf location': 'R-0',
  });
});

test('exports legacy medicines using safe one-unit defaults without losing the price or stock', () => {
  const workbook = createMedicineInventoryWorkbook([{
    name: 'Legacy', manufacturer: 'Example', purchasePrice: 100, price: 20, quantity: 50,
  }]);
  const row = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true })[1];
  assert.equal(row[3], 100);
  assert.equal(row[4], 1);
  assert.equal(row[5], 20);
  assert.equal(row[6], 50);
});

test('downloadable blank template keeps the same import columns and documents pack/unit meaning', () => {
  const workbook = createMedicineInventoryWorkbook([]);
  const templateRows = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true });
  assert.deepEqual(templateRows[0], MEDICINE_IMPORT_COLUMNS);
  assert.equal(workbook.Sheets.Instructions['A4'].v.toLowerCase().includes('units per pack'), true);
});
