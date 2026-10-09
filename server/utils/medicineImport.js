import { isValidUnitsPerPack } from './medicinePricing.js';

const aliases = {
  name: ['name', 'Name', 'Medicine Name'],
  genericName: ['genericName', 'Generic Name'],
  manufacturer: ['manufacturer', 'Manufacturer', 'Manufacture Company'],
  supplierName: ['supplierName', 'Supplier Name', 'Supplier'],
  supplierPhone: ['supplierPhone', 'Supplier Phone', 'Supplier Contact'],
  expiryDate: ['expiryDate', 'Expiry Date'],
  purchasePrice: ['purchasePrice', 'Purchase Price', 'Purchase Pack Cost', 'Purchase cost per pack (PKR)'],
  unitsPerPack: ['unitsPerPack', 'Units Per Pack', 'Units per pack'],
  price: ['price', 'Sale Price', 'Sale Price / Unit', 'Sale price per unit (PKR)'],
  quantity: ['quantity', 'Quantity', 'Quantity (Units)', 'Stock Quantity (Units)', 'Stock quantity (units)'],
  reorderLevel: ['reorderLevel', 'Reorder Level', 'Reorder Level (Units)'],
  category: ['category', 'Category'],
  barcode: ['barcode', 'Barcode'],
  rackLocation: ['rackLocation', 'Rack', 'Rack Location', 'Rack / Shelf'],
  labelImageUrl: ['labelImageUrl', 'Label Image URL'],
};

const readAlias = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return undefined;
};

export const parseMedicineExpiryDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && value > 20000 && value < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const input = String(value ?? '').trim();
  if (!input) return null;
  if (/^\d+(?:\.\d+)?$/.test(input) && Number(input) > 20000 && Number(input) < 100000) {
    return parseMedicineExpiryDate(Number(input));
  }
  let match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  let year, month, day;
  if (match) {
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
  } else {
    match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
};

export const normalizeMedicineImportRow = (row = {}) => {
  const name = readAlias(row, aliases.name);
  const manufacturer = readAlias(row, aliases.manufacturer);
  const expiryRaw = readAlias(row, aliases.expiryDate);
  const purchaseRaw = readAlias(row, aliases.purchasePrice);
  const unitsRaw = readAlias(row, aliases.unitsPerPack);
  const priceRaw = readAlias(row, aliases.price);
  const quantityRaw = readAlias(row, aliases.quantity);
  const reorderRaw = readAlias(row, aliases.reorderLevel);
  const medicine = {
    name: String(name ?? '').trim(),
    genericName: String(readAlias(row, aliases.genericName) ?? '').trim(),
    manufacturer: String(manufacturer ?? '').trim(),
    supplierName: String(readAlias(row, aliases.supplierName) ?? '').trim(),
    supplierPhone: String(readAlias(row, aliases.supplierPhone) ?? '').trim(),
    expiryDate: parseMedicineExpiryDate(expiryRaw),
    purchasePrice: purchaseRaw === undefined ? NaN : Number(purchaseRaw),
    unitsPerPack: unitsRaw === undefined ? 1 : Number(unitsRaw),
    price: priceRaw === undefined ? NaN : Number(priceRaw),
    quantity: quantityRaw === undefined ? NaN : Number(quantityRaw),
    reorderLevel: reorderRaw === undefined ? 10 : Number(reorderRaw),
    category: String(readAlias(row, aliases.category) ?? 'Antibiotic').trim(),
    barcode: String(readAlias(row, aliases.barcode) ?? '').trim(),
    rackLocation: String(readAlias(row, aliases.rackLocation) ?? '').trim(),
    labelImageUrl: String(readAlias(row, aliases.labelImageUrl) ?? '').trim(),
  };
  const errors = [];
  if (!medicine.name) errors.push('Medicine name is required.');
  if (!medicine.manufacturer) errors.push('Manufacturer is required.');
  if (!medicine.expiryDate) errors.push('A valid expiry date is required (DD/MM/YYYY or YYYY-MM-DD).');
  if (!Number.isFinite(medicine.purchasePrice) || medicine.purchasePrice <= 0) errors.push('Purchase price per pack must be greater than zero.');
  if (!isValidUnitsPerPack(medicine.unitsPerPack)) errors.push('Units per pack must be a positive whole number.');
  if (!Number.isFinite(medicine.price) || medicine.price <= 0) errors.push('Sale price per unit must be greater than zero.');
  if (!Number.isInteger(medicine.quantity) || medicine.quantity < 0) errors.push('Stock quantity must be a non-negative whole number of units.');
  if (!Number.isInteger(medicine.reorderLevel) || medicine.reorderLevel < 0) errors.push('Reorder level must be a non-negative whole number.');
  return { medicine, errors };
};
