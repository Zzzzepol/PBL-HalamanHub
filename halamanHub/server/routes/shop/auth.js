// HalamanHub Server — Shop customer auth routes
// /api/shop/auth/*
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

    if (phone && !/^\+639\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be a valid PH mobile number, e.g. +639171234567.' });
    }

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

// ── Saved addresses ──────────────────────────────────────────────

// GET /api/shop/auth/addresses
router.get('/addresses', requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });
    res.json({ addresses: customer.addresses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shop/auth/addresses — add a new address
router.post('/addresses', requireCustomer, async (req, res) => {
  try {
    const { label, address, city } = req.body;
    if (!address || !city) {
      return res.status(400).json({ message: 'Address and city are required.' });
    }

    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    // First address a customer ever adds becomes primary automatically
    const isFirst = customer.addresses.length === 0;
    customer.addresses.push({ label: label || 'Home', address, city, isPrimary: isFirst });
    await customer.save();

    res.status(201).json({ addresses: customer.addresses });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/shop/auth/addresses/:addressId — edit an address
router.put('/addresses/:addressId', requireCustomer, async (req, res) => {
  try {
    const { label, address, city } = req.body;
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    const addr = customer.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found.' });

    if (label !== undefined)   addr.label = label;
    if (address !== undefined) addr.address = address;
    if (city !== undefined)    addr.city = city;

    await customer.save();
    res.json({ addresses: customer.addresses });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/shop/auth/addresses/:addressId
router.delete('/addresses/:addressId', requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    const addr = customer.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found.' });

    const wasPrimary = addr.isPrimary;
    addr.deleteOne();

    // If the deleted address was the primary one, promote another so
    // there's always a primary as long as at least one address exists.
    if (wasPrimary && customer.addresses.length > 0) {
      customer.addresses[0].isPrimary = true;
    }

    await customer.save();
    res.json({ addresses: customer.addresses });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/shop/auth/addresses/:addressId/primary — set as primary
router.patch('/addresses/:addressId/primary', requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    const target = customer.addresses.id(req.params.addressId);
    if (!target) return res.status(404).json({ message: 'Address not found.' });

    customer.addresses.forEach(a => { a.isPrimary = a._id.equals(target._id); });

    await customer.save();
    res.json({ addresses: customer.addresses });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = { router, requireCustomer };
