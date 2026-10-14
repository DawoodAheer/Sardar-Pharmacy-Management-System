import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('manufacturer ordering across inventory, search and pages', { skip: !process.env.TEST_MONGO_URI, timeout: 60000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI);
  assert.ok(['127.0.0.1', 'localhost'].includes(uri.hostname));
  const databaseName = `pharmadesk_test_order_${randomUUID().replaceAll('-', '')}`;
  uri.pathname = `/${databaseName}`; process.env.MONGO_URI = uri.toString();
  process.env.JWT_ACCESS_SECRET = randomUUID();
  const { default: mongoose } = await import('mongoose');
  const { default: Medicine } = await import('../models/Medicine.js');
  const { default: User } = await import('../models/User.js');
  const { default: express } = await import('express');
  const { default: medicineRoutes } = await import('../routes/medicineRoutes.js');
  const { default: operationsRoutes } = await import('../routes/operationsRoutes.js');
  const { default: purchaseRoutes } = await import('../routes/purchaseOrderRoutes.js');
  const { errorHandler } = await import('../middleware/errorMiddleware.js');
  const { generateAccessToken } = await import('../utils/generateToken.js');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.create({ name: 'Ordering test', email: 'order@test.local', password: randomUUID(), role: 'superadmin' });
    const records = await Medicine.insertMany([
      { name: 'Aspirin', manufacturer: 'Paracetamol Company', expiryDate: '2099-01-01' },
      { name: 'Zinc', manufacturer: 'Dawood Company', expiryDate: '2099-04-01' },
      { name: 'Beta', manufacturer: 'dawood company', expiryDate: '2099-03-01' },
      { name: 'Alpha', manufacturer: 'DAWOOD COMPANY', expiryDate: '2099-02-01' },
    ].map(med => ({ ...med, purchasePrice: 10, quantity: 2, createdBy: admin._id })));
    await Medicine.init();
    const snapshot = JSON.stringify(await Medicine.find().sort({ _id: 1 }).lean());
    const app = express(); app.use(express.json()); app.use('/medicines', medicineRoutes); app.use('/operations', operationsRoutes); app.use('/purchase-orders', purchaseRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const get = async path => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { Authorization: `Bearer ${generateAccessToken(admin._id, admin.role)}` } });
      assert.equal(response.status, 200); return response.json();
    };
    await t.test('company is the primary order regardless of medicine initials and letter case', async () => {
      assert.deepEqual((await get('/medicines?page=1')).medicines.map(m => m.name), ['Alpha', 'Beta', 'Zinc', 'Aspirin']);
    });
    await t.test('pagination and manufacturer search use the same global ordering', async () => {
      const first = await get('/medicines?page=1&limit=2'), second = await get('/medicines?page=2&limit=2');
      assert.equal(first.total, 4); assert.deepEqual([...first.medicines, ...second.medicines].map(m => m.name), ['Alpha', 'Beta', 'Zinc', 'Aspirin']);
      assert.deepEqual((await get('/medicines?page=1&search=dawood')).medicines.map(m => m.name), ['Alpha', 'Beta', 'Zinc']);
    });
    await t.test('batch inventory and low-stock lists match company ordering', async () => {
      const batches = await get('/operations/batches?page=1&search=dawood');
      assert.deepEqual(batches.medicines.map(m => m.name), ['Alpha', 'Beta', 'Zinc']);
      assert.ok(batches.medicines.every(m => m.manufacturer));
      assert.deepEqual((await get('/purchase-orders/low-stock?page=1')).medicines.map(m => m.name), ['Alpha', 'Beta', 'Zinc', 'Aspirin']);
    });
    await t.test('expiry priority remains date-based and reads do not alter inventory', async () => {
      assert.deepEqual((await get('/medicines?page=1&sort=expiry')).medicines.map(m => m.name), ['Aspirin', 'Alpha', 'Beta', 'Zinc']);
      assert.equal(JSON.stringify(await Medicine.find().sort({ _id: 1 }).lean()), snapshot);
      assert.equal(await Medicine.countDocuments(), records.length);
    });
    await t.test('archived medicines use manufacturer order too', async () => {
      await Medicine.updateMany({}, { $set: { isDeleted: true } });
      assert.deepEqual((await get('/medicines/deleted?page=1')).medicines.map(m => m.name), ['Alpha', 'Beta', 'Zinc', 'Aspirin']);
    });
    await t.test('name and purchase cost alone save; invalid optional fields never silently change stock', async () => {
      const post = async body => fetch(`http://127.0.0.1:${server.address().port}/medicines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(admin._id, admin.role)}` }, body: JSON.stringify(body),
      });
      const result = await post({ name: 'Minimal medicine', purchasePrice: 100 });
      assert.equal(result.status, 201, await result.text());
      const saved = await Medicine.findOne({ name: 'Minimal medicine' });
      assert.equal(saved.quantity, 0); assert.equal(saved.price, 100); assert.equal(saved.unitsPerPack, 1); assert.equal(saved.expiryDate, null);
      const before = await Medicine.countDocuments();
      for (const fields of [{ quantity: -2 }, { quantity: 2.5 }, { unitsPerPack: 1.5 }, { price: -1 }, { expiryDate: '2027-02-30' }]) {
        const response = await post({ name: 'Invalid optional', purchasePrice: 100, ...fields });
        assert.equal(response.status, 400, await response.text());
      }
      assert.equal(await Medicine.countDocuments(), before);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
