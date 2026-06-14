const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, role, password, initials, color } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required.' });
    }
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin or staff.' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'A user with this email already exists.' });

    const user = new User({
      name,
      email,
      role: role || 'staff',
      initials: initials || name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      color: color || '#1a6b3a',
    });
    await user.setPassword(password);
    await user.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Created account for ${user.name} (${user.role})`,
      category: 'users',
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/users/:id/role
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin or staff.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Changed ${user.name}'s role to ${role}`,
      category: 'users',
    });

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Set ${user.name}'s account to ${status}`,
      category: 'users',
    });

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const tempPassword = crypto.randomBytes(6).toString('base64url');
    await user.setPassword(tempPassword);
    await user.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Reset password for ${user.name}`,
      category: 'users',
    });

    res.json({ message: `Temporary password generated for ${user.email}.`, tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Deleted account: ${user.name}`,
      category: 'users',
    });

    res.json({ message: 'User deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;