import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('large Excel imports and fresh-PC startup preserve data', { skip: !process.env.TEST_MONGO_URI, timeout: 180000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI);
  assert.ok(['127.0.0.1', 'localhost'].includes(uri.hostname));
  const databaseName = `pharmadesk_test_import_${randomUUID().replaceAll('-', '')}`;
  uri.pathname = `/${databaseName}`;
  process.env.MONGO_URI = uri.toString();
  process.env.JWT_ACCESS_SECRET = randomUUID();
  const { default: mongoose } = await import('mongoose');
  const { default: express } = await import('express');
  const { default: Medicine } = await import('../models/Medicine.js');
  const { default: User } = await import('../models/User.js');
  const { default: MedicineAudit } = await import('../models/MedicineAudit.js');
  const { default: MedicineImportIssue } = await import('../models/MedicineImportIssue.js');
  const { default: medicineRoutes } = await import('../routes/medicineRoutes.js');
  const { errorHandler } = await import('../middleware/errorMiddleware.js');
  const { defaultAccounts, autoSeedIfEmpty } = await import('../utils/autoSeeder.js');
  const { generateAccessToken } = await import('../utils/generateToken.js');
  const { createMedicineInventoryWorkbook } = await import('../../client/src/utils/medicineExport.js');
  const { extractMedicineWorkbookRows } = await import('../../client/src/utils/excelImport.js');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all(Object.values(mongoose.models).map(Model => Model.init()));
    await t.test('fresh setup creates exactly three approved accounts and no medicines', async () => {
      await autoSeedIfEmpty();
      assert.equal(await User.countDocuments(), 3); assert.equal(await Medicine.countDocuments(), 0);
      assert.equal(await mongoose.model('Bill').countDocuments(), 0);
      for (const account of defaultAccounts) {
        const user = await User.findOne({ email: account.email });
        assert.equal(user.role, account.role); assert.equal(user.accountStatus, 'approved');
        assert.ok(await user.matchPassword('Dawood@@5786'));
      }
    });
    const admin = await User.findOne({ role: 'superadmin' });
    const app = express(); app.use(express.json({ limit: '50mb' })); app.use('/api/medicines', medicineRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const send = async body => {
      const result = await fetch(`http://127.0.0.1:${server.address().port}/api/medicines/bulk`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(admin._id, admin.role)}` }, body: JSON.stringify(body) });
      return { status: result.status, data: await result.json() };
    };
    const rows = extractMedicineWorkbookRows(createMedicineInventoryWorkbook(Array.from({ length: 5000 }, (_, i) => ({
      name: `Import test ${i}`, manufacturer: 'Test', purchasePrice: 100, unitsPerPack: 10,
      price: 12.5, quantity: 20, expiryDate: '2099-01-01', rackLocation: 'A1',
    })))).rows;
    const body = { sourceFile: '5000-row-test.xlsx', medicines: rows };
    await t.test('5,000-row preview changes no database records', async () => {
      const preview = await send({ ...body, dryRun: true });
      assert.equal(preview.status, 200); assert.equal(preview.data.validCount, 5000);
      assert.equal(await Medicine.countDocuments(), 0);
    });
    await t.test('5,000 rows commit with their audits and a retry never duplicates stock', async () => {
      const started = performance.now();
      const result = await send(body);
      assert.equal(result.status, 201, JSON.stringify(result.data)); assert.equal(result.data.insertedCount, 5000);
      console.log(`5000-row import completed in ${Math.round(performance.now() - started)} ms`);
      assert.equal(await Medicine.countDocuments(), 5000); assert.equal(await MedicineAudit.countDocuments(), 5000);
      assert.equal((await send(body)).data.replayed, true);
      assert.equal(await Medicine.countDocuments(), 5000);
      assert.equal((await Medicine.aggregate([{ $group: { _id: null, quantity: { $sum: '$quantity' } } }]))[0].quantity, 100000);
    });
    await t.test('invalid stock remains available for correction without changing existing records', async () => {
      const result = await send({ sourceFile: 'bad-row.xlsx', medicines: [{ name: 'Bad stock', purchasePrice: 100, quantity: '2.5' }] });
      assert.equal(result.data.insertedCount, 0); assert.equal(result.data.skippedCount, 1);
      const issue = await MedicineImportIssue.findOne({ sourceFile: 'bad-row.xlsx' });
      assert.equal(issue.originalRow.quantity, '2.5'); assert.equal(await Medicine.countDocuments(), 5000);
    });
    await t.test('concurrent different files cannot add the same medicine twice', async () => {
      const medicine = { name: 'Concurrent import', purchasePrice: 100, quantity: 5 };
      const results = await Promise.all(['first.xlsx', 'second.xlsx'].map(sourceFile => send({ sourceFile, medicines: [medicine] })));
      assert.ok(results.every(r => r.status === 201), JSON.stringify(results));
      assert.equal(results.reduce((sum, r) => sum + r.data.insertedCount, 0), 1);
      assert.equal(await Medicine.countDocuments({ name: medicine.name }), 1);
    });
    await t.test('startup and account setup can repeat without deleting stock or resetting passwords', async () => {
      admin.password = 'Changed-test-password'; await admin.save();
      await autoSeedIfEmpty(); await autoSeedIfEmpty();
      assert.equal(await User.countDocuments(), 3); assert.equal(await Medicine.countDocuments(), 5001);
      assert.ok(await (await User.findById(admin._id)).matchPassword('Changed-test-password'));
    });
    await t.test('a failure during audit storage rolls back the import and a retry can succeed', async () => {
      const before = await Medicine.countDocuments();
      const originalInsert = MedicineAudit.insertMany;
      const body = { sourceFile: 'rollback-test.xlsx', medicines: [{ name: 'Rollback test', purchasePrice: 100, quantity: 10 }] };
      try {
        MedicineAudit.insertMany = async () => { throw new Error('Simulated audit storage failure'); };
        assert.equal((await send(body)).status, 500);
        assert.equal(await Medicine.countDocuments(), before);
        assert.equal(await Medicine.countDocuments({ name: 'Rollback test' }), 0);
      } finally { MedicineAudit.insertMany = originalInsert; }
      assert.equal((await send(body)).data.insertedCount, 1);
      assert.equal(await Medicine.countDocuments(), before + 1);
    });
    const resolve = async (id, body, user = admin) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/medicines/import-issues/${id}/resolve`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(user._id, user.role)}` }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };
    await t.test('a duplicate can be corrected and added without overwriting the original stock', async () => {
      const original = await Medicine.findOne({ name: 'Import test 0' });
      const snapshot = JSON.stringify(original.toObject());
      const issue = await MedicineImportIssue.create({ sourceFile: 'duplicate.xlsx', rowNumber: 2, originalRow: { 'Medicine name': original.name }, createdBy: admin._id });
      const body = { name: original.name, manufacturer: original.manufacturer, purchasePrice: 100, quantity: 7 };
      assert.equal((await resolve(issue._id, body)).status, 409);
      assert.equal((await MedicineImportIssue.findById(issue._id)).status, 'pending');
      const result = await resolve(issue._id, { ...body, name: 'Corrected duplicate fixture' });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      assert.equal(result.data.medicine.quantity, 7);
      assert.equal((await MedicineImportIssue.findById(issue._id)).status, 'resolved');
      assert.equal(await MedicineAudit.countDocuments({ medicineId: result.data.medicine._id }), 1);
      assert.equal(JSON.stringify((await Medicine.findById(original._id)).toObject()), snapshot);
      assert.equal((await resolve(issue._id, { ...body, name: 'Retry must not add' })).status, 404);
    });
    await t.test('concurrent duplicate corrections only add one medicine and pending rows are paginated', async () => {
      const issues = await MedicineImportIssue.insertMany(Array.from({ length: 23 }, (_, index) => ({ rowNumber: index + 2,
        sourceFile: 'pagination-test.xlsx', originalRow: { name: 'Duplicate row' }, createdBy: admin._id })));
      const body = { name: 'Concurrent correction fixture', purchasePrice: 100, quantity: 3 };
      const customer = await User.findOne({ role: 'customer' });
      assert.equal((await resolve(issues[0]._id, body, customer)).status, 403);
      const outcomes = await Promise.all(issues.slice(0, 2).map(issue => resolve(issue._id, body)));
      assert.deepEqual(outcomes.map(result => result.status).sort(), [201, 409]);
      assert.equal(await Medicine.countDocuments({ name: body.name }), 1);
      const getPage = async page => (await fetch(`http://127.0.0.1:${server.address().port}/api/medicines/import-issues?page=${page}&limit=10`,
        { headers: { Authorization: `Bearer ${generateAccessToken(admin._id, admin.role)}` } })).json();
      const first = await getPage(1), second = await getPage(2);
      assert.equal(first.issues.length, 10); assert.equal(second.issues.length, 10); assert.ok(first.pages >= 3);
      assert.ok(!first.issues.some(a => second.issues.some(b => a._id === b._id)));
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
