import test from 'node:test';
import assert from 'node:assert/strict';
import DeletionRequest from './DeletionRequest.js';
import SaleReturn from './SaleReturn.js';
import Udhar from './Udhar.js';
import Medicine from './Medicine.js';

test('deletion request records only supported targets and review states', () => {
  const request = new DeletionRequest({
    targetType: 'medicine',
    targetId: '507f1f77bcf86cd799439011',
    targetLabel: 'Paracetamol',
    requestedBy: '507f191e810c19729de860ea',
  });
  assert.equal(request.status, 'pending');
  assert.equal(request.validateSync(), undefined);
  request.status = 'deleted';
  assert.match(request.validateSync().errors.status.message, /is not a valid enum value/);
});

test('deletion request limits target types to medicines and bills', () => {
  const request = new DeletionRequest({
    targetType: 'user',
    targetId: '507f1f77bcf86cd799439011',
    targetLabel: 'user',
    requestedBy: '507f191e810c19729de860ea',
  });
  assert.match(request.validateSync().errors.targetType.message, /is not a valid enum value/);
});

test('medicine archive metadata defaults to active without removing the medicine record', () => {
  const medicine = new Medicine({
    name: 'Archive Test Medicine',
    expiryDate: new Date('2027-01-01'),
    price: 10,
    purchasePrice: 8,
    createdBy: '507f191e810c19729de860ea',
  });
  assert.equal(medicine.isDeleted, false);
  assert.equal(medicine.deletedAt, null);
  assert.equal(medicine.deletedBy, null);
  assert.equal(medicine.validateSync(), undefined);
  medicine.isDeleted = true;
  medicine.deletedAt = new Date('2026-10-09T00:00:00.000Z');
  medicine.deletedBy = '507f191e810c19729de860ea';
  assert.equal(medicine.validateSync(), undefined);
  assert.equal(String(medicine._id).length, 24);
});

test('refund records retain medicine and bill labels for the Admin audit feed', () => {
  const record = new SaleReturn({
    sale_id: '507f1f77bcf86cd799439011',
    item_id: '507f191e810c19729de860ea',
    item_name: 'Paracetamol',
    bill_number: 'BILL-TEST-1',
    qty_returned: 2,
    refund_amount: 100,
    reason: 'Wrong item',
    processed_by: '507f191e810c19729de860ea',
  });
  assert.equal(record.validateSync(), undefined);
});

test('Udhar payments store who received payment and when', () => {
  const payment = new Udhar({
    customerName: 'Test Customer',
    recordedBy: '507f191e810c19729de860ea',
    payments: [{ amount: 50, paidAt: new Date('2026-10-09T10:00:00.000Z'), paidBy: '507f191e810c19729de860ea' }],
  });
  assert.equal(payment.payments[0].amount, 50);
  assert.equal(String(payment.payments[0].paidBy), '507f191e810c19729de860ea');
  assert.equal(payment.payments[0].paidAt.toISOString(), '2026-10-09T10:00:00.000Z');
});
