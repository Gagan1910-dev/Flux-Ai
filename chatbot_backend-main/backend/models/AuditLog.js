import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    userRole: {
        type: String,
        default: 'guest',
    },
    query: {
        type: String,
        required: true,
    },
    documentIdsUsed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
    }],
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Index for fast admin queries
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
