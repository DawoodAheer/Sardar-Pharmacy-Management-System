import express from 'express';
import {
  getAllMedicines,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  bulkImportMedicines,
  processBill,
  scanLabel,
  adjustStock,
  getStockAdjustments,
  getDeletedMedicines,
  restoreMedicine,
  getMedicineImportIssues,
  resolveMedicineImportIssue,
  getMedicineAuditHistory,
} from '../controllers/medicineController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Billing check - accessible by any authenticated role
router.post('/bill', authorize('pharmacist', 'superadmin'), processBill);

// OCR Label scanning - restricted to pharmacist or superadmin
router.post(
  '/scan-label',
  authorize('pharmacist', 'superadmin'),
  upload.single('labelImage'),
  scanLabel
);

// Bulk import - restricted to pharmacist or superadmin
router.post('/bulk', authorize('pharmacist', 'superadmin'), bulkImportMedicines);
router.get('/import-issues', authorize('pharmacist', 'superadmin'), getMedicineImportIssues);
router.post('/import-issues/:id/resolve', authorize('pharmacist', 'superadmin'), resolveMedicineImportIssue);
router.get('/audit-history', authorize('pharmacist', 'superadmin'), getMedicineAuditHistory);

// Stock adjustments
router.get('/stock-adjustments', authorize('pharmacist', 'superadmin'), getStockAdjustments);
router.get('/deleted', authorize('superadmin'), getDeletedMedicines);
router.patch('/:id/restore', authorize('superadmin'), restoreMedicine);
router.post('/:id/adjust-stock', authorize('pharmacist', 'superadmin'), adjustStock);

// standard CRUD
router
  .route('/')
  .get(getAllMedicines)
  .post(authorize('pharmacist', 'superadmin'), createMedicine);

router
  .route('/:id')
  .put(authorize('pharmacist', 'superadmin'), updateMedicine)
  .delete(authorize('superadmin'), deleteMedicine);

export default router;
