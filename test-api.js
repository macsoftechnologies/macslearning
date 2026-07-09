const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({
  userId: '6a4c9e614f60d8de4cd33f6f',
  organizationId: '6a4c9e604f60d8de4cd33f6e',
  userType: 'ORG_USER'
}, 'change_this_access_secret_xyz123', { expiresIn: '1h' });

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/v1/notifications',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', e => console.error(e));
req.end();
