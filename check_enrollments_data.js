const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'macslearn',
  });

  console.log('Connected to MySQL');

  // Check batches
  const [batches] = await connection.execute("SELECT id, name FROM academic_batches LIMIT 5");
  console.log('Sample Batches:', batches);

  // Check courses
  const [courses] = await connection.execute("SELECT id, title FROM courses WHERE title LIKE '%Synoptic%' LIMIT 5");
  console.log('Sample Courses:', courses);

  // Check enrollments
  const [enrollments] = await connection.execute("SELECT id, studentId, courseId, batchId, status FROM enrollments LIMIT 10");
  console.log('Sample Enrollments:', enrollments);

  // Check batch_students or student_batches or similar
  try {
    const [batchStudents] = await connection.execute("SELECT * FROM batch_students LIMIT 5");
    console.log('Sample batch_students:', batchStudents);
  } catch (e) {
    console.log('No batch_students table');
  }

  // Check course_batches or academic_batch_courses
  try {
    const [batchCourses] = await connection.execute("SELECT * FROM academic_batch_courses LIMIT 5");
    console.log('Sample academic_batch_courses:', batchCourses);
  } catch (e) {
    console.log('No academic_batch_courses table');
  }

  await connection.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
