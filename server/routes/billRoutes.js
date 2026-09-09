import express from 'express';

import {
  createBill,
  getCustomerBills,
  generateBillPDF,
  getAllBills,
  getBillById,
  lookupCustomerByPhone,
  createInstoreBill,
  getSalesSummary,
  getOnlineOrders,
  acceptOnlineOrder,
  rejectOnlineOrder,
} from '../controllers/billController.js';

import {
  protect,
  authorize,
} from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Lookup customer by phone
router.get(
  '/lookup-customer',
  lookupCustomerByPhone
);

// Sales summary
router.get(
  '/sales-summary',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  getSalesSummary
);

// Get online customer orders
router.get(
  '/online-orders',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  getOnlineOrders
);

// Accept online customer order
router.put(
  '/online-orders/:id/accept',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  acceptOnlineOrder
);

// Reject online customer order
router.put(
  '/online-orders/:id/reject',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  rejectOnlineOrder
);

// Create in-store bill
router.post(
  '/instore',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  createInstoreBill
);

// Customer online order / normal bill
router.post(
  '/',
  createBill
);

// Get all bills
router.get(
  '/',
  authorize(
    'superadmin',
    'pharmacist'
  ),
  getAllBills
);

// Get customer's billing history
router.get(
  '/customer/:customerId',
  getCustomerBills
);

// Get single bill
router.get(
  '/:id',
  getBillById
);

// Download PDF
router.get(
  '/:id/pdf',
  generateBillPDF
);

export default router;