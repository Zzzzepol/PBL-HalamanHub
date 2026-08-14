const express   = require('express');
const PDFDocument = require('pdfkit');
const ShopOrder = require('../../models/ShopOrder');
const Product   = require('../../models/Product');
const { requireCustomer } = require('./auth');
const { sendOrderConfirmation } = require('../../utils/email');
const { validateStockForItems } = require('../../utils/stock');
const { createAlertIfEnabled } = require('../../utils/alerts');

const router = express.Router();

router.post('/validate-stock', async (req, res) => {
  try {
    const { items } = req.body;
    const result = await validateStockForItems(items || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

// GET /api/shop/orders/:id/receipt — downloadable/viewable PDF e-receipt
router.get('/:id/receipt', async (req, res) => {
  try {
    const order = await ShopOrder.findOne({
      _id:        req.params.id,
      customerId: req.customer.id,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${order.orderNumber}.pdf"`);
    doc.pipe(res);

    const PAGE_WIDTH = doc.page.width;
    const MARGIN = 40;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
    const BRAND = '#15803d';
    const BRAND_DARK = '#166534';
    const GRAY = '#6b7280';
    const LIGHT_ROW = '#f0fdf4';

    //Header banner
    doc.rect(0, 0, PAGE_WIDTH, 110).fill(BRAND);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('Mapili Plant Nursery', MARGIN, 34);
    doc.font('Helvetica').fontSize(10).fillColor('#dcfce7')
      .text('Talisay, Batangas, Philippines', MARGIN, 64);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
      .text('E-RECEIPT', PAGE_WIDTH - MARGIN - 150, 34, { width: 150, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor('#dcfce7')
      .text(order.orderNumber, PAGE_WIDTH - MARGIN - 150, 52, { width: 150, align: 'right' });

    // ── Order info block ───────────────────────────────────────────
    let y = 140;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text('BILLED TO', MARGIN, y);
    doc.font('Helvetica-Bold').fontSize(10).text('ORDER INFO', MARGIN + CONTENT_WIDTH / 2, y);
    y += 16;

    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    doc.text(order.customer, MARGIN, y, { width: CONTENT_WIDTH / 2 - 10 });
    doc.text(`Date: ${new Date(order.orderDate || order.createdAt).toLocaleString('en-PH')}`, MARGIN + CONTENT_WIDTH / 2, y, { width: CONTENT_WIDTH / 2 });
    y += 14;
    doc.text(order.customerEmail, MARGIN, y, { width: CONTENT_WIDTH / 2 - 10 });
    doc.text(`Fulfillment: ${order.fulfillmentType || 'delivery'}`, MARGIN + CONTENT_WIDTH / 2, y, { width: CONTENT_WIDTH / 2 });
    y += 14;
    if (order.customerPhone) {
      doc.text(order.customerPhone, MARGIN, y, { width: CONTENT_WIDTH / 2 - 10 });
    }
    const paymentColor = order.payment === 'paid' ? BRAND : '#b91c1c';
    doc.fillColor(paymentColor).font('Helvetica-Bold')
      .text(`Payment: ${order.payment.toUpperCase()}`, MARGIN + CONTENT_WIDTH / 2, y, { width: CONTENT_WIDTH / 2 });
    y += 28;

    //Items table header
    const col = { item: MARGIN, qty: MARGIN + 260, price: MARGIN + 330, total: MARGIN + 420 };
    doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(BRAND_DARK);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('ITEM', col.item + 10, y + 7);
    doc.text('QTY', col.qty, y + 7, { width: 50, align: 'right' });
    doc.text('PRICE', col.price, y + 7, { width: 70, align: 'right' });
    doc.text('SUBTOTAL', col.total, y + 7, { width: CONTENT_WIDTH - (col.total - MARGIN) - 10, align: 'right' });
    y += 24;

    // ── Items rows ────────────────────────────────────────────────
    (order.items || []).forEach((item, idx) => {
      const rowHeight = 22;
      if (idx % 2 === 0) {
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(LIGHT_ROW);
      }
      doc.fillColor('#111827').font('Helvetica').fontSize(9);
      doc.text(item.name, col.item + 10, y + 6, { width: col.qty - col.item - 15 });
      doc.text(`${item.qty} ${item.unit || ''}`, col.qty, y + 6, { width: 50, align: 'right' });
      doc.text(`PHP ${Number(item.price).toFixed(2)}`, col.price, y + 6, { width: 70, align: 'right' });
      doc.font('Helvetica-Bold').text(
        `PHP ${(item.price * item.qty).toFixed(2)}`,
        col.total, y + 6, { width: CONTENT_WIDTH - (col.total - MARGIN) - 10, align: 'right' }
      );
      y += rowHeight;
    });

    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 16;

    //Totals
    const totalsX = PAGE_WIDTH - MARGIN - 220;
    const subtotal = order.amount - (order.shippingFee || 0);

    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    doc.text('Subtotal', totalsX, y, { width: 130 });
    doc.text(`PHP ${subtotal.toFixed(2)}`, totalsX + 130, y, { width: 90, align: 'right' });
    y += 16;

    if (order.shippingFee) {
      doc.text('Shipping fee', totalsX, y, { width: 130 });
      doc.text(`PHP ${order.shippingFee.toFixed(2)}`, totalsX + 130, y, { width: 90, align: 'right' });
      y += 16;
    }

    doc.moveTo(totalsX, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#d1d5db').lineWidth(1).stroke();
    y += 10;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_DARK);
    doc.text('Total Paid', totalsX, y, { width: 130 });
    doc.text(`PHP ${order.amount.toFixed(2)}`, totalsX + 130, y, { width: 90, align: 'right' });

    // ── Footer ────────────────────────────────────────────────────
    const footerY = doc.page.height - 90;
    doc.moveTo(MARGIN, footerY).lineTo(PAGE_WIDTH - MARGIN, footerY).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND)
      .text('Thank you for shopping with HalamanHub!', MARGIN, footerY + 14, { width: CONTENT_WIDTH, align: 'center' });

    doc.end();
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

    // Do not send a confirmation email until payment is actually marked as paid.
    // Payment confirmation is triggered only after a successful PayMongo webhook.

    await createAlertIfEnabled('orders', {
      type: 'ok',
      icon: 'ti-shopping-cart',
      message: `New order ${order.orderNumber} placed by ${order.customer} (PHP ${order.amount}).`,
    });

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