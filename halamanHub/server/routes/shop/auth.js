// HalamanHub Server — Shop customer auth routes
// /api/shop/auth/*
const express   = require('express');
const jwt       = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Customer  = require('../../models/Customer');
const { sendWelcomeEmail } = require('../../utils/email');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Converts a raw Mongoose/DB error into something safe and readable to
// show a customer — never leak internal error text (field paths, driver
// names, stack-trace-flavored strings) straight to the UI.
function friendlyErrorMessage(err) {
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    if (first?.kind === 'required') {
      const label = first.path === 'firstName' ? 'First name' : first.path === 'lastName' ? 'Last name' : first.path;
      return `${label} is required.`;
    }
    return first?.message || 'Please check the information you entered and try again.';
  }
  if (err.code === 11000) {
    return 'An account with this email already exists.';
  }
  return 'Something went wrong. Please try again.';
}

// Shared by /login, /register, /google, and /complete-profile — keeps the
// JWT payload shape (and therefore what every route reading req.customer
// sees) consistent across all four auth paths.
function buildTokenPayload(customer) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    role: 'customer',
    profileComplete: customer.profileComplete,
    authProvider: customer.authProvider,
  };
}

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

// Use on routes that require a FINISHED account — checkout/orders, mainly.
// Checked against a fresh DB read (not the JWT claim) because a customer
// can complete their profile mid-session, and we don't want a stale token
// issued before that moment to either wrongly block or wrongly allow them.
async function requireCompleteProfile(req, res, next) {
  const customer = await Customer.findById(req.customer.id);
  if (!customer || !customer.profileComplete) {
    return res.status(403).json({ message: 'Please complete your profile before continuing.', code: 'PROFILE_INCOMPLETE' });
  }
  next();
}

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (phone && !/^09\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be a valid PH mobile number, e.g. 09171234567.' });
    }
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters with uppercase, lowercase, a number, and a special character.' });
    }

    const exists = await Customer.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const customer = new Customer({ firstName, lastName, email, phone: phone || '' });
    await customer.setPassword(password);
    await customer.save();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(customer).catch(() => {});

    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer', authProvider: customer.authProvider };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, user: { ...payload, phone: customer.phone } });
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
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

    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer', authProvider: customer.authProvider };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token, user: { ...payload, phone: customer.phone } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shop/auth/google — single endpoint for BOTH sign-in and sign-up
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body; // the ID token GIS handed the frontend
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential.' });
    }

    // This is the actual security check — verifies the token's signature
    // and that it was issued for OUR client ID, not someone else's app.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, name: fullName, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: 'Your Google account email is not verified.' });
    }

    // 1) Returning Google user — found by googleId.
    let customer = await Customer.findOne({ googleId });

    // 2) First time via Google, but an account with this email already
    //    exists (they originally signed up with email/password) — link
    //    the Google ID onto that existing account instead of creating a
    //    duplicate. They keep their existing phone/profileComplete status.
    if (!customer) {
      customer = await Customer.findOne({ email: email.toLowerCase() });
      if (customer) {
        customer.googleId = googleId;

        // Backfill for accounts created before the firstName/lastName
        // migration — they only have the old `name` field stored, so
        // saving them now (full-document validation) would otherwise
        // fail on these two now-required fields.
        if (!customer.firstName) customer.firstName = given_name || (fullName || 'Customer').split(' ')[0];
        if (!customer.lastName)  customer.lastName  = family_name || (fullName || '').split(' ').slice(1).join(' ') || 'User';

        await customer.save();
      }
    }

    // 3) Brand new customer — create a base account. No password, no
    //    phone yet — profileComplete stays false until onboarding.
    if (!customer) {
      customer = new Customer({
        firstName: given_name || (fullName || 'New').split(' ')[0],
        lastName:  family_name || (fullName || '').split(' ').slice(1).join(' ') || 'User',
        email,
        googleId,
        authProvider: 'google',
        profileComplete: false,
      });
      await customer.save();
      sendWelcomeEmail(customer).catch(() => {});
    }

    if (customer.status === 'inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    customer.lastActiveAt = new Date();
    await customer.save();

    const tokenPayload = buildTokenPayload(customer);
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token, user: { ...tokenPayload, phone: customer.phone } });
  } catch (err) {
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
});

// PUT /api/shop/auth/complete-profile — the mandatory onboarding step for
// new Google sign-ups. Re-issues the JWT so profileComplete: true takes
// effect immediately, without requiring the user to log out/in again.
router.put('/complete-profile', requireCustomer, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ message: 'First name, last name, and phone number are required.' });
    }
    if (!/^09\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be a valid PH mobile number, e.g. 09171234567.' });
    }

    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    customer.firstName = firstName;
    customer.lastName = lastName;
    customer.phone = phone;
    customer.profileComplete = true;
    await customer.save();

    const tokenPayload = buildTokenPayload(customer);
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token, user: { ...tokenPayload, phone: customer.phone } });
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
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

    if (phone && !/^09\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be a valid PH mobile number, e.g. 09171234567.' });
    }

    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: 'Account not found.' });

    // Assigning to customer.name (rather than passing it into
    // findByIdAndUpdate) is what triggers the virtual setter that splits
    // it back into firstName/lastName — findByIdAndUpdate would silently
    // ignore a non-schema field like a virtual.
    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    await customer.save();

    const payload = { id: customer._id.toString(), name: customer.name, email: customer.email, role: 'customer', phone: customer.phone, authProvider: customer.authProvider };
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
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must be at least 8 characters with uppercase, lowercase, a number, and a special character.' });
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

module.exports = { router, requireCustomer, requireCompleteProfile };
