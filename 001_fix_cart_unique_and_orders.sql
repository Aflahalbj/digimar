-- Migration: fix cart unique key (product_id + brand) and add orders table
-- Jalankan file ini di database digimar_db kamu (lewat phpMyAdmin / mysql CLI / dst)

-- 1) FIX BUG: hapus produk dengan brand tertentu menghapus semua brand lain dari produk yang sama.
--    Penyebabnya: UNIQUE KEY (user_id, product_id) tidak mengikutsertakan brand,
--    jadi 1 produk dengan 2 brand berbeda dianggap baris yang sama oleh constraint.
ALTER TABLE `cart` DROP INDEX `unique_cart_item`;
ALTER TABLE `cart` ADD UNIQUE KEY `unique_cart_item` (`user_id`, `product_id`, `brand`);

-- 2) Tabel orders: dibuat saat user klik "Checkout via WhatsApp".
--    Menyimpan snapshot item yang di-checkout (hanya yang dicentang), agar saat admin
--    accept, item yang dihapus dari cart adalah persis item yang di-checkout (bukan seluruh cart).
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `user_email` varchar(100) NOT NULL,
  `items` JSON NOT NULL COMMENT 'array of {product_id, brand, name, price, qty}',
  `total` int NOT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user` (`user_id`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Migration: tambah status lanjutan untuk pesanan setelah di-accept admin.
-- Jalankan SETELAH migration 001_fix_cart_unique_and_orders.sql.
--
-- Alur status: pending -> (accept) -> belum_bayar -> dikemas -> dikirim -> selesai
--              pending -> (tolak)  -> rejected
--              belum_bayar/dikemas/dikirim -> pengembalian / dibatalkan (kapan saja setelah accept)

ALTER TABLE `orders`
  MODIFY COLUMN `status` ENUM(
    'pending',
    'rejected',
    'belum_bayar',
    'dikemas',
    'dikirim',
    'selesai',
    'pengembalian',
    'dibatalkan'
  ) NOT NULL DEFAULT 'pending';