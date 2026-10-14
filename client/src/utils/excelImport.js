import * as XLSX from 'xlsx';
const headerKey = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const nameKeys = new Set(['name', 'medicinename']);
const purchaseKeys = new Set(['purchaseprice', 'purchasepackcost', 'purchasecostperpackpkr']);

export function extractMedicineWorkbookRows(workbook) {
  const rows = [], ignoredSheets = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const header = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false })[0] || [];
    if (!header.some(value => nameKeys.has(headerKey(value))) || !header.some(value => purchaseKeys.has(headerKey(value)))) {
      ignoredSheets.push(name);
      continue;
    }
    for (const raw of XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '', blankrows: false })) {
      const row = { ...raw, __sourceSheet: name, __sourceRowNumber: raw.__rowNum__ + 1 };
      for (const key of Object.keys(row)) {
        if (headerKey(key) !== 'expirydate') continue;
        if (typeof row[key] === 'number') {
          const formatter = XLSX.SSF || Reflect.get(XLSX, 'default')?.SSF;
          if (!formatter) throw new Error('Unable to load the Excel date formatter.');
          const date = formatter.parse_date_code(row[key], { date1904: Boolean(workbook.Workbook?.WBProps?.date1904) });
          if (date) row[key] = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        } else if (row[key] instanceof Date) row[key] = row[key].toISOString().slice(0, 10);
      }
      rows.push(row);
    }
  }
  if (!rows.length) throw new Error('No medicine rows found. Use the sample columns including Medicine name and Purchase cost per pack.');
  if (rows.length > 10000) throw new Error('Import at most 10,000 medicine rows per file.');
  return { rows, ignoredSheets };
}
export function parseMedicineWorkbook(buffer) {
  return extractMedicineWorkbookRows(XLSX.read(buffer, { type: 'array' }));
}
