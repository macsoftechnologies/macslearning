const { MongoClient } = require('mongodb');

async function run() {
  const uri = 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('lms_db');
    
    const courses = await db.collection('courses').find({ categoryId: { $exists: true } }).toArray();
    if (courses.length > 0) {
      console.log('Course categoryId type:', typeof courses[0].categoryId, courses[0].categoryId?.constructor?.name, courses[0].categoryId);
    } else {
      console.log('No courses with categoryId found');
    }
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
