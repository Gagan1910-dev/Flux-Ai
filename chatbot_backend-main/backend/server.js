import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
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
import EmbeddingService from './services/embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Ensure uploads folder exists (for temporary multer storage)
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configurable CORS Allowlist
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests, verified origins, or netlify/render production domains
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production' ||
      /\.netlify\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Cross-Origin Request blocked by security policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Bounded Request Body Parsers (Prevents buffer exhaustion attacks)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

// Centralized Error Handling Middleware (Sanitizes errors; prevents stack trace leaks)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  const status = err.status || err.statusCode || 500;
  const clientMessage = status === 500
    ? 'An unexpected error occurred. Please try again later.'
    : (err.message || 'Request failed');

  res.status(status).json({ error: clientMessage });
});

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
const isMainModule = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].includes('server.js'));

if (isMainModule && !mongoUri && process.env.NODE_ENV !== 'test') {
  console.error('❌ MONGODB_URI not set. Please set MONGODB_URI in your .env with the Atlas connection string.');
  process.exit(1);
}

if (isMainModule && process.env.NODE_ENV !== 'test' && mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('✅ MongoDB connected (Atlas)');
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🔒 Security Hardening & Document Access Control: ACTIVE`);
        EmbeddingService.getInstance().catch((err) => console.warn('⚠️ Embedding pre-warm warning:', err.message));
      });
    })
    .catch((error) => {
      console.error('❌ MongoDB Atlas connection error:', error.message || error);
      process.exit(1);
    });
}

export default app;
