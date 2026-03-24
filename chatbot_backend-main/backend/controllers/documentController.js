import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Document from "../models/Document.js";
import { processDocument } from "../services/documentService.js";
import { getAllowedAccessLevels } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage for PDFs/DOCX
const storage = multer.diskStorage({
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
// UPLOAD DOCUMENT (admin only)
// ─────────────────────────────────────────────────────────────
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { title, accessLevel } = req.body;

    // Validate accessLevel
    const validLevels = ['public', 'employee', 'manager'];
    const docAccessLevel = validLevels.includes(accessLevel) ? accessLevel : 'employee';

    const document = await Document.create({
      title: title || req.file.originalname,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: path.extname(req.file.originalname).slice(1).toLowerCase(),
      fileSize: req.file.size,
      accessLevel: docAccessLevel,
      uploadedBy: req.user.userId,
      status: "uploaded",
    });

    res.json({
      message: "Document uploaded successfully",
      document: {
        id: document._id,
        title: document.title,
        name: document.originalName,
        accessLevel: document.accessLevel,
        status: "uploaded",
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
      .select('-filePath') // Never expose raw file path
      .lean();

    res.json(docs);
  } catch {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

// ─────────────────────────────────────────────────────────────
// PROTECTED FILE DOWNLOAD
// Validates user's access level against document's accessLevel
// NEVER exposes the raw file system path
// ─────────────────────────────────────────────────────────────
export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const userRole = req.user?.role || 'guest';
    const allowedLevels = getAllowedAccessLevels(userRole);

    // Admin bypasses check (allowedLevels === null)
    if (allowedLevels !== null && !allowedLevels.includes(doc.accessLevel)) {
      return res.status(403).json({
        error: "Access denied: you are not authorized to access this document"
      });
    }

    const filePath = doc.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.setHeader('Content-Type',
      doc.fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

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

    if (!validLevels.includes(accessLevel)) {
      return res.status(400).json({ error: `accessLevel must be one of: ${validLevels.join(', ')}` });
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { accessLevel },
      { new: true }
    );

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

    // Delete the physical file
    if (fs.existsSync(doc.filePath)) {
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
