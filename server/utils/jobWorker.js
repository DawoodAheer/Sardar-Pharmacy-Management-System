import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import '../env-loader.js';
import BackgroundJob from '../models/BackgroundJob.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import { MANUFACTURER_SORT, MEDICINE_COLLATION } from './medicineOrdering.js';
import { JOB_DIR } from './backgroundJobs.js';
import { createBackup, verifyBackupRecovery } from './backupManager.js';

const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
async function exportInventory(id) {
  await fs.mkdir(JOB_DIR, { recursive: true });
  const artifact = `${id}.csv`, partial = path.join(JOB_DIR, `${id}.tmp`);
  const stream = createWriteStream(partial, { encoding: 'utf8' });
  let streamError; stream.on('error', error => { streamError = error; });
  try {
    stream.write('\uFEFFname,manufacturer,purchasePrice,unitsPerPack,price,quantity,expiryDate,rackLocation\r\n');
    for await (const med of Medicine.find({ isDeleted: { $ne: true } }).collation(MEDICINE_COLLATION).sort(MANUFACTURER_SORT).lean().cursor()) {
      if (streamError) throw streamError;
      const row = [med.name, med.manufacturer, med.purchasePrice, med.unitsPerPack, med.price, med.quantity, med.expiryDate ? new Date(med.expiryDate).toISOString().slice(0, 10) : '', med.rackLocation];
      // Prevent spreadsheet formula execution in exported text.
      const line = row.map(value => csvCell(typeof value === 'string' && /^[=+@\-]/.test(value) ? `'${value}` : value)).join(',') + '\r\n';
      if (!stream.write(line)) await once(stream, 'drain');
    }
    stream.end(); await once(stream, 'finish');
    await fs.rename(partial, path.join(JOB_DIR, artifact)); return artifact;
  } catch (error) { stream.destroy(); await fs.rm(partial, { force: true }); throw error; }
}

let job;
try {
  await mongoose.connect(process.env.MONGO_URI);
  job = await BackgroundJob.findById(process.argv[2]);
  if (!job || job.status !== 'running') throw new Error('Job is not running');
  if (job.owner) {
    const owner = await User.findById(job.owner).select('role isActive accountStatus').lean();
    const roles = ['backup', 'verify', 'purge'].includes(job.type) ? ['superadmin'] : ['superadmin', 'pharmacist'];
    if (!owner?.isActive || !roles.includes(owner.role) || (owner.role !== 'superadmin' && owner.accountStatus !== 'approved')) throw new Error('The account no longer has permission to run this job.');
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
  else if (job.type === 'export') { artifact = await exportInventory(job._id); result = { message: 'Inventory CSV ready. Open it in Excel.' }; }
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
