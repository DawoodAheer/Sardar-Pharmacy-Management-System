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

    supplierName: { type: String, trim: true, default: '' },
    supplierPhone: { type: String, trim: true, default: '' },


    // Expiry date
    expiryDate: {
      type: Date,
      required: [true, 'Please add an expiry date'],
    },

    // Available stock
    quantity: {
      type: Number,
      min: [0, 'Quantity cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Stock quantity must be a whole number of tablets or units' },
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

    // Total purchase cost for one package. Existing records default to one unit/package.
    purchasePrice: {
      type: Number,
      min: [0, 'Purchase price cannot be negative'],
      default: 0,
    },

    // Tablets or other individually sellable units inside one purchase package.
    unitsPerPack: {
      type: Number,
      min: [1, 'Units per pack must be at least 1'],
      default: 1,
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

    // Soft delete keeps historical bill/return references intact.
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

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
