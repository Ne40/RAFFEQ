
import { PRODUCTS } from './data.js';
import { formatMoney, toast, requireAuth } from './app.js';
import { supabase } from './supabase-client.js';

const page = document.body.dataset.page;

function getCart() {
  try { return JSON.parse(localStorage.getItem('rafeeq-cart') || '[]'); }
  catch { return []; }
}
function saveCart(cart) { localStorage.setItem('rafeeq-cart', JSON.stringify(cart)); }

function cartDetails() {
  return getCart().map((item) => ({
    ...item,
    product: PRODUCTS.find((product) => product.id === item.productId)
  })).filter((item) => item.product);
}

function totals() {
  const subtotal = cartDetails().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal ? 350 : 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

function initCart() {
  const holder = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');

  function render() {
    const items = cartDetails();
    if (!items.length) {
      holder.innerHTML = '<div class="empty-state"><div class="emoji">🛒</div><h3>السلة فارغة</h3><p>استكشف منتجات الأثاث المناسبة لتصميمك.</p><a class="btn btn-primary" href="marketplace.html">تصفح المتجر</a></div>';
    } else {
      holder.innerHTML = items.map((item) => `
        <div class="cart-item">
          <img src="${item.product.image}" alt="${item.product.name}">
          <div><strong>${item.product.name}</strong><small style="display:block">${formatMoney(item.product.price)} للقطعة</small></div>
          <div class="quantity">
            <button data-cart-minus="${item.product.id}">−</button>
            <span>${item.quantity}</span>
            <button data-cart-plus="${item.product.id}">＋</button>
          </div>
          <div style="text-align:left"><strong>${formatMoney(item.product.price * item.quantity)}</strong><button class="btn btn-ghost" style="display:block;margin-top:6px;min-height:36px;padding:5px 10px" data-cart-remove="${item.product.id}">حذف</button></div>
        </div>`).join('');
    }

    const { subtotal, shipping, total } = totals();
    summary.innerHTML = `
      <div class="summary-list">
        <div class="summary-row"><span>الإجمالي الفرعي</span><strong>${formatMoney(subtotal)}</strong></div>
        <div class="summary-row"><span>الشحن</span><strong>${formatMoney(shipping)}</strong></div>
        <div class="summary-row" style="font-size:1.2rem"><span>الإجمالي</span><strong>${formatMoney(total)}</strong></div>
      </div>
      <a class="btn btn-primary btn-block" style="margin-top:18px" href="${items.length ? 'checkout.html' : 'marketplace.html'}">${items.length ? 'إتمام الشراء' : 'تصفح المنتجات'}</a>`;

    document.querySelectorAll('[data-cart-minus]').forEach((button) => button.addEventListener('click', () => update(button.dataset.cartMinus, -1)));
    document.querySelectorAll('[data-cart-plus]').forEach((button) => button.addEventListener('click', () => update(button.dataset.cartPlus, 1)));
    document.querySelectorAll('[data-cart-remove]').forEach((button) => button.addEventListener('click', () => remove(button.dataset.cartRemove)));
  }

  function update(id, delta) {
    const cart = getCart();
    const item = cart.find((entry) => entry.productId === id);
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart(cart);
    render();
  }
  function remove(id) {
    saveCart(getCart().filter((entry) => entry.productId !== id));
    render();
  }
  render();
}

function initCheckout() {
  const list = document.getElementById('checkout-items');
  const totalHolder = document.getElementById('checkout-total');
  const items = cartDetails();
  const summary = totals();

  list.innerHTML = items.map((item) => `
    <div class="list-item">
      <img src="${item.product.image}" style="width:58px;height:58px;border-radius:12px" alt="${item.product.name}">
      <div style="flex:1"><strong>${item.product.name}</strong><small style="display:block">الكمية: ${item.quantity}</small></div>
      <strong>${formatMoney(item.product.price * item.quantity)}</strong>
    </div>`).join('');
  totalHolder.textContent = formatMoney(summary.total);

  document.getElementById('checkout-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = await requireAuth();
    if (!session) return;
    if (!items.length) return toast('السلة فارغة', 'error');
    const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
    const orderNumber = `RF-${Date.now().toString().slice(-6)}`;

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: session.user.id,
        order_number: orderNumber,
        total_amount: summary.total,
        shipping_address: formData,
        payment_method: formData.payment_method,
        status: 'pending'
      })
      .select()
      .maybeSingle();

    if (!error && order) {
      await supabase.from('order_items').insert(items.map((item) => ({
        order_id: order.id,
        product_ref: item.product.id,
        product_name: item.product.name,
        unit_price: item.product.price,
        quantity: item.quantity
      })));
    }

    localStorage.setItem('rafeeq-last-order', JSON.stringify({
      orderNumber,
      total: summary.total,
      createdAt: new Date().toISOString()
    }));
    localStorage.removeItem('rafeeq-cart');
    location.href = 'order-success.html';
  });
}

function initOrderSuccess() {
  const order = JSON.parse(localStorage.getItem('rafeeq-last-order') || '{}');
  document.getElementById('success-order-number').textContent = order.orderNumber || 'RF-000000';
  document.getElementById('success-order-total').textContent = formatMoney(order.total || 0);
}

if (page === 'cart') initCart();
if (page === 'checkout') initCheckout();
if (page === 'order-success') initOrderSuccess();
