require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // TAMBAHKAN PORT (Aiven pakai 16512)
  port: process.env.DB_PORT || 16512,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // WAJIB: Tambahkan SSL agar Aiven mau menerima koneksi
  ssl: {
    rejectUnauthorized: false
  }
});
pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err);
});

// Wrapper to automatically retry failed queries due to dropped connections
const originalExecute = pool.execute.bind(pool);
const originalQuery = pool.query.bind(pool);

pool.execute = async (...args) => {
  try {
    return await originalExecute(...args);
  } catch (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.warn('Database connection lost. Retrying execute...');
      return await originalExecute(...args);
    }
    throw err;
  }
};

pool.query = async (...args) => {
  try {
    return await originalQuery(...args);
  } catch (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.warn('Database connection lost. Retrying query...');
      return await originalQuery(...args);
    }
    throw err;
  }
};

module.exports = pool;