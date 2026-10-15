// Copied into /app only by the isolated Docker test. Never runs on a business DB.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from './models/User.js';
import Medicine from './models/Medicine.js';
import Bill from './models/Bill.js';
import { generateAccessToken } from './utils/generateToken.js';

assert.equal(new URL(process.env.MONGO_URI).pathname, '/pharmadesk_docker_test');
await mongoose.connect(process.env.MONGO_URI);
try {
  const admin = await User.findOne({ role: 'superadmin' });
  const request = async (path, body) => {
    const response = await fetch('http://frontend/api' + path, {
      method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + generateAccessToken(admin._id, admin.role), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    assert.ok(response.ok, JSON.stringify(data)); return data;
  };
  const medicine = await Medicine.create({ name: 'Offline smoke fixture', quantity: 10, purchasePrice: 100,
    unitsPerPack: 10, price: 15, expiryDate: '2099-01-01', createdBy: admin._id });
  const untouched = await Medicine.create({ name: 'Unrelated offline fixture', quantity: 0, purchasePrice: 10, createdBy: admin._id });
  const sale = await request('/bills/instore', { items: [{ medicineId: medicine._id, quantity: 2 }], discount: 2 });
  assert.equal(sale.bill.total, 28); assert.equal((await Medicine.findById(medicine._id)).quantity, 8);
  assert.equal((await request('/bills/profit-summary')).dailyProfit, 8);
  await request(`/bills/${sale.bill._id}/return`, { returns: [{ medicineId: medicine._id, quantityReturned: 1, reason: 'Offline test' }] });
  assert.equal((await Medicine.findById(medicine._id)).quantity, 9);
  assert.equal((await Medicine.findById(untouched._id)).quantity, 0);
  assert.equal((await request('/bills/profit-summary')).dailyProfit, 4);
  assert.equal(await Bill.countDocuments(), 1);
  console.log('OFFLINE PASS: sale, discount, batch cost, partial refund, stock isolation and profit.');
} finally { await mongoose.disconnect(); }
