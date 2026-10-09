import express from 'express';
import { createPurchaseOrder, getLowStockMedicines, getPurchaseOrders, updatePurchaseOrderStatus } from '../controllers/purchaseOrderController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('superadmin', 'pharmacist'));
router.get('/low-stock', getLowStockMedicines);
router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.patch('/:id/status', updatePurchaseOrderStatus);
export default router;
