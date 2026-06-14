// ============================================================
// HalamanHub Server — Database seed script
// Run with: npm run seed  (from inside the server/ folder)
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User               = require('../models/User');
const Product            = require('../models/Product');
const Order              = require('../models/Order');
const Sensor             = require('../models/Sensor');
const IrrigationZone     = require('../models/IrrigationZone');
const IrrigationSchedule = require('../models/IrrigationSchedule');
const Alert              = require('../models/Alert');
const Settings           = require('../models/Settings');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in server/.env');
  process.exit(1);
}

async function seed() {
  await connectDB();
  console.log('Seeding HalamanHub database…\n');

  // Users — admin and staff only, no customers
  await User.deleteMany({});
  const userDocs = [
    { name: 'Admin',          email: `${ADMIN_USERNAME}@halamanhub.ph`, username: ADMIN_USERNAME, role: 'admin', status: 'active', initials: 'AD', color: '#1a6b3a', password: ADMIN_PASSWORD }
  ];
  for (const u of userDocs) {
    const { password, ...rest } = u;
    const user = new User(rest); 
    await user.setPassword(password);
    await user.save();
  }
  console.log(`✓ Seeded ${userDocs.length} users  (admin login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD})`);

  // Products
  await Product.deleteMany({});
  await Product.insertMany([
    { name: 'Organic Tomatoes',      category: 'Vegetables',   price: 140, unit: 'kg',     stock: 28 },
    { name: 'Mixed Greens',          category: 'Leafy greens', price: 180, unit: 'kg',     stock: 14 },
    { name: 'Bell Peppers',          category: 'Vegetables',   price: 210, unit: 'kg',     stock: 6  },
    { name: 'Kangkong',              category: 'Leafy greens', price: 45,  unit: 'bundle', stock: 0  },
    { name: 'Lettuce (head)',        category: 'Leafy greens', price: 70,  unit: 'head',   stock: 32 },
    { name: 'Ampalaya',              category: 'Vegetables',   price: 95,  unit: 'kg',     stock: 18 },
    { name: 'Pechay',                category: 'Leafy greens', price: 55,  unit: 'bundle', stock: 40 },
    { name: 'Sitaw (string beans)',  category: 'Vegetables',   price: 120, unit: 'kg',     stock: 3  },
  ]);
  console.log('✓ Seeded 8 products');

  // Orders with full status history
  await Order.deleteMany({});
  const now = Date.now();
  const days = (d) => new Date(now - d * 86400000);
  await Order.insertMany([
    { orderNumber: '#ORD-0001', customer: 'Maria Santos',    customerEmail: 'maria@gmail.com',  product: 'Organic Tomatoes (2 kg)',  quantity: 2,  amount: 280, status: 'pending',    payment: 'unpaid',  orderDate: days(0), statusHistory: [{ status: 'pending',   note: 'Order created',           changedAt: days(0), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0002', customer: 'Juan Reyes',      customerEmail: 'jreyes@yahoo.com', product: 'Mixed Greens (1 kg)',      quantity: 1,  amount: 180, status: 'confirmed',  payment: 'paid',    orderDate: days(0), statusHistory: [{ status: 'pending',   note: 'Order created',           changedAt: days(0), changedBy: 'admin' }, { status: 'confirmed', note: 'Payment received', changedAt: days(0), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0003', customer: 'Ana Cruz',        customerEmail: 'ana@gmail.com',    product: 'Bell Peppers (1.5 kg)',    quantity: 1,  amount: 320, status: 'processing', payment: 'paid',    orderDate: days(1), statusHistory: [{ status: 'pending',   note: 'Order created',           changedAt: days(1), changedBy: 'admin' }, { status: 'confirmed',  note: '',                changedAt: days(1), changedBy: 'admin' }, { status: 'processing', note: 'Being packed', changedAt: days(0), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0004', customer: 'Pedro Lim',       product: 'Kangkong bundle',         quantity: 3,  amount: 135, status: 'ready',      payment: 'paid',    orderDate: days(1), statusHistory: [{ status: 'pending', note: 'Order created', changedAt: days(1), changedBy: 'admin' }, { status: 'confirmed', note: '', changedAt: days(1), changedBy: 'admin' }, { status: 'processing', note: '', changedAt: days(1), changedBy: 'admin' }, { status: 'ready', note: 'Ready for pickup', changedAt: days(0), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0005', customer: 'Rosa Mendoza',    product: 'Lettuce head (×3)',        quantity: 3,  amount: 210, status: 'completed',  payment: 'paid',    orderDate: days(2), statusHistory: [{ status: 'pending', note: '', changedAt: days(2), changedBy: 'admin' }, { status: 'completed', note: 'Delivered', changedAt: days(1), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0006', customer: 'Carlo Bautista',  product: 'Ampalaya (0.5 kg)',        quantity: 1,  amount: 48,  status: 'completed',  payment: 'paid',    orderDate: days(2), statusHistory: [{ status: 'pending', note: '', changedAt: days(2), changedBy: 'admin' }, { status: 'completed', note: '', changedAt: days(2), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0007', customer: 'Liza Torres',     product: 'Pechay (2 bundles)',       quantity: 2,  amount: 110, status: 'cancelled',  payment: 'refunded',orderDate: days(3), statusHistory: [{ status: 'pending', note: '', changedAt: days(3), changedBy: 'admin' }, { status: 'cancelled', note: 'Customer requested cancellation', changedAt: days(2), changedBy: 'admin' }] },
    { orderNumber: '#ORD-0008', customer: 'Mark Villanueva', product: 'Sitaw (1 kg)',             quantity: 1,  amount: 120, status: 'completed',  payment: 'paid',    orderDate: days(3), statusHistory: [{ status: 'pending', note: '', changedAt: days(3), changedBy: 'admin' }, { status: 'completed', note: '', changedAt: days(3), changedBy: 'admin' }] },
  ]);
  console.log('✓ Seeded 8 orders');

  // Sensors
  await Sensor.deleteMany({});
  await Sensor.insertMany([
    { sensorId: 'SNS-001', type: 'Soil moisture', zone: 'Zone A', value: '67%',           numericValue: 67,  status: 'ok',      device: 'ESP32-01' },
    { sensorId: 'SNS-002', type: 'pH',            zone: 'Zone A', value: '6.4',            numericValue: 6.4, status: 'ok',      device: 'ESP32-01' },
    { sensorId: 'SNS-003', type: 'EC',            zone: 'Zone A', value: '1.8 mS/cm',      numericValue: 1.8, status: 'warning', device: 'ESP32-01' },
    { sensorId: 'SNS-004', type: 'NPK',           zone: 'Zone A', value: 'N:60 P:38 K:67',               status: 'ok',      device: 'ESP32-02' },
    { sensorId: 'SNS-005', type: 'Temperature',   zone: 'Zone A', value: '28°C',           numericValue: 28,  status: 'ok',      device: 'ESP32-01' },
    { sensorId: 'SNS-006', type: 'Humidity',      zone: 'Zone A', value: '74%',            numericValue: 74,  status: 'ok',      device: 'ESP32-01' },
    { sensorId: 'SNS-007', type: 'Soil moisture', zone: 'Zone B', value: '—',                             status: 'offline', device: 'ESP32-03' },
    { sensorId: 'SNS-008', type: 'Water level',   zone: 'Tank 1', value: '82%',            numericValue: 82,  status: 'ok',      device: 'ESP32-02' },
    { sensorId: 'SNS-009', type: 'pH',            zone: 'Zone B', value: '—',                             status: 'offline', device: 'ESP32-03' },
    { sensorId: 'SNS-010', type: 'EC',            zone: 'Zone B', value: '1.2 mS/cm',      numericValue: 1.2, status: 'warning', device: 'ESP32-03' },
    { sensorId: 'SNS-011', type: 'Temperature',   zone: 'Zone B', value: '27°C',           numericValue: 27,  status: 'ok',      device: 'ESP32-02' },
    { sensorId: 'SNS-012', type: 'Humidity',      zone: 'Zone B', value: '71%',            numericValue: 71,  status: 'ok',      device: 'ESP32-02' },
    { sensorId: 'SNS-013', type: 'NPK',           zone: 'Zone B', value: 'N:52 P:34 K:58',               status: 'ok',      device: 'ESP32-02' },
    { sensorId: 'SNS-014', type: 'Water level',   zone: 'Tank 2', value: '45%',            numericValue: 45,  status: 'ok',      device: 'ESP32-02' },
  ]);
  console.log('✓ Seeded 14 sensors');

  // Irrigation zones
  await IrrigationZone.deleteMany({});
  await IrrigationZone.insertMany([
    { zoneId: 'zone-a', name: 'Zone A', status: 'idle', lastRunSummary: 'Today at 7:00 AM · 25 min', nextRunSummary: 'Today 6:00 PM' },
    { zoneId: 'zone-b', name: 'Zone B', status: 'idle', lastRunSummary: 'Yesterday at 7:00 AM · 25 min', nextRunSummary: 'Tomorrow 7:30 AM' },
    { zoneId: 'zone-c', name: 'Zone C', status: 'idle', lastRunSummary: 'Yesterday at 7:00 AM · 20 min', nextRunSummary: 'Tomorrow 7:00 AM' },
  ]);
  console.log('✓ Seeded 3 irrigation zones');

  // Irrigation schedules
  await IrrigationSchedule.deleteMany({});
  await IrrigationSchedule.insertMany([
    { time: '07:00 AM', zone: 'Zone A', frequency: 'Daily',          status: 'active', duration: 25 },
    { time: '07:30 AM', zone: 'Zone B', frequency: 'Daily',          status: 'active', duration: 20 },
    { time: '06:00 PM', zone: 'Zone A', frequency: 'Mon / Wed / Fri',status: 'active', duration: 15 },
    { time: '06:00 PM', zone: 'Zone C', frequency: 'Tue / Thu / Sat',status: 'paused', duration: 15 },
  ]);
  console.log('✓ Seeded 4 irrigation schedules');

  // Alerts
  await Alert.deleteMany({});
  const h = (hrs) => new Date(now - hrs * 3600000);
  await Alert.insertMany([
    { type: 'warning', icon: 'ti-alert-triangle', message: 'EC sensor Zone B reading below threshold (1.2 mS)',  occurredAt: h(1),  read: false },
    { type: 'ok',      icon: 'ti-droplet',         message: 'Irrigation Zone A completed successfully (22 min)', occurredAt: h(3),  read: false },
    { type: 'ok',      icon: 'ti-cloud-rain',      message: 'Rainwater harvest collected 120 L overnight',       occurredAt: h(5),  read: true  },
    { type: 'error',   icon: 'ti-wifi-off',        message: 'ESP32 Module #3 offline — reconnect required',      occurredAt: h(11), read: true  },
    { type: 'warning', icon: 'ti-alert-triangle',  message: 'Potassium level slightly elevated in Zone A',       occurredAt: h(27), read: true  },
    { type: 'ok',      icon: 'ti-circle-check',    message: 'System health check passed — all 13 sensors online',occurredAt: h(29), read: true  },
  ]);
  console.log('✓ Seeded 6 alerts');

  // Settings
  await Settings.deleteMany({});
  await Settings.create({});
  console.log('✓ Seeded default settings');

  console.log('\nDone! Database seeded successfully.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
