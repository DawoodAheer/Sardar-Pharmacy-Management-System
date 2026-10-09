import MedicineAudit from '../models/MedicineAudit.js';

export const AUDITED_MEDICINE_FIELDS = [
  'name', 'manufacturer', 'expiryDate',
  'quantity', 'price', 'purchasePrice', 'unitsPerPack',
  'rackLocation',
  'isDeleted', 'deletedAt',
];

export const snapshotMedicine = (medicine) => Object.fromEntries(
  AUDITED_MEDICINE_FIELDS.map((field) => [field, medicine?.[field] ?? null])
);

export const recordMedicineAudit = async ({ medicine, action, previousValues = null, newValues, changedFields, reason = '', performedBy, session }) => {
  const values = {
    medicineId: medicine?._id || null,
    medicineName: medicine?.name || newValues?.name || previousValues?.name || 'Medicine',
    action,
    previousValues,
    newValues: newValues || snapshotMedicine(medicine),
    changedFields: changedFields || Object.keys(newValues || {}),
    reason,
    performedBy,
  };
  if (session) {
    const [record] = await MedicineAudit.create([values], { session });
    return record;
  }
  return MedicineAudit.create(values);
};
