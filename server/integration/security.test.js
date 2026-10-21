import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('security regression: input, authentication, roles and private export ownership', { skip: !process.env.TEST_MONGO_URI, timeout: 120000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI); assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname));
  const databaseName = 'pharmadesk_test_security_' + randomUUID().replaceAll('-', ''); uri.pathname = '/' + databaseName;
  process.env.MONGO_URI = uri.toString(); process.env.JWT_ACCESS_SECRET = randomUUID(); process.env.JWT_REFRESH_SECRET = randomUUID();
  const { default: mongoose } = await import('mongoose'); const { default: express } = await import('express');
  const { default: User } = await import('../models/User.js'); const { default: Job } = await import('../models/BackgroundJob.js');
  const { default: auth } = await import('../routes/authRoutes.js'); const { default: backups } = await import('../routes/backupRoutes.js');
  const { default: jobs } = await import('../routes/jobRoutes.js'); const { default: medicines } = await import('../routes/medicineRoutes.js');
  const { generateAccessToken } = await import('../utils/generateToken.js'); const { errorHandler } = await import('../middleware/errorMiddleware.js');
  let server;
  try {
    await mongoose.connect(uri.toString()); await Promise.all(Object.values(mongoose.models).map(Model => Model.init()));
    const make = role => User.create({ name: role, email: randomUUID() + '@test.local', password: randomUUID(), role, accountStatus: 'approved' });
    const admin = await make('superadmin'), staff = await make('pharmacist'), other = await make('pharmacist'), customer = await make('customer');
    const app = express(); app.use(express.json()); app.use('/auth', auth); app.use('/backups', backups); app.use('/jobs', jobs); app.use('/medicines', medicines); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const request = async (path, { user, body, token } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(user || token ? { Authorization: 'Bearer ' + (token || generateAccessToken(user._id, user.role, user.tokenVersion || 0)) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    await t.test('protected inventory and backup files require authentication and Admin privileges', async () => {
      assert.equal((await request('/medicines')).status, 401);
      assert.equal((await request('/backups/latest')).status, 401);
      assert.equal((await request('/backups/latest', { user: staff })).status, 403);
      assert.equal((await request('/backups/status', { user: customer })).status, 403);
      assert.equal((await request('/medicines', { token: 'forged-token' })).status, 401);
    });
    await t.test('operator-object login is rejected and public registration cannot create an Admin', async () => {
      assert.equal((await request('/auth/login', { body: { email: { $ne: null }, password: 'x' } })).status, 400);
      const email = randomUUID() + '@test.local';
      assert.equal((await request('/auth/register', { body: { name: 'Injected role', email, password: 'fixture-password', role: 'superadmin', accountStatus: 'approved' } })).status, 201);
      const saved = await User.findOne({ email }); assert.equal(saved.role, 'customer'); assert.equal(saved.accountStatus, 'pending');
    });
    await t.test('another staff member cannot inspect or download a private export', async () => {
      const job = await Job.create({ type: 'export', status: 'queued', owner: staff._id });
      assert.equal((await request('/jobs/' + job._id, { user: staff })).status, 200);
      assert.equal((await request('/jobs/' + job._id, { user: other })).status, 404);
      assert.equal((await request('/jobs/' + job._id, { user: admin })).status, 200);
      assert.equal((await request('/jobs/' + job._id, { user: customer })).status, 403);
    });
    await t.test('revoked tokens fail even while their signed expiration is still valid', async () => {
      const token = generateAccessToken(staff._id, staff.role, staff.tokenVersion || 0);
      await User.updateOne({ _id: staff._id }, { $inc: { tokenVersion: 1 } });
      assert.equal((await request('/medicines', { token })).status, 401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
