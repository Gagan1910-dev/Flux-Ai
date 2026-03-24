import express from 'express';
import {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from '../controllers/faqController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getFAQs);
router.post('/', authenticate, requireAdmin, createFAQ);
router.put('/:id', authenticate, requireAdmin, updateFAQ);
router.delete('/:id', authenticate, requireAdmin, deleteFAQ);

export default router;



