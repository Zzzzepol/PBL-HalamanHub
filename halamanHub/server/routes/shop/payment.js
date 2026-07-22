const express   = require('express');
const crypto    = require('crypto');
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

// Map payment method strings
const METHOD_MAP = {
  gcash:         'gcash',
  paymaya:       'paymaya',
  card:          'card',
  bank_transfer: 'dob',
};

// ── POST /api/shop/payment/create-link ────────────────────────────────────────
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

// ── POST /api/shop/payment/create-intent ──────────────────────────────────────
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

// ── POST /api/shop/payment/webhook ───────────────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

      console.log('[Webhook Received] Checking signature...');

      const payload = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      if (WEBHOOK_SECRET) {
        const signature = req.headers['paymongo-signature'] || '';
        
        const parts = signature.split(',').reduce((acc, part) => {
          const [key, val] = part.trim().split('=');
          if (key && val) acc[key] = val;
          return acc;
        }, {});

        const timestamp = parts.t;
        const sigHash = parts.te || parts.li; // 'te' = test mode, 'li' = live mode

        const expected = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(`${timestamp}.${payload}`)
          .digest('hex');

        if (!sigHash || sigHash !== expected) {
          console.error('[Webhook Fail] Signature mismatch!');
          return res.status(400).json({ message: 'Invalid webhook signature.' });
        }
      }

      // Parse payload
      const event = JSON.parse(payload);
      const type  = event?.data?.attributes?.type;
      const nested = event?.data?.attributes?.data;
      const attrs = nested?.attributes;

      console.log('[Webhook Debug] type:', type);

      // 1. Handle Successful Payments
      if (type === 'payment.paid' || type === 'link.payment.paid') {
        const linkId = type === 'link.payment.paid'
          ? nested?.id
          : (attrs?.source?.type === 'link' ? attrs?.source?.id : undefined);

        const referenceNumber = attrs?.reference_number;
        const paymentId = type === 'payment.paid'
          ? nested?.id
          : attrs?.payments?.[0]?.data?.id || '';

        const lookupValue = linkId || referenceNumber;

        if (lookupValue) {
          const order = await ShopOrder.findOne({
            $or: [
              { paymongoLinkId: lookupValue },
              { orderNumber: lookupValue },
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
          } else if (!order) {
            console.warn(`[Webhook Warning] No matching order found for: ${lookupValue}`);
          }
        }
      }

      // 2. Handle Failed Payments (Separate block)
      if (type === 'payment.failed') {
        const paymentId = nested?.id;
        const linkId = attrs?.source?.type === 'link' ? attrs?.source?.id : undefined;
        const referenceNumber = attrs?.reference_number;
        const lookupValue = linkId || referenceNumber || paymentId;

        if (lookupValue) {
          const order = await ShopOrder.findOne({
            $or: [
              { paymongoLinkId: lookupValue },
              { orderNumber: lookupValue },
              { paymongoPaymentId: lookupValue },
            ],
          });

          if (order && order.payment === 'unpaid') {
            order.payment = 'failed';
            order.status = 'cancelled';
            order.statusHistory.push({
              status: 'cancelled',
              note: 'Payment failed via PayMongo',
              changedAt: new Date(),
              changedBy: 'PayMongo',
            });
            await order.save();
            console.log(`[Webhook] Payment failed for order ${order.orderNumber}`);
          }
        }
      }

      // Always return 200 OK to PayMongo so they don't retry sending the event
      res.json({ received: true });
    } catch (err) {
      console.error('[Webhook Error]:', err.message);
      res.status(400).json({ message: err.message });
    }
  }
);

module.exports = router;