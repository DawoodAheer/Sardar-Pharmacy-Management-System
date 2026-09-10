import express from 'express';

import {
  registerUser,
  registerPharmacist,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getMe,
  updateUserProfile,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);

router.post('/register-pharmacist', registerPharmacist);

router.post('/login', loginUser);

router.post('/logout', logoutUser);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.post('/reset-password', resetPassword);

router.post('/refresh', refreshAccessToken);

router.get('/me', protect, getMe);

router.put('/profile', protect, updateUserProfile);

export default router;