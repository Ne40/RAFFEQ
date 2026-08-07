import { PRODUCTS } from './data.js';
import { formatMoney, toast, escapeHtml } from './app.js';

const page = document.body.dataset.page;

function getCart() {
  try { return JSON.parse(localStorage.getItem('rafeeq-cart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('rafeeq-cart', JSON.stringify(cart));
}

export function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const item = cart.find((entry) => entry.productId === productId);
  if (item) item.quantity += quantity;
  else cart.push({ productId, quantity });
  saveCart(cart);
  toast('تمت إضافة المنتج إلى السلة', 'success');
}

function productCard(product) {
  return `<article class="product-card">
    <a href="product-details.html?id=${product.id}" class="product-card-image-wrap">
      <img src="${product.image}" alt="${escapeHtml(product.name)}">
      <span class="availability-badge">${product.availability}</span>
    </a>
    <div class="product-card-body">
      <small>${product.category} • ${product.supplier}</small>
      <h3><a href="product-details.html?id=${product.id}">${escapeHtml(product.name)}</a></h3>
      <div class="product-rating">★ ${product.rating}</div>
      <div class="product-bottom">
        <span class="price">${formatMoney(product.price)}</span>
        <button class="icon-btn" data-add-cart="${product.id}" aria-label="أضف للسلة">＋</button>
      </div>
    </div>
  </article>`;
}

function bindAddButtons() {
  document.querySelectorAll('[data-add-cart]').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.addCart));
  });
}

function initMarketplace() {
  const grid = document.getElementById('product-grid');
  const search = document.getElementById('product-search');
  const filters = document.querySelectorAll('[data-category]');
  let activeCategory = 'all';

  function render() {
    const query = (search?.value || '').trim().toLowerCase();
    const list = PRODUCTS.filter((product) => {
      const categoryMatch = activeCategory === 'all' || product.category === activeCategory;
      const searchMatch = !query || product.name.toLowerCase().includes(query) || product.description.toLowerCase().includes(query) || product.supplier.toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : '<div class="empty-state" style="grid-column:1/-1"><div class="emoji">🔎</div><h3>لا توجد منتجات مطابقة</h3></div>';
    bindAddButtons();
  }

  search?.addEventListener('input', render);
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      filters.forEach((item) => item.classList.remove('active'));
      filter.classList.add('active');
      activeCategory = filter.dataset.category;
      render();
    });
  });
  render();
}

function branchModalMarkup(product) {
  return `<div class="modal-backdrop" id="branch-modal" role="dialog" aria-modal="true" aria-label="أقرب الفروع">
    <div class="modal-card branch-modal-card">
      <div class="section-card-head"><div><h3>أقرب الفروع</h3><small>${escapeHtml(product.supplier)}</small></div><button class="icon-btn" data-close-branch>×</button></div>
      <div class="branch-list">${product.branches.map((branch) => `
        <article class="branch-card">
          <div><span class="pill success">${branch.distance}</span><h4>${escapeHtml(branch.name)}</h4><p>${escapeHtml(branch.address)}</p><a href="tel:${branch.phone.replaceAll(' ', '')}">${escapeHtml(branch.phone)}</a></div>
          <div class="branch-qr"><img src="${branch.qr}" alt="QR Code للوصول إلى ${escapeHtml(branch.name)}"><a class="btn btn-light" target="_blank" rel="noopener" href="${branch.mapUrl}">فتح الخريطة</a></div>
        </article>`).join('')}</div>
    </div>
  </div>`;
}

function initProduct360(holder) {
  let rotationY = 0;
  let rotationX = 0;
  let scale = 1;
  let autoTimer = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startRotationY = 0;
  let startRotationX = 0;
  const image = holder.querySelector('[data-product-360-image]');
  const viewer = holder.querySelector('[data-product-360]');
  const status = holder.querySelector('[data-360-status]');

  const apply = () => {
    image.style.transform = `perspective(1000px) rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${scale})`;
    if (status) status.textContent = `أفقي ${Math.round(rotationY % 360)}° • رأسي ${Math.round(rotationX)}° • تكبير ${Math.round(scale * 100)}%`;
  };
  const rotate = () => {
    rotationY = (rotationY + 2) % 360;
    apply();
  };
  holder.querySelector('[data-toggle-product-360]')?.addEventListener('click', (event) => {
    const active = viewer.classList.toggle('active');
    event.currentTarget.textContent = active ? 'إيقاف الدوران التلقائي' : 'تشغيل 360°';
    if (active) autoTimer = setInterval(rotate, 40);
    else clearInterval(autoTimer);
  });
  viewer?.addEventListener('pointerdown', (event) => {
    clearInterval(autoTimer);
    viewer.classList.remove('active');
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startRotationY = rotationY;
    startRotationX = rotationX;
    viewer.setPointerCapture(event.pointerId);
  });
  viewer?.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    rotationY = startRotationY + (event.clientX - startX) * 0.7;
    rotationX = Math.max(-45, Math.min(45, startRotationX - (event.clientY - startY) * 0.35));
    apply();
  });
  viewer?.addEventListener('pointerup', () => { dragging = false; });
  viewer?.addEventListener('wheel', (event) => {
    event.preventDefault();
    scale = Math.max(0.7, Math.min(1.8, scale + (event.deltaY < 0 ? 0.08 : -0.08)));
    apply();
  }, { passive: false });
  holder.querySelector('[data-zoom-in]')?.addEventListener('click', () => { scale = Math.min(1.8, scale + 0.1); apply(); });
  holder.querySelector('[data-zoom-out]')?.addEventListener('click', () => { scale = Math.max(0.7, scale - 0.1); apply(); });
  holder.querySelector('[data-reset-360]')?.addEventListener('click', () => { rotationY = 0; rotationX = 0; scale = 1; apply(); });
  apply();
}

function initProductDetails() {
  const id = new URLSearchParams(location.search).get('id') || PRODUCTS[0].id;
  const product = PRODUCTS.find((item) => item.id === id) || PRODUCTS[0];
  const holder = document.getElementById('product-detail');
  let quantity = 1;
  let activeImage = product.gallery?.[0] || product.image;

  holder.innerHTML = `
    <div class="product-gallery-v2">
      <div class="product-main-image product-3d-viewer" data-product-360><img data-product-360-image src="${activeImage}" alt="${escapeHtml(product.name)}"><div class="viewer-axis-hint">اسحب أفقيًا ورأسيًا • استخدم عجلة الماوس للتكبير</div></div>
      <div class="product-gallery-actions"><button class="btn btn-light" data-toggle-product-360>تشغيل 360°</button><button class="icon-btn" data-zoom-in title="تكبير">＋</button><button class="icon-btn" data-zoom-out title="تصغير">−</button><button class="icon-btn" data-reset-360 title="إعادة الضبط">↺</button><span class="pill success">${product.availability}</span></div><small class="viewer-status" data-360-status></small>
      <div class="product-thumbnails">${(product.gallery || [product.image]).map((image, index) => `<button class="${index === 0 ? 'active' : ''}" data-gallery-image="${image}"><img src="${image}" alt="صورة ${index + 1}"></button>`).join('')}</div>
    </div>
    <div class="panel product-info-panel">
      <span class="eyebrow">${product.category}</span>
      <h1>${escapeHtml(product.name)}</h1>
      <div class="product-rating">★ ${product.rating} • 28 مراجعة</div>
      <p class="product-price-large">${formatMoney(product.price)}</p>
      <p>${escapeHtml(product.description)}</p>
      <div class="product-spec-grid">
        <div><span>المقاسات</span><strong>${escapeHtml(product.dimensions)}</strong></div>
        <div><span>الخامات</span><strong>${escapeHtml(product.material)}</strong></div>
        <div><span>الشركة / المورد</span><strong>${escapeHtml(product.supplier)}</strong></div>
        <div><span>المخزون</span><strong>${product.stock} قطع</strong></div>
      </div>
      <div class="available-colors"><span>الألوان المتوفرة</span><div>${product.colors.map((color) => `<button type="button">${escapeHtml(color)}</button>`).join('')}</div></div>
      <div class="product-buy-row">
        <div class="quantity"><button id="qty-minus">−</button><span id="qty-value">1</span><button id="qty-plus">＋</button></div>
        <button class="btn btn-primary" id="detail-add-cart">إضافة إلى السلة</button>
        <button class="btn btn-secondary" id="buy-now">شراء الآن</button>
      </div>
      <button class="btn btn-dark btn-block" id="nearest-branch" style="margin-top:12px">📍 عرض أقرب فرع</button>
    </div>`;

  holder.querySelectorAll('[data-gallery-image]').forEach((button) => {
    button.addEventListener('click', () => {
      holder.querySelectorAll('[data-gallery-image]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      activeImage = button.dataset.galleryImage;
      holder.querySelector('[data-product-360-image]').src = activeImage;
    });
  });

  const qtyValue = document.getElementById('qty-value');
  document.getElementById('qty-minus').addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    qtyValue.textContent = quantity;
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    quantity += 1;
    qtyValue.textContent = quantity;
  });
  document.getElementById('detail-add-cart').addEventListener('click', () => addToCart(product.id, quantity));
  document.getElementById('buy-now').addEventListener('click', () => {
    addToCart(product.id, quantity);
    location.href = 'checkout.html';
  });
  document.getElementById('nearest-branch').addEventListener('click', () => {
    document.body.insertAdjacentHTML('beforeend', branchModalMarkup(product));
    document.body.classList.add('no-scroll');
    document.querySelector('[data-close-branch]')?.addEventListener('click', closeBranchModal);
    document.getElementById('branch-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'branch-modal') closeBranchModal();
    });
  });

  initProduct360(holder);

  const related = document.getElementById('related-products');
  if (related) {
    related.innerHTML = PRODUCTS.filter((item) => item.id !== product.id).slice(0, 4).map(productCard).join('');
    bindAddButtons();
  }
}

function closeBranchModal() {
  document.getElementById('branch-modal')?.remove();
  document.body.classList.remove('no-scroll');
}

if (page === 'marketplace') initMarketplace();
if (page === 'product-details') initProductDetails();
