import mongoose from 'mongoose';

const medicineImportIssueSchema = new mongoose.Schema({
  sourceFile: { type: String, trim: true, default: '' },
  rowNumber: { type: Number, min: 1, required: true },
  originalRow: { type: mongoose.Schema.Types.Mixed, required: true },
  normalizedRow: { type: mongoose.Schema.Types.Mixed, default: {} },
  validationErrors: [{ type: String, trim: true }],
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending', index: true },
  resolvedMedicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('MedicineImportIssue', medicineImportIssueSchema);
