import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDailyClosing } from './dailyClosing.js';

test('daily close reconciles Cash, Card, UPI, same-day refunds, udhar issued and recovered', () => {
  const result = summarizeDailyClosing({
    bills: [{ total: 100, paymentMethod: 'Cash' }, { total: 50, paymentMethod: 'Card' }, { total: 25, paymentMethod: 'UPI' }],
    returns: [{ refund_amount: 10, sale_id: { paymentMethod: 'Cash' } }, { refund_amount: 5, sale_id: { paymentMethod: 'UPI' } }],
    creditIssued: 70, creditRecovered: 20,
  });
  assert.deepEqual(result.salesByMethod, { Cash: 100, Card: 50, Online: 25 });
  assert.deepEqual(result.refundsByMethod, { Cash: 10, Card: 0, Online: 5 });
  assert.equal(result.grossSales, 175);
  assert.equal(result.refunds, 15);
  assert.equal(result.netSalesAfterRefunds, 160);
  assert.equal(result.udharCreditIssued, 70);
  assert.equal(result.udharRecovered, 20);
  assert.equal(result.netCollections, 180);
});

test('maps legacy UPI and Online bills into one online close total', () => {
  const result = summarizeDailyClosing({ bills: [{ total: 12, paymentMethod: 'UPI' }, { total: 15, paymentMethod: 'Online' }] });
  assert.equal(result.salesByMethod.Online, 27);
  assert.equal(result.netCollections, 27);
});
