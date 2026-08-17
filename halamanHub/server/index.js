require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Customer Side Shop Routes
const shopAuthRoutes    = require('./routes/shop/auth').router;
const shopProductRoutes = require('./routes/shop/products');
const shopOrderRoutes   = require('./routes/shop/orders');
const shopPaymentRoutes = require('./routes/shop/payment');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const sensorRoutes = require('./routes/sensors');
const irrigationRoutes = require('./routes/irrigation');
const irrigationControlRoutes = require('./routes/irrigationControl');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const logRoutes = require('./routes/logs');
const sensorDataRoutes = require('./routes/sensorData');
const reportRoutes = require('./routes/reports');

const http = require('http');
const { initSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const SHOP_ORIGIN = process.env.SHOP_ORIGIN || 'http://localhost:3001';
const server = http.createServer(app);
initSocket(server, [CLIENT_ORIGIN, SHOP_ORIGIN]);

app.use(cors({ origin: [CLIENT_ORIGIN, SHOP_ORIGIN] }));

const BODY_LIMIT = '10mb';

// Global JSON parser that ignores ONLY the webhook endpoint.
// Product image uploads are stored as base64 data URLs, so the default limit is too small.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/shop/payment/webhook') {
    next(); // Skip express.json() for the webhook
  } else {
    express.json({ limit: BODY_LIMIT })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request payload too large. Please use a smaller image or compress it before uploading.' });
  }
  next(err);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'halamanhub-server', time: new Date().toISOString() });
});

// Admin Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/irrigation/control', irrigationControlRoutes);
app.use('/api/irrigation', irrigationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/sensor-data', sensorDataRoutes);
app.use('/api/reports', reportRoutes);

// Customer Side Shop Routes
app.use('/api/shop/auth', shopAuthRoutes);
app.use('/api/shop/products', shopProductRoutes);
app.use('/api/shop/orders', shopOrderRoutes);
app.use('/api/shop/payment', shopPaymentRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

connectDB().then(() => {
  const { checkSensorHealth } = require('./utils/sensorHealth');
  const { checkProductStock } = require('./utils/productHealth');
  checkSensorHealth();
  setInterval(checkSensorHealth, 30 * 1000);  // detect a five-minute timeout promptly
  setInterval(checkProductStock, 60 * 1000);  // check every minute
  server.listen(PORT, () => {
    console.log(`HalamanHub server running on http://localhost:${PORT}`);
    console.log(`Socket.io ready for real-time connections`);
    console.log(`Allowing requests from: ${CLIENT_ORIGIN}`);
  });
});
