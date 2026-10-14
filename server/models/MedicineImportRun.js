import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: { type: String },
  sourceFile: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  result: mongoose.Schema.Types.Mixed,
  revision: { type: Number, default: 0 },
}, { timestamps: true });
export default mongoose.model('MedicineImportRun', schema);
