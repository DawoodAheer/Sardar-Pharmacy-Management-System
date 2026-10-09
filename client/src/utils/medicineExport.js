import * as XLSX from 'xlsx';

export const MEDICINE_IMPORT_COLUMNS = [
  'Medicine Name',
  'Generic Name',
  'Manufacturer',
  'Supplier Name',
  'Supplier Phone',
  'Expiry Date',
  'Purchase Pack Cost',
  'Units Per Pack',
  'Sale Price / Unit',
  'Quantity (Units)',
  'Reorder Level',
  'Category',
  'Barcode',
  'Rack Location',
  'Label Image URL',
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
    'Medicine Name': medicine.name || '',
    'Generic Name': medicine.genericName || '',
    Manufacturer: medicine.manufacturer || '',
    'Supplier Name': medicine.supplierName || '',
    'Supplier Phone': medicine.supplierPhone || '',
    'Expiry Date': toExpiryDate(medicine.expiryDate),
    'Purchase Pack Cost': Number(medicine.purchasePrice) || 0,
    'Units Per Pack': Number(medicine.unitsPerPack) || 1,
    'Sale Price / Unit': Number(medicine.price) || 0,
    'Quantity (Units)': Number(medicine.quantity) || 0,
    'Reorder Level': Number(medicine.reorderLevel) || 0,
    Category: medicine.category || 'Antibiotic',
    Barcode: medicine.barcode || '',
    'Rack Location': medicine.rackLocation || '',
    'Label Image URL': medicine.labelImageUrl || '',
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: MEDICINE_IMPORT_COLUMNS });
  worksheet['!cols'] = MEDICINE_IMPORT_COLUMNS.map((column) => ({ wch: Math.max(16, Math.min(30, column.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
  const notes = XLSX.utils.aoa_to_sheet([
    ['Medicine import template'],
    ['Use the Medicines sheet. Its columns match Add Medicine.'],
    ['Purchase Pack Cost is the full pack/bottle purchase price.'],
    ['Units Per Pack is tablets per box; use 1 when selling a whole bottle/pack as one unit.'],
    ['Sale Price / Unit and Quantity (Units) are per sellable unit.'],
    ['Medicine Name, Generic Name, Manufacturer, Expiry Date, purchase cost, units per pack, sale price, quantity, reorder level, category, barcode, rack and label URL map to the form fields.'],
    ['Expiry Date format: YYYY-MM-DD or DD/MM/YYYY. Prices must be > 0; stock and reorder levels must be whole numbers.'],
  ]);
  XLSX.utils.book_append_sheet(workbook, notes, 'Instructions');
  return workbook;
};

export const downloadMedicineInventory = (medicines) => {
  const workbook = createMedicineInventoryWorkbook(medicines);
  XLSX.writeFile(workbook, 'Pharmacy_Medicine_Backup.xlsx');
};
