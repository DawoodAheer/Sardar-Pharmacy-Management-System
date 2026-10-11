import { isValidUnitsPerPack } from './medicinePricing.js';

const aliases = {
  name: ['name', 'Name', 'Medicine Name', 'Medicine name'],
  manufacturer: ['manufacturer', 'Manufacturer', 'Manufacture Company'],
  expiryDate: ['expiryDate', 'Expiry Date', 'Expiry date'],
  purchasePrice: ['purchasePrice', 'Purchase Price', 'Purchase Pack Cost', 'Purchase cost per pack (PKR)'],
  unitsPerPack: ['unitsPerPack', 'Units Per Pack', 'Units per pack'],
  price: ['price', 'Sale Price', 'Sale Price / Unit', 'Sale price per unit (PKR)'],
  quantity: ['quantity', 'Quantity', 'Quantity (Units)', 'Stock Quantity (Units)', 'Stock quantity (units)'],
  rackLocation: ['rackLocation', 'Rack', 'Rack Location', 'Rack / Shelf', 'Rack / shelf location'],
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

  const parsedUnits = unitsRaw !== undefined && unitsRaw !== '' && !Number.isNaN(Number(unitsRaw)) ? Number(unitsRaw) : 1;
  const parsedUnitsPerPack = parsedUnits > 0 ? parsedUnits : 1;
  const parsedPurchasePrice = purchaseRaw !== undefined && purchaseRaw !== '' ? Number(purchaseRaw) : NaN;
  
  let parsedSalePrice = priceRaw !== undefined && priceRaw !== '' ? Number(priceRaw) : NaN;
  if (!Number.isFinite(parsedSalePrice) || parsedSalePrice < 0) {
    // If not provided or empty, default to cost per unit or 0
    parsedSalePrice = Number.isFinite(parsedPurchasePrice) && parsedPurchasePrice > 0 
      ? Number((parsedPurchasePrice / parsedUnitsPerPack).toFixed(2)) 
      : 0;
  }

  let parsedQuantity = quantityRaw !== undefined && quantityRaw !== '' ? Number(quantityRaw) : 0;
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
    parsedQuantity = 0;
  }

  const parsedExpiry = expiryRaw ? parseMedicineExpiryDate(expiryRaw) : null;

  const medicine = {
    name: String(name ?? '').trim(),
    manufacturer: String(manufacturer ?? '').trim(),
    expiryDate: parsedExpiry,
    purchasePrice: parsedPurchasePrice,
    unitsPerPack: parsedUnitsPerPack,
    price: parsedSalePrice,
    quantity: parsedQuantity,
    rackLocation: String(readAlias(row, aliases.rackLocation) ?? '').trim(),
  };

  const errors = [];
  if (!medicine.name) errors.push('Medicine name is required.');
  if (!Number.isFinite(medicine.purchasePrice) || medicine.purchasePrice <= 0) {
    errors.push('Purchase price per pack is required and must be greater than zero.');
  }
  if (expiryRaw && !parsedExpiry) {
    errors.push('Expiry date format is invalid (use DD/MM/YYYY or YYYY-MM-DD).');
  }

  return { medicine, errors };
};
