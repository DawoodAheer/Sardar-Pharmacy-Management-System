import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('counter trial using a copied real inventory medicine without live changes', { skip: !process.env.TEST_MONGO_URI || !process.env.TEST_INVENTORY_SNAPSHOT, timeout: 120000 }, async () => {
  const uri = new URL(process.env.TEST_MONGO_URI);
  assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname));
  const databaseName = 'pharmadesk_test_counter_' + randomUUID().replaceAll('-', '');
  uri.pathname = '/' + databaseName; process.env.MONGO_URI = uri.toString(); process.env.OFFLINE_MODE = 'true';
  const snapshot = JSON.parse(await readFile(process.env.TEST_INVENTORY_SNAPSHOT, 'utf8'));
  const source = snapshot.collections.medicines.find(m => !m.isDeleted && m.unitsPerPack > 1 && Number.isSafeInteger(m.unitsPerPack) && m.quantity >= m.unitsPerPack + 5 && m.price > 1 && new Date(m.expiryDate) > new Date());
  assert.ok(source, 'No suitable tablet pack in the snapshot');
  const { default: mongoose } = await import('mongoose');
  const { default: express } = await import('express');
  const { default: Medicine } = await import('../models/Medicine.js');
  const { default: User } = await import('../models/User.js');
  const { default: billRoutes } = await import('../routes/billRoutes.js');
  const { default: medicineRoutes } = await import('../routes/medicineRoutes.js');
  const { generateAccessToken } = await import('../utils/generateToken.js');
  const { errorHandler } = await import('../middleware/errorMiddleware.js');
  let server;
  try {
    await mongoose.connect(uri.toString()); await Promise.all(Object.values(mongoose.models).map(Model => Model.init()));
    const admin = await User.create({ name: 'Isolated counter Admin', email: 'counter@test.local', password: randomUUID(), role: 'superadmin', accountStatus: 'approved' });
    const med = await Medicine.create({ ...source, _id: undefined, createdBy: admin._id });
    const original = med.quantity, units = med.unitsPerPack, packSalePrice = med.price * units;
    const app = express(); app.use(express.json()); app.use('/bills', billRoutes); app.use('/medicines', medicineRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const post = async (path, body, expected) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { Authorization: 'Bearer ' + generateAccessToken(admin._id, admin.role), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
    };
    await post('/bills/instore', { items: [{ medicineId: med._id, quantity: 1, packSalePrice, unitsPerPack: units }], discount: -0.001 }, 400);
    assert.equal((await Medicine.findById(med._id)).quantity, original);
    const loose = await post('/bills/instore', { items: [{ medicineId: med._id, quantity: 5, packSalePrice, unitsPerPack: units }], discount: 1 }, 201);
    assert.equal((await Medicine.findById(med._id)).quantity, original - 5);
    assert.equal(loose.bill.total, Math.round((5 * med.price - 1) * 100) / 100);
    await post('/bills/instore', { items: [{ medicineId: med._id, quantity: units, packSalePrice, unitsPerPack: units }] }, 201);
    assert.equal((await Medicine.findById(med._id)).quantity, original - 5 - units);
    await post(`/bills/${loose.bill._id}/return`, { returns: [{ medicineId: med._id, quantityReturned: 5, reason: 'Isolated trial' }] }, 200);
    assert.equal((await Medicine.findById(med._id)).quantity, original - units);
    const pending = await post('/medicines', { name: med.name, purchasePrice: med.purchasePrice, unitsPerPack: units, quantity: 10, price: med.price, expiryDate: med.expiryDate }, 202);
    assert.equal((await Medicine.findById(med._id)).quantity, original - units);
    await post(`/medicines/import-issues/${pending.issueId}/approve-stock`, { medicineId: med._id, expectedQuantity: original - units }, 200);
    assert.equal((await Medicine.findById(med._id)).quantity, original - units + 10);
    assert.equal(await Medicine.countDocuments(), 1);
    console.log('COPIED-INVENTORY PASS: loose tablets, full pack, discount, refund and Admin duplicate approval; live records untouched.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
