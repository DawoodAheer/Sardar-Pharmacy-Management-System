import * as XLSX from 'xlsx';

const INVENTORY_COLUMNS = [
  'Medicine Name',
  'Manufacturer',
  'Expiry Date',
  'Purchase Cost',
  'Sale Cost',
  'Quantity',
  'Rack',
];

export const createMedicineInventoryWorkbook = (medicines) => {
  if (!Array.isArray(medicines)) {
    throw new Error('The medicine inventory is not a valid list.');
  }

  const rows = medicines.map((medicine) => {
    const date = medicine.expiryDate ? new Date(medicine.expiryDate) : null;
    return {
      'Medicine Name': medicine.name || '',
      Manufacturer: medicine.manufacturer || '',
      'Expiry Date':
        date && !Number.isNaN(date.getTime())
          ? date.toISOString().slice(0, 10)
          : '',
      'Purchase Cost': Number(medicine.purchasePrice) || 0,
      'Sale Cost': Number(medicine.price) || 0,
      Quantity: Number(medicine.quantity) || 0,
      Rack: medicine.rackLocation || '',
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: INVENTORY_COLUMNS,
  });
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 25 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');
  return workbook;
};

export const downloadMedicineInventory = (medicines) => {
  const workbook = createMedicineInventoryWorkbook(medicines);
  XLSX.writeFile(workbook, 'Pharmacy_Medicine_Backup.xlsx');
};
