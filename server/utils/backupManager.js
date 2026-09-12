import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function createBackup() {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk';
      await mongoose.connect(uri);
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      collections: {
        users: await User.find({}),
        medicines: await Medicine.find({}),
        bills: await Bill.find({}),
        reminders: await Reminder.find({}),
        notifications: await Notification.find({}),
      },
    };

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pharmadesk_backup_${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    const latestPath = path.join(BACKUP_DIR, 'pharmadesk_latest_backup.json');

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    fs.writeFileSync(latestPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`📦 Database Backup Successfully Created: ${filename}`);
    console.log(`💾 Saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('❌ Backup Failed:', error.message);
    throw error;
  }
}

export async function restoreBackup(specifiedFile = null) {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk';
      await mongoose.connect(uri);
    }

    let filePath = specifiedFile;
    if (!filePath) {
      filePath = path.join(BACKUP_DIR, 'pharmadesk_latest_backup.json');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found at: ${filePath}`);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const backupData = JSON.parse(rawData);

    if (!backupData.collections) {
      throw new Error('Invalid backup file format');
    }

    console.log(`🔄 Restoring database from backup created at ${backupData.timestamp}...`);

    if (backupData.collections.users?.length) {
      await User.deleteMany({});
      await User.insertMany(backupData.collections.users);
      console.log(`✅ Restored ${backupData.collections.users.length} Users.`);
    }

    if (backupData.collections.medicines?.length) {
      await Medicine.deleteMany({});
      await Medicine.insertMany(backupData.collections.medicines);
      console.log(`✅ Restored ${backupData.collections.medicines.length} Medicines.`);
    }

    if (backupData.collections.bills?.length) {
      await Bill.deleteMany({});
      await Bill.insertMany(backupData.collections.bills);
      console.log(`✅ Restored ${backupData.collections.bills.length} Bills.`);
    }

    if (backupData.collections.reminders?.length) {
      await Reminder.deleteMany({});
      await Reminder.insertMany(backupData.collections.reminders);
      console.log(`✅ Restored ${backupData.collections.reminders.length} Reminders.`);
    }

    if (backupData.collections.notifications?.length) {
      await Notification.deleteMany({});
      await Notification.insertMany(backupData.collections.notifications);
      console.log(`✅ Restored ${backupData.collections.notifications.length} Notifications.`);
    }

    console.log('🎉 Database Restoration Completed Successfully!');
  } catch (error) {
    console.error('❌ Restore Failed:', error.message);
    throw error;
  }
}

// Support CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] || 'backup';
  const fileArg = process.argv[3] || null;

  (async () => {
    try {
      if (action === 'restore') {
        await restoreBackup(fileArg);
      } else {
        await createBackup();
      }
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  })();
}
