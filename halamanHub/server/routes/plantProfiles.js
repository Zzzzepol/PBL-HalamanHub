const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const PlantProfile = require('../models/PlantProfile');
const Product = require('../models/Product');
const MonitoringStation = require('../models/MonitoringStation');
const MonitoringPlot = require('../models/MonitoringPlot');
const { isShopConnected } = require('../config/connections');
const { syncLinkedPlantProfilesFromShop } = require('../services/plantProfileSync');
const { syncPlantProfilesBothWays } = require('../services/cloudPlantProfileSync');
const { plantIdentityKey } = require('../utils/plantIdentity');
const { setMonitoringStation } = require('../utils/monitoringStationState');
const { ensureMonitoringPlots, addAssignment } = require('../utils/monitoringPlots');

const router = express.Router();
router.use(requireAuth);

async function refreshStationPlantNames() {
  const { station, active } = await ensureMonitoringPlots();
  const profiles = active.plantProfileIds?.length
    ? await PlantProfile.find({ _id: { $in: active.plantProfileIds } }).select('name').sort({ name: 1 }).lean()
    : [];
  setMonitoringStation(station, profiles);
  await addAssignment(active);
}

function numericTarget(value, label) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function normalizeSoilTargets(input = {}) {
  return {
    useDefault: input.useDefault === undefined ? true : Boolean(input.useDefault),
    npk: {
      nitrogen: numericTarget(input.npk?.nitrogen, 'Nitrogen target'),
      phosphorus: numericTarget(input.npk?.phosphorus, 'Phosphorus target'),
      potassium: numericTarget(input.npk?.potassium, 'Potassium target'),
    },
    ec: numericTarget(input.ec, 'Soil salt target'),
    ph: numericTarget(input.ph, 'Soil acidity target'),
  };
}

function profileFields(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Enter a plant name.');
  if (name.length > 120) throw new Error('Plant names must be 120 characters or fewer.');
  const category = String(body.category || 'Grafted Fruit Bearing Trees').trim().slice(0, 80) || 'Grafted Fruit Bearing Trees';
  return {
    name,
    category,
    plantKey: plantIdentityKey(name, category),
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : '',
    soilTargets: normalizeSoilTargets(body.soilTargets),
  };
}

async function findDuplicateProfile(fields, excludeId) {
  const query = excludeId ? { _id: { $ne: excludeId } } : {};
  const profiles = await PlantProfile.find(query).select('_id name category plantKey sourceProductId').lean();
  return profiles.find((profile) => (profile.plantKey || plantIdentityKey(profile.name, profile.category)) === fields.plantKey) || null;
}

// Plant profiles are stored locally. Reading this list never waits on the
// cloud shop database; cloud syncing is an explicit action.
router.get('/', async (req, res) => {
  try {
    const profiles = await PlantProfile.find().sort({ name: 1 }).lean();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'We could not load your local plant profiles.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = profileFields(req.body);
    if (await findDuplicateProfile(fields)) return res.status(409).json({ message: 'A plant with this name and category is already saved.' });
    const profile = await PlantProfile.create(fields);
    res.status(201).json(profile);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'A plant with this name and category is already saved.' : error.message || 'We could not save this plant profile.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Choose a valid plant profile.' });
    const update = profileFields(req.body);
    if (await findDuplicateProfile(update, req.params.id)) return res.status(409).json({ message: 'A plant with this name and category is already saved.' });
    const options = { new: true, runValidators: true };
    const profile = await PlantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: {
        ...update,
        shopSyncEnabled: Boolean(req.body.keepShopLink),
        ...(req.body.keepShopLink === false ? { lastShopSyncAt: null } : {}),
      } },
      options
    );
    if (!profile) return res.status(404).json({ message: 'Plant profile not found.' });
    await refreshStationPlantNames();
    res.json(profile);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'A plant with this name and category is already saved.' : error.message || 'We could not save this plant profile.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Choose a valid plant profile.' });
    const profile = await PlantProfile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Plant profile not found.' });
    await MonitoringPlot.updateMany({}, { $pull: { plantProfileIds: profile._id } });
    await MonitoringStation.updateOne({ key: 'main' }, { $pull: { plantProfileIds: profile._id } });
    await refreshStationPlantNames();
    res.json({ message: 'Plant profile removed.', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'We could not remove this plant profile.' });
  }
});

router.post('/import-shop/:productId', async (req, res) => {
  if (!isShopConnected()) return res.status(503).json({ message: 'Connect to the shop database to copy a plant.' });
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) return res.status(400).json({ message: 'Choose a valid shop product.' });
    const product = await Product.findById(req.params.productId).select('name category imageUrl');
    if (!product) return res.status(404).json({ message: 'Shop product not found.' });
    const sourceProductId = String(product._id);
    const fields = {
      name: product.name,
      category: product.category,
      plantKey: plantIdentityKey(product.name, product.category),
      imageUrl: product.imageUrl || '',
      shopSyncEnabled: true,
      lastShopSyncAt: new Date(),
    };

    let profile = await PlantProfile.findOne({ sourceProductId });
    if (profile) {
      const duplicate = await findDuplicateProfile(fields, profile._id);
      if (duplicate) return res.status(409).json({ message: 'A plant with this name and category is already saved.' });
      profile.set(fields);
      await profile.save();
      await refreshStationPlantNames();
      return res.json(profile);
    }

    profile = await findDuplicateProfile(fields);
    if (profile) {
      if (profile.sourceProductId && profile.sourceProductId !== sourceProductId) {
        return res.status(409).json({ message: 'This plant is already linked to another shop product.' });
      }
      profile.set({ ...fields, sourceProductId });
      await profile.save();
      await refreshStationPlantNames();
      return res.json(profile);
    }

    profile = await PlantProfile.create({ ...fields, sourceProductId });
    await refreshStationPlantNames();
    res.status(201).json(profile);
  } catch (error) {
    res.status(400).json({ message: 'We could not copy this shop plant. Please try again.' });
  }
});

router.post('/sync-shop', async (req, res) => {
  if (!isShopConnected()) return res.status(503).json({ message: 'The shop is offline. Your local plant profiles are still available.' });
  try {
    const result = await syncLinkedPlantProfilesFromShop();
    await refreshStationPlantNames();
    res.json(result);
  } catch (error) {
    res.status(503).json({ message: 'We could not sync shop plant details right now. Your local plant profiles are still available.' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const profiles = await syncPlantProfilesBothWays();
    const shop = isShopConnected()
      ? await syncLinkedPlantProfilesFromShop()
      : { available: false, updated: 0, unchanged: 0, missing: 0, duplicates: 0 };
    await refreshStationPlantNames();
    res.json({ profiles, shop });
  } catch (error) {
    console.warn(`[Plant profiles] Cloud sync skipped: ${error.message}`);
    res.status(503).json({ message: 'Cloud plant profiles are unavailable. Your local profiles are still saved.' });
  }
});

module.exports = router;
