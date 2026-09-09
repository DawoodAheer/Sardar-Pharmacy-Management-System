import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    // Medicine brand name
    name: {
      type: String,
      required: [true, 'Please add a medicine name'],
      trim: true,
    },

    // Manufacturer / company
    manufacturer: {
      type: String,
      required: [true, 'Please add a manufacturer'],
      trim: true,
    },


    // Expiry date
    expiryDate: {
      type: Date,
      required: [true, 'Please add an expiry date'],
    },

    // Available stock
    quantity: {
      type: Number,
      required: [true, 'Please add a quantity'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },

    // Minimum stock level
    reorderLevel: {
      type: Number,
      required: [true, 'Please add a reorder level'],
      min: [0, 'Reorder level cannot be negative'],
      default: 10,
    },

    // Selling price
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: [0, 'Price cannot be negative'],
    },

    // Medicine category
    category: {
      type: String,
      required: [true, 'Please add a category'],
      trim: true,
    },

    // Barcode / GTIN
    barcode: {
      type: String,
      trim: true,
      index: true,
    },

    // Scanned label image URL
    labelImageUrl: {
      type: String,
      trim: true,
      default: '',
    },

    // User who added the medicine
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;