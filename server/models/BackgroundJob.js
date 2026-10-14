import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  type: { type: String, enum: ['backup', 'verify', 'import', 'export', 'purge'], required: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payloadFile: String,
  artifact: String,
  result: mongoose.Schema.Types.Mixed,
  error: String,
  startedAt: Date,
  finishedAt: Date,
}, { timestamps: true });
schema.index({ status: 1, createdAt: 1 });
schema.index({ owner: 1, createdAt: -1 });
export default mongoose.model('BackgroundJob', schema);
