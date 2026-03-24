import express from 'express';
import { register, login, getMe, listUsers, updateUserRole } from '../controllers/authController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);    // Auto-assigns role by email domain
router.post('/login', login);

// Authenticated routes
router.get('/me', authenticate, getMe);

// Admin-only routes
router.get('/users', authenticate, requireAdmin, listUsers);
router.patch('/users/:id/role', authenticate, requireAdmin, updateUserRole);

export default router;
