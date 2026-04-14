import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Document from "../models/Document.js";
import { processDocument, processDocumentFromBuffer } from '../services/documentService.js';
import { getAllowedAccessLevels } from "../middleware/auth.js";

import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ☁️ Initialize Cloud Storage Logic (Zero Cost Architecture)
let useCloudinary = false;
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)) {
  useCloudinary = true;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log("☁️ Cloudinary is configured. Documents will be uploaded to cloud storage.");
} else {
  console.log("⚙️ No Cloudinary keys detected. Defaulting to local disk storage (Not ideal for serverless).");
}

// Dynamically scale between Memory Buffer (Serverless) and Disk Storage (Local VM)
const storage = useCloudinary ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

// ─────────────────────────────────────────────────────────────
// UPLOAD DOCUMENT (admin only - optimized for hybrid deployment)
// ─────────────────────────────────────────────────────────────
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { title, accessLevel } = req.body;
    const validLevels = ['public', 'employee', 'manager'];
    const docAccessLevel = validLevels.includes(accessLevel) ? accessLevel : 'employee';

    let finalFilePath = "";
    let finalFileName = req.file.originalname;

    if (useCloudinary) {
      // ☁️ Upload stream natively to Cloudinary (Requires zero disk write)
      finalFilePath = await new Promise((resolve, reject) => {
        const cld_upload_stream = cloudinary.uploader.upload_stream(
          { resource_type: "auto", public_id: `documents/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`, format: path.extname(req.file.originalname).slice(1).toLowerCase() },
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
      });
      finalFileName = req.file.originalname;
    } else {
      // 📁 Local upload saving
      finalFilePath = req.file.path;
      finalFileName = req.file.filename;
    }

    const document = await Document.create({
      title: title || req.file.originalname,
      filename: finalFileName,
      originalName: req.file.originalname,
      filePath: finalFilePath,
      fileType: path.extname(req.file.originalname).slice(1).toLowerCase(),
      fileSize: req.file.size,
      accessLevel: docAccessLevel,
      uploadedBy: req.user.userId,
      status: 'uploaded',
    });

    // ✅ Process immediately from in-memory buffer — no Cloudinary CDN download needed
    const fileBuffer = useCloudinary
      ? req.file.buffer                            // multer memoryStorage buffer
      : fs.readFileSync(req.file.path);            // local disk fallback
    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();

    // Run in background so upload response is instant
    processDocumentFromBuffer(document._id, fileBuffer, fileType).catch((err) =>
      console.error(`❌ Background processing error for ${document._id}:`, err)
    );

    res.json({
      message: 'Document uploaded successfully (processing started)',
      document: {
        id: document._id,
        title: document.title,
        name: document.originalName,
        accessLevel: document.accessLevel,
        status: 'processing',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET DOCUMENT LIST
// Admin: sees all | Others: filtered by their access level
// ─────────────────────────────────────────────────────────────
export const getDocuments = async (req, res) => {
  try {
    const userRole = req.user?.role || 'guest';
    const allowedLevels = getAllowedAccessLevels(userRole);
    const filter = allowedLevels ? { accessLevel: { $in: allowedLevels } } : {};
    
    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .select('-filePath') // Never expose raw file path to frontend
      .lean();

    res.json(docs);
  } catch {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

// ─────────────────────────────────────────────────────────────
// PROTECTED FILE DOWNLOAD
// Scaled securely for serverless/network storage
// ─────────────────────────────────────────────────────────────
export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const userRole = req.user?.role || 'guest';
    const allowedLevels = getAllowedAccessLevels(userRole);

    if (allowedLevels !== null && !allowedLevels.includes(doc.accessLevel)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const filePath = doc.filePath;

    // Check if cloud URL
    if (filePath.startsWith('http')) {
      let fetchUrl = filePath;
      // If Cloudinary URL, generate a signed private download URL
      if (fetchUrl.includes('cloudinary.com')) {
        const uploadMatch = fetchUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
        if (uploadMatch) {
          const publicId = uploadMatch[1];
          const ext = path.extname(publicId).slice(1) || doc.fileType;
          // Use private_download_url for secure access
          fetchUrl = cloudinary.utils.private_download_url(publicId, ext, { resource_type: 'auto' });
        }
      }

      const axios = (await import('axios')).default;
      const response = await axios({
        url: fetchUrl,
        method: 'GET',
        responseType: 'stream'
      });
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
      res.setHeader('Content-Type', doc.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      response.data.pipe(res);
      return;
    }

    // Otherwise Local File Check
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.setHeader('Content-Type', doc.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE DOCUMENT ACCESS LEVEL (admin only)
// ─────────────────────────────────────────────────────────────
export const updateDocumentAccess = async (req, res) => {
  try {
    const { accessLevel } = req.body;
    const validLevels = ['public', 'employee', 'manager'];
    if (!validLevels.includes(accessLevel)) return res.status(400).json({ error: `accessLevel must be one of: ${validLevels.join(', ')}` });

    const doc = await Document.findByIdAndUpdate(req.params.id, { accessLevel }, { new: true });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json({ message: "Access level updated", document: { id: doc._id, title: doc.title, accessLevel: doc.accessLevel } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE DOCUMENT (admin only)
// ─────────────────────────────────────────────────────────────
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (!doc.filePath.startsWith('http') && fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// TRIGGER INGESTION (admin only)
// ─────────────────────────────────────────────────────────────
export const triggerIngestion = async (req, res) => {
  try {
    const documentId = req.params.id;

    processDocument(documentId).catch((err) =>
      console.error(`Background processing error for ${documentId}:`, err)
    );

    res.json({
      message: "Processing started successfully",
      documentId: documentId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger processing" });
  }
};
