import express from 'express';
import { createBackupController, downloadLatestBackup, getBackupStatusController, restoreBackupController, verifyBackupController } from '../controllers/backupController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('superadmin'));
router.get('/status', getBackupStatusController);
router.get('/latest', downloadLatestBackup);
router.post('/create', createBackupController);
router.post('/restore', restoreBackupController);
router.post('/verify', verifyBackupController);

export default router;
