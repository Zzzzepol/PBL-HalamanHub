// ============================================================
// HalamanHub Server — Email service (nodemailer)
// Sends order confirmation emails to customers
// Configure SMTP in server/.env
// ============================================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Mapili Plant Nursery" <${process.env.SMTP_USER}>`;

// ── Order confirmation email
async function sendOrderConfirmation(order) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured — skipping order confirmation email.');
    return;
  }

  const itemsHtml = (order.items || []).map(i =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">×${i.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">₱${(i.price * i.qty).toFixed(2)}</td>
    </tr>`
  ).join('');

  const fulfillmentText = order.fulfillmentType === 'pickup'
    ? 'Farm pickup — Mapili Plant Nursery, Barangay Sta. Rosa, Laguna'
    : `Home delivery to: ${order.note?.replace(/Deliver to: /, '') || 'your address'}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#14532d,#166534);padding:32px 36px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
          🌿
        </div>
        <span style="color:white;font-size:18px;font-weight:700;">Mapili Plant Nursery</span>
      </div>
      <div style="color:#86efac;font-size:13px;">Fresh from our farm to your door</div>
    </div>

    <!-- Body -->
    <div style="padding:36px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
        Order confirmed! 🎉
      </h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
        Hi ${order.customer}, thank you for your order. We've received it and will start processing it shortly.
      </p>

      <!-- Order number badge -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:12px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Order number</div>
        <div style="font-size:20px;font-weight:700;color:#14532d;">${order.orderNumber}</div>
      </div>

      <!-- Items table -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Items ordered</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 0;text-align:left;font-weight:600;color:#6b7280;font-size:12px;">Item</th>
            <th style="padding:8px 0;text-align:center;font-weight:600;color:#6b7280;font-size:12px;">Qty</th>
            <th style="padding:8px 0;text-align:right;font-weight:600;color:#6b7280;font-size:12px;">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:12px 0 4px;font-size:13px;color:#6b7280;">Subtotal</td>
            <td style="padding:12px 0 4px;text-align:right;font-size:13px;color:#6b7280;">₱${(order.amount - order.shippingFee).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;font-size:13px;color:#6b7280;">${order.fulfillmentType === 'delivery' ? 'Delivery fee' : 'Pickup (free)'}</td>
            <td style="padding:4px 0;text-align:right;font-size:13px;color:#6b7280;">${order.shippingFee > 0 ? `₱${order.shippingFee.toFixed(2)}` : 'Free'}</td>
          </tr>
          <tr style="border-top:2px solid #f1f5f9;">
            <td colspan="2" style="padding:12px 0 0;font-size:16px;font-weight:700;color:#111827;">Total</td>
            <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;color:#166534;">₱${order.amount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Fulfillment info -->
      <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#4b5563;line-height:1.6;">
        <div style="font-weight:600;color:#374151;margin-bottom:4px;">
          ${order.fulfillmentType === 'pickup' ? '🏪 Farm pickup' : '🚚 Home delivery'}
        </div>
        ${fulfillmentText}
        ${order.note && !order.note.startsWith('Deliver') ? `<div style="margin-top:6px;color:#6b7280;"><em>Note: ${order.note}</em></div>` : ''}
      </div>

      <!-- Payment status -->
      <div style="background:${order.payment === 'paid' ? '#f0fdf4' : '#fffbeb'};border-radius:12px;padding:14px 20px;margin-bottom:28px;font-size:13px;">
        <span style="font-weight:600;color:${order.payment === 'paid' ? '#16a34a' : '#d97706'};">
          Payment: ${order.payment === 'paid' ? '✅ Paid' : '⏳ Pending payment'}
        </span>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3001'}/account/orders"
           style="display:inline-block;background:#166534;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:14px;">
          Track your order
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Mapili Plant Nursery · Barangay Sta. Rosa, Laguna, PH
      </p>
      <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">
        Questions? Reply to this email or visit our shop.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    FROM,
      to:      order.customerEmail,
      subject: `Order confirmed — ${order.orderNumber} | Mapili Plant Nursery`,
      html,
    });
    console.log(`[Email] Order confirmation sent to ${order.customerEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send order confirmation:', err.message);
  }
}

// ── Welcome / registration email
async function sendWelcomeEmail(customer) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#14532d,#166534);padding:32px 36px;text-align:center;">
      <div style="color:white;font-size:20px;font-weight:700;margin-bottom:4px;">🌿 Mapili Plant Nursery</div>
      <div style="color:#86efac;font-size:13px;">Welcome to our community!</div>
    </div>
    <div style="padding:36px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Hi ${customer.name}! 👋</h1>
      <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Welcome to Mapili Plant Nursery. Your account has been created successfully. 
        You can now browse our fresh, locally grown products and place orders for delivery or farm pickup.
      </p>
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3001'}/shop"
           style="display:inline-block;background:#166534;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:14px;">
          Start shopping
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Mapili Plant Nursery · Barangay Sta. Rosa, Laguna, PH</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    FROM,
      to:      customer.email,
      subject: `Welcome to Mapili Plant Nursery, ${customer.name}!`,
      html,
    });
    console.log(`[Email] Welcome email sent to ${customer.email}`);
  } catch (err) {
    console.error('[Email] Failed to send welcome email:', err.message);
  }
}

module.exports = { sendOrderConfirmation, sendWelcomeEmail };
