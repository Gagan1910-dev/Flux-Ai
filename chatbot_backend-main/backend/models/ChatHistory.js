import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Changed from true to false
    index: true,
  },
  guestId: {
    type: String,
    index: true,
    required: false
  },
  title: {
    type: String,
    default: "New Chat"
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  messages: [
    {
      role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  sessionId: {
    type: String,
    required: true,
    // unique: true // Consider making this unique per user/guest combo if needed
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for fetching history: works for User OR Guest
chatHistorySchema.index({ userId: 1, guestId: 1, updatedAt: -1 });

export default mongoose.model('ChatHistory', chatHistorySchema);



