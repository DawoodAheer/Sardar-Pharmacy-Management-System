import test from 'node:test';
import assert from 'node:assert/strict';
import { packUnitPrice, validBillLine } from './billingPack.js';

test('counter calculates pack price divided by tablets without prematurely rounding', () => {
  assert.equal(packUnitPrice('300','10'),30);
  assert.equal(packUnitPrice('400.73','20'),20.0365);
  assert.equal(packUnitPrice(315,1),315);
  for(const pair of [['',10],[300,''],[0,10],[-1,10],[300,1.5],[300,0],['abc',10]]) assert.equal(packUnitPrice(...pair),null);
});
test('sale quantity is checked against the corrected unit stock', () => {
  const item={packSalePrice:'300',unitsPerPack:'10',stock:30,quantity:'5'};
  assert.equal(validBillLine(item),true);
  assert.equal(30-Number(item.quantity),25);
  for(const quantity of ['',0,-1,31,1.5]) assert.equal(validBillLine({...item,quantity}),false);
});

test('whole packs deduct pack count times units and reject fractional packs', () => {
 const item={packSalePrice:300,unitsPerPack:10,stock:30,saleMode:'packs',packQuantity:2,quantity:20};
 assert.equal(validBillLine(item),true);
 assert.equal(packUnitPrice(300,10)*item.quantity,600);
 assert.equal(item.stock-item.quantity,10);
 assert.equal(validBillLine({...item,packQuantity:0.5,quantity:5}),false);
 assert.equal(validBillLine({...item,packQuantity:4,quantity:40}),false);
});
