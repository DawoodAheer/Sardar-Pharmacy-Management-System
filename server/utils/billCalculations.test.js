import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDiscountedReturnRefund,
  getNetItemAmounts,
  getSalePrice,
} from './billCalculations.js';
import { getPurchaseCostPerUnit } from './medicinePricing.js';

test('a bill-only sale price override does not replace the default medicine price', () => {
  const defaultPrice = 150;

  assert.equal(getSalePrice(120, defaultPrice), 120);
  assert.equal(getSalePrice(undefined, defaultPrice), 150);
  assert.equal(defaultPrice, 150);
});

test('sale prices must be finite and positive; loss-making prices are allowed', () => {
  assert.throws(() => getSalePrice(-1, 150), /positive/);
  assert.throws(() => getSalePrice(0, 150), /positive/);
  assert.throws(() => getSalePrice('not-a-price', 150), /positive/);
  assert.equal(getSalePrice(9, 150), 9);
  assert.equal(getSalePrice(10, 150), 10);
  assert.equal(getSalePrice(90, 150), 90);
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

test('a tablet sale uses its share of pack cost and allows a loss', () => {
  const tabletCost = getPurchaseCostPerUnit(100, 10);
  assert.equal(tabletCost, 10);
  assert.equal(getSalePrice(5, 20), 5);

  const amounts = getNetItemAmounts({
    purchasePrice: tabletCost,
    salePrice: 5,
    quantity: 1,
    discountRatio: 0,
  });
  assert.equal(amounts.cost, 10);
  assert.equal(amounts.profit, -5);
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
