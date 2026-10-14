import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('capacity, background jobs and backup recovery', { skip: !process.env.TEST_MONGO_URI, timeout: 240000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI);
  assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname));
  const databaseName = `pharmadesk_test_capacity_${randomUUID().replaceAll('-', '')}`;
  uri.pathname = `/${databaseName}`; process.env.MONGO_URI = uri.toString();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pharmadesk-capacity-'));
  process.env.PHARMADESK_BACKUP_DIR = path.join(temporary, 'backups');
  process.env.PHARMADESK_BACKUP_SHARE_DIR = path.join(temporary, 'sharing');
  const { default: mongoose } = await import('mongoose');
  const { default: Medicine } = await import('../models/Medicine.js');
  const { default: User } = await import('../models/User.js');
  const { default: Bill } = await import('../models/Bill.js');
  const { default: BackgroundJob } = await import('../models/BackgroundJob.js');
  const { inventorySummary } = await import('../controllers/dashboardController.js');
  const { getAllMedicines } = await import('../controllers/medicineController.js');
  const { profitStages } = await import('../utils/profitAggregation.js');
  const { getBillReturnSummary } = await import('../utils/billReturnSummary.js');
  const { startJobQueue, stopJobQueue, enqueueJob, JOB_DIR } = await import('../utils/backgroundJobs.js');
  const { getBackupStatus, validateBackup } = await import('../utils/backupManager.js');
  const artifacts = [];
  const invoke = (handler, req) => new Promise((resolve, reject) => handler(req, { json: resolve, status() { return this; } }, reject));
  async function completed(id) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const job = await BackgroundJob.findById(id).lean();
      if (job.status === 'failed') throw new Error(job.error);
      if (job.status === 'completed') return job;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error('Worker timed out');
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.create({ name: 'Capacity test', email: 'capacity@test.local', password: randomUUID(), role: 'superadmin' });
    await BackgroundJob.init();
    await t.test('50,000 medicines return bounded pages and correct database totals', async () => {
      for (let offset = 0; offset < 50000; offset += 1000) await Medicine.insertMany(Array.from({ length: 1000 }, (_, i) => ({ name: `Capacity ${String(offset + i).padStart(6, '0')}`, quantity: 10, purchasePrice: 100, unitsPerPack: 10, price: 12, createdBy: admin._id, expiryDate: '2099-01-01' })));
      const start = performance.now();
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => invoke(getAllMedicines, { query: { page: i + 1, limit: 50 }, user: admin })));
      assert.ok(results.every(result => result.medicines.length === 50 && result.total === 50000));
      assert.equal(new Set(results.flatMap(result => result.medicines.map(m => String(m._id)))).size, 500);
      const summary = await inventorySummary(); assert.equal(summary.total, 50000); assert.equal(summary.stockValue, 5000000);
      console.log(`50,000 medicines: ten concurrent pages ${Math.round(performance.now() - start)} ms`);
    });
    await t.test('database profit matches batch costs after partial returns and repeated medicine lines', async () => {
      const med = await Medicine.findOne();
      const bill = await Bill.create({ customerName: 'Test', pharmacistId: admin._id, billType: 'INSTORE', subtotal: 210, total: 210, totalRefunded: 120, items: [
        { medicineId: med._id, name: med.name, quantity: 4, unitPrice: 30, purchasePrice: 12.5, expiryStatus: 'SAFE', batchAllocations: [{ quantity: 3, purchaseCost: 10 }, { quantity: 1, purchaseCost: 20 }] },
        { medicineId: med._id, name: med.name, quantity: 3, unitPrice: 30, purchasePrice: 25, expiryStatus: 'SAFE' },
      ], returns: [{ medicineId: med._id, name: med.name, quantityReturned: 4, unitPrice: 30, refundAmount: 120 }] });
      const expected = getBillReturnSummary(bill); const cost = expected.netItems.reduce((sum, item) => sum + item.netQuantity * item.purchasePrice, 0);
      const [actual] = await Bill.aggregate([{ $match: { _id: bill._id } }, ...profitStages()]);
      assert.equal(actual.profit, expected.netTotal - cost);
    });
    await startJobQueue();
    await t.test('background export leaves list reads available and produces all records', async () => {
      const queued = await enqueueJob('export', admin._id);
      await invoke(getAllMedicines, { query: { page: 2 }, user: admin });
      const job = await completed(queued.jobId); artifacts.push(job.artifact);
      const csv = await fs.readFile(path.join(JOB_DIR, job.artifact), 'utf8'); assert.equal(csv.trim().split('\n').length, 50001);
    });
    await t.test('background import retries do not duplicate stock', async () => {
      const payload = { medicines: [{ name: 'Worker medicine', quantity: 2, purchasePrice: 10 }], sourceFile: 'worker-test', background: true };
      const first = await completed((await enqueueJob('import', admin._id, payload)).jobId); assert.equal(first.result.insertedCount, 1);
      const second = await completed((await enqueueJob('import', admin._id, payload)).jobId); assert.equal(second.result.replayed, true);
      assert.equal(await Medicine.countDocuments({ name: 'Worker medicine' }), 1);
    });
    await t.test('background backup creates a verified share copy and restores in an isolated database', async () => {
      await completed((await enqueueJob('backup', admin._id)).jobId);
      const status = await getBackupStatus(); assert.ok(status.sharePath.startsWith(process.env.PHARMADESK_BACKUP_SHARE_DIR)); assert.equal(status.shareError, null);
      const copy = JSON.parse(await fs.readFile(status.sharePath, 'utf8')); validateBackup(copy); assert.equal(copy.collections.medicines.length, 50001);
      const recovery = await completed((await enqueueJob('verify', admin._id)).jobId); assert.ok(recovery.result.message.includes('verified'));
      assert.equal(await Medicine.countDocuments(), 50001);
    });
    await t.test('interrupted jobs remain visible as failures after restart', async () => {
      stopJobQueue(); await BackgroundJob.create({ type: 'export', status: 'running', owner: admin._id });
      await startJobQueue(); assert.equal(await BackgroundJob.countDocuments({ status: 'running' }), 0);
      assert.ok(await BackgroundJob.exists({ status: 'failed' }));
    });
    await t.test('archive deletion protects permissions and accounting and saves a safety backup', async () => {
      const { default: express } = await import('express');
      const { default: routes } = await import('../routes/medicineRoutes.js');
      const { errorHandler } = await import('../middleware/errorMiddleware.js');
      const { generateAccessToken } = await import('../utils/generateToken.js');
      const customer = await User.create({ name: 'Customer', email: 'customer@test.local', password: randomUUID(), role: 'customer', accountStatus: 'approved' });
      const staff = await User.create({ name: 'Staff', email: 'staff@test.local', password: randomUUID(), role: 'pharmacist', accountStatus: 'approved' });
      const app = express(); app.use(express.json()); app.use('/medicines', routes); app.use(errorHandler);
      const listener = app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
      const remove = async (id, actor = admin, confirmation = 'DELETE') => {
        const response = await fetch(`http://127.0.0.1:${listener.address().port}/medicines/${id}/permanent`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(actor._id, actor.role)}` }, body: JSON.stringify({ confirmation }) });
        return { status: response.status, data: await response.json() };
      };
      try {
        const medicine = await Medicine.findOne({ name: 'Worker medicine' });
        assert.equal((await remove(medicine._id)).status, 409);
        medicine.isDeleted = true; await medicine.save();
        assert.equal((await remove(medicine._id, customer)).status, 403);
        assert.equal((await remove(medicine._id, staff)).status, 403);
        assert.equal((await remove(medicine._id, admin, 'NO')).status, 400);
        const linked = (await Bill.findOne()).items[0].medicineId;
        await Medicine.updateOne({ _id: linked }, { $set: { isDeleted: true } });
        assert.equal((await remove(linked)).status, 409); assert.ok(await Medicine.exists({ _id: linked }));
        const queued = await remove(medicine._id); assert.equal(queued.status, 202);
        const job = await completed(queued.data.jobId);
        assert.equal(await Medicine.exists({ _id: medicine._id }), null);
        assert.ok(await mongoose.model('MedicineAudit').exists({ medicineId: medicine._id, action: 'permanently_deleted' }));
        const backup = JSON.parse(await fs.readFile(path.join(process.env.PHARMADESK_BACKUP_DIR, job.result.safetyBackup), 'utf8'));
        assert.ok(backup.collections.medicines.some(record => String(record._id) === String(medicine._id)));
        assert.equal(await Bill.countDocuments(), 1);
      } finally { await new Promise(resolve => listener.close(resolve)); }
    });
  } finally {
    stopJobQueue();
    for (const file of artifacts) await fs.rm(path.join(JOB_DIR, path.basename(file)), { force: true });
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); await fs.rm(temporary, { recursive: true, force: true });
  }
});
