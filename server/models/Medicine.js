import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    // Medicine brand name
    name: {
      type: String,
      required: [true, 'Please add a medicine name'],
      trim: true,
    },

    // Active ingredient / generic medicine name
    genericName: {
      type: String,
      trim: true,
      default: '',
    },

    // Manufacturer / company
    manufacturer: {
      type: String,
      trim: true,
      default: '',
    },


    // Expiry date
    expiryDate: {
      type: Date,
      required: [true, 'Please add an expiry date'],
    },

    // Available stock
    quantity: {
      type: Number,
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },

    // Minimum stock level
    reorderLevel: {
      type: Number,
      min: [0, 'Reorder level cannot be negative'],
      default: 10,
    },

    // Selling price (default sale rate)
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: [0, 'Price cannot be negative'],
    },

    // Purchase / cost price (what you paid — fixed, for profit calculation)
    purchasePrice: {
      type: Number,
      min: [0, 'Purchase price cannot be negative'],
      default: 0,
    },

    // Medicine category
    category: {
      type: String,
      trim: true,
      default: '',
    },

    // Barcode / GTIN
    barcode: {
      type: String,
      trim: true,
      index: true,
    },

    // Physical shelf/rack location inside the pharmacy
    rackLocation: {
      type: String,
      trim: true,
      default: '',
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

    // Alert tracking flags for expiry notifications.
    expiryAlert180Sent: {
      type: Boolean,
      default: false,
    },
    expiryAlert10Sent: {
      type: Boolean,
      default: false,
    },
    expiryAlert1Sent: {
      type: Boolean,
      default: false,
    },
    expiryAlertExpiredSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;