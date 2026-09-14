import Bill from '../models/Bill.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import { checkExpiryStatus } from '../utils/expiryCheck.js';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';

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
    paymentMethod,
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

      subtotal += medicine.price * requestedQuantity;

      validatedItems.push({
        medicineId: medicine._id,
        name: medicine.name,
        quantity: requestedQuantity,
        unitPrice: medicine.price,
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

    const finalDiscount = Number(discount) || 0;
    const total = Math.max(
      0,
      subtotal - finalDiscount
    );

    const bill = await Bill.create({
      pharmacistId: finalPharmacistId,
      customerId: finalCustomerId,

      customerPhone:
        customerPhone || customer.phone || null,

      shippingAddress: shippingAddress || '',

      billType: 'ONLINE',

      orderStatus: isCustomerOrder
        ? 'PENDING'
        : 'ACCEPTED',

      reviewedBy: isCustomerOrder
        ? null
        : finalPharmacistId,

      reviewedAt: isCustomerOrder
        ? null
        : new Date(),

      items: validatedItems.map((item) => ({
        medicineId: item.medicineId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        expiryStatus: item.expiryStatus,
        expiryDate: item.expiryDate,
        rackLocation: item.rackLocation,
      })),

      subtotal,
      discount: finalDiscount,
      total,

      paymentMethod:
        paymentMethod || 'Cash',
    });

    /*
     * Customer online orders remain PENDING.
     * Stock is NOT deducted here.
     *
     * Pharmacist-created online bills are accepted
     * immediately and stock is deducted here.
     */
    if (!isCustomerOrder) {
      for (const item of validatedItems) {
        item.ref.quantity -= item.quantity;
        await item.ref.save();
      }
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

    res.json(bills);
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
        'SARDAR MEDICAL STORE',
        50,
        45,
        {
          align: 'left',
        }
      )
      .fillColor('#64748b')
      .fontSize(10)
      .text(
        'Intelligent Pharmacy & Batch Portal',
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

    const customerName = bill.customerId
      ? bill.customerId.name
      : 'Guest Customer';

    const customerEmail = bill.customerId
      ? bill.customerId.email
      : 'N/A';

    const customerPhone = bill.customerId
      ? (
          bill.customerId.phone ||
          bill.customerPhone ||
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
        'Quantity',
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

    bill.items.forEach((item) => {
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
          `PKR ${item.unitPrice.toFixed(
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
          item.quantity.toString(),
          420,
          y,
          {
            align: 'right',
            width: 50,
          }
        )
        .text(
          `PKR ${(
            item.unitPrice *
            item.quantity
          ).toFixed(2)}`,
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
        `PKR ${bill.subtotal.toFixed(
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
        `-PKR ${bill.discount.toFixed(
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
        'Grand Total:',
        340,
        subtotalY + 45,
        {
          bold: true,
          align: 'right',
          width: 130,
        }
      )
      .text(
        `PKR ${bill.total.toFixed(
          2
        )}`,
        480,
        subtotalY + 45,
        {
          bold: true,
          align: 'right',
          width: 70,
        }
      );

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

    res.json(bills);
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

    const validatedMedicines = [];

    for (const item of bill.items) {
      const medicine = await Medicine.findById(
        item.medicineId
      );

      if (!medicine) {
        res.status(404);

        throw new Error(
          `Medicine not found: ${item.name}`
        );
      }

      const expiryStatus = checkExpiryStatus(
        medicine.expiryDate
      );

      if (expiryStatus === 'EXPIRED') {
        res.status(403);

        throw new Error(
          `${medicine.name} is expired and cannot be accepted`
        );
      }

      if (
        medicine.quantity < item.quantity
      ) {
        res.status(400);

        throw new Error(
          `${medicine.name} has insufficient stock. Requested: ${item.quantity}, Available: ${medicine.quantity}`
        );
      }

      validatedMedicines.push({
        medicine,
        quantity: item.quantity,
      });
    }

    const changedMedicines = [];

    try {
      for (const item of validatedMedicines) {
        const updatedMedicine =
          await Medicine.findOneAndUpdate(
            {
              _id: item.medicine._id,
              quantity: {
                $gte: item.quantity,
              },
            },
            {
              $inc: {
                quantity: -item.quantity,
              },
            },
            {
              new: true,
            }
          );

        if (!updatedMedicine) {
          throw new Error(
            `${item.medicine.name} no longer has enough stock. Please refresh and try again.`
          );
        }

        changedMedicines.push({
          medicineId:
            item.medicine._id,
          quantity:
            item.quantity,
        });
      }

      bill.orderStatus = 'ACCEPTED';
      bill.pharmacistId = req.user._id;
      bill.reviewedBy = req.user._id;
      bill.reviewedAt = new Date();
      bill.rejectionReason = '';

      await bill.save();
    } catch (error) {
      for (const changed of changedMedicines) {
        await Medicine.findByIdAndUpdate(
          changed.medicineId,
          {
            $inc: {
              quantity:
                changed.quantity,
            },
          }
        );
      }

      throw error;
    }

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

    res.json(bill);
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
    customerPhone,
    customerId,
    paymentMethod,
    discount,
    items,
  } = req.body;

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
    const expiredItems = [];
    const insufficientStockItems = [];
    const validatedItems = [];

    let subtotal = 0;

    for (const item of items) {
      const medicine =
        await Medicine.findById(
          item.medicineId
        );

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
        item.quantity
      ) {
        insufficientStockItems.push(
          `${medicine.name} (Requested: ${item.quantity}, Available: ${medicine.quantity})`
        );
      }

      subtotal +=
        medicine.price *
        item.quantity;

      validatedItems.push({
        medicineId: medicine._id,
        name: medicine.name,
        quantity: item.quantity,
        unitPrice: medicine.price,
        expiryStatus,
        expiryDate:
          medicine.expiryDate,
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
      Number(discount) || 0;

    const total = Math.max(
      0,
      subtotal - finalDiscount
    );

    const bill =
      await Bill.create({
        pharmacistId:
          req.user._id,

        customerId:
          customerId || null,

        customerPhone:
          customerId
            ? customerPhone || null
            : null,

        guestPhone:
          customerId
            ? null
            : customerPhone,

        billType: 'INSTORE',

        orderStatus:
          'ACCEPTED',

        reviewedBy:
          req.user._id,

        reviewedAt:
          new Date(),

        items:
          validatedItems.map(
            (item) => ({
              medicineId:
                item.medicineId,
              name:
                item.name,
              quantity:
                item.quantity,
              unitPrice:
                item.unitPrice,
              expiryStatus:
                item.expiryStatus,
              expiryDate:
                item.expiryDate,
              rackLocation:
                item.rackLocation,
            })
          ),

        subtotal,
        discount:
          finalDiscount,
        total,

        paymentMethod:
          paymentMethod ||
          'Cash',
      });

    for (const item of validatedItems) {
      item.ref.quantity -=
        item.quantity;

      await item.ref.save();
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

    const acceptedMatch = {
      orderStatus: {
        $nin: [
          'PENDING',
          'REJECTED',
        ],
      },
    };

    const todayResult =
      await Bill.aggregate([
        {
          $match: {
            ...acceptedMatch,
            createdAt: {
              $gte: startOfDay,
              $lt: startOfTomorrow,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: {
              $sum: '$total',
            },
            totalBills: {
              $sum: 1,
            },
          },
        },
      ]);

    const monthlyResult =
      await Bill.aggregate([
        {
          $match: {
            ...acceptedMatch,
            createdAt: {
              $gte: startOfMonth,
              $lt: startOfNextMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: {
              $sum: '$total',
            },
            totalBills: {
              $sum: 1,
            },
          },
        },
      ]);

    const todaySales =
      todayResult.length > 0
        ? todayResult[0].totalSales
        : 0;

    const todayBills =
      todayResult.length > 0
        ? todayResult[0].totalBills
        : 0;

    const monthlySales =
      monthlyResult.length > 0
        ? monthlyResult[0].totalSales
        : 0;

    const monthlyBills =
      monthlyResult.length > 0
        ? monthlyResult[0].totalBills
        : 0;

    res.json({
      success: true,

      today: {
        totalSales:
          todaySales,
        totalBills:
          todayBills,
      },

      month: {
        totalSales:
          monthlySales,
        totalBills:
          monthlyBills,
      },
    });
  } catch (error) {
    next(error);
  }
};