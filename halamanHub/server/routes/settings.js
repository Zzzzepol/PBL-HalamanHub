const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Settings = require('../models/Settings');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const settings = await Settings.getSingleton();

    const { farmName, location, timezone, thresholds, notifications, autoIrrigationEnabled, autoSwitchToMunicipal } = req.body;

    if (farmName !== undefined) settings.farmName = farmName;
    if (location !== undefined) settings.location = location;
    if (timezone !== undefined) settings.timezone = timezone;
    if (autoIrrigationEnabled !== undefined) settings.autoIrrigationEnabled = autoIrrigationEnabled;
    if (autoSwitchToMunicipal !== undefined) settings.autoSwitchToMunicipal = autoSwitchToMunicipal;

    if (thresholds) {
      settings.thresholds = { ...settings.thresholds.toObject(), ...thresholds };
    }
    if (notifications) {
      settings.notifications = { ...settings.notifications.toObject(), ...notifications };
    }

    await settings.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: 'Updated system settings',
      category: 'settings',
    });

    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;