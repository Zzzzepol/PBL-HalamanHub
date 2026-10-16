const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const User = require('../models/User');
const LocalUser = require('../models/LocalUser');
const log = require('../utils/logger'); 
const { isShopConnected, shopConnection } = require('../config/connections');
const { cacheAdminAccount } = require('../utils/accountCloudSync');

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

  // ---- Offline read-only account — checked FIRST, before anything touches
  // MongoDB. This is what lets you log in and view live sensor readings
  // even when the database itself is completely unreachable (no internet). ----
  const OFFLINE_USER = process.env.OFFLINE_ADMIN_USER;
  const OFFLINE_PASS = process.env.OFFLINE_ADMIN_PASS;

  if (
    OFFLINE_USER &&
    OFFLINE_PASS &&
    username.toLowerCase() === OFFLINE_USER.toLowerCase() &&
    password === OFFLINE_PASS
  ) {
    const payload = {
      id: 'offline-admin',
      username: OFFLINE_USER.toLowerCase(),
      name: 'Offline Viewer',
      role: 'offline-readonly',
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: payload });
  }

  if (!isShopConnected()) {
    console.warn(`[Auth] Login unavailable because the cloud account database is disconnected (readyState ${shopConnection.readyState}).`);
    try {
      const account = await LocalUser.findOne({
        $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
      }).select('+passwordHash');

      if (!account) {
        return res.status(503).json({ message: 'The cloud account database is unavailable and this account has not been cached on this laptop. Connect online and sign in once to enable offline access.' });
      }
      if (account.status === 'inactive') {
        return res.status(403).json({ message: 'This account has been deactivated.' });
      }

      const valid = await account.verifyPassword(password);
      if (!valid) {
        const current = failedAttempts.get(ip) || { count: 0, lockUntil: 0 };
        current.count += 1;
        if (current.count >= MAX_ATTEMPTS) {
          current.lockUntil = now + LOCK_MS;
          current.count = 0;
        }
        failedAttempts.set(ip, current);
        return res.status(401).json({ message: 'Invalid username or password.' });
      }

      failedAttempts.delete(ip);
      const payload = {
        id: account._id.toString(),
        username: account.username || account.email,
        name: account.name,
        role: account.role,
        offline: true,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ token, user: payload });
    } catch (err) {
      console.error('[Auth] Local account lookup failed:', err.message);
      return res.status(503).json({ message: 'The local account cache is unavailable. Check the laptop MongoDB service.' });
    }
  }

  try {
    const account = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    }).select('+passwordHash');

    const valid = account ? await account.verifyPassword(password) : false;

    if (!account || !valid) {
      console.warn('[Auth] Login failed: cloud database responded, but the account was not found or the password did not match.');
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
    await cacheAdminAccount(account).catch((error) => {
      console.warn('[Auth] Could not refresh the local account cache:', error.message);
    });

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
    try {
      const account = await LocalUser.findOne({
        $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
      }).select('+passwordHash');
      if (account?.status === 'inactive') {
        return res.status(403).json({ message: 'This account has been deactivated.' });
      }
      if (account && !(await account.verifyPassword(password))) {
        return res.status(401).json({ message: 'Invalid username or password.' });
      }
      if (account?.status === 'active') {
        failedAttempts.delete(ip);
        const payload = {
          id: account._id.toString(),
          username: account.username || account.email,
          name: account.name,
          role: account.role,
          offline: true,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.json({ token, user: payload });
      }
      return res.status(503).json({ message: 'The cloud account database is unavailable and this account has not been cached on this laptop. Connect online and sign in once to enable offline access.' });
    } catch (localError) {
      console.error('[Auth] Local account fallback failed:', localError.message);
    }
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

router.get('/verify', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
