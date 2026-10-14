import { pagination } from '../utils/pagination.js';
import { medicineProfitStages, profitStages } from '../utils/profitAggregation.js';
import { allocateBillStock, restoreReturnedBatches, saleExpiryStatus } from '../utils/batchInventory.js';
import mongoose from 'mongoose';
import { saleDateFilter } from '../utils/saleDate.js';
import Bill from '../models/Bill.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import StockAdjustment from '../models/StockAdjustment.js';
import SaleReturn from '../models/SaleReturn.js';
import { getAvailableReturnQuantity, getBillReturnSummary } from '../utils/billReturnSummary.js';
import { checkExpiryStatus } from '../utils/expiryCheck.js';
import { getPurchaseCostPerUnit } from '../utils/medicinePricing.js';
import {
  getDiscountedReturnRefund,
  getNetItemAmounts,
  getSalePrice,
} from '../utils/billCalculations.js';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import Udhar from '../models/Udhar.js';
import { summarizeDailyClosing } from '../utils/dailyClosing.js';

const getLocalDateRange = (startDate, endDate) => {
  const parseDate = (value, endOfDay = false) => {
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(value);
    if (!Number.isFinite(parsed.getTime())) return null;
    parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return parsed;
  };

  return { start: parseDate(startDate), end: parseDate(endDate, true) };
};

const sendOrderStatusEmail = async (bill, status, rejectionReason = '') => {
  const email = bill?.customerId?.email;

  if (!email) {
    return;
  }

  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = Number(
    process.env.EMAIL_PORT || process.env.SMTP_PORT || 587
  );
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      'Order email skipped: SMTP email configuration is missing.'
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure:
      String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' ||
      port === 465,
    auth: {
      user,
      pass,
    },
  });

  const accepted = status === 'ACCEPTED';

  const subject = accepted
    ? `Sardar Medical Store Order ${bill.billNumber} Accepted`
    : `Sardar Medical Store Order ${bill.billNumber} Rejected`;

  const text = accepted
    ? `Hello ${bill.customerId?.name || 'Customer'},

Your order ${bill.billNumber} has been received and accepted by the pharmacist.

Total: PKR ${Number(bill.total || 0).toFixed(2)}

Thank you for using Sardar Medical Store.`
    : `Hello ${bill.customerId?.name || 'Customer'},

Your order ${bill.billNumber} has been rejected by the pharmacist.

${
  rejectionReason
    ? `Reason: ${rejectionReason}\n\n`
    : ''
}Please contact the pharmacy for more information.`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || user,
    to: email,
    subject,
    text,
  });
};

// @desc    Create a new bill or submit a customer order
// @route   POST /api/bills
// @access  Private
export const createBill = async (req, res, next) => {
  const {
    customerId,
    customerPhone,
    shippingAddress,
    items,
    discount,
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    return next(new Error('Bill items list cannot be empty'));
  }

  try {
    let finalCustomerId = customerId;
    let finalPharmacistId = null;

    const isCustomerOrder = req.user.role === 'customer';

    if (isCustomerOrder) {
      finalCustomerId = req.user._id;
    } else {
      finalPharmacistId = req.user._id;

      if (!finalCustomerId) {
        res.status(400);
        return next(
          new Error(
            'Customer ID is required for pharmacists to create a bill'
          )
        );
      }
    }

    const customer = await User.findById(finalCustomerId);

    if (!customer) {
      res.status(404);
      return next(new Error('Customer not found'));
    }

    const expiredItems = [];
    const insufficientStockItems = [];
    const validatedItems = [];
    const stockRequirements = new Map();

    let subtotal = 0;

    for (const item of items) {
      const requestedQuantity = Number(item.quantity);

      if (
        !Number.isInteger(requestedQuantity) ||
        requestedQuantity < 1
      ) {
        res.status(400);

        return next(
          new Error(
            `Invalid quantity for medicine ${item.medicineId}`
          )
        );
      }

      const medicine = await Medicine.findById(item.medicineId);

      if (!medicine) {
        res.status(404);

        return next(
          new Error(
            `Medicine with ID ${item.medicineId} not found`
          )
        );
      }
      if (medicine.isDeleted) {
        res.status(404);
        return next(new Error(`${medicine.name} is archived and cannot be added to a new bill`));
      }

      const expiryStatus = saleExpiryStatus(medicine);

      if (expiryStatus === 'EXPIRED') {
        expiredItems.push(
          `${medicine.name} (Rack: ${medicine.rackLocation || 'Not assigned'})`
        );
      }

      if (medicine.quantity < requestedQuantity) {
        insufficientStockItems.push(
          `${medicine.name} (Requested: ${requestedQuantity}, Available: ${medicine.quantity})`
        );
      }

      // Use custom salePrice from request if pharmacist set it, otherwise default to medicine.price
      let effectivePrice;
      try {
        effectivePrice = getSalePrice(
          req.user.role === 'customer' ? undefined : item.salePrice,
          medicine.price
        );
      } catch (error) {
        res.status(400);
        return next(error);
      }

      subtotal += effectivePrice * requestedQuantity;
      const medicineId = String(medicine._id);
      stockRequirements.set(
        medicineId,
        (stockRequirements.get(medicineId) || 0) + requestedQuantity
      );

      validatedItems.push({
        medicineId: medicine._id,
        name: medicine.name,
        quantity: requestedQuantity,
        unitPrice: effectivePrice,
        salePrice: effectivePrice,
        purchasePrice: getPurchaseCostPerUnit(medicine.purchasePrice, medicine.unitsPerPack),
        expiryStatus,
        expiryDate: medicine.expiryDate,
        rackLocation: medicine.rackLocation || '',
        ref: medicine,
      });
    }

    if (expiredItems.length > 0) {
      return res.status(403).json({
        message: `Billing rejected. The following medicines are expired and cannot be billed: ${expiredItems.join(
          ', '
        )}`,
        code: 'MEDICINE_EXPIRED',
        expiredMedicines: expiredItems,
      });
    }

    if (insufficientStockItems.length > 0) {
      res.status(400);

      return next(
        new Error(
          `Order rejected due to insufficient stock levels: ${insufficientStockItems.join(
            ', '
          )}`
        )
      );
    }

    if (isCustomerOrder && Number(discount || 0) !== 0) {
      return res.status(403).json({ message: 'Only pharmacy staff may apply discounts.' });
    }
    const finalDiscount =
      discount === undefined || discount === '' ? 0 : Number(discount);
    if (
      !Number.isFinite(finalDiscount) ||
      finalDiscount < 0 ||
      finalDiscount > subtotal
    ) {
      res.status(400);
      return next(new Error('Discount must be between zero and the bill subtotal'));
    }
    const total = Math.max(
      0,
      subtotal - finalDiscount
    );

    let bill;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (isCustomerOrder) {
          for (const item of validatedItems) {
            const lock = await Medicine.updateOne({ _id: item.medicineId, isDeleted: { $ne: true } }, { $set: { updatedAt: new Date() } }, { session });
            if (!lock.matchedCount) throw Object.assign(new Error('A medicine was archived or removed. Refresh your cart.'), { statusCode: 409 });
          }
        }
        [bill] = await Bill.create(
          [{
            pharmacistId: finalPharmacistId,
            customerId: finalCustomerId,
            customerPhone: customerPhone || customer.phone || null,
            shippingAddress: shippingAddress || '',
            billType: 'ONLINE',
            orderStatus: isCustomerOrder ? 'PENDING' : 'ACCEPTED',
            reviewedBy: isCustomerOrder ? null : finalPharmacistId,
            reviewedAt: isCustomerOrder ? null : new Date(),
            items: validatedItems.map((item) => ({
              medicineId: item.medicineId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              salePrice: item.salePrice,
              purchasePrice: item.purchasePrice,
              expiryStatus: item.expiryStatus,
              expiryDate: item.expiryDate,
              rackLocation: item.rackLocation,
            })),
            subtotal,
            discount: finalDiscount,
            total,
            paymentMethod: 'Cash',
          }],
          { session }
        );

        if (!isCustomerOrder) await allocateBillStock(bill, session);
      });
    } finally {
      await session.endSession();
    }

    const populatedBill = await Bill.findById(
      bill._id
    )
      .populate(
        'customerId',
        'name email phone'
      )
      .populate(
        'pharmacistId',
        'name email'
      );

    res.status(201).json(populatedBill);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bills for a specific customer
// @route   GET /api/bills/customer/:customerId
// @access  Private
export const getCustomerBills = async (
  req,
  res,
  next
) => {
  const { customerId } = req.params;

  try {
    if (
      req.user.role === 'customer' &&
      req.user._id.toString() !== customerId
    ) {
      res.status(403);

      throw new Error(
        'Not authorized to access this customer billing history'
      );
    }

    const { page, limit, skip } = pagination(req.query);
    const filter = { customerId, $expr: { $gt: [{ $sum: '$items.quantity' }, { $sum: '$returns.quantityReturned' }] } };
    const [summary] = await Bill.aggregate([
      { $match: { ...filter, customerId: new mongoose.Types.ObjectId(customerId) } },
      { $group: { _id: null, total: { $sum: 1 }, totalItems: { $sum: { $max: [0, { $subtract: [{ $sum: '$items.quantity' }, { $sum: '$returns.quantityReturned' }] }] } }, totalSpent: { $sum: { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] } }, monthlySpent: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] }, { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] }, 0] } } } },
    ]);
    const bills = await Bill.find(filter).skip(skip).limit(limit)
      .populate(
        'customerId',
        'name email phone'
      )
      .populate(
        'pharmacistId',
        'name email'
      )
      .populate(
        'reviewedBy',
        'name email'
      )
      .sort({
        createdAt: -1,
      });

    const rows = bills.map(bill => getBillReturnSummary(bill));
    const total = summary?.total || 0;
    res.json(req.query.page !== undefined ? { bills: rows, total, page, pages: Math.ceil(total / limit), summary } : rows);

  } catch (error) {
    next(error);
  }
};

// @desc    Generate downloadable PDF Invoice for a bill
// @route   GET /api/bills/:id/pdf
// @access  Private
export const generateBillPDF = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  try {
    const bill = await Bill.findById(id).populate(
      'customerId',
      'name email phone'
    );

    if (!bill) {
      res.status(404);
      throw new Error('Bill not found');
    }

    const billSummary = getBillReturnSummary(bill);

    if (
      req.user.role === 'customer' &&
      (
        !bill.customerId ||
        req.user._id.toString() !==
          bill.customerId._id.toString()
      )
    ) {
      res.status(403);

      throw new Error(
        'Not authorized to download this invoice'
      );
    }

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${bill.billNumber}.pdf`
    );

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
    });

    doc.pipe(res);

    doc
      .fillColor('#0ea5e9')
      .fontSize(22)
      .text(
        'SARDAR PHARMACY',
        50,
        45,
        {
          align: 'left',
        }
      )
      .fillColor('#64748b')
      .fontSize(10)
      .text(
        'Main Ada Girote Near MCB Bank | Mobile: 03056091354',
        50,
        70,
        {
          align: 'left',
        }
      )
      .moveDown();

    doc
      .fillColor('#0f172a')
      .fontSize(18)
      .text(
        'INVOICE / RECEIPT',
        300,
        45,
        {
          align: 'right',
          width: 245,
        }
      )
      .fontSize(10)
      .fillColor('#475569')
      .text(
        `Invoice No: ${bill.billNumber}`,
        300,
        68,
        {
          align: 'right',
          width: 245,
        }
      )
      .text(
        `Date: ${new Date(
          bill.createdAt
        ).toLocaleDateString()}`,
        300,
        83,
        {
          align: 'right',
          width: 245,
        }
      )
      .text(
        `Payment: ${bill.paymentMethod}`,
        300,
        98,
        {
          align: 'right',
          width: 245,
        }
      )
      .text(
        `Order Status: ${bill.orderStatus}`,
        300,
        113,
        {
          align: 'right',
          width: 245,
        }
      )
      .moveDown();

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, 135)
      .lineTo(550, 135)
      .stroke();

    const customerName =
      bill.customerName || bill.customerId?.name || 'Guest Customer';

    const customerEmail = bill.customerId
      ? bill.customerId.email
      : 'N/A';

    const customerPhone = bill.customerId
      ? (
          bill.customerPhone ||
          bill.customerId.phone ||
          'N/A'
        )
      : (
          bill.guestPhone ||
          'N/A'
        );

    doc
      .fillColor('#0f172a')
      .fontSize(12)
      .text(
        'Billed To:',
        50,
        155,
        {
          bold: true,
        }
      )
      .fontSize(10)
      .fillColor('#475569')
      .text(
        `Name: ${customerName}`,
        50,
        175
      )
      .text(
        `Email: ${customerEmail}`,
        50,
        190
      )
      .text(
        `Phone: ${customerPhone}`,
        50,
        205
      )
      .text(
        `Delivery: ${
          bill.shippingAddress || 'N/A'
        }`,
        50,
        220,
        {
          width: 500,
        }
      )
      .moveDown(2);

    const tableTop = 255;

    doc
      .fillColor('#0f172a')
      .fontSize(10)
      .text(
        'Medicine Details',
        50,
        tableTop,
        {
          bold: true,
        }
      )
      .text(
        'Expiry Date',
        240,
        tableTop,
        {
          bold: true,
        }
      )
      .text(
        'Unit Price',
        340,
        tableTop,
        {
          bold: true,
          align: 'right',
          width: 60,
        }
      )
      .text(
        'Qty / Net',
        420,
        tableTop,
        {
          bold: true,
          align: 'right',
          width: 50,
        }
      )
      .text(
        'Total',
        500,
        tableTop,
        {
          bold: true,
          align: 'right',
          width: 50,
        }
      );

    doc
      .strokeColor('#94a3b8')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    let y = tableTop + 25;

    billSummary.netItems.forEach((item) => {
      const quantity = Number(item.netQuantity) || 0;
      if (quantity <= 0) return;
      const salePrice = Number(item.salePrice ?? item.unitPrice) || 0;
      const netLineTotal = Number(item.netSales) || 0;
      const expDate = item.expiryDate
        ? new Date(
            item.expiryDate
          ).toLocaleDateString(
            'en-IN',
            {
              month: 'short',
              year: 'numeric',
            }
          )
        : 'N/A';

      doc
        .fillColor('#334155')
        .text(
          item.name,
          50,
          y,
          {
            width: 180,
          }
        )
        .text(
          expDate,
          240,
          y
        )
        .text(
          `PKR ${salePrice.toFixed(
            2
          )}`,
          340,
          y,
          {
            align: 'right',
            width: 60,
          }
        )
        .text(
          `${quantity}`,
          420,
          y,
          {
            align: 'right',
            width: 50,
          }
        )
        .text(
          `PKR ${netLineTotal.toFixed(2)}`,
          500,
          y,
          {
            align: 'right',
            width: 50,
          }
        );

      y += 20;
    });

    const subtotalY = y + 15;

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(340, subtotalY)
      .lineTo(550, subtotalY)
      .stroke();

    doc
      .fillColor('#475569')
      .fontSize(10)
      .text(
        'Subtotal:',
        340,
        subtotalY + 10,
        {
          align: 'right',
          width: 130,
        }
      )
      .text(
        `PKR ${billSummary.netItems.reduce((sum, item) => sum + (Number(item.salePrice ?? item.unitPrice) || 0) * item.netQuantity, 0).toFixed(
          2
        )}`,
        480,
        subtotalY + 10,
        {
          align: 'right',
          width: 70,
        }
      )
      .text(
        'Discount Applied:',
        340,
        subtotalY + 25,
        {
          align: 'right',
          width: 130,
        }
      )
      .text(
        `-PKR ${Math.max(0, billSummary.netItems.reduce((sum, item) => sum + (Number(item.salePrice ?? item.unitPrice) || 0) * item.netQuantity, 0) - billSummary.netTotal).toFixed(
          2
        )}`,
        480,
        subtotalY + 25,
        {
          align: 'right',
          width: 70,
        }
      )
      .fillColor('#0ea5e9')
      .fontSize(12)
      .text(
        'Net Sale Amount:',
        340,
        subtotalY + 45,
        {
          bold: true,
          align: 'right',
          width: 130,
        }
      )
      .text(
        `PKR ${billSummary.netTotal.toFixed(2)}`,
        480,
        subtotalY + 45,
        {
          bold: true,
          align: 'right',
          width: 70,
        }
      );

    if ((bill.totalRefunded || 0) > 0) {
      doc
        .fillColor('#dc2626')
        .fontSize(10)
        .text('Total Refunded:', 340, subtotalY + 65, {
          align: 'right',
          width: 130,
        })
        .text(
          `-PKR ${Number(bill.totalRefunded).toFixed(2)}`,
          480,
          subtotalY + 65,
          { align: 'right', width: 70 }
        );
    }

    doc
      .fillColor('#64748b')
      .fontSize(9)
      .text(
        'Thank you for choosing Sardar Medical Store. Wishing you strong health!',
        50,
        720,
        {
          align: 'center',
          width: 500,
        }
      )
      .fontSize(7)
      .text(
        'This is a computer-generated transaction invoice and requires no physical signatures.',
        50,
        735,
        {
          align: 'center',
          width: 500,
        }
      );

    doc.end();
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
export const getAllBills = async (
  req,
  res,
  next
) => {
  try {
    if (req.user.role === 'customer') {
      res.status(403);

      throw new Error(
        'Not authorized to access all billing history'
      );
    }

    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.accepted === 'true') filter.orderStatus = { $nin: ['PENDING', 'REJECTED'] };
    if (req.query.includeReturned !== 'true') filter.$expr = { $gt: [{ $sum: '$items.quantity' }, { $sum: '$returns.quantityReturned' }] };
    if (req.query.search) { const text = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = ['billNumber', 'customerName', 'customerPhone'].map(field => ({ [field]: { $regex: text, $options: 'i' } })); }
    if (req.query.startDate && req.query.endDate) {
      const range = getLocalDateRange(req.query.startDate, req.query.endDate);
      if (!range.start || !range.end) return res.status(400).json({ message: 'Invalid date range.' });
      filter.$and = [saleDateFilter({ $gte: range.start, $lte: range.end })];
    }
    const total = await Bill.countDocuments(filter);
    const bills = await Bill.find(filter).skip(skip).limit(limit)
      .populate(
        'customerId',
        'name email phone'
      )
      .populate(
        'pharmacistId',
        'name email'
      )
      .populate(
        'reviewedBy',
        'name email'
      )
      .sort({
        createdAt: -1,
      });

    const summarizedBills = bills.map((bill) => getBillReturnSummary(bill));
    res.json(req.query.page !== undefined ? { bills: summarizedBills, total, page, pages: Math.ceil(total / limit) } : summarizedBills);
  } catch (error) {
    next(error);
  }
};

// @desc    Get online customer orders
// @route   GET /api/bills/online-orders
// @access  Private/Pharmacist/Superadmin
export const getOnlineOrders = async (
  req,
  res,
  next
) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const filter = { billType: 'ONLINE', customerId: { $ne: null } };
    if (req.query.status) filter.orderStatus = req.query.status;
    const total = await Bill.countDocuments(filter);
    const orders = await Bill.find(filter).skip(skip).limit(limit)
      .populate(
        'customerId',
        'name email phone'
      )
      .populate(
        'pharmacistId',
        'name email'
      )
      .populate(
        'reviewedBy',
        'name email'
      )
      .sort({
        createdAt: -1,
      });

    res.json(req.query.page !== undefined ? { orders, total, page, pages: Math.ceil(total / limit) } : orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Accept an online customer order
// @route   PUT /api/bills/online-orders/:id/accept
// @access  Private/Pharmacist/Superadmin
export const acceptOnlineOrder = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const bill = await Bill.findOne({
          _id: id,
          billType: 'ONLINE',
          orderStatus: 'PENDING',
        }).session(session);

        if (!bill) {
          const error = new Error('Pending online order not found');
          error.statusCode = 404;
          throw error;
        }

        const requirements = new Map();
        for (const item of bill.items) {
          const quantity = Number(item.quantity);
          if (!Number.isInteger(quantity) || quantity < 1) {
            throw new Error(`Invalid quantity in order for ${item.name}`);
          }

          const medicine = await Medicine.findById(item.medicineId).session(session);
          if (!medicine) {
            const error = new Error(`Medicine not found: ${item.name}`);
            error.statusCode = 404;
            throw error;
          }
          if (medicine.isDeleted) {
            const error = new Error(`${medicine.name} is archived and cannot be sold`);
            error.statusCode = 404;
            throw error;
          }
          if (saleExpiryStatus(medicine) === 'EXPIRED') {
            const error = new Error(`${medicine.name} is expired and cannot be accepted`);
            error.statusCode = 403;
            throw error;
          }

          const medicineId = String(medicine._id);
          requirements.set(
            medicineId,
            (requirements.get(medicineId) || 0) + quantity
          );
        }

        await allocateBillStock(bill, session);

        bill.orderStatus = 'ACCEPTED';
        bill.pharmacistId = req.user._id;
        bill.reviewedBy = req.user._id;
        bill.reviewedAt = new Date();
        bill.rejectionReason = '';
        await bill.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const populatedBill =
      await Bill.findById(id)
        .populate(
          'customerId',
          'name email phone'
        )
        .populate(
          'pharmacistId',
          'name email'
        )
        .populate(
          'reviewedBy',
          'name email'
        );

    try {
      await sendOrderStatusEmail(
        populatedBill,
        'ACCEPTED'
      );
    } catch (emailError) {
      console.error(
        'Order accepted but email notification failed:',
        emailError
      );
    }

    res.json({
      success: true,
      message:
        'Order accepted successfully.',
      bill: populatedBill,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject an online customer order
// @route   PUT /api/bills/online-orders/:id/reject
// @access  Private/Pharmacist/Superadmin
export const rejectOnlineOrder = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  const rejectionReason = String(
    req.body?.rejectionReason || ''
  ).trim();

  try {
    const bill = await Bill.findOne({
      _id: id,
      billType: 'ONLINE',
      orderStatus: 'PENDING',
    }).populate(
      'customerId',
      'name email phone'
    );

    if (!bill) {
      res.status(404);

      throw new Error(
        'Pending online order not found'
      );
    }

    bill.orderStatus = 'REJECTED';
    bill.rejectionReason =
      rejectionReason;
    bill.pharmacistId = req.user._id;
    bill.reviewedBy = req.user._id;
    bill.reviewedAt = new Date();

    await bill.save();

    const populatedBill =
      await Bill.findById(bill._id)
        .populate(
          'customerId',
          'name email phone'
        )
        .populate(
          'pharmacistId',
          'name email'
        )
        .populate(
          'reviewedBy',
          'name email'
        );

    try {
      await sendOrderStatusEmail(
        populatedBill,
        'REJECTED',
        rejectionReason
      );
    } catch (emailError) {
      console.error(
        'Order rejected but email notification failed:',
        emailError
      );
    }

    res.json({
      success: true,
      message:
        'Order rejected successfully.',
      bill: populatedBill,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single bill detail
// @route   GET /api/bills/:id
// @access  Private
export const getBillById = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  try {
    const bill = await Bill.findById(id)
      .populate(
        'customerId',
        'name email phone'
      )
      .populate(
        'pharmacistId',
        'name email role'
      )
      .populate(
        'reviewedBy',
        'name email role'
      )
      .populate(
        'returns.returnedBy',
        'name email role'
      );

    if (!bill) {
      res.status(404);

      throw new Error(
        'Bill not found'
      );
    }

    if (
      req.user.role === 'customer' &&
      (
        !bill.customerId ||
        req.user._id.toString() !==
          bill.customerId._id.toString()
      )
    ) {
      res.status(403);

      throw new Error(
        'Not authorized to access this bill record'
      );
    }

    res.json(getBillReturnSummary(bill));
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup customer by phone number
// @route   GET /api/bills/lookup-customer
// @access  Private
export const lookupCustomerByPhone = async (
  req,
  res,
  next
) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      res.status(400);

      throw new Error(
        'Phone number query parameter is required'
      );
    }

    const customer =
      await User.findOne({
        phone,
        role: 'customer',
      });

    if (customer) {
      return res.json({
        found: true,
        customer: {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      });
    }

    return res.json({
      found: false,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create an in-store checkout bill
// @route   POST /api/bills/instore
// @access  Private/Pharmacist/Superadmin
export const createInstoreBill = async (
  req,
  res,
  next
) => {
  const {
    customerName,
    customerPhone,
    customerId,
    discount,
    paymentMethod = 'Cash',
    items,
  } = req.body;

  if (!['Cash', 'Card', 'UPI', 'Online'].includes(paymentMethod)) {
    res.status(400);
    return next(new Error('Choose a valid payment method'));
  }

  if (req.user.role === 'customer') {
    res.status(403);

    return next(
      new Error(
        'Customers are not authorized to create in-store bills'
      )
    );
  }

  if (
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    res.status(400);

    return next(
      new Error(
        'Bill items list cannot be empty'
      )
    );
  }

  try {
    const linkedCustomer = customerId
      ? await User.findById(customerId)
      : null;
    if (customerId && !linkedCustomer) {
      res.status(404);
      return next(new Error('Customer not found'));
    }

    const normalizedCustomerName =
      (typeof customerName === 'string' ? customerName : '').trim() ||
      linkedCustomer?.name ||
      null;
    const normalizedCustomerPhone =
      (typeof customerPhone === 'string' ? customerPhone : '').trim() ||
      linkedCustomer?.phone ||
      null;

    const expiredItems = [];
    const insufficientStockItems = [];
    const validatedItems = [];
    const stockRequirements = new Map();

    let subtotal = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        res.status(400);
        return next(new Error('Medicine quantities must be positive whole units'));
      }

      const medicine = await Medicine.findById(item.medicineId);

      if (!medicine) {
        res.status(404);

        return next(
          new Error(
            `Medicine not found: ${
              item.name ||
              item.medicineId
            }`
          )
        );
      }
      if (medicine.isDeleted) {
        res.status(404);
        return next(new Error(`${medicine.name} is archived and cannot be added to a new bill`));
      }

      const expiryStatus =
        saleExpiryStatus(medicine);

      if (expiryStatus === 'EXPIRED') {
        expiredItems.push(
          `${medicine.name} (Rack: ${medicine.rackLocation || 'Not assigned'})`
        );
      }

      if (
        medicine.quantity <
        quantity
      ) {
        insufficientStockItems.push(
          `${medicine.name} (Requested: ${quantity}, Available: ${medicine.quantity})`
        );
      }

      let salePrice;
      try {
        salePrice = getSalePrice(
          item.salePrice,
          medicine.price
        );
      } catch (error) {
        res.status(400);
        return next(error);
      }

      subtotal += salePrice * quantity;
      const medicineId = String(medicine._id);
      stockRequirements.set(
        medicineId,
        (stockRequirements.get(medicineId) || 0) + quantity
      );

      validatedItems.push({
        medicineId: medicine._id,
        name: medicine.name,
        quantity,
        unitPrice: salePrice,
        salePrice,
        purchasePrice: getPurchaseCostPerUnit(medicine.purchasePrice, medicine.unitsPerPack),
        expiryStatus,
        expiryDate:
          medicine.expiryDate,
        rackLocation: medicine.rackLocation || '',
        ref: medicine,
      });
    }

    if (expiredItems.length > 0) {
      return res.status(403).json({
        message: `Billing rejected. The following medicines are expired and cannot be billed: ${expiredItems.join(
          ', '
        )}`,
        code: 'MEDICINE_EXPIRED',
        expiredMedicines:
          expiredItems,
      });
    }

    if (
      insufficientStockItems.length >
      0
    ) {
      res.status(400);

      return next(
        new Error(
          `Billing rejected due to insufficient stock levels: ${insufficientStockItems.join(
            ', '
          )}`
        )
      );
    }

    const finalDiscount =
      discount === undefined || discount === '' ? 0 : Number(discount);
    if (
      !Number.isFinite(finalDiscount) ||
      finalDiscount < 0 ||
      finalDiscount > subtotal
    ) {
      res.status(400);
      return next(new Error('Discount must be between zero and the bill subtotal'));
    }

    const total = Math.max(
      0,
      subtotal - finalDiscount
    );

    let bill;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        [bill] = await Bill.create(
          [{
            pharmacistId: req.user._id,
            customerId: customerId || null,
            customerName: normalizedCustomerName,
            customerPhone: normalizedCustomerPhone,
            guestPhone: customerId ? null : normalizedCustomerPhone,
            billType: 'INSTORE',
            orderStatus: 'ACCEPTED',
            reviewedBy: req.user._id,
            reviewedAt: new Date(),
            items: validatedItems.map((item) => ({
              medicineId: item.medicineId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              salePrice: item.salePrice,
              purchasePrice: item.purchasePrice,
              expiryStatus: item.expiryStatus,
              expiryDate: item.expiryDate,
              rackLocation: item.rackLocation,
            })),
            subtotal,
            discount: finalDiscount,
            total,
            paymentMethod,
          }],
          { session }
        );

        await allocateBillStock(bill, session);
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      bill,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's and current month's total sales
// @route   GET /api/bills/sales-summary
// @access  Private/Pharmacist/Superadmin
export const getSalesSummary = async (
  req,
  res,
  next
) => {
  try {
    if (
      req.user.role !== 'pharmacist' &&
      req.user.role !== 'superadmin'
    ) {
      res.status(403);

      return next(
        new Error(
          'Only pharmacists and superadmins can view sales summary'
        )
      );
    }

    const now = new Date();

    const startOfDay =
      new Date(now);

    startOfDay.setHours(
      0,
      0,
      0,
      0
    );

    const startOfTomorrow =
      new Date(
        startOfDay
      );

    startOfTomorrow.setDate(
      startOfTomorrow.getDate() + 1
    );

    const startOfMonth =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    const startOfNextMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

    const acceptedMatch = {
      orderStatus: {
        $nin: [
          'PENDING',
          'REJECTED',
        ],
      },
    };

    const aggregateSales = async (start, end) => {
      const [result] = await Bill.aggregate([
        { $match: { ...acceptedMatch, ...saleDateFilter({ $gte: start, $lt: end }) } },
        { $set: { net: { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] } } },
        { $match: { $expr: { $gt: [{ $sum: '$items.quantity' }, { $sum: '$returns.quantityReturned' }] } } },
        { $group: { _id: null, totalSales: { $sum: '$net' }, totalBills: { $sum: 1 } } },
      ]);
      return result || { totalSales: 0, totalBills: 0 };
    };
    const [todaySummary, monthlySummary, yearlySummary] = await Promise.all([
      aggregateSales(startOfDay, startOfTomorrow), aggregateSales(startOfMonth, startOfNextMonth), aggregateSales(startOfYear, startOfNextYear),
    ]);

    res.json({
      success: true,

      today: {
        totalSales: todaySummary.totalSales,
        totalBills: todaySummary.totalBills,
      },

      month: {
        totalSales: monthlySummary.totalSales,
        totalBills: monthlySummary.totalBills,
      },

      year: {
        totalSales: yearlySummary.totalSales,
        totalBills: yearlySummary.totalBills,
      },
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Get profit summary (daily, monthly, yearly, custom date range)
// @route   GET /api/bills/profit-summary
// @access  Private/Pharmacist/Superadmin
export const getDailyClosingReport = async (req, res, next) => {
  try {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const day = req.query.date || localToday;
    const range = getLocalDateRange(day, day);
    if (!range.start || !range.end) return res.status(400).json({ message: 'Provide a valid report date in YYYY-MM-DD format.' });
    const billFilter = { ...saleDateFilter({ $gte: range.start, $lte: range.end }), orderStatus: { $nin: ['PENDING', 'REJECTED'] } };
    const [bills, returns, udharIssued, udharPayments] = await Promise.all([
      Bill.aggregate([{ $match: billFilter }, { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      SaleReturn.aggregate([{ $match: { date: { $gte: range.start, $lte: range.end } } },
        { $lookup: { from: 'bills', localField: 'sale_id', foreignField: '_id', as: 'bill' } },
        { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$bill.paymentMethod', 0] }, 'Cash'] }, total: { $sum: '$refund_amount' } } }]),
      Udhar.aggregate([{ $match: { createdAt: { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Udhar.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paidAt': { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } }]),
    ]);
    const creditIssued = Number(udharIssued[0]?.total || 0);
    const creditRecovered = Number(udharPayments[0]?.total || 0);
    res.json({ date: day, billCount: bills.reduce((sum, group) => sum + group.count, 0), ...summarizeDailyClosing({
      bills: bills.map(group => ({ paymentMethod: group._id, total: group.total })),
      returns: returns.map(group => ({ sale_id: { paymentMethod: group._id }, refund_amount: group.total })), creditIssued, creditRecovered }),
      udharEntries: Number(udharIssued[0]?.count || 0), udharPayments: Number(udharPayments[0]?.count || 0) });
  } catch (error) { next(error); }
};

export const getProfitSummary = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacist' && req.user.role !== 'superadmin') {
      res.status(403);
      return next(new Error('Only pharmacists and superadmins can view profit summary'));
    }

    const { startDate, endDate } = req.query;
    const matchStage = {
      orderStatus: { $nin: ['PENDING', 'REJECTED'] },
    };

    if (startDate && endDate) {
      const range = getLocalDateRange(startDate, endDate);
      if (!range.start || !range.end || range.start > range.end) {
        res.status(400);
        return next(new Error('A valid start and end date are required'));
      }
      matchStage.createdAt = {
        $gte: range.start,
        $lte: range.end,
      };
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const range = startDate && endDate ? getLocalDateRange(startDate, endDate) : null;
    const earliest = range ? new Date(Math.min(range.start.getTime(), startOfYear.getTime())) : startOfYear;
    const [summary] = await Bill.aggregate([
      { $match: { orderStatus: { $nin: ['PENDING', 'REJECTED'] }, ...saleDateFilter({ $gte: earliest }) } },
      ...profitStages(),
      { $group: { _id: null,
        dailyProfit: { $sum: { $cond: [{ $gte: ['$saleDate', startOfDay] }, '$profit', 0] } },
        monthlyProfit: { $sum: { $cond: [{ $gte: ['$saleDate', startOfMonth] }, '$profit', 0] } },
        yearlyProfit: { $sum: { $cond: [{ $gte: ['$saleDate', startOfYear] }, '$profit', 0] } },
        customProfit: { $sum: { $cond: [range ? { $and: [{ $gte: ['$saleDate', range.start] }, { $lte: ['$saleDate', range.end] }] } : false, '$profit', 0] } },
        customSales: { $sum: { $cond: [range ? { $and: [{ $gte: ['$saleDate', range.start] }, { $lte: ['$saleDate', range.end] }] } : false, '$netTotal', 0] } },
      } },
    ]).allowDiskUse(true);
    const { dailyProfit = 0, monthlyProfit = 0, yearlyProfit = 0, customProfit = 0, customSales = 0 } = summary || {};

    res.json({
      success: true,
      dailyProfit,
      monthlyProfit,
      yearlyProfit,
      customRange: startDate && endDate ? { profit: customProfit, sales: customSales } : null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed profit by medicine
// @route   GET /api/bills/profit-details
// @access  Private/Pharmacist/Superadmin
export const getProfitDetails = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const match = { orderStatus: { $nin: ['PENDING', 'REJECTED'] } };
    if (req.query.startDate || req.query.endDate) {
      const range = getLocalDateRange(req.query.startDate, req.query.endDate);
      if (!range.start || !range.end || range.start > range.end) return res.status(400).json({ message: 'A valid start and end date are required.' });
      Object.assign(match, saleDateFilter({ $gte: range.start, $lte: range.end }));
    }
    const [result] = await Bill.aggregate([
      { $match: match }, ...medicineProfitStages(),
      { $facet: { profitDetails: [{ $sort: { totalProfit: -1, _id: 1 } }, { $skip: skip }, { $limit: limit }],
        totals: [{ $group: { _id: null, total: { $sum: 1 }, quantitySold: { $sum: '$quantitySold' }, remainingStock: { $sum: '$remainingStock' }, totalCost: { $sum: '$totalCost' }, totalDiscount: { $sum: '$totalDiscount' }, totalSales: { $sum: '$totalSales' }, totalProfit: { $sum: '$totalProfit' } } }],
      } },
    ]).allowDiskUse(true);
    const totals = result?.totals[0] || {};
    res.json({ success: true, profitDetails: result?.profitDetails || [], totals, total: totals.total || 0, page, pages: Math.ceil((totals.total || 0) / limit) });
  } catch (error) { next(error); }
};

// @desc    Process Sales Return (Return medicines & issue refund)
// @route   POST /api/bills/:id/return
// @access  Private/Pharmacist,Superadmin
export const processSalesReturn = async (req, res, next) => {
  const { id } = req.params;
  const { returns } = req.body;

  try {
    if (!returns || !Array.isArray(returns) || returns.length === 0) {
      res.status(400);
      return next(new Error('Please provide at least one medicine item to return'));
    }

    const returnIds = returns.map((item) => String(item.medicineId || ''));
    if (returnIds.some((medicineId) => !medicineId) || new Set(returnIds).size !== returnIds.length) {
      res.status(400);
      return next(new Error('Each medicine can only appear once in a return request'));
    }

    let totalRefundThisCall = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const bill = await Bill.findById(id).session(session);
        if (!bill) {
          const error = new Error('Bill not found');
          error.statusCode = 404;
          throw error;
        }
        if (['PENDING', 'REJECTED'].includes(bill.orderStatus)) {
          const error = new Error('Only accepted sales can be returned');
          error.statusCode = 400;
          throw error;
        }

        totalRefundThisCall = 0;
        for (const returnItem of returns) {
          const { medicineId, quantityReturned, reason } = returnItem;
          const qtyToReturn = Number(quantityReturned);
          if (!Number.isInteger(qtyToReturn) || qtyToReturn <= 0) {
            const error = new Error('Return quantities must be positive whole units');
            error.statusCode = 400;
            throw error;
          }

          const matchingItems = bill.items.filter(
            (item) => String(item.medicineId) === String(medicineId)
          );
          if (matchingItems.length === 0) {
            const error = new Error(`Medicine item not found in bill ${bill.billNumber}`);
            error.statusCode = 404;
            throw error;
          }
          const billItem = matchingItems[0];

          const itemReturns = (bill.returns || []).filter(
            (item) => String(item.medicineId) === String(medicineId)
          );
          const previouslyReturned = itemReturns.reduce(
            (sum, item) => sum + item.quantityReturned,
            0
          );
          const totalItemQuantity = matchingItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          );
          const availableToReturn = getAvailableReturnQuantity(totalItemQuantity, previouslyReturned);
          if (qtyToReturn > availableToReturn) {
            const error = new Error(
              `Cannot return ${qtyToReturn} of "${billItem.name}". Maximum available to return is ${availableToReturn}.`
            );
            error.statusCode = 400;
            throw error;
          }

          const itemSalePrice =
            matchingItems.reduce(
              (sum, item) =>
                sum +
                Number(item.salePrice ?? item.unitPrice ?? 0) *
                  Number(item.quantity || 0),
              0
            ) / totalItemQuantity;
          const previousItemRefunds = itemReturns.reduce(
            (sum, item) => sum + item.refundAmount,
            0
          );
          const refundAmount = getDiscountedReturnRefund({
            itemSalePrice,
            itemQuantity: totalItemQuantity,
            quantityAlreadyReturned: previouslyReturned,
            quantityToReturn: qtyToReturn,
            subtotal: Number(bill.subtotal) || 0,
            discount: Number(bill.discount) || 0,
            previousItemRefunds,
          });

          const medicine = await Medicine.findById(medicineId).session(session);
          if (!medicine) {
            const error = new Error(`Cannot restock missing medicine: ${billItem.name}`);
            error.statusCode = 404;
            throw error;
          }

          const previousQuantity = medicine.quantity;
          restoreReturnedBatches(medicine, matchingItems, qtyToReturn, previouslyReturned);
          const updatedMedicine = await medicine.save({ session });
          await StockAdjustment.create(
            [{
              medicineId: medicine._id,
              medicineName: medicine.name,
              previousQuantity,
              newQuantity: updatedMedicine.quantity,
              adjustmentType: 'ADD',
              quantityChanged: qtyToReturn,
              reason: `Sales Return (Bill #${bill.billNumber}): ${String(reason || 'Customer Return').trim()}`,
              adjustedBy: req.user._id,
            }],
            { session }
          );

          bill.returns.push({
            medicineId: billItem.medicineId,
            name: billItem.name,
            quantityReturned: qtyToReturn,
            unitPrice: refundAmount / qtyToReturn,
            refundAmount,
            reason: String(reason || '').trim() || 'Customer Sale Return',
            returnedAt: new Date(),
            returnedBy: req.user._id,
          });
          await SaleReturn.create([{
            sale_id: bill._id,
            item_id: billItem.medicineId,
            item_name: billItem.name,
            bill_number: bill.billNumber,
            qty_returned: qtyToReturn,
            refund_amount: refundAmount,
            reason: String(reason || '').trim() || 'Customer Sale Return',
            processed_by: req.user._id,
            date: new Date(),
          }], { session });
          totalRefundThisCall += refundAmount;
        }

        bill.totalRefunded = (bill.totalRefunded || 0) + totalRefundThisCall;
        bill.isReturned = true;
        bill.isFullyReturned = getBillReturnSummary(bill).isFullyReturned;
        await bill.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const updatedBill = await Bill.findById(id)
      .populate('pharmacistId', 'name email')
      .populate('customerId', 'name email phone')
      .populate('returns.returnedBy', 'name email role');

    res.json({
      success: true,
      message: `Sales return processed successfully! Refunded: PKR ${totalRefundThisCall.toFixed(2)}`,
      bill: getBillReturnSummary(updatedBill),
      refundedAmount: totalRefundThisCall,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin audit feed for refunds/returns
// @route   GET /api/bills/return-activity
export const getReturnActivity = async (req, res, next) => {
  try {
    const returns = await SaleReturn.find()
      .sort({ date: -1, createdAt: -1 })
      .skip(pagination(req.query).skip).limit(pagination(req.query).limit)
      .populate('processed_by', 'name email role')
      .populate('item_id', 'name')
      .populate('sale_id', 'billNumber customerName customerPhone')
      .lean();
    const total = await SaleReturn.countDocuments();
    res.json({ success: true, returns, total, page: pagination(req.query).page, pages: Math.ceil(total / pagination(req.query).limit) });
  } catch (error) { next(error); }
};

// @desc    Get most-sold and least-sold medicines ranking
// @route   GET /api/bills/medicine-sales-ranking
// @access  Private/Pharmacist/Superadmin
export const getMedicineSalesRanking = async (req, res, next) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const [result] = await Bill.aggregate([
      { $match: { orderStatus: { $nin: ['PENDING', 'REJECTED'] } } }, ...medicineProfitStages(),
      { $project: { medicineId: 1, name: 1, totalUnits: '$quantitySold', totalRevenue: '$totalSales' } },
      { $facet: { topSelling: [{ $sort: { totalUnits: -1, _id: 1 } }, { $skip: skip }, { $limit: limit }], leastSelling: [{ $sort: { totalUnits: 1, _id: 1 } }, { $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } },
    ]).allowDiskUse(true);
    const total = result?.count[0]?.total || 0;
    res.json({ success: true, topSelling: result?.topSelling || [], leastSelling: result?.leastSelling || [], totalMedicinesWithSales: total, total, page, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};
