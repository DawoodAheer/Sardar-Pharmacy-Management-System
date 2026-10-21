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
import { createAuthLimits, validateAuthFields } from '../middleware/authSecurity.js';

const router = express.Router();
const limits = createAuthLimits();
router.use((req, res, next) => {
  if (req.method === 'POST' && req.path !== '/refresh' && req.path !== '/logout') return limits.public(req, res, next);
  next();
});
router.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') return validateAuthFields(req, res, next);
  next();
});

router.post('/register', registerUser);

router.post('/register-pharmacist', registerPharmacist);

router.post('/login', limits.login, loginUser);

router.post('/logout', logoutUser);

router.post('/forgot-password', limits.reset, forgotPassword);

router.post('/reset-password/:token', limits.reset, resetPassword);

router.post('/reset-password', limits.reset, resetPassword);

router.post('/refresh', refreshAccessToken);

router.get('/me', protect, getMe);

router.put('/profile', protect, updateUserProfile);

export default router;
