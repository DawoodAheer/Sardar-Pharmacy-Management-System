import mongoose from 'mongoose';
import { autoSeedIfEmpty } from './utils/autoSeeder.js';
try {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk?replicaSet=rs0&directConnection=true');
  await autoSeedIfEmpty();
  console.log('Default accounts checked. Existing accounts, medicines and records were preserved.');
} catch (error) { console.error('Account setup failed:', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
