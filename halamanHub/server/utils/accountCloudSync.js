const User = require('../models/User');
const LocalUser = require('../models/LocalUser');
const { shopConnection, isShopConnected } = require('../config/connections');

const SYNC_INTERVAL_MS = 30 * 1000;
let timer = null;
let syncInProgress = false;

async function cacheAdminAccount(account) {
  const cachedAccount = account.toObject({ depopulate: true });
  const id = cachedAccount._id;
  delete cachedAccount._id;
  delete cachedAccount.__v;
  await LocalUser.updateOne({ _id: id }, { $set: cachedAccount }, { upsert: true });
}

async function removeCachedAdminAccount(id) {
  await LocalUser.deleteOne({ _id: id });
}

async function syncAdminAccounts() {
  if (syncInProgress || !isShopConnected() || shopConnection.readyState !== 1) return;
  syncInProgress = true;

  try {
    const accounts = await User.find().select('+passwordHash').lean();
    const cloudIds = accounts.map((account) => account._id);

    if (accounts.length) {
      const operations = accounts.map((account) => {
        const { __v, _id, ...cachedAccount } = account;
        return {
          updateOne: {
            filter: { _id: account._id },
            update: { $set: cachedAccount },
            upsert: true,
          },
        };
      });
      await LocalUser.bulkWrite(operations, { ordered: false });
    }

    // Cloud is authoritative for account creation, deactivation, and deletion.
    await LocalUser.deleteMany({ _id: { $nin: cloudIds } });
  } catch (error) {
    console.warn(`[Account sync] Local admin account cache will retry when the cloud database is available. ${error.message}`);
  } finally {
    syncInProgress = false;
  }
}

function startAccountCloudSync() {
  if (timer || shopConnection === LocalUser.db) return;
  syncAdminAccounts();
  timer = setInterval(syncAdminAccounts, SYNC_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { startAccountCloudSync, syncAdminAccounts, cacheAdminAccount, removeCachedAdminAccount };
