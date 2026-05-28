# Digimar — Diecast Store

Toko diecast online dengan fitur analytics, manajemen produk, keranjang belanja, dan dashboard admin. Dibangun dengan Node.js + Express di backend dan HTML/CSS/JS vanilla di frontend, di-deploy di Vercel dengan database MySQL (Aiven).

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js, Express 5 |
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Database | MySQL (Aiven Cloud) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Email | Nodemailer + Gmail SMTP |
| Deploy | Vercel |

---

## Fitur

- **Produk** — listing, detail, filter brand
- **Keranjang** — sync antara guest dan akun (login)
- **Auth** — register, login, lupa password via email, reset password
- **Newsletter** — subscribe & broadcast email ke semua subscriber
- **Analytics** — tracking pageview, durasi sesi, hover produk
- **Admin Dashboard** — statistik pengunjung, manajemen produk & user, broadcast email

---

## Struktur Proyek

```
digimar/
├── server.js               # Entry point, semua API routes
├── db.js                   # Koneksi MySQL pool
├── vercel.json             # Konfigurasi deploy Vercel
├── package.json
├── .env                    # Environment variables (jangan di-commit)
├── env.example             # Template .env
├── ca.pem                  
└── public/
    ├── index.html          # Halaman utama
    ├── products.html       # Halaman katalog produk
    ├── admin.html          # Dashboard admin
    ├── login.html          # Halaman login/register
    ├── reset-password.html # Halaman reset password
    ├── script.js           # Logic frontend + analytics tracker
    └── style.css           # Global styles
```

---

## Instalasi & Menjalankan Lokal

### 1. Clone repo

```bash
git clone https://github.com/Aflahalbj/digimar.git
cd digimar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Salin `env.example` menjadi `.env` dan isi sesuai konfigurasi:

```bash
cp env.example .env
```

```env
# Database (Aiven MySQL)
DB_HOST=your-aiven-host.aivencloud.com
DB_PORT=3306
DB_USER=avnadmin
DB_PASSWORD=your-db-password
DB_NAME=digimar_db

# JWT
JWT_SECRET=ganti-dengan-string-random-minimal-32-karakter
ADMIN_SETUP_KEY=ganti-ini-juga

# App
NODE_ENV=development
PORT=5000
BASE_URL=http://localhost:5000

# SMTP (Gmail — wajib pakai App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=emailkamu@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SMTP_FROM_NAME=Diecastku
```

> **Catatan SMTP:** Gunakan **App Password** dari Google, bukan password akun biasa. Buat di: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### 4. Import database

Import file SQL ke database MySQL kamu:

```bash
mysql -h <host> -P <port> -u <user> -p <db_name> < digimar_db_2026-05-24_091447.sql
```

### 5. Jalankan server

```bash
node server.js
```

Server berjalan di `http://localhost:5000`

---

## Deploy ke Vercel

Proyek ini sudah dikonfigurasi untuk Vercel via `vercel.json`.

```bash
npm i -g vercel
vercel
```

Pastikan semua environment variables di atas sudah diset di dashboard Vercel (Settings → Environment Variables).

---

## API Routes

### Auth
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Daftar akun baru |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/forgot-password` | Kirim email reset password |
| POST | `/api/auth/reset-password` | Reset password dengan token |

### Produk
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/products` | Ambil semua produk aktif |
| GET | `/api/products/:id` | Detail produk |

### Keranjang *(auth required)*
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/cart` | Ambil isi keranjang |
| POST | `/api/cart/sync` | Sync keranjang (guest → akun) |

### Newsletter
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/newsletter/subscribe` | Subscribe newsletter |

### Analytics *(publik, dipanggil otomatis oleh script.js)*
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/analytics/pageview` | Catat pageview |
| POST | `/api/analytics/session-end` | Catat durasi sesi |
| POST | `/api/analytics/product-event` | Catat event hover/cart produk |

### Admin *(admin token required)*
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/admin/login` | Login admin |
| GET | `/api/admin/analytics/overview` | Statistik ringkasan |
| GET | `/api/admin/analytics/visits` | Data kunjungan per hari |
| GET | `/api/admin/analytics/top-cart` | Produk paling sering di-cart |
| GET | `/api/admin/analytics/top-hover` | Produk paling lama di-hover |
| GET | `/api/admin/analytics/pages` | Statistik per halaman |
| GET | `/api/admin/products` | Daftar semua produk |
| POST | `/api/admin/products` | Tambah produk baru |
| PUT | `/api/admin/products/:id` | Edit produk |
| DELETE | `/api/admin/products/:id` | Hapus produk |
| GET | `/api/admin/users` | Daftar semua user |
| DELETE | `/api/admin/users/:id` | Hapus user |
| POST | `/api/admin/broadcast` | Kirim broadcast email |
| GET | `/api/admin/broadcast/recipients-count` | Jumlah penerima broadcast |

---

## Skema Database

| Tabel | Deskripsi |
|---|---|
| `products` | Data produk diecast |
| `users` | Akun pembeli |
| `admins` | Akun admin |
| `cart` | Item di keranjang per user |
| `sessions` | Sesi pengunjung (untuk analytics durasi) |
| `page_views` | Log pageview per sesi |
| `product_events` | Log event hover & cart per produk |
| `newsletter_subscribers` | Daftar email subscriber |

---

## Known Issues & Fix

### Avg Durasi di Admin Selalu "—" atau 0

**Penyebab:** `navigator.sendBeacon()` mengirim body sebagai `text/plain` secara default, sehingga Express tidak bisa mem-parse `req.body` dan `duration_sec` tidak tersimpan ke database.

**Fix** — ubah fungsi `trackSessionEnd` di `public/script.js`:

```js
// Sebelum (broken):
navigator.sendBeacon(API + '/session-end', JSON.stringify({ session_id: sessionId, duration_sec }));

// Sesudah (fix):
const blob = new Blob(
  [JSON.stringify({ session_id: sessionId, duration_sec })],
  { type: 'application/json' }
);
navigator.sendBeacon(API + '/session-end', blob);
```

---

## Lisensi

ISC