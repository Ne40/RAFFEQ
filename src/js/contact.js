
import { toast } from './app.js';

document.getElementById('contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  toast('تم استلام رسالتك، وسيتواصل فريق الدعم معك قريبًا.', 'success');
  form.reset();
});

document.getElementById('live-chat')?.addEventListener('click', () => {
  toast('ميزة المحادثة الحية جاهزة للربط بخدمة الدعم.', 'success');
});
