import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import SaleReturn from '../models/SaleReturn.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { SupplierInvoice } from '../models/Operations.js';
import MedicineAudit from '../models/MedicineAudit.js';
import { snapshotMedicine } from './medicineAudit.js';
import { createBackup } from './backupManager.js';

const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
export async function checkArchivedDeletion(id, session = null) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid medicine ID.'), { statusCode: 400 });
  const medicine = await Medicine.findById(id).session(session);
  if (!medicine) throw Object.assign(new Error('Medicine not found.'), { statusCode: 404 });
  if (!medicine.isDeleted) throw conflict('Archive this medicine before permanently deleting it.');
  const queries = [
    Bill.exists({ $or: [{ 'items.medicineId': id }, { 'returns.medicineId': id }] }).session(session),
    SaleReturn.exists({ item_id: id }).session(session),
    PurchaseOrder.exists({ 'items.medicineId': id }).session(session),
    SupplierInvoice.exists({ 'items.medicineId': id }).session(session),
  ];
  for (const query of queries) {
    if (await query) throw conflict('This medicine is linked to bills, returns or supplier purchases. Keep it archived to preserve accounting history.');
  }
  return medicine;
}

export async function deleteArchivedMedicine(id, actor) {
  await checkArchivedDeletion(id);
  const safetyBackup = await createBackup();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const medicine = await checkArchivedDeletion(id, session);
      await MedicineAudit.create([{ medicineId: medicine._id, medicineName: medicine.name,
        action: 'permanently_deleted', previousValues: snapshotMedicine(medicine), newValues: {},
        changedFields: ['isDeleted'], reason: 'Admin confirmed permanent removal from archive; safety backup saved.', performedBy: actor }], { session });
      await Medicine.deleteOne({ _id: medicine._id, isDeleted: true }, { session });
    }, { writeConcern: { w: 'majority' } });
  } finally { await session.endSession(); }
  return { message: 'Archived medicine permanently deleted. A safety backup and audit record were saved.', safetyBackup: safetyBackup.split(/[\\/]/).pop() };
}
