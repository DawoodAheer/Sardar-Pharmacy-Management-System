import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('legacy approved accounts can import while revoked accounts stay blocked', { skip: !process.env.TEST_MONGO_URI, timeout: 180000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI); assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname));
  const databaseName = 'pharmadesk_test_jobs_' + randomUUID().replaceAll('-', ''); uri.pathname = '/' + databaseName;
  process.env.MONGO_URI = uri.toString(); process.env.JWT_ACCESS_SECRET = randomUUID(); process.env.OFFLINE_MODE = 'true';
  const { default: mongoose } = await import('mongoose'); const { default: express } = await import('express');
  const { default: User } = await import('../models/User.js'); const { default: Medicine } = await import('../models/Medicine.js');
  const { default: Job } = await import('../models/BackgroundJob.js'); const { default: routes } = await import('../routes/medicineRoutes.js');
  const { generateAccessToken } = await import('../utils/generateToken.js'); const { errorHandler } = await import('../middleware/errorMiddleware.js');
  const { startJobQueue, stopJobQueue, enqueueJob, JOB_DIR } = await import('../utils/backgroundJobs.js');
  const { rm } = await import('node:fs/promises'); const { default: path } = await import('node:path');
  let server;
  const jobIds = [];
  try {
    await mongoose.connect(uri.toString()); await Promise.all(Object.values(mongoose.models).map(Model => Model.init()));
    const legacy = async (role, fields = {}) => {
      const user = { _id: new mongoose.Types.ObjectId(), name: 'Legacy fixture', email: randomUUID() + '@test.local', password: 'unused-fixture-hash', role, accountStatus: 'approved', ...fields };
      await User.collection.insertOne(user); return user;
    };
    const admin = await legacy('superadmin'), staff = await legacy('pharmacist');
    const app = express(); app.use(express.json()); app.use('/medicines', routes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const send = async (user, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/medicines/bulk`, { method: 'POST', headers: { Authorization: 'Bearer ' + generateAccessToken(user._id, user.role), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };
    const finished = async id => {
      jobIds.push(id); const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const job = await Job.findById(id).lean();
        if (['completed', 'failed'].includes(job.status)) return job;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      assert.fail('Background job did not finish');
    };
    await startJobQueue();
    for (const user of [admin, staff]) await t.test(`${user.role}: 35 valid rows commit through the real background worker`, async () => {
      const medicines = Array.from({ length: 35 }, (_, i) => ({ name: user.role + ' legacy medicine ' + i, purchasePrice: 825.27, unitsPerPack: 100, packSalePrice: 970, quantity: 100, expiryDate: '2029-04-30' }));
      const body = { sourceFile: user.role + '.xlsx', medicines };
      const preview = await send(user, { ...body, dryRun: true }); assert.equal(preview.status, 200); assert.equal(preview.data.validCount, 35);
      const queued = await send(user, { ...body, background: true }); assert.equal(queued.status, 202);
      const job = await finished(queued.data.jobId); assert.equal(job.status, 'completed', job.error); assert.equal(job.result.insertedCount, 35);
      const retry = await send(user, { ...body, background: true }); const replay = await finished(retry.data.jobId);
      assert.equal(replay.status, 'completed', replay.error); assert.equal(replay.result.replayed, true);
      assert.equal(Object.hasOwn(await User.collection.findOne({ _id: user._id }), 'isActive'), false, 'Worker must not rewrite account permissions');
    });
    await t.test('inactive, pending, demoted and deleted owners cannot use a queued import', async () => {
      const inactive = await legacy('superadmin', { isActive: false });
      const pending = await legacy('pharmacist', { accountStatus: 'pending', isActive: true });
      const customer = await legacy('customer', { isActive: true });
      const deleted = { _id: new mongoose.Types.ObjectId() };
      for (const user of [inactive, pending, customer, deleted]) {
        const job = await finished((await enqueueJob('import', user._id, { medicines: [{ name: 'Forbidden ' + user._id, purchasePrice: 10, quantity: 1 }] })).jobId);
        assert.equal(job.status, 'failed'); assert.match(job.error, /account|permission|approved|Admin|Pharmacist/i);
      }
      assert.equal(await Medicine.countDocuments(), 70);
      assert.equal((await finished((await enqueueJob('backup', staff._id)).jobId)).status, 'failed');
    });
  } finally {
    stopJobQueue(); if (server) await new Promise(resolve => server.close(resolve));
    for (const id of jobIds) await rm(path.join(JOB_DIR, id + '.json'), { force: true });
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
