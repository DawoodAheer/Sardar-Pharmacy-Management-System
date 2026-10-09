import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  medicineName: { type: String, required: true, trim: true },
  quantityOrdered: { type: Number, required: true, min: 1, validate: Number.isInteger },
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  supplierName: { type: String, trim: true, required: true },
  supplierPhone: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'], default: 'DRAFT', index: true },
  items: { type: [purchaseOrderItemSchema], validate: (items) => items.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

purchaseOrderSchema.pre('save', function (next) {
  if (!this.orderNumber) this.orderNumber = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;
  next();
});

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
