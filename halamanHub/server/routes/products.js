const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const PlantProfile = require('../models/PlantProfile');
const log = require('../utils/logger');
const { plantIdentityKey } = require('../utils/plantIdentity');

const router = express.Router();
router.use(requireAuth);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().select('+sourcePlantProfileId').sort({ createdAt: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a customer-facing shop listing from a saved local plant profile.
router.post('/from-plant-profile/:profileId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.profileId)) {
      return res.status(400).json({ message: 'Choose a valid plant profile.' });
    }

    const profile = await PlantProfile.findById(req.params.profileId).select('name category imageUrl').lean();
    if (!profile) return res.status(404).json({ message: 'Local plant profile not found.' });

    const sourcePlantProfileId = String(profile._id);
    const linkedProduct = await Product.findOne({ sourcePlantProfileId }).select('+sourcePlantProfileId');
    if (linkedProduct) return res.status(409).json({ message: 'This plant profile already has a shop product.' });

    const name = String(req.body.name || profile.name).trim();
    const category = String(req.body.category || profile.category).trim();
    const identityKey = plantIdentityKey(name, category);
    const products = await Product.find().select('name category').lean();
    const matchingProduct = products.find((product) => plantIdentityKey(product.name, product.category) === identityKey);
    if (matchingProduct) {
      return res.status(409).json({ message: 'A shop product with this name and category already exists.' });
    }

    if (req.body.price === '' || req.body.price == null || req.body.stock === '' || req.body.stock == null) {
      return res.status(400).json({ message: 'Enter a price and stock quantity.' });
    }

    const product = await Product.create({
      name,
      category,
      price: req.body.price,
      unit: req.body.unit,
      stock: req.body.stock,
      imageUrl: typeof req.body.imageUrl === 'string' ? req.body.imageUrl : profile.imageUrl || '',
      sourcePlantProfileId,
    });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Added product from plant profile: ${product.name}`,
      category: 'products',
    });

    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This plant profile already has a shop product.' });
    res.status(400).json({ message: err.message || 'We could not add this plant to the shop.' });
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
    ).select('+sourcePlantProfileId');
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
