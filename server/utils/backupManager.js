import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { Supplier, SupplierInvoice, CashSession } from '../models/Operations.js';
import MedicineImportRun from '../models/MedicineImportRun.js';
import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import SaleReturn from '../models/SaleReturn.js';
import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Udhar from '../models/Udhar.js';
import DeletionRequest from '../models/DeletionRequest.js';
import MedicineAudit from '../models/MedicineAudit.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import MedicineImportIssue from '../models/MedicineImportIssue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const BACKUP_DIR = process.env.PHARMADESK_BACKUP_DIR || path.join(__dirname, '../backups');
export const SHARE_DIR = process.env.PHARMADESK_BACKUP_SHARE_DIR || path.resolve(__dirname, '../../backup-exports');
const STATUS_PATH = path.join(BACKUP_DIR, 'backup_status.json');
const COLLECTION_MODELS = {
  suppliers: Supplier,
  supplierInvoices: SupplierInvoice,
  cashSessions: CashSession,
  medicineImportRuns: MedicineImportRun,
  users: User,
  medicines: Medicine,
  bills: Bill,
  returns: SaleReturn,
  reminders: Reminder,
  notifications: Notification,
  stockAdjustments: StockAdjustment,
  udhar: Udhar,
  deletionRequests: DeletionRequest,
  medicineAudits: MedicineAudit,
  purchaseOrders: PurchaseOrder,
  medicineImportIssues: MedicineImportIssue,
};
const REQUIRED_COLLECTIONS = [
  'users',
  'medicines',
  'bills',
  'reminders',
  'notifications',
];

const getMongoUri = () =>
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true';

const ensureConnected = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(getMongoUri());
  }
};

export const checksumFor = (data) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify({
      timestamp: data.timestamp,
      version: data.version,
      collections: data.collections,
    }))
    .digest('hex');

export const validateBackup = (data) => {
  if (!data || typeof data !== 'object' || !data.collections) {
    throw new Error('Invalid backup file format');
  }
  for (const name of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(data.collections[name])) {
      throw new Error(`Invalid backup: "${name}" must be an array`);
    }
  }
  for (const name of Object.keys(COLLECTION_MODELS)) {
    if (
      data.collections[name] !== undefined &&
      !Array.isArray(data.collections[name])
    ) {
      throw new Error(`Invalid backup: "${name}" must be an array`);
    }
  }
  if (data.checksum && data.checksum !== checksumFor(data)) {
    throw new Error('Backup checksum validation failed; restore was not started');
  }
};

const writeAtomically = async (filePath, contents) => {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, contents, { encoding: 'utf-8', flag: 'wx' });
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
};

const writeBackupStatus = async (status) => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const persisted = Object.fromEntries(['lastAttemptAt', 'lastSuccessAt', 'lastBackupName', 'lastError', 'lastRestoreAt', 'lastVerifiedAt', 'verificationError', 'sharePath', 'shareError'].map((key) => [key, status[key] ?? null]));
  await writeAtomically(STATUS_PATH, `${JSON.stringify(persisted, null, 2)}\n`);
};

export const markBackupFailure = async (error) => {
  try {
    const current = await getBackupStatus();
    await writeBackupStatus({
      ...current,
      lastAttemptAt: new Date().toISOString(),
      lastError: String(error?.message || error || 'Unknown backup error').slice(0, 1000),
    });
  } catch (statusError) {
    console.error('Could not save backup failure status:', statusError.message);
  }
};

export const listBackups = async () => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fs.promises.readdir(BACKUP_DIR, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && /^pharmadesk_backup_.*\.json$/.test(entry.name))
    .map(async (entry) => {
      const filePath = path.join(BACKUP_DIR, entry.name);
      const stat = await fs.promises.stat(filePath);
      return { name: entry.name, size: stat.size, createdAt: stat.mtime.toISOString() };
    }));
  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getBackupStatus = async () => {
  let status = {};
  try { status = JSON.parse(await fs.promises.readFile(STATUS_PATH, 'utf-8')); } catch {}
  const backups = await listBackups();
  const latest = backups[0] || null;
  return {
    lastAttemptAt: status.lastAttemptAt || null,
    lastSuccessAt: status.lastSuccessAt || latest?.createdAt || null,
    lastBackupName: status.lastBackupName || latest?.name || null,
    lastError: status.lastError || null,
    lastRestoreAt: status.lastRestoreAt || null,
    lastVerifiedAt: status.lastVerifiedAt || null,
    verificationError: status.verificationError || null,
    sharePath: status.sharePath || null,
    shareError: status.shareError || null,
    shareDirectory: SHARE_DIR,
    backups,
  };
};

export const getLatestBackupPath = async () => {
  const status = await getBackupStatus();
  if (!status.lastBackupName) return null;
  return path.join(BACKUP_DIR, path.basename(status.lastBackupName));
};

export async function createBackup() {
  const attemptAt = new Date().toISOString();
  const previousStatus = await getBackupStatus();
  await writeBackupStatus({ ...previousStatus, lastAttemptAt: attemptAt, lastError: null });
  try {
    await ensureConnected();
    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });

  const collections = {};
  const snapshotSession = await mongoose.startSession();
  try {
    await snapshotSession.withTransaction(async () => {
      for (const [name, Model] of Object.entries(COLLECTION_MODELS)) collections[name] = await Model.find({}).session(snapshotSession).lean();
    }, { readConcern: { level: 'snapshot' } });
  } finally { await snapshotSession.endSession(); }
  const backupData = {
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    collections,
  };
  backupData.checksum = checksumFor(backupData);
  const contents = `${JSON.stringify(backupData, null, 2)}\n`;
  const dateStr = backupData.timestamp.replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `pharmadesk_backup_${dateStr}.json`);
  const latestPath = path.join(BACKUP_DIR, 'pharmadesk_latest_backup.json');

    await writeAtomically(filePath, contents);
    await writeAtomically(latestPath, contents);
    let sharePath = null, shareError = null;
    try {
      await fs.promises.mkdir(SHARE_DIR, { recursive: true });
      sharePath = path.join(SHARE_DIR, path.basename(filePath));
      await writeAtomically(sharePath, contents);
      validateBackup(JSON.parse(await fs.promises.readFile(sharePath, 'utf8')));
    } catch (error) { shareError = String(error.message).slice(0, 1000); sharePath = null; }
    await writeBackupStatus({ ...previousStatus, lastAttemptAt: attemptAt, lastSuccessAt: backupData.timestamp, lastBackupName: path.basename(filePath), lastError: null, sharePath, shareError });
    console.log(`Database backup created: ${filePath}`);
    return filePath;
  } catch (error) {
    await writeBackupStatus({ ...previousStatus, lastAttemptAt: attemptAt, lastError: String(error.message || error).slice(0, 1000) }).catch(() => {});
    throw error;
  }
}

export async function restoreBackupData(backupData, sourceLabel = 'uploaded backup') {
  await ensureConnected();
  validateBackup(backupData);

  const preRestoreFile = await createBackup();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [name, Model] of Object.entries(COLLECTION_MODELS)) {
        const documents = backupData.collections[name];
        if (documents === undefined) continue;
        await Model.deleteMany({}).session(session);
        if (documents.length > 0) {
          await Model.insertMany(documents, { session, ordered: true });
        }
      }
    });
  } catch (error) {
    throw new Error(
      `Restore failed; transaction was rolled back. A pre-restore backup is available at ${preRestoreFile}. ${error.message}`
    );
  } finally {
    await session.endSession();
  }
  const restoredAt = new Date().toISOString();
  const status = await getBackupStatus();
  await writeBackupStatus({ ...status, lastRestoreAt: restoredAt, lastError: null });
  console.log(`Database restored from ${sourceLabel}`);
  return { restoredFrom: sourceLabel, restoredAt, preRestoreBackup: preRestoreFile };
}

let verificationRunning = false;
const canonical = value => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toHexString === 'function') return value.toHexString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
};
const recoveryDigest = documents => crypto.createHash('sha256').update(JSON.stringify(documents.map(canonical).sort((a, b) => String(a._id).localeCompare(String(b._id))))).digest('hex');

export async function verifyBackupRecovery(selectedBackup) {
  if (verificationRunning) throw Object.assign(new Error('A recovery verification is already running.'), { statusCode: 409 });
  verificationRunning = true;
  let temporary;
  try {
    await ensureConnected();
    let data = selectedBackup;
    if (!data) {
      const latest = await getLatestBackupPath();
      if (!latest) throw new Error('Create or select a backup before verifying recovery.');
      data = JSON.parse(await fs.promises.readFile(latest, 'utf8'));
    }
    validateBackup(data);
    const databaseName = `pharmadesk_recovery_${crypto.randomUUID().replaceAll('-', '')}`;
    if (databaseName === mongoose.connection.name || !databaseName.startsWith('pharmadesk_recovery_')) throw new Error('Unsafe recovery database name.');
    temporary = mongoose.connection.useDb(databaseName, { useCache: false });
    const verifiedCollections = {};
    for (const [name, Model] of Object.entries(COLLECTION_MODELS)) {
      if (data.collections[name] === undefined) continue;
      const RecoveryModel = temporary.model(Model.modelName, Model.schema, Model.collection.name);
      await RecoveryModel.createCollection();
      await RecoveryModel.createIndexes();
      const documents = [];
      for (const raw of data.collections[name]) {
        const prepared = new RecoveryModel(raw);
        await prepared.validate();
        documents.push(prepared.toObject());
      }
      if (documents.length) await RecoveryModel.collection.insertMany(documents, { ordered: true });
      const restored = await RecoveryModel.collection.find({}).toArray();
      if (restored.length !== documents.length || recoveryDigest(restored) !== recoveryDigest(documents)) throw new Error(`Restored data mismatch in ${name}.`);
      verifiedCollections[name] = restored.length;
    }
    const verifiedAt = new Date().toISOString();
    await writeBackupStatus({ ...(await getBackupStatus()), lastVerifiedAt: verifiedAt, verificationError: null });
    return { verifiedAt, verifiedCollections };
  } catch (error) {
    await writeBackupStatus({ ...(await getBackupStatus()), verificationError: error.message }).catch(() => {});
    throw error;
  } finally {
    verificationRunning = false;
    if (temporary) {
      try { await temporary.dropDatabase(); }
      finally { await mongoose.connection.removeDb(temporary.name); }
    }
    verificationRunning = false;
  }
}

export async function restoreBackup(specifiedFile = null) {
  await ensureConnected();
  const filePath = path.resolve(specifiedFile || path.join(BACKUP_DIR, 'pharmadesk_latest_backup.json'));
  const rawData = await fs.promises.readFile(filePath, 'utf-8');
  let backupData;
  try { backupData = JSON.parse(rawData); }
  catch (error) { throw new Error(`Backup JSON is invalid: ${error.message}`); }
  return restoreBackupData(backupData, path.basename(filePath));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] || 'backup';
  const fileArg = process.argv[3] || null;
  (async () => {
    try {
      if (action === 'restore') {
        await restoreBackup(fileArg);
      } else if (action === 'backup') {
        await createBackup();
      } else {
        throw new Error(`Unsupported backup action: ${action}`);
      }
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Database operation failed:', error.message);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    }
  })();
}
