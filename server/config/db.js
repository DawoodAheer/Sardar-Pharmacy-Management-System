import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import { autoSeedIfEmpty } from '../utils/autoSeeder.js';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

const connectDB = async (retryCount = 0) => {
  const mongoUri =
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pharmadesk';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    // Register health event listeners once connected
    if (retryCount === 0) {
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB connection lost. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected successfully!');
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB Connection Error:', err.message);
      });
    }

    try {
      const indexes = await Medicine.collection.indexes();
      const legacyBatchIndexes = indexes.filter(
        (index) => index.name === 'batchNumber_1' || index.key?.batchNumber
      );

      for (const index of legacyBatchIndexes) {
        await Medicine.collection.dropIndex(index.name);
        console.log(`Removed legacy medicine index: ${index.name}`);
      }
    } catch (indexError) {
      console.warn(`Medicine index cleanup skipped: ${indexError.message}`);
    }

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Auto-seed default admin, pharmacist, and customer if database is empty
    await autoSeedIfEmpty();
  } catch (error) {
    console.error(
      `Error connecting to MongoDB at ${mongoUri} (Attempt ${retryCount + 1}/${MAX_RETRIES}): ${error.message}`
    );

    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying connection in ${RETRY_INTERVAL_MS / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      return connectDB(retryCount + 1);
    }

    console.error(
      'Ensure MongoDB is running (e.g. docker compose up -d mongodb) or check MONGO_URI in server/.env.'
    );
    process.exit(1);
  }
};

export default connectDB;
