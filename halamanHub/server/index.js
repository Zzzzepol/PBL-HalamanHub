require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const sensorRoutes = require('./routes/sensors');
const irrigationRoutes = require('./routes/irrigation');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const logRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'halamanhub-server', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/irrigation', irrigationRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`HalamanHub server running on http://localhost:${PORT}`);
    console.log(`Allowing requests from: ${CLIENT_ORIGIN}`);
  });
});
