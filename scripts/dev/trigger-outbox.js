const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("No CRON_SECRET found in environment variables.");
  process.exit(1);
}

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/cron/email-outbox',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + secret
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status: ' + res.statusCode);
    console.log('Response: ' + data);
    
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error('Email outbox processing failed with non-2xx status code.');
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Problem with request: ' + e.message);
  process.exit(1);
});

req.end();
