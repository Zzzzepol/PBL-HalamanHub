const PlantProfile = require('../models/PlantProfile');
const Product = require('../models/Product');
const { isShopConnected } = require('../config/connections');
const { plantIdentityKey } = require('../utils/plantIdentity');

let syncInFlight = null;

async function runSync() {
  if (!isShopConnected()) return { available: false, updated: 0, unchanged: 0, missing: 0, duplicates: 0 };

  const linkedProfiles = await PlantProfile.find({ sourceProductId: { $exists: true, $ne: '' }, shopSyncEnabled: true })
    .select('_id sourceProductId name category plantKey')
    .lean();
  if (!linkedProfiles.length) return { available: true, updated: 0, unchanged: 0, missing: 0, duplicates: 0 };

  const productIds = linkedProfiles.map((profile) => profile.sourceProductId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name category imageUrl')
    .lean();
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const allProfiles = await PlantProfile.find().select('_id name category plantKey').lean();
  const keyOwners = new Map(allProfiles.map((profile) => [
    profile.plantKey || plantIdentityKey(profile.name, profile.category),
    String(profile._id),
  ]));

  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let duplicates = 0;
  const syncedAt = new Date();

  for (const profile of linkedProfiles) {
    const product = productsById.get(profile.sourceProductId);
    if (!product) {
      missing += 1;
      continue;
    }

    const nextKey = plantIdentityKey(product.name, product.category);
    const currentKey = profile.plantKey || plantIdentityKey(profile.name, profile.category);
    const owner = keyOwners.get(nextKey);
    if (owner && owner !== String(profile._id)) {
      duplicates += 1;
      continue;
    }

    const nextImageUrl = product.imageUrl || '';
    const hasChanged = profile.name !== product.name
      || profile.category !== product.category
      || profile.imageUrl !== nextImageUrl
      || currentKey !== nextKey;
    if (!hasChanged) {
      unchanged += 1;
      continue;
    }

    await PlantProfile.updateOne(
      { _id: profile._id },
      { $set: {
        name: product.name,
        category: product.category,
        plantKey: nextKey,
        imageUrl: nextImageUrl,
        lastShopSyncAt: syncedAt,
      } }
    );
    if (currentKey !== nextKey) keyOwners.delete(currentKey);
    keyOwners.set(nextKey, String(profile._id));
    updated += 1;
  }

  return { available: true, updated, unchanged, missing, duplicates };
}

function syncLinkedPlantProfilesFromShop() {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => { syncInFlight = null; });
  }
  return syncInFlight;
}

module.exports = { syncLinkedPlantProfilesFromShop };
