import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
    },
    adjustmentType: {
      type: String,
      enum: ['ADD', 'SUBTRACT', 'SET'],
      required: true,
    },
    quantityChanged: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Please state a reason for stock adjustment'],
      trim: true,
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const StockAdjustment = mongoose.model('StockAdjustment', stockAdjustmentSchema);

export default StockAdjustment;
