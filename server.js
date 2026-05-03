require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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
    
    // Cek email
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
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
    
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
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
    
    await connection.beginTransaction();
    
    // Clear existing cart
    await connection.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    
    // Insert new cart items
    if (cart && cart.length > 0) {
      for (const item of cart) {
        await connection.execute(
          'INSERT INTO cart (user_id, product_id, product_name, price, emoji, qty) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, item.id, item.name, item.price, item.emoji, item.qty]
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
