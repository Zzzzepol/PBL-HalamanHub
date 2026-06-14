const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const User = require('../models/User');
const log = require('../utils/logger'); 

const router = express.Router();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;

router.post('/login', async (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const record = failedAttempts.get(ip);

  if (record && record.lockUntil && record.lockUntil > now) {
    const waitSec = Math.ceil((record.lockUntil - now) / 1000);
    return res.status(429).json({ message: `Too many failed attempts. Try again in ${waitSec}s.` });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const account = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    }).select('+passwordHash');

    const valid = account ? await account.verifyPassword(password) : false;

    if (!account || !valid) {
      const current = failedAttempts.get(ip) || { count: 0, lockUntil: 0 };
      current.count += 1;
      if (current.count >= MAX_ATTEMPTS) {
        current.lockUntil = now + LOCK_MS;
        current.count = 0;
      }
      failedAttempts.set(ip, current);

   
      await log({
        user: username,
        action: 'Failed login attempt',
        category: 'auth',
        status: 'failed',
      });

      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    if (account.status === 'inactive') {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }

    failedAttempts.delete(ip);
    account.lastActiveAt = new Date();
    await account.save();

    const payload = {
      id: account._id.toString(),
      username: account.username || account.email,
      name: account.name,
      role: account.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

router.get('/verify', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;