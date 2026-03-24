import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
    trim: true,
  },
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
    enum: ['pdf', 'docx'],
  },
  fileSize: {
    type: Number,
    required: true,
  },
  accessLevel: {
    type: String,
    enum: ['public', 'employee', 'manager'],
    default: 'employee',
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['uploaded', 'pending', 'processing', 'completed', 'failed'],
    default: 'uploaded',
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Document', documentSchema);




