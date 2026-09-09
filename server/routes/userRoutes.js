import express from 'express';

import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getCustomers,
  updateProfileNameOrPhone,
  approvePharmacist,
  rejectPharmacist,
} from '../controllers/userController.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Authentication middleware is required for all routes
router.use(protect);

// Pharmacists and Superadmins can list customers
router.get(
  '/customers',
  authorize('superadmin', 'pharmacist'),
  getCustomers
);

// Any logged-in user can update their name/phone
router.patch(
  '/profile',
  updateProfileNameOrPhone
);

// All routes below this point are Superadmin only
router.use(authorize('superadmin'));

// Get all users
router.get(
  '/',
  getAllUsers
);

// Update user role
router.put(
  '/:id/role',
  updateUserRole
);

// Approve pharmacist
router.put(
  '/:id/approve-pharmacist',
  approvePharmacist
);

// Reject pharmacist
router.put(
  '/:id/reject-pharmacist',
  rejectPharmacist
);

// Delete user
router.delete(
  '/:id',
  deleteUser
);

export default router;