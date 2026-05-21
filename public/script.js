
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
function showToast(msg, icon = '<i class="fas fa-shopping-cart"></i>') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.querySelector('.toast-icon');
  if (!toast || !toastMsg) return;
  
  if (toastIcon) toastIcon.innerHTML = icon;
  toastMsg.innerHTML = msg;

  // Hapus tombol "X" lama jika sebelumnya sudah ada (biar tidak duplikat)
  const oldCloseBtn = toast.querySelector('.toast-close-btn');
  if (oldCloseBtn) oldCloseBtn.remove();

  // Tambah elemen tombol "X" baru ke dalam toast
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close-btn';
  closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
  toast.appendChild(closeBtn);

  // Jalankan animasi muncul
  toast.classList.add('show');

  // Fungsi internal untuk menyembunyikan toast
  const hideToast = () => {
    toast.classList.remove('show');
  };

  // EVENT LISTENER: Klik tombol "X" langsung menutup toast saat itu juga
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Biar tidak memicu event klik lain
    hideToast();
  });

  // TIMEOUT OTOMATIS: Tetap menutup sendiri setelah 3 detik jika tidak diklik
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    hideToast();
  }, 3000);
}
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── CART BADGE ────────────────────────────────────
function updateBadge() {
  let _suppressSync = false;
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  badge.textContent = total;
  badge.classList.remove('bump');
  void badge.offsetWidth; // reflow for re-trigger
  badge.classList.add('bump');
  if (!_suppressSync) debouncedSync();
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
        <div class="cart-item-img"><img src="${item.img}" alt="🚗" class="item-img"></div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatRupiah(item.price)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn qty-dec" data-id="${item.id}">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn qty-inc" data-id="${item.id}">+</button>
          <button class="remove-btn" data-id="${item.id}" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
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
function addToCart(id, name, price, img) {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Silakan daftar/login dulu ya!&nbsp;&nbsp;<i class="fa-solid fa-key" style="color: var(--gold);"></i>', '<i class="fa-solid fa-triangle-exclamation" style="color: var(--gold);"></i>');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return false;
  }

  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, img, qty: 1 });
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
  showToast('Item dihapus dari keranjang', '<i class="fa-solid fa-trash-can" style="color: red;"></i>');
}

function clearCart() {
  cart = [];
  updateBadge();
  renderCart();
  showToast('Keranjang dikosongkan', '<i class="fa-solid fa-trash-can" style="color: red;"></i>');
}

// ─── WHATSAPP CHECKOUT ─────────────────────────────
function checkoutWhatsApp() {
  if (cart.length === 0) {
    showToast('Keranjang masih kosong!', '<i class="fa-solid fa-triangle-exclamation" style="color: var(--gold);"></i>');
    return;
  }

  const itemLines = cart.map(i =>
    `  • ${i.name} (${i.qty}x) = 
    ${formatRupiah(i.price * i.qty)}`
  ).join('\n');

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const message =
    `Halo  admin DAICASTKU! 👋\n\n` +
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
      const img = card.querySelector('.product-img')?.src;

      const added = addToCart(id, name, price, img);
      if (!added) return;

      // Flash the main button if it's the main one (not overlay)
      const mainBtn = card.querySelector('.add-to-cart-main');
      if (mainBtn && btn === mainBtn) {
        mainBtn.innerHTML = '✓ Ditambahkan!';
        mainBtn.classList.add('added');
        setTimeout(() => {
          mainBtn.innerHTML = '<dotlottie-wc src="https://lottie.host/f243d374-dbaf-40c9-aae7-8966d16f3d00/j6hjZ0mPui.lottie" style = "width: 25px;height: 25px" speed = "1.5" autoplay loop ></dotlottie-wc> ';
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
  const scrollPos = window.scrollY + 150; // Tambah offset agak besar supaya lebih responsif

  sections.forEach(id => {
    const section = document.getElementById(id);
    if (!section) return;

    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;

    if (scrollPos >= top && scrollPos < bottom) {
      // Hapus semua class active dulu
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

      // Kondisi khusus untuk ID 'products'
      if (id === 'products') {
        document.getElementById('link-product').classList.add('active');
      } else {
        // Untuk yang lain tetap cari berdasarkan href #id
        const link = document.querySelector(`.nav-link[href="#${id}"]`) ||
          document.querySelector(`.nav-link[href="index.html#${id}"]`);
        if (link) link.classList.add('active');
      }
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
      showToast('Berhasil daftar! Cek inbox kamu 🎉', '<i class="fa-solid fa-envelope-circle-check"></i>');
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

// ─── FETCH & RENDER PRODUCTS ──────────────────────────
async function fetchAndRenderProducts() {
  const grid = document.querySelector('.products-grid');
  if (!grid) return; // Skip jika tidak ada grid produk di halaman ini

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Gagal memuat produk');
    const products = await response.json();

    grid.innerHTML = '';

    if (products.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #a1a1aa;">Belum ada produk yang aktif.</p>';
      return;
    }

    // Limit to 3 products as requested for index.html
    const top3Products = products.slice(0, 3);

    top3Products.forEach((p, index) => {
      const formatRp = (num) => 'Rp ' + parseInt(num).toLocaleString('id-ID');

      let badgeHTML = '';
      if (p.badge) {
        let badgeClass = 'badge-sale';
        let badgeIcon = '🏷️ ';
        let badgeLabel = p.badge;

        const b = p.badge.toLowerCase();
        if (b === 'hot') { badgeClass = 'badge-hot'; badgeIcon = '🔥 '; }
        else if (b === 'new') { badgeClass = 'badge-new'; badgeIcon = '✨ '; }
        else if (b === 'limited') { badgeClass = 'badge-limited'; badgeIcon = '⭐ '; }
        else if (b === 'popular') { badgeClass = 'badge-popular'; badgeIcon = '🏆 '; }

        badgeHTML = `<div class="product-badge ${badgeClass}">${badgeIcon}${badgeLabel}</div>`;
      }

      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.category = p.category || 'all';
      card.id = p.id;
      card.dataset.name = p.name;
      card.dataset.price = p.price;
      card.dataset.emoji = p.emoji || '🏎️';

      card.innerHTML = `
        ${badgeHTML}
        <div class="product-img-wrap" 
          ${p.model_path ? `onmouseenter="aktifkan3D(this)" onmouseleave="matikan3D(this)" data-model="${p.model_path}"` : ''}>
          <img src="${p.img || 'assets/ferrari_static.png'}" class="product-img">
          ${p.model_path ? `
          <div class="model-hint">
            <i class="fas fa-cube"></i> <span>Klik/Hover untuk 3D</span>
          </div>` : ''}
          <div class="vignette-overlay"></div>
        </div>
        <div class="product-info">
          <div class="product-info-left">
            <div class="product-brand">${p.brand || 'Unbranded'}</div>
            <h3 class="product-name">${p.name}</h3>
            <div class="product-price-row">
              <div class="product-price">${formatRp(p.price)}</div>
              ${p.price_old ? `<div class="product-price-old">${formatRp(p.price_old)}</div>` : ''}
            </div>
          </div>
          <button class="add-to-cart-main add-to-cart-btn">
            <dotlottie-wc src="https://lottie.host/f243d374-dbaf-40c9-aae7-8966d16f3d00/j6hjZ0mPui.lottie"
              style="width: 25px;height: 25px" speed="1.5" autoplay loop></dotlottie-wc>
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    initCartButtons();

    // Re-attach observer for animation
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.product-card').forEach(el => observer.observe(el));

  } catch (error) {
    console.error('Error fetching products:', error);
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ef4444;">Gagal memuat produk. Coba lagi nanti.</p>';
  }
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

  // Fetch & render products dynamically
  fetchAndRenderProducts();

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
    loader.style.transform = 'scale(1.9)';
    loader.innerHTML = `
    <dotlottie-wc src="assets/Loading.lottie" style="width: 150px;height: 150px" autoplay loop></dotlottie-wc>
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
    model.style.touchAction = 'pan-y';
    model.setAttribute('auto-rotate', 'true');
    model.setAttribute('auto-rotate-delay', '0');
    model.setAttribute('interaction-prompt', 'none');
    model.setAttribute('camera-orbit', '250deg 75deg auto');
    model.setAttribute('camera-controls', '');
    model.setAttribute('bounds', 'tight');
    model.setAttribute('rotation-per-second', '300deg');

    model.addEventListener('load', () => {
      console.log("Model selesai dimuat!");
      loader.style.display = 'none';
      setTimeout(() => {
        model.dataset.justLoaded = 'false';
        model.rotationPerSecond = "50deg";
      }, 700);

      setTimeout(() => {
        model.style.transform = 'scale(1.3)';
        model.style.transition = 'transform 0.7s ease-in-out';
      }, 0);
    });

    model.addEventListener('wheel', (event) => {
      // Membiarkan scroll halaman jika tidak menekan tombol Ctrl (opsional)
      if (!event.ctrlKey) {
        event.stopPropagation();
      }
    }, { capture: true });

    model.setAttribute('shadow-intensity', '2');
    model.setAttribute('shadow-softness', '1');
    model.setAttribute('environment-image', 'neutral');
    model.setAttribute('ar-placement', 'floor');
    model.style.backgroundColor = '#0a0e18';
    model.setAttribute('disable-tap', '');
    model.setAttribute('onclick', 'toggleRotation(this)');
    model.style.width = '100%';
    model.style.height = '100%';
    model.style.transform = 'scale(0.7)';

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
const API_URL = '/api';
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
      _suppressSync = true;
      cart = await res.json();
      updateBadge();
      renderCart();
      _suppressSync = false;
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
      _suppressSync = true;
      updateBadge();
      renderCart();
      _suppressSync = false;
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
const debouncedSync = debounce(syncCart, 800);

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

/* ─────────────────────────────────────────────────────
   ANALYTICS TRACKER
   Tambahkan snippet ini di bagian PALING BAWAH script.js,
   tepat sebelum closing tag </script> atau akhir file.
   ───────────────────────────────────────────────────── */

(function () {
  const API = '/api/analytics';

  // ── Session ID ───────────────────────────────────────
  let sessionId = sessionStorage.getItem('_sid');
  if (!sessionId) {
    sessionId = 'sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('_sid', sessionId);
  }
  const sessionStart = Date.now();

  // ── Pageview ─────────────────────────────────────────
  function trackPageview() {
    fetch(API + '/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        page: location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => { });
  }

  // ── Session end (durasi) ──────────────────────────────
  function trackSessionEnd() {
    const duration_sec = (Date.now() - sessionStart) / 1000;
    navigator.sendBeacon(
      API + '/session-end',
      JSON.stringify({ session_id: sessionId, duration_sec })
    );
  }

  // ── Product events ────────────────────────────────────
  function trackProductEvent(productId, eventType, durationMs) {
    fetch(API + '/product-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        event_type: eventType,
        session_id: sessionId,
        duration_ms: durationMs || null,
      }),
    }).catch(() => { });
  }

  // ── Attach hover tracking ke semua product cards ──────
  function attachHoverTracking() {
    document.querySelectorAll('.product-card[id]').forEach(card => {
      const productId = card.id;
      let hoverStart = null;

      card.addEventListener('mouseenter', () => {
        hoverStart = Date.now();
        trackProductEvent(productId, 'hover_start');
      });

      card.addEventListener('mouseleave', () => {
        if (hoverStart) {
          const durationMs = Date.now() - hoverStart;
          trackProductEvent(productId, 'hover_end', durationMs);
          hoverStart = null;
        }
      });
    });
  }

  // ── Attach cart tracking ──────────────────────────────
  // Intercept addToCart calls — hook ke event delegation
  document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart-btn');
    if (!btn) return;
    const card = btn.closest('.product-card[id]');
    if (!card) return;
    // Tunggu sebentar agar cart logic jalan dulu
    setTimeout(() => trackProductEvent(card.id, 'cart_add'), 100);
  });

  // ── Init ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    trackPageview();
    attachHoverTracking();

    // Re-attach jika produk dirender ulang (products.html)
    const grid = document.getElementById('productsGrid');
    if (grid) {
      new MutationObserver(() => attachHoverTracking())
        .observe(grid, { childList: true });
    }
  });

  window.addEventListener('beforeunload', trackSessionEnd);
  window.addEventListener('pagehide', trackSessionEnd);
})();