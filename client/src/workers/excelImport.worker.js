import { parseMedicineWorkbook } from '../utils/excelImport';
self.onmessage = event => {
  try { self.postMessage({ result: parseMedicineWorkbook(event.data) }); }
  catch (error) { self.postMessage({ error: error.message || 'Unable to read the workbook.' }); }
};
