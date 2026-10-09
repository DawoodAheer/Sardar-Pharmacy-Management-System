import mongoose from 'mongoose';

// Sub-schema for each medicine item in udhar entry
const udharItemSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Price cannot be negative'],
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Total price cannot be negative'],
  },
  dateTaken: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
}, { _id: true });

// Sub-schema for payment records
const paymentRecordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Payment amount must be positive'],
  },
  paidAt: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    default: '',
    trim: true,
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { _id: true, timestamps: false });

const udharSchema = new mongoose.Schema(
  {
    // Customer info
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    customerAddress: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },

    // Items list
    items: {
      type: [udharItemSchema],
      default: [],
    },

    // Financial fields (auto-calculated)
    totalAmount: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },

    // Payment records
    payments: {
      type: [paymentRecordSchema],
      default: [],
    },

    // Status
    status: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'],
      default: 'PENDING',
    },

    // Who recorded this udhar
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Optional: linked bill
    billRef: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate totalAmount, totalPaid, remainingAmount before save
udharSchema.pre('save', function (next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  this.totalPaid = this.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  this.remainingAmount = Math.max(0, this.totalAmount - this.totalPaid);

  if (this.remainingAmount === 0 && this.totalAmount > 0) {
    this.status = 'PAID';
  } else if (this.totalPaid > 0 && this.remainingAmount > 0) {
    this.status = 'PARTIALLY_PAID';
  } else {
    this.status = 'PENDING';
  }

  next();
});

const Udhar = mongoose.model('Udhar', udharSchema);
export default Udhar;
