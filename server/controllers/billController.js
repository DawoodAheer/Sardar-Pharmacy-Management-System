import mongoose from 'mongoose';
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

      const expiryStatus = checkExpiryStatus(
        medicine.expiryDate
      );

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

        if (!isCustomerOrder) {
          for (const [medicineId, quantity] of stockRequirements) {
            const result = await Medicine.updateOne(
              { _id: medicineId, quantity: { $gte: quantity } },
              { $inc: { quantity: -quantity } },
              { session }
            );
            if (!result.modifiedCount) {
              const error = new Error(
                'Stock changed during billing. Please refresh and try again.'
              );
              error.statusCode = 409;
              throw error;
            }
          }
        }
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

    const bills = await Bill.find({
      customerId,
    })
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

    res.json(
      bills
        .map((bill) => getBillReturnSummary(bill))
        .filter((bill) => !bill.isFullyReturned)
    );
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

    const bills = await Bill.find({})
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
    res.json(
      req.query.includeReturned === 'true'
        ? summarizedBills
        : summarizedBills.filter((bill) => !bill.isFullyReturned)
    );
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
    const orders = await Bill.find({
      billType: 'ONLINE',
      customerId: {
        $ne: null,
      },
    })
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

    res.json(orders);
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
          if (checkExpiryStatus(medicine.expiryDate) === 'EXPIRED') {
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

        for (const [medicineId, quantity] of requirements) {
          const result = await Medicine.updateOne(
            { _id: medicineId, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity } },
            { session }
          );
          if (!result.modifiedCount) {
            const error = new Error(
              'Stock changed during order acceptance. Refresh and try again.'
            );
            error.statusCode = 409;
            throw error;
          }
        }

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
        'name email'
      )
      .populate(
        'reviewedBy',
        'name email'
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
        checkExpiryStatus(
          medicine.expiryDate
        );

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

        for (const [medicineId, quantity] of stockRequirements) {
          const result = await Medicine.updateOne(
            { _id: medicineId, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity } },
            { session }
          );
          if (!result.modifiedCount) {
            const error = new Error(
              'Stock changed during billing. Please refresh and try again.'
            );
            error.statusCode = 409;
            throw error;
          }
        }
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

    const [todayBills, monthBills, yearBills] = await Promise.all([
      Bill.find({
        ...acceptedMatch,
        createdAt: { $gte: startOfDay, $lt: startOfTomorrow },
      }).lean(),
      Bill.find({
        ...acceptedMatch,
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
      }).lean(),
      Bill.find({
        ...acceptedMatch,
        createdAt: { $gte: startOfYear, $lt: startOfNextYear },
      }).lean(),
    ]);
    const summarizeSales = (records) =>
      records
        .map((bill) => getBillReturnSummary(bill))
        .filter((bill) => !bill.isFullyReturned)
        .reduce(
          (summary, bill) => ({
            totalSales: summary.totalSales + bill.netTotal,
            totalBills: summary.totalBills + 1,
          }),
          { totalSales: 0, totalBills: 0 }
        );
    const todaySummary = summarizeSales(todayBills);
    const monthlySummary = summarizeSales(monthBills);
    const yearlySummary = summarizeSales(yearBills);

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
    const billFilter = { createdAt: { $gte: range.start, $lte: range.end }, orderStatus: { $nin: ['PENDING', 'REJECTED'] } };
    const [bills, returns, udharIssued, udharPayments] = await Promise.all([
      Bill.find(billFilter).select('total paymentMethod').lean(),
      SaleReturn.find({ date: { $gte: range.start, $lte: range.end } }).populate('sale_id', 'paymentMethod').lean(),
      Udhar.aggregate([{ $match: { createdAt: { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Udhar.aggregate([{ $unwind: '$payments' }, { $match: { 'payments.paidAt': { $gte: range.start, $lte: range.end } } }, { $group: { _id: null, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } }]),
    ]);
    const creditIssued = Number(udharIssued[0]?.total || 0);
    const creditRecovered = Number(udharPayments[0]?.total || 0);
    res.json({ date: day, billCount: bills.length, ...summarizeDailyClosing({ bills, returns, creditIssued, creditRecovered }),
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

    const [bills, medicines] = await Promise.all([
      Bill.find(matchStage).lean(),
      Medicine.find().select('_id purchasePrice unitsPerPack').lean(),
    ]);
    const purchasePriceByMedicine = new Map(
      medicines.map((medicine) => [
        String(medicine._id),
        getPurchaseCostPerUnit(medicine.purchasePrice, medicine.unitsPerPack),
      ])
    );

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let dailyProfit = 0;
    let monthlyProfit = 0;
    let yearlyProfit = 0;
    let customProfit = 0;
    let customSales = 0;

    bills.forEach((bill) => {
      let totalCost = 0;
      getBillReturnSummary(bill).netItems.forEach((item) => {
        const netQty = item.netQuantity;
        if (netQty === 0) return;
        const savedPurchasePrice = Number(item.purchasePrice);
        const purchasePrice =
          item.purchasePrice !== undefined &&
          item.purchasePrice !== null &&
          Number.isFinite(savedPurchasePrice)
            ? savedPurchasePrice
            : purchasePriceByMedicine.get(String(item.medicineId)) || 0;
        totalCost += purchasePrice * netQty;
      });

      const netTotal = Math.max(0, (bill.total || 0) - (bill.totalRefunded || 0));
      const profit = netTotal - totalCost;
      const billDate = new Date(bill.createdAt);

      if (billDate >= startOfDay) dailyProfit += profit;
      if (billDate >= startOfMonth) monthlyProfit += profit;
      if (billDate >= startOfYear) yearlyProfit += profit;

      if (startDate && endDate) {
        customProfit += profit;
        customSales += netTotal;
      }
    });

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
    if (req.user.role !== 'pharmacist' && req.user.role !== 'superadmin') {
      res.status(403);
      return next(new Error('Only pharmacists and superadmins can view profit details'));
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

    const bills = await Bill.find(matchStage).lean();
    const medicines = await Medicine.find().lean();
    const medMap = {};
    medicines.forEach((m) => {
      medMap[String(m._id)] = m;
    });

    // Aggregate by medicine
    const medicineProfitMap = {};

    bills.forEach((bill) => {
      // Calculate total discount ratio for the bill to apply proportionally
      const subtotal = bill.subtotal || bill.total;
      const discountRatio = (bill.discount > 0 && subtotal > 0) ? (bill.discount / subtotal) : 0;

      getBillReturnSummary(bill).netItems.forEach((item) => {
        const netQty = item.netQuantity;

        if (netQty === 0) return;

        const medObj = medMap[String(item.medicineId)];
        const itemPurchasePrice = item.purchasePrice ?? (
          medObj ? getPurchaseCostPerUnit(medObj.purchasePrice, medObj.unitsPerPack) : 0
        );
        const itemSalePrice =
          item.salePrice ?? item.unitPrice ?? (medObj ? medObj.price : 0);

        if (!medicineProfitMap[item.medicineId]) {
          medicineProfitMap[item.medicineId] = {
            medicineId: item.medicineId,
            name: item.name,
            purchasePrice: 0,
            salePrice: 0,
            remainingStock: medObj ? medObj.quantity : 0,
            quantitySold: 0,
            totalCost: 0,
            totalDiscount: 0,
            grossSales: 0,
            totalSales: 0,
            totalProfit: 0,
          };
        }

        const {
          cost,
          grossSales,
          discountAmount,
          netSales,
          profit,
        } = getNetItemAmounts({
          purchasePrice: itemPurchasePrice,
          salePrice: itemSalePrice,
          quantity: netQty,
          discountRatio,
        });

        medicineProfitMap[item.medicineId].quantitySold += netQty;
        medicineProfitMap[item.medicineId].totalCost += cost;
        medicineProfitMap[item.medicineId].totalDiscount += discountAmount;
        medicineProfitMap[item.medicineId].grossSales += grossSales;
        medicineProfitMap[item.medicineId].totalSales += netSales;
        medicineProfitMap[item.medicineId].totalProfit += profit;
      });
    });

    Object.values(medicineProfitMap).forEach((item) => {
      if (item.quantitySold > 0) {
        item.purchasePrice = item.totalCost / item.quantitySold;
        item.salePrice = item.grossSales / item.quantitySold;
      }
      delete item.grossSales;
    });

    const profitDetails = Object.values(medicineProfitMap).sort((a, b) => b.totalProfit - a.totalProfit);

    res.json({
      success: true,
      profitDetails,
    });
  } catch (error) {
    next(error);
  }
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
        if (bill.orderStatus === 'REJECTED') {
          const error = new Error('Cannot process return on a rejected order');
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
          const updatedMedicine = await Medicine.findOneAndUpdate(
            { _id: medicineId },
            { $inc: { quantity: qtyToReturn } },
            { new: true, session }
          );
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
      .limit(200)
      .populate('processed_by', 'name email')
      .populate('item_id', 'name')
      .populate('sale_id', 'billNumber customerName customerPhone')
      .lean();
    res.json({ success: true, returns });
  } catch (error) { next(error); }
};

// @desc    Get most-sold and least-sold medicines ranking
// @route   GET /api/bills/medicine-sales-ranking
// @access  Private/Pharmacist/Superadmin
export const getMedicineSalesRanking = async (req, res, next) => {
  try {
    const acceptedBills = await Bill.find({
      orderStatus: { $nin: ['PENDING', 'REJECTED'] },
    }).select('items').lean();

    // Aggregate units sold per medicine across all accepted bills
    const salesMap = new Map();
    for (const bill of acceptedBills) {
      if (!Array.isArray(bill.items)) continue;
      for (const item of bill.items) {
        const id = String(item.medicine || item.medicineId || '');
        if (!id) continue;
        const qty = Number(item.quantity) || 0;
        const revenue = Number(item.price || 0) * qty;
        if (salesMap.has(id)) {
          const entry = salesMap.get(id);
          entry.totalUnits += qty;
          entry.totalRevenue += revenue;
        } else {
          salesMap.set(id, {
            medicineId: id,
            name: String(item.name || item.medicineName || ''),
            manufacturer: String(item.manufacturer || ''),
            totalUnits: qty,
            totalRevenue: revenue,
          });
        }
      }
    }

    const allMedicines = Array.from(salesMap.values()).filter((m) => m.totalUnits > 0);
    const topSelling = [...allMedicines].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 20);
    const leastSelling = [...allMedicines].sort((a, b) => a.totalUnits - b.totalUnits).slice(0, 20);

    res.json({ success: true, topSelling, leastSelling, totalMedicinesWithSales: allMedicines.length });
  } catch (error) {
    next(error);
  }
};

