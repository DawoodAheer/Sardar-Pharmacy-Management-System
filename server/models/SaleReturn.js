import mongoose from 'mongoose';

const saleReturnSchema = new mongoose.Schema(
  {
    sale_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true,
    },
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    item_name: { type: String, trim: true, default: '' },
    bill_number: { type: String, trim: true, default: '' },
    qty_returned: {
      type: Number,
      required: true,
      min: [1, 'Returned quantity must be at least 1'],
      validate: Number.isInteger,
    },
    refund_amount: {
      type: Number,
      required: true,
      min: [0, 'Refund cannot be negative'],
    },
    reason: { type: String, trim: true, required: true },
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'returns' }
);

const SaleReturn = mongoose.model('SaleReturn', saleReturnSchema);
export default SaleReturn;
