/* ===================================================
   DAICAST – Premium Diecast Collectibles
   Main JavaScript – Cart + WhatsApp Checkout
   =================================================== */

// ─── WHATSAPP CONFIG ───────────────────────────────
const WA_NUMBER = '6283138991304'; // ← Ganti dengan nomor WA toko

// ─── CART STATE ────────────────────────────────────
let cart = []; // [{ id, name, price, emoji, qty }]

// ─── UTILS ─────────────────────────────────────────
function formatRupiah(num) {
  return 'Rp ' + num.toLocaleString('id-ID');
}

// ─── TOAST ─────────────────────────────────────────
function showToast(msg, icon = '🛒') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.querySelector('.toast-icon');
  if (!toast || !toastMsg) return;
  if (toastIcon) toastIcon.textContent = icon;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── CART BADGE ────────────────────────────────────
function updateBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  badge.textContent = total;
  badge.classList.remove('bump');
  void badge.offsetWidth; // reflow for re-trigger
  badge.classList.add('bump');
}

// ─── RENDER CART ITEMS ─────────────────────────────
function renderCart() {
  const body = document.getElementById('cartBody');
  const emptyEl = document.getElementById('cartEmpty');
  const footer = document.getElementById('cartFooter');
  const totalEl = document.getElementById('cartTotal');
  if (!body) return;

  // Remove existing item nodes (keep empty div)
  body.querySelectorAll('.cart-item').forEach(el => el.remove());

  if (cart.length === 0) {
    emptyEl.style.display = 'flex';
    footer.style.display = 'none';
  } else {
    emptyEl.style.display = 'none';
    footer.style.display = 'flex';

    const grandTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    totalEl.textContent = formatRupiah(grandTotal);

    cart.forEach(item => {
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="cart-item-emoji">${item.emoji}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatRupiah(item.price)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn qty-dec" data-id="${item.id}">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn qty-inc" data-id="${item.id}">+</button>
          <button class="remove-btn" data-id="${item.id}" title="Hapus">🗑</button>
        </div>
      `;
      body.appendChild(el);
    });

    // Qty/remove listeners
    body.querySelectorAll('.qty-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        changeQty(btn.dataset.id, 1);
      });
    });
    body.querySelectorAll('.qty-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        changeQty(btn.dataset.id, -1);
      });
    });
    body.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(btn.dataset.id);
      });
    });
  }
}

// ─── CART ACTIONS ──────────────────────────────────
function addToCart(id, name, price, emoji) {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Silakan daftar/login dulu ya! 🔒', '⚠️');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return false;
  }

  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, emoji, qty: 1 });
  }
  updateBadge();
  renderCart();
  showToast(`${name.slice(0, 28)} ditambahkan! 🎉`);
  return true;
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  updateBadge();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateBadge();
  renderCart();
  showToast('Item dihapus dari keranjang', '🗑');
}

function clearCart() {
  cart = [];
  updateBadge();
  renderCart();
  showToast('Keranjang dikosongkan', '🗑');
}

// ─── WHATSAPP CHECKOUT ─────────────────────────────
function checkoutWhatsApp() {
  if (cart.length === 0) {
    showToast('Keranjang masih kosong!', '⚠️');
    return;
  }

  const itemLines = cart.map(i =>
    `  • ${i.emoji} ${i.name} (${i.qty}x) = ${formatRupiah(i.price * i.qty)}`
  ).join('\n');

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const message =
    `Halo DAICAST! 👋\n\n` +
    `Saya mau beli semua yang di keranjang:\n\n` +
    `${itemLines}\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💰 Total: ${formatRupiah(total)}\n\n` +
    `Mohon konfirmasi ketersediaan dan info pembayarannya ya. Terima kasih! 🙏`;

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${WA_NUMBER}?text=${encoded}`, '_blank');
}

// ─── CART SIDEBAR TOGGLE ───────────────────────────
function openCart() {
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── PRODUCT CARDS → ADD TO CART ──────────────────
function initCartButtons() {
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.product-card');
      if (!card) return;

      const id = card.id;
      const name = card.dataset.name || card.querySelector('.product-name')?.textContent || 'Item';
      const price = parseInt(card.dataset.price || '0');
      const emoji = card.dataset.emoji || '🚗';

      const added = addToCart(id, name, price, emoji);
      if (!added) return;

      // Flash the main button if it's the main one (not overlay)
      const mainBtn = card.querySelector('.add-to-cart-main');
      if (mainBtn && btn === mainBtn) {
        mainBtn.textContent = '✓ Ditambahkan!';
        mainBtn.classList.add('added');
        setTimeout(() => {
          mainBtn.textContent = '🛒 Tambah ke Keranjang';
          mainBtn.classList.remove('added');
        }, 1800);
      }
    });
  });
}

// ─── NAVBAR SCROLL ─────────────────────────────────
const navbar = document.getElementById('navbar');
const navMenu = document.getElementById('navMenu');
const hamburger = document.getElementById('hamburger');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  updateActiveLink();
});

hamburger.addEventListener('click', () => {
  navMenu.classList.toggle('open');
});
document.querySelectorAll('.nav-link, .nav-cta').forEach(link => {
  link.addEventListener('click', () => navMenu.classList.remove('open'));
});

function updateActiveLink() {
  const sections = ['home', 'products', 'features', 'testimonials', 'contact'];
  const scrollPos = window.scrollY + 100;
  sections.forEach(id => {
    const section = document.getElementById(id);
    const link = document.querySelector(`.nav-link[href="#${id}"]`);
    if (!section || !link) return;
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    if (scrollPos >= top && scrollPos < bottom) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
}

// ─── ANIMATED COUNTER ──────────────────────────────
function animateCounter(el, target) {
  const duration = 2000;
  const frames = Math.round(duration / (1000 / 60));
  let frame = 0;
  const interval = setInterval(() => {
    frame++;
    const eased = 1 - Math.pow(1 - frame / frames, 3);
    const current = Math.round(eased * target);
    if (target >= 1000) {
      el.textContent = current >= 1000 ? (current / 1000).toFixed(0) + 'K+' : current;
    } else {
      el.textContent = current;
    }
    if (frame === frames) {
      clearInterval(interval);
      if (target === 500) el.textContent = '500+';
      if (target === 12000) el.textContent = '12K+';
      if (target === 5) el.textContent = '5+';
    }
  }, 1000 / 60);
}

// ─── INTERSECTION OBSERVERS ────────────────────────
let countersAnimated = false;
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.12 });

document.querySelectorAll('.feature-card, .product-card, .testimonial-card').forEach((el, i) => {
  el.classList.add('fade-up');
  el.style.transitionDelay = `${(i % 3) * 0.08}s`;
  observer.observe(el);
});

const statsSection = document.querySelector('.hero-stats');
if (statsSection) {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !countersAnimated) {
      countersAnimated = true;
      document.querySelectorAll('.stat-number').forEach(el => {
        animateCounter(el, parseInt(el.dataset.target));
      });
    }
  }, { threshold: 0.5 }).observe(statsSection);
}

// Smooth reveal for sections
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.section-header, .promo-content, .newsletter-container').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  revealObserver.observe(el);
});

// ─── PRODUCT FILTER ────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.product-card').forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      if (match) {
        card.style.display = 'block';
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        setTimeout(() => { card.style.display = 'none'; }, 280);
      }
    });
  });
});

// ─── COUNTDOWN TIMER ───────────────────────────────
function updateCountdown() {
  const now = new Date();
  const endTime = new Date();
  endTime.setHours(23, 59, 59, 0);
  let diff = Math.max(endTime - now, 0);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const hEl = document.getElementById('countHours');
  const mEl = document.getElementById('countMinutes');
  const sEl = document.getElementById('countSeconds');
  if (hEl) hEl.textContent = String(h).padStart(2, '0');
  if (mEl) mEl.textContent = String(m).padStart(2, '0');
  if (sEl) sEl.textContent = String(s).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);

// ─── NEWSLETTER FORM ───────────────────────────────
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', e => {
    e.preventDefault();
    const emailInput = document.getElementById('emailInput');
    if (emailInput?.value) {
      showToast('Berhasil daftar! Cek inbox kamu 🎉', '📧');
      emailInput.value = '';
    }
  });
}


// ─── PARALLAX HERO ─────────────────────────────────
window.addEventListener('scroll', () => {
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) heroBg.style.transform = `translateY(${window.scrollY * 0.25}px)`;
});

// ─── CURSOR TRAIL (desktop only) ───────────────────
if (window.innerWidth > 768) {
  let lx = 0, ly = 0;
  document.addEventListener('mousemove', e => {
    if (Math.abs(e.clientX - lx) < 6 && Math.abs(e.clientY - ly) < 6) return;
    lx = e.clientX; ly = e.clientY;
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:5px;height:5px;
      background:rgba(249,115,22,0.55);border-radius:50%;pointer-events:none;z-index:9999;
      transform:translate(-50%,-50%);transition:opacity .5s,transform .5s;`;
    document.body.appendChild(dot);
    setTimeout(() => { dot.style.opacity = '0'; dot.style.transform = 'translate(-50%,-50%) scale(0)'; }, 40);
    setTimeout(() => dot.remove(), 560);
  });
}

// ─── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Hero entrance animation
  document.querySelectorAll('.hero-badge, .hero-title, .hero-subtitle, .hero-buttons, .hero-stats').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity .6s ease ${i * 0.13}s, transform .6s ease ${i * 0.13}s`;
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, 80);
  });

  // Init add-to-cart buttons
  initCartButtons();

  // Cart sidebar controls
  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('cartClear').addEventListener('click', clearCart);
  document.getElementById('checkoutWA').addEventListener('click', checkoutWhatsApp);

  // Close cart when user clicks "Lihat Koleksi" inside empty state
  const cartShopLink = document.getElementById('cartShopLink');
  if (cartShopLink) cartShopLink.addEventListener('click', closeCart);

  // Init badge (Gunakan originalUpdateBadge agar tidak memicu syncCart sebelum loadCart selesai)
  if (typeof originalUpdateBadge === 'function') {
    originalUpdateBadge();
  }
  renderCart();
  updateActiveLink();
});

// ─── LRU CACHE 3D MODEL ────────────────────────────
const MAX_ACTIVE_MODELS = 3;
let active3DContainers = [];

function aktifkan3D(container) {
  const modelSrc = container.getAttribute('data-model');
  if (!modelSrc || modelSrc === '-') return;

  const img = container.querySelector('.product-img');
  let model = container.querySelector('model-viewer');

  // Pindahkan container ini ke urutan terakhir (paling baru diakses)
  active3DContainers = active3DContainers.filter(c => c !== container);
  active3DContainers.push(container);

  if (model) {
    // Model sudah ada di DOM, tinggal di-show
    model.style.display = 'block';
    img.style.display = 'none';
  } else {
    // Model belum ada, buat baru
    model = document.createElement('model-viewer');
    model.dataset.justLoaded = 'true';

    // Buat Loading Screen
    const loader = document.createElement('div');
    loader.setAttribute('slot', 'progress-bar');
    loader.className = 'model-loading-screen';
    loader.innerHTML = `
    <div class="model-loader"></div>
      <span>Memuat model 3D...</span>
    `;
    model.appendChild(loader);

    // Jika terjadi error
    model.addEventListener('error', (e) => {
      console.error("Gagal muat model:", e);
      loader.innerHTML = "<span>Gagal memuat model :(</span>";
    });

    // Set atribut dasar
    model.src = modelSrc;
    model.className = 'model';
    model.alt = img.alt;
    model.setAttribute('auto-rotate', 'true');
    model.setAttribute('auto-rotate-delay', '0');
    model.setAttribute('interaction-prompt', 'none');
    model.setAttribute('camera-orbit', '250deg 75deg auto');
    model.setAttribute('camera-controls', '');
    model.setAttribute('bounds', 'tight');
    model.setAttribute('rotation-per-second', '400deg');

    model.addEventListener('load', () => {
      console.log("Model selesai dimuat!");
      loader.style.display = 'none';
      setTimeout(() => {
        model.dataset.justLoaded = 'false';
      }, 500);
      setTimeout(() => {
        model.rotationPerSecond = "50deg";
      }, 500);
    });

    model.setAttribute('shadow-intensity', '2');
    model.setAttribute('shadow-softness', '1');
    model.setAttribute('environment-image', 'neutral');
    model.setAttribute('ar-placement', 'floor');
    model.style.backgroundColor = '#0a0e18';
    model.setAttribute('disable-tap', '');
    model.setAttribute('onclick', 'toggleRotation(this)');
    model.style.width = '100%';
    model.style.height = '100%';
    model.style.transform = 'scale(1.3)';

    img.style.display = 'none';

    // Masukkan model sbg elemen pertama agar Z-Index Vignette/Hint tetap di atas
    container.prepend(model);
  }

  // Jalankan pembersihan LRU Cache jika melebihi batas
  if (active3DContainers.length > MAX_ACTIVE_MODELS) {
    const oldestContainer = active3DContainers.shift(); // Ambil dari depan (paling lama)
    if (oldestContainer && oldestContainer !== container) {
      const oldestModel = oldestContainer.querySelector('model-viewer');
      if (oldestModel) {
        oldestModel.remove(); // Hapus elemen 3D dari DOM untuk hemat RAM
        console.log("LRU Cache: Menghapus 3D Model lama dari RAM");
      }
      const oldestImg = oldestContainer.querySelector('.product-img');
      if (oldestImg) oldestImg.style.display = 'block';
    }
  }
}

function matikan3D(container) {
  const img = container.querySelector('.product-img');
  const model = container.querySelector('model-viewer');

  // Jangan di-remove, sembunyikan saja. Remove diurus oleh LRU Cache.
  if (model) {
    model.style.display = 'none';
  }

  // Munculkan lagi gambar statis
  if (img) {
    img.style.display = 'block';
  }
}

function toggleRotation(model) {
  if (model.dataset.justLoaded === 'true') {
    return;
  }
  // Cek apakah saat ini sedang auto-rotate
  if (model.hasAttribute('auto-rotate')) {
    model.removeAttribute('auto-rotate');
    console.log("Auto-rotate: OFF");
  } else {
    model.setAttribute('auto-rotate', '');
    console.log("Auto-rotate: ON");
  }
}

// ─── AUTHENTICATION & CART SYNC ────────────────────
const API_URL = 'http://localhost:5000/api';
let isSyncing = false;

async function syncCart() {
  if (isSyncing) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch(`${API_URL}/cart/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ cart })
    });
  } catch (err) { console.error('Gagal sinkronisasi keranjang', err); }
}

async function loadCart() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/cart`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      isSyncing = true;
      cart = await res.json();
      originalUpdateBadge(); // Panggil fungsi asli tanpa trigger syncCart
      renderCart();
      isSyncing = false;
    }
  } catch (err) { console.error('Gagal memuat keranjang', err); }
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const authNavItem = document.getElementById('authNavItem');

  if (token && userStr && authNavItem) {
    const user = JSON.parse(userStr);
    authNavItem.innerHTML = `
      <a href="#" class="nav-cta" id="logoutBtn" style="background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
        Logout
      </a>
    `;

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      cart = []; // Kosongkan keranjang saat logout
      isSyncing = true;
      originalUpdateBadge();
      renderCart();
      isSyncing = false;
      checkAuth(); // Refresh UI
      showToast('Berhasil logout', '👋');
    });

    loadCart();
  } else if (authNavItem) {
    authNavItem.innerHTML = `
      <a href="login.html" class="nav-cta">Daftar</a>
    `;
  }
}

// Intercept updateBadge agar keranjang selalu tersinkronisasi ke server tiap kali ada perubahan
const originalUpdateBadge = updateBadge;
updateBadge = function () {
  originalUpdateBadge();
  syncCart();
};

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});