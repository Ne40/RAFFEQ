import { ENGINEERING_OFFICES, PRODUCTS } from './data.js';
import { formatMoney, toast } from './app.js';

const furnitureCost = PRODUCTS.slice(0, 5).reduce((sum, product) => sum + product.price, 0);
let selectedOffice = ENGINEERING_OFFICES[0];

function render() {
  const holder = document.getElementById('engineering-office-list');
  holder.innerHTML = ENGINEERING_OFFICES.map((office) => `
    <label class="office-card ${selectedOffice.id === office.id ? 'selected' : ''}">
      <input type="radio" name="engineering_office" value="${office.id}" ${selectedOffice.id === office.id ? 'checked' : ''}>
      <div class="office-avatar">${office.avatar}</div>
      <div class="office-main"><div><h3>${office.name}</h3><span>★ ${office.rating} • ${office.projects} مشروع سابق</span></div><div class="office-specialties">${office.specialties.map((item) => `<span>${item}</span>`).join('')}</div></div>
      <div class="office-numbers"><span>مدة التنفيذ<strong>${office.duration}</strong></span><span>تكلفة التنفيذ<strong>${formatMoney(office.executionCost)}</strong></span></div>
    </label>`).join('');

  holder.querySelectorAll('.office-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedOffice = ENGINEERING_OFFICES.find((office) => office.id === card.querySelector('input').value) || ENGINEERING_OFFICES[0];
      render();
    });
  });

  document.getElementById('furniture-cost').textContent = formatMoney(furnitureCost);
  document.getElementById('execution-cost').textContent = formatMoney(selectedOffice.executionCost);
  document.getElementById('additional-fees').textContent = formatMoney(selectedOffice.fee);
  document.getElementById('grand-total').textContent = formatMoney(furnitureCost + selectedOffice.executionCost + selectedOffice.fee);
}

render();
document.getElementById('confirm-office')?.addEventListener('click', () => {
  localStorage.setItem('rafeeq-selected-office', JSON.stringify(selectedOffice));
  toast(`تم إرسال طلب التنفيذ إلى ${selectedOffice.name}`, 'success');
  setTimeout(() => { location.href = 'service-request.html'; }, 750);
});
