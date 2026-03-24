import AuditLog from '../models/AuditLog.js';

// ─────────────────────────────────────────────────────────────
// GET AUDIT LOGS — admin only, paginated
// ─────────────────────────────────────────────────────────────
export const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find()
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name username email role')
                .lean(),
            AuditLog.countDocuments(),
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Audit log fetch error:', error);
        res.status(500).json({ error: error.message });
    }
};
