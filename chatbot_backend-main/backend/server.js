import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables FIRST
dotenv.config();

// Import routes
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists (for multer)
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log("📁 Uploads folder created automatically");
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ⛔ NOTE: Public static file serving is intentionally REMOVED.
//    Files are served only via the authenticated /api/documents/:id/download endpoint.
//    This prevents unauthorized direct URL access to uploaded files.

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Connect to MongoDB
// Connect to MongoDB Atlas ONLY. Remove local fallback to ensure deployment uses Atlas.
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI not set. Please set MONGODB_URI in your .env with the Atlas connection string.');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected (Atlas)');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔒 Secure document access control: ACTIVE`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB Atlas connection error:', error.message || error);
    console.error('Hints:');
    console.error('- Ensure your Atlas Network Access whitelist includes your current IP or 0.0.0.0/0 for testing.');
    console.error('- Verify the DB user and password (reset password in Atlas if unsure).');
    console.error('- If your password contains special characters, URL-encode it before placing it in the URI.');
    console.error('- If SRV DNS lookups fail, copy the "Standard connection string" (non-+srv) from Atlas and use that instead.');
    process.exit(1);
  });

export default app;
