import { supabase } from './supabase-client.js';
import { requireAuth, getProfile, toast, formatMoney, escapeHtml } from './app.js';

const page = document.body.dataset.page;
const LOCAL_REQUESTS_KEY = 'rafeeq-service-requests-demo';
const LOCAL_MESSAGES_KEY = 'rafeeq-request-messages-demo';

const STATUS_LABELS = {
  pending: ['قيد الانتظار', 'warning'],
  accepted: ['تم قبول الطلب', 'success'],
  in_progress: ['جاري التنفيذ', 'warning'],
  completed: ['تم الانتهاء', 'success'],
  cancelled: ['ملغي', 'danger']
};

function readLocal(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function writeLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function requestCard(request, providerMode = false) {
  const [label, className] = STATUS_LABELS[request.status] || STATUS_LABELS.pending;
  const budget = request.budget ? formatMoney(request.budget) : 'غير محددة';
  return `<article class="request-card">
    <div class="request-card-head"><span class="pill ${className}">${label}</span><small>${new Date(request.created_at || Date.now()).toLocaleDateString('ar-EG')}</small></div>
    <h3>${escapeHtml(request.description || 'طلب تصميم وتنفيذ')}</h3>
    <div class="request-meta"><span>💰 ${budget}</span><span>📅 ${escapeHtml(request.requested_date || 'مرن')}</span><span>🎯 ${request.target_type === 'engineering_office' ? 'مكتب هندسي' : request.target_type === 'interior_designer' ? 'مصمم داخلي' : 'مصمم أو مكتب'}</span></div>
    <div class="request-card-actions">
      ${providerMode && request.status === 'pending' ? `<button class="btn btn-primary" data-accept-request="${request.id}">قبول الطلب</button><button class="btn btn-light" data-reject-request="${request.id}">رفض</button>` : ''}
      ${request.status !== 'pending' ? `<a class="btn btn-light" href="chat.html?request=${request.id}">فتح المحادثة</a>` : ''}
    </div>
  </article>`;
}

async function uploadRequestFiles(files, requestId, userId) {
  const uploaded = [];
  for (const file of files) {
    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${requestId}/${userId}/${Date.now()}-${clean}`;
    const { error } = await supabase.storage.from('request-files').upload(path, file);
    if (!error) uploaded.push({ name: file.name, path, size: file.size, type: file.type });
  }
  return uploaded;
}

async function initServiceRequest() {
  const session = await requireAuth();
  if (!session) return;
  const form = document.getElementById('service-request-form');
  const holder = document.getElementById('my-service-requests');

  async function load() {
    const { data, error } = await supabase.from('service_requests').select('*').eq('customer_id', session.user.id).order('created_at', { ascending: false });
    const local = readLocal(LOCAL_REQUESTS_KEY).filter((item) => item.customer_id === session.user.id);
    const requests = error ? local : (data || []);
    holder.innerHTML = requests.length ? requests.map((request) => requestCard(request)).join('') : '<div class="empty-state"><div class="emoji">💬</div><h3>لا توجد طلبات حتى الآن</h3><p>أرسل طلبًا وسيصل إلى مقدمي الخدمة المسجلين.</p></div>';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = {
      customer_id: session.user.id,
      description: String(data.get('description') || '').trim(),
      budget: data.get('budget') ? Number(data.get('budget')) : null,
      requested_date: data.get('requested_date'),
      target_type: data.get('target_type'),
      status: 'pending'
    };
    button.disabled = true;
    button.textContent = 'جاري إرسال الطلب...';
    const result = await supabase.from('service_requests').insert(payload).select().maybeSingle();
    let request = result.data;
    if (result.error || !request) {
      request = { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
      const local = readLocal(LOCAL_REQUESTS_KEY);
      local.unshift(request);
      writeLocal(LOCAL_REQUESTS_KEY, local);
      console.warn('Request saved locally:', result.error?.message);
    } else {
      const files = [...(form.elements.files.files || [])];
      if (files.length) {
        const attachments = await uploadRequestFiles(files, request.id, session.user.id);
        if (attachments.length) await supabase.from('service_request_attachments').insert(attachments.map((item) => ({ request_id: request.id, uploaded_by: session.user.id, ...item })));
      }
    }
    form.reset();
    button.disabled = false;
    button.textContent = 'إرسال الطلب';
    toast('تم إرسال الطلب إلى مقدمي الخدمة', 'success');
    load();
  });

  load();
}

async function initProviderRequests() {
  const session = await requireAuth();
  if (!session) return;
  const profile = await getProfile(session.user.id);
  const holder = document.getElementById('provider-request-list');
  const providerType = profile?.account_type || 'interior_designer';

  const demoRequests = [
    { id: 'demo-1', description: 'تصميم غرفة معيشة مع مساحة عمل صغيرة وإضاءة مناسبة للعمل من المنزل.', budget: 180000, requested_date: '2026-08-15', target_type: 'both', status: 'pending', created_at: new Date().toISOString() },
    { id: 'demo-2', description: 'تجديد غرفة أطفال مع الحفاظ على الدولاب الحالي وإضافة مكتبين للمذاكرة.', budget: 120000, requested_date: '2026-08-22', target_type: 'interior_designer', status: 'pending', created_at: new Date().toISOString() },
    { id: 'demo-3', description: 'تنفيذ تشطيب ريسبشن ومطبخ وتقديم مدة وتكلفة متوقعة.', budget: 420000, requested_date: '2026-09-01', target_type: 'engineering_office', status: 'pending', created_at: new Date().toISOString() }
  ];

  async function load() {
    const [{ data, error }, { data: responses }] = await Promise.all([
      supabase.from('service_requests').select('*').in('status', ['pending', 'accepted', 'in_progress']).order('created_at', { ascending: false }),
      supabase.from('service_request_responses').select('request_id,status').eq('provider_id', session.user.id)
    ]);
    const rejectedIds = new Set([
      ...(responses || []).filter((item) => item.status === 'rejected').map((item) => item.request_id),
      ...readLocal('rafeeq-hidden-provider-requests')
    ]);
    let requests = error ? [...demoRequests, ...readLocal(LOCAL_REQUESTS_KEY)] : (data || []);
    requests = requests.filter((request) => !rejectedIds.has(request.id) && (request.status !== 'pending' || request.target_type === 'both' || request.target_type === providerType));
    holder.innerHTML = requests.length ? requests.map((request) => requestCard(request, true)).join('') : '<div class="empty-state"><div class="emoji">📭</div><h3>لا توجد طلبات متاحة</h3></div>';
    holder.querySelectorAll('[data-accept-request]').forEach((button) => button.addEventListener('click', () => acceptRequest(button.dataset.acceptRequest, button)));
    holder.querySelectorAll('[data-reject-request]').forEach((button) => button.addEventListener('click', () => rejectRequest(button.dataset.rejectRequest, button)));
  }

  async function rejectRequest(requestId, button) {
    button.disabled = true;
    button.textContent = 'تم الرفض';
    const { error } = await supabase.from('service_request_responses').upsert({
      request_id: requestId,
      provider_id: session.user.id,
      status: 'rejected'
    }, { onConflict: 'request_id,provider_id' });
    if (error) {
      const hidden = readLocal('rafeeq-hidden-provider-requests');
      writeLocal('rafeeq-hidden-provider-requests', [...new Set([...hidden, requestId])]);
      console.warn('Reject request saved locally:', error.message);
    }
    toast('تم رفض الطلب ولن يظهر في قائمتك', 'success');
    setTimeout(load, 350);
  }

  async function acceptRequest(requestId, button) {
    button.disabled = true;
    button.textContent = 'جاري القبول...';
    const rpc = await supabase.rpc('accept_service_request', { p_request_id: requestId });
    if (rpc.error) {
      const local = readLocal(LOCAL_REQUESTS_KEY);
      const request = local.find((item) => item.id === requestId) || demoRequests.find((item) => item.id === requestId);
      if (request) {
        request.status = 'accepted';
        request.accepted_by = session.user.id;
        writeLocal(LOCAL_REQUESTS_KEY, local);
      }
      console.warn('Accept request fallback:', rpc.error.message);
    }
    toast('تم قبول الطلب وفتح المحادثة الخاصة', 'success');
    setTimeout(() => { location.href = `chat.html?request=${requestId}`; }, 600);
  }

  load();
}

async function initChat() {
  const session = await requireAuth();
  if (!session) return;
  const requestId = new URLSearchParams(location.search).get('request') || 'demo-1';
  const messagesHolder = document.getElementById('request-chat-messages');
  const form = document.getElementById('request-chat-form');
  const title = document.getElementById('chat-project-title');
  const summary = document.getElementById('chat-request-summary');

  const { data: requestData } = await supabase.from('service_requests').select('*').eq('id', requestId).maybeSingle();
  const localRequest = readLocal(LOCAL_REQUESTS_KEY).find((item) => item.id === requestId);
  const request = requestData || localRequest || { description: 'طلب تصميم داخلي', budget: 180000, requested_date: '2026-08-15', status: 'accepted' };
  title.textContent = request.description?.slice(0, 60) || 'طلب تصميم داخلي';
  summary.innerHTML = `<div class="summary-row"><span>الحالة</span><strong>${STATUS_LABELS[request.status]?.[0] || 'تم قبول الطلب'}</strong></div><div class="summary-row"><span>الميزانية</span><strong>${request.budget ? formatMoney(request.budget) : 'غير محددة'}</strong></div><div class="summary-row"><span>الموعد</span><strong>${escapeHtml(request.requested_date || 'مرن')}</strong></div>`;

  let localMessages = readLocal(LOCAL_MESSAGES_KEY);
  async function loadMessages() {
    const { data, error } = await supabase.from('service_messages').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
    const messages = error ? localMessages.filter((item) => item.request_id === requestId) : (data || []);
    const seed = messages.length ? messages : [{ sender_id: 'system', message: 'تم قبول الطلب. يمكن الآن تبادل التفاصيل والملفات داخل هذه المحادثة.', created_at: new Date().toISOString() }];
    const enriched = await Promise.all(seed.map(async (message) => {
      if (!message.file_path) return { ...message, signed_url: null };
      const { data: signed } = await supabase.storage.from('request-files').createSignedUrl(message.file_path, 3600);
      return { ...message, signed_url: signed?.signedUrl || null };
    }));
    messagesHolder.innerHTML = enriched.map((message) => `<div class="chat-bubble ${message.sender_id === session.user.id ? 'user' : 'assistant'}"><span>${message.sender_id === session.user.id ? 'أنت' : 'الطرف الآخر'}</span>${message.message ? `<p>${escapeHtml(message.message)}</p>` : ''}${message.file_name ? `<a class="chat-file-link" href="${message.signed_url || '#'}" ${message.signed_url ? 'target="_blank" rel="noopener"' : ''}>📎 ${escapeHtml(message.file_name)}</a>` : ''}<small>${new Date(message.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('');
    messagesHolder.scrollTop = messagesHolder.scrollHeight;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.elements.message;
    const message = input.value.trim();
    if (!message) return;
    const payload = { request_id: requestId, sender_id: session.user.id, message, created_at: new Date().toISOString() };
    const { error } = await supabase.from('service_messages').insert(payload);
    if (error) {
      localMessages.push({ ...payload, id: `local-${Date.now()}` });
      writeLocal(LOCAL_MESSAGES_KEY, localMessages);
    }
    input.value = '';
    await loadMessages();
  });

  document.getElementById('chat-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${requestId}/${session.user.id}/chat/${Date.now()}-${clean}`;
    const upload = await supabase.storage.from('request-files').upload(path, file);
    const payload = {
      request_id: requestId,
      sender_id: session.user.id,
      message: 'تم إرسال ملف مرفق.',
      file_name: file.name,
      file_path: upload.error ? null : path,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('service_messages').insert(payload);
    if (error) {
      localMessages.push({ ...payload, id: `local-${Date.now()}` });
      writeLocal(LOCAL_MESSAGES_KEY, localMessages);
    }
    toast('تم إرفاق الملف بالمحادثة', 'success');
    event.target.value = '';
    loadMessages();
  });

  loadMessages();
}

if (page === 'service-request') initServiceRequest();
if (page === 'provider-requests') initProviderRequests();
if (page === 'chat') initChat();
