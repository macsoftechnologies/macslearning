require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  const superAdminId = process.env.SUPER_ADMIN_ID;
  const newPassword = process.argv[2] || 'Admin@1234';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  if (!mongoUri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }
  if (!superAdminId) {
    console.error('Missing SUPER_ADMIN_ID in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
  const user = await User.findById(superAdminId).exec();

  if (!user) {
    console.error(`Super Admin user not found: ${superAdminId}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, rounds);
  user.passwordHash = hash;
  await user.save();

  console.log(`Updated password for Super Admin user ${superAdminId}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Failed to update Super Admin password:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});