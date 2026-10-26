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
// AUTHENTICATION MIDDLEWARE — requires valid user JWT
// ─────────────────────────────────────────────────────────────
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.isGuest || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role || 'public',
      isGuest: false,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ─────────────────────────────────────────────────────────────
// ADMIN GUARD — must be authenticated user with role=admin
// ─────────────────────────────────────────────────────────────
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin' || req.user.isGuest) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// OPTIONAL AUTH — supports registered users, signed guests, or anonymous
// ─────────────────────────────────────────────────────────────
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          if (decoded.isGuest && decoded.guestId) {
            req.user = {
              userId: null,
              guestId: decoded.guestId,
              role: 'guest',
              isGuest: true,
            };
            return next();
          } else if (decoded.userId) {
            req.user = {
              userId: decoded.userId,
              guestId: null,
              role: decoded.role || 'public',
              isGuest: false,
            };
            return next();
          }
        }
      }
    }

    // Default fallback: unauthenticated visitor (no server-verified identity yet)
    req.user = { userId: null, guestId: null, role: 'guest', isGuest: true };
    next();
  } catch (error) {
    req.user = { userId: null, guestId: null, role: 'guest', isGuest: true };
    next();
  }
};
