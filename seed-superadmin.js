const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function seed() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'for_lms'
  });

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('12341234', salt);

  console.log('Checking if superadmin already exists...');
  const [rows] = await connection.execute('SELECT id FROM users WHERE email = ?', ['superadmin@lms.com']);
  
  if (rows.length > 0) {
    console.log('Superadmin already exists. Updating password...');
    await connection.execute('UPDATE users SET passwordHash = ? WHERE email = ?', [passwordHash, 'superadmin@lms.com']);
  } else {
    console.log('Inserting superadmin...');
    const query = `
      INSERT INTO users (id, email, passwordHash, fullName, userType, status, isDeleted, createdAt, updatedAt)
      VALUES (UUID(), 'superadmin@lms.com', ?, 'Super Admin', 'SUPER_ADMIN', 'ACTIVE', false, NOW(), NOW())
    `;
    await connection.execute(query, [passwordHash]);
  }

  console.log('Super admin seeded successfully.');
  await connection.end();
}

seed().catch(err => {
  console.error('Error seeding superadmin:', err);
  process.exit(1);
});
