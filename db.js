require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // TAMBAHKAN PORT (Aiven pakai 25060)
  port: process.env.DB_PORT || 16512,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // WAJIB: Tambahkan SSL agar Aiven mau menerima koneksi
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;