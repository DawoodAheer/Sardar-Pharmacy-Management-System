import mongoose from 'mongoose';

const medicineAuditSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null, index: true },
  medicineName: { type: String, trim: true, required: true, index: true },
  action: { type: String, enum: ['created', 'updated', 'stock_adjusted', 'archived', 'restored', 'bulk_imported'], required: true, index: true },
  previousValues: { type: mongoose.Schema.Types.Mixed, default: null },
  newValues: { type: mongoose.Schema.Types.Mixed, default: {} },
  changedFields: [{ type: String, trim: true }],
  reason: { type: String, trim: true, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

export default mongoose.model('MedicineAudit', medicineAuditSchema);
