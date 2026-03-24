import express from 'express';
import {
  upload,
  uploadDocument,
  getDocuments,
  deleteDocument,
  triggerIngestion,
  downloadDocument,
  updateDocumentAccess,
} from '../controllers/documentController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin-only: upload, delete, ingest, update access
router.post('/upload', authenticate, requireAdmin, upload.single('file'), uploadDocument);
router.delete('/:id', authenticate, requireAdmin, deleteDocument);
router.post('/:id/ingest', authenticate, requireAdmin, triggerIngestion);
router.patch('/:id/access', authenticate, requireAdmin, updateDocumentAccess);

// Authenticated: list (role-filtered) and download (role-validated)
router.get('/list', authenticate, getDocuments);
router.get('/:id/download', authenticate, downloadDocument);

export default router;
