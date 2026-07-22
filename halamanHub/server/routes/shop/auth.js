// ============================================================
// HalamanHub Server — Shop customer auth routes
// /api/shop/auth/*
// ============================================================
const express   = require('express');
const jwt       = require('jsonwebtoken');
const Customer  = require('../../models/Customer');
const { sendWelcomeEmail } = require('../../utils/email');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Middleware — verify customer token
function requireCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  try {
    req.customer = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

// POST /api/shop/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const exists = await Customer.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const customer = new Customer({ name, email, phone: phone || '' });
    await customer.setPassword(password);
    await customer.save();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(customer).catch(() => {});

    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer' };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({ token, user: { ...payload, phone: customer.phone } });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/shop/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    const valid    = customer ? await customer.verifyPassword(password) : false;

    if (!customer || !valid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (customer.status === 'inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    customer.lastActiveAt = new Date();
    await customer.save();

    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer' };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token, user: { ...payload, phone: customer.phone } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shop/auth/verify
router.get('/verify', requireCustomer, (req, res) => {
  res.json({ user: req.customer });
});

// PUT /api/shop/auth/profile
router.put('/profile', requireCustomer, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.customer.id,
      { name, phone },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ message: 'Account not found.' });
    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer', phone: customer.phone };
    res.json({ user: payload });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/shop/auth/change-password
router.put('/change-password', requireCustomer, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const customer = await Customer.findById(req.customer.id).select('+passwordHash');
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    const valid = await customer.verifyPassword(currentPassword);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });

    await customer.setPassword(newPassword);
    await customer.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = { router, requireCustomer };
