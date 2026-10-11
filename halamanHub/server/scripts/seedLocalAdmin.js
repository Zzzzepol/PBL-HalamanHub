require('dotenv').config();
const connectDB = require('../config/db');
const { closeDBs } = require('../config/db');
const User = require('../models/User');
const Settings = require('../models/Settings');
const IrrigationSettings = require('../models/IrrigationSettings');

async function seedLocalAdmin() {
  await connectDB();

  const existingUser = await User.findOne();
  if (!existingUser) {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in server/.env, or copy your existing admin with npm run migrate:iot.');
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
    console.log('Created the local admin account from ADMIN_USERNAME/ADMIN_PASSWORD.');
  } else {
    console.log('A local admin account already exists; it was left unchanged.');
  }

  if (!(await Settings.findOne())) await Settings.create({});
  if (!(await IrrigationSettings.findOne())) await IrrigationSettings.create({});
  console.log('Local admin and irrigation settings are ready.');
}

seedLocalAdmin()
  .catch((err) => {
    console.error(`Local setup failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closeDBs);
