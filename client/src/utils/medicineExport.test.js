import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createMedicineInventoryWorkbook } from './medicineExport.js';

test('exports all inventory rows with stable columns and exact numeric costs', () => {
  const medicines = Array.from({ length: 5000 }, (_, index) => ({
    name: `Medicine ${index + 1}`,
    manufacturer: 'Example Pharma',
    expiryDate: '2028-06-30T00:00:00.000Z',
    purchasePrice: 133.45,
    price: 150.75,
    quantity: index,
    rackLocation: `R-${index}`,
  }));
  const workbook = createMedicineInventoryWorkbook(medicines);
  const worksheet = workbook.Sheets.Medicines;
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
  });

  assert.deepEqual(rows[0], [
    'Medicine Name',
    'Manufacturer',
    'Expiry Date',
    'Purchase Cost',
    'Sale Cost',
    'Quantity',
    'Rack',
  ]);
  assert.equal(rows.length, 5001);
  assert.deepEqual(rows[1], [
    'Medicine 1',
    'Example Pharma',
    '2028-06-30',
    133.45,
    150.75,
    0,
    'R-0',
  ]);
  assert.equal(rows.at(-1)[0], 'Medicine 5000');
});
