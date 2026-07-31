require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const mongoUri = process.env.MONGODB_URI;
  const superAdminId = process.env.SUPER_ADMIN_ID;

  if (!mongoUri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  if (!superAdminId) {
    console.error('Missing SUPER_ADMIN_ID');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
  const user = await User.findById(superAdminId).lean();
  console.log('passwordHash:', user ? user.passwordHash : 'user not found');
  console.log('typeof:', typeof (user ? user.passwordHash : undefined));
  if (user) {
    console.log('startsWith $2:', typeof user.passwordHash === 'string' && user.passwordHash.startsWith('$2'));
  }
  await mongoose.disconnect();
  process.exit(0);
})();