import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExplicitDecimalPrice } from './ocrParsing.js';

test('parses an explicitly labeled decimal price without changing its value', () => {
  assert.equal(parseExplicitDecimalPrice('SALE PRICE: Rs. 133.45', 'sale'), 133.45);
});

test('does not invent a decimal when OCR returns only digits', () => {
  assert.equal(parseExplicitDecimalPrice('SALE PRICE: Rs. 13345', 'sale'), null);
});

test('does not treat an unlabeled decimal as a purchase price', () => {
  assert.equal(parseExplicitDecimalPrice('133.45', 'purchase'), null);
});

test('rejects unsupported price labels explicitly', () => {
  assert.throws(
    () => parseExplicitDecimalPrice('123.45', 'wholesale'),
    /Unsupported OCR price label/
  );
});
