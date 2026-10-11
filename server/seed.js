import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Medicine from './models/Medicine.js';
import Bill from './models/Bill.js';
import Reminder from './models/Reminder.js';
import Notification from './models/Notification.js';
import MedicineAudit from './models/MedicineAudit.js';
import MedicineImportIssue from './models/MedicineImportIssue.js';
import StockAdjustment from './models/StockAdjustment.js';
import SaleReturn from './models/SaleReturn.js';
import Udhar from './models/Udhar.js';
import DeletionRequest from './models/DeletionRequest.js';
import PurchaseOrder from './models/PurchaseOrder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true';

async function seedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected successfully!');

    // 1. Clean up ALL existing business data (Zero demo medicines, zero demo bills)
    console.log('Cleaning up existing data...');
    await User.deleteMany({});
    await Medicine.deleteMany({});
    await Bill.deleteMany({});
    await Reminder.deleteMany({});
    await Notification.deleteMany({});
    await MedicineAudit.deleteMany({});
    await MedicineImportIssue.deleteMany({});
    await StockAdjustment.deleteMany({});
    await SaleReturn.deleteMany({});
    await Udhar.deleteMany({});
    await DeletionRequest.deleteMany({});
    await PurchaseOrder.deleteMany({});
    console.log('Database cleaned successfully. Zero mock medicines remaining.');

    // 2. Create only the default required login users
    console.log('Creating default login accounts...');
    const superadmin = await User.create({
      name: 'Dawood Super Admin',
      email: 'aheerdawood014@gmail.com',
      password: 'Dawood@@5786',
      role: 'superadmin',
      accountStatus: 'approved',
    });

    const pharmacist = await User.create({
      name: 'Sardar Pharmacist',
      email: 'mlksardar6@gmail.com',
      password: 'Dawood@@5786',
      role: 'pharmacist',
      accountStatus: 'approved',
    });

    const customer = await User.create({
      name: 'Raza Customer',
      email: 'aheerraza0@gmail.com',
      password: 'Dawood@@5786',
      role: 'customer',
      accountStatus: 'approved',
    });

    console.log('Users ready:');
    console.log(`- Super Admin : ${superadmin.email}`);
    console.log(`- Pharmacist  : ${pharmacist.email}`);
    console.log(`- Customer    : ${customer.email}`);

    console.log('\n======================================================');
    console.log('🎉 Clean Setup Complete! 0 Medicines, Ready for Pharmacy!');
    console.log('======================================================');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedData();
