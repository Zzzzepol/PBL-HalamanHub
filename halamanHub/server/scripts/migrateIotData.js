require('dotenv').config();
const mongoose = require('mongoose');

const sourceUri = process.env.SHOP_MONGODB_URI || process.env.MONGODB_URI;
const destinationUri = process.env.IOT_MONGODB_URI;
const collectionsToCopy = [
  'users',
  'settings',
  'alerts',
  'activitylogs',
  'sensors',
  'sensorreadings',
  'irrigationsettings',
  'irrigationlogs',
  'irrigationzones',
  'irrigationschedules',
];

async function copyCollection(sourceDb, destinationDb, collectionName) {
  const exists = await sourceDb.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
  if (!exists) return 0;

  const cursor = sourceDb.collection(collectionName).find({}, { batchSize: 500 });
  let copiedOrFound = 0;
  let batch = [];

  async function writeBatch() {
    if (batch.length === 0) return;
    const operations = batch.map((document) => ({
      updateOne: {
        filter: { _id: document._id },
        update: { $setOnInsert: document },
        upsert: true,
      },
    }));
    const result = await destinationDb.collection(collectionName).bulkWrite(operations, { ordered: false });
    copiedOrFound += result.upsertedCount;
    batch = [];
  }

  while (await cursor.hasNext()) {
    batch.push(await cursor.next());
    if (batch.length >= 500) await writeBatch();
  }
  await writeBatch();
  await cursor.close();
  return copiedOrFound;
}

async function migrate() {
  if (!sourceUri) throw new Error('Set SHOP_MONGODB_URI or the existing MONGODB_URI as the source database.');
  if (!destinationUri) throw new Error('Set IOT_MONGODB_URI to the laptop MongoDB as the destination.');
  if (sourceUri === destinationUri) {
    console.log('Source and destination are the same URI; no migration was needed.');
    return;
  }

  const options = { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 };
  const source = mongoose.createConnection();
  const destination = mongoose.createConnection();

  try {
    await source.openUri(sourceUri, options);
    await destination.openUri(destinationUri, options);
    console.log('Copying plant and admin collections. Existing local records will be kept.');
    for (const collectionName of collectionsToCopy) {
      const count = await copyCollection(source.db, destination.db, collectionName);
      console.log(`${collectionName}: ${count} new records copied`);
    }
    console.log('Migration finished. Source records were not changed or deleted.');
  } finally {
    await Promise.all([source.close(), destination.close()]);
  }
}

migrate().catch((err) => {
  console.error(`Migration stopped: ${err.message}`);
  process.exitCode = 1;
});
