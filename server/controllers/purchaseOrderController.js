import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { recordMedicineAudit, snapshotMedicine } from '../utils/medicineAudit.js';

export const getLowStockMedicines = async (_req, res, next) => {
  try {
    const medicines = await Medicine.find({ isDeleted: { $ne: true }, $expr: { $lte: ['$quantity', '$reorderLevel'] } })
      .sort({ quantity: 1, name: 1 }).limit(500).lean();
    res.json({ medicines });
  } catch (error) { next(error); }
};

export const getPurchaseOrders = async (_req, res, next) => {
  try {
    const orders = await PurchaseOrder.find().populate('createdBy', 'name email role')
      .sort({ createdAt: -1 }).limit(200).lean();
    res.json({ orders });
  } catch (error) { next(error); }
};

export const createPurchaseOrder = async (req, res, next) => {
  const supplierName = String(req.body?.supplierName || '').trim();
  const supplierPhone = String(req.body?.supplierPhone || '').trim();
  const items = req.body?.items;
  if (!supplierName) return res.status(400).json({ message: 'Supplier name is required.' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Select at least one low-stock medicine.' });
  try {
    const normalized = [];
    for (const item of items) {
      const qty = Number(item.quantityOrdered);
      if (!mongoose.isValidObjectId(item.medicineId) || !Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: 'Every purchase line needs a valid medicine and whole order quantity.' });
      const medicine = await Medicine.findOne({ _id: item.medicineId, isDeleted: { $ne: true } }).select('name quantity reorderLevel supplierName');
      if (!medicine) return res.status(404).json({ message: 'A selected medicine is no longer active in inventory.' });
      normalized.push({ medicineId: medicine._id, medicineName: medicine.name, quantityOrdered: qty });
    }
    const order = await PurchaseOrder.create({ supplierName, supplierPhone, items: normalized, createdBy: req.user._id });
    res.status(201).json({ message: 'Purchase order draft created.', order });
  } catch (error) { next(error); }
};

export const updatePurchaseOrderStatus = async (req, res, next) => {
  const { status } = req.body || {};
  if (!['ORDERED', 'RECEIVED', 'CANCELLED'].includes(status)) return res.status(400).json({ message: 'Choose Ordered, Received, or Cancelled.' });
  const session = await mongoose.startSession();
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      const order = await PurchaseOrder.findById(req.params.id).session(session);
      if (!order) { const error = new Error('Purchase order not found.'); error.statusCode = 404; throw error; }
      if (order.status !== 'DRAFT' && !(order.status === 'ORDERED' && ['RECEIVED', 'CANCELLED'].includes(status))) {
        const error = new Error(`Cannot change purchase order from ${order.status} to ${status}.`); error.statusCode = 409; throw error;
      }
      if (status === 'RECEIVED') {
        for (const item of order.items) {
          const medicine = await Medicine.findById(item.medicineId).session(session);
          if (!medicine || medicine.isDeleted) { const error = new Error(`${item.medicineName} is no longer active. Restore it before receiving this order.`); error.statusCode = 409; throw error; }
          const previousValues = snapshotMedicine(medicine);
          const previousQuantity = medicine.quantity;
          medicine.quantity += item.quantityOrdered;
          const updatedMedicine = await medicine.save({ session });
          await StockAdjustment.create([{
            medicineId: medicine._id, medicineName: medicine.name, previousQuantity,
            newQuantity: updatedMedicine.quantity, adjustmentType: 'ADD',
            quantityChanged: item.quantityOrdered, reason: `Received purchase order ${order.orderNumber}`,
            adjustedBy: req.user._id,
          }], { session });
          await recordMedicineAudit({ medicine: updatedMedicine, action: 'stock_adjusted', previousValues, newValues: snapshotMedicine(updatedMedicine), changedFields: ['quantity'], reason: `Received purchase order ${order.orderNumber}`, performedBy: req.user._id, session });
        }
        order.receivedAt = new Date();
      }
      if (status === 'ORDERED') order.orderedAt = new Date();
      if (status === 'CANCELLED') order.cancelledAt = new Date();
      order.status = status;
      updatedOrder = await order.save({ session });
    });
    res.json({ message: `Purchase order marked ${status.toLowerCase()}.`, order: updatedOrder });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};
