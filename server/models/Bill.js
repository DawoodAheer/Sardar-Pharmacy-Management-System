import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'UnitPrice cannot be negative'],
  },
  // Custom sale price set by pharmacist for this specific bill (may differ from default price)
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative'],
    default: null,
  },
  // Purchase / cost price at time of billing (for profit tracking)
  purchasePrice: {
    type: Number,
    default: 0,
  },
  expiryStatus: {
    type: String,
    required: true,
    enum: ['EXPIRED', 'CRITICAL', 'WARNING', 'CAUTION', 'SAFE'],
  },
  expiryDate: {
    type: Date,
  },
  rackLocation: {
    type: String,
    default: '',
  },
});

const returnItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantityReturned: {
    type: Number,
    required: true,
    min: [1, 'Quantity returned must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  refundAmount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    default: 'Customer Return',
  },
  returnedAt: {
    type: Date,
    default: Date.now,
  },
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      unique: true,
    },

    pharmacistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    billType: {
      type: String,
      enum: ['ONLINE', 'INSTORE'],
      default: 'ONLINE',
    },

    orderStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'ACCEPTED',
    },

    rejectionReason: {
      type: String,
      default: '',
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    customerPhone: {
      type: String,
      default: null,
    },

    shippingAddress: {
      type: String,
      default: '',
    },

    guestPhone: {
      type: String,
      default: null,
    },

    items: [billItemSchema],

    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },

    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },

    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative'],
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: ['Cash', 'Card', 'UPI'],
      default: 'Card',
    },

    returns: [returnItemSchema],

    isReturned: {
      type: Boolean,
      default: false,
    },

    totalRefunded: {
      type: Number,
      default: 0,
      min: [0, 'Total refunded cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

billSchema.pre('save', async function (next) {
  if (!this.billNumber) {
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);

    this.billNumber = `BILL-${dateCode}-${randomCode}`;
  }

  next();
});

const Bill = mongoose.model('Bill', billSchema);

export default Bill;