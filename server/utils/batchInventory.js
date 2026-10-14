import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import { checkExpiryStatus } from './expiryCheck.js';

export const inventoryError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function saleExpiryStatus(medicine) {
  if (!medicine.batches?.length) return checkExpiryStatus(medicine.expiryDate);
  const available = medicine.batches.filter(batch => batch.quantity > 0 && checkExpiryStatus(batch.expiryDate) !== 'EXPIRED')
    .sort((a, b) => (a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity) - (b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity));
  return available.length ? checkExpiryStatus(available[0].expiryDate) : 'EXPIRED';
}

// Existing stock becomes a single legacy lot on its first transactional change.
export function ensureBatches(medicine) {
  if (!medicine.batches?.length && medicine.quantity > 0) {
    medicine.batches = [{ batchNumber: 'LEGACY', quantity: medicine.quantity,
      expiryDate: medicine.expiryDate, purchaseCost: roundMoney(medicine.purchasePrice / (medicine.unitsPerPack || 1)) }];
  }
  return medicine.batches || [];
}

export function syncBatchTotals(medicine) {
  medicine.quantity = medicine.batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const stocked = medicine.batches.filter(batch => batch.quantity > 0);
  const sellable = stocked.filter(batch => checkExpiryStatus(batch.expiryDate) !== 'EXPIRED');
  const dated = (sellable.length ? sellable : stocked).filter(batch => batch.expiryDate)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  medicine.expiryDate = dated[0]?.expiryDate || undefined;
}

export function allocateBatches(medicine, quantity, { allowExpired = false } = {}) {
  ensureBatches(medicine);
  if (!Number.isInteger(quantity) || quantity < 1) throw inventoryError('Quantity must be positive whole units.');
  const batches = medicine.batches.filter(batch => batch.quantity > 0 &&
    (allowExpired || checkExpiryStatus(batch.expiryDate) !== 'EXPIRED'))
    .sort((a, b) => (a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity) -
      (b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity));
  if (batches.reduce((sum, batch) => sum + batch.quantity, 0) < quantity) {
    throw inventoryError(`Not enough ${allowExpired ? '' : 'unexpired '}stock for ${medicine.name}.`, 409);
  }
  let remaining = quantity;
  const allocations = [];
  for (const batch of batches) {
    const used = Math.min(remaining, batch.quantity);
    if (!used) continue;
    allocations.push({ batchId: batch._id, batchNumber: batch.batchNumber, quantity: used,
      purchaseCost: batch.purchaseCost, expiryDate: batch.expiryDate });
    batch.quantity -= used;
    remaining -= used;
    if (!remaining) break;
  }
  syncBatchTotals(medicine);
  return allocations;
}

export function addBatch(medicine, input) {
  ensureBatches(medicine);
  const quantity = Number(input.quantity);
  const cost = Number(input.purchaseCost);
  const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(cost) || cost < 0) {
    throw inventoryError('Batch quantity must be positive whole units and cost must be a non-negative number.');
  }
  if (!expiry || Number.isNaN(expiry.getTime()) || checkExpiryStatus(expiry) === 'EXPIRED') {
    throw inventoryError('A valid, unexpired batch expiry date is required.');
  }
  const number = String(input.batchNumber || '').trim();
  if (!number) throw inventoryError('Batch number is required.');
  if (medicine.batches.some(batch => batch.batchNumber === number)) throw inventoryError('This batch number already exists for the medicine.', 409);
  medicine.batches.push({ _id: new mongoose.Types.ObjectId(), batchNumber: number,
    quantity, purchaseCost: roundMoney(cost), expiryDate: expiry, supplierId: input.supplierId || null });
  syncBatchTotals(medicine);
  return medicine.batches.at(-1);
}

export async function consumeStock(medicineId, quantity, session) {
  const medicine = await Medicine.findById(medicineId).session(session);
  if (!medicine || medicine.isDeleted) throw inventoryError('Medicine is unavailable.', 409);
  const allocations = allocateBatches(medicine, quantity);
  await medicine.save({ session });
  return allocations;
}

export async function allocateBillStock(bill, session) {
  for (const item of bill.items) {
    item.batchAllocations = await consumeStock(item.medicineId, item.quantity, session);
    item.purchasePrice = item.batchAllocations.reduce((sum, batch) => sum + batch.purchaseCost * batch.quantity, 0) / item.quantity;
    item.expiryDate = item.batchAllocations[0]?.expiryDate;
    item.expiryStatus = checkExpiryStatus(item.expiryDate);
  }
  await bill.save({ session });
}

export function restoreReturnedBatches(medicine, items, quantity, alreadyReturned) {
  ensureBatches(medicine);
  const allocations = items.flatMap(item => item.batchAllocations?.length ? item.batchAllocations : [{
    batchId: null, batchNumber: 'LEGACY-RETURN', quantity: item.quantity,
    purchaseCost: item.purchasePrice || 0, expiryDate: item.expiryDate,
  }]);
  let skip = alreadyReturned;
  let remaining = quantity;
  for (const allocation of allocations) {
    const skipped = Math.min(skip, allocation.quantity);
    skip -= skipped;
    const restored = Math.min(remaining, allocation.quantity - skipped);
    if (!restored) continue;
    let batch = allocation.batchId ? medicine.batches.id(allocation.batchId) :
      medicine.batches.find(value => value.batchNumber === allocation.batchNumber &&
        String(value.expiryDate) === String(allocation.expiryDate));
    if (!batch) {
      medicine.batches.push({ batchNumber: allocation.batchNumber, quantity: 0,
        purchaseCost: allocation.purchaseCost, expiryDate: allocation.expiryDate });
      batch = medicine.batches.at(-1);
    }
    batch.quantity += restored;
    remaining -= restored;
    if (!remaining) break;
  }
  if (remaining) throw inventoryError('Return batch allocation does not match the original sale.', 409);
  syncBatchTotals(medicine);
}
