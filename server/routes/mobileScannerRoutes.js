import express from 'express';
import {
  getScannerUrl,
  getScanResult,
  submitScan,
  getSessionStatus,
} from '../controllers/mobileScannerController.js';

const router = express.Router();

router.get('/url', getScannerUrl);
router.get('/results/:sessionId', getScanResult);
router.post('/scan', submitScan);
router.get('/status/:sessionId', getSessionStatus);

export default router;
