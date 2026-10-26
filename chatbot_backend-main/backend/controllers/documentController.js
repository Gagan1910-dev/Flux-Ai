import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Document from "../models/Document.js";
import DocumentChunk from "../models/DocumentChunk.js";
import { processDocument, processDocumentFromBuffer } from '../services/documentService.js';
import { getAllowedAccessLevels } from "../middleware/auth.js";

import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ☁️ Initialize Cloud Storage Logic
let useCloudinary = false;
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)) {
  useCloudinary = true;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const storage = useCloudinary ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // Some browsers report docx as octet-stream
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Only PDF and DOCX files are permitted'));
    }

    if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file MIME type'));
    }

    cb(null, true);
  },
});

// Magic byte validation helper
const validateFileSignature = (buffer, ext) => {
  if (!buffer || buffer.length < 4) return false;

  if (ext === '.pdf') {
    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  if (ext === '.docx') {
    // DOCX (ZIP container) magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  return false;
};

// ─────────────────────────────────────────────────────────────
// UPLOAD DOCUMENT (Admin only)
// ─────────────────────────────────────────────────────────────
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file was provided for upload" });
    }

    const { title, accessLevel } = req.body;
    const validLevels = ['public', 'employee', 'manager'];
    const docAccessLevel = validLevels.includes(accessLevel) ? accessLevel : 'employee';

    const safeTitle = (typeof title === 'string' && title.trim().length > 0)
      ? title.trim().substring(0, 200)
      : path.basename(req.file.originalname, path.extname(req.file.originalname));

    const fileExt = path.extname(req.file.originalname).toLowerCase();

    // Verify magic bytes from buffer
    const fileBuffer = useCloudinary
      ? req.file.buffer
      : fs.readFileSync(req.file.path);

    if (!validateFileSignature(fileBuffer, fileExt)) {
      // Clean up local file if created
      if (!useCloudinary && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(400).json({ error: 'File content does not match the expected PDF/DOCX format' });
    }

    let finalFilePath = "";
    let finalFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (useCloudinary) {
      finalFilePath = await new Promise((resolve, reject) => {
        const cld_upload_stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            public_id: `documents/${Date.now()}-${finalFileName}`,
            format: fileExt.slice(1),
          },
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
      });
    } else {
      finalFilePath = req.file.path;
      finalFileName = req.file.filename;
    }

    const document = await Document.create({
      title: safeTitle,
      filename: finalFileName,
      originalName: req.file.originalname.substring(0, 255),
      filePath: finalFilePath,
      fileType: fileExt.slice(1),
      fileSize: req.file.size,
      accessLevel: docAccessLevel,
      uploadedBy: req.user.userId,
      status: 'uploaded',
    });

    // Ingest asynchronously in background
    processDocumentFromBuffer(document._id, fileBuffer, document.fileType).catch((err) => {
      console.error(`Background ingestion failure for ${document._id}:`, err.message);
    });

    res.status(201).json({
      message: 'Document uploaded successfully and ingestion initiated',
      document: {
        id: document._id,
        title: document.title,
        name: document.originalName,
        accessLevel: document.accessLevel,
        status: 'processing',
      },
    });
  } catch (err) {
    console.error("Document upload error:", err.message);
    res.status(500).json({ error: err.message || "Failed to upload document" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET DOCUMENT LIST (Role-filtered)
// ─────────────────────────────────────────────────────────────
export const getDocuments = async (req, res) => {
  try {
    const userRole = req.user?.role || 'guest';
    const allowedLevels = getAllowedAccessLevels(userRole);
    const filter = allowedLevels ? { accessLevel: { $in: allowedLevels } } : {};

    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .select('-filePath') // Never expose internal filesystem paths
      .lean();

    res.json(docs);
  } catch (error) {
    console.error("Fetch documents error:", error.message);
    res.status(500).json({ error: "Failed to fetch document catalog" });
  }
};

// ─────────────────────────────────────────────────────────────
// PROTECTED FILE DOWNLOAD
// ─────────────────────────────────────────────────────────────
export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const userRole = req.user?.role || 'guest';
    const allowedLevels = getAllowedAccessLevels(userRole);

    if (allowedLevels !== null && !allowedLevels.includes(doc.accessLevel)) {
      return res.status(403).json({ error: "Access denied to this document" });
    }

    const filePath = doc.filePath;

    if (filePath.startsWith('http')) {
      let fetchUrl = filePath;
      if (fetchUrl.includes('cloudinary.com')) {
        const uploadMatch = fetchUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
        if (uploadMatch) {
          const publicId = uploadMatch[1];
          const ext = path.extname(publicId).slice(1) || doc.fileType;
          fetchUrl = cloudinary.utils.private_download_url(publicId, ext, { resource_type: 'auto' });
        }
      }

      const axios = (await import('axios')).default;
      const response = await axios({
        url: fetchUrl,
        method: 'GET',
        responseType: 'stream'
      });
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
      res.setHeader('Content-Type', doc.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      response.data.pipe(res);
      return;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document source file not found on storage" });
    }

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Content-Type', doc.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("Document download error:", err.message);
    res.status(500).json({ error: "Failed to download document" });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE DOCUMENT ACCESS LEVEL (Admin only)
// ─────────────────────────────────────────────────────────────
export const updateDocumentAccess = async (req, res) => {
  try {
    const { accessLevel } = req.body;
    const validLevels = ['public', 'employee', 'manager'];
    if (!validLevels.includes(accessLevel)) {
      return res.status(400).json({ error: `accessLevel must be one of: ${validLevels.join(', ')}` });
    }

    const doc = await Document.findByIdAndUpdate(req.params.id, { accessLevel }, { new: true });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    res.json({ message: "Access level updated", document: { id: doc._id, title: doc.title, accessLevel: doc.accessLevel } });
  } catch (err) {
    console.error("Update access error:", err.message);
    res.status(500).json({ error: "Failed to update access level" });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE DOCUMENT (Admin only) — Cascading Delete of Chunks
// ─────────────────────────────────────────────────────────────
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // 1. Remove local file if present
    if (!doc.filePath.startsWith('http') && fs.existsSync(doc.filePath)) {
      try { fs.unlinkSync(doc.filePath); } catch (_) {}
    }

    // 2. Cascade delete all chunks associated with this document
    await DocumentChunk.deleteMany({ documentId: req.params.id });

    // 3. Delete parent document record
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Document and all associated chunks deleted successfully" });
  } catch (err) {
    console.error("Delete document error:", err.message);
    res.status(500).json({ error: "Failed to delete document" });
  }
};

// ─────────────────────────────────────────────────────────────
// TRIGGER INGESTION (Admin only)
// ─────────────────────────────────────────────────────────────
export const triggerIngestion = async (req, res) => {
  try {
    const documentId = req.params.id;
    processDocument(documentId).catch((err) => {
      console.error(`Triggered processing failed for ${documentId}:`, err.message);
    });

    res.json({ message: "Ingestion processing started", documentId });
  } catch (err) {
    console.error("Trigger ingestion error:", err.message);
    res.status(500).json({ error: "Failed to trigger ingestion" });
  }
};
