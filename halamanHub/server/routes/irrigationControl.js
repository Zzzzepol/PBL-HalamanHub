
const express = require('express');
const IrrigationSettings = require('../models/IrrigationSettings');

const router = express.Router();

// GET /api/irrigation/control
router.get('/', async (req, res) => {
  try {
    let settings = await IrrigationSettings.findOne();
    if (!settings) settings = await IrrigationSettings.create({});

    res.json({
      mode: settings.mode,
      moistureDryThreshold: settings.moistureDryThreshold,
      moistureWetThreshold: settings.moistureWetThreshold,
      manualPump: settings.manualPump,
      manualSolenoid: settings.manualSolenoid,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;