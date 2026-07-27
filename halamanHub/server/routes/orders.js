const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Order = require('../models/ShopOrder');
const Product = require('../models/Product');
const log = require('../utils/logger');
const { decrementStockForOrder, validateStockForItems } = require('../utils/stock');
const { sendOrderStatusUpdate } = require('../utils/email');
const { createAlertIfEnabled } = require('../utils/alerts');

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

// POST /api/orders/pos — walk-in point-of-sale sale.
// Fully paid and fulfilled immediately (customer walks out with the product),
// so stock decrements right away rather than waiting on a separate payment step.
router.post('/pos', async (req, res) => {
  try {
    const { customer, items, note } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required.' });
    }

    // Look up real, current prices/names server-side — never trust the client for this
    const resolvedItems = [];
    for (const it of items) {
      const product = await Product.findById(it.productId);
      if (!product) return res.status(400).json({ message: `Product not found: ${it.productId}` });
      if (!it.qty || it.qty < 1) return res.status(400).json({ message: `Invalid quantity for ${product.name}.` });
      resolvedItems.push({
        productId: product._id.toString(),
        name: product.name,
        price: product.price,
        qty: it.qty,
        unit: product.unit,
        category: product.category,
        imageUrl: product.imageUrl || '',
      });
    }

    // Validate live stock before committing to the sale
    const stockCheck = await validateStockForItems(resolvedItems);
    if (!stockCheck.valid) {
      return res.status(409).json({
        message: 'Not enough stock for one or more items.',
        insufficient: stockCheck.insufficient,
      });
    }

    const amount = resolvedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const productSummary = resolvedItems.map(i => `${i.name} x${i.qty}`).join(', ');

    const count = await Order.countDocuments();
    const orderNumber = `#POS-${String(count + 1).padStart(4, '0')}`;
    const staffName = req.user.name || 'admin';

    const order = await Order.create({
      orderNumber,
      customer: customer?.trim() || 'Walk-in customer',
      product: productSummary,
      items: resolvedItems,
      quantity: resolvedItems.reduce((sum, i) => sum + i.qty, 0),
      amount,
      note: note || 'Walk-in POS sale',
      fulfillmentType: 'pickup',
      payment: 'paid',
      status: 'completed',
      statusHistory: [
        { status: 'pending',   note: 'POS sale',                    changedAt: new Date(), changedBy: staffName },
        { status: 'completed', note: 'Completed at point of sale',  changedAt: new Date(), changedBy: staffName },
      ],
    });

    await decrementStockForOrder(order);

    await createAlertIfEnabled('orders', {
      type: 'ok',
      icon: 'ti-cash-register',
      message: `Walk-in sale ${order.orderNumber} completed (₱${amount}).`,
    });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Recorded walk-in POS sale ${order.orderNumber} (₱${amount})`,
      category: 'orders',
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/orders/summary — lightweight count for the sidebar badge
router.get('/summary', async (req, res) => {
  try {
    const pending = await Order.countDocuments({ status: 'pending' });
    res.json({ pending });
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

    sendOrderStatusUpdate(order, status).catch(() => {}); // non-blocking

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
    if (!['unpaid', 'paid'].includes(payment)) {
      return res.status(400).json({ message: 'Invalid payment status.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    // Only decrement the first time an order transitions INTO paid —
    // never double-deduct on repeated saves or paid -> refunded -> paid.
    const isNewlyPaid = payment === 'paid' && order.payment !== 'paid';

    order.payment = payment;
    await order.save();

    if (isNewlyPaid) {
      await decrementStockForOrder(order);
      await createAlertIfEnabled('orders', {
        type: 'ok',
        icon: 'ti-cash',
        message: `Payment marked as paid for order ${order.orderNumber} (₱${order.amount}).`,
      });
    }

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