import { supabase } from './supabase-client.js';
import { requireAuth, toast, formatMoney, escapeHtml, getProfile } from './app.js';
import { EGYPT_LOCATIONS, ROOM_TYPES, PROFESSIONS, PRODUCTS } from './data.js';

const page = document.body.dataset.page;
const DRAFT_KEY = 'rafeeq-project-draft-v2';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SERVICE_PRICE_SINGLE = 499;
const SERVICE_PRICE_APARTMENT = 1499;
const MAX_IMAGE_SIZE = 7 * 1024 * 1024;
const FREE_TRIAL_KEY = 'rafeeq-free-trial-used';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;

function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
  catch { return {}; }
}

function saveDraft(patch) {
  const draft = { ...getDraft(), ...patch, updated_at: new Date().toISOString() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function roomById(id) {
  return ROOM_TYPES.find((room) => room.id === id) || { id, label: id, image: assetUrl('assets/room-after.svg') };
}

function selectedRoomsFromDraft(draft = getDraft()) {
  const rooms = Array.isArray(draft.rooms) ? draft.rooms : [];
  if (rooms.length) return rooms;
  if (draft.room_type && draft.room_type !== 'غير محدد') {
    return [{ key: draft.room_type, type: draft.room_type, label: roomById(draft.room_type).label, area: draft.room_area || null }];
  }
  return [];
}

async function safeUpdateProject(projectId, patch) {
  if (!projectId) return false;
  const { error } = await supabase.from('projects').update(patch).eq('id', projectId);
  if (error) {
    console.warn('Project update skipped:', error.message);
    return false;
  }
  return true;
}

async function upsertProjectRooms(projectId, rooms) {
  if (!projectId || !rooms?.length) return;
  const session = await requireAuth();
  if (!session) return;
  const rows = rooms.map((room, index) => ({
    project_id: projectId,
    user_id: session.user.id,
    room_key: room.key || `${room.type}-${index + 1}`,
    room_type: room.type,
    title: room.label || roomById(room.type).label,
    area_sqm: Number(room.area || 0) || null,
    sort_order: index
  }));
  const { error } = await supabase.from('project_rooms').upsert(rows, { onConflict: 'project_id,room_key' });
  if (error) console.warn('Project rooms sync skipped:', error.message);
}

function initChoiceCards() {
  document.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      const input = card.querySelector('input');
      if (!input) return;
      if (input.type === 'radio') {
        document.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => {
          radio.closest('.choice-card')?.classList.remove('selected');
        });
        input.checked = true;
        card.classList.add('selected');
      } else {
        input.checked = !input.checked;
        card.classList.toggle('selected', input.checked);
      }
    });
  });
}

function servicePrice(draft = getDraft()) {
  return draft.project_scope === 'full_apartment' ? SERVICE_PRICE_APARTMENT : SERVICE_PRICE_SINGLE;
}

function projectTitleForLocation(governorate, city) {
  const date = new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric' }).format(new Date());
  return `مشروع ${city || governorate} — ${date}`;
}

function prepareFreshWizardDraft() {
  let draft = getDraft();
  if (draft.wizard_active === false || draft.ai_completed) {
    clearDraft();
    draft = {};
  }
  return draft;
}

function initProfession() {
  const form = document.getElementById('profession-form');
  const grid = document.getElementById('profession-grid');
  const otherWrap = document.getElementById('other-profession-wrap');
  const otherInput = document.getElementById('other-profession');
  let draft = prepareFreshWizardDraft();
  let selected = draft.profession || '';

  grid.innerHTML = PROFESSIONS.map(([value, label, icon]) => `
    <label class="profession-card ${selected === value ? 'selected' : ''}"><input type="radio" name="profession" value="${value}" ${selected === value ? 'checked' : ''}><span>${icon}</span><strong>${label}</strong></label>`).join('');

  const updateOther = () => {
    otherWrap.classList.toggle('hidden', selected !== 'other');
    if (selected === 'other') otherInput.value = draft.other_profession || '';
  };

  grid.querySelectorAll('.profession-card').forEach((card) => {
    card.addEventListener('click', () => {
      grid.querySelectorAll('.profession-card').forEach((item) => item.classList.remove('selected'));
      card.classList.add('selected');
      const input = card.querySelector('input');
      input.checked = true;
      selected = input.value;
      updateOther();
    });
  });
  updateOther();

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selected) return toast('اختر الوظيفة', 'error');
    const otherProfession = selected === 'other' ? otherInput.value.trim() : '';
    if (selected === 'other' && !otherProfession) return toast('اكتب الوظيفة', 'error');
    saveDraft({ profession: selected, other_profession: otherProfession, current_step: 1, wizard_active: true });
    location.href = 'new-project.html';
  });
}

async function initNewProject() {
  const form = document.getElementById('new-project-form');
  const governorate = document.getElementById('governorate');
  const city = document.getElementById('city');
  const draft = getDraft();

  if (!draft.profession) {
    location.href = 'profession.html';
    return;
  }

  governorate.innerHTML = '<option value="">اختر المحافظة</option>' + Object.keys(EGYPT_LOCATIONS)
    .map((item) => `<option value="${item}">${item}</option>`).join('');

  const populateCities = (selectedGovernorate, selectedCity = '') => {
    const cities = EGYPT_LOCATIONS[selectedGovernorate] || [];
    city.disabled = !cities.length;
    city.innerHTML = cities.length
      ? '<option value="">اختر المدينة</option>' + cities.map((item) => `<option value="${item}">${item}</option>`).join('')
      : '<option value="">اختر المحافظة أولًا</option>';
    if (selectedCity && cities.includes(selectedCity)) city.value = selectedCity;
  };

  governorate.addEventListener('change', () => populateCities(governorate.value));
  if (draft.governorate) {
    governorate.value = draft.governorate;
    populateCities(draft.governorate, draft.city);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = await requireAuth();
    if (!session) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const professionValue = draft.profession === 'other' ? draft.other_profession : draft.profession;
    const patch = {
      governorate: data.governorate,
      city: data.city,
      profession: professionValue,
      title: draft.title || projectTitleForLocation(data.governorate, data.city),
      room_type: draft.room_type || 'غير محدد',
      status: 'draft',
      current_step: 2,
      wizard_active: true
    };

    let projectId = draft.project_id;
    if (!projectId) {
      const fullInsert = await supabase.from('projects').insert({
        user_id: session.user.id,
        title: patch.title,
        room_type: patch.room_type,
        city: patch.city,
        governorate: patch.governorate,
        profession: patch.profession,
        status: 'draft',
        current_step: 2
      }).select().single();

      if (fullInsert.error) {
        const fallback = await supabase.from('projects').insert({
          user_id: session.user.id,
          title: patch.title,
          room_type: patch.room_type,
          city: patch.city,
          status: 'draft'
        }).select().single();
        if (fallback.error) return toast(fallback.error.message, 'error');
        projectId = fallback.data.id;
      } else projectId = fullInsert.data.id;
    } else await safeUpdateProject(projectId, patch);

    saveDraft({ ...patch, project_id: projectId });
    location.href = 'project-type.html';
  });
}

function initProjectType() {
  const form = document.getElementById('project-type-form');
  const draft = getDraft();
  let scope = draft.project_scope || '';
  document.querySelectorAll('.scope-option').forEach((card) => {
    const input = card.querySelector('input');
    if (input.value === scope) {
      input.checked = true;
      card.classList.add('selected');
    }
    card.addEventListener('click', () => {
      document.querySelectorAll('.scope-option').forEach((item) => item.classList.remove('selected'));
      input.checked = true;
      scope = input.value;
      card.classList.add('selected');
    });
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!scope) return toast('اختر نوع المشروع', 'error');
    const patch = { project_scope: scope, current_step: 3 };
    if (scope === 'single_room' && Array.isArray(draft.rooms) && draft.rooms.length > 1) {
      patch.rooms = draft.rooms.slice(0, 1);
      patch.selected_room_types = patch.rooms.map((room) => room.type);
    }
    saveDraft(patch);
    await safeUpdateProject(draft.project_id, { project_scope: scope, current_step: 3 });
    location.href = 'room-details.html';
  });
}

function initRoomDetails() {
  const form = document.getElementById('space-type-form');
  const grid = document.getElementById('room-type-grid');
  const title = document.getElementById('room-selection-title');
  const help = document.getElementById('room-selection-help');
  const draft = getDraft();
  const scope = draft.project_scope;
  if (!scope) {
    location.href = 'project-type.html';
    return;
  }
  let selected = selectedRoomsFromDraft(draft).map((room) => room.type);

  function renderRooms() {
    grid.innerHTML = ROOM_TYPES.map((room) => `
      <label class="room-reference-card ${selected.includes(room.id) ? 'selected' : ''}" data-room-id="${room.id}">
        <input type="${scope === 'single_room' ? 'radio' : 'checkbox'}" name="room_type" value="${room.id}" ${selected.includes(room.id) ? 'checked' : ''}>
        <img src="${room.image}" alt="${room.label}">
        <div><strong>${room.label}</strong><small>${room.description}</small></div>
        <span class="room-check">✓</span>
      </label>`).join('');

    title.textContent = scope === 'single_room' ? 'اختر نوع المساحة' : 'اختر غرف الشقة';
    help.textContent = scope === 'single_room' ? 'اختر مساحة واحدة.' : 'اختر جميع الغرف، وسيُنشأ ملف مستقل لكل غرفة.';

    grid.querySelectorAll('.room-reference-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.roomId;
        if (scope === 'single_room') selected = [id];
        else selected = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
        renderRooms();
      });
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selected.length) return toast('اختر نوع مساحة واحدًا على الأقل', 'error');
    const rooms = selected.map((type, index) => {
      const existing = selectedRoomsFromDraft(draft).find((room) => room.type === type);
      return { key: existing?.key || `${type}-${index + 1}`, type, label: roomById(type).label, area: existing?.area || null };
    });
    const patch = {
      room_type: scope === 'single_room' ? selected[0] : 'full_apartment',
      selected_room_types: selected,
      rooms,
      current_step: 4
    };
    saveDraft(patch);
    await safeUpdateProject(draft.project_id, { room_type: patch.room_type, current_step: 4 });
    await upsertProjectRooms(draft.project_id, rooms);
    location.href = 'room-area.html';
  });
  renderRooms();
}

function initRoomArea() {
  const form = document.getElementById('room-area-form');
  const holder = document.getElementById('room-area-fields');
  const draft = getDraft();
  const rooms = selectedRoomsFromDraft(draft);
  if (!rooms.length) {
    location.href = 'room-details.html';
    return;
  }
  holder.innerHTML = rooms.map((room, index) => `
    <div class="area-input-card">
      <img src="${roomById(room.type).image}" alt="${room.label}">
      <div><label for="area-${index}">${draft.project_scope === 'full_apartment' ? `مساحة ${room.label}` : 'المساحة بالمتر المربع'}</label><div class="area-input-wrap"><input id="area-${index}" data-room-area="${room.key}" type="number" min="2" max="1000" step="0.5" required value="${room.area || ''}" placeholder="مثال: 24"><span>م²</span></div></div>
    </div>`).join('');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const updatedRooms = rooms.map((room) => ({ ...room, area: Number(document.querySelector(`[data-room-area="${room.key}"]`)?.value || 0) }));
    if (updatedRooms.some((room) => !room.area || room.area < 2)) return toast('أدخل مساحة صحيحة لكل غرفة', 'error');
    const roomArea = draft.project_scope === 'single_room' ? updatedRooms[0].area : updatedRooms.reduce((sum, room) => sum + room.area, 0);
    saveDraft({ rooms: updatedRooms, room_area: roomArea, current_step: 5 });
    await safeUpdateProject(draft.project_id, { room_area: roomArea, current_step: 5 });
    await upsertProjectRooms(draft.project_id, updatedRooms);
    location.href = 'choose-style.html';
  });
}

function initChooseStyle() {
  initChoiceCards();
  const draft = getDraft();
  const selected = document.querySelector(`input[name="style"][value="${draft.style || ''}"]`);
  if (selected) { selected.checked = true; selected.closest('.choice-card')?.classList.add('selected'); }
  document.getElementById('style-next')?.addEventListener('click', async () => {
    const style = document.querySelector('input[name="style"]:checked')?.value;
    if (!style) return toast('اختر نمط التصميم', 'error');
    saveDraft({ style, current_step: 6 });
    await safeUpdateProject(draft.project_id, { style, current_step: 6 });
    location.href = 'choose-colors.html';
  });
}

function initChooseColors() {
  const draft = getDraft();
  let colors = Array.isArray(draft.favorite_colors) ? draft.favorite_colors : [];
  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    const color = swatch.dataset.color;
    swatch.classList.toggle('selected', colors.includes(color));
    swatch.addEventListener('click', () => {
      if (colors.includes(color)) colors = colors.filter((item) => item !== color);
      else colors.push(color);
      swatch.classList.toggle('selected');
    });
  });
  const fileInput = document.getElementById('inspiration-image');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return toast('اختر صورة JPG أو JPEG أو PNG أو WEBP', 'error');
    if (file.size > MAX_IMAGE_SIZE) return toast('صورة الإلهام أكبر من 7 MB', 'error');
    const reader = new FileReader();
    reader.onload = () => saveDraft({ inspiration_image: reader.result });
    reader.readAsDataURL(file);
  });
  document.getElementById('colors-next')?.addEventListener('click', async () => {
    if (!colors.length) return toast('اختر لونًا واحدًا على الأقل', 'error');
    saveDraft({ favorite_colors: colors, current_step: 7 });
    await safeUpdateProject(draft.project_id, { favorite_colors: colors, current_step: 7 });
    location.href = 'budget.html';
  });
}

function initBudget() {
  const draft = getDraft();
  const minInput = document.getElementById('min-budget');
  const maxInput = document.getElementById('max-budget');
  const slider = document.getElementById('budget-slider');
  const minPreview = document.getElementById('min-budget-preview');
  const maxPreview = document.getElementById('max-budget-preview');
  minInput.value = draft.min_budget || 60000;
  maxInput.value = draft.max_budget || 150000;
  slider.value = draft.max_budget || 150000;
  const update = () => {
    const min = Number(minInput.value || 0);
    const max = Math.max(min, Number(maxInput.value || 0));
    maxInput.value = max;
    slider.value = Math.min(Number(slider.max), max);
    minPreview.textContent = formatMoney(min);
    maxPreview.textContent = formatMoney(max);
  };
  minInput.addEventListener('input', update);
  maxInput.addEventListener('input', update);
  slider.addEventListener('input', () => { maxInput.value = slider.value; update(); });
  update();
  document.getElementById('budget-next')?.addEventListener('click', async () => {
    const min_budget = Number(minInput.value);
    const max_budget = Number(maxInput.value);
    if (!min_budget || !max_budget || max_budget < min_budget) return toast('راجع نطاق الميزانية', 'error');
    saveDraft({ min_budget, max_budget, current_step: 8 });
    await safeUpdateProject(draft.project_id, { min_budget, max_budget, current_step: 8 });
    location.href = 'requirements.html';
  });
}

function initRequirements() {
  const form = document.getElementById('requirements-form');
  const draft = getDraft();
  const requirements = draft.requirements || {};
  const syncOption = (input) => input.closest('.requirement-option')?.classList.toggle('selected', input.checked);
  Object.entries(requirements).forEach(([key, value]) => {
    const field = form?.elements.namedItem(key);
    if (field && field.type === 'checkbox') { field.checked = value; syncOption(field); }
  });
  form?.querySelectorAll('.requirement-option input').forEach((input) => input.addEventListener('change', () => syncOption(input)));
  if (form?.elements.notes) form.elements.notes.value = draft.notes || '';
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requirementsPatch = {
      smart_home: form.elements.smart_home.checked,
      eco_friendly: form.elements.eco_friendly.checked,
      kids_friendly: form.elements.kids_friendly.checked,
      pets_friendly: form.elements.pets_friendly.checked
    };
    const notes = form.elements.notes.value.trim();
    saveDraft({ requirements: requirementsPatch, notes, current_step: 9 });
    await safeUpdateProject(draft.project_id, { requirements: requirementsPatch, notes, current_step: 9 });
    location.href = 'project-payment.html';
  });
}

function luhnValid(number) {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function expiryValid(value) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const expiry = new Date(year, month, 0, 23, 59, 59);
  return expiry >= new Date();
}

async function initProjectPayment() {
  const form = document.getElementById('project-payment-form');
  const numberInput = document.getElementById('card-number');
  const expiryInput = document.getElementById('card-expiry');
  const trialOffer = document.getElementById('trial-offer');
  const trialUsedNote = document.getElementById('trial-used-note');
  const trialButton = document.getElementById('use-free-trial');
  const draft = getDraft();
  const price = servicePrice(draft);
  const rooms = selectedRoomsFromDraft(draft);
  const session = await requireAuth();
  if (!session) return;
  const profile = await getProfile(session.user.id);
  const localTrialUsed = localStorage.getItem(FREE_TRIAL_KEY) === 'true';
  const trialUsed = Boolean(profile?.free_design_used || localTrialUsed);

  trialOffer?.classList.toggle('hidden', trialUsed);
  trialUsedNote?.classList.toggle('hidden', !trialUsed);
  document.getElementById('project-service-price').textContent = formatMoney(price);
  document.getElementById('payment-project-title').textContent = draft.project_scope === 'full_apartment' ? 'تصميم الشقة بالكامل' : `تصميم ${rooms[0]?.label || 'غرفة واحدة'}`;
  document.getElementById('payment-summary-details').innerHTML = `
    <div class="summary-row"><span>الموقع</span><strong>${escapeHtml(draft.governorate || '')} — ${escapeHtml(draft.city || '')}</strong></div>
    <div class="summary-row"><span>عدد المساحات</span><strong>${rooms.length || 1}</strong></div>
    <div class="summary-row"><span>نمط التصميم</span><strong>${escapeHtml(draft.style || 'غير محدد')}</strong></div>
    <div class="summary-row"><span>يشمل</span><strong>تحليل + تصميم + مطابقة أثاث</strong></div>`;

  trialButton?.addEventListener('click', async () => {
    trialButton.disabled = true;
    trialButton.textContent = 'جاري تفعيل التجربة...';
    const claim = await supabase.rpc('claim_free_design', { p_project_id: draft.project_id });
    if (!claim.error && claim.data === false) {
      trialButton.disabled = false;
      trialButton.textContent = 'استخدام التجربة المجانية';
      return toast('تم استخدام التجربة المجانية من قبل على هذا الحساب.', 'error');
    }
    if (claim.error) {
      console.warn('Run migration 004 to enable atomic free-trial claiming:', claim.error.message);
      await safeUpdateProject(draft.project_id, {
        payment_status: 'trial', access_tier: 'trial', service_price: 0, current_step: 10, status: 'active'
      });
    }
    localStorage.setItem(FREE_TRIAL_KEY, 'true');
    saveDraft({
      payment_status: 'trial',
      access_tier: 'trial',
      service_price: 0,
      trial_ai_messages_used: 0,
      trial_ai_edits_used: 0,
      current_step: 10
    });
    toast('تم تفعيل التجربة المجانية', 'success');
    setTimeout(() => { location.href = 'upload-images.html'; }, 650);
  });

  numberInput?.addEventListener('input', () => {
    numberInput.value = numberInput.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  });
  expiryInput?.addEventListener('input', () => {
    const digits = expiryInput.value.replace(/\D/g, '').slice(0, 4);
    expiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('complete-project-payment');
    const data = Object.fromEntries(new FormData(form).entries());
    const cardNumber = String(data.card_number || '').replace(/\D/g, '');
    if (!luhnValid(cardNumber)) return toast('رقم البطاقة غير صحيح. للاختبار استخدم بطاقة Visa تجريبية صحيحة.', 'error');
    if (!expiryValid(String(data.card_expiry || ''))) return toast('تاريخ انتهاء البطاقة غير صحيح', 'error');
    if (!/^\d{3,4}$/.test(String(data.card_cvv || ''))) return toast('رمز CVV غير صحيح', 'error');

    button.disabled = true;
    button.textContent = 'جاري تنفيذ الدفع...';
    const reference = `PAY-${Date.now().toString().slice(-8)}`;
    const last4 = cardNumber.slice(-4);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const paymentResult = await supabase.from('project_payments').insert({
        project_id: draft.project_id,
        user_id: session.user.id,
        amount: price,
        currency: 'EGP',
        method: 'visa',
        status: 'paid',
        payment_reference: reference,
        card_last4: last4
      });
      if (paymentResult.error) console.warn('Payment record skipped:', paymentResult.error.message);
      await safeUpdateProject(draft.project_id, {
        payment_status: 'paid',
        access_tier: 'paid',
        service_price: price,
        paid_at: new Date().toISOString(),
        current_step: 10,
        status: 'active'
      });
      saveDraft({
        payment_status: 'paid', access_tier: 'paid', service_price: price,
        paid_at: new Date().toISOString(), payment_reference: reference, current_step: 10
      });
      toast('تم الدفع بنجاح', 'success');
      setTimeout(() => { location.href = 'upload-images.html'; }, 650);
    } catch (error) {
      toast(error.message || 'تعذر إتمام الدفع', 'error');
      button.disabled = false;
      button.textContent = 'إتمام الدفع';
    }
  });
}

async function uploadFileToSupabase(file, room, index) {
  const draft = getDraft();
  const session = await getSessionWithoutRedirect();
  if (!session || !draft.project_id) return null;
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${session.user.id}/${draft.project_id}/${room.key}/${Date.now()}-${index}-${cleanName}`;
  const { error } = await supabase.storage.from('room-images').upload(path, file, { upsert: false });
  if (error) {
    console.warn('Storage upload skipped:', error.message);
    return null;
  }
  const { data: roomRow } = await supabase.from('project_rooms').select('id').eq('project_id', draft.project_id).eq('room_key', room.key).maybeSingle();
  const { error: insertError } = await supabase.from('project_images').insert({
    project_id: draft.project_id,
    room_id: roomRow?.id || null,
    user_id: session.user.id,
    storage_path: path,
    image_type: 'room'
  });
  if (insertError) console.warn('Image record skipped:', insertError.message);
  return path;
}

async function getSessionWithoutRedirect() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function initUploadImages() {
  const draft = getDraft();
  if (!['paid', 'trial'].includes(draft.payment_status)) {
    toast('يجب إتمام الدفع قبل رفع الصور', 'error');
    setTimeout(() => { location.href = 'project-payment.html'; }, 700);
    return;
  }
  const rooms = selectedRoomsFromDraft(draft);
  const accessTitle = document.getElementById('upload-access-title');
  if (accessTitle) accessTitle.textContent = draft.payment_status === 'trial' ? 'تم تفعيل التجربة المجانية' : 'تم الدفع بنجاح';
  const holder = document.getElementById('room-upload-sections');
  let roomImages = draft.room_images || {};

  holder.innerHTML = rooms.map((room) => `
    <section class="room-upload-card" data-upload-room="${room.key}">
      <div class="room-upload-head"><img src="${roomById(room.type).image}" alt="${room.label}"><div><strong>${room.label}</strong><small>ارفع صورة أو أكثر بحد أقصى 6 صور.</small></div></div>
      <div class="upload-zone" data-upload-zone="${room.key}"><div><span class="upload-icon">↥</span><h3>اسحب الصور هنا أو اضغط للاختيار</h3><p class="muted">JPG / JPEG / PNG / WEBP — بحد أقصى 7 MB للصورة</p></div></div>
      <input type="file" data-upload-input="${room.key}" accept="image/jpeg,image/png,image/webp" multiple hidden>
      <div class="upload-preview" data-upload-preview="${room.key}"></div>
    </section>`).join('');

  const renderPreview = (roomKey) => {
    const preview = holder.querySelector(`[data-upload-preview="${roomKey}"]`);
    const images = roomImages[roomKey] || [];
    preview.innerHTML = images.map((image, index) => `
      <div class="preview-card"><img src="${image.preview}" alt="صورة الغرفة"><button type="button" data-remove-room-image="${roomKey}:${index}">×</button>${image.uploaded ? '<span class="uploaded-badge">تم الرفع</span>' : ''}</div>`).join('');
    preview.querySelectorAll('[data-remove-room-image]').forEach((button) => {
      button.addEventListener('click', () => {
        const [key, index] = button.dataset.removeRoomImage.split(':');
        roomImages[key].splice(Number(index), 1);
        saveDraft({ room_images: roomImages });
        renderPreview(key);
      });
    });
  };

  async function handleFiles(room, files) {
    const current = roomImages[room.key] || [];
    const valid = files.filter((file) => ALLOWED_IMAGE_TYPES.includes(file.type)).slice(0, Math.max(0, 6 - current.length));
    for (let index = 0; index < valid.length; index += 1) {
      const file = valid[index];
      if (file.size > MAX_IMAGE_SIZE) {
        toast(`الصورة ${file.name} أكبر من 7 MB`, 'error');
        continue;
      }
      const preview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const item = { preview, name: file.name, uploaded: false, storage_path: null };
      current.push(item);
      roomImages[room.key] = current;
      renderPreview(room.key);
      const path = await uploadFileToSupabase(file, room, index);
      item.uploaded = Boolean(path);
      item.storage_path = path;
      saveDraft({ room_images: roomImages });
      renderPreview(room.key);
    }
  }

  rooms.forEach((room) => {
    const zone = holder.querySelector(`[data-upload-zone="${room.key}"]`);
    const input = holder.querySelector(`[data-upload-input="${room.key}"]`);
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('dragging');
      handleFiles(room, [...event.dataTransfer.files]);
    });
    input.addEventListener('change', () => handleFiles(room, [...input.files]));
    renderPreview(room.key);
  });

  document.getElementById('upload-next')?.addEventListener('click', async () => {
    const missing = rooms.filter((room) => !(roomImages[room.key] || []).length);
    if (missing.length) return toast(`ارفع صورة واحدة على الأقل لكل غرفة: ${missing.map((room) => room.label).join('، ')}`, 'error');
    saveDraft({ room_images: roomImages, current_step: 11 });
    await safeUpdateProject(draft.project_id, { current_step: 11, design_status: 'queued', status: 'active' });
    location.href = 'ai-processing.html';
  });
}

function initAiProcessing() {
  const progress = document.getElementById('ai-progress');
  const percent = document.getElementById('ai-percent');
  const steps = [...document.querySelectorAll('.analysis-step')];
  const roomLabel = document.getElementById('processing-room-label');
  const draft = getDraft();
  if (!['paid', 'trial'].includes(draft.payment_status)) {
    location.href = 'project-payment.html';
    return;
  }
  const rooms = selectedRoomsFromDraft(draft);
  let value = 0;
  let roomIndex = 0;

  const timer = setInterval(async () => {
    value = Math.min(100, value + Math.floor(Math.random() * 7) + 4);
    progress.style.width = `${value}%`;
    percent.textContent = `${value}%`;
    const activeIndex = Math.min(steps.length - 1, Math.floor(value / (100 / steps.length)));
    steps.forEach((step, index) => {
      const state = step.querySelector('[data-state]');
      if (index < activeIndex || value === 100) state.textContent = '✔';
      else if (index === activeIndex) state.textContent = '⏳';
      else state.textContent = '○';
    });
    if (rooms.length) {
      roomIndex = Math.min(rooms.length - 1, Math.floor(value / Math.max(1, 100 / rooms.length)));
      roomLabel.textContent = `نعمل الآن على: ${rooms[roomIndex].label}`;
    }

    if (value >= 100) {
      clearInterval(timer);
      const completedRooms = rooms.map((room) => ({ ...room, design_status: 'completed', confidence_score: 92 }));
      saveDraft({ rooms: completedRooms, ai_completed: true, confidence_score: 92, current_step: 12, design_versions: getDraft().design_versions || [] });
      await safeUpdateProject(draft.project_id, { status: 'completed', design_status: 'completed', confidence_score: 92, current_step: 12 });
      for (const room of completedRooms) {
        await supabase.from('project_rooms').update({ design_status: 'completed', confidence_score: 92, final_design_url: assetUrl('assets/room-after.svg') }).eq('project_id', draft.project_id).eq('room_key', room.key);
      }
      setTimeout(() => { location.href = 'ai-result.html'; }, 900);
    }
  }, 420);
}

function resultProducts(room, index) {
  const offset = index % PRODUCTS.length;
  return [...PRODUCTS.slice(offset), ...PRODUCTS.slice(0, offset)].slice(0, 5);
}

function diagramMarkup() {
  return `<div class="design-diagram">
    <svg viewBox="0 0 620 370" role="img" aria-label="رسم توضيحي لتوزيع الأثاث">
      <rect x="18" y="18" width="584" height="334" rx="18" fill="#F6F1E7" stroke="#2E3D34" stroke-width="5"/>
      <rect x="72" y="86" width="220" height="92" rx="24" fill="#E07A5F" opacity=".86"/>
      <circle cx="360" cy="175" r="58" fill="#F2C14E" opacity=".92"/>
      <rect x="438" y="70" width="92" height="132" rx="20" fill="#2E3D34" opacity=".9"/>
      <rect x="148" y="238" width="294" height="72" rx="26" fill="#AEB7A4"/>
      <path d="M300 18V64M602 225H548" stroke="#6C9BD2" stroke-width="12" stroke-linecap="round"/>
      <text x="182" y="141" text-anchor="middle" fill="white" font-size="22">أريكة</text><text x="360" y="182" text-anchor="middle" fill="#2F2F2F" font-size="20">طاولة</text><text x="484" y="142" text-anchor="middle" fill="white" font-size="18">تخزين</text><text x="295" y="282" text-anchor="middle" fill="#2F2F2F" font-size="19">سجادة</text>
    </svg>
    <div class="diagram-legend"><span><i style="--legend:#E07A5F"></i>منطقة الجلوس</span><span><i style="--legend:#F2C14E"></i>الطاولات</span><span><i style="--legend:#2E3D34"></i>التخزين</span><span><i style="--legend:#AEB7A4"></i>السجاد</span><span><i style="--legend:#6C9BD2"></i>فتحات الحركة</span></div>
  </div>`;
}

function hotspotMarkup(products) {
  const positions = [[24,62],[50,68],[72,34],[62,78],[35,30]];
  return products.map((product, index) => {
    const [left, top] = positions[index] || [50,50];
    return `<a href="product-details.html?id=${product.id}" class="furniture-hotspot" style="left:${left}%;top:${top}%" aria-label="${product.name}"><span>${index + 1}</span><div class="hotspot-card"><img src="${product.image}" alt=""><strong>${product.name}</strong><small>${formatMoney(product.price)} • ${product.supplier}</small><small>★ ${product.rating} • ${product.availability}</small></div></a>`;
  }).join('');
}

function roomResultMarkup(room, index, draft) {
  const products = resultProducts(room, index);
  const original = draft.room_images?.[room.key]?.[0]?.preview || assetUrl('assets/room-before.svg');
  const furnitureCost = products.reduce((sum, product) => sum + product.price, 0);
  const palette = (draft.favorite_colors || ['أوف وايت','أخضر','ذهبي']).slice(0, 6);
  return `<div class="room-result-panel" data-room-result="${room.key}">
    <section class="result-hero-v2">
      <div class="interactive-design-card">
        <div class="interactive-design-toolbar"><span class="pill success">Interactive Design</span><span>حرّك المؤشر فوق الأثاث واضغط لفتح المنتج</span></div>
        <div class="interactive-design-image"><img src="${assetUrl('assets/room-after.svg')}" alt="التصميم النهائي">${hotspotMarkup(products)}</div>
      </div>
      <aside class="section-card result-summary-card">
        <h3>${room.label}</h3><div class="score-ring"></div><p class="muted" style="text-align:center">نسبة الثقة</p>
        <div class="summary-list"><div class="summary-row"><span>المساحة</span><strong>${room.area || draft.room_area || 0} م²</strong></div><div class="summary-row"><span>النمط</span><strong>${escapeHtml(draft.style || 'Modern')}</strong></div><div class="summary-row"><span>تكلفة الأثاث</span><strong>${formatMoney(furnitureCost)}</strong></div><div class="summary-row"><span>عدد القطع</span><strong>${products.length}</strong></div></div>
        <a class="btn btn-primary btn-block" href="execution-offices.html?room=${encodeURIComponent(room.key)}">تنفيذ التصميم وحساب التكلفة</a>
      </aside>
    </section>
    <section class="result-detail-grid">
      <article class="section-card"><div class="section-card-head"><h3>قبل / بعد</h3><span class="pill">اسحب للمقارنة</span></div><div class="before-after draggable-compare" data-compare><img src="${assetUrl('assets/room-after.svg')}" alt="بعد"><div class="before-layer"><img src="${original}" alt="قبل"></div><div class="ba-handle"></div></div></article>
      <article class="section-card"><div class="section-card-head"><h3>عرض 360°</h3><span class="pill">اسحب في كل الاتجاهات واستخدم عجلة الماوس</span></div><div class="panorama-viewer" data-panorama style="background-image:url('${assetUrl('assets/room-after.svg')}')"><div class="panorama-hint">↔ ↕ سحب • عجلة الماوس للتكبير</div></div></article>
    </section>
    <section class="grid grid-2" style="margin-top:18px"><article class="section-card"><div class="section-card-head"><h3>Diagram</h3><span class="pill">Legend موضح بالأسفل</span></div>${diagramMarkup()}</article><article class="section-card"><div class="section-card-head"><h3>لوحة الألوان</h3></div><div class="result-palette">${palette.map((color, i) => `<div><span style="--palette-color:${['#1E5AA8','#C63D3D','#2E7D4F','#F2C14E','#E07A5F','#7E57C2','#F6F1E7','#9AA0A6'][i % 8]}"></span><strong>${escapeHtml(color)}</strong></div>`).join('')}</div><div class="ai-rationale"><strong>لماذا هذه الألوان؟</strong><p>تمت موازنة الألوان المختارة مع مساحة الغرفة ونوع الاستخدام والإضاءة المتوقعة لتقليل الزحام البصري.</p></div></article></section>
    <section class="section-card" style="margin-top:18px"><div class="section-card-head"><div><h3>قطع الأثاث المستخدمة</h3><small>يمكن شراء كل قطعة أونلاين أو معرفة أقرب فرع.</small></div><a href="marketplace.html">فتح المتجر</a></div><div class="result-furniture-grid">${products.map((product) => `<article class="result-product-card"><img src="${product.image}" alt="${product.name}"><div><strong>${product.name}</strong><small>${product.supplier}</small><span>★ ${product.rating} • ${product.availability}</span></div><div><strong>${formatMoney(product.price)}</strong><a class="btn btn-light" href="product-details.html?id=${product.id}">التفاصيل</a></div></article>`).join('')}</div></section>
  </div>`;
}

function bindCompareSliders() {
  document.querySelectorAll('[data-compare]').forEach((container) => {
    const before = container.querySelector('.before-layer');
    const handle = container.querySelector('.ba-handle');
    const move = (clientX) => {
      const rect = container.getBoundingClientRect();
      const percent = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
      before.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      handle.style.left = `${percent}%`;
    };
    container.addEventListener('pointerdown', (event) => {
      container.setPointerCapture(event.pointerId);
      move(event.clientX);
    });
    container.addEventListener('pointermove', (event) => {
      if (container.hasPointerCapture(event.pointerId)) move(event.clientX);
    });
  });
}

function bindPanorama() {
  document.querySelectorAll('[data-panorama]').forEach((viewer) => {
    let positionX = 50;
    let positionY = 50;
    let zoom = 115;
    let startX = 0;
    let startY = 0;
    let startPositionX = 50;
    let startPositionY = 50;
    const apply = () => {
      viewer.style.backgroundPosition = `${positionX}% ${positionY}%`;
      viewer.style.backgroundSize = `${zoom}% auto`;
    };
    viewer.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      startY = event.clientY;
      startPositionX = positionX;
      startPositionY = positionY;
      viewer.setPointerCapture(event.pointerId);
      viewer.classList.add('dragging');
    });
    viewer.addEventListener('pointermove', (event) => {
      if (!viewer.hasPointerCapture(event.pointerId)) return;
      positionX = Math.max(0, Math.min(100, startPositionX + (startX - event.clientX) / 4));
      positionY = Math.max(20, Math.min(80, startPositionY + (startY - event.clientY) / 5));
      apply();
    });
    viewer.addEventListener('pointerup', () => viewer.classList.remove('dragging'));
    viewer.addEventListener('wheel', (event) => {
      event.preventDefault();
      zoom = Math.max(100, Math.min(220, zoom + (event.deltaY < 0 ? 10 : -10)));
      apply();
    }, { passive: false });
    apply();
  });
}

function isDesignEditRequest(text) {
  return /(غيّر|غير|بدّل|استبدل|أضف|اضف|احذف|عدّل|عدل|قلل|زود|زيادة|تعديل|بديل)/i.test(text);
}

function initAiChat(draft) {
  const messages = document.getElementById('ai-chat-messages');
  const form = document.getElementById('ai-chat-form');
  const versionsHolder = document.getElementById('design-versions');
  const usagePanel = document.getElementById('trial-usage-panel');
  const isTrial = draft.access_tier === 'trial' || draft.payment_status === 'trial';
  let usedMessages = Number(draft.trial_ai_messages_used || 0);
  let usedEdits = Number(draft.trial_ai_edits_used || 0);
  let chat = Array.isArray(draft.ai_chat) && draft.ai_chat.length ? draft.ai_chat : [
    { role: 'assistant', text: isTrial
      ? 'التصميم جاهز. التجربة المجانية تسمح بـ4 رسائل وتعديل واحد على التصميم.'
      : 'التصميم جاهز. أقدر أغيّر الألوان أو الأرضيات أو الأثاث أو التوزيع، وأحتفظ بكل نسخة للمقارنة.' }
  ];
  let versions = Array.isArray(draft.design_versions) && draft.design_versions.length ? draft.design_versions : [
    { id: 1, title: 'النسخة الأصلية', note: 'التصميم الأول المقترح', created_at: new Date().toISOString() }
  ];

  const syncUsage = async () => {
    saveDraft({ ai_chat: chat, design_versions: versions, trial_ai_messages_used: usedMessages, trial_ai_edits_used: usedEdits });
  };

  const render = () => {
    messages.innerHTML = chat.map((message) => `<div class="chat-bubble ${message.role}"><span>${message.role === 'assistant' ? 'AI' : 'أنت'}</span><p>${escapeHtml(message.text)}</p></div>`).join('');
    messages.scrollTop = messages.scrollHeight;
    versionsHolder.innerHTML = versions.slice().reverse().map((version) => `<button class="version-item" data-version-id="${version.id}"><span>V${version.id}</span><div><strong>${escapeHtml(version.title)}</strong><small>${escapeHtml(version.note)}</small></div></button>`).join('');
    document.getElementById('version-count').textContent = `${versions.length} نسخة`;
    if (usagePanel && isTrial) {
      usagePanel.classList.remove('hidden');
      usagePanel.innerHTML = `<div><span class="trial-badge">FREE TRIAL</span><strong>استخدام مساعد الذكاء الاصطناعي</strong></div><div class="trial-meters"><span>الرسائل: ${usedMessages}/4</span><span>التعديلات: ${usedEdits}/1</span><a href="project-payment.html" class="btn btn-primary">فتح المميزات الكاملة</a></div>`;
    }
  };

  const respond = async (text) => {
    const editRequest = isDesignEditRequest(text);
    if (isTrial) {
      const usage = await supabase.rpc('consume_free_ai', { p_is_edit: editRequest });
      if (!usage.error) {
        const row = Array.isArray(usage.data) ? usage.data[0] : usage.data;
        if (!row?.allowed) {
          toast(editRequest && usedEdits >= 1 ? 'تم استخدام التعديل المجاني. افتح المميزات الكاملة للمتابعة.' : 'انتهى حد الرسائل المجانية. افتح المميزات الكاملة للمتابعة.', 'error');
          return;
        }
        usedMessages = Number(row.messages_used || usedMessages + 1);
        usedEdits = Number(row.edits_used || usedEdits + (editRequest ? 1 : 0));
      } else {
        if (usedMessages >= 4) return toast('انتهى حد الرسائل المجانية. ادفع أو اشترك لمتابعة المحادثة.', 'error');
        if (editRequest && usedEdits >= 1) return toast('تم استخدام التعديل المجاني. يمكنك السؤال عن التصميم أو فتح المميزات الكاملة.', 'error');
        usedMessages += 1;
        if (editRequest) usedEdits += 1;
      }
    }
    chat.push({ role: 'user', text });
    render();
    setTimeout(() => {
      let response;
      if (!editRequest) {
        response = text.includes('لماذا')
          ? 'تم اختيار التكوين لتحقيق حركة مريحة وتوازن بين الإضاءة والألوان والأثاث المتاح ضمن الميزانية.'
          : 'هذه القطعة متوافقة مع مساحة الغرفة والنمط المختار، ويمكنني عرض خامتها وألوانها والبدائل المتاحة.';
      } else if (text.includes('أقل سعر') || text.includes('بديل')) {
        response = 'تم استبدال القطعة ببديل يحافظ على الطابع نفسه ويوفر تقريبًا 18% من تكلفتها.';
      } else if (text.includes('لون')) {
        response = 'تم تحديث لوحة الألوان مع الحفاظ على التباين المناسب والإضاءة الطبيعية.';
      } else {
        response = 'تم تطبيق التعديل وإنشاء نسخة جديدة. يمكنك الرجوع إلى النسخة السابقة من سجل التصميم.';
      }
      chat.push({ role: 'assistant', text: response });
      if (editRequest) {
        const versionId = versions.length + 1;
        versions.push({ id: versionId, title: `تعديل ${versionId - 1}`, note: text, created_at: new Date().toISOString() });
      }
      syncUsage();
      render();
    }, 650);
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.elements.message;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    respond(text);
  });
  document.querySelectorAll('[data-ai-prompt]').forEach((button) => button.addEventListener('click', () => respond(button.dataset.aiPrompt)));
  render();
}

function initAiResult() {
  const draft = getDraft();
  const rooms = selectedRoomsFromDraft(draft);
  if (!draft.ai_completed || !rooms.length) {
    location.href = ['paid', 'trial'].includes(draft.payment_status) ? 'ai-processing.html' : 'profession.html';
    return;
  }
  const title = document.getElementById('result-project-title');
  title.textContent = draft.title || 'التصميم النهائي';
  const tabs = document.getElementById('room-result-tabs');
  const holder = document.getElementById('interactive-result');
  let activeKey = rooms[0].key;

  holder.innerHTML = rooms.map((room, index) => roomResultMarkup(room, index, draft)).join('');
  tabs.innerHTML = rooms.map((room, index) => `<button class="room-result-tab ${index === 0 ? 'active' : ''}" data-result-room="${room.key}"><img src="${roomById(room.type).image}" alt=""><span><strong>${room.label}</strong><small>${room.area || 0} م²</small></span></button>`).join('');

  const setActiveRoom = (key) => {
    activeKey = key;
    tabs.querySelectorAll('.room-result-tab').forEach((button) => button.classList.toggle('active', button.dataset.resultRoom === key));
    holder.querySelectorAll('.room-result-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.roomResult === key));
  };
  tabs.querySelectorAll('.room-result-tab').forEach((button) => button.addEventListener('click', () => setActiveRoom(button.dataset.resultRoom)));
  setActiveRoom(activeKey);
  bindCompareSliders();
  bindPanorama();
  initAiChat(draft);

  document.getElementById('save-design')?.addEventListener('click', async () => {
    const session = await requireAuth();
    if (!session) return;
    const { error } = await supabase.from('saved_designs').insert({
      user_id: session.user.id,
      project_id: draft.project_id || null,
      title: draft.title || 'تصميم RAFEEQ',
      image_url: assetUrl('assets/room-after.svg'),
      style: draft.style,
      design_data: { rooms, colors: draft.favorite_colors, versions: draft.design_versions || [] }
    });
    if (error) console.warn(error.message);
    toast('تم حفظ التصميم', 'success');
  });
  document.getElementById('download-design')?.addEventListener('click', () => window.print());
  saveDraft({ wizard_active: false, current_step: 13 });
  safeUpdateProject(draft.project_id, { current_step: 13 });
}

if (page === 'profession') initProfession();
if (page === 'new-project') initNewProject();
if (page === 'project-type') initProjectType();
if (page === 'room-details') initRoomDetails();
if (page === 'room-area') initRoomArea();
if (page === 'choose-style') initChooseStyle();
if (page === 'choose-colors') initChooseColors();
if (page === 'budget') initBudget();
if (page === 'requirements') initRequirements();
if (page === 'project-payment') initProjectPayment();
if (page === 'upload-images') initUploadImages();
if (page === 'ai-processing') initAiProcessing();
if (page === 'ai-result') initAiResult();
