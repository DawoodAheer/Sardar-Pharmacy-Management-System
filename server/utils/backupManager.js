import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Udhar from '../models/Udhar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const BACKUP_DIR = path.join(__dirname, '../backups');
const COLLECTION_MODELS = {
  users: User,
  medicines: Medicine,
  bills: Bill,
  reminders: Reminder,
  notifications: Notification,
  stockAdjustments: StockAdjustment,
  udhar: Udhar,
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

export async function createBackup() {
  await ensureConnected();
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });

  const collections = {};
  for (const [name, Model] of Object.entries(COLLECTION_MODELS)) {
    collections[name] = await Model.find({}).lean();
  }
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
  console.log(`Database backup created: ${filePath}`);
  return filePath;
}

export async function restoreBackup(specifiedFile = null) {
  await ensureConnected();
  const filePath = path.resolve(
    specifiedFile || path.join(BACKUP_DIR, 'pharmadesk_latest_backup.json')
  );
  const rawData = await fs.promises.readFile(filePath, 'utf-8');
  let backupData;
  try {
    backupData = JSON.parse(rawData);
  } catch (error) {
    throw new Error(`Backup JSON is invalid: ${error.message}`);
  }
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
  console.log(`Database restored from ${filePath}`);
  return { restoredFrom: filePath, preRestoreBackup: preRestoreFile };
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
