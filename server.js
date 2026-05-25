require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const rateLimit = require('express-rate-limit');
// ─── SMTP MAILER ──────────────────────────────────────
const nodemailer = require('nodemailer');
const crypto = require('crypto');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: '"' + (process.env.SMTP_FROM_NAME || 'Diecastku') + '" <' + process.env.SMTP_USER + '>',
    to, subject, html,
  });
}


// Brand normalize helper
const BRAND_NORMALIZE = {
  'hotwheels': 'Hot Wheels', 'hot wheels': 'Hot Wheels',
  'minigt': 'Mini GT', 'mini gt': 'Mini GT',
  'matchbox': 'Matchbox',
};
function normalizeBrand(b) {
  if (!b || typeof b !== 'string') return b;
  return BRAND_NORMALIZE[b.toLowerCase().replace(/\s+/g, '')] ||
         BRAND_NORMALIZE[b.toLowerCase()] || b;
}
function normalizeBrands(arr) {
  return Array.isArray(arr) ? arr.map(normalizeBrand).filter(Boolean) : [];
}

const app = express();

// ─── CORS ─────────────────────────────────────────────
const allowedOrigins = [
  'https://diecastindonesia.vercel.app',
  'https://diecastku.vercel.app',
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
    const [cartItems] = await db.execute(
      `SELECT 
      c.product_id as id, 
      c.product_name as name, 
      c.price, 
      c.brand,
      p.img,
      c.qty
      FROM cart c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?`, 
      [req.user.id]);
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

    // Deduplicate: merge same product_id+brand combinations
    const merged = [];
    for (const item of cart) {
      const key = item.id + '|' + (item.brand || '');
      const existing = merged.find(i => i._key === key);
      if (existing) { existing.qty += item.qty; }
      else { merged.push({ ...item, _key: key }); }
    }

    await connection.beginTransaction();

    // Clear existing cart
    await connection.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    // Insert new cart items
    if (merged.length > 0) {
      const values = merged.map(item => [req.user.id, item.id, item.name, item.price, item.brand || '', item.qty]);
      await connection.query(
        'INSERT INTO cart (user_id, product_id, product_name, price, brand, qty) VALUES ?',
        [values]
      );
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

// ─── ADMIN MIDDLEWARE ─────────────────────────────────
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Akses ditolak.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
    if (err || !admin.isAdmin) return res.status(403).json({ error: 'Bukan admin.' });
    req.admin = admin;
    next();
  });
};

// ─── ADMIN AUTH ───────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    const [admins] = await db.execute('SELECT * FROM admins WHERE email = ?', [email.toLowerCase().trim()]);
    if (!admins.length) return res.status(400).json({ error: 'Email atau password salah.' });
    const admin = admins[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(400).json({ error: 'Email atau password salah.' });
    const token = jwt.sign({ id: admin.id, name: admin.name, email: admin.email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (e) {
    res.status(500).json({ error: 'Terjadi kesalahan server.', details: e.message });
  }
});

// Buat admin pertama — hapus route ini setelah dipakai di production!
// app.post('/api/admin/setup', async (req, res) => {
//   try {
//     const { name, email, password, setupKey } = req.body;
//     if (setupKey !== process.env.ADMIN_SETUP_KEY) return res.status(403).json({ error: 'Setup key salah.' });
//     const [existing] = await db.execute('SELECT id FROM admins WHERE email = ?', [email]);
//     if (existing.length) return res.status(400).json({ error: 'Admin sudah ada.' });
//     const hashed = await bcrypt.hash(password, 10);
//     await db.execute('INSERT INTO admins (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
//     res.json({ message: 'Admin berhasil dibuat.' });
//   } catch (e) {
//     res.status(500).json({ error: 'Terjadi kesalahan server.' });
//   }
// });

// ─── PRODUCTS API (publik – baca) ─────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { price_min, price_max } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];
    if (price_min) { query += ' AND price >= ?'; params.push(parseInt(price_min)); }
    if (price_max) { query += ' AND price <= ?'; params.push(parseInt(price_max)); }
    query += ' ORDER BY sort_order ASC, created_at DESC';
    const [rows] = await db.execute(query, params);
    // Parse brands JSON field
    const products = rows.map(r => ({
      ...r,
      brands: (() => { try { const b = Array.isArray(r.brands) ? r.brands : JSON.parse(r.brands || '[]'); return normalizeBrands(b); } catch { return []; } })(),
      brand_prices: (() => { try { if (!r.brand_prices) return null; return typeof r.brand_prices === 'object' ? r.brand_prices : JSON.parse(r.brand_prices); } catch { return null; } })()
    }));
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil produk.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil produk.' });
  }

});
// Halaman Web Detail Produk (Ramah SEO)
app.get('/products/:id', async (req, res) => {
  try {
    // 1. Ambil data dari database
    const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).send('Produk tidak ditemukan.');
    }
    
    const produk = rows[0]; // Isinya kolom: brand, name, color, dll.

    // 2. Racik rumus Meta SEO dari kolom database
    // Sesuaikan nama properti (misal: produk.brand, produk.name) dengan kolom di tabel MySQL kamu
    const metaTitle = `${produk.brand} ${produk.name} ${produk.scale} - Diecastku`;
    const metaDesc = `Beli ${produk.brand} ${produk.name} ${produk.scale} Original di Diecastku. Garansi 100% ori, packing aman!`;

    // 3. Render ke file EJS/HTML
    res.render('detail-produk', { 
      produk: produk, 
      pageTitle: metaTitle, 
      pageDesc: metaDesc 
    });

  } catch (e) {
    res.status(500).send('Gagal memuat halaman produk.');
  }
});

// ─── PRODUCTS CRUD (admin only) ───────────────────────
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  try {
    const { id, name, brand, brands, category, price, price_old, badge, img, model_path, stock } = req.body;
    if (!id || !name || !category || (price === undefined || price === null || price === '')) return res.status(400).json({ error: 'Field wajib: id, name, category, price.' });
    const brandsJson = JSON.stringify(Array.isArray(brands) ? brands : (brand ? [brand] : []));
    const primaryBrand = Array.isArray(brands) && brands.length ? brands[0] : (brand || '');
    // Build brand_prices JSON from submitted data
    const brandPricesInput = req.body.brand_prices;
    let brandPricesJson = null;
    if (brandPricesInput && typeof brandPricesInput === 'object') {
      brandPricesJson = JSON.stringify(brandPricesInput);
    } else if (primaryBrand && price) {
      brandPricesJson = JSON.stringify({ [primaryBrand]: { price: parseInt(price), price_old: price_old ? parseInt(price_old) : null } });
    }
    // Compute price range
    let finalPrice = parseInt(price);
    let finalPriceOld = price_old ? parseInt(price_old) : null;
    if (brandPricesInput && typeof brandPricesInput === 'object') {
      const prices = Object.values(brandPricesInput).map(v => parseInt(v.price)).filter(Boolean);
      const oldPrices = Object.values(brandPricesInput).map(v => parseInt(v.price_old)).filter(Boolean);
      if (prices.length) { finalPrice = Math.min(...prices); finalPriceOld = oldPrices.length ? Math.max(...oldPrices) : null; }
    }
    await db.execute(
      'INSERT INTO products (id, name, brand, brands, category, price, price_old, badge, img, model_path, stock, brand_prices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, primaryBrand, brandsJson, category, finalPrice, finalPriceOld, badge || 'new', img || 'assets/ferrari_static.png', req.body.model_3d || model_path || null, stock ?? 99, brandPricesJson]
    );
    res.status(201).json({ message: 'Produk berhasil ditambahkan.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'ID produk sudah dipakai.' });
    res.status(500).json({ error: 'Gagal menambah produk.' });
  }
});

app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, brand, brands, category, price, price_old, badge, img, model_path, stock, is_active } = req.body;
    const brandsJson = JSON.stringify(Array.isArray(brands) ? brands : (brand ? [brand] : []));
    const primaryBrand = Array.isArray(brands) && brands.length ? brands[0] : (brand || '');
    const brandPricesInput2 = req.body.brand_prices;
    let brandPricesJson2 = null;
    if (brandPricesInput2 && typeof brandPricesInput2 === 'object') {
      brandPricesJson2 = JSON.stringify(brandPricesInput2);
    } else if (primaryBrand && price) {
      brandPricesJson2 = JSON.stringify({ [primaryBrand]: { price: parseInt(price), price_old: price_old ? parseInt(price_old) : null } });
    }
    let finalPrice2 = parseInt(price);
    let finalPriceOld2 = price_old ? parseInt(price_old) : null;
    if (brandPricesInput2 && typeof brandPricesInput2 === 'object') {
      const prices2 = Object.values(brandPricesInput2).map(v => parseInt(v.price)).filter(Boolean);
      const oldPrices2 = Object.values(brandPricesInput2).map(v => parseInt(v.price_old)).filter(Boolean);
      if (prices2.length) { finalPrice2 = Math.min(...prices2); finalPriceOld2 = oldPrices2.length ? Math.max(...oldPrices2) : null; }
    }
    await db.execute(
      'UPDATE products SET name=?, brand=?, brands=?, category=?, price=?, price_old=?, badge=?, img=?, model_path=?, stock=?, is_active=?, brand_prices=?, updated_at=NOW() WHERE id=?',
      [name, primaryBrand, brandsJson, category, finalPrice2, finalPriceOld2, badge || 'new', img || 'assets/ferrari_static.png', req.body.model_3d || model_path || null, stock ?? 99, is_active ?? 1, brandPricesJson2, req.params.id]
    );
    res.json({ message: 'Produk berhasil diupdate.' });
  } catch (e) {
    console.error("PUT PRODUCT ERROR:", e);
    res.status(500).json({ error: 'Gagal mengupdate produk.' });
  }
});

app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menghapus produk.' });
  }
});

app.patch('/api/admin/products/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT is_active FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    const currentStatus = rows[0].is_active;
    const newStatus = currentStatus ? 0 : 1;
    await db.execute('UPDATE products SET is_active = ?, updated_at = NOW() WHERE id = ?', [newStatus, req.params.id]);
    res.json({ message: 'Status produk berhasil diubah.', is_active: newStatus });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengubah status produk.' });
  }
});

// ─── ANALYTICS COLLECT ────────────────────────────────
app.post('/api/analytics/pageview', async (req, res) => {
  try {
    const { session_id, page, referrer } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id wajib.' });
    const ua = req.headers['user-agent'] || '';
    await db.execute(
      'INSERT INTO sessions (id, pages_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE pages_count = pages_count + 1',
      [session_id]
    );
    await db.execute(
      'INSERT INTO page_views (session_id, page, referrer, user_agent) VALUES (?, ?, ?, ?)',
      [session_id, page || '/', referrer || null, ua.substring(0, 500)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mencatat pageview.' });
  }
});

app.post('/api/analytics/session-end', async (req, res) => {
  try {
    const { session_id, duration_sec } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id wajib.' });
    await db.execute(
      'UPDATE sessions SET duration_sec = ?, ended_at = NOW() WHERE id = ?',
      [Math.round(duration_sec) || 0, session_id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mencatat durasi.' });
  }
});

app.post('/api/analytics/product-event', async (req, res) => {
  try {
    const { product_id, event_type, session_id, duration_ms } = req.body;
    if (!product_id || !event_type) return res.status(400).json({ error: 'product_id dan event_type wajib.' });
    await db.execute(
      'INSERT INTO product_events (product_id, event_type, session_id, duration_ms) VALUES (?, ?, ?, ?)',
      [product_id, event_type, session_id || null, duration_ms || null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mencatat event.' });
  }
});

// ─── ANALYTICS DASHBOARD ─────────────────────────────
app.get('/api/admin/analytics/overview', authenticateAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.range) || 7;
    const [[{ total_visitors }]] = await db.execute(
      'SELECT COUNT(DISTINCT session_id) as total_visitors FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days]);
    const [[{ total_pageviews }]] = await db.execute(
      'SELECT COUNT(*) as total_pageviews FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days]);
    const [[{ avg_duration }]] = await db.execute(
      `SELECT ROUND(AVG(duration_sec)) as avg_duration FROM sessions 
       WHERE duration_sec IS NOT NULL AND duration_sec > 0 AND duration_sec < 86400
       AND CONVERT_TZ(created_at, '+00:00', '+07:00') >= DATE_SUB(CONVERT_TZ(NOW(), '+00:00', '+07:00'), INTERVAL ? DAY)`, [days]);
    const [[{ total_products }]] = await db.execute('SELECT COUNT(*) as total_products FROM products WHERE is_active = 1');
    const [[{ total_users }]] = await db.execute('SELECT COUNT(*) as total_users FROM users');
    const [[{ cart_adds_today }]] = await db.execute(
      `SELECT COUNT(*) as cart_adds_today FROM product_events 
        WHERE event_type = 'cart_add' 
        AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) = CURDATE()`);
    res.json({ total_visitors, total_pageviews, avg_duration: avg_duration || 0, total_products, total_users, cart_adds_today });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil overview.' });
  }
});

app.get('/api/admin/analytics/visits', authenticateAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.range) || 7;
    const [daily] = await db.execute(
      `SELECT DATE(created_at) as date, COUNT(DISTINCT session_id) as visitors, COUNT(*) as pageviews
       FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`, [days]);
    res.json(daily);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil visits.' });
  }
});

app.get('/api/admin/analytics/top-cart', authenticateAdmin, async (req, res) => {
  try {
    const [topCart] = await db.execute(
      `SELECT c.product_id, p.name as product_name, p.img, p.brand, SUM(c.qty) as cart_adds
       FROM cart c LEFT JOIN products p ON c.product_id = p.id
       GROUP BY c.product_id ORDER BY cart_adds DESC LIMIT 8`);
    res.json(topCart);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil top cart.' });
  }
});

app.get('/api/admin/analytics/top-hover', authenticateAdmin, async (req, res) => {
  try {
    const [topHoverDuration] = await db.execute(
      `SELECT pe.product_id, p.name as product_name, p.img, p.brand, ROUND(AVG(pe.duration_ms / 1000)) as avg_hover_seconds, ROUND(SUM(pe.duration_ms / 1000)) as total_hover_seconds
       FROM product_events pe LEFT JOIN products p ON pe.product_id = p.id
       WHERE pe.event_type = 'hover_end' AND pe.duration_ms IS NOT NULL
       GROUP BY pe.product_id ORDER BY avg_hover_seconds DESC LIMIT 8`);
    res.json(topHoverDuration);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil top hover.' });
  }
});

app.get('/api/admin/analytics/pages', authenticateAdmin, async (req, res) => {
  try {
    const [pages] = await db.execute(
      `SELECT pv.page, COUNT(*) as views, COUNT(DISTINCT pv.session_id) as unique_views, ROUND(AVG(s.duration_sec)) as avg_duration
       FROM page_views pv LEFT JOIN sessions s ON pv.session_id = s.id
       GROUP BY pv.page ORDER BY views DESC LIMIT 10`);
    res.json(pages);
  } catch (e) {
    console.error("Pages route error:", e);
    res.status(500).json({ error: 'Gagal mengambil halaman.', details: e.message });
  }
});

app.get('/api/admin/products', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
    const products = rows.map(r => ({
      ...r,
      brands: (() => { try { const b = Array.isArray(r.brands) ? r.brands : JSON.parse(r.brands || '[]'); return normalizeBrands(b); } catch { return []; } })(),
      brand_prices: (() => { try { if (!r.brand_prices) return null; return typeof r.brand_prices === 'object' ? r.brand_prices : JSON.parse(r.brand_prices); } catch { return null; } })()
    }));
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil produk.' });
  }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil users.' });
  }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pengguna berhasil dihapus.' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menghapus pengguna.' });
  }
});


// ─── NEWSLETTER ───────────────────────────────────────
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Format email tidak valid.' });
    const norm = email.toLowerCase().trim();
    await db.execute(
      'INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE subscribed_at = subscribed_at',
      [norm]
    );
    // Kirim email konfirmasi
    try {
      await sendMail({
        to: norm,
        subject: '🏎️ Kamu Berhasil Daftar Newsletter Diecastku!',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1117;color:#f8fafc;padding:32px;border-radius:16px">
            <h2 style="color:#f97316">🏎️ Selamat datang di Diecastku!</h2>
            <p>Kamu berhasil daftar newsletter kami. Kamu akan dapat info promo & rilis koleksi terbaru duluan!</p>
            <p style="color:#94a3b8;font-size:0.85rem">Jika kamu tidak merasa mendaftar, abaikan email ini.</p>
          </div>`,
      });
    } catch (mailErr) {
      console.error('Gagal kirim email konfirmasi newsletter:', mailErr.message);
    }
    res.json({ message: 'Berhasil daftar newsletter!' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal mendaftar newsletter.' });
  }
});

// ─── FORGOT PASSWORD ──────────────────────────────────
const resetTokens = new Map(); // token -> { email, exp }

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });
    const norm = email.toLowerCase().trim();
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [norm]);
    // Selalu return 200 meski email tidak ada (mencegah user enumeration)
    if (!users.length) return res.json({ message: 'Jika email terdaftar, link reset telah dikirim.' });
    const token = crypto.randomBytes(32).toString('hex');
    const exp = Date.now() + 60 * 60 * 1000; // 1 jam
    resetTokens.set(token, { email: norm, exp });
    const resetLink = (process.env.BASE_URL || 'http://localhost:5000') + '/reset-password.html?token=' + token;
    await sendMail({
      to: norm,
      subject: '🔑 Reset Password Diecastku',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d1117;color:#f8fafc;padding:32px;border-radius:16px">
          <h2 style="color:#f97316">🔑 Reset Password</h2>
          <p>Klik tombol di bawah untuk reset password. Link berlaku <strong>1 jam</strong>.</p>
          <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Reset Password</a>
          <p style="color:#94a3b8;font-size:0.85rem">Jika kamu tidak meminta reset, abaikan email ini.</p>
        </div>`,
    });
    res.json({ message: 'Jika email terdaftar, link reset telah dikirim.' });
  } catch (e) {
    console.error('Forgot password error:', e);
    res.status(500).json({ error: 'Gagal mengirim email reset.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'Token dan password (min 6 karakter) wajib diisi.' });
    }
    const entry = resetTokens.get(token);
    if (!entry || Date.now() > entry.exp) {
      return res.status(400).json({ error: 'Link reset tidak valid atau sudah kedaluwarsa.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.execute('UPDATE users SET password = ? WHERE email = ?', [hashed, entry.email]);
    resetTokens.delete(token);
    res.json({ message: 'Password berhasil direset!' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal reset password.' });
  }
});

// ─── BROADCAST EMAIL (admin) ──────────────────────────
app.post('/api/admin/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { subject, html, target } = req.body;
    // target: 'all' | 'users' | 'newsletter'
    if (!subject || !html) return res.status(400).json({ error: 'Subject dan isi pesan wajib diisi.' });
    let emails = [];
    if (target === 'users' || target === 'all') {
      const [rows] = await db.execute('SELECT email FROM users');
      emails.push(...rows.map(r => r.email));
    }
    if (target === 'newsletter' || target === 'all') {
      const [rows] = await db.execute('SELECT email FROM newsletter_subscribers');
      emails.push(...rows.map(r => r.email));
    }
    // Deduplicate
    emails = [...new Set(emails)];
    if (!emails.length) return res.status(400).json({ error: 'Tidak ada penerima.' });
    // Kirim batch (pakai BCC per 50 untuk menghindari spam filter)
    const BATCH = 50;
    let sent = 0;
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH);
      await sendMail({ to: process.env.SMTP_USER, subject, html: html + '<p style="font-size:0.7rem;color:#666">Dikirim ke ' + batch.length + ' penerima</p>' });
      // Kirim ke tiap penerima individual (untuk personalisasi nama di masa depan)
      for (const email of batch) {
        try { await sendMail({ to: email, subject, html }); sent++; } catch (_) {}
      }
    }
    res.json({ message: `Email berhasil dikirim ke ${sent} penerima.` });
  } catch (e) {
    console.error('Broadcast error:', e);
    res.status(500).json({ error: 'Gagal mengirim broadcast: ' + e.message });
  }
});

app.get('/api/admin/broadcast/recipients-count', authenticateAdmin, async (req, res) => {
  try {
    const [[{ users }]] = await db.execute('SELECT COUNT(*) as users FROM users');
    const [[{ newsletter }]] = await db.execute('SELECT COUNT(*) as newsletter FROM newsletter_subscribers');
    res.json({ users, newsletter, all: users + newsletter });
  } catch (e) {
    res.status(500).json({ error: 'Gagal.' });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;