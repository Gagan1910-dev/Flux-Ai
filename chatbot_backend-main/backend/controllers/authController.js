import crypto from 'crypto';
import User from '../models/User.js';
import { generateToken, generateGuestToken } from '../utils/jwt.js';

// ─────────────────────────────────────────────────────────────
// CREATE GUEST SESSION (Cryptographically signed guest token)
// ─────────────────────────────────────────────────────────────
export const createGuestSession = async (req, res) => {
  try {
    const guestId = `guest_${crypto.randomUUID()}`;
    const token = generateGuestToken(guestId);

    res.json({
      guestId,
      token,
      role: 'guest',
    });
  } catch (error) {
    console.error('Guest session creation error:', error);
    res.status(500).json({ error: 'Failed to create guest session' });
  }
};

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    // Strict scalar type validation (Prevents NoSQL injection objects)
    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({ error: 'Username, email, and password must be plain text strings' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = typeof name === 'string' ? name.trim() : cleanUsername;

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 254) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Username format validation
    if (cleanUsername.length < 3 || cleanUsername.length > 50 || !/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-50 alphanumeric characters (._- allowed)' });
    }

    // Password policy
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
    }

    // Check if user already exists (strictly sanitized query)
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Least Privilege Principle: Self-registration strictly receives 'public' role.
    // Privileged roles (employee, manager, admin) must be explicitly granted by an admin.
    const user = new User({
      name: cleanName || cleanUsername,
      username: cleanUsername,
      email: cleanEmail,
      password,
      role: 'public',
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password must be plain text strings' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed due to a server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET ME — returns current authenticated user's info
// ─────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

// ─────────────────────────────────────────────────────────────
// LIST USERS — admin only
// ─────────────────────────────────────────────────────────────
export const listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    console.error('listUsers error:', error);
    res.status(500).json({ error: 'Failed to retrieve user list' });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE USER ROLE — admin only
// Can only promote/demote between public, employee, manager
// Admin role itself cannot be modified or assigned through this endpoint
// ─────────────────────────────────────────────────────────────
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (typeof role !== 'string') {
      return res.status(400).json({ error: 'Role must be a string' });
    }

    const allowedRoles = ['public', 'employee', 'manager'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect admin accounts from being modified via role update endpoint
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot change role of an administrator account' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};
