import express from 'express';

import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getCustomers,
  getPendingCustomers,
  updateProfileNameOrPhone,
  approvePharmacist,
  rejectPharmacist,
  approveCustomer,
  rejectCustomer,
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

router.get(
  '/pending-customers',
  authorize('superadmin', 'pharmacist'),
  getPendingCustomers
);

// Any logged-in user can update their name/phone
router.patch(
  '/profile',
  updateProfileNameOrPhone
);

router.put(
  '/:id/approve-customer',
  authorize('superadmin', 'pharmacist'),
  approveCustomer
);

router.put(
  '/:id/reject-customer',
  authorize('superadmin', 'pharmacist'),
  rejectCustomer
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