CREATE DATABASE IF NOT EXISTS digimar_db;
USE digimar_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_cart_item (user_id, product_id)
);

-- ── PRODUCTS (pindah dari hardcode ke DB) ─────────────────
CREATE TABLE IF NOT EXISTS products (
  id          VARCHAR(50)  PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  brand       VARCHAR(100) NOT NULL,
  category    ENUM('supercar','jdm','muscle','limited') NOT NULL,
  price       INT          NOT NULL,
  price_old   INT          DEFAULT NULL,
  emoji       VARCHAR(10)  DEFAULT '🏎️',
  badge       ENUM('hot','new','limited','sale','popular') DEFAULT 'new',
  img         VARCHAR(255) DEFAULT 'assets/ferrari_static.png',
  model_path  VARCHAR(255) DEFAULT NULL,
  scale       VARCHAR(10)  DEFAULT '1:64',
  stock       INT          DEFAULT 99,
  is_active   TINYINT(1)   DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed data dari index.html yang sudah ada
INSERT IGNORE INTO products (id, name, brand, category, price, price_old, emoji, badge, img, model_path, scale) VALUES
('card1', 'Ferrari 360 Modena – 1:64 Scale',    'Ferrari',     'supercar', 850000,  1200000, '🏎️', 'hot',     'assets/ferrari_static.png',  '1999_ferrari_360_modena/scene.gltf', '1:64'),
('card2', 'Nissan Z (RZ34) – 1:64 Scale',       'Nissan',      'jdm',      850000,  1200000, '🏎️', 'hot',     'assets/Nissan_Z_(RZ34).png',  'nissan/scene.gltf',                  '1:64'),
('card3', 'Honda Civic Type R – 1:64 Scale',    'Honda',       'jdm',      850000,  1200000, '🏎️', 'new',     'assets/Honda_civic.png',      'honda_civic_type_r/scene.gltf',      '1:64'),
('card4', 'Nissan Skyline GTR R34 – 1:64 Scale','Nissan',      'jdm',      950000,  1400000, '🏎️', 'limited', 'assets/nissan_skyline.png',   'nissan_skyline_gtr_r34/scene.gltf',  '1:64'),
('card5', 'Nissan Silvia S15 – 1:64 Scale',     'Nissan',      'jdm',      750000,  1000000, '🏎️', 'sale',    'assets/silvia_s15.png',       'silvia_s15/scene.gltf',              '1:64'),
('card6', 'Toyota GR Yaris – 1:64 Scale',       'Toyota',      'jdm',      800000,  1100000, '🏎️', 'new',     'assets/toyota_gr_yaris.png',  'toyota_gr_yaris/scene.gltf',         '1:64'),
('card7', 'Toyota Supra MK IV – 1:64 Scale',    'Toyota',      'jdm',      900000,  1300000, '🏎️', 'limited', 'assets/toyota_gr_yaris.png',  'toyota_supra_mk_iv/scene.gltf',      '1:64'),
('card8', 'Lamborghini Countach – 1:64 Scale',  'Lamborghini', 'supercar', 1200000, 1800000, '🏎️', 'limited', 'assets/ferrari_static.png',   'lamborghini_countach/scene.gltf',    '1:64');

-- ── ANALYTICS – Page Views ────────────────────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(64)  NOT NULL,
  page        VARCHAR(100) DEFAULT '/',
  referrer    VARCHAR(255) DEFAULT NULL,
  user_agent  VARCHAR(500) DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_session (session_id)
);

-- ── ANALYTICS – Sessions (durasi kunjungan) ──────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           VARCHAR(64)  PRIMARY KEY,
  duration_sec INT          DEFAULT NULL,   -- NULL = belum selesai
  pages_count  INT          DEFAULT 1,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  ended_at     TIMESTAMP    DEFAULT NULL,
  INDEX idx_created (created_at)
);

-- ── ANALYTICS – Product Events ────────────────────────────
CREATE TABLE IF NOT EXISTS product_events (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  VARCHAR(50)  NOT NULL,
  event_type  ENUM('cart_add','hover_start','hover_end') NOT NULL,
  session_id  VARCHAR(64)  DEFAULT NULL,
  duration_ms INT          DEFAULT NULL,   -- untuk hover_end
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product  (product_id),
  INDEX idx_event    (event_type),
  INDEX idx_created  (created_at),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── ADMINS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);