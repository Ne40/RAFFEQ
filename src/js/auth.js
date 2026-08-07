import { supabase } from './supabase-client.js';
import { toast, getSession, getProfile, dashboardForProfile } from './app.js';

const page = document.body.dataset.page;
const siteUrl = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
const PENDING_ACCOUNT_TYPE_KEY = 'rafeeq-pending-account-type';

function setLoading(button, loading, label = 'جارٍ التنفيذ...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'إرسال';
  }
}

function selectedAccountType() {
  return document.querySelector('input[name="account_type"]:checked')?.value || 'user';
}

function initAccountTypeCards() {
  document.querySelectorAll('.account-type-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.account-type-card').forEach((item) => item.classList.remove('selected'));
      const input = card.querySelector('input');
      if (input) input.checked = true;
      card.classList.add('selected');
    });
  });
}

async function redirectForCurrentUser(fallback = 'dashboard.html') {
  const session = await getSession();
  if (!session) {
    location.href = fallback;
    return;
  }
  const profile = await getProfile(session.user.id);
  location.href = dashboardForProfile(profile);
}

async function googleLogin(button) {
  if (page === 'register') {
    localStorage.setItem(PENDING_ACCOUNT_TYPE_KEY, selectedAccountType());
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth-callback.html`
    }
  });
  if (error) throw error;
  setLoading(button, false);
}

initAccountTypeCards();

document.querySelectorAll('[data-google-login]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      setLoading(button, true, 'جاري التحويل إلى Google...');
      await googleLogin(button);
    } catch (error) {
      setLoading(button, false);
      toast(error.message || 'تعذر تسجيل الدخول عبر Google', 'error');
    }
  });
});

if (page === 'register') {
  const form = document.getElementById('register-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const fullName = String(data.get('full_name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const accountType = String(data.get('account_type') || 'user');
    const password = String(data.get('password') || '');
    const confirmPassword = String(data.get('confirm_password') || '');

    if (password !== confirmPassword) {
      toast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }
    if (password.length < 8) {
      toast('كلمة المرور يجب ألا تقل عن 8 أحرف', 'error');
      return;
    }

    try {
      setLoading(button, true, 'جارٍ إنشاء الحساب...');
      const { data: response, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth-callback.html`,
          data: {
            full_name: fullName,
            phone,
            account_type: accountType
          }
        }
      });
      if (error) throw error;

      if (response.session) {
        await redirectForCurrentUser();
      } else {
        form.reset();
        document.querySelector('input[name="account_type"][value="user"]')?.click();
        toast('تم إنشاء الحساب. راجع بريدك لتأكيد الحساب.', 'success');
      }
    } catch (error) {
      toast(error.message || 'تعذر إنشاء الحساب', 'error');
    } finally {
      setLoading(button, false);
    }
  });
}

if (page === 'login') {
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const next = new URLSearchParams(location.search).get('next');

    try {
      setLoading(button, true, 'جارٍ تسجيل الدخول...');
      const { data: response, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (next) location.href = next;
      else {
        const profile = await getProfile(response.user.id);
        location.href = dashboardForProfile(profile);
      }
    } catch (error) {
      toast(error.message || 'بيانات تسجيل الدخول غير صحيحة', 'error');
    } finally {
      setLoading(button, false);
    }
  });

  getSession().then(async (session) => {
    if (session) {
      const profile = await getProfile(session.user.id);
      location.href = dashboardForProfile(profile);
    }
  }).catch(() => {});
}

if (page === 'forgot-password') {
  const form = document.getElementById('forgot-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get('email') || '').trim();

    try {
      setLoading(button, true, 'جارٍ إرسال الرابط...');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password.html`
      });
      if (error) throw error;
      toast('تم إرسال رابط إعادة تعيين كلمة المرور.', 'success');
      form.reset();
    } catch (error) {
      toast(error.message || 'تعذر إرسال الرابط', 'error');
    } finally {
      setLoading(button, false);
    }
  });
}

if (page === 'reset-password') {
  const form = document.getElementById('reset-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirmPassword = String(data.get('confirm_password') || '');

    if (password !== confirmPassword) {
      toast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }
    if (password.length < 8) {
      toast('كلمة المرور يجب ألا تقل عن 8 أحرف', 'error');
      return;
    }

    try {
      setLoading(button, true, 'جارٍ تحديث كلمة المرور...');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast('تم تحديث كلمة المرور بنجاح.', 'success');
      setTimeout(() => { location.href = 'login.html'; }, 1100);
    } catch (error) {
      toast(error.message || 'تعذر تحديث كلمة المرور', 'error');
    } finally {
      setLoading(button, false);
    }
  });
}

if (page === 'auth-callback') {
  (async () => {
    const status = document.getElementById('callback-status');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        const pendingType = localStorage.getItem(PENDING_ACCOUNT_TYPE_KEY);
        if (pendingType && ['user', 'interior_designer', 'company', 'engineering_office'].includes(pendingType)) {
          await supabase.from('profiles').update({ account_type: pendingType }).eq('id', data.session.user.id);
          localStorage.removeItem(PENDING_ACCOUNT_TYPE_KEY);
        }
        const profile = await getProfile(data.session.user.id);
        status.textContent = 'تم تأكيد الحساب بنجاح. جاري فتح لوحة التحكم...';
        setTimeout(() => { location.href = dashboardForProfile(profile); }, 900);
      } else {
        status.textContent = 'تم تأكيد البريد. يمكنك تسجيل الدخول الآن.';
        setTimeout(() => { location.href = 'login.html?message=تم تأكيد البريد بنجاح'; }, 1200);
      }
    } catch (error) {
      status.textContent = error.message || 'تعذر إكمال عملية تسجيل الدخول.';
    }
  })();
}
