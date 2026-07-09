const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lms_db').then(async () => {
  const db = mongoose.connection;
  const notif = await db.collection('notifications').findOne({});
  console.log('Notification from DB:', JSON.stringify(notif, null, 2));
  process.exit(0);
});
