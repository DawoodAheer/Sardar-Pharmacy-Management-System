import express from 'express';
import {
  createUdhar,
  getAllUdhar,
  getUdharById,
  addItemToUdhar,
  removeItemFromUdhar,
  recordPayment,
  updateUdhar,
  deleteUdhar,
  getUdharSummary,
  getUdharPaymentActivity,
} from '../controllers/udharController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication + pharmacist or superadmin
router.use(protect);
router.use(authorize('pharmacist', 'superadmin'));

// Summary stats
router.get('/summary', getUdharSummary);
router.get('/payment-activity', authorize('superadmin'), getUdharPaymentActivity);

// Main CRUD
router.route('/')
  .get(getAllUdhar)
  .post(createUdhar);

router.route('/:id')
  .get(getUdharById)
  .put(updateUdhar);
router.delete('/:id', authorize('superadmin'), deleteUdhar);

// Item management
router.post('/:id/add-item', addItemToUdhar);
router.delete('/:id/item/:itemId', authorize('superadmin'), removeItemFromUdhar);

// Payment recording
router.post('/:id/pay', recordPayment);

export default router;
