import test from 'node:test';
import assert from 'node:assert/strict';
import { getBillReturnSummary } from './billReturnSummary.js';

const bill = {
  subtotal: 1300,
  discount: 100,
  total: 1200,
  totalRefunded: 0,
  items: [
    { medicineId: 'med-a', name: 'Medicine A', quantity: 10, unitPrice: 100 },
    { medicineId: 'med-b', name: 'Medicine B', quantity: 3, unitPrice: 100 },
  ],
  returns: [],
};

test('a fully returned invoice is identified but its audit data is retained', () => {
  const summary = getBillReturnSummary({
    ...bill,
    totalRefunded: 1000,
    isReturned: true,
    returns: [
      { medicineId: 'med-a', quantityReturned: 10, refundAmount: 1000 },
    ],
    items: [bill.items[0]],
    subtotal: 1000,
    total: 1000,
  });

  assert.equal(summary.isFullyReturned, true);
  assert.equal(summary.returnStatus, 'FULLY_RETURNED');
  assert.equal(summary.netTotal, 0);
  assert.equal(summary.netItems[0].netQuantity, 0);
  assert.equal(summary.items[0].quantity, 10);
  assert.equal(summary.returns[0].quantityReturned, 10);
});

test('partial returns retain only the unreturned units and discounted revenue', () => {
  const summary = getBillReturnSummary({
    ...bill,
    totalRefunded: 461.54,
    returns: [{ medicineId: 'med-a', quantityReturned: 5, refundAmount: 461.54 }],
  });

  assert.equal(summary.isFullyReturned, false);
  assert.equal(summary.returnStatus, 'PARTIALLY_RETURNED');
  assert.equal(summary.netTotal, 738.46);
  assert.equal(summary.netItems[0].netQuantity, 5);
  assert.equal(summary.netItems[0].netSales, 461.54);
  assert.equal(summary.netItems[1].netQuantity, 3);
});

test('returns are allocated across duplicate invoice lines for the same medicine', () => {
  const summary = getBillReturnSummary({
    subtotal: 300,
    discount: 0,
    total: 300,
    returns: [{ medicineId: 'med-a', quantityReturned: 2, refundAmount: 200 }],
    items: [
      { medicineId: 'med-a', quantity: 1, unitPrice: 100 },
      { medicineId: 'med-a', quantity: 2, unitPrice: 100 },
    ],
  });

  assert.deepEqual(
    summary.netItems.map((item) => item.netQuantity),
    [0, 1]
  );
  assert.equal(summary.netQuantity, 1);
});
