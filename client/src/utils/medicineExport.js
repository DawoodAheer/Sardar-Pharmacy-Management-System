import * as XLSX from 'xlsx';

export const MEDICINE_IMPORT_COLUMNS = [
  'Medicine name',
  'Manufacturer',
  'Expiry date',
  'Purchase cost per pack (PKR)',
  'Units per pack',
  'Sale price per pack (PKR)',
  'Stock quantity (units)',
  'Rack / shelf location',
];

const toExpiryDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

export const createMedicineInventoryWorkbook = (medicines) => {
  if (!Array.isArray(medicines)) throw new Error('The medicine inventory is not a valid list.');
  const rows = medicines.map((medicine) => ({
    'Medicine name': medicine.name || '',
    'Manufacturer': medicine.manufacturer || '',
    'Expiry date': toExpiryDate(medicine.expiryDate),
    'Purchase cost per pack (PKR)': Number(medicine.purchasePrice) || 0,
    'Units per pack': Number(medicine.unitsPerPack) || 1,
    'Sale price per pack (PKR)': (Number(medicine.price) || 0) * (Number(medicine.unitsPerPack) || 1),
    'Stock quantity (units)': Number(medicine.quantity) || 0,
    'Rack / shelf location': medicine.rackLocation || '',
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: MEDICINE_IMPORT_COLUMNS });
  worksheet['!cols'] = MEDICINE_IMPORT_COLUMNS.map((column) => ({ wch: Math.max(16, Math.min(30, column.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
  const notes = XLSX.utils.aoa_to_sheet([
    ['Medicine import template'],
    ['Use the Medicines sheet. Its columns match Add Medicine.'],
    ['Purchase cost per pack (PKR) is the full pack/bottle purchase price.'],
    ['Units per pack is tablets per box; use 1 when selling a whole bottle/pack as one unit.'],
    ['Sale price per pack (PKR) is divided by Units per pack. Stock quantity is total tablets / sellable units.'],
    ['Optional blanks: units per pack = 1; stock = 0; sale pack price = purchase pack cost; other fields stay blank.'],
    ['Expiry date format stays YYYY-MM-DD or DD/MM/YYYY. Supplied units must be positive whole numbers; stock must be non-negative whole numbers.'],
    ['Old sheets labelled Sale price per unit (PKR) remain supported without conversion.'],
    ['Only Medicine name and Purchase cost per pack (PKR) are required. Purchase cost must be greater than zero.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, notes, 'Instructions');
  return workbook;
};

export const downloadMedicineInventory = (medicines) => {
  const workbook = createMedicineInventoryWorkbook(medicines);
  XLSX.writeFile(workbook, 'Pharmacy_Medicine_Backup.xlsx');
};
