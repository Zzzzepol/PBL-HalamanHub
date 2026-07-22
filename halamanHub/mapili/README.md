# Mapili Plant Nursery — Customer Shop

A modern, mobile-friendly online ordering system for Mapili Plant Nursery. Built with React and Tailwind CSS, connected to the HalamanHub backend (MongoDB + Express).

## Tech stack

- React 18 (Create React App)
- React Router v6
- Tailwind CSS 3
- Tabler Icons (via CDN)
- PayMongo (sandbox payment)
- Nodemailer (order confirmation emails — configured on backend)

## Features

- 🌿 Product catalog with search and category filters
- 🛒 Persistent shopping cart (saved to localStorage)
- 🚚 Delivery or farm pickup at checkout
- 💳 PayMongo sandbox payment (GCash, Maya, cards, online banking)
- 📧 Order confirmation email sent automatically
- 👤 Customer account (register, login, profile, change password)
- 📦 Order history with status timeline
- 🔄 Reorder from past orders
- 📱 Fully responsive — mobile, tablet, desktop

## Logo

To replace the logo with your own:

1. Put your logo image in `/public/` (e.g. `public/logo.png`)
2. Open `src/components/layout/Navbar.jsx`
3. Find the `Logo` component at the top
4. Replace the `<div>` with: `<img src="/logo.png" className="h-10" alt="Mapili Plant Nursery" />`

Do the same in `src/components/layout/Footer.jsx`.

## Getting started

### Prerequisites
- Node.js 18+
- The HalamanHub backend (server/) must be running on port 4000
- MongoDB connected with products seeded

### 1. Install dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Set up environment
```bash
cp .env.example .env
```
Edit `.env` if your backend runs on a different port.

### 3. Start the shop
```bash
npm start
```
Opens at `http://localhost:3001`

---

## Backend setup (add to HalamanHub server)

See `halamanHub/server/SHOP_SETUP.md` for step-by-step instructions to add the shop routes to the existing backend.

Summary of what to add to `server/index.js`:
```javascript
// Requires
const shopAuthRoutes    = require('./routes/shop/auth').router;
const shopProductRoutes = require('./routes/shop/products');
const shopOrderRoutes   = require('./routes/shop/orders');
const shopPaymentRoutes = require('./routes/shop/payment');

// CORS (update to allow both frontends)
const SHOP_ORIGIN = process.env.SHOP_ORIGIN || 'http://localhost:3001';
app.use(cors({ origin: [CLIENT_ORIGIN, SHOP_ORIGIN] }));

// Routes
app.use('/api/shop/auth',     shopAuthRoutes);
app.use('/api/shop/products', shopProductRoutes);
app.use('/api/shop/orders',   shopOrderRoutes);
app.use('/api/shop/payment',  shopPaymentRoutes);
```

Then install nodemailer in server:
```bash
cd ../halamanHub/server
npm install nodemailer
```

---

## PayMongo setup

1. Create a free account at [dashboard.paymongo.com](https://dashboard.paymongo.com)
2. Go to **Developers** → copy your **test** secret key (`sk_test_...`) and public key (`pk_test_...`)
3. Add to `halamanHub/server/.env`:
```env
PAYMONGO_SECRET_KEY=sk_test_xxxxxxxxxxxx
PAYMONGO_PUBLIC_KEY=pk_test_xxxxxxxxxxxx
```
4. For webhooks (to automatically mark orders as paid):
   - Go to **Webhooks** → Add endpoint: `https://your-server.com/api/shop/payment/webhook`
   - Select events: `payment.paid`, `link.payment.paid`
   - Copy the webhook secret → add as `PAYMONGO_WEBHOOK_SECRET`

**Sandbox test cards:**
- Card number: `4343434343434345`
- Expiry: any future date
- CVV: any 3 digits

**GCash sandbox:** Use any valid phone number format.

---

## Email setup (Gmail)

1. Enable 2-Step Verification on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password for "Mail"
4. Add to `halamanHub/server/.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

Email is optional — if not configured, orders still work, just no confirmation email is sent.

---

## Running both apps together

Terminal 1 — Backend:
```bash
cd halamanHub/server
npm start
```

Terminal 2 — Admin dashboard:
```bash
cd halamanHub
npm start
# runs on http://localhost:3000
```

Terminal 3 — Customer shop:
```bash
cd mapili
npm start
# runs on http://localhost:3001
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — hero, features, featured products |
| `/shop` | Product catalog with search and filters |
| `/shop/:id` | Product detail |
| `/cart` | Shopping cart |
| `/checkout` | Checkout — delivery/pickup, PayMongo payment |
| `/order-success/:id` | Order confirmation page |
| `/login` | Customer sign in |
| `/register` | Create customer account |
| `/account` | Profile and password management |
| `/account/orders` | Order history with reorder |
| `/about` | About the nursery |
