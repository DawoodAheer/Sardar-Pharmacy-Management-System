import mongoose from 'mongoose';

const deletionRequestSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['medicine', 'bill'], required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  targetLabel: { type: String, required: true, trim: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  requestReason: { type: String, trim: true, maxlength: 500, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

deletionRequestSchema.index(
  { targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export default mongoose.model('DeletionRequest', deletionRequestSchema);
