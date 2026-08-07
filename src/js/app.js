import { supabase } from './supabase-client.js';

const page = document.body.dataset.page || '';
const layout = document.body.dataset.layout || 'public';
const protectedPage = document.body.dataset.protected === 'true';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;

const publicLinks = [
  ['index.html', 'الرئيسية', 'home'],
  ['about.html', 'من نحن', 'about'],
  ['index.html#services', 'الخدمات', 'services'],
  ['marketplace.html', 'المتجر', 'marketplace'],
  ['contact.html', 'تواصل', 'contact']
];

const userLinks = [
  ['dashboard.html', '⌂', 'لوحة التحكم', 'dashboard'],
  ['projects.html', '▦', 'مشاريعي', 'projects'],
  ['profession.html', '＋', 'مشروع جديد', 'profession'],
  ['service-request.html', '💬', 'طلب متخصص', 'service-request'],
  ['saved-designs.html', '♡', 'التصميمات المحفوظة', 'saved-designs'],
  ['marketplace.html', '⌑', 'متجر الأثاث', 'marketplace'],
  ['cart.html', '🛒', 'السلة', 'cart'],
  ['profile.html', '◎', 'الملف الشخصي', 'profile'],
  ['settings.html', '⚙', 'الإعدادات', 'settings']
];

const designerLinks = [
  ['designer-dashboard.html#overview', '⌂', 'لوحة المصمم', 'designer-dashboard'],
  ['designer-dashboard.html#requests', '📩', 'طلبات التصميم', 'designer-requests'],
  ['designer-dashboard.html#projects', '▦', 'مشاريعي', 'designer-projects'],
  ['designer-dashboard.html#portfolio', '▧', 'معرض الأعمال', 'designer-portfolio'],
  ['designer-dashboard.html#leads', '✨', 'AI Leads', 'designer-leads'],
  ['chat.html', '💬', 'المحادثات', 'chat'],
  ['profile.html', '◎', 'الملف الشخصي', 'profile']
];

const companyLinks = [
  ['company-dashboard.html#overview', '⌂', 'لوحة الشركة', 'company-dashboard'],
  ['company-dashboard.html#products', '🛋️', 'المنتجات', 'company-products'],
  ['company-dashboard.html#orders', '📦', 'الطلبات', 'company-orders'],
  ['company-dashboard.html#payments', '💳', 'المدفوعات', 'company-payments'],
  ['company-dashboard.html#settings', '⚙', 'الإعدادات', 'company-settings'],
  ['profile.html', '◎', 'بيانات الشركة', 'profile']
];

const engineeringLinks = [
  ['engineering-dashboard.html#overview', '⌂', 'لوحة المكتب', 'engineering-dashboard'],
  ['provider-requests.html', '📥', 'طلبات التنفيذ', 'provider-requests'],
  ['engineering-dashboard.html#projects', '▦', 'المشروعات', 'engineering-projects'],
  ['engineering-dashboard.html#schedule', '◷', 'الجدول الزمني', 'engineering-schedule'],
  ['engineering-dashboard.html#quotations', '📄', 'عروض الأسعار', 'engineering-quotes'],
  ['engineering-dashboard.html#leads', '✨', 'AI Leads', 'engineering-leads'],
  ['chat.html', '💬', 'المحادثات', 'chat'],
  ['profile.html', '◎', 'بيانات المكتب', 'profile']
];

export const ACCOUNT_TYPE_LABELS = {
  user: 'مستخدم',
  interior_designer: 'مصمم داخلي',
  company: 'شركة أثاث',
  engineering_office: 'مكتب هندسي',
  admin: 'Administrator'
};

export function dashboardForProfile(profile) {
  if (profile?.role === 'admin') return 'dashboard.html';
  switch (profile?.account_type) {
    case 'interior_designer': return 'designer-dashboard.html';
    case 'company': return 'company-dashboard.html';
    case 'engineering_office': return 'engineering-dashboard.html';
    default: return 'dashboard.html';
  }
}

function linksForProfile(profile) {
  if (profile?.role === 'admin') return userLinks;
  switch (profile?.account_type) {
    case 'interior_designer': return designerLinks;
    case 'company': return companyLinks;
    case 'engineering_office': return engineeringLinks;
    default: return userLinks;
  }
}

export function formatMoney(value) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toast(message, type = '') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`.trim();
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3800);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
    location.href = `login.html?next=${next}`;
    return null;
  }
  return session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Profile load failed:', error.message);
    return null;
  }
  return data;
}

function brandMarkup(className = 'brand') {
  return `<a class="${className}" href="index.html">
    <img src="${assetUrl('assets/logo-mark.jpg')}" alt="RAFEEQ logo">
    <strong>RAFEEQ</strong>
  </a>`;
}

async function renderPublicHeader() {
  const holder = document.getElementById('site-header');
  if (!holder) return;

  let session = null;
  let profile = null;
  try {
    session = await getSession();
    if (session) profile = await getProfile(session.user.id);
  } catch { /* public page still works */ }

  holder.innerHTML = `
    <div class="site-header-wrap">
      <header class="site-header">
        ${brandMarkup()}
        <button class="icon-btn mobile-menu-btn" id="mobile-menu-btn" aria-label="فتح القائمة">☰</button>
        <nav class="site-nav" id="site-nav">
          ${publicLinks.map(([href, label, key]) => `<a href="${href}" class="${page === key ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          ${session
            ? `<a class="btn btn-light" href="${dashboardForProfile(profile)}">لوحة التحكم</a>
               <button class="btn btn-primary" data-logout>تسجيل الخروج</button>`
            : `<a class="btn btn-light" href="login.html">تسجيل الدخول</a>
               <a class="btn btn-primary" href="register.html">إنشاء حساب</a>`}
        </div>
      </header>
    </div>`;

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('site-nav')?.classList.toggle('open');
  });
}

function renderFooter() {
  const holder = document.getElementById('site-footer');
  if (!holder) return;
  holder.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-col">
          ${brandMarkup()}
          <p style="color:rgba(255,255,255,.72);max-width:420px">رفيقك في كل خطوة من تصميم وتشطيب بيتك، من الفكرة وحتى اختيار الأثاث والتنفيذ.</p>
        </div>
        <div class="footer-col"><h4>المنصة</h4><a href="about.html">من نحن</a><a href="marketplace.html">المتجر</a><a href="contact.html">مركز المساعدة</a></div>
        <div class="footer-col"><h4>الخدمات</h4><a href="profession.html">تصميم بالذكاء الاصطناعي</a><a href="service-request.html">طلب مصمم أو مكتب</a><a href="saved-designs.html">التصميمات المحفوظة</a></div>
        <div class="footer-col"><h4>الحساب</h4><a href="login.html">تسجيل الدخول</a><a href="register.html">إنشاء حساب</a><a href="settings.html">الإعدادات</a></div>
      </div>
      <div class="container footer-bottom"><span>© ${new Date().getFullYear()} RAFEEQ</span><span>سياسة الخصوصية • الشروط والأحكام</span></div>
    </footer>`;
}

function renderSidebar(profile) {
  const holder = document.getElementById('app-sidebar');
  if (!holder) return;
  const appLinks = linksForProfile(profile);
  holder.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="app-sidebar" id="sidebar">
      <div class="sidebar-brand">${brandMarkup('sidebar-brand-inner')}</div>
      <nav class="sidebar-nav">
        ${appLinks.map(([href, icon, label, key]) =>
          `<a href="${href}" class="${page === key ? 'active' : ''}"><span>${icon}</span><span>${label}</span></a>`
        ).join('')}
      </nav>
      <div class="sidebar-bottom">
        <a href="contact.html" class="btn btn-light btn-block" style="margin-bottom:10px">مركز المساعدة</a>
        <button class="btn btn-primary btn-block" data-logout>تسجيل الخروج</button>
      </div>
    </aside>`;
}

async function renderTopbar(session, profile) {
  const holder = document.getElementById('app-topbar');
  if (!holder) return;
  const name = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'مستخدم';
  const initial = name.trim().charAt(0).toUpperCase();
  const typeKey = profile?.role === 'admin' ? 'admin' : (profile?.account_type || 'user');
  holder.innerHTML = `
    <header class="app-topbar">
      <div class="topbar-title">
        <h1>${document.body.dataset.title || 'RAFEEQ'}</h1>
        <p>${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(new Date())}</p>
      </div>
      <div class="topbar-actions">
        <button class="icon-btn topbar-menu" id="topbar-menu" style="display:none">☰</button>
        ${typeKey === 'user' || typeKey === 'admin' ? '<a class="icon-btn" href="cart.html" title="السلة">🛒</a>' : ''}
        <a class="user-chip" href="profile.html">
          <span class="avatar">${initial}</span>
          <span><strong>${escapeHtml(name)}</strong><small style="display:block">${ACCOUNT_TYPE_LABELS[typeKey] || 'مستخدم'}</small></span>
        </a>
      </div>
    </header>`;
  const menuButton = document.getElementById('topbar-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle = () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  };
  menuButton?.addEventListener('click', toggle);
  overlay?.addEventListener('click', toggle);
}

function initFaq() {
  document.querySelectorAll('.faq-item button').forEach((button) => {
    button.addEventListener('click', () => button.closest('.faq-item')?.classList.toggle('open'));
  });
}

function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'إظهار' : 'إخفاء';
    });
  });
}

async function bindLogout() {
  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.href = 'index.html';
    });
  });
}

function applyTheme() {
  const saved = localStorage.getItem('rafeeq-theme') || 'light';
  document.documentElement.dataset.theme = saved;
}

async function init() {
  applyTheme();
  initPasswordToggles();

  if (protectedPage) {
    const session = await requireAuth();
    if (!session) return;
    const profile = await getProfile(session.user.id);
    renderSidebar(profile);
    await renderTopbar(session, profile);
  } else if (layout === 'public') {
    await renderPublicHeader();
    renderFooter();
  }

  await bindLogout();
  initFaq();

  const urlMessage = new URLSearchParams(location.search).get('message');
  if (urlMessage) toast(urlMessage, 'success');
}

init().catch((error) => {
  console.error(error);
  toast(error.message || 'حدث خطأ غير متوقع', 'error');
});
