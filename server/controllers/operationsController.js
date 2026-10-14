import { pagination } from '../utils/pagination.js';
import { MANUFACTURER_SORT, MEDICINE_COLLATION } from '../utils/medicineOrdering.js';
import mongoose from 'mongoose';
import { saleDateFilter } from '../utils/saleDate.js';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import SaleReturn from '../models/SaleReturn.js';
import Udhar from '../models/Udhar.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { Supplier, SupplierInvoice, CashSession } from '../models/Operations.js';
import { addBatch, ensureBatches, syncBatchTotals, inventoryError, roundMoney } from '../utils/batchInventory.js';
import { recordMedicineAudit, snapshotMedicine } from '../utils/medicineAudit.js';
import { getLocalDateRange } from '../utils/dateRange.js';

const whole = value => { const n = Number(value); if (!Number.isInteger(n) || n < 1) throw inventoryError('Quantity must be positive whole units.'); return n; };
const amount = value => { const n = Number(value); if (!Number.isFinite(n) || n < 0) throw inventoryError('Amount must be a non-negative number.'); return roundMoney(n); };
const dueDate = value => { if (!value) return undefined; const d = new Date(value); if (Number.isNaN(d.getTime())) throw inventoryError('Invalid due date.'); return d; };
const dateRange = date => { const range = getLocalDateRange(date, date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !range.start || !range.end) throw inventoryError('Choose a valid date.'); return range; };
const invoiceView = invoice => {
  const value = invoice.toObject ? invoice.toObject() : invoice;
  const totalPaid = roundMoney(value.payments.reduce((sum, p) => sum + p.amount, 0));
  const returnCredit = roundMoney(value.returns.reduce((sum, p) => sum + p.credit, 0));
  return { ...value, totalPaid, returnCredit, balance: roundMoney(value.total - totalPaid - returnCredit) };
};
const transaction = async action => {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async () => { result = await action(session); }); return result; }
  finally { await session.endSession(); }
};
async function auditStock(medicine, previousValues, reason, user, session) {
  await StockAdjustment.create([{ medicineId: medicine._id, medicineName: medicine.name,
    previousQuantity: previousValues.quantity, newQuantity: medicine.quantity, adjustmentType: medicine.quantity >= previousValues.quantity ? 'ADD' : 'SUBTRACT',
    quantityChanged: medicine.quantity - previousValues.quantity, reason, adjustedBy: user._id }], { session });
  await recordMedicineAudit({ medicine, action: 'stock_adjusted', previousValues, newValues: snapshotMedicine(medicine),
    changedFields: ['quantity', 'expiryDate'], reason, performedBy: user._id, session });
}
export const batchExpiryAlerts = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now.getTime() + 180 * 86400000);
    const part = match => [{ $match: match }, { $sort: { expiryDate: 1, _id: 1 } }, { $skip: skip }, { $limit: limit }];
    const [result] = await Medicine.aggregate([
      { $match: { isDeleted: { $ne: true }, quantity: { $gt: 0 } } },
      { $set: { lots: { $cond: [{ $gt: [{ $size: { $ifNull: ['$batches', []] } }, 0] }, '$batches', [{ _id: 'legacy', batchNumber: 'LEGACY', quantity: '$quantity', expiryDate: '$expiryDate' }]] } } },
      { $unwind: '$lots' },
      { $match: { 'lots.quantity': { $gt: 0 }, 'lots.expiryDate': { $ne: null, $lte: cutoff } } },
      { $project: { _id: { $concat: [{ $toString: '$_id' }, '-', { $toString: '$lots._id' }] }, name: { $concat: ['$name', ' — batch ', '$lots.batchNumber'] }, medicineId: '$_id', quantity: '$lots.quantity', expiryDate: '$lots.expiryDate' } },
      { $facet: { expired: part({ expiryDate: { $lt: now } }), expiring: part({ expiryDate: { $gte: now } }), expiredCount: [{ $match: { expiryDate: { $lt: now } } }, { $count: 'total' }], expiringCount: [{ $match: { expiryDate: { $gte: now } } }, { $count: 'total' }] } },
    ]);
    const expiredTotal = result.expiredCount[0]?.total || 0, expiringTotal = result.expiringCount[0]?.total || 0;
    res.json({ expired: result.expired || [], expiring: result.expiring || [], expiredTotal, expiringTotal, total: expiredTotal + expiringTotal, page, pages: Math.ceil(Math.max(expiredTotal, expiringTotal) / limit) });
  } catch (error) { next(error); }
};
export const listBatches = async (req, res, next) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    const filter = { isDeleted: { $ne: true } };
    if (req.query.search) {
      const text = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: text, $options: 'i' } }, { manufacturer: { $regex: text, $options: 'i' } }];
    }
    const [total, medicines] = await Promise.all([Medicine.countDocuments(filter), Medicine.find(filter).select('name manufacturer quantity expiryDate purchasePrice unitsPerPack batches')
      .collation(MEDICINE_COLLATION).sort(MANUFACTURER_SORT).skip((page - 1) * limit).limit(limit)]);
    medicines.forEach(ensureBatches);
    res.json({ medicines, total, page, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};
export const receiveBatch = async (req, res, next) => {
  try {
    const result = await transaction(async session => {
      const medicine = await Medicine.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).session(session);
      if (!medicine) throw inventoryError('Medicine not found.', 404);
      const before = snapshotMedicine(medicine);
      addBatch(medicine, req.body);
      await medicine.save({ session });
      await auditStock(medicine, before, 'Batch received', req.user, session);
      return medicine;
    });
    res.status(201).json({ message: 'Batch received.', medicine: result });
  } catch (error) { next(error); }
};
export const listSuppliers = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.search) filter.name = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const total = await Supplier.countDocuments(filter);
    const [suppliers, balances] = await Promise.all([Supplier.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(), SupplierInvoice.aggregate([
      { $project: { supplierId: 1, balance: { $subtract: ['$total', { $add: [{ $sum: '$payments.amount' }, { $sum: '$returns.credit' }] }] } } },
      { $group: { _id: '$supplierId', balance: { $sum: '$balance' }, invoiceCount: { $sum: 1 } } },
    ])]);
    const rows = suppliers.map(supplier => ({ ...supplier, ...(balances.find(b => String(b._id) === String(supplier._id)) || { balance: 0, invoiceCount: 0 }), _id: supplier._id }));
    res.json(req.query.page !== undefined ? { suppliers: rows, total, page, pages: Math.ceil(total / limit) } : rows);
  } catch (error) { next(error); }
};
export const createSupplier = async (req, res, next) => {
  try {
    if (!String(req.body.name || '').trim()) throw inventoryError('Supplier name is required.');
    const supplier = await Supplier.create({ name: String(req.body.name).trim(), phone: String(req.body.phone || '').trim(),
      address: String(req.body.address || '').trim(), createdBy: req.user._id });
    res.status(201).json(supplier);
  } catch (error) { next(error); }
};
export const listInvoices = async (req, res, next) => {
  try {
    const filter = req.query.supplierId ? { supplierId: req.query.supplierId } : {};
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    const invoices = await SupplierInvoice.find(filter).populate('supplierId', 'name phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    if (req.query.page !== undefined) {
      const total = await SupplierInvoice.countDocuments(filter);
      return res.json({ invoices: invoices.map(invoiceView), total, page, pages: Math.ceil(total / limit) });
    }
    res.json(invoices.map(invoiceView));
  } catch (error) { next(error); }
};
export const receiveInvoice = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.items) || !req.body.items.length || req.body.items.length > 100) throw inventoryError('Select 1–100 purchase lines.');
    const invoice = await transaction(async session => {
      const supplier = await Supplier.findById(req.body.supplierId).session(session);
      if (!supplier) throw inventoryError('Supplier not found.', 404);
      const items = [];
      for (const input of req.body.items) {
        const medicine = await Medicine.findOne({ _id: input.medicineId, isDeleted: { $ne: true } }).session(session);
        if (!medicine) throw inventoryError('Medicine not found.', 404);
        const previousValues = snapshotMedicine(medicine);
        const batch = addBatch(medicine, { ...input, supplierId: supplier._id });
        await medicine.save({ session });
        await auditStock(medicine, previousValues, 'Supplier purchase received', req.user, session);
        items.push({ medicineId: medicine._id, medicineName: medicine.name, batchId: batch._id, batchNumber: batch.batchNumber,
          quantity: batch.quantity, purchaseCost: batch.purchaseCost, expiryDate: batch.expiryDate });
      }
      const number = String(req.body.invoiceNumber || '').trim();
      if (!number) throw inventoryError('Supplier invoice number is required.');
      const [created] = await SupplierInvoice.create([{ supplierId: supplier._id, invoiceNumber: number,
        dueDate: dueDate(req.body.dueDate), total: roundMoney(items.reduce((sum, i) => sum + i.quantity * i.purchaseCost, 0)), items,
        payments: [], returns: [], createdBy: req.user._id }], { session });
      return created;
    });
    res.status(201).json(invoiceView(invoice));
  } catch (error) { next(error); }
};
export const payInvoice = async (req, res, next) => {
  try {
    const payment = amount(req.body.amount);
    if (!payment) throw inventoryError('Payment must be positive.');
    const invoice = await transaction(async session => {
      const invoice = await SupplierInvoice.findById(req.params.id).session(session);
      if (!invoice) throw inventoryError('Invoice not found.', 404);
      if (payment > invoiceView(invoice).balance) throw inventoryError('Payment exceeds the outstanding balance.');
      const fromCashDrawer = req.body.fromCashDrawer === true;
      invoice.payments.push({ amount: payment, fromCashDrawer, recordedBy: req.user._id });
      if (fromCashDrawer) {
        const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        let cash = await CashSession.findOne({ date }).session(session);
        if (!cash) cash = new CashSession({ date, updatedBy: req.user._id });
        cash.expenses.push({ amount: payment, reason: `Supplier payment: ${invoice.invoiceNumber}`, recordedBy: req.user._id });
        cash.updatedBy = req.user._id;
        await cash.save({ session });
      }
      return invoice.save({ session });
    });
    res.json(invoiceView(invoice));
  } catch (error) { next(error); }
};
export const returnPurchase = async (req, res, next) => {
  try {
    const quantity = whole(req.body.quantity);
    const reason = String(req.body.reason || '').trim();
    if (!reason) throw inventoryError('Return reason is required.');
    const invoice = await transaction(async session => {
      const invoice = await SupplierInvoice.findById(req.params.id).session(session);
      if (!invoice) throw inventoryError('Invoice not found.', 404);
      const line = invoice.items.find(item => String(item.batchId) === String(req.body.batchId));
      if (!line) throw inventoryError('Batch does not belong to this invoice.');
      const returned = invoice.returns.filter(ret => String(ret.batchId) === String(line.batchId)).reduce((sum, ret) => sum + ret.quantity, 0);
      if (returned + quantity > line.quantity) throw inventoryError('Return exceeds purchased quantity.');
      const credit = roundMoney(quantity * line.purchaseCost);
      const medicine = await Medicine.findById(line.medicineId).session(session);
      const batch = medicine?.batches.id(line.batchId);
      if (!batch || batch.quantity < quantity) throw inventoryError('Not enough units remain in this batch.', 409);
      const before = snapshotMedicine(medicine);
      batch.quantity -= quantity;
      syncBatchTotals(medicine);
      await medicine.save({ session });
      await auditStock(medicine, before, reason, req.user, session);
      invoice.returns.push({ batchId: line.batchId, quantity, credit, reason, recordedBy: req.user._id });
      return invoice.save({ session });
    });
    res.json(invoiceView(invoice));
  } catch (error) { next(error); }
};
export const getCreditStatement = async (req, res, next) => {
  try {
    const record = await Udhar.findById(req.params.id).populate('recordedBy', 'name');
    if (!record) throw inventoryError('Credit account not found.', 404);
    const entries = [...record.items.map(item => ({ date: item.dateTaken, description: item.medicineName, debit: item.totalPrice, credit: 0 })),
      ...record.payments.map(payment => ({ date: payment.paidAt, description: payment.note || 'Payment', debit: 0, credit: payment.amount, receiptId: payment._id }))]
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0;
    res.json({ customer: { name: record.customerName, phone: record.customerPhone, address: record.customerAddress },
      dueDate: record.dueDate, total: record.totalAmount, paid: record.totalPaid, remaining: record.remainingAmount,
      entries: entries.map(entry => ({ ...entry, balance: balance = roundMoney(balance + entry.debit - entry.credit) })) });
  } catch (error) { next(error); }
};
export const updateCreditDueDate = async (req, res, next) => {
  try {
    const record = await Udhar.findById(req.params.id);
    if (!record) throw inventoryError('Credit account not found.', 404);
    record.dueDate = dueDate(req.body.dueDate) || null;
    await record.save();
    res.json(record);
  } catch (error) { next(error); }
};
export const getCashSession = async (req, res, next) => {
  try {
    const date = req.query.date;
    const range = dateRange(date);
    const [cash, sales, refunds, repayments] = await Promise.all([
      CashSession.findOne({ date }).lean(),
      Bill.aggregate([{ $match: { ...saleDateFilter({ $gte: range.start, $lte: range.end }), paymentMethod: 'Cash', orderStatus: { $nin: ['PENDING', 'REJECTED'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      SaleReturn.aggregate([{ $match: { date: { $gte: range.start, $lte: range.end } } }, { $lookup: { from: 'bills', localField: 'sale_id', foreignField: '_id', as: 'sale' } }, { $match: { 'sale.paymentMethod': 'Cash' } }, { $group: { _id: null, total: { $sum: '$refund_amount' } } }]),
      Udhar.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paidAt': { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, total: { $sum: '$payments.amount' } } }]),
    ]);
    const value = cash || { date, openingCash: 0, countedCash: null, expenses: [], notes: '' };
    const cashSales = sales[0]?.total || 0, cashRefunds = refunds[0]?.total || 0, creditRecovered = repayments[0]?.total || 0;
    const totalExpenses = roundMoney(value.expenses.reduce((sum, expense) => sum + expense.amount, 0));
    const expectedCash = roundMoney(value.openingCash + cashSales + creditRecovered - cashRefunds - totalExpenses);
    res.json({ ...value, cashSales, cashRefunds, creditRecovered, totalExpenses, expectedCash,
      discrepancy: value.countedCash === null ? null : roundMoney(value.countedCash - expectedCash) });
  } catch (error) { next(error); }
};
export const saveCashSession = async (req, res, next) => {
  try {
    const date = req.body.date;
    dateRange(date);
    const cash = await transaction(async session => {
      let cash = await CashSession.findOne({ date }).session(session);
      if (!cash) cash = new CashSession({ date, updatedBy: req.user._id });
      if (req.body.openingCash !== undefined) cash.openingCash = amount(req.body.openingCash);
      if (req.body.countedCash !== undefined) cash.countedCash = req.body.countedCash === null ? null : amount(req.body.countedCash);
      if (req.body.notes !== undefined) cash.notes = String(req.body.notes);
      if (req.body.expense) {
        const value = amount(req.body.expense.amount), reason = String(req.body.expense.reason || '').trim();
        if (!value || !reason) throw inventoryError('Expense amount and reason are required.');
        cash.expenses.push({ amount: value, reason, recordedBy: req.user._id });
      }
      cash.updatedBy = req.user._id;
      return cash.save({ session });
    });
    res.json(cash);
  } catch (error) { next(error); }
};
