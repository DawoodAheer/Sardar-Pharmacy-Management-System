import mongoose from 'mongoose';
const { Schema } = mongoose;
const actor = { type: Schema.Types.ObjectId, ref: 'User', required: true };
const money = { type: Number, min: 0, required: true };
const supplierSchema = new Schema({ name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' }, address: { type: String, default: '' }, createdBy: actor }, { timestamps: true });
supplierSchema.index({ name: 1 });
export const Supplier = mongoose.model('Supplier', supplierSchema);
const invoiceSchema = new Schema({ supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  invoiceNumber: { type: String, required: true, trim: true }, dueDate: Date, total: money,
  items: [{ medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true }, medicineName: String,
    batchId: Schema.Types.ObjectId, batchNumber: String, quantity: Number, purchaseCost: Number, expiryDate: Date }],
  payments: [{ amount: money, fromCashDrawer: { type: Boolean, default: false }, paidAt: { type: Date, default: Date.now }, recordedBy: actor }],
  returns: [{ batchId: Schema.Types.ObjectId, quantity: Number, credit: Number,
    reason: String, returnedAt: { type: Date, default: Date.now }, recordedBy: actor }], createdBy: actor,
}, { timestamps: true, optimisticConcurrency: true });
invoiceSchema.index({ supplierId: 1, invoiceNumber: 1 }, { unique: true });
export const SupplierInvoice = mongoose.model('SupplierInvoice', invoiceSchema);
const cashSchema = new Schema({ date: { type: String, required: true, unique: true },
  openingCash: { ...money, default: 0 }, countedCash: { type: Number, min: 0, default: null },
  expenses: [{ amount: money, reason: { type: String, required: true }, recordedBy: actor,
    recordedAt: { type: Date, default: Date.now } }], notes: { type: String, default: '' },
  updatedBy: actor,
}, { timestamps: true, optimisticConcurrency: true });
export const CashSession = mongoose.model('CashSession', cashSchema);
