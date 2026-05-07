require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const rateLimit = require('express-rate-limit');

const app = express();

// ─── CORS ─────────────────────────────────────────────
const allowedOrigins = [
  'https://aflahalbj.github.io/digimiar, 
  'https://diecastindonesia.vercel.app',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://localhost:16512'
];
app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (misal: Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Tidak diizinkan oleh CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

const path = require('path');

app.use(express.static('public'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
});
app.use('/api/auth', authLimiter);

// ─── HELPER VALIDASI ──────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister({ name, email, password }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'Nama minimal 2 karakter.';
  }
  if (name.trim().length > 100) {
    return 'Nama terlalu panjang (maks 100 karakter).';
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return 'Format email tidak valid.';
  }
  if (!password || password.length < 6) {
    return 'Password minimal 6 karakter.';
  }
  if (password.length > 72) {
    return 'Password terlalu panjang (maks 72 karakter).';
  }
  return null;
}

function validateLogin({ email, password }) {
  if (!email || !EMAIL_REGEX.test(email)) {
    return 'Format email tidak valid.';
  }
  if (!password || password.length < 1) {
    return 'Password tidak boleh kosong.';
  }
  return null;
}


// ─── MIDDLEWARE AUTH ─────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Akses ditolak. Token tidak ada.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid.' });
    req.user = user;
    next();
  });
};

// ─── AUTH ROUTES ─────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validasi input
    const validationError = validateRegister({ name, email, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();

    // Cek email
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [trimmedName, normalizedEmail, hashedPassword]
    );

    res.status(201).json({ message: 'Registrasi berhasil!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validasi input
    const validationError = validateLogin({ email, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// ─── CART ROUTES ─────────────────────────────────────
// Get user's cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const [cartItems] = await db.execute('SELECT product_id as id, product_name as name, price, emoji, qty FROM cart WHERE user_id = ?', [req.user.id]);
    res.json(cartItems);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil keranjang.' });
  }
});

// Sync cart (overwrite entire cart, simplified approach)
app.post('/api/cart/sync', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { cart } = req.body; // array of items

    // Validasi: cart harus array
    if (!Array.isArray(cart)) {
      return res.status(400).json({ error: 'Format cart tidak valid.' });
    }

    // Validasi: maks 50 item di cart
    if (cart.length > 50) {
      return res.status(400).json({ error: 'Terlalu banyak item di keranjang.' });
    }

    // Validasi tiap item
    for (const item of cart) {
      if (
        !item.id || typeof item.id !== 'string' ||
        !item.name || typeof item.name !== 'string' ||
        typeof item.price !== 'number' || item.price < 0 ||
        typeof item.qty !== 'number' || item.qty < 1 || item.qty > 999
      ) {
        return res.status(400).json({ error: 'Data item keranjang tidak valid.' });
      }
    }

    await connection.beginTransaction();

    // Clear existing cart
    await connection.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    // Insert new cart items
    if (cart.length > 0) {
      for (const item of cart) {
        await connection.execute(
          'INSERT INTO cart (user_id, product_id, product_name, price, emoji, qty) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, item.id, item.name, item.price, item.emoji || '🚗', item.qty]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Keranjang berhasil disinkronisasi.' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Gagal sinkronisasi keranjang.' });
  } finally {
    connection.release();
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
