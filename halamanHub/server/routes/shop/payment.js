// ============================================================
// HalamanHub Server — PayMongo payment routes
// /api/shop/payment/*
// Sandbox mode — use PayMongo test keys
//
// Add to server/.env:
//   PAYMONGO_SECRET_KEY=sk_test_xxxxxxxxxxxx
//   PAYMONGO_PUBLIC_KEY=pk_test_xxxxxxxxxxxx
//   PAYMONGO_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
// ============================================================
const express   = require('express');
const ShopOrder = require('../../models/ShopOrder');
const { requireCustomer } = require('./auth');
const { sendOrderConfirmation } = require('../../utils/email');

const router = express.Router();

const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_BASE   = 'https://api.paymongo.com/v1';

// Helper — base64 encode secret key for Basic Auth
const authHeader = () => ({
  Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET + ':').toString('base64')}`,
  'Content-Type': 'application/json',
});

// Map our payment method strings to PayMongo method types
const METHOD_MAP = {
  gcash:         'gcash',
  paymaya:       'paymaya',
  card:          'card',
  bank_transfer: 'dob',
};

// ── POST /api/shop/payment/create-link
// Creates a PayMongo Payment Link
router.post('/create-link', requireCustomer, async (req, res) => {
  try {
    if (!PAYMONGO_SECRET) {
      return res.status(500).json({ message: 'PayMongo is not configured. Add PAYMONGO_SECRET_KEY to server/.env.' });
    }

    const { amount, description, remarks } = req.body;

    if (!amount || amount < 10000) { // minimum ₱100 (10000 centavos)
      return res.status(400).json({ message: 'Amount must be at least ₱100.' });
    }

    const response = await fetch(`${PAYMONGO_BASE}/links`, {
      method:  'POST',
      headers: authHeader(),
      body: JSON.stringify({
        data: {
          attributes: {
            amount:      Math.round(amount),
            description: description || 'Mapili Plant Nursery Order',
            remarks:     remarks || '',
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.errors?.[0]?.detail || 'PayMongo error.';
      return res.status(400).json({ message: errMsg });
    }

    const link = data.data;
    res.json({
      linkId:          link.id,
      checkoutUrl:     link.attributes.checkout_url,
      referenceNumber: link.attributes.reference_number,
      status:          link.attributes.status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/shop/payment/create-intent
// Creates a PaymentIntent for card payments
router.post('/create-intent', requireCustomer, async (req, res) => {
  try {
    if (!PAYMONGO_SECRET) {
      return res.status(500).json({ message: 'PayMongo is not configured.' });
    }

    const { amount, payMethod } = req.body;
    const methodType = METHOD_MAP[payMethod] || 'card';

    const response = await fetch(`${PAYMONGO_BASE}/payment_intents`, {
      method:  'POST',
      headers: authHeader(),
      body: JSON.stringify({
        data: {
          attributes: {
            amount:                Math.round(amount),
            payment_method_allowed: [methodType],
            currency:              'PHP',
            capture_type:          'automatic',
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.errors?.[0]?.detail || 'PayMongo error.';
      return res.status(400).json({ message: errMsg });
    }

    res.json({
      intentId:  data.data.id,
      clientKey: data.data.attributes.client_key,
      status:    data.data.attributes.status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/shop/payment/webhook
// PayMongo sends payment events here
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

      console.log('[Webhook Received] Checking signature...');

      if (WEBHOOK_SECRET) {
        const signature = req.headers['paymongo-signature'];
        
        // Ensure req.body is treated as a raw string/buffer
        const payload = Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        const crypto = require('crypto');
        const parts = signature?.split(',') || [];
        const timestamp = parts.find((p) => p.startsWith('t='))?.replace('t=', '');
        const sigHash = parts.find((p) => p.startsWith('te='))?.replace('te=', '');

        const expected = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(`${timestamp}.${payload}`)
          .digest('hex');

        if (sigHash !== expected) {
          console.error('[Webhook Fail] Signature mismatch!');
          console.error(' - Expected:', expected);
          console.error(' - Received:', sigHash);
          console.error(' - WEBHOOK_SECRET in use:', WEBHOOK_SECRET ? `${WEBHOOK_SECRET.substring(0, 10)}...` : 'NONE');
          return res.status(400).json({ message: 'Invalid webhook signature.' });
        }
      }

      // Parse payload to JSON object
      const event = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8'))
        : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body);

      const type = event?.data?.attributes?.type;
      const attrs = event?.data?.attributes?.data?.attributes;

      if (type === 'payment.paid' || type === 'link.payment.paid') {
        const referenceNumber = attrs?.reference_number || attrs?.source?.id;
        const paymentId = event?.data?.attributes?.data?.id;

        if (referenceNumber) {
          const order = await ShopOrder.findOne({
            $or: [
              { paymongoLinkId: referenceNumber },
              { orderNumber: referenceNumber },
            ],
          });

          if (order && order.payment !== 'paid') {
            order.payment = 'paid';
            order.paymongoPaymentId = paymentId || '';
            order.statusHistory.push({
              status: order.status,
              note: 'Payment received via PayMongo',
              changedAt: new Date(),
              changedBy: 'PayMongo',
            });
            await order.save();

            sendOrderConfirmation(order).catch(() => {});
            console.log(`[Webhook Success] Payment confirmed for order ${order.orderNumber}`);
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error('[Webhook Error]:', err.message);
      res.status(400).json({ message: err.message });
    }
  }
);

module.exports = router;