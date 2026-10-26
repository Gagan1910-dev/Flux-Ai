import express from 'express';
import {
  register,
  login,
  getMe,
  listUsers,
  updateUserRole,
  createGuestSession,
} from '../controllers/authController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/guest-session', authLimiter, createGuestSession);

// Authenticated routes
router.get('/me', authenticate, getMe);

// Admin-only routes
router.get('/users', authenticate, requireAdmin, listUsers);
router.patch('/users/:id/role', authenticate, requireAdmin, updateUserRole);

export default router;
