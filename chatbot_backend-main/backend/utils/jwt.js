import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return secret;
};

export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, isGuest: false },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const generateGuestToken = (guestId) => {
  return jwt.sign(
    { guestId, role: 'guest', isGuest: true },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
};
