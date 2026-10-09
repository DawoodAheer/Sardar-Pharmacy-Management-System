import express from 'express';
import {
  getScannerUrl,
  getScanResult,
  submitScan,
  scanMobileLabel,
  getSessionStatus,
} from '../controllers/mobileScannerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/url', protect, authorize('pharmacist', 'superadmin'), getScannerUrl);
router.get('/results/:sessionId', getScanResult);
router.post('/scan', submitScan);
router.post('/ocr', scanMobileLabel);
router.get('/status/:sessionId', getSessionStatus);

export default router;
