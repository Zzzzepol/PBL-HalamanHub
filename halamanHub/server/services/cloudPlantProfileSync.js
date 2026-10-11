const PlantProfile = require('../models/PlantProfile');
const CloudPlantProfile = require('../models/CloudPlantProfile');
const { isShopConnected } = require('../config/connections');
const { plantIdentityKey } = require('../utils/plantIdentity');

let syncInFlight = null;

function keyFor(profile) {
  return profile.plantKey || plantIdentityKey(profile.name, profile.category);
}

function cleanProfile(profile, plantKey) {
  return {
    name: profile.name,
    category: profile.category,
    plantKey,
    imageUrl: profile.imageUrl || '',
    soilTargets: profile.soilTargets || {},
  };
}

async function runSync() {
  if (!isShopConnected()) {
    return { available: false, imported: 0, exported: 0, alreadySaved: 0, duplicates: 0 };
  }

  const [localProfiles, cloudProfiles] = await Promise.all([
    PlantProfile.find().select('_id name category plantKey imageUrl soilTargets').lean(),
    CloudPlantProfile.find().select('_id name category plantKey imageUrl soilTargets').lean(),
  ]);

  const localByKey = new Map();
  const cloudByKey = new Map();
  let duplicates = 0;

  for (const profile of localProfiles) {
    const key = keyFor(profile);
    if (localByKey.has(key)) duplicates += 1;
    else localByKey.set(key, profile);
  }
  for (const profile of cloudProfiles) {
    const key = keyFor(profile);
    if (cloudByKey.has(key)) duplicates += 1;
    else cloudByKey.set(key, profile);
  }

  const alreadySaved = [...localByKey.keys()].filter((key) => cloudByKey.has(key)).length;
  let imported = 0;
  let exported = 0;

  // Cloud to laptop: only add plants missing from local monitoring. Existing
  // local soil targets are never replaced.
  for (const [key, profile] of cloudByKey) {
    if (localByKey.has(key)) continue;
    try {
      const created = await PlantProfile.create(cleanProfile(profile, key));
      localByKey.set(key, created.toObject());
      imported += 1;
    } catch (error) {
      if (error.code === 11000) duplicates += 1;
      else throw error;
    }
  }

  // Laptop to cloud: write only into cloudplantprofiles. Matching cloud
  // plants are already saved there and remain unchanged.
  for (const [key, profile] of localByKey) {
    if (cloudByKey.has(key)) continue;
    try {
      const created = await CloudPlantProfile.create(cleanProfile(profile, key));
      cloudByKey.set(key, created.toObject());
      exported += 1;
    } catch (error) {
      if (error.code === 11000) duplicates += 1;
      else throw error;
    }
  }

  return { available: true, imported, exported, alreadySaved, duplicates };
}

function syncPlantProfilesBothWays() {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => { syncInFlight = null; });
  }
  return syncInFlight;
}

module.exports = { syncPlantProfilesBothWays };
