
import { supabase } from './supabase-client.js';
import { requireAuth, getProfile, formatMoney, toast } from './app.js';
import { DEMO_ORDERS, DEMO_NOTIFICATIONS } from './data.js';

function projectCard(project) {
  const statusMap = {
    draft: ['مسودة', 'warning'],
    active: ['نشط', 'success'],
    completed: ['مكتمل', 'success'],
    cancelled: ['ملغي', 'danger'],
    generating: ['جاري التوليد', 'warning']
  };
  const [label, className] = statusMap[project.status] || ['مسودة', 'warning'];
  return `
    <article class="project-card">
      <div class="project-cover"></div>
      <div class="project-info">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:start">
          <h4>${project.title || 'مشروع جديد'}</h4>
          <span class="pill ${className}">${label}</span>
        </div>
        <div class="project-meta">
          <span>🏠 ${project.room_type || project.property_type || 'غير محدد'}</span>
          <span>📍 ${project.city || 'غير محدد'}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <a class="btn btn-light" style="min-height:40px;padding:8px 13px" href="projects.html?id=${project.id}">فتح المشروع</a>
        </div>
      </div>
    </article>`;
}

async function loadDashboard() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getProfile(session.user.id);
  const welcome = document.getElementById('dashboard-welcome');
  if (welcome) {
    welcome.textContent = `مرحبًا ${profile?.full_name || session.user.user_metadata?.full_name || 'بك'} 👋`;
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    toast('تعذر تحميل المشروعات: ' + error.message, 'error');
  }

  const projectList = projects || [];
  const stats = {
    total: projectList.length,
    active: projectList.filter((p) => ['active', 'generating'].includes(p.status)).length,
    completed: projectList.filter((p) => p.status === 'completed').length,
    draft: projectList.filter((p) => p.status === 'draft').length
  };

  Object.entries(stats).forEach(([key, value]) => {
    const element = document.querySelector(`[data-stat="${key}"]`);
    if (element) element.textContent = value;
  });

  const grid = document.getElementById('recent-projects');
  if (grid) {
    grid.innerHTML = projectList.length
      ? projectList.slice(0, 4).map(projectCard).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
          <div class="emoji">🏡</div>
          <h3>لا توجد مشروعات حتى الآن</h3>
          <p>ابدأ أول مشروع وحدد بيانات المساحة والستايل والميزانية.</p>
          <a href="profession.html" class="btn btn-primary">إنشاء مشروع جديد</a>
        </div>`;
  }

  const notifications = document.getElementById('notifications-list');
  if (notifications) {
    notifications.innerHTML = DEMO_NOTIFICATIONS.map((item) => `
      <div class="list-item">
        <div class="list-icon">${item.icon}</div>
        <div><strong>${item.title}</strong><small style="display:block">${item.text}</small></div>
      </div>`).join('');
  }

  const orders = document.getElementById('orders-list');
  if (orders) {
    orders.innerHTML = DEMO_ORDERS.map((order) => `
      <div class="list-item">
        <div class="list-icon">📦</div>
        <div style="flex:1"><strong>${order.id}</strong><small style="display:block">${order.date}</small></div>
        <div style="text-align:left"><strong>${formatMoney(order.total)}</strong><small style="display:block">${order.status}</small></div>
      </div>`).join('');
  }
}

loadDashboard().catch((error) => {
  console.error(error);
  toast(error.message || 'تعذر تحميل لوحة التحكم', 'error');
});
