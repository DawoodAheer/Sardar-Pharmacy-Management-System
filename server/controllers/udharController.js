import Udhar from '../models/Udhar.js';

// @desc    Create a new Udhar (credit) entry
// @route   POST /api/udhar
// @access  Private/Pharmacist,Superadmin
export const createUdhar = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      notes,
      items,
      billRef,
    } = req.body;

    if (!customerName || !customerName.trim()) {
      res.status(400);
      return next(new Error('Customer name is required'));
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      return next(new Error('At least one medicine item is required'));
    }

    // Validate and compute items
    const processedItems = items.map((item, idx) => {
      if (!item.medicineName || !item.medicineName.trim()) {
        throw new Error(`Medicine name is required for item ${idx + 1}`);
      }
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      if (!qty || qty < 1) throw new Error(`Invalid quantity for item ${idx + 1}`);
      if (price < 0) throw new Error(`Invalid price for item ${idx + 1}`);
      return {
        medicineName: item.medicineName.trim(),
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price,
        dateTaken: item.dateTaken ? new Date(item.dateTaken) : new Date(),
        notes: item.notes || '',
      };
    });

    const udhar = await Udhar.create({
      customerName: customerName.trim(),
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      notes: notes || '',
      items: processedItems,
      payments: [],
      recordedBy: req.user._id,
      billRef: billRef || '',
    });

    res.status(201).json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all Udhar records (with optional filters)
// @route   GET /api/udhar
// @access  Private/Pharmacist,Superadmin
export const getAllUdhar = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { customerName: { $regex: s, $options: 'i' } },
        { customerPhone: { $regex: s, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Udhar.countDocuments(filter);

    const records = await Udhar.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('recordedBy', 'name');

    res.json({
      success: true,
      records,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single Udhar record
// @route   GET /api/udhar/:id
// @access  Private/Pharmacist,Superadmin
export const getUdharById = async (req, res, next) => {
  try {
    const udhar = await Udhar.findById(req.params.id).populate('recordedBy', 'name');
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }
    res.json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a medicine item to existing Udhar
// @route   POST /api/udhar/:id/add-item
// @access  Private/Pharmacist,Superadmin
export const addItemToUdhar = async (req, res, next) => {
  try {
    const udhar = await Udhar.findById(req.params.id);
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }

    if (udhar.status === 'PAID') {
      res.status(400);
      return next(new Error('Cannot add items to a fully paid Udhar'));
    }

    const { medicineName, quantity, unitPrice, dateTaken, notes } = req.body;

    if (!medicineName) {
      res.status(400);
      return next(new Error('Medicine name is required'));
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);

    udhar.items.push({
      medicineName: medicineName.trim(),
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
      dateTaken: dateTaken ? new Date(dateTaken) : new Date(),
      notes: notes || '',
    });

    await udhar.save();
    res.json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a medicine item from Udhar
// @route   DELETE /api/udhar/:id/item/:itemId
// @access  Private/Pharmacist,Superadmin
export const removeItemFromUdhar = async (req, res, next) => {
  try {
    const udhar = await Udhar.findById(req.params.id);
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }

    udhar.items = udhar.items.filter(
      (item) => item._id.toString() !== req.params.itemId
    );

    await udhar.save();
    res.json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a payment for an Udhar
// @route   POST /api/udhar/:id/pay
// @access  Private/Pharmacist,Superadmin
export const recordPayment = async (req, res, next) => {
  try {
    const udhar = await Udhar.findById(req.params.id);
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }

    if (udhar.status === 'PAID') {
      res.status(400);
      return next(new Error('This Udhar is already fully paid'));
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      res.status(400);
      return next(new Error('Payment amount must be a positive number'));
    }

    if (amount > udhar.remainingAmount) {
      res.status(400);
      return next(
        new Error(`Payment amount (Rs ${amount}) exceeds remaining balance (Rs ${udhar.remainingAmount})`)
      );
    }

    udhar.payments.push({
      amount,
      paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
      note: req.body.note || '',
    });

    await udhar.save();
    res.json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Udhar customer info / notes
// @route   PUT /api/udhar/:id
// @access  Private/Pharmacist,Superadmin
export const updateUdhar = async (req, res, next) => {
  try {
    const udhar = await Udhar.findById(req.params.id);
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }

    const { customerName, customerPhone, customerAddress, notes, billRef } = req.body;

    if (customerName) udhar.customerName = customerName.trim();
    if (customerPhone !== undefined) udhar.customerPhone = customerPhone;
    if (customerAddress !== undefined) udhar.customerAddress = customerAddress;
    if (notes !== undefined) udhar.notes = notes;
    if (billRef !== undefined) udhar.billRef = billRef;

    await udhar.save();
    res.json({ success: true, udhar });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an Udhar record
// @route   DELETE /api/udhar/:id
// @access  Private/Pharmacist,Superadmin
export const deleteUdhar = async (req, res, next) => {
  try {
    const udhar = await Udhar.findByIdAndDelete(req.params.id);
    if (!udhar) {
      res.status(404);
      return next(new Error('Udhar record not found'));
    }
    res.json({ success: true, message: 'Udhar record deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Udhar summary stats
// @route   GET /api/udhar/summary
// @access  Private/Pharmacist,Superadmin
export const getUdharSummary = async (req, res, next) => {
  try {
    const [pendingStats, paidStats, partialStats] = await Promise.all([
      Udhar.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, count: { $sum: 1 }, totalRemaining: { $sum: '$remainingAmount' } } },
      ]),
      Udhar.aggregate([
        { $match: { status: 'PAID' } },
        { $group: { _id: null, count: { $sum: 1 }, totalPaid: { $sum: '$totalPaid' } } },
      ]),
      Udhar.aggregate([
        { $match: { status: 'PARTIALLY_PAID' } },
        { $group: { _id: null, count: { $sum: 1 }, totalRemaining: { $sum: '$remainingAmount' } } },
      ]),
    ]);

    const overallStats = await Udhar.aggregate([
      {
        $group: {
          _id: null,
          totalUdharGiven: { $sum: '$totalAmount' },
          totalRecovered: { $sum: '$totalPaid' },
          totalPending: { $sum: '$remainingAmount' },
          totalCustomers: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      summary: {
        pending: pendingStats[0] || { count: 0, totalRemaining: 0 },
        paid: paidStats[0] || { count: 0, totalPaid: 0 },
        partial: partialStats[0] || { count: 0, totalRemaining: 0 },
        overall: overallStats[0] || {
          totalUdharGiven: 0,
          totalRecovered: 0,
          totalPending: 0,
          totalCustomers: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
