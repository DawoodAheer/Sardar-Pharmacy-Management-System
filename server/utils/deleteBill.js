import Bill from '../models/Bill.js';
import Medicine from '../models/Medicine.js';
import SaleReturn from '../models/SaleReturn.js';
import { restoreReturnedBatches } from './batchInventory.js';
import { recordMedicineAudit, snapshotMedicine } from './medicineAudit.js';

export async function deleteBillWithStockRestore(bill, userId, session) {
  if (bill.returns?.length || bill.isReturned || bill.totalRefunded > 0 || await SaleReturn.exists({ sale_id: bill._id }).session(session)) {
    const error = new Error('Bills with return/refund history cannot be deleted. Keep their financial history.');
    error.statusCode = 409; throw error;
  }
  const snapshot = bill.toObject();
  // Deletion takes the same document write lock as concurrent returns/acceptance.
  await Bill.deleteOne({ _id: bill._id }, { session });
  if (bill.orderStatus === 'ACCEPTED') {
    for (const item of bill.items) {
      const medicine = await Medicine.findById(item.medicineId).session(session);
      if (!medicine) {
        const error = new Error('Cannot restore stock: a bill medicine no longer exists.');
        error.statusCode = 409; throw error;
      }
      const previousValues = snapshotMedicine(medicine);
      restoreReturnedBatches(medicine, [item], item.quantity, 0);
      await medicine.save({ session });
      await recordMedicineAudit({ medicine, action: 'stock_adjusted', previousValues,
        changedFields: ['quantity'], reason: `Stock restored after deletion of ${bill.billNumber}`, performedBy: userId, session });
    }
  }
  return snapshot;
}
