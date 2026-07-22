// ============================================================
// HalamanHub Server — Shop products routes (public)
// /api/shop/products/*
// ============================================================
const express = require('express');
const Product = require('../../models/Product');

const router = express.Router();

// GET /api/shop/products — all in-stock and low-stock products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shop/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
