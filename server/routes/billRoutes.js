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
  getProfitSummary,
  getProfitDetails,
  processSalesReturn,
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
router.get('/lookup-customer', lookupCustomerByPhone);

// Sales summary
router.get(
  '/sales-summary',
  authorize('superadmin', 'pharmacist'),
  getSalesSummary
);

// Profit summary  ← must be BEFORE /:id
router.get(
  '/profit-summary',
  authorize('superadmin', 'pharmacist'),
  getProfitSummary
);

// Profit details  ← must be BEFORE /:id
router.get(
  '/profit-details',
  authorize('superadmin', 'pharmacist'),
  getProfitDetails
);

// Get online customer orders
router.get(
  '/online-orders',
  authorize('superadmin', 'pharmacist'),
  getOnlineOrders
);

// Get customer's billing history
router.get('/customer/:customerId', getCustomerBills);

// Get all bills
router.get(
  '/',
  authorize('superadmin', 'pharmacist'),
  getAllBills
);

// Create in-store bill
router.post(
  '/instore',
  authorize('superadmin', 'pharmacist'),
  createInstoreBill
);

// Customer online order / normal bill
router.post('/', createBill);

// Sales Return & Refund  ← BEFORE /:id
router.post(
  '/:id/return',
  authorize('superadmin', 'pharmacist'),
  processSalesReturn
);

// Accept online customer order
router.put(
  '/online-orders/:id/accept',
  authorize('superadmin', 'pharmacist'),
  acceptOnlineOrder
);

// Reject online customer order
router.put(
  '/online-orders/:id/reject',
  authorize('superadmin', 'pharmacist'),
  rejectOnlineOrder
);

// Get single bill  ← LAST among GET /:id routes
router.get('/:id', getBillById);

// Download PDF
router.get('/:id/pdf', generateBillPDF);

export default router;
