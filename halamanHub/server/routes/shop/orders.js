const express   = require('express');
const ShopOrder = require('../../models/ShopOrder');
const Product   = require('../../models/Product');
const { requireCustomer } = require('./auth');
const { sendOrderConfirmation } = require('../../utils/email');
const { validateStockForItems } = require('../../utils/stock');

const router = express.Router();
router.use(requireCustomer);

async function autoExpireIfStale(order) {
  const isExpired = order.payment === 'unpaid'
    && order.paymentExpiresAt
    && new Date() > new Date(order.paymentExpiresAt);

  if (!isExpired) return order;

  order.payment = 'failed';
  order.status = 'cancelled';
  order.statusHistory.push({
    status: 'cancelled',
    note: 'Payment window expired',
    changedAt: new Date(),
    changedBy: 'system',
  });
  await order.save();
  return order;
}

// GET /api/shop/orders — customer's own orders
router.get('/', async (req, res) => {
  try {
    const orders = await ShopOrder.find({ customerId: req.customer.id })
      .sort({ orderDate: -1 });

    const checked = await Promise.all(orders.map(autoExpireIfStale));
    res.json(checked);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shop/orders/:id
router.get('/:id', async (req, res) => {
  try {
    let order = await ShopOrder.findOne({
      _id:        req.params.id,
      customerId: req.customer.id,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    order = await autoExpireIfStale(order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shop/orders/validate-stock
// Checks cart items against LIVE stock before proceeding to payment —
// catches items that sold out (or dropped below the requested qty)
// while sitting in someone's cart.
router.post('/validate-stock', async (req, res) => {
  try {
    const { items } = req.body;
    const result = await validateStockForItems(items || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shop/orders — create new order
router.post('/', async (req, res) => {
  try {
    const {
      customer, customerEmail, customerPhone,
      product, items, quantity, amount, shippingFee,
      note, fulfillmentType, pickupDate, payment,
      paymongoLinkId, paymongoCheckoutUrl,
    } = req.body;

    if (!customer || !product || amount == null) {
      return res.status(400).json({ message: 'customer, product, and amount are required.' });
    }

    // Final server-side safety net — re-check live stock right before creating
    // the order, in case anything changed since the frontend's own check.
    if (items && items.length > 0) {
      const stockCheck = await validateStockForItems(items);
      if (!stockCheck.valid) {
        return res.status(409).json({
          message: 'Some items in your cart are no longer available in the requested quantity.',
          insufficient: stockCheck.insufficient,
        });
      }
    }

    // Auto-generate order number
    const count       = await ShopOrder.countDocuments();
    const orderNumber = `#SHP-${String(count + 1).padStart(4, '0')}`;

    const order = await ShopOrder.create({
      orderNumber,
      customerId:    req.customer.id,
      customer,
      customerEmail,
      customerPhone: customerPhone || '',
      product,
      items:         items || [],
      quantity:      quantity || 1,
      amount,
      shippingFee:   shippingFee || 0,
      note:          note || '',
      fulfillmentType: fulfillmentType || 'delivery',
      pickupDate:    pickupDate ? new Date(pickupDate) : null,
      payment:       payment || 'unpaid',
      paymongoLinkId:      paymongoLinkId || '',
      paymongoCheckoutUrl: paymongoCheckoutUrl || '',
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15-minute payment window
      statusHistory: [{ status: 'pending', note: 'Order placed', changedBy: customer }],
    });

    // Send order confirmation email (non-blocking)
    sendOrderConfirmation(order).catch(() => {});

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/shop/orders/:id/expire
// Called by the frontend when it notices the payment window (paymentExpiresAt)
// has passed and the order is still unpaid — PayMongo doesn't send a webhook
// for this case, so we mark it ourselves.
router.patch('/:id/expire', async (req, res) => {
  try {
    const order = await ShopOrder.findOne({
      _id:        req.params.id,
      customerId: req.customer.id,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const isExpired = order.paymentExpiresAt && new Date() > new Date(order.paymentExpiresAt);

    if (order.payment === 'unpaid' && isExpired) {
      order.payment = 'failed';
      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        note: 'Payment window expired',
        changedAt: new Date(),
        changedBy: 'system',
      });
      await order.save();
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/shop/orders/:id/abandon
// Called when the customer leaves the pending-payment screen (refresh, back
// button, tab close, or manually clicking Cancel) before completing payment.
// Cancels immediately — doesn't wait for the payment window to run out.
router.patch('/:id/abandon', async (req, res) => {
  try {
    const order = await ShopOrder.findOne({
      _id:        req.params.id,
      customerId: req.customer.id,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (order.payment === 'unpaid') {
      order.payment = 'failed';
      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        note: 'Order abandoned before payment was completed',
        changedAt: new Date(),
        changedBy: 'system',
      });
      await order.save();
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shop/orders/:id/reorder
// Fetches original order items and returns them so the
// frontend can add them back to the cart
router.post('/:id/reorder', async (req, res) => {
  try {
    const original = await ShopOrder.findOne({
      _id:        req.params.id,
      customerId: req.customer.id,
    });

    if (!original) return res.status(404).json({ message: 'Order not found.' });

    // Enrich items with current product data (price may have changed)
    const enriched = await Promise.all(
      (original.items || []).map(async (item) => {
        if (item.productId) {
          const current = await Product.findById(item.productId).catch(() => null);
          if (current && current.status !== 'out-of-stock') {
            return {
              productId: current._id.toString(),
              name:      current.name,
              price:     current.price,
              qty:       item.qty,
              unit:      current.unit,
              category:  current.category,
              imageUrl:  current.imageUrl || '',
              status:    current.status,
            };
          }
        }
        // Fallback to original item data if product not found
        return {
          productId: item.productId || '',
          name:      item.name,
          price:     item.price,
          qty:       item.qty,
          unit:      item.unit || '',
          category:  item.category || '',
          imageUrl:  item.imageUrl || '',
          status:    'in-stock',
        };
      })
    );

    res.json({
      message: 'Items ready to add to cart.',
      items:   enriched.filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;