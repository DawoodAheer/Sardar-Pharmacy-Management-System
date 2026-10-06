import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDiscountedReturnRefund,
  getNetItemAmounts,
  getSalePrice,
} from './billCalculations.js';

test('a bill-only sale price override does not replace the default medicine price', () => {
  const defaultPrice = 150;

  assert.equal(getSalePrice(120, defaultPrice), 120);
  assert.equal(getSalePrice(undefined, defaultPrice), 150);
  assert.equal(defaultPrice, 150);
});

test('sale prices must be finite, non-negative, and not below purchase cost', () => {
  assert.throws(() => getSalePrice(-1, 150), /non-negative/);
  assert.throws(() => getSalePrice('not-a-price', 150), /non-negative/);
  assert.throws(() => getSalePrice(90, 150, 100), /purchase price/);
  assert.equal(getSalePrice(100, 150, 100), 100);
});

test('profit uses the fixed purchase cost, invoice sale override, and discount', () => {
  const medicineDefaultPrice = 150;
  const invoiceSalePrice = getSalePrice(120, medicineDefaultPrice);
  const amounts = getNetItemAmounts({
    purchasePrice: 80,
    salePrice: invoiceSalePrice,
    quantity: 3,
    discountRatio: 0.1,
  });

  assert.equal(amounts.cost, 240);
  assert.equal(amounts.discountAmount, 36);
  assert.equal(amounts.netSales, 324);
  assert.equal(amounts.profit, 84);
  assert.equal(medicineDefaultPrice, 150);

  const exampleAmounts = getNetItemAmounts({
    purchasePrice: 100,
    salePrice: 120,
    quantity: 3,
    discountRatio: 0,
  });
  assert.equal(exampleAmounts.profit, 60);

  const afterOneReturned = getNetItemAmounts({
    purchasePrice: 100,
    salePrice: 120,
    quantity: 2,
    discountRatio: 0.05,
  });
  assert.equal(afterOneReturned.profit, 28);
});

test('discounted partial returns refund the discounted sale amount cumulatively', () => {
  const args = {
    itemSalePrice: 150,
    itemQuantity: 3,
    subtotal: 450,
    discount: 45,
  };

  const firstRefund = getDiscountedReturnRefund({
    ...args,
    quantityAlreadyReturned: 0,
    quantityToReturn: 1,
    previousItemRefunds: 0,
  });
  const finalRefund = getDiscountedReturnRefund({
    ...args,
    quantityAlreadyReturned: 1,
    quantityToReturn: 2,
    previousItemRefunds: firstRefund,
  });

  assert.equal(firstRefund, 135);
  assert.equal(finalRefund, 270);
  assert.equal(firstRefund + finalRefund, 405);
});
