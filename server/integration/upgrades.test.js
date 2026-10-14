import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('pharmacy upgrades end-to-end in an isolated replica-set database', { skip: !process.env.TEST_MONGO_URI, timeout: 120000 }, async t => {
  const uri = new URL(process.env.TEST_MONGO_URI);
  assert.ok(['127.0.0.1', 'localhost'].includes(uri.hostname), 'Integration tests require local MongoDB.');
  const databaseName = `pharmadesk_test_upgrades_${randomUUID().replaceAll('-', '')}`;
  uri.pathname = `/${databaseName}`;
  process.env.MONGO_URI = uri.toString();
  process.env.PHARMADESK_BACKUP_DIR = await mkdtemp(path.join(tmpdir(), 'pharmadesk-test-backups-'));
  process.env.PHARMADESK_BACKUP_SHARE_DIR = path.join(process.env.PHARMADESK_BACKUP_DIR, 'sharing');
  process.env.JWT_ACCESS_SECRET = randomUUID();
  const { default: mongoose } = await import('mongoose');
  const { default: express } = await import('express');
  const { default: User } = await import('../models/User.js');
  const { default: Medicine } = await import('../models/Medicine.js');
  const { default: Bill } = await import('../models/Bill.js');
  const { default: Udhar } = await import('../models/Udhar.js');
  const { default: billRoutes } = await import('../routes/billRoutes.js');
  const { default: udharRoutes } = await import('../routes/udharRoutes.js');
  const { default: operationsRoutes } = await import('../routes/operationsRoutes.js');
  const { errorHandler } = await import('../middleware/errorMiddleware.js');
  const { generateAccessToken } = await import('../utils/generateToken.js');
  const { createBackup, verifyBackupRecovery } = await import('../utils/backupManager.js');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all(Object.values(mongoose.models).map(Model => Model.init()));
    const admin = await User.create({ name: 'Test Admin', email: 'admin@test.local', password: 'test-password', role: 'superadmin', accountStatus: 'approved' });
    const customer = await User.create({ name: 'Test Customer', email: 'customer@test.local', password: 'test-password', role: 'customer', accountStatus: 'approved' });
    const pharmacist = await User.create({ name: 'Test Staff', email: 'staff@test.local', password: 'test-password', role: 'pharmacist', accountStatus: 'approved' });
    const app = express();
    app.use(express.json()); app.use('/api/bills', billRoutes); app.use('/api/udhar', udharRoutes); app.use('/api/operations', operationsRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (endpoint, { user = admin, method = 'GET', body } = {}) => {
      const result = await fetch(base + '/api' + endpoint, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken(user._id, user.role)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await result.json();
      return { status: result.status, data };
    };
    const med = await Medicine.create({ name: 'Integration medicine', createdBy: admin._id, quantity: 8, purchasePrice: 10, price: 30, expiryDate: '2099-01-01', batches: [
      { batchNumber: 'FIRST', quantity: 3, purchaseCost: 10, expiryDate: '2099-01-01' },
      { batchNumber: 'SECOND', quantity: 5, purchaseCost: 20, expiryDate: '2099-06-01' },
    ] });
    await t.test('customers cannot look up other customers or apply discounts', async () => {
      assert.equal((await request('/bills/lookup-customer?phone=123', { user: customer })).status, 403);
      const response = await request('/bills', { user: customer, method: 'POST', body: { discount: 30, items: [{ medicineId: med._id, quantity: 1 }] } });
      assert.equal(response.status, 403);
      assert.equal(await Bill.countDocuments(), 0);
    });
    let bill;
    await t.test('a sale uses oldest unexpired batches and a return restores exact batch stock', async () => {
      const sale = await request('/bills/instore', { method: 'POST', body: { customerName: 'Test', items: [{ medicineId: med._id, quantity: 4 }], paymentMethod: 'Cash' } });
      assert.equal(sale.status, 201, JSON.stringify(sale.data)); bill = sale.data.bill;
      assert.deepEqual(bill.items[0].batchAllocations.map(b => [b.batchNumber, b.quantity]), [['FIRST', 3], ['SECOND', 1]]);
      assert.equal(bill.items[0].purchasePrice, 12.5);
      const returned = await request(`/bills/${bill._id}/return`, { method: 'POST', body: { returns: [{ medicineId: med._id, quantityReturned: 3, reason: 'Test return' }] } });
      assert.equal(returned.status, 200, JSON.stringify(returned.data));
      const stock = await Medicine.findById(med._id);
      assert.equal(stock.quantity, 7);
      assert.equal(stock.batches.find(b => b.batchNumber === 'FIRST').quantity, 3);
      assert.equal(returned.data.bill.netItems[0].purchasePrice, 20);
      const profit = await request('/bills/profit-summary');
      assert.equal(profit.status, 200); assert.equal(profit.data.dailyProfit, 10);
      const details = await request('/bills/profit-details?page=1');
      assert.equal(details.status, 200); assert.equal(details.data.totals.totalProfit, 10);
      assert.equal(details.data.profitDetails[0].quantitySold, 1);
      const inventory = await request('/operations/summary');
      assert.equal(inventory.data.inventory.stockValue, 110);
      const rankings = await request('/bills/medicine-sales-ranking');
      assert.equal(rankings.data.topSelling[0].totalUnits, 1);
    });
    let credit;
    await t.test('simultaneous credit payments cannot overpay or corrupt totals', async () => {
      credit = await Udhar.create({ customerName: 'Credit test', recordedBy: admin._id, items: [{ medicineName: 'Test', quantity: 1, unitPrice: 100, totalPrice: 100 }], dueDate: '2000-01-01' });
      const responses = await Promise.all([request(`/udhar/${credit._id}/pay`, { method: 'POST', body: { amount: 80 } }), request(`/udhar/${credit._id}/pay`, { method: 'POST', body: { amount: 80 } })]);
      assert.equal(responses.filter(response => response.status === 200).length, 1);
      const saved = await Udhar.findById(credit._id);
      assert.equal(saved.totalPaid, 80); assert.equal(saved.remainingAmount, 20); assert.equal(saved.payments.length, 1);
      assert.equal((await request(`/operations/credit/${credit._id}/statement`)).data.entries.at(-1).balance, 20);
      assert.equal((await request('/udhar?overdue=true')).data.total, 1);
    });
    await t.test('supplier invoices receive stock once, track payments and return credits', async () => {
      const supplier = await request('/operations/suppliers', { method: 'POST', body: { name: 'Test Supplier' } });
      const body = { supplierId: supplier.data._id, invoiceNumber: 'TEST-001', items: [{ medicineId: med._id, batchNumber: 'SUPPLIER', quantity: 10, purchaseCost: 5, expiryDate: '2099-08-01' }] };
      const invoice = await request('/operations/purchases', { method: 'POST', body });
      assert.equal(invoice.status, 201, JSON.stringify(invoice.data)); assert.equal(invoice.data.balance, 50);
      const quantity = (await Medicine.findById(med._id)).quantity;
      assert.equal((await request('/operations/purchases', { method: 'POST', body })).status, 409);
      assert.equal((await Medicine.findById(med._id)).quantity, quantity);
      assert.equal((await request(`/operations/purchases/${invoice.data._id}/pay`, { user: pharmacist, method: 'POST', body: { amount: 10 } })).status, 403);
      const paid = await request(`/operations/purchases/${invoice.data._id}/pay`, { method: 'POST', body: { amount: 10, fromCashDrawer: true } });
      assert.equal(paid.data.balance, 40);
      const returned = await request(`/operations/purchases/${invoice.data._id}/return`, { method: 'POST', body: { batchId: invoice.data.items[0].batchId, quantity: 2, reason: 'Damaged package' } });
      assert.equal(returned.status, 200, JSON.stringify(returned.data)); assert.equal(returned.data.balance, 30);
      assert.equal((await Medicine.findById(med._id)).quantity, quantity - 2);
    });
    await t.test('cash reconciliation accounts for sales, returns, credit receipts and expenses', async () => {
      const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const saved = await request('/operations/cash', { method: 'POST', body: { date, openingCash: 100, countedCash: 190, expense: { amount: 10, reason: 'Test expense' } } });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      const cash = await request(`/operations/cash?date=${date}`);
      assert.equal(cash.data.cashSales, 120); assert.equal(cash.data.cashRefunds, 90); assert.equal(cash.data.creditRecovered, 80);
      assert.equal(cash.data.expectedCash, 190); assert.equal(cash.data.discrepancy, 0);
      assert.equal((await request('/operations/cash', { user: pharmacist, method: 'POST', body: { date, openingCash: 1 } })).status, 403);
    });
    await t.test('online cash is reported on acceptance day in both cash and daily closing reports', async () => {
      const createdAt = new Date(2020, 0, 1, 12);
      const acceptedAt = new Date(2020, 0, 2, 12);
      const makeBill = (total, extra) => Bill.create({
        billNumber: `DATE-TEST-${randomUUID()}`, pharmacistId: admin._id, customerId: customer._id,
        billType: 'ONLINE', orderStatus: 'ACCEPTED', createdAt, reviewedAt: acceptedAt,
        paymentMethod: 'Cash', subtotal: total, total, discount: 0,
        items: [{ medicineId: med._id, name: med.name, quantity: 1, unitPrice: total,
          salePrice: total, purchasePrice: 5, expiryStatus: 'SAFE', expiryDate: '2099-01-01' }],
        ...extra,
      });
      await makeBill(100, {});
      await makeBill(30, { billType: 'INSTORE', createdAt: acceptedAt, reviewedAt: createdAt });
      await makeBill(5, { createdAt: acceptedAt, reviewedAt: null });
      await makeBill(200, { orderStatus: 'PENDING', reviewedAt: null });
      await makeBill(300, { orderStatus: 'REJECTED' });
      for (const [date, expected] of [['2020-01-01', 0], ['2020-01-02', 135]]) {
        const cash = await request(`/operations/cash?date=${date}`);
        const closing = await request(`/bills/daily-closing?date=${date}`);
        assert.equal(cash.status, 200, JSON.stringify(cash.data));
        assert.equal(closing.status, 200, JSON.stringify(closing.data));
        assert.equal(cash.data.cashSales, expected);
        assert.equal(closing.data.salesByMethod.Cash, expected);
        assert.equal(closing.data.billCount, expected ? 3 : 0);
      }
    });
    await t.test('backup recovery compares restored records in a temporary database', async () => {
      await mongoose.model('MedicineImportIssue').create({ rowNumber: 2, originalRow: { name: 'Previously ignored row' },
        status: 'ignored', createdBy: admin._id });
      await createBackup();
      const result = await verifyBackupRecovery();
      assert.equal(result.verifiedCollections.users, 3);
      assert.equal(result.verifiedCollections.supplierInvoices, 1);
      assert.equal(result.verifiedCollections.cashSessions, 1);
      assert.equal(result.verifiedCollections.medicineImportIssues, 1);
      assert.equal(mongoose.connection.name, databaseName);
      assert.equal(await User.countDocuments(), 3);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
