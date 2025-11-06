/* script.js - shared logic for login, products, cart, orders */

/* ---------- Keys & tiny utils ---------- */
const AUTH_KEY = 'ns_demo_auth_v1';
const USERS_KEY = 'ns_demo_users_v1';
const STORAGE_KEYS = { CART:'ns_cart_v1', ORDERS:'ns_orders_v1' };

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
function formatPrice(n){ return '₹' + Number(n).toLocaleString('en-IN'); }

/* ---------- Auth / Users ---------- */
function getUsers(){
  return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
}
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

// seed demo account
(function seedUsers(){
  const users = getUsers();
  if(!users['naman']){ users['naman'] = { pass: '1234', created: Date.now() }; saveUsers(users); }
})();

function doLogin(user, pass, remember=false){
  const users = getUsers();
  if(users[user] && users[user].pass === pass){
    const auth = { user, at: Date.now() };
    if(remember) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    return { ok:true, auth };
  }
  return { ok:false };
}
function signUp(user, pass){
  const users = getUsers();
  if(users[user]) return { ok:false, msg:'User exists' };
  users[user] = { pass, created: Date.now() };
  saveUsers(users);
  return { ok:true };
}
function getAuth(){
  return JSON.parse(localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY) || 'null');
}

/* ---------- Products (generated ~75) ---------- */
const CATEGORIES = ['Electronics','Accessories','Footwear','Home','Bags','Fitness','Stationery','Gaming','Kitchen','Mobile','Wearables','Books'];
const ADJ = ['Pro','Lite','Plus','X','Ultra','Neo','Prime','Classic','Smart','Active','Eco','Max'];
const NOUNS = ['Headphones','Watch','Wallet','Shoes','Candle','Backpack','Speaker','Sunglasses','Laptop','Mouse','Keyboard','Bottle','Tumbler','Charger','Powerbank','Lamp','Desk','Chair','Printer','Mug','Jacket','T-shirt','Socks','Camera','Drone','Tripod','Bag','Gloves','Mat','Racket','Ball','Notebook','Pen','Stapler','Case','Router'];

const PRODUCTS = [];
for(let i=1;i<=75;i++){
  const cat = CATEGORIES[i % CATEGORIES.length];
  const adj = ADJ[i % ADJ.length];
  const noun = NOUNS[i % NOUNS.length];
  const title = `${adj} ${noun} ${i}`;
  const price = Math.round((Math.random()*4000) + (i*10));
  const id = 'p' + String(i).padStart(3,'0');
  // picsum seeded image for consistent image per product
  const seed = encodeURIComponent(title.replace(/\s+/g,''));
  const img = `https://picsum.photos/seed/${seed}/600/600`;
  const desc = `${title} — premium ${noun.toLowerCase()} for ${cat.toLowerCase()}.`;
  PRODUCTS.push({ id, title, desc, price, category: cat, img });
}

/* ---------- Cart state ---------- */
let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '{}');
function saveCart(){ localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart)); updateCartUI(); }
function clearCart(){ cart = {}; saveCart(); }

/* ---------- Renders for index.html (shop) ---------- */
function populateCategoryDropdown(elSelector){
  const categories = ['All',...new Set(PRODUCTS.map(p=>p.category))];
  const sel = $(elSelector);
  if(!sel) return;
  sel.innerHTML = '';
  categories.forEach(c=>{
    const o = document.createElement('option'); o.value = c === 'All' ? '' : c; o.textContent = c;
    sel.appendChild(o);
  });
}

function renderProducts({ search='', category='', min=0, max=0, sort='popular' } = {}){
  const productsEl = $('#products');
  if(!productsEl) return;
  const q = (search||'').trim().toLowerCase();
  let list = PRODUCTS.filter(p=>{
    if(q && !(p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))) return false;
    if(category && p.category !== category) return false;
    if(min && p.price < min) return false;
    if(max && max>0 && p.price > max) return false;
    return true;
  });
  if(sort === 'price-asc') list.sort((a,b)=>a.price-b.price);
  if(sort === 'price-desc') list.sort((a,b)=>b.price-a.price);
  productsEl.innerHTML = '';
  if(list.length === 0){ $('#empty').style.display = 'block'; $('#showingCount') && ($('#showingCount').textContent = 0); return; }
  $('#empty').style.display = 'none';
  $('#showingCount') && ($('#showingCount').textContent = list.length);
  list.forEach(p=>{
    const el = document.createElement('div'); el.className = 'card';
    el.innerHTML = `
      <div class="thumb"><img loading="lazy" src="${p.img}" alt="${p.title}"></div>
      <div class="meta">
        <h3>${p.title}</h3>
        <p class="muted">${p.desc} • <span style="font-weight:700">${p.category}</span></p>
        <div style="margin-top:8px;display:flex;align-items:center;gap:10px">
          <div class="price">${formatPrice(p.price)}</div>
          <div class="muted">• Free returns</div>
        </div>
      </div>
      <div class="add">
        <button class="btn add-to-cart" data-id="${p.id}">Add</button>
      </div>
    `;
    productsEl.appendChild(el);
  });
  // bind add buttons
  $$('.add-to-cart').forEach(b=>b.onclick = e => { const id = e.currentTarget.dataset.id; addToCart(id); });
}

/* ---------- Cart UI & logic (shared) ---------- */
function updateCartUI(){
  const cartListEl = $('#cart-list');
  const subtotalEl = $('#subtotal');
  const shippingEl = $('#shipping');
  const totalEl = $('#total');
  const cartItemsLabel = $('#cart-items-label');
  const cartTotalBadge = $('#cart-total-badge');
  const cartCountEl = $('#cart-count');

  if(!cartListEl) return;
  const items = Object.keys(cart).map(id=>{
    const p = PRODUCTS.find(x=>x.id===id); return {...p, qty: cart[id]};
  });
  cartListEl.innerHTML = '';
  if(items.length === 0){
    cartListEl.innerHTML = '<div class="muted">Your cart is empty.</div>';
  } else {
    items.forEach(it=>{
      const div = document.createElement('div'); div.className = 'cart-item';
      div.innerHTML = `
        <img src="${it.img}" alt="${it.title}">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${it.title}</strong><div class="muted" style="font-size:13px">${formatPrice(it.price)} each</div></div>
            <div class="muted" style="text-align:right">${formatPrice(it.price*it.qty)}</div>
          </div>
          <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
            <div class="qty">
              <button class="dec" data-id="${it.id}">−</button>
              <div style="min-width:28px;text-align:center" aria-live="polite">${it.qty}</div>
              <button class="inc" data-id="${it.id}">+</button>
            </div>
            <button class="ghost remove" data-id="${it.id}" style="margin-left:8px">Remove</button>
          </div>
        </div>
      `;
      cartListEl.appendChild(div);
    });
  }

  // bind controls
  $$('.inc').forEach(b=>b.onclick = e=>{ const id = e.currentTarget.dataset.id; cart[id] = (cart[id]||0)+1; saveCart(); });
  $$('.dec').forEach(b=>b.onclick = e=>{ const id = e.currentTarget.dataset.id; cart[id] = Math.max(0,(cart[id]||0)-1); if(cart[id]===0) delete cart[id]; saveCart(); });
  $$('.remove').forEach(b=>b.onclick = e=>{ const id = e.currentTarget.dataset.id; delete cart[id]; saveCart(); });

  // totals
  const subtotal = Object.keys(cart).reduce((s,id)=> {
    const p = PRODUCTS.find(x=>x.id===id); return s + (p ? p.price * cart[id] : 0);
  },0);
  const shipping = subtotal > 0 ? 50 : 0;
  const total = subtotal + shipping;

  subtotalEl && (subtotalEl.textContent = formatPrice(subtotal));
  shippingEl && (shippingEl.textContent = formatPrice(shipping));
  totalEl && (totalEl.textContent = formatPrice(total));
  cartItemsLabel && (cartItemsLabel.textContent = `${Object.keys(cart).reduce((a,id)=>a+cart[id],0)} items`);
  cartTotalBadge && (cartTotalBadge.textContent = formatPrice(total));
  cartCountEl && (cartCountEl.textContent = Object.keys(cart).reduce((a,id)=>a+cart[id],0));
}

/* Add to cart */
function addToCart(id, qty=1){
  cart[id] = (cart[id]||0) + qty;
  saveCart();
  const btn = document.querySelector(`[data-id="${id}"].add-to-cart`);
  if(btn){ btn.textContent = 'Added'; setTimeout(()=>btn.textContent='Add',700); }
}

/* ---------- Checkout / Orders ---------- */
function placeOrder({name,phone,email,address}){
  const orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  const order = {
    id: 'ORD-' + Date.now(),
    date: new Date().toISOString(),
    name, phone, email, address,
    items: Object.keys(cart).map(id => {
      const p = PRODUCTS.find(x=>x.id===id);
      return { id, title: p.title, qty: cart[id], price: p.price };
    }),
    subtotal: Number(Object.keys(cart).reduce((s,id)=> s + PRODUCTS.find(x=>x.id===id).price * cart[id], 0)),
    shipping: Object.keys(cart).length>0 ? 50 : 0
  };
  order.total = order.subtotal + order.shipping;
  orders.push(order); localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  clearCart();
  return order;
}

/* ---------- Small helpers for pages ---------- */
function initShopPage(){
  populateCategoryDropdown('#category');
  renderProducts({});
  updateCartUI();

  // hooks UI
  $('#search') && $('#search').addEventListener('input', ()=> renderProducts({ search: $('#search').value || '' , category: $('#category').value || '', min: Number($('#minPrice').value||0), max: Number($('#maxPrice').value||0), sort: $('#sort').value || 'popular' }) );
  $('#applyFilter') && $('#applyFilter').addEventListener('click', ()=> renderProducts({ search: $('#search').value || '' , category: $('#category').value || '', min: Number($('#minPrice').value||0), max: Number($('#maxPrice').value||0), sort: $('#sort').value || 'popular' }) );
  $('#resetFilter') && $('#resetFilter').addEventListener('click', ()=> { $('#minPrice') && ($('#minPrice').value=''); $('#maxPrice') && ($('#maxPrice').value=''); $('#search') && ($('#search').value=''); $('#category') && ($('#category').value=''); $('#sort') && ($('#sort').value='popular'); renderProducts({}); });
  $('#open-cart') && $('#open-cart').addEventListener('click', ()=> { document.querySelector('aside').animate([{boxShadow:'0 0 0 0 rgba(6,182,212,0)'},{boxShadow:'0 18px 60px rgba(6,182,212,0.08)'}],{duration:350, direction:'alternate'}); });

  // checkout modal
  $('#checkout') && $('#checkout').addEventListener('click', ()=> {
    if(Object.keys(cart).length === 0){ alert('Cart is empty! Add items first.'); return; }
    $('#modalBack').style.display = 'flex'; $('#modalBack').setAttribute('aria-hidden','false');
  });
  $('#closeModal') && $('#closeModal').addEventListener('click', ()=> closeModal());
  $('#modalBack') && $('#modalBack').addEventListener('click', (e)=>{ if(e.target === $('#modalBack')) closeModal(); });

  $('#placeOrder') && $('#placeOrder').addEventListener('click', ()=> {
    const name = $('#name').value.trim(), phone = $('#phone').value.trim(), email = $('#email').value.trim(), address = $('#address').value.trim();
    if(!name || !phone || !address){ $('#orderMsg').textContent = 'Please fill name, phone and address.'; return; }
    const order = placeOrder({ name, phone, email, address });
    $('#orderMsg').textContent = `Order placed! ID: ${order.id}, Total: ${formatPrice(order.total)} (saved locally)`;
    setTimeout(()=>{ closeModal(); }, 1500);
  });

  // clear cart
  $('#clear-cart') && $('#clear-cart').addEventListener('click', ()=> { if(confirm('Clear the cart?')){ clearCart(); } });
  // logout button (if present)
  $('#logoutBtn') && $('#logoutBtn').addEventListener('click', ()=> { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); window.location.href = 'login.html'; });

  // keyboard helper
  document.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='c' && e.target.tagName.toLowerCase()!=='input'){ document.querySelector('aside').scrollIntoView({behavior:'smooth'}); } });
}

function closeModal(){
  $('#modalBack') && ($('#modalBack').style.display='none') && $('#modalBack').setAttribute('aria-hidden','true');
  $('#orderMsg') && ($('#orderMsg').textContent='');
  $('#name') && ($('#name').value=''); $('#phone') && ($('#phone').value=''); $('#email') && ($('#email').value=''); $('#address') && ($('#address').value='');
}

/* ---------- Cart page specific ---------- */
function initCartPage(){
  updateCartUI();
  // render cart table on cart.html
  const table = $('#cart-table');
  const totalBox = $('#cart-total');
  if(table){
    const itemsList = Object.keys(cart).map(id=>{
      const p = PRODUCTS.find(x=>x.id===id); return {...p, qty: cart[id]};
    });
    table.innerHTML = '<tr><th>Product</th><th>Price</th><th>Qty</th><th>Sub</th><th>Action</th></tr>';
    let total = 0;
    itemsList.forEach(it=>{
      total += it.price * it.qty;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.title}</td><td>${formatPrice(it.price)}</td><td>${it.qty}</td><td>${formatPrice(it.price*it.qty)}</td><td><button data-id="${it.id}" class="remove-cart">Remove</button></td>`;
      table.appendChild(tr);
    });
    totalBox && (totalBox.textContent = formatPrice(total + (total>0?50:0)));
    $$('.remove-cart').forEach(b => b.onclick = (e)=>{ const id = e.currentTarget.dataset.id; delete cart[id]; saveCart(); initCartPage(); });
  }

  // checkout form on cart page
  const placeBtn = $('#cartPlaceOrder');
  if(placeBtn){
    placeBtn.addEventListener('click', ()=> {
      const name = $('#cart_name').value.trim(), phone = $('#cart_phone').value.trim(), email = $('#cart_email').value.trim(), address = $('#cart_address').value.trim();
      if(!name || !phone || !address){ alert('Please fill name, phone and address'); return; }
      const order = placeOrder({ name, phone, email, address });
      alert(`Order placed! ID: ${order.id} | Total: ${formatPrice(order.total)} — saved locally.`);
      window.location.href = 'index.html';
    });
  }
}

/* ---------- Init guard for auth on shop/cart pages ---------- */
function authGuardRedirect(){
  const auth = getAuth();
  if(!auth || !auth.user){
    // allow browsing index? We'll redirect to login to keep behaviour consistent
    window.location.href = 'login.html';
    return false;
  }
  // set user badge if present
  const badge = $('#userBadge'); if(badge) badge.textContent = auth.user;
  const welcome = $('#welcomeLine'); if(welcome) welcome.textContent = `Welcome, ${auth.user} — Explore products`;
  return true;
}

/* ---------- Exports (used by HTML) ---------- */
window.app = {
  doLogin, signUp, getAuth, PRODUCTS,
  initShopPage, initCartPage, authGuardRedirect, addToCart, saveCart, getOrders: ()=> JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]')
};
