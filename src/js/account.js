
import { supabase } from './supabase-client.js';
import { requireAuth, getProfile, toast, formatMoney } from './app.js';

const page = document.body.dataset.page;

async function initProjects() {
  const session = await requireAuth();
  if (!session) return;
  const holder = document.getElementById('projects-list');
  const tabs = document.querySelectorAll('[data-project-filter]');
  let filter = 'all';

  async function render() {
    holder.innerHTML = '<div class="skeleton" style="height:240px;grid-column:1/-1"></div>';
    let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) {
      holder.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>تعذر تحميل المشروعات</h3><p>${error.message}</p></div>`;
      return;
    }
    holder.innerHTML = data?.length ? data.map((project) => `
      <article class="project-card">
        <div class="project-cover"></div>
        <div class="project-info">
          <div style="display:flex;justify-content:space-between;gap:12px">
            <h4>${project.title}</h4>
            <span class="pill ${project.status === 'completed' ? 'success' : 'warning'}">${project.status}</span>
          </div>
          <div class="project-meta"><span>🏠 ${project.room_type || 'غير محدد'}</span><span>📍 ${project.city || 'غير محدد'}</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
            <a class="btn btn-light" href="ai-result.html" style="min-height:38px;padding:6px 12px">عرض</a>
            <button class="btn btn-ghost" data-delete-project="${project.id}" style="min-height:38px;padding:6px 12px">حذف</button>
          </div>
        </div>
      </article>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">📁</div><h3>لا توجد مشروعات في هذا القسم</h3><a href="profession.html" class="btn btn-primary">إنشاء مشروع</a></div>`;

    holder.querySelectorAll('[data-delete-project]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('حذف المشروع نهائيًا؟')) return;
        const { error: deleteError } = await supabase.from('projects').delete().eq('id', button.dataset.deleteProject);
        if (deleteError) toast(deleteError.message, 'error');
        else {
          toast('تم حذف المشروع', 'success');
          render();
        }
      });
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      filter = tab.dataset.projectFilter;
      render();
    });
  });
  render();
}

function initSavedDesigns() {
  const holder = document.getElementById('saved-designs-list');
  let designs = JSON.parse(localStorage.getItem('rafeeq-saved-designs') || '[]');

  function render() {
    holder.innerHTML = designs.length ? designs.map((design) => `
      <article class="product-card">
        <img src="${design.image}" alt="${design.title}">
        <div class="product-card-body">
          <small>${new Date(design.created_at).toLocaleDateString('ar-EG')}</small>
          <h3>${design.title}</h3>
          <p class="muted">${design.style}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-light" data-reuse-design="${design.id}" style="min-height:38px;padding:7px 12px">إعادة الاستخدام</button>
            <button class="btn btn-ghost" data-download-design="${design.id}" style="min-height:38px;padding:7px 12px">تحميل</button>
            <button class="btn btn-danger" data-delete-design="${design.id}" style="min-height:38px;padding:7px 12px">حذف</button>
          </div>
        </div>
      </article>`).join('') : '<div class="empty-state" style="grid-column:1/-1"><div class="emoji">♡</div><h3>لا توجد تصميمات محفوظة</h3><a class="btn btn-primary" href="profession.html">ابدأ تصميمًا جديدًا</a></div>';

    holder.querySelectorAll('[data-delete-design]').forEach((button) => button.addEventListener('click', () => {
      designs = designs.filter((item) => item.id !== button.dataset.deleteDesign);
      localStorage.setItem('rafeeq-saved-designs', JSON.stringify(designs));
      render();
    }));
    holder.querySelectorAll('[data-download-design]').forEach((button) => button.addEventListener('click', () => window.print()));
    holder.querySelectorAll('[data-reuse-design]').forEach((button) => button.addEventListener('click', () => {
      const design = designs.find((item) => item.id === button.dataset.reuseDesign);
      localStorage.setItem('rafeeq-project-draft-v2', JSON.stringify({ projectName: `${design.title} - نسخة`, style: design.style, currentStep: 0 }));
      location.href = 'profession.html';
    }));
  }
  render();
}

async function initProfile() {
  const session = await requireAuth();
  if (!session) return;
  const profile = await getProfile(session.user.id);
  const form = document.getElementById('profile-form');
  const name = profile?.full_name || session.user.user_metadata?.full_name || '';
  const accountType = profile?.account_type || session.user.user_metadata?.account_type || 'user';
  const accountLabels = {
    user: 'مستخدم',
    interior_designer: 'مصمم داخلي',
    company: 'شركة أثاث',
    engineering_office: 'مكتب هندسي'
  };

  document.getElementById('profile-name').textContent = name || 'مستخدم RAFEEQ';
  document.getElementById('profile-email').textContent = session.user.email || '';
  document.getElementById('profile-avatar').textContent = (name || 'R').charAt(0).toUpperCase();
  const typeHolder = document.getElementById('profile-account-type');
  if (typeHolder) typeHolder.textContent = accountLabels[accountType] || 'مستخدم';

  form.elements.full_name.value = name;
  form.elements.email.value = session.user.email || '';
  form.elements.phone.value = profile?.phone || '';
  if (form.elements.account_type) form.elements.account_type.value = accountType;
  if (form.elements.company_name) form.elements.company_name.value = profile?.company_name || '';
  if (form.elements.bio) form.elements.bio.value = profile?.bio || '';
  if (form.elements.portfolio_url) form.elements.portfolio_url.value = profile?.portfolio_url || '';

  const professionalFields = document.getElementById('professional-profile-fields');
  if (professionalFields) professionalFields.hidden = accountType === 'user';
  const companyNameLabel = document.getElementById('company-name-label');
  if (companyNameLabel) {
    companyNameLabel.textContent = accountType === 'company' ? 'اسم الشركة' : accountType === 'engineering_office' ? 'اسم المكتب' : 'الاسم المهني / اسم الاستوديو';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const updates = {
      full_name: data.full_name.trim(),
      phone: data.phone.trim() || null,
      company_name: data.company_name?.trim() || null,
      bio: data.bio?.trim() || null,
      portfolio_url: data.portfolio_url?.trim() || null
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
    if (error) toast(error.message, 'error');
    else toast('تم تحديث البيانات', 'success');
  });

  document.getElementById('change-password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('new_password');
    if (String(password).length < 8) return toast('كلمة المرور يجب ألا تقل عن 8 أحرف', 'error');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast(error.message, 'error');
    else {
      toast('تم تغيير كلمة المرور', 'success');
      event.currentTarget.reset();
    }
  });
}

function initSettings() {
  const theme = document.getElementById('theme-setting');
  const notifications = document.getElementById('notifications-setting');
  const language = document.getElementById('language-setting');
  const privacy = document.getElementById('privacy-setting');

  theme.value = localStorage.getItem('rafeeq-theme') || 'light';
  notifications.checked = localStorage.getItem('rafeeq-notifications') !== 'false';
  language.value = localStorage.getItem('rafeeq-language') || 'ar';
  privacy.checked = localStorage.getItem('rafeeq-privacy') === 'true';

  theme.addEventListener('change', () => {
    localStorage.setItem('rafeeq-theme', theme.value);
    document.documentElement.dataset.theme = theme.value;
    toast('تم تغيير المظهر', 'success');
  });
  notifications.addEventListener('change', () => localStorage.setItem('rafeeq-notifications', notifications.checked));
  language.addEventListener('change', () => {
    localStorage.setItem('rafeeq-language', language.value);
    toast('تم حفظ اللغة. واجهة الترجمة الكاملة جاهزة للربط لاحقًا.', 'success');
  });
  privacy.addEventListener('change', () => localStorage.setItem('rafeeq-privacy', privacy.checked));
}

if (page === 'projects') initProjects();
if (page === 'saved-designs') initSavedDesigns();
if (page === 'profile') initProfile();
if (page === 'settings') initSettings();
