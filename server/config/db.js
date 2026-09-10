import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/pharmadesk';

  try {
    const conn = await mongoose.connect(mongoUri);

    try {
      const indexes = await Medicine.collection.indexes();
      const legacyBatchIndexes = indexes.filter((index) =>
        index.name === 'batchNumber_1' ||
        index.key?.batchNumber
      );

      for (const index of legacyBatchIndexes) {
        await Medicine.collection.dropIndex(index.name);
        console.log(`Removed legacy medicine index: ${index.name}`);
      }
    } catch (indexError) {
      console.warn(
        `Medicine index cleanup skipped: ${indexError.message}`
      );
    }

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      `Error connecting to MongoDB at ${mongoUri}: ${error.message}`
    );
    console.error(
      'Ensure MongoDB is running or set MONGO_URI in server/.env.'
    );
    process.exit(1);
  }
};

export default connectDB;
