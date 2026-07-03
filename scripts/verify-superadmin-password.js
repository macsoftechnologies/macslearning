require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  const superAdminId = process.env.SUPER_ADMIN_ID;
  const password = process.argv[2];

  if (!mongoUri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }
  if (!superAdminId) {
    console.error('Missing SUPER_ADMIN_ID in .env');
    process.exit(1);
  }
  if (!password) {
    console.error('Usage: node scripts/verify-superadmin-password.js <password>');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
  const user = await User.findById(superAdminId).select('+passwordHash').exec();

  if (!user) {
    console.error(`Super Admin user not found: ${superAdminId}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const storedHash = user.passwordHash;
  const matches = await bcrypt.compare(password, storedHash);

  console.log(`User: ${user.email}`);
  console.log(`Super Admin ID: ${superAdminId}`);
  console.log(`Password match: ${matches}`);
  if (!matches) {
    console.log('Stored hash:', storedHash);
  }

  await mongoose.disconnect();
  process.exit(matches ? 0 : 1);
}

run().catch(err => {
  console.error('Failed to verify Super Admin password:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});