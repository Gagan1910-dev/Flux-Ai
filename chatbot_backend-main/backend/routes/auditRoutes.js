import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin-only: view audit logs
router.get('/', authenticate, requireAdmin, getAuditLogs);

export default router;
