const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { name, category, price, unit, stock, imageUrl } = req.body;
    if (!name || !category || price == null || stock == null) {
      return res.status(400).json({ message: 'name, category, price, and stock are required.' });
    }
    const product = await Product.create({ name, category, price, unit, stock, imageUrl });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Added product: ${product.name}`,
      category: 'products',
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, unit, stock, imageUrl } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, category, price, unit, stock, imageUrl },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Updated product: ${product.name}`,
      category: 'products',
    });

    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {  // ← ADDED try/catch
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Deleted product: ${product.name}`,
      category: 'products',
    });

    res.json({ message: 'Product deleted.', id: req.params.id });
  } catch (err) {  // ← ADDED
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;