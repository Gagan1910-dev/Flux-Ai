import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    default: null,
  },
  metadata: {
    startChar: Number,
    endChar: Number,
    pageNumber: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Text index for search
documentChunkSchema.index({ content: 'text' });
documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

export default mongoose.model('DocumentChunk', documentChunkSchema);



