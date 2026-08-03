const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'macslearn'
  });

  try {
    // Add the column if it doesn't exist
    await conn.query("ALTER TABLE courses ADD COLUMN programId varchar(255) NULL");
    console.log("Added programId column.");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("programId column already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  try {
    await conn.query("UPDATE courses SET programId = '962ae49e-8493-473f-a9df-b45986f9e839' WHERE title = 'Old Testament Theology'");
    console.log('Successfully linked Old Testament Theology to the M.Div Program.');
  } catch (e) {
    console.error("Error updating course:", e);
  }

  process.exit(0);
}

run();
