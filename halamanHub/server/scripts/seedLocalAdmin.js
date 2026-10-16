require('dotenv').config();
const connectDB = require('../config/db');
const { closeDBs, connectShopDatabase } = require('../config/db');
const { isShopConnected } = require('../config/connections');
const User = require('../models/User');
const Settings = require('../models/Settings');
const IrrigationSettings = require('../models/IrrigationSettings');

async function seedCloudAdmin() {
  await connectDB();
  await connectShopDatabase();
  if (!isShopConnected()) throw new Error('The cloud application database is unavailable. Check SHOP_MONGODB_URI or MONGODB_URI and Atlas network access.');

  const existingUser = await User.findOne();
  if (!existingUser) {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in server/.env to create a cloud admin account.');
    }

    const user = new User({
      name: 'Admin',
      email: `${ADMIN_USERNAME}@halamanhub.ph`,
      username: ADMIN_USERNAME,
      role: 'admin',
      status: 'active',
      initials: 'AD',
      color: '#1a6b3a',
    });
    await user.setPassword(ADMIN_PASSWORD);
    await user.save();
    console.log('Created the cloud admin account from ADMIN_USERNAME/ADMIN_PASSWORD.');
  } else {
    console.log('A cloud admin account already exists; it was left unchanged.');
  }

  if (!(await Settings.findOne())) await Settings.create({});
  if (!(await IrrigationSettings.findOne())) await IrrigationSettings.create({});
  console.log('Cloud admin and irrigation settings are ready.');
}

seedCloudAdmin()
  .catch((err) => {
    console.error(`Cloud admin setup failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closeDBs);
