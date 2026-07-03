const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lms_db').then(async () => {
  try {
    const enrollments = await mongoose.connection.collection('enrollments').find({}).toArray();
    for (const enr of enrollments) {
      const update = {};
      if (typeof enr.studentId === 'string') update.studentId = new mongoose.Types.ObjectId(enr.studentId);
      if (typeof enr.organizationId === 'string') update.organizationId = new mongoose.Types.ObjectId(enr.organizationId);
      if (typeof enr.courseId === 'string') update.courseId = new mongoose.Types.ObjectId(enr.courseId);
      if (typeof enr.paymentId === 'string') update.paymentId = new mongoose.Types.ObjectId(enr.paymentId);
      if (typeof enr.createdBy === 'string') update.createdBy = new mongoose.Types.ObjectId(enr.createdBy);
      
      if (Object.keys(update).length > 0) {
        await mongoose.connection.collection('enrollments').updateOne({ _id: enr._id }, { $set: update });
        console.log('Updated enrollment', enr._id);
      }
    }
    console.log('Migration completed');
  } catch (err) {
    console.error('Error:', err.message);
  }
  mongoose.disconnect();
});
