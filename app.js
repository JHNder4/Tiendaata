const SB_URL = 'https://svvylvtmmynxkmdowymx.supabase.co';
const SB_PUBLISHABLE_KEY = 'sb_publishable_RYbyrmTxY4Qv2rKTuxeT6Q_70Juauak';
const ADMIN_FN = SB_URL + '/functions/v1/admin-panel';
const client = window.supabase.createClient(SB_URL, SB_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const money = (amount) => '$' + Number(amount || 0).toLocaleString('es-MX') + ' MXN';
const K = 'tienda-ata-v1';
const CART_KEY = K + '-carrito';
const STATUS = { published: 'Publicado', draft: 'Borrador', hidden: 'Oculto' };
const GENDERS = { general: 'General', hombre: 'Hombre', mujer: 'Mujer' };
const CATEGORIES = ['Pantalones', 'Shorts', 'Playeras', 'Camisas', 'Sudaderas', 'Chamarras', 'Jeans', 'Vestidos', 'Faldas', 'Blusas', 'Conjuntos', 'Ropa interior', 'Accesorios', 'Calzado'];
const ORDER_STATUSES = ['Pendiente de confirmar', 'Confirmado', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'];
const DEMO_PRODUCTS = [];

const placeholderImage = (color, kind, number) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#eeedea"/><path d="${{
    t: 'M90 90l40-20q20 25 40 0l40 20 40 50-35 20v150H85V160L50 140z',
    p: 'M100 70h100l15 260h-55l-10-170-10 170H85z',
    o: 'M60 230q0-70 90-70t90 70v40H60z'
  }[kind] || 'M60 100h180v200H60z'}" fill="${color}"/><text x="150" y="380" font-size="14" text-anchor="middle" fill="#888" font-family="sans-serif">Muestra ${number}</text></svg>`
);
const seedProducts = () => DEMO_PRODUCTS.map((item) => ({
  id: item.id,
  name: item.name,
  brand: '',
  cat: item.cat,
  price: item.price,
  old: item.old || '',
  desc: item.desc,
  photos: item.cols.map((color, index) => placeholderImage(color, item.k, index + 1)),
  sizes: item.sizes ? { ...item.sizes } : null,
  stock: item.stock || 0,
  status: 'published',
  isDemo: true,
  det: {}
}));

let S = { p: [], o: [], c: [], promos: [] };
let session = null;
let isAdmin = false;
let authChecking = false;
let clerkReady = false;
let ready = false;
let dirty = false;
let currentRoute = location.hash;
let F = {};
let ed = null;
let toastTimer;
const snapshot = {};

try {
  S.c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  if (!Array.isArray(S.c)) S.c = [];
} catch (_) {
  S.c = [];
}

function toast(message) {
  $('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.textContent = message;
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 3200);
}

function safeImageSource(source) {
  const value = String(source || '');
  if (/^https:\/\//i.test(value) || /^data:image\/svg\+xml,/i.test(value)) return value;
  return '';
}

window.fb = (image) => {
  const placeholder = document.createElement('div');
  placeholder.className = 'ph';
  placeholder.textContent = 'Imagen no disponible';
  image.replaceWith(placeholder);
};

function im(source, alt, className = '') {
  const url = safeImageSource(source);
  return url
    ? `<img src="${esc(url)}" alt="${esc(alt)}" class="${esc(className)}" loading="lazy" onerror="fb(this)">`
    : '<div class="ph">Sin foto</div>';
}

const rowForProduct = (product) => ({ id: product.id, data: product, is_demo: !!product.isDemo });
const totalStock = (product) => product.sizes
  ? Object.values(product.sizes).reduce((sum, amount) => sum + Number(amount || 0), 0)
  : Number(product.stock || 0);
const stockForSize = (product, size) => product.sizes
  ? Number(product.sizes[size] || 0)
  : Number(product.stock || 0);
const publishedProducts = () => S.p.filter((product) => product.status === 'published');
const cartCount = () => S.c.reduce((sum, item) => sum + Number(item.qty || 0), 0);
const activePromotions = () => S.promos.filter((promo) => {
  if (!promo.active) return false;
  const now = Date.now();
  return (!promo.starts_at || new Date(promo.starts_at).getTime() <= now) &&
    (!promo.ends_at || new Date(promo.ends_at).getTime() >= now);
});
const promoForProduct = (product) => {
  const matches = activePromotions().filter((promo) => promo.scope === 'all' || (promo.scope === 'category' && promo.target === product.cat) || (promo.scope === 'product' && promo.target === product.id));
  return matches.reduce((best, promo) => {
    const base = Number(product.price || 0);
    const savings = promo.discount_type === 'percent' ? base * Math.min(100, Number(promo.discount_value || 0)) / 100 : Math.min(base, Number(promo.discount_value || 0));
    const bestSavings = best ? (best.discount_type === 'percent' ? base * Math.min(100, Number(best.discount_value || 0)) / 100 : Math.min(base, Number(best.discount_value || 0))) : -1;
    return savings > bestSavings ? promo : best;
  }, null);
};
const effectivePrice = (product) => {
  const base = Number(product.price || 0), promo = promoForProduct(product);
  if (!promo) return base;
  const value = promo.discount_type === 'percent' ? base * (1 - Math.min(100, Number(promo.discount_value || 0)) / 100) : base - Math.min(base, Number(promo.discount_value || 0));
  return Math.max(0, Math.round(value * 100) / 100);
};
const productPrice = (product) => {
  const current = effectivePrice(product), base = Number(product.price || 0), old = Number(product.old || 0), reference = old > base ? old : base, promo = promoForProduct(product);
  return money(current) + (reference > current ? `<span class="old">${money(reference)}</span>` : '') + (promo ? `<em class="promo-badge">${esc(promo.badge || 'Oferta')}</em>` : '');
};
const cartRows = () => {
  S.c = S.c.filter((item) => S.p.some((product) => product.id === item.pid));
  return S.c.map((item, index) => ({ item, index, product: S.p.find((product) => product.id === item.pid) }));
};
const cartTotal = () => cartRows().reduce((sum, { item, product }) => sum + item.qty * effectivePrice(product), 0);
const orderTotal = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
const go = (hash) => { location.hash = hash; };

async function adminRequest(action, extra = {}) {
  if (!window.Clerk?.session) throw new Error('Inicia sesión como administrador.');
  const token = await window.Clerk.session.getToken();
  if (!token) throw new Error('La sesión de administrador no está disponible.');
  const response = await fetch(ADMIN_FN,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,...extra})});
  const result = await response.json().catch(()=>({}));
  if(!response.ok||result.error)throw new Error(result.error||'No se pudo completar la operación.');
  return result;
}
async function loadProducts(){
  if(isAdmin){const result=await adminRequest('products');S.p=(result.data||[]).filter(r=>r.id!=='_seeded'&&r.data&&typeof r.data==='object').map(r=>({...r.data,id:r.id,isDemo:!!r.is_demo||!!r.data.isDemo}));}
  else{const {data,error}=await client.from('products').select('id,data,is_demo,created_at').order('created_at',{ascending:true});if(error)throw error;S.p=(data||[]).filter(r=>r.id!=='_seeded'&&r.data&&typeof r.data==='object').map(r=>({...r.data,id:r.id,isDemo:!!r.is_demo||!!r.data.isDemo}));}
  Object.keys(snapshot).forEach(id=>delete snapshot[id]);S.p.forEach(product=>{snapshot[product.id]=JSON.stringify(product);});
}
async function loadOrders(){if(!isAdmin){S.o=[];return;}const result=await adminRequest('orders');S.o=(result.data||[]).map(r=>({...r.data||{},n:r.n}));}
async function loadPromotions(){
  if(isAdmin){const result=await adminRequest('promotions');S.promos=result.data||[];}
  else{const {data,error}=await client.from('promotions').select('*').order('priority',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;S.promos=data||[];}
}
async function refreshAdminState(){if(!isAdmin){S.o=[];return;}try{await loadOrders();await loadPromotions();}catch(error){console.error('No se pudieron cargar los datos de administración:',error);S.o=[];S.promos=[];}}

async function persistProducts(){
  const currentIds=new Set(S.p.map(p=>p.id)),changed=S.p.filter(p=>snapshot[p.id]!==JSON.stringify(p)),deleted=Object.keys(snapshot).filter(id=>!currentIds.has(id));
  if(!changed.length&&!deleted.length)return true;if(!isAdmin){toast('Ingresa la contraseña de administrador para guardar cambios.');return false;}
  if(changed.length){await adminRequest('upsert_products',{rows:changed.map(rowForProduct)});changed.forEach(p=>{snapshot[p.id]=JSON.stringify(p);});}
  if(deleted.length){await adminRequest('delete_products',{ids:deleted});deleted.forEach(id=>delete snapshot[id]);}return true;
}
async function save() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(S.c)); } catch (_) { /* private browsing may block local storage */ }
  try {
    const ok = await persistProducts();
    if (ok) $('#cc') && ($('#cc').textContent = cartCount());
    return ok;
  } catch (error) {
    console.error('No se pudo guardar en Supabase:', error);
    toast('No se pudo guardar en Supabase. Revisa tu conexión e inténtalo de nuevo.');
    return false;
  }
}

function shell(content) {
  return `<header class="hd"><div class="brand">Tienda Ata</div><nav><a href="#/">Inicio</a><a href="#/catalogo">Catálogo</a><a href="#/carrito">Carrito (<span id="cc">${cartCount()}</span>)</a></nav></header>${content}<footer class="pf"><div class="pf-links"><a href="#/admin">Panel de administración</a><button class="top-btn" type="button" onclick="scrollTo({top:0,behavior:'smooth'})">Volver arriba ↑</button></div></footer>`;
}

function productCard(product) {
  const photos = product.photos || [];
  return `<a class="card" href="#/producto/${encodeURIComponent(product.id)}">${im(photos[0], product.name)}<b>${esc(product.name)}</b><span>${productPrice(product)}</span>${totalStock(product) ? '' : '<em>Agotado</em>'}</a>`;
}

function home() {
  const list = publishedProducts();
  const offers = list.filter((product) => effectivePrice(product) < Number(product.price || 0) || Number(product.old) > Number(product.price));
  const categories = [...new Set(list.map((product) => product.cat).filter(Boolean))];
  const banners = activePromotions().filter((promo) => promo.scope === 'all');
  return `${banners.length ? `<div class="promo-banner">${banners.slice(0,3).map((promo) => `<div><span>${esc(promo.badge || "Oferta")}</span><strong>${esc(promo.title)}</strong>${promo.subtitle ? `<p>${esc(promo.subtitle)}</p>` : ""}</div>`).join("")}</div>` : ""}<form class="srch" onsubmit="go('#/catalogo?q='+encodeURIComponent(this.q.value));return false"><span class="search-icon">⌕</span><input name="q" placeholder="Buscar" aria-label="Buscar"><button class="btn">Buscar</button></form>
     <div class="departments"><a class="on" href="#/">General</a><a href="#/catalogo?genero=hombre">Hombre</a><a href="#/catalogo?genero=mujer">Mujer</a></div>
     <div class="section-label">Categorías</div><div class="chips">${CATEGORIES.map((category) => `<a href="#/catalogo?cat=${encodeURIComponent(category)}">${esc(category)}</a>`).join("")}</div>
     <div class="home-products">${list.slice(-8).reverse().map(productCard).join("")}</div>
     ${offers.length ? `<section class="offer-block"><div class="section-label">Ofertas</div><div class="grid">${offers.map(productCard).join("")}</div></section>` : ""}`;
}

function filteredProducts() {
  const query = String(F.q || '').toLowerCase();
  return publishedProducts().filter((product) =>
    (!query || `${product.name || ''} ${product.brand || ''} ${product.cat || ''} ${GENDERS[product.gender] || ''}`.toLowerCase().includes(query)) &&
    (!F.gender || (product.gender || 'general') === F.gender) &&
    (!F.cat || product.cat === F.cat) &&
    (!F.size || (!!product.sizes && stockForSize(product, F.size) > 0)) &&
    (!F.max || Number(product.price) <= Number(F.max)) &&
    (!F.av || totalStock(product) > 0)
  );
}

function renderProductList() {
  const target = $('#lst');
  if (!target) return;
  const list = filteredProducts();
  target.innerHTML = list.length
    ? `<div class="grid">${list.map(productCard).join('')}</div>`
    : '<p class="mu">No hay prendas con esos filtros.</p>';
}

function catalog(queryString) {
  F = { q: queryString.get('q') || '', gender: queryString.get('genero') || '', cat: queryString.get('cat') || '', size: '', max: '', av: false };
  const list = publishedProducts();
  const sizes = [...new Set(list.flatMap((product) => product.sizes ? Object.keys(product.sizes) : []))];
  return `<div class="departments"><a class="${!F.gender ? 'on' : ''}" href="#/catalogo">General</a><a class="${F.gender === 'hombre' ? 'on' : ''}" href="#/catalogo?genero=hombre">Hombre</a><a class="${F.gender === 'mujer' ? 'on' : ''}" href="#/catalogo?genero=mujer">Mujer</a></div><h1>${F.gender ? GENDERS[F.gender] : 'Catálogo general'}</h1><form class="flt" id="ff" oninput="filt()" onsubmit="return false"><label>Buscar<input name="q" value="${esc(F.q)}"></label><label>Sección<select name="gender"><option value="">General</option>${Object.entries(GENDERS).filter(([key])=>key!=='general').map(([key,label])=>`<option value="${key}" ${key === F.gender ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Categoría<select name="cat"><option value="">Todas</option>${CATEGORIES.map((category) => `<option value="${esc(category)}" ${category === F.cat ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label>Talla<select name="size"><option value="">Todas</option>${sizes.map((size) => `<option value="${esc(size)}">${esc(size)}</option>`).join('')}</select></label><label>Precio máximo<input name="max" type="number" min="0"></label><label class="ck"><input name="av" type="checkbox">Solo disponibles</label></form><div id="lst"></div>`;
}

function filt() {
  const form = $('#ff');
  if (!form) return;
  F = { q: form.q.value, gender: form.gender.value, cat: form.cat.value, size: form.size.value, max: Number(form.max.value) || '', av: form.av.checked };
  renderProductList();
}

function gallery(product) {
  const photos = (product.photos || []).length ? product.photos : [''];
  const multiple = photos.length > 1;
  return `<div class="gal"><div class="track">${photos.map((source) => `<div class="sl">${im(source, product.name)}</div>`).join('')}</div>${multiple ? `<button class="gb l" data-d="-1">Anterior</button><button class="gb r" data-d="1">Siguiente</button><span class="cnt">1 de ${photos.length}</span>` : ''}</div>${multiple ? `<div class="th">${photos.map((source, index) => `<button data-i="${index}" aria-label="Foto ${index + 1}">${im(source, product.name)}</button>`).join('')}</div>` : ''}`;
}

function bindGallery(root) {
  const track = $('.track', root);
  if (!track) return;
  const counter = $('.cnt', root);
  const width = () => track.clientWidth || 1;
  track.onscroll = () => { if (counter) counter.textContent = `${Math.round(track.scrollLeft / width()) + 1} de ${track.children.length}`; };
  $$('.gb', root).forEach((button) => button.onclick = () => track.scrollBy({ left: width() * Number(button.dataset.d), behavior: 'smooth' }));
  $$('.th button', root).forEach((button) => button.onclick = () => track.scrollTo({ left: width() * Number(button.dataset.i), behavior: 'smooth' }));
}

function productView(product, preview = false) {
  if (!product || (!preview && product.status !== 'published')) return '<p>No encontramos este producto. <a href="#/catalogo">Ver catálogo</a></p>';
  const details = Object.entries(product.det || {}).filter(([, value]) => value);
  const labels = { color: 'Color', material: 'Material', fit: 'Corte', cond: 'Condición' };
  const sizes = product.sizes;
  return `<div class="pd"><div>${gallery(product)}</div><div><div class="mu">${esc(product.brand || '')}</div><h1>${esc(product.name || 'Sin nombre')}</h1><div>${product.price !== '' ? productPrice(product) : ''}</div>
    ${sizes ? `<div class="sizes">${Object.entries(sizes).map(([size, amount]) => `<button class="sz" data-s="${esc(size)}" ${amount ? '' : 'disabled title="Agotada"'}>${esc(size)}</button>`).join('')}</div><div class="av mu">Elige una talla</div>` : `<div class="av mu">${product.stock ? `Disponible: ${Number(product.stock)}` : 'Agotado'}</div>`}
    <div class="acts"><button class="btn add" ${preview || !totalStock(product) ? 'disabled' : ''}>Agregar al carrito</button><button class="btn s buy" ${preview || !totalStock(product) ? 'disabled' : ''}>Comprar ahora</button></div>
    <p>${esc(product.desc || '')}</p>${details.length ? `<p class="mu">${details.map(([key, value]) => `${labels[key] || esc(key)}: ${esc(value)}`).join(' · ')}</p>` : ''}</div></div>`;
}

function bindProduct(root, product) {
  let selectedSize = null;
  const availability = $('.av', root);
  $$('.sz', root).forEach((button) => button.onclick = () => {
    selectedSize = button.dataset.s;
    $$('.sz', root).forEach((item) => item.classList.toggle('on', item === button));
    availability.textContent = `Disponible: ${stockForSize(product, selectedSize)}`;
  });
  const add = () => {
    if (product.sizes && !selectedSize) return toast('Elige una talla'), false;
    const available = stockForSize(product, selectedSize || '');
    if (!available) return toast('Agotado'), false;
    const item = S.c.find((entry) => entry.pid === product.id && entry.size === (selectedSize || ''));
    if (item) {
      if (item.qty >= available) return toast('No hay más existencias'), false;
      item.qty++;
    } else {
      S.c.push({ pid: product.id, size: selectedSize || '', qty: 1 });
    }
    void save();
    $('#cc').textContent = cartCount();
    toast('Agregado al carrito');
    return true;
  };
  $('.add', root).onclick = add;
  $('.buy', root).onclick = () => add() && go('#/carrito');
}

function cart() {
  const rows = cartRows();
  if (!rows.length) return '<h1>Carrito</h1><p class="mu">Tu carrito está vacío.</p><a class="btn" href="#/catalogo">Ver catálogo</a>';
  return `<h1>Carrito</h1>${rows.map(({ item, index, product }) => `<div class="ci">${im((product.photos || [])[0], product.name)}<div><b>${esc(product.name)}</b><div class="mu">${item.size ? `Talla ${esc(item.size)} · ` : ''}${money(effectivePrice(product))}</div></div><div class="row"><button class="btn s sm" onclick="cq(${index},-1)" aria-label="Menos">−</button>${item.qty}<button class="btn s sm" onclick="cq(${index},1)" aria-label="Más">+</button></div><button class="btn s sm" onclick="cr(${index})">Quitar</button></div>`).join('')}<h2>Total: ${money(cartTotal())}</h2><a class="btn" href="#/pedido">Continuar con el pedido</a>`;
}

function cq(index, delta) {
  const item = S.c[index];
  const product = S.p.find((candidate) => candidate.id === item?.pid);
  if (!item || !product) return;
  const next = item.qty + delta;
  if (next < 1) return;
  if (next > stockForSize(product, item.size)) return toast('No hay más existencias');
  item.qty = next;
  void save().then(render);
}

function cr(index) {
  S.c.splice(index, 1);
  void save().then(render);
}

const ORDER_NOTE = '';
function checkout() {
  if (!cartRows().length) return '<p>Tu carrito está vacío. <a href="#/catalogo">Ver catálogo</a></p>';
  return `<h1>Finalizar pedido</h1>${ORDER_NOTE}<form id="checkout-form"><label>Nombre<input name="name" autocomplete="name" required maxlength="120"></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" required maxlength="40"></label><label>Dirección de entrega<textarea name="addr" autocomplete="street-address" required maxlength="500"></textarea></label><label>Notas (opcional)<textarea name="notes" maxlength="1000"></textarea></label><h2>Total: ${money(cartTotal())}</h2><button class="btn" id="cb">Confirmar pedido</button></form>`;
}

async function placeOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const rows = cartRows();
  if (!rows.length) return toast('Tu carrito está vacío.');
  const button = $('#cb');
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.textContent = 'Enviando…'; }

  const order = {
    date: new Date().toISOString(),
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(),
    addr: form.elements.addr.value.trim(),
    notes: form.elements.notes.value.trim(),
    status: ORDER_STATUSES[0],
    items: rows.map(({ item, product }) => ({
      pid: product.id,
      name: product.name,
      size: item.size,
      qty: item.qty,
      price: effectivePrice(product)
    }))
  };

  try {
    const { data, error } = await client.rpc('crear_pedido', { p: order });
    if (error) throw error;
    const orderNumber = Number(data);
    S.c = [];
    try { await loadProducts(); }
    catch (reloadError) { console.warn('Pedido creado; no se actualizó el catálogo local:', reloadError); }
    await save();
    $('#cc') && ($('#cc').textContent = '0');
    go(`#/confirmacion/${encodeURIComponent(orderNumber)}`);
  } catch (error) {
    console.error('No se pudo registrar el pedido:', error);
    if (button) { button.disabled = false; button.textContent = 'Confirmar pedido'; }
    toast(error.message?.includes('Sin existencias') ? 'El inventario cambió. Revisa tu carrito.' : 'No se pudo registrar el pedido. Inténtalo de nuevo.');
  }
}

function done(orderNumber) {
  return `<h1>Pedido #${esc(orderNumber)}</h1>${ORDER_NOTE}<p>Tu pedido quedó registrado correctamente.</p><a class="btn" href="#/catalogo">Seguir viendo</a>`;
}

function adminLogin(){
  return `<section class="f clerk-login"><h2>Acceso de administración</h2><p class="mu">Inicia sesión con tu cuenta autorizada de Google.</p><div id="clerk-sign-in"></div><p id="login-error" class="mu" role="alert"></p></section>`;
}
function adminDenied() {
  return `<section class="f"><h2>Cuenta sin permisos de administración</h2><p class="mu">Tu cuenta está autenticada, pero no está autorizada para administrar Tienda Ata.</p><button class="btn s" id="logout-button">Cerrar sesión</button></section>`;
}

function bindAdminLogin(){
  if (!window.Clerk) return;
  if (window.Clerk.user) {
    if (!authChecking && !isAdmin) void verifyAdminSession();
    return;
  }
  const host=$('#clerk-sign-in');
  if (!host || host.dataset.mounted) return;
  host.dataset.mounted='1';
  window.Clerk.mountSignIn(host,{oauthFlow:'redirect',withSignUp:true,fallbackRedirectUrl:location.href});
}

async function verifyAdminSession(){
  if (authChecking) return;
  authChecking=true;
  session=window.Clerk?.session||null;
  try {
    const result=await adminRequest('check');
    isAdmin=!!result.ok;
    if (isAdmin) { await loadProducts(); await loadOrders(); await loadPromotions(); }
  } catch(error) {
    isAdmin=false;
    console.warn('Cuenta sin acceso administrativo:',error);
  } finally {
    authChecking=false;
    render();
  }
}

async function signOut(){
  try { await window.Clerk?.signOut(); } catch (_) {}
  session=null;isAdmin=false;S.o=[];render();toast('Sesión cerrada.');
}

function adminShell(section, content) {
  const tabs = [['pedidos', 'Pedidos', S.o.length], ['productos', 'Productos', S.p.length], ['promociones', 'Promos', S.promos.filter((promo) => promo.active).length], ['inventario', 'Inventario', 0]];
  return `<div class="ahd"><h1>Panel de administración</h1><div class="row"><a href="#/">Ver tienda</a><button class="btn s sm" id="logout-button">Cerrar sesión</button></div></div><div class="tabs">${tabs.map(([key, title, count]) => `<a href="#/admin/${key}" class="${key === section ? 'on' : ''}">${title}${count ? `<span class="bad">${count}</span>` : ''}</a>`).join('')}</div>${content}`;
}

function orders() {
  return S.o.length
    ? `<table><thead><tr><th>N.º</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${S.o.map((order) => `<tr><td>#${esc(order.n)}</td><td>${esc(order.name)}</td><td>${money(orderTotal(order))}</td><td>${esc(order.status)}</td><td><a class="btn s sm" href="#/admin/pedido/${encodeURIComponent(order.n)}">Abrir</a></td></tr>`).join('')}</tbody></table>`
    : '<p class="mu">Aún no hay pedidos registrados.</p>';
}

function orderDetail(number) {
  const order = S.o.find((item) => String(item.n) === String(number));
  if (!order) return '<p>Pedido no encontrado.</p>';
  const date = order.date ? new Date(order.date).toLocaleString('es-MX') : '';
  return `<a href="#/admin/pedidos">← Pedidos</a><h2>Pedido #${esc(order.n)}</h2><p class="mu">${esc(date)}</p><label>Estado<select id="order-status">${ORDER_STATUSES.map((status) => `<option ${status === order.status ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></label>
    <table><thead><tr><th>Producto</th><th>Talla</th><th>Cant.</th><th>Precio</th></tr></thead><tbody>${(order.items || []).map((item) => `<tr><td>${esc(item.name)}</td><td>${esc(item.size || '—')}</td><td>${esc(item.qty)}</td><td>${money(item.price)}</td></tr>`).join('')}</tbody></table><h3 style="margin-top:12px">Total: ${money(orderTotal(order))}</h3>
    <p><b>Nombre:</b> ${esc(order.name)}<br><b>Teléfono:</b> ${esc(order.phone)}<br><b>Dirección:</b> ${esc(order.addr)}<br><b>Notas:</b> ${esc(order.notes || '—')}</p>`;
}

async function setSt(number,status){const order=S.o.find(item=>String(item.n)===String(number));if(!order)return;const old=order.status;order.status=status;const {n,...payload}=order;try{await adminRequest('update_order',{n:number,data:payload});toast('Estado actualizado.');}catch(_){order.status=old;render();toast('No se pudo actualizar el estado del pedido.');}}
function productList(query = '') {
  const text = query.toLowerCase();
  const list = S.p.filter((product) => !text || `${product.name || ''}${product.brand || ''}${product.cat || ''}`.toLowerCase().includes(text));
  if (!list.length) return '<p class="mu">No hay productos.</p>';
  return `<table><thead><tr><th></th><th>Producto</th><th>Precio</th><th>Tallas y stock</th><th>Estado</th><th></th></tr></thead><tbody>${list.map((product) => `<tr><td>${im((product.photos || [])[0], product.name, 'thm')}</td><td>${esc(product.name)}</td><td>${money(product.price)}</td><td>${product.sizes ? Object.entries(product.sizes).map(([size, amount]) => `${esc(size)}: ${esc(amount)}`).join(', ') : `Stock: ${esc(product.stock)}`}</td><td><span class="tag">${esc(STATUS[product.status] || 'Borrador')}</span>${totalStock(product) ? '' : '<span class="tag r">Agotado</span>'}</td><td><div class="row"><a class="btn s sm" href="#/admin/producto/${encodeURIComponent(product.id)}">Editar</a><button class="btn s sm" onclick="dup('${esc(product.id)}')">Duplicar</button><button class="btn s sm" onclick="tgl('${esc(product.id)}')">${product.status === 'published' ? 'Ocultar' : 'Publicar'}</button><button class="btn d sm" onclick="del('${esc(product.id)}')">Eliminar</button></div></td></tr>`).join('')}</tbody></table>`;
}

function products() {
  return `<div class="row"><input id="pq" placeholder="Buscar producto" oninput="$('#pl').innerHTML=productList(this.value)" style="flex:1"><a class="btn" href="#/admin/producto/nuevo">Nuevo producto</a></div><div id="pl" style="margin-top:10px">${productList()}</div>`;
}

function refreshProductList() {
  const query = $('#pq');
  const list = $('#pl');
  if (list) list.innerHTML = productList(query?.value || '');
}

async function dup(id) {
  const original = S.p.find((product) => product.id === id);
  if (!original) return;
  const copy = structuredClone(original);
  copy.id = 'p' + Date.now();
  copy.name += ' (copia)';
  copy.status = 'draft';
  copy.isDemo = false;
  S.p.push(copy);
  if (await save()) { refreshProductList(); toast('Borrador creado.'); }
}

async function tgl(id) {
  const product = S.p.find((item) => item.id === id);
  if (!product) return;
  product.status = product.status === 'published' ? 'hidden' : 'published';
  if (await save()) refreshProductList();
}

async function del(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  S.p = S.p.filter((product) => product.id !== id);
  if (await save()) { refreshProductList(); toast('Producto eliminado.'); }
}

async function delDemo() {
  const count = S.p.filter((product) => product.isDemo).length;
  if (!count) return toast('No hay productos de ejemplo.');
  if (!confirm(`Se eliminarán ${count} productos de ejemplo. Los que creaste tú y los pedidos se conservan. ¿Continuar?`)) return;
  S.p = S.p.filter((product) => !product.isDemo);
  if (await save()) { refreshProductList(); toast('Productos de ejemplo eliminados.'); }
}

async function setStk(id, size, value) {
  const product = S.p.find((item) => item.id === id);
  if (!product) return;
  const quantity = Math.max(0, Math.floor(Number(value) || 0));
  if (product.sizes) product.sizes[size] = quantity;
  else product.stock = quantity;
  if (await save()) { render(); toast('Cantidad guardada.'); }
}

function inventory() {
  return `<table><thead><tr><th>Producto</th><th>Talla</th><th>Cantidad</th></tr></thead><tbody>${S.p.flatMap((product) => (product.sizes ? Object.keys(product.sizes) : ['']).map((size) => `<tr><td>${esc(product.name)}</td><td>${esc(size || '—')}</td><td><input type="number" min="0" class="${stockForSize(product, size) <= 2 ? 'low' : ''}" value="${stockForSize(product, size)}" aria-label="Cantidad de ${esc(product.name)} ${esc(size)}" onchange="setStk('${esc(product.id)}','${esc(size)}',this.value)"></td></tr>`)).join('')}</tbody></table>`;
}

function promoTargetOptions(scope, selected = '') {
  const values = scope === 'category'
    ? [...new Set(S.p.map((product) => product.cat).filter(Boolean))].map((value) => ({ value, label: value }))
    : scope === 'product'
      ? S.p.map((product) => ({ value: product.id, label: product.name || product.id }))
      : [];
  return values.map((item) => `<option value="${esc(item.value)}" ${item.value === selected ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
}
function promotions() {
  const list = S.promos || [];
  return `<section class="f promo-editor"><h2>Promociones y descuentos</h2><p class="mu">Crea descuentos por porcentaje o cantidad fija y aplícalos a toda la tienda, una categoría o un producto.</p>
    <div class="row"><label>Nombre<input id="promo-title" placeholder="Ej. Fin de temporada"></label><label>Etiqueta<input id="promo-badge" value="Oferta" placeholder="Ej. -30%"></label></div>
    <label>Mensaje<input id="promo-subtitle" placeholder="Ej. Hasta 30% de descuento en seleccionados"></label>
    <div class="row"><label>Tipo<select id="promo-type"><option value="percent">Porcentaje (%)</option><option value="amount">Cantidad fija ($)</option></select></label><label>Descuento<input id="promo-value" type="number" min="0" step="0.01" placeholder="30"></label></div>
    <div class="row"><label>Aplicar a<select id="promo-scope"><option value="all">Toda la tienda</option><option value="category">Una categoría</option><option value="product">Un producto</option></select></label><label id="promo-target-wrap">Categoría<select id="promo-target"><option value="">Selecciona</option>${promoTargetOptions('category')}</select></label></div>
    <div class="row"><label>Desde<input id="promo-start" type="datetime-local"></label><label>Hasta<input id="promo-end" type="datetime-local"></label></div>
    <label class="ck"><input id="promo-active" type="checkbox" checked> Activa</label>
    <div class="acts"><button class="btn" id="promo-save">Crear promoción</button></div>
  </section>
  <section class="f"><h2>Promociones guardadas</h2>${list.length ? list.map((promo) => {
    const active = promo.active && (!promo.starts_at || new Date(promo.starts_at) <= new Date()) && (!promo.ends_at || new Date(promo.ends_at) >= new Date());
    const discount = promo.discount_type === 'percent' ? `${Number(promo.discount_value)}%` : money(promo.discount_value);
    const target = promo.scope === 'all' ? 'Toda la tienda' : promo.scope === 'category' ? `Categoría: ${promo.target}` : `Producto: ${S.p.find((p) => p.id === promo.target)?.name || promo.target}`;
    return `<div class="promo-row"><div><strong>${esc(promo.title)}</strong><span class="tag">${esc(promo.badge || 'Oferta')}</span><div class="mu">${esc(promo.subtitle || '')} · ${esc(discount)} · ${esc(target)} · ${active ? 'Activa' : 'Inactiva'}</div></div><div class="row"><button class="btn s sm" onclick="togglePromo('${esc(promo.id)}')">${promo.active ? 'Desactivar' : 'Activar'}</button><button class="btn d sm" onclick="deletePromo('${esc(promo.id)}')">Eliminar</button></div></div>`;
  }).join('') : '<p class="mu">Todavía no hay promociones.</p>'}</section>`;
}
function bindPromotions() {
  const scope = $('#promo-scope'), targetWrap = $('#promo-target-wrap');
  const updateTarget = () => {
    const value = scope.value;
    if (value === 'all') {
      targetWrap.innerHTML = '<span class="mu" style="padding-top:28px">Se aplicará a todos los productos publicados.</span>';
      return;
    }
    targetWrap.innerHTML = `<label>${value === 'category' ? 'Categoría' : 'Producto'}<select id="promo-target"><option value="">Selecciona</option>${promoTargetOptions(value)}</select></label>`;
  };
  scope?.addEventListener('change', updateTarget);
  updateTarget();
  $('#promo-save')?.addEventListener('click', async () => {
    const title = $('#promo-title')?.value.trim();
    const value = Number($('#promo-value')?.value || 0);
    const currentScope = $('#promo-scope')?.value || 'all';
    const target = currentScope === 'all' ? '' : ($('#promo-target')?.value || '');
    if (!title) return toast('Escribe un nombre para la promoción.');
    if (value <= 0) return toast('Indica un descuento mayor que 0.');
    if (currentScope !== 'all' && !target) return toast('Selecciona dónde aplicar la promoción.');
    if ($('#promo-type')?.value === 'percent' && value > 100) return toast('El porcentaje no puede superar 100%.');
    const row = { id: 'promo_' + Date.now(), title, subtitle: $('#promo-subtitle')?.value.trim() || '', badge: $('#promo-badge')?.value.trim() || 'Oferta', discount_type: $('#promo-type')?.value || 'percent', discount_value: value, scope: currentScope, target, starts_at: $('#promo-start')?.value ? new Date($('#promo-start').value).toISOString() : null, ends_at: $('#promo-end')?.value ? new Date($('#promo-end').value).toISOString() : null, active: $('#promo-active')?.checked !== false, priority: 0 };
    if (row.starts_at && row.ends_at && new Date(row.ends_at) < new Date(row.starts_at)) return toast('La fecha final debe ser posterior a la inicial.');
    const button = $('#promo-save'); if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try { await adminRequest('upsert_promotions', { rows: [row] }); await loadPromotions(); toast('Promoción creada.'); render(); }
    catch (error) { toast(error.message || 'No se pudo guardar la promoción.'); if (button) { button.disabled = false; button.textContent = 'Crear promoción'; } }
  });
}
async function togglePromo(id) {
  const promo = S.promos.find((item) => item.id === id); if (!promo) return;
  try { await adminRequest('upsert_promotions', { rows: [{ ...promo, active: !promo.active }] }); await loadPromotions(); render(); }
  catch (error) { toast(error.message || 'No se pudo actualizar la promoción.'); }
}
async function deletePromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  try { await adminRequest('delete_promotions', { ids: [id] }); await loadPromotions(); render(); toast('Promoción eliminada.'); }
  catch (error) { toast(error.message || 'No se pudo eliminar la promoción.'); }
}

function blankProduct() {
  return { id: 'p' + Date.now(), name: '', brand: '', gender: 'general', cat: '', price: '', old: '', desc: '', photos: [], sizes: { S: 0, M: 0, L: 0 }, stock: 0, status: 'draft', isDemo: false, det: {} };
}

function editor(id) {
  ed = id === 'nuevo' ? blankProduct() : structuredClone(S.p.find((product) => product.id === id) || blankProduct());
  dirty = false;
  return `<h2>${id === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}</h2><section class="f"><h3>Fotos</h3><div id="ph"></div></section>
    <section class="f"><h3>Nombre, sección y categoría</h3><label>Nombre<input data-f="name" required></label><label>Marca (opcional)<input data-f="brand"></label><div class="row"><label>Sección<select data-f="gender"><option value="general">General</option><option value="hombre">Hombre</option><option value="mujer">Mujer</option></select></label><label>Categoría<select data-f="cat"><option value="">Selecciona una categoría</option>${CATEGORIES.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></label></div></section>
    <section class="f"><h3>Precio y precio anterior</h3><div class="row"><label>Precio (MXN)<input data-f="price" type="number" min="0"></label><label>Precio anterior (opcional)<input data-f="old" type="number" min="0"></label></div></section>
    <section class="f"><h3>Tallas y stock</h3><div id="sz"></div></section><section class="f"><h3>Descripción</h3><textarea data-f="desc" rows="3" style="width:100%"></textarea></section>
    <details class="f"><summary>Detalles opcionales</summary><label>Color<input data-d="color"></label><label>Material<input data-d="material"></label><label>Corte o ajuste<input data-d="fit"></label><label>Condición<input data-d="cond"></label></details>
    <div class="bar"><button class="btn s" id="bd" onclick="saveP('draft')">Guardar borrador</button><button class="btn s" onclick="openPv()">Vista previa</button><button class="btn" id="bp" onclick="saveP('published')">Publicar</button></div>`;
}

function bindEditor() {
  $$('[data-f]').forEach((element) => {
    const field = element.dataset.f;
    element.value = ed[field] ?? '';
    element.oninput = () => { ed[field] = element.type === 'number' ? (element.value === '' ? '' : Number(element.value)) : element.value; dirty = true; };
  });
  $$('[data-d]').forEach((element) => {
    const field = element.dataset.d;
    element.value = ed.det[field] || '';
    element.oninput = () => { ed.det[field] = element.value; dirty = true; };
  });
  renderPhotos();
  renderSizes();
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const ratio = Math.min(1, 800 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.')), 'image/jpeg', 0.78);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('La imagen no se pudo leer.')); };
    image.src = url;
  });
}

async function uploadPhoto(file){if(!isAdmin)throw new Error('Ingresa la contraseña de administrador para subir fotos.');if(!file.type.startsWith('image/'))throw new Error('El archivo debe ser una imagen.');const blob=await resizeImage(file),name=`${Date.now()}-${Math.random().toString(36).slice(2,9)}.jpg`,bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const result=await adminRequest('upload_photo',{name,contentType:'image/jpeg',base64:btoa(binary)});return result.url;}
async function addPhotos(files, replaceAt = null) {
  const accepted = [...files].filter((file) => file.type.startsWith('image/'));
  if (!accepted.length) return;
  const button = $('#af');
  if (button) { button.disabled = true; button.textContent = 'Subiendo…'; }
  try {
    if (replaceAt !== null) {
      ed.photos[replaceAt] = await uploadPhoto(accepted[0]);
    } else {
      for (const file of accepted) {
        if (ed.photos.length >= 6) { toast('Puedes agregar hasta 6 fotos.'); break; }
        ed.photos.push(await uploadPhoto(file));
      }
    }
    dirty = true;
    renderPhotos();
  } catch (error) {
    console.error('No se pudo subir la imagen:', error);
    toast(error.message || 'No se pudo subir la imagen.');
    renderPhotos();
  }
}

function renderPhotos() {
  const host = $('#ph');
  if (!host || !ed) return;
  const photos = ed.photos || [];
  host.innerHTML = `<div class="dz" id="dz"><button class="btn s" id="af">Agregar fotos</button><span class="mu">o arrástralas aquí</span><b>${photos.length} de 6</b><input id="fi" type="file" accept="image/*" multiple hidden></div><div class="tl">${photos.map((source, index) => `<div class="tn"><span class="nm">${index + 1}</span>${index ? '' : '<i>Portada</i>'}${im(source, ed.name || 'Producto')}<div class="ac"><button data-a="l" data-i="${index}" ${index ? '' : 'disabled'} title="Mover antes">‹</button><button data-a="r" data-i="${index}" ${index < photos.length - 1 ? '' : 'disabled'} title="Mover después">›</button>${index ? `<button data-a="c" data-i="${index}">Portada</button>` : ''}<button data-a="s" data-i="${index}">Cambiar</button><button data-a="q" data-i="${index}">Quitar</button></div></div>`).join('')}</div>`;
  const fileInput = $('#fi');
  const dropZone = $('#dz');
  $('#af').onclick = () => fileInput.click();
  fileInput.onchange = () => { void addPhotos(fileInput.files); fileInput.value = ''; };
  dropZone.ondragover = (event) => { event.preventDefault(); dropZone.classList.add('o'); };
  dropZone.ondragleave = () => dropZone.classList.remove('o');
  dropZone.ondrop = (event) => { event.preventDefault(); dropZone.classList.remove('o'); void addPhotos(event.dataTransfer.files); };
  $$('.ac button', host).forEach((button) => button.onclick = () => {
    const index = Number(button.dataset.i);
    const action = button.dataset.a;
    dirty = true;
    if (action === 'l' || action === 'r') {
      const next = action === 'l' ? index - 1 : index + 1;
      [photos[index], photos[next]] = [photos[next], photos[index]];
    } else if (action === 'c') {
      photos.unshift(photos.splice(index, 1)[0]);
    } else if (action === 'q') {
      photos.splice(index, 1);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => { void addPhotos(input.files, index); };
      input.click();
      return;
    }
    renderPhotos();
  });
}

function renderSizes() {
  const host = $('#sz');
  if (!host || !ed) return;
  const hasSizes = !!ed.sizes;
  host.innerHTML = `<label class="ck"><input type="checkbox" id="hs" ${hasSizes ? 'checked' : ''}>Este artículo tiene tallas</label>` + (hasSizes
    ? `<table><thead><tr><th>Talla</th><th>Stock</th><th></th></tr></thead><tbody>${Object.entries(ed.sizes).map(([size, amount]) => `<tr><td>${esc(size)}</td><td><input type="number" min="0" value="${Number(amount) || 0}" data-sk="${esc(size)}" aria-label="Stock talla ${esc(size)}"></td><td><button class="btn s sm" data-rm="${esc(size)}">Quitar</button></td></tr>`).join('')}</tbody></table><div class="row" style="margin-top:8px"><input id="ns" placeholder="Nueva talla"><button class="btn s" id="as">Agregar talla</button></div>`
    : `<label>Stock general<input type="number" min="0" id="gs" value="${Number(ed.stock) || 0}"></label>`);
  $('#hs').onchange = (event) => { ed.sizes = event.target.checked ? { S: 0, M: 0, L: 0 } : null; dirty = true; renderSizes(); };
  $$('[data-sk]').forEach((input) => input.oninput = () => { ed.sizes[input.dataset.sk] = Math.max(0, Number(input.value) || 0); dirty = true; });
  $$('[data-rm]').forEach((button) => button.onclick = () => { delete ed.sizes[button.dataset.rm]; dirty = true; renderSizes(); });
  $('#as') && ($('#as').onclick = () => {
    const value = $('#ns').value.trim();
    if (!value) return;
    if (Object.hasOwn(ed.sizes, value)) return toast('Esa talla ya existe.');
    ed.sizes[value] = 0;
    dirty = true;
    renderSizes();
  });
  $('#gs') && ($('#gs').oninput = (event) => { ed.stock = Math.max(0, Number(event.target.value) || 0); dirty = true; });
}

function openPv() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="phone">${productView(ed, true)}</div><button class="btn">Cerrar vista previa</button>`;
  document.body.append(modal);
  bindGallery(modal);
  $('.btn', modal).onclick = () => modal.remove();
}

async function saveP(status) {
  if (!ed.name.trim() || ed.price === '' || ed.price == null || Number(ed.price) < 0) return toast('Agrega un nombre y un precio válido.');
  const buttons = [$('#bd'), $('#bp')].filter(Boolean);
  buttons.forEach((button) => { button.disabled = true; });
  ed.status = status;
  const index = S.p.findIndex((product) => product.id === ed.id);
  if (index >= 0) S.p[index] = ed;
  else S.p.push(ed);
  const ok = await save();
  buttons.forEach((button) => { button.disabled = false; });
  if (!ok) return;
  dirty = false;
  toast(status === 'published' ? 'Producto publicado.' : 'Borrador guardado.');
  go('#/admin/productos');
}

function loginOrAdminContent(section, route) {
  if (!window.Clerk?.user) return adminLogin();
  if (authChecking) return '<section class="f"><h2>Verificando acceso…</h2><p class="mu">Comprobando permisos de administración.</p></section>';
  if (!isAdmin) return adminDenied();
  let content;
  let after;
  if (section === 'pedidos') content = orders();
  else if (section === 'pedido') content = orderDetail(route[2]);
  else if (section === 'productos') content = products();
  else if (section === 'promociones') content = promotions();
  else if (section === 'producto') { content = editor(route[2] || 'nuevo'); after = bindEditor; }
  else if (section === 'inventario') content = inventory();
  else content = '<p>Página no encontrada.</p>';
  return { html: adminShell(section === 'pedido' ? 'pedidos' : section === 'producto' ? 'productos' : section, content), after };
}

function render() {
  const app = $('#app');
  if (!ready) { app.innerHTML = '<p class="mu">Conectando con la tienda…</p>'; return; }
  if (/\/admin\/?$/.test(location.pathname) && !location.hash) location.hash = '#/admin';
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const route = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');

  if (route[0] === 'admin') {
    const section = route[1] || 'pedidos';
    const result = loginOrAdminContent(section, route);
    app.innerHTML = shell(typeof result === 'string' ? result : result.html);
    if (typeof result === 'string') bindAdminLogin();
    else { result.after?.(); bindAdminLogin(); if (section === 'promociones') bindPromotions(); }
    return;
  }

  const product = S.p.find((item) => item.id === route[1]);
  let content;
  let after;
  if (!route.length) content = home();
  else if (route[0] === 'catalogo') content = catalog(params);
  else if (route[0] === 'producto') { content = productView(product); after = () => { if (product?.status === 'published') { bindGallery(app); bindProduct(app, product); } }; }
  else if (route[0] === 'carrito') content = cart();
  else if (route[0] === 'pedido') content = checkout();
  else if (route[0] === 'confirmacion') content = done(route[1]);
  else content = '<p>Página no encontrada.</p>';
  app.innerHTML = shell(content);
  if (route[0] === 'catalogo') renderProductList();
  if (route[0] === 'pedido') $('#checkout-form')?.addEventListener('submit', placeOrder);
  after?.();
}

function handleRouteChange() {
  if (location.hash === currentRoute) return;
  if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) {
    location.hash = currentRoute;
    return;
  }
  dirty = false;
  currentRoute = location.hash;
  render();
  scrollTo(0, 0);
}

window.addEventListener('hashchange', handleRouteChange);
async function init(){try{if(window.__clerkReady) await window.__clerkReady;session=window.Clerk?.session||null;await loadProducts();await loadPromotions();ready=true;currentRoute=location.hash;render();if(location.hash.startsWith('#/admin')&&window.Clerk?.user&&!isAdmin) void verifyAdminSession();}catch(error){console.error('No se pudo iniciar la tienda:',error);$('#app').innerHTML='<p>No se pudo conectar con Supabase. <a href="" onclick="location.reload();return false">Reintentar</a></p>';}}

void init();
