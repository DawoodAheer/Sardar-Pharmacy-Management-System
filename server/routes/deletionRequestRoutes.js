import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createDeletionRequest, listDeletionRequests, reviewDeletionRequest } from '../controllers/deletionRequestController.js';

const router = express.Router();
router.use(protect);
router.post('/:type/:id', authorize('pharmacist'), createDeletionRequest);
router.get('/', authorize('superadmin'), listDeletionRequests);
router.patch('/:id/review', authorize('superadmin'), reviewDeletionRequest);

export default router;
