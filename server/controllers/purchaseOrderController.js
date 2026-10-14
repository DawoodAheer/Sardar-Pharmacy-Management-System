import { pagination } from '../utils/pagination.js';
import { addBatch } from '../utils/batchInventory.js';
import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { recordMedicineAudit, snapshotMedicine } from '../utils/medicineAudit.js';

export const getLowStockMedicines = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const filter = { isDeleted: { $ne: true }, quantity: { $lt: 5 } };
    const total = await Medicine.countDocuments(filter);
    const medicines = await Medicine.find(filter).sort({ quantity: 1, name: 1, _id: 1 }).skip(skip).limit(limit).lean();
    res.json({ medicines, total, page, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const total = await PurchaseOrder.countDocuments();
    const orders = await PurchaseOrder.find().populate('createdBy', 'name email role').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean();
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
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
      const medicine = await Medicine.findOne({ _id: item.medicineId, isDeleted: { $ne: true } }).select('name quantity');
      if (!medicine) return res.status(404).json({ message: 'A selected medicine is no longer active in inventory.' });
      normalized.push({ medicineId: medicine._id, medicineName: medicine.name, quantityOrdered: qty });
    }
    let order;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of normalized) {
          const lock = await Medicine.updateOne({ _id: item.medicineId, isDeleted: { $ne: true } }, { $set: { updatedAt: new Date() } }, { session });
          if (!lock.matchedCount) throw Object.assign(new Error('A selected medicine was archived or removed. Refresh inventory.'), { statusCode: 409 });
        }
        [order] = await PurchaseOrder.create([{ supplierName, supplierPhone, items: normalized, createdBy: req.user._id }], { session });
      });
    } finally { await session.endSession(); }
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
          const receipt = req.body.receipts?.find(line => String(line.medicineId) === String(item.medicineId)) || {};
          addBatch(medicine, { batchNumber: receipt.batchNumber || order.orderNumber,
            quantity: item.quantityOrdered, expiryDate: receipt.expiryDate || medicine.expiryDate,
            purchaseCost: receipt.purchaseCost ?? medicine.purchasePrice / (medicine.unitsPerPack || 1) });
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
