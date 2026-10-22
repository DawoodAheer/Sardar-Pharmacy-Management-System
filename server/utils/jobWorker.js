import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';


import '../env-loader.js';
import BackgroundJob from '../models/BackgroundJob.js';

import User from '../models/User.js';
import { exportInventoryXlsx, exportSalesXlsx } from './excelExports.js';
import { JOB_DIR } from './backgroundJobs.js';
import { createBackup, verifyBackupRecovery } from './backupManager.js';

let job;
try {
  await mongoose.connect(process.env.MONGO_URI);
  job = await BackgroundJob.findById(process.argv[2]);
  if (!job || job.status !== 'running') throw new Error('Job is not running');
  if (job.owner) {
    // Match the API's hydrated User lookup: old accounts can predate isActive.
    // A lean document omits schema defaults and incorrectly rejects those users.
    const owner = await User.findById(job.owner).select('role isActive accountStatus');
    const roles = ['backup', 'verify', 'purge'].includes(job.type) ? ['superadmin'] : ['superadmin', 'pharmacist'];
    if (!owner) throw new Error('The job owner account no longer exists. Sign in again.');
    if (!owner.isActive) throw new Error('This account is inactive. Contact an Admin.');
    if (!roles.includes(owner.role)) throw new Error('Your current role does not have permission to run this job. Contact an Admin.');
    if (owner.role !== 'superadmin' && owner.accountStatus !== 'approved') throw new Error('This account is not approved. Contact an Admin.');
  }
  const payload = job.payloadFile ? JSON.parse(await fs.readFile(path.join(JOB_DIR, path.basename(job.payloadFile)), 'utf8')) : {};
  let result, artifact;
  if (job.type === 'purge') {
    if (!job.owner) throw new Error('Archive deletion requires an Admin account.');
    const { deleteArchivedMedicine } = await import('./archiveDeletion.js');
    result = await deleteArchivedMedicine(payload.medicineId, job.owner);
  }
  else if (job.type === 'backup') { const file = await createBackup(); result = { message: 'Database backup completed.', fileName: path.basename(file) }; }
  else if (job.type === 'verify') result = { ...await verifyBackupRecovery(payload.backupData), message: 'Backup recovery verified in an isolated temporary database.' };
  else if (job.type === 'export') { artifact = await exportInventoryXlsx(job._id, JOB_DIR); result = { message: 'Inventory Excel ready, including readable expiry dates.' }; }
  else if (job.type === 'sales-export') { artifact = await exportSalesXlsx(job._id, JOB_DIR, payload); result = { message: 'Sales Excel ready.' }; }
  else if (job.type === 'import') {
    const { bulkImportMedicines } = await import('../controllers/medicineController.js');
    result = await new Promise((resolve, reject) => {
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.statusCode >= 400 ? reject(new Error(data.message)) : resolve(data); } };
      bulkImportMedicines({ body: payload, headers: {}, user: { _id: job.owner }, backgroundWorker: true }, response, reject).catch(reject);
    });
  }
  await BackgroundJob.updateOne({ _id: job._id, status: 'running' }, { $set: { status: 'completed', result, artifact, finishedAt: new Date() } });
  if (job.payloadFile) await fs.rm(path.join(JOB_DIR, path.basename(job.payloadFile)), { force: true });
} catch (error) {
  if (job) await BackgroundJob.updateOne({ _id: job._id }, { $set: { status: 'failed', error: String(error.message).slice(0, 1000), finishedAt: new Date() } }).catch(() => {});
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
