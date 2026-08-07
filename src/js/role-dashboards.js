import { PRODUCTS } from './data.js';
import { formatMoney, escapeHtml, toast } from './app.js';

const page = document.body.dataset.page;
const COMPANY_PRODUCTS_KEY = 'rafeeq-company-products-v3';

function initProviderTabs() {
  const buttons = [...document.querySelectorAll('[data-provider-tab]')];
  const panels = [...document.querySelectorAll('[data-provider-panel]')];
  if (!buttons.length) return;
  const allowed = new Set(buttons.map((button) => button.dataset.providerTab));
  const setActive = (key, updateHash = true) => {
    const resolved = allowed.has(key) ? key : buttons[0].dataset.providerTab;
    buttons.forEach((button) => button.classList.toggle('active', button.dataset.providerTab === resolved));
    panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.providerPanel !== resolved));
    if (updateHash) history.replaceState(null, '', `#${resolved}`);
  };
  buttons.forEach((button) => button.addEventListener('click', () => setActive(button.dataset.providerTab)));
  setActive(location.hash.replace('#', ''), false);
  window.addEventListener('hashchange', () => setActive(location.hash.replace('#', ''), false));
}

function bindDemoActions() {
  document.querySelectorAll('[data-demo-action]').forEach((button) => {
    button.addEventListener('click', () => toast(button.dataset.demoAction || 'تم تنفيذ الإجراء التجريبي', 'success'));
  });
  document.querySelectorAll('[data-demo-save]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      toast('تم حفظ الإعدادات محليًا في النسخة التجريبية', 'success');
    });
  });
}

function statusPill(status) {
  const success = ['تم التسليم', 'مدفوع', 'مكتمل', 'جاهز للتسليم', 'مقبول', 'متاح', 'مستلمة', 'تم التحويل', 'تمت الموافقة'].includes(status);
  return `<span class="pill ${success ? 'success' : 'warning'}">${escapeHtml(status)}</span>`;
}

function analyticsProductRow(product, value, suffix = 'مبيعة') {
  return `<div class="list-item"><img src="${product.image}" alt="${product.name}" style="width:52px;height:52px;border-radius:12px;background:#f2eee6"><div style="flex:1"><strong>${product.name}</strong><small style="display:block">${product.supplier}</small></div><strong>${value} ${suffix}</strong></div>`;
}

function getCompanyProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPANY_PRODUCTS_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* use seed */ }
  const seed = PRODUCTS.map((product, index) => ({
    ...product,
    active: true,
    discount: index % 3 === 0 ? 10 : 0,
    delivery: index % 2 === 0 ? '3–5 أيام' : '7–10 أيام',
    view_count: [5800, 4900, 4200, 3600, 3100, 2800][index] || 1200,
    sales_count: [184, 143, 126, 98, 74, 61][index] || 20
  }));
  localStorage.setItem(COMPANY_PRODUCTS_KEY, JSON.stringify(seed));
  return seed;
}

function saveCompanyProducts(products) {
  localStorage.setItem(COMPANY_PRODUCTS_KEY, JSON.stringify(products));
}

function companyProductModal(product = null) {
  const editing = Boolean(product);
  return `<div class="modal-backdrop" id="company-product-dialog"><form class="modal-card form-grid company-product-form" id="company-product-form">
    <div class="section-card-head"><div><h3>${editing ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3><small>بيانات المنتج الأساسية والعرض 3D والمخزون.</small></div><button class="icon-btn" type="button" data-close-product-modal>×</button></div>
    <input type="hidden" name="id" value="${product?.id || ''}">
    <div class="form-row"><div><label>اسم المنتج</label><input name="name" required value="${escapeHtml(product?.name || '')}"></div><div><label>الفئة</label><select name="category"><option value="sofas">أرائك</option><option value="chairs">كراسي</option><option value="tables">طاولات</option><option value="lighting">إضاءة</option><option value="decor">ديكور</option><option value="storage">تخزين</option></select></div></div>
    <div><label>الوصف</label><textarea name="description" required>${escapeHtml(product?.description || '')}</textarea></div>
    <div class="form-row"><div><label>السعر</label><input name="price" type="number" min="0" required value="${product?.price || ''}"></div><div><label>الخصم %</label><input name="discount" type="number" min="0" max="100" value="${product?.discount || 0}"></div></div>
    <div class="form-row"><div><label>المقاسات</label><input name="dimensions" value="${escapeHtml(product?.dimensions || '')}"></div><div><label>الخامات</label><input name="material" value="${escapeHtml(product?.material || '')}"></div></div>
    <div class="form-row"><div><label>الألوان</label><input name="colors" value="${escapeHtml((product?.colors || []).join('، '))}"></div><div><label>الكمية المتوفرة</label><input name="stock" type="number" min="0" value="${product?.stock ?? 0}"></div></div>
    <div class="form-row"><div><label>مدة التصنيع أو التسليم</label><input name="delivery" value="${escapeHtml(product?.delivery || '')}"></div><div><label>رابط نموذج 3D / 360°</label><input name="panorama_url" placeholder="اختياري"></div></div>
    <label class="checkbox-inline"><input name="active" type="checkbox" ${product?.active !== false ? 'checked' : ''}> المنتج متاح للعرض والشراء</label>
    <button class="btn btn-primary" type="submit">حفظ المنتج</button>
  </form></div>`;
}

function initCompanyDashboard() {
  const chart = document.getElementById('sales-chart');
  if (chart) {
    const values = [42, 58, 48, 72, 86, 94];
    const months = ['فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'];
    chart.innerHTML = values.map((value, index) => `<div class="bar-column"><span style="height:${value}%"><b>${value}K</b></span><small>${months[index]}</small></div>`).join('');
  }
  const qrChart = document.getElementById('qr-chart');
  if (qrChart) qrChart.innerHTML = [28, 36, 31, 48, 55, 72, 68, 84, 91].map((v) => `<span style="height:${v}%"></span>`).join('');
  const selling = document.getElementById('top-selling-products');
  const viewed = document.getElementById('top-viewed-products');
  if (selling) selling.innerHTML = PRODUCTS.slice(0, 4).map((product, index) => analyticsProductRow(product, [184, 143, 126, 98][index])).join('');
  if (viewed) viewed.innerHTML = PRODUCTS.slice(2, 6).map((product, index) => analyticsProductRow(product, ['5.8K', '4.9K', '4.2K', '3.6K'][index], 'مشاهدة')).join('');

  const insights = document.getElementById('company-ai-insights');
  if (insights) insights.innerHTML = [
    ['✨', 'الأكثر اقتراحًا', 'الأريكة المودرن ظهرت في 428 تصميمًا هذا الشهر.'],
    ['🎨', 'ألوان مطلوبة', 'البيج والأبيض يمثلان 61% من اختيارات العملاء.'],
    ['📉', 'ظهور مرتفع وشراء منخفض', 'وحدة التخزين تحتاج صورة رئيسية أوضح وسعرًا تنافسيًا.'],
    ['💡', 'اقتراح منتج جديد', 'يوجد طلب متزايد على مكاتب صغيرة للعمل من المنزل.'],
    ['🧵', 'خامات رائجة', 'الخشب الطبيعي والكتان هما الأكثر استخدامًا مع منتجاتك.'],
    ['🛒', 'أعلى معدل شراء', 'الإضاءة المعلقة تحقق تحويلًا بنسبة 14.8%.']
  ].map(([icon, title, text]) => `<article><span>${icon}</span><div><strong>${title}</strong><p>${text}</p></div></article>`).join('');

  let products = getCompanyProducts();
  const tbody = document.getElementById('company-products-table');
  const count = document.getElementById('company-product-count');
  const renderProducts = () => {
    if (count) count.textContent = products.length;
    if (!tbody) return;
    tbody.innerHTML = products.map((product) => `<tr><td><div class="table-product"><img src="${product.image}" alt=""><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.material || '')}</small></div></div></td><td>${escapeHtml(product.category)}</td><td>${formatMoney(product.price)}</td><td>${product.stock}</td><td>${Number(product.view_count || 0).toLocaleString('ar-EG')}</td><td>${statusPill(product.active ? 'متاح' : 'متوقف')}</td><td><div class="table-actions"><button data-edit-company-product="${product.id}">تعديل</button><button data-toggle-company-product="${product.id}">${product.active ? 'إيقاف' : 'تفعيل'}</button><button class="danger" data-delete-company-product="${product.id}">حذف</button></div></td></tr>`).join('');
    tbody.querySelectorAll('[data-edit-company-product]').forEach((button) => button.addEventListener('click', () => openProductModal(products.find((item) => item.id === button.dataset.editCompanyProduct))));
    tbody.querySelectorAll('[data-toggle-company-product]').forEach((button) => button.addEventListener('click', () => {
      const product = products.find((item) => item.id === button.dataset.toggleCompanyProduct);
      if (product) product.active = !product.active;
      saveCompanyProducts(products); renderProducts();
    }));
    tbody.querySelectorAll('[data-delete-company-product]').forEach((button) => button.addEventListener('click', () => {
      products = products.filter((item) => item.id !== button.dataset.deleteCompanyProduct);
      saveCompanyProducts(products); renderProducts(); toast('تم حذف المنتج من النسخة التجريبية', 'success');
    }));
  };

  const modalHolder = document.getElementById('company-product-modal');
  const openProductModal = (product = null) => {
    modalHolder.innerHTML = companyProductModal(product);
    document.body.classList.add('no-scroll');
    if (product) modalHolder.querySelector('[name="category"]').value = product.category;
    modalHolder.querySelector('[data-close-product-modal]')?.addEventListener('click', closeProductModal);
    modalHolder.querySelector('#company-product-dialog')?.addEventListener('click', (event) => { if (event.target.id === 'company-product-dialog') closeProductModal(); });
    modalHolder.querySelector('#company-product-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const existing = products.find((item) => item.id === data.id);
      const row = {
        ...(existing || {}),
        id: existing?.id || `company-${Date.now()}`,
        name: data.name,
        category: data.category,
        description: data.description,
        price: Number(data.price),
        discount: Number(data.discount || 0),
        dimensions: data.dimensions,
        material: data.material,
        colors: String(data.colors || '').split(/[،,]/).map((item) => item.trim()).filter(Boolean),
        stock: Number(data.stock || 0),
        delivery: data.delivery,
        panorama_url: data.panorama_url,
        active: event.currentTarget.elements.active.checked,
        supplier: 'شركتك',
        rating: existing?.rating || 5,
        image: existing?.image || PRODUCTS[0].image,
        view_count: existing?.view_count || 0,
        sales_count: existing?.sales_count || 0
      };
      if (existing) Object.assign(existing, row); else products.unshift(row);
      saveCompanyProducts(products); renderProducts(); closeProductModal(); toast('تم حفظ المنتج', 'success');
    });
  };
  const closeProductModal = () => { modalHolder.innerHTML = ''; document.body.classList.remove('no-scroll'); };
  document.querySelectorAll('[data-company-add-product]').forEach((button) => button.addEventListener('click', () => openProductModal()));
  renderProducts();

  const orders = [
    ['RF-2048', 'أحمد محمد', 'أريكة + إضاءة', 48900, 'مدفوع', 'القاهرة الجديدة', 'جديد'],
    ['RF-2047', 'نورهان علي', 'طاولة قهوة', 11500, 'مدفوع', 'الشيخ زايد', 'جاري التنفيذ'],
    ['RF-2044', 'محمود سمير', 'كرسي قراءة', 14800, 'مدفوع', 'مدينة نصر', 'جاهز للشحن'],
    ['RF-2038', 'سلمى حسن', 'سجادة', 8400, 'مدفوع', 'المعادي', 'تم التسليم']
  ];
  const ordersTable = document.getElementById('company-orders-table');
  if (ordersTable) ordersTable.innerHTML = orders.map((order, index) => `<tr><td>${order[0]}</td><td>${order[1]}</td><td>${order[2]}</td><td>${formatMoney(order[3])}</td><td>${statusPill(order[4])}</td><td>${order[5]}</td><td><select data-order-status="${index}">${['جديد','جاري التنفيذ','جاهز للشحن','تم الشحن','تم التسليم','تم الإلغاء'].map((status) => `<option ${status === order[6] ? 'selected' : ''}>${status}</option>`).join('')}</select></td></tr>`).join('');
  ordersTable?.querySelectorAll('[data-order-status]').forEach((select) => select.addEventListener('change', () => toast(`تم تحديث حالة الطلب إلى: ${select.value}`, 'success')));

  const payments = document.getElementById('company-payments-list');
  if (payments) payments.innerHTML = [
    ['INV-8821', 'RF-2048', 48900, 'مدفوع', '28 يوليو 2026'],
    ['INV-8814', 'RF-2047', 11500, 'مدفوع', '27 يوليو 2026'],
    ['INV-8792', 'RF-2044', 14800, 'مستحق التحويل', '24 يوليو 2026']
  ].map((item) => `<article class="request-row"><div><strong>${item[0]}</strong><small>الطلب ${item[1]} • ${item[4]}</small></div><strong>${formatMoney(item[2])}</strong>${statusPill(item[3])}<button class="btn btn-light" data-demo-action="تم تجهيز الفاتورة للطباعة">الفاتورة</button></article>`).join('');
}

const engineeringProjects = [
  { client: 'أحمد محمود', type: 'غرفة معيشة', area: 32, budget: 180000, style: 'Modern', start: '2026-07-10', end: '2026-08-05', progress: 65, status: 'جاري التنفيذ' },
  { client: 'مريم سامح', type: 'شقة كاملة', area: 145, budget: 850000, style: 'Scandinavian', start: '2026-06-20', end: '2026-08-12', progress: 90, status: 'جاهز للتسليم' },
  { client: 'كريم عادل', type: 'مكتب', area: 78, budget: 420000, style: 'Industrial', start: '2026-07-25', end: '2026-09-01', progress: 25, status: 'جاري التنفيذ' }
];

function engineeringProjectCard(project) {
  return `<article class="provider-project-card"><div class="section-card-head"><div><strong>${project.type} — ${project.client}</strong><small>${project.style} • ${project.area} م²</small></div>${statusPill(project.status)}</div><div class="project-meta-grid"><span>الميزانية<strong>${formatMoney(project.budget)}</strong></span><span>البداية<strong>${project.start}</strong></span><span>التسليم المتوقع<strong>${project.end}</strong></span></div><div class="mini-progress"><span style="width:${project.progress}%"></span></div><small>نسبة الإنجاز ${project.progress}%</small></article>`;
}

function initEngineeringDashboard() {
  const current = document.getElementById('engineering-current-projects');
  if (current) current.innerHTML = engineeringProjects.slice(0, 2).map((project) => `<article class="provider-project-row"><div><strong>${project.type} — ${project.client}</strong><small>${project.style} • ${project.area} م²</small></div><div class="mini-progress"><span style="width:${project.progress}%"></span></div>${statusPill(project.status)}<a class="btn btn-light" href="chat.html">محادثة</a></article>`).join('');
  const alerts = document.getElementById('engineering-alerts');
  if (alerts) alerts.innerHTML = [
    ['📍','معاينة جديدة','اليوم 4:30 م — القاهرة الجديدة'],['🚚','موعد توريد','غدًا — مشروع مريم سامح'],['📄','عرض سعر','العميل كريم عادل بانتظار العرض']
  ].map(([icon,title,text]) => `<article class="list-item"><div class="list-icon">${icon}</div><div><strong>${title}</strong><small>${text}</small></div></article>`).join('');
  const grid = document.getElementById('engineering-projects-grid');
  if (grid) grid.innerHTML = engineeringProjects.map(engineeringProjectCard).join('');
  const schedule = document.getElementById('engineering-schedule');
  if (schedule) schedule.innerHTML = [
    ['8 أغسطس','معاينة موقع','التجمع الخامس','10:30 ص'],['9 أغسطس','زيارة متابعة','الشيخ زايد','2:00 م'],['12 أغسطس','تسليم مشروع','مشروع مريم سامح','5:30 م'],['15 أغسطس','بدء تنفيذ','مكتب كريم عادل','9:00 ص']
  ].map(([date,title,place,time]) => `<article><time>${date}</time><div><strong>${title}</strong><small>${place}</small></div><span>${time}</span></article>`).join('');
  const team = document.getElementById('engineering-team');
  if (team) team.innerHTML = [
    ['م. عمر حسن','مدير مشروع','3 مهام'],['م. ندى كريم','مهندسة موقع','5 مهام'],['أحمد فوزي','فني كهرباء','2 مهمة'],['خالد سمير','فني تشطيبات','4 مهام']
  ].map(([name,role,tasks],i) => `<article><span class="team-avatar">${name.charAt(0)}</span><strong>${name}</strong><small>${role}</small><span class="pill">${tasks}</span><button class="btn btn-light" data-demo-action="تم فتح تفاصيل عضو الفريق">إدارة</button></article>`).join('');
  const quotes = document.getElementById('engineering-quotes');
  if (quotes) quotes.innerHTML = [
    ['Q-3021','أحمد محمود',76000,'تمت الموافقة'],['Q-3020','كريم عادل',134000,'بانتظار العميل'],['Q-3016','سارة هشام',92500,'مسودة']
  ].map((q) => `<article class="request-row"><div><strong>${q[0]} — ${q[1]}</strong><small>عرض سعر وعقد تنفيذ</small></div><strong>${formatMoney(q[2])}</strong>${statusPill(q[3])}<button class="btn btn-light" data-demo-action="تم تجهيز العقد للطباعة">تحميل / طباعة</button></article>`).join('');
  const payments = document.getElementById('engineering-payments');
  if (payments) payments.innerHTML = [['دفعة مقدمة — أحمد محمود',38000,'مستلمة'],['دفعة مرحلة التشطيب — مريم سامح',120000,'مستلمة'],['دفعة نهائية — كريم عادل',67000,'مستحقة']].map((x) => `<article class="request-row"><div><strong>${x[0]}</strong><small>آخر تحديث: اليوم</small></div><strong>${formatMoney(x[1])}</strong>${statusPill(x[2])}</article>`).join('');
  const progress = document.getElementById('engineering-progress');
  if (progress) progress.innerHTML = engineeringProjects.slice(0,2).map((project) => `<article><div class="progress-gallery-head"><div><strong>${project.type} — ${project.client}</strong><small>صور قبل / أثناء / بعد التنفيذ</small></div><span>${project.progress}%</span></div><div class="progress-photo-row"><div>قبل التنفيذ</div><div>أثناء التنفيذ</div><div>بعد الانتهاء</div></div><input type="range" value="${project.progress}" min="0" max="100" data-demo-progress><textarea placeholder="ملاحظات المرحلة..."></textarea><button class="btn btn-primary" data-demo-action="تمت مشاركة تحديث التنفيذ مع العميل">مشاركة التحديث</button></article>`).join('');
  const reviews = document.getElementById('engineering-reviews');
  if (reviews) reviews.innerHTML = [['أحمد محمود','غرفة معيشة',5,'تنفيذ منظم والتزام بالمواعيد.'],['منى عادل','شقة كاملة',4,'جودة جيدة والتواصل ممتاز.']].map((r) => `<article><div><strong>${r[0]} — ${r[1]}</strong><span class="product-rating">${'★'.repeat(r[2])}</span><p>${r[3]}</p></div><button class="btn btn-light" data-demo-action="تم إرسال رد تجريبي على التقييم">رد</button></article>`).join('');
  const messages = document.getElementById('engineering-messages');
  if (messages) messages.innerHTML = [['أحمد محمود','أرسلت صور مرحلة الكهرباء.'],['مريم سامح','هل موعد التسليم ما زال ثابتًا؟'],['كريم عادل','تمت الموافقة على الخامات.']].map((m) => `<a class="list-item" href="chat.html"><div class="list-icon">${m[0].charAt(0)}</div><div><strong>${m[0]}</strong><small>${m[1]}</small></div></a>`).join('');
  const leads = document.getElementById('engineering-leads');
  if (leads) leads.innerHTML = [
    ['هبة محمد','شقة كاملة',140,780000,'Scandinavian','القاهرة',90],['أحمد سعيد','غرفة معيشة',35,190000,'Modern','الجيزة',60],['سمر علي','مكتب',60,280000,'Industrial','القاهرة',30]
  ].map((lead) => `<article class="lead-card"><div class="readiness ${lead[6] >= 80 ? 'high' : lead[6] >= 50 ? 'medium' : 'low'}">${lead[6]}%</div><h3>${lead[0]}</h3><p>${lead[1]} • ${lead[2]} م² • ${lead[4]}</p><div class="summary-row"><span>الميزانية</span><strong>${formatMoney(lead[3])}</strong></div><div class="summary-row"><span>المحافظة</span><strong>${lead[5]}</strong></div><div class="lead-actions"><button class="btn btn-primary" data-demo-action="تم قبول طلب التنفيذ تجريبيًا">قبول</button><button class="btn btn-light" data-demo-action="تم تجهيز عرض سعر تجريبي">عرض سعر</button><a class="btn btn-light" href="chat.html">محادثة</a></div></article>`).join('');
}

const designerRequests = [
  ['محمد أحمد','غرفة معيشة',32,160000,'Modern','القاهرة','2026-08-06','جديد'],
  ['سارة علي','غرفة أطفال',22,110000,'Scandinavian','الجيزة','2026-08-05','بانتظار معلومات'],
  ['كريم سمير','مكتب',18,95000,'Industrial','القاهرة','2026-08-04','جديد']
];

function initDesignerDashboard() {
  const holder = document.getElementById('designer-projects');
  if (holder) holder.innerHTML = [
    { name: 'غرفة معيشة — التجمع الخامس', client: 'محمد أحمد', status: 'جاري التصميم', progress: 70 },
    { name: 'غرفة أطفال — مدينة نصر', client: 'سارة علي', status: 'بانتظار الموافقة', progress: 45 },
    { name: 'مكتب منزلي — الشيخ زايد', client: 'كريم سمير', status: 'تعديلات نهائية', progress: 90 }
  ].map((project) => `<article class="provider-project-row"><div><strong>${project.name}</strong><small>العميل: ${project.client}</small></div><div class="mini-progress"><span style="width:${project.progress}%"></span></div><span class="pill warning">${project.status}</span><a class="btn btn-light" href="chat.html">محادثة</a></article>`).join('');
  const notifications = document.getElementById('designer-notifications');
  if (notifications) notifications.innerHTML = [['📩','طلب تصميم جديد','غرفة معيشة — القاهرة'],['💬','رسالة من سارة','هل يمكن تغيير الأرضية؟'],['★','تقييم جديد','5 نجوم على مشروع مكتب منزلي']].map((n) => `<article class="list-item"><div class="list-icon">${n[0]}</div><div><strong>${n[1]}</strong><small>${n[2]}</small></div></article>`).join('');
  const requests = document.getElementById('designer-requests');
  if (requests) requests.innerHTML = designerRequests.map((request) => `<article class="request-card"><div class="section-card-head"><div><h3>${request[0]}</h3><small>${request[5]} • ${request[6]}</small></div>${statusPill(request[7])}</div><div class="summary-row"><span>المشروع</span><strong>${request[1]} — ${request[2]} م²</strong></div><div class="summary-row"><span>الميزانية</span><strong>${formatMoney(request[3])}</strong></div><div class="summary-row"><span>الاستايل</span><strong>${request[4]}</strong></div><div class="lead-actions"><button class="btn btn-primary" data-demo-action="تم قبول طلب التصميم تجريبيًا">قبول</button><button class="btn btn-light" data-demo-action="تم إرسال طلب معلومات إضافية">معلومات إضافية</button><button class="btn btn-light" data-demo-action="تم رفض الطلب تجريبيًا">رفض</button></div></article>`).join('');
  const myProjects = document.getElementById('designer-my-projects');
  if (myProjects) myProjects.innerHTML = designerRequests.map((request,index) => `<article class="provider-project-card"><div class="section-card-head"><div><strong>${request[1]} — ${request[0]}</strong><small>آخر تحديث: منذ ${index+1} يوم</small></div>${statusPill(index === 2 ? 'مراجعة العميل' : 'جاري التصميم')}</div><div class="design-thumb-placeholder">نسخة التصميم الحالية</div><div class="mini-progress"><span style="width:${[70,45,90][index]}%"></span></div><div class="lead-actions"><button class="btn btn-primary" data-demo-action="تم رفع نسخة تصميم جديدة">رفع نسخة</button><a class="btn btn-light" href="chat.html">الملاحظات</a></div></article>`).join('');
  const messages = document.getElementById('designer-messages');
  if (messages) messages.innerHTML = [['محمد أحمد','أرسلت صورة جديدة للمساحة.'],['سارة علي','هل يمكن تغيير لون الأرضية؟'],['كريم سمير','ملف PDF المرسل مناسب.']].map((m) => `<a class="list-item" href="chat.html"><div class="list-icon">${m[0].charAt(0)}</div><div><strong>${m[0]}</strong><small>${m[1]}</small></div></a>`).join('');
  const portfolio = document.getElementById('designer-portfolio');
  if (portfolio) portfolio.innerHTML = [
    ['شقة هادئة','شقة كاملة','Scandinavian','2026'],['مكتب إبداعي','مكتب','Industrial','2025'],['غرفة معيشة دافئة','غرفة معيشة','Bohemian','2025'],['غرفة أطفال مرنة','غرفة أطفال','Modern','2024']
  ].map((p,i) => `<article><div class="portfolio-image portfolio-${i+1}"></div><div><strong>${p[0]}</strong><small>${p[1]} • ${p[2]} • ${p[3]}</small></div><div class="table-actions"><button data-demo-action="تم فتح تعديل المشروع">تعديل</button><button class="danger" data-demo-action="تم حذف المشروع تجريبيًا">حذف</button></div></article>`).join('');
  const reviews = document.getElementById('designer-reviews');
  if (reviews) reviews.innerHTML = [['محمد أحمد','غرفة معيشة',5,'فهم المطلوب بسرعة وكانت التعديلات ممتازة.'],['سارة علي','غرفة أطفال',5,'التصميم عملي وآمن للأطفال.'],['كريم سمير','مكتب منزلي',4,'التوزيع والإضاءة مناسبين جدًا.']].map((r) => `<article><div><strong>${r[0]} — ${r[1]}</strong><span class="product-rating">${'★'.repeat(r[2])}</span><p>${r[3]}</p></div><button class="btn btn-light" data-demo-action="تم إرسال رد تجريبي">رد</button></article>`).join('');
  const earnings = document.getElementById('designer-earnings');
  if (earnings) earnings.innerHTML = [['تصميم غرفة معيشة',12500,'تم التحويل'],['تصميم غرفة أطفال',9800,'مستحق'],['تعديلات مكتب منزلي',6500,'تم التحويل']].map((e) => `<article class="request-row"><div><strong>${e[0]}</strong><small>فاتورة متاحة</small></div><strong>${formatMoney(e[1])}</strong>${statusPill(e[2])}<button class="btn btn-light" data-demo-action="تم تجهيز الفاتورة">الفاتورة</button></article>`).join('');
  const leads = document.getElementById('designer-leads');
  if (leads) leads.innerHTML = [
    ['نور حسن','غرفة معيشة',28,140000,'Bohemian',92,'تغيير الألوان وإضافة ركن قراءة'],['عمر محمود','مكتب',20,90000,'Minimalist',68,'تطوير تصميم AI ليكون عمليًا أكثر'],['هالة سمير','غرفة نوم',24,120000,'Scandinavian',45,'استشارة قبل التنفيذ']
  ].map((lead) => `<article class="lead-card"><div class="readiness ${lead[5] >= 80 ? 'high' : lead[5] >= 50 ? 'medium' : 'low'}">${lead[5]}%</div><h3>${lead[0]}</h3><p>${lead[1]} • ${lead[2]} م² • ${lead[4]}</p><div class="design-thumb-placeholder">تصميم AI الحالي</div><p>${lead[6]}</p><div class="lead-actions"><button class="btn btn-primary" data-demo-action="تم قبول الطلب تجريبيًا">قبول</button><button class="btn btn-light" data-demo-action="تم تجهيز عرض سعر">عرض سعر</button><a class="btn btn-light" href="chat.html">محادثة</a></div></article>`).join('');
  const schedule = document.getElementById('designer-schedule');
  if (schedule) schedule.innerHTML = [['8 أغسطس','اجتماع مراجعة','محمد أحمد','11:00 ص'],['9 أغسطس','تسليم نسخة أولى','سارة علي','4:00 م'],['11 أغسطس','مراجعة نهائية','كريم سمير','1:30 م']].map((x) => `<article><time>${x[0]}</time><div><strong>${x[1]}</strong><small>${x[2]}</small></div><span>${x[3]}</span></article>`).join('');
}

initProviderTabs();
if (page === 'company-dashboard') initCompanyDashboard();
if (page === 'engineering-dashboard') initEngineeringDashboard();
if (page === 'designer-dashboard') initDesignerDashboard();
bindDemoActions();
