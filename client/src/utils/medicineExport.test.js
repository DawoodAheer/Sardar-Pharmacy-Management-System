import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createMedicineInventoryWorkbook, MEDICINE_IMPORT_COLUMNS } from './medicineExport.js';

test('exports every supplied medicine with import-compatible columns and exact numeric values', () => {
  const medicines = Array.from({ length: 5000 }, (_, index) => ({
    name: `Medicine ${index + 1}`, genericName: 'Ingredient', manufacturer: 'Example Pharma', supplierName: 'Wholesale Co', supplierPhone: '03000000000',
    expiryDate: '2028-06-30T00:00:00.000Z', purchasePrice: 133.45, unitsPerPack: 10,
    price: 150.75, quantity: index, reorderLevel: 8, category: 'Other', barcode: `B-${index}`,
    rackLocation: `R-${index}`, labelImageUrl: '',
  }));
  const workbook = createMedicineInventoryWorkbook(medicines);
  assert.equal(workbook.SheetNames[0], 'Medicines');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true });
  assert.deepEqual(rows[0], MEDICINE_IMPORT_COLUMNS);
  assert.equal(rows.length, 5001);
  assert.deepEqual(rows[1], [
    'Medicine 1', 'Ingredient', 'Example Pharma', 'Wholesale Co', '03000000000', '2028-06-30', 133.45, 10, 150.75,
    0, 8, 'Other', 'B-0', 'R-0', '',
  ]);
  assert.equal(rows.at(-1)[0], 'Medicine 5000');
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { raw: false })[0], {
    'Medicine Name': 'Medicine 1', 'Generic Name': 'Ingredient', Manufacturer: 'Example Pharma', 'Supplier Name': 'Wholesale Co', 'Supplier Phone': '03000000000',
    'Expiry Date': '2028-06-30', 'Purchase Pack Cost': '133.45', 'Units Per Pack': '10',
    'Sale Price / Unit': '150.75', 'Quantity (Units)': '0', 'Reorder Level': '8', Category: 'Other',
    Barcode: 'B-0', 'Rack Location': 'R-0', 'Label Image URL': '',
  });
});

test('exports legacy medicines using safe one-unit defaults without losing the price or stock', () => {
  const workbook = createMedicineInventoryWorkbook([{
    name: 'Legacy', manufacturer: 'Example', purchasePrice: 100, price: 20, quantity: 50,
  }]);
  const row = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true })[1];
  assert.equal(row[6], 100);
  assert.equal(row[7], 1);
  assert.equal(row[8], 20);
  assert.equal(row[9], 50);
});

test('downloadable blank template keeps the same import columns and documents pack/unit meaning', () => {
  const workbook = createMedicineInventoryWorkbook([]);
  const templateRows = XLSX.utils.sheet_to_json(workbook.Sheets.Medicines, { header: 1, raw: true });
  assert.deepEqual(templateRows[0], MEDICINE_IMPORT_COLUMNS);
  assert.equal(workbook.Sheets.Instructions['A4'].v.includes('Units Per Pack'), true);
});
