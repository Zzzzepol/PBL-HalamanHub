const express = require('express');
const { requireAuth } = require('../middleware/auth');
const IrrigationZone = require('../models/IrrigationZone');
const IrrigationSchedule = require('../models/IrrigationSchedule');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// ---- Zones ----

// GET /api/irrigation/zones
router.get('/zones', async (req, res) => {
  try {
    const zones = await IrrigationZone.find().sort({ zoneId: 1 });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/irrigation/zones/:zoneId/toggle
router.patch('/zones/:zoneId/toggle', async (req, res) => {
  try {
    const zone = await IrrigationZone.findOne({ zoneId: req.params.zoneId });
    if (!zone) return res.status(404).json({ message: 'Zone not found.' });

    // ← Save the OLD status BEFORE changing it
    const wasActive = zone.status === 'active';

    if (wasActive) {
      zone.status = 'idle';
      zone.lastRunAt = new Date();
      zone.lastRunSummary = `Manually stopped at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      zone.status = 'active';
      zone.lastRunSummary = `Running since ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · 0 min elapsed`;
    }

    await zone.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `${wasActive ? 'Stopped' : 'Started'} irrigation for ${zone.name}`,
      category: 'irrigation',
    });

    res.json(zone);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- Schedules ----

// GET /api/irrigation/schedules
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await IrrigationSchedule.find().sort({ createdAt: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/irrigation/schedules
router.post('/schedules', async (req, res) => {
  try {
    const { time, zone, frequency, status, duration } = req.body;
    if (!time || !zone || !frequency || !duration) {
      return res.status(400).json({ message: 'time, zone, frequency, and duration are required.' });
    }
    const schedule = await IrrigationSchedule.create({ time, zone, frequency, status, duration });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Added irrigation schedule for ${zone} at ${time}`,
      category: 'irrigation',
    });

    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/irrigation/schedules/:id
router.put('/schedules/:id', async (req, res) => {
  try {
    const { time, zone, frequency, status, duration } = req.body;
    const schedule = await IrrigationSchedule.findByIdAndUpdate(
      req.params.id,
      { time, zone, frequency, status, duration },
      { new: true, runValidators: true }
    );
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Updated irrigation schedule for ${schedule.zone} at ${schedule.time}`,
      category: 'irrigation',
    });

    res.json(schedule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/irrigation/schedules/:id
router.delete('/schedules/:id', async (req, res) => {
  try {
    const schedule = await IrrigationSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });


    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Deleted irrigation schedule for ${schedule.zone} at ${schedule.time}`,
      category: 'irrigation',
    });

    res.json({ message: 'Schedule deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;