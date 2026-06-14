# HalamanHub — Smart Agriculture Admin Dashboard

A modern, responsive admin dashboard UI/UX for an IoT-based Smart Irrigation, Soil Monitoring, and Rainwater Harvesting System. Built with React, React Router, Chart.js, and Tailwind CSS, backed by an Express + MongoDB API with JWT authentication.

## Tech stack

- React 18 (Create React App)
- React Router v6
- Chart.js 4 + react-chartjs-2
- **Tailwind CSS 3** (utility-first styling, light theme only)
- Tabler Icons (via CDN)
- Express + MongoDB (Mongoose) + JWT (backend, `/server`)

## Login

Accounts are stored in MongoDB (passwords hashed with bcrypt), seeded via `npm run seed`. 
You can change these defaults in `server/.env` **before running the seed script**. The dashboard is fully protected — visiting any route while logged out redirects to `/login`.

## Prerequisites

- Node.js 18+
- MongoDB Atlas connection string

### Installing MongoDB locally

- **macOS (Homebrew):** `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- **Windows / Linux:** see [MongoDB's install docs](https://www.mongodb.com/docs/manual/administration/install-community/)
- **Or use MongoDB Atlas** (free cloud tier): create a cluster, get your connection string, and put it in `server/.env` as `MONGODB_URI`.

## Getting started

You need **two servers running**: the Express + MongoDB backend (port 4000) and the React frontend (port 3000).

### 1. Install dependencies (first time only)

```bash
# Frontend
npm install --legacy-peer-deps

# Backend
cd server
npm install
cd ..
```

### 2. Set up environment files

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Edit `server/.env` if needed:
- `MONGODB_URI` — defaults to `mongodb://localhost:27017/halamanhub`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used when seeding the admin account
- `JWT_SECRET` — change this for any real deployment

### 3. Seed the database

```bash
cd server
npm run seed
cd ..
```

This populates MongoDB with sample users, products, orders, sensors, irrigation zones/schedules, alerts, and default settings — matching everything shown in the UI. **Run this once** (or again any time you want to reset the data back to the demo defaults; it clears each collection first).

### 4. Run both servers

**Option A — one command (recommended):**
```bash
npm run dev
```
This uses `concurrently` to start both the backend (port 4000) and frontend (port 3000) together.

**Option B — two terminals:**
```bash
# Terminal 1
npm run server

# Terminal 2
npm start
```

The app opens at `http://localhost:3000` and redirects to `/login`. Sign in with the credentials above.

To build for production:

```bash
npm run build
```

