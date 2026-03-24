import { verifyToken } from '../utils/jwt.js';

// ─────────────────────────────────────────────────────────────
// ROLE → ACCESS LEVEL MAPPING (hierarchical)
// ─────────────────────────────────────────────────────────────
export const getAllowedAccessLevels = (role) => {
  switch (role) {
    case 'admin': return null;                              // null = no filter (sees everything)
    case 'manager': return ['public', 'employee', 'manager'];
    case 'employee': return ['public', 'employee'];
    case 'public': return ['public'];
    case 'guest': return ['public'];
    default: return ['public'];
  }
};

// ─────────────────────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE — requires valid JWT
// ─────────────────────────────────────────────────────────────
export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ─────────────────────────────────────────────────────────────
// ADMIN GUARD — must be role=admin
// ─────────────────────────────────────────────────────────────
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// OPTIONAL AUTH — allows anonymous (guest) access
// ─────────────────────────────────────────────────────────────
export const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    // Fall back to guest if no valid token
    if (!req.user) {
      req.user = { userId: null, role: 'guest' };
    }

    next();
  } catch (error) {
    req.user = { userId: null, role: 'guest' };
    next();
  }
};
