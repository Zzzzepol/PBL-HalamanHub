const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

const TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready:      ['completed', 'cancelled'],
  completed:  [],
  cancelled:  [],
};

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { customer, customerEmail, customerPhone, product, quantity, amount, note, payment } = req.body;
    if (!customer || !product || amount == null) {
      return res.status(400).json({ message: 'customer, product, and amount are required.' });
    }

    const count = await Order.countDocuments();
    const orderNumber = `#ORD-${String(count + 1).padStart(4, '0')}`;

    const order = await Order.create({
      orderNumber,
      customer,
      customerEmail,
      customerPhone,
      product,
      quantity: quantity || 1,
      amount,
      note,
      payment: payment || 'unpaid',
      statusHistory: [{ status: 'pending', note: 'Order created', changedBy: req.user.name || 'admin' }],
    });

    // ← CORRECT POSITION — inside try, after create, before res.json
    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Created order ${order.orderNumber} for ${order.customer}`,
      category: 'orders',
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot move order from "${order.status}" to "${status}".`,
        allowedTransitions: allowed,
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      note: note || '',
      changedAt: new Date(),
      changedBy: req.user.name || 'admin',
    });

    await order.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Changed order ${order.orderNumber} status to ${status}`,
      category: 'orders',
    });

    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/orders/:id/payment
router.patch('/:id/payment', async (req, res) => {
  try {
    const { payment } = req.body;
    if (!['unpaid', 'paid', 'refunded'].includes(payment)) {
      return res.status(400).json({ message: 'Invalid payment status.' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { payment }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found.' });


    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Updated payment for order ${order.orderNumber} to ${payment}`,
      category: 'orders',
    });

    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.status !== 'cancelled') {
      return res.status(400).json({ message: 'Only cancelled orders can be deleted.' });
    }

    await order.deleteOne();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Deleted order ${order.orderNumber} (${order.customer})`,
      category: 'orders',
    });

    res.json({ message: 'Order deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;