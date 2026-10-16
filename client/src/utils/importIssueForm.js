const headers = {
  name: ['name', 'Medicine Name'], manufacturer: ['manufacturer', 'Manufacture Company'],
  expiryDate: ['expiryDate', 'Expiry Date'], purchasePrice: ['purchasePrice', 'Purchase Price', 'Purchase Pack Cost', 'Purchase cost per pack (PKR)'],
  unitsPerPack: ['unitsPerPack', 'Units per pack'], price: ['price', 'Sale Price', 'Sale Price / Unit', 'Sale price per unit (PKR)'],
  quantity: ['quantity', 'Quantity', 'Quantity (Units)', 'Stock quantity (units)', 'Stock Quantity (Units)'],
  rackLocation: ['rackLocation', 'Rack', 'Rack Location', 'Rack / shelf location', 'Rack / Shelf'],
};
const key = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export const importIssueForm = (issue = {}) => {
  const original = Object.fromEntries(Object.entries(issue.originalRow || {}).map(([name, value]) => [key(name), value]));
  const form = {};
  for (const [field, aliases] of Object.entries(headers)) {
    const usable = value => value !== undefined && value !== null && String(value).trim() !== '';
    const normalized = issue.normalizedRow?.[field];
    const value = usable(normalized) ? normalized : aliases.map(alias => original[key(alias)]).find(usable);
    form[field] = value ?? '';
  }
  const date = String(form.expiryDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) form.expiryDate = date.slice(0, 10);
  else {
    const dayFirst = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    form.expiryDate = dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}` : '';
  }
  if (form.unitsPerPack === '') form.unitsPerPack = 1;
  return form;
};
