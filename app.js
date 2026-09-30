const SB_URL = 'https://svvylvtmmynxkmdowymx.supabase.co';
const SB_PUBLISHABLE_KEY = 'sb_publishable_RYbyrmTxY4Qv2rKTuxeT6Q_70Juauak';
const client = window.supabase ? window.supabase.createClient(SB_URL, SB_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

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
const DEFAULT_BANNERS = [
  { id: 'banner_home_1', kind: 'Oferta', title: '20% OFF', subtitle: 'Descuento especial en productos seleccionados.', link: '#/catalogo', button_text: 'Ver ofertas', active: true, position: 0 },
  { id: 'banner_home_2', kind: 'Novedades', title: 'Nuevas prendas', subtitle: 'Descubre lo más reciente de Tienda Ata.', link: '#/catalogo', button_text: 'Ver catálogo', active: true, position: 1 },
  { id: 'banner_home_3', kind: 'Tienda Ata', title: 'Compra fácil', subtitle: 'Explora categorías, encuentra tu talla y arma tu pedido.', link: '#/catalogo', button_text: 'Explorar tienda', active: true, position: 2 }
];
const ORDER_STATUSES = ['Pendiente de confirmar', 'Confirmado', 'Preparando', 'Enviado', 'Entregado', 'Cancelado'];
const PAYMENT_STATUSES = ['Pendiente', 'Por confirmar', 'Pagado', 'Reembolsado'];
const DELIVERY_STATUSES = ['Pendiente', 'En preparación', 'En camino', 'Entregado'];
const LAST_ORDER_KEY = K + '-ultimo-pedido';
const DEFAULT_TRACKING_MESSAGE = 'Gracias por tu compra. Puedes consultar aquí el estado de tu pedido.';
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

let S = { p: [], o: [], c: [], promos: [], banners: [], settings: {} };
let isAdmin = false;
let authChecking = false;
let recoveryMode = false;
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
  if (/^https:\/\//i.test(value) || /^data:image\/svg\+xml,/i.test(value) || /^\/(?!\/)/.test(value)) return value;
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

async function currentUser() {
  if (!client) throw new Error('No se pudo cargar el servicio de la tienda.');
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

async function requireAuthenticatedUser() {
  const user = await currentUser();
  if (!user) throw new Error('Inicia sesión para administrar Tienda Ata.');
  return user;
}

async function loadProducts(){
  const {data,error}=await client.from('products').select('id,data,is_demo,created_at').order('created_at',{ascending:true});
  if(error)throw error;
  S.p=(data||[]).filter(r=>r.id!=='_seeded'&&r.data&&typeof r.data==='object').map(r=>({...r.data,id:r.id,isDemo:!!r.is_demo||!!r.data.isDemo}));
  Object.keys(snapshot).forEach(id=>delete snapshot[id]);
  S.p.forEach(product=>{snapshot[product.id]=JSON.stringify(product);});
}

async function loadOrders(){
  if(!isAdmin){S.o=[];return;}
  await requireAuthenticatedUser();
  const {data,error}=await client.from('orders').select('n,data,created_at').order('created_at',{ascending:false});
  if(error)throw error;
  S.o=(data||[]).map(r=>({...r.data||{},n:r.n}));
}

async function loadPromotions(){
  const {data,error}=await client.from('promotions').select('*').order('priority',{ascending:false}).order('created_at',{ascending:false});
  if(error)throw error;
  S.promos=data||[];
}

async function loadBanners(){
  const {data,error}=await client.from('banners').select('*').order('position',{ascending:true}).order('created_at',{ascending:false});
  if(error)throw error;
  S.banners=data||[];
}
async function loadSettings(){const {data,error}=await client.from('store_settings').select('key,value,updated_at');if(error)throw error;S.settings=Object.fromEntries((data||[]).map((row)=>[row.key,row.value??'']));}
function settingValue(key,fallback=''){return Object.hasOwn(S.settings,key)?String(S.settings[key]??''):fallback;}
function settingOptions(key){return settingValue(key).split(/\r?\n|,/).map((value)=>value.trim()).filter(Boolean);}
function whatsappNumber(){const digits=settingValue('whatsapp').replace(/\D/g,'');return digits?(digits.length===10?'52'+digits:digits):'';}
function whatsappUrl(message=''){const number=whatsappNumber();return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:'';}
function trackingUrl(number,token){return `${location.origin}${location.pathname}#/seguimiento/${encodeURIComponent(number)}?token=${encodeURIComponent(token)}`;}
function lastOrder(){try{const value=JSON.parse(localStorage.getItem(LAST_ORDER_KEY)||'null');return value&&value.n&&value.token?value:null;}catch(_){return null;}}

async function refreshAdminState(){
  if(!isAdmin){S.o=[];return;}
  try{await Promise.all([loadOrders(),loadPromotions(),loadBanners()]);}
  catch(error){console.error('No se pudieron cargar los datos de administración:',error);S.o=[];S.promos=[];}
}

async function persistProducts(){
  if(!isAdmin)return false;
  await requireAuthenticatedUser();
  const currentIds=new Set(S.p.map(p=>p.id));
  const changed=S.p.filter(p=>snapshot[p.id]!==JSON.stringify(p));
  const deleted=Object.keys(snapshot).filter(id=>!currentIds.has(id));
  if(!changed.length&&!deleted.length)return true;
  if(changed.length){
    const {error}=await client.from('products').upsert(changed.map(rowForProduct),{onConflict:'id'});
    if(error)throw error;
    changed.forEach(p=>{snapshot[p.id]=JSON.stringify(p);});
  }
  if(deleted.length){
    const {error}=await client.from('products').delete().in('id',deleted);
    if(error)throw error;
    deleted.forEach(id=>delete snapshot[id]);
  }
  return true;
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
  return `<header class="hd">
    <a class="brand" href="#/">Tienda Ata</a>
    <nav>
      <a class="nav-btn" href="#/">Inicio</a>
      <a class="nav-btn" href="#/catalogo">Catálogo</a>
      <a class="nav-btn" href="#/carrito">Carrito <span class="cart-pill" id="cc">${cartCount()}</span></a>
      <button class="theme-btn" id="theme-toggle" type="button" aria-label="Cambiar tema"></button>
    </nav>
  </header>
  <main class="store-main">${content}</main>
  <button class="ata-chat-fab" id="ata-chat-fab" type="button" aria-label="Abrir asistente de Tienda Ata">✦</button>
  <aside class="ata-chat" id="ata-chat" aria-label="Asistente de Tienda Ata" hidden>
    <div class="ata-chat-head"><div><strong>Asistente Ata</strong><span>Especialista en la tienda</span></div><button class="ata-chat-close" id="ata-chat-close" type="button" aria-label="Cerrar">×</button></div>
    <div class="ata-chat-messages" id="ata-chat-messages"></div>
    <form class="ata-chat-form" id="ata-chat-form">
      <input id="ata-chat-input" autocomplete="off" maxlength="500" placeholder="¿Qué estás buscando?" aria-label="Mensaje">
      <button class="btn" type="submit">Enviar</button>
    </form>
  </aside>
  <footer class="pf">
    <div class="pf-bottom"><span>JHNder 2026</span><div class="pf-nav"><a class="nav-btn" href="#/admin">Administración</a><button class="top-btn btn s sm" type="button" onclick="scrollTo({top:0,behavior:'smooth'})">↑</button></div></div>
  </footer>`;
}

function productCard(product) {
  const photos = product.photos || [];
  return `<a class="card" href="#/producto/${encodeURIComponent(product.id)}">${im(photos[0], product.name)}<b>${esc(product.name)}</b><span>${productPrice(product)}</span>${totalStock(product) ? '' : '<em>Agotado</em>'}</a>`;
}

function bannerMarkup() {
  const list = bannerSettings().filter((banner) => banner.active);
  if (!list.length) return '';
  return `<section class="banner-rail" aria-label="Destacados"><div class="banner-track">${list.map((banner) => {
    const preset = Number(banner.position) + 1;
    const href = safeBannerLink(banner.link);
    return `<article class="glass-banner banner-preset-${preset}">
      <div class="banner-light-orb" aria-hidden="true"></div>
      <div class="banner-copy">
        <span class="banner-kind">${esc(banner.kind)}</span>
        <h2>${esc(banner.title)}</h2>
        <p>${esc(banner.subtitle)}</p>
        ${banner.button_text ? `<a class="nav-btn" href="${esc(href)}">${esc(banner.button_text)}</a>` : ''}
      </div>
    </article>`;
  }).join('')}</div></section>`;
}
function setupBannerAutoplay() {
  const track = $('.banner-track');
  if (!track) return;

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  if (window.__ataBannerAutoplayCleanup) {
    window.__ataBannerAutoplayCleanup();
    window.__ataBannerAutoplayCleanup = null;
  }

  const slides = $('.glass-banner', track);
  if (slides.length < 2) return;

  let index = 0;
  let timer = null;
  let paused = false;

  const syncIndex = () => {
    const width = track.clientWidth || 1;
    index = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / width)));
  };

  const goNext = () => {
    if (paused || document.hidden) return;
    syncIndex();
    index = (index + 1) % slides.length;
    track.scrollTo({
      left: slides[index].offsetLeft - track.offsetLeft,
      behavior: 'smooth'
    });
  };

  const restart = () => {
    clearInterval(timer);
    timer = setInterval(goNext, 5000);
  };

  const pause = () => { paused = true; };
  const resume = () => { paused = false; restart(); };

  track.addEventListener('scroll', syncIndex, { passive: true });
  track.addEventListener('pointerenter', pause);
  track.addEventListener('pointerleave', resume);
  track.addEventListener('focusin', pause);
  track.addEventListener('focusout', resume);
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', resume, { passive: true });

  restart();

  window.__ataBannerAutoplayCleanup = () => {
    clearInterval(timer);
    track.removeEventListener('scroll', syncIndex);
    track.removeEventListener('pointerenter', pause);
    track.removeEventListener('pointerleave', resume);
    track.removeEventListener('focusin', pause);
    track.removeEventListener('focusout', resume);
    track.removeEventListener('touchstart', pause);
    track.removeEventListener('touchend', resume);
  };
}

function home() {
  const list = publishedProducts();
  const offers = list.filter((product) => effectivePrice(product) < Number(product.price || 0) || Number(product.old) > Number(product.price));
  return `${bannerMarkup()}
  <section class="store-section minimal-categories"><div class="section-head"><h2>Categorías</h2><a class="nav-btn" href="#/catalogo">Ver todo →</a></div><div class="chips">${CATEGORIES.map((category) => `<a class="control-btn" href="#/catalogo?cat=${encodeURIComponent(category)}">${esc(category)}</a>`).join("")}</div></section>
  <section class="store-section home-minimal"><div class="home-products">${list.slice(-8).reverse().map(productCard).join("")}</div></section>
  ${offers.length ? `<section class="store-section"><div class="section-head"><h2>Ofertas</h2><a class="nav-btn" href="#/catalogo">Ver todo →</a></div><div class="grid">${offers.slice(0,8).map(productCard).join("")}</div></section>` : ""}`;
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
  const payments=settingOptions('payment_methods'),deliveries=settingOptions('delivery_methods');
  const paymentField=payments.length?`<label>Forma de pago<select name="payment_method"><option value="">Selecciona una opción</option>${payments.map((value)=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`:'<p class="mu sales-note">La forma de pago se confirma con la tienda.</p>';
  const deliveryField=deliveries.length?`<label>Forma de entrega<select name="delivery_method"><option value="">Selecciona una opción</option>${deliveries.map((value)=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`:'<p class="mu sales-note">La forma de entrega se confirma con la tienda.</p>';
  const contact=whatsappUrl('Hola, quiero ayuda con un pedido de Tienda Ata.');
  return `<h1>Finalizar pedido</h1>${ORDER_NOTE}<form id="checkout-form"><label>Nombre<input name="name" autocomplete="name" required maxlength="120"></label><label>WhatsApp / Teléfono<input name="phone" type="tel" autocomplete="tel" required maxlength="40" placeholder="10 dígitos"></label><label>Dirección de entrega<textarea name="addr" autocomplete="street-address" required maxlength="500"></textarea></label>${deliveryField}${paymentField}<label>Notas del pedido (opcional)<textarea name="notes" maxlength="1000" placeholder="Color, horario, referencia, etc."></textarea></label><h2>Total: ${money(cartTotal())}</h2><div class="acts"><button class="btn" id="cb">Confirmar pedido</button>${contact?`<a class="btn s" href="${esc(contact)}" target="_blank" rel="noopener">Hablar por WhatsApp</a>`:""}</div></form>`;
}
async function placeOrder(event) {
  event.preventDefault();
  const form=event.currentTarget,rows=cartRows();
  if(!rows.length)return toast('Tu carrito está vacío.');
  const button=$('#cb');if(button?.disabled)return;
  if(button){button.disabled=true;button.textContent='Enviando…';}
  const order={date:new Date().toISOString(),name:form.elements.name.value.trim(),phone:form.elements.phone.value.trim(),addr:form.elements.addr.value.trim(),notes:form.elements.notes.value.trim(),delivery_method:form.elements.delivery_method?.value.trim()||'',payment_method:form.elements.payment_method?.value.trim()||'',status:ORDER_STATUSES[0],items:rows.map(({item,product})=>({pid:product.id,name:product.name,size:item.size,qty:item.qty,price:effectivePrice(product)}))};
  try {
    const {data,error}=await client.rpc('crear_pedido',{p:order});if(error)throw error;
    const orderNumber=Number(data?.n??data),trackingToken=String(data?.token||'');
    if(!orderNumber||!trackingToken)throw new Error('No se recibió el seguimiento del pedido.');
    try{localStorage.setItem(LAST_ORDER_KEY,JSON.stringify({n:orderNumber,token:trackingToken}));}catch(_){}
    S.c=[];try{await loadProducts();}catch(reloadError){console.warn('Pedido creado; no se actualizó el catálogo local:',reloadError);}
    await save();$('#cc')&&($('#cc').textContent='0');go(`#/confirmacion/${encodeURIComponent(orderNumber)}`);
  } catch(error) {
    console.error('No se pudo registrar el pedido:',error);
    if(button){button.disabled=false;button.textContent='Confirmar pedido';}
    toast(error.message?.includes('Sin existencias')?'El inventario cambió. Revisa tu carrito.':'No se pudo registrar el pedido. Inténtalo de nuevo.');
  }
}
function done(orderNumber) {
  const last=lastOrder(),link=last&&String(last.n)===String(orderNumber)?trackingUrl(last.n,last.token):'',wa=whatsappUrl(`Hola, acabo de hacer el pedido #${orderNumber} en Tienda Ata.`);
  return `<section class="sales-success"><span class="sales-kicker">PEDIDO RECIBIDO</span><h1>Pedido #${esc(orderNumber)}</h1>${ORDER_NOTE}<p>Tu pedido quedó registrado correctamente. Guarda tu número de pedido para consultarlo.</p><div class="acts">${link?`<a class="btn" href="${esc(link)}">Dar seguimiento</a>`:""}${wa?`<a class="btn s" href="${esc(wa)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`:""}<a class="btn s" href="#/catalogo">Seguir viendo</a></div></section>`;
}
function tracking(number,token){return `<section class="tracking-shell" data-tracking-number="${esc(number)}" data-tracking-token="${esc(token)}"><div id="tracking-view"><span class="sales-kicker">SEGUIMIENTO</span><h1>Pedido #${esc(number)}</h1><p class="mu">Consultando el estado de tu pedido…</p></div></section>`;}
function trackingStatusSteps(order){const current=order.status||ORDER_STATUSES[0],currentIndex=ORDER_STATUSES.filter((status)=>status!=='Cancelado').indexOf(current);return ORDER_STATUSES.filter((status)=>status!=='Cancelado').map((status,index)=>`<div class="tracking-step ${index<=currentIndex?'done':''} ${status===current?'active':''}"><span>${index<=currentIndex?'✓':index+1}</span><div><b>${esc(status)}</b>${status===current?'<small>Estado actual</small>':''}</div></div>`).join('');}
function trackingCard(order,token) {
  const history=Array.isArray(order.status_history)?order.status_history.slice().reverse():[],wa=whatsappUrl(`Hola, tengo el pedido #${order.n} y necesito ayuda.`),lastUpdated=order.updated_at||order.date,follow=trackingUrl(order.n,token);
  return `<div class="tracking-card"><div class="tracking-head"><div><span class="sales-kicker">PEDIDO</span><h1>#${esc(order.n)}</h1></div><span class="tracking-status">${esc(order.status||'Pendiente de confirmar')}</span></div><div class="tracking-steps">${order.status==='Cancelado'?'<div class="tracking-cancelled">Pedido cancelado</div>':trackingStatusSteps(order)}</div><div class="tracking-summary"><div><span>Cliente</span><b>${esc(order.name||'')}</b></div><div><span>Total</span><b>${money(orderTotal(order))}</b></div><div><span>Pago</span><b>${esc(order.payment_status||'Pendiente')}</b></div><div><span>Entrega</span><b>${esc(order.delivery_status||'Pendiente')}</b></div></div><div class="tracking-items"><h3>Tu pedido</h3>${(order.items||[]).map((item)=>`<div class="tracking-item"><span>${esc(item.name)}</span><span>${item.size?`Talla ${esc(item.size)} · `:""}x${esc(item.qty)} · ${money(item.price)}</span></div>`).join('')}</div>${order.delivery_method||order.payment_method?`<p class="mu"><b>Entrega:</b> ${esc(order.delivery_method||'Por confirmar')} · <b>Pago:</b> ${esc(order.payment_method||'Por confirmar')}</p>`:""}${settingValue('tracking_message',DEFAULT_TRACKING_MESSAGE)?`<p class="sales-message">${esc(settingValue('tracking_message',DEFAULT_TRACKING_MESSAGE))}</p>`:""}<div class="acts">${wa?`<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Necesito ayuda</a>`:""}<button class="btn s" type="button" data-copy-tracking="${esc(follow)}">Copiar enlace</button></div><p class="mu tracking-updated">Última actualización: ${esc(lastUpdated?new Date(lastUpdated).toLocaleString('es-MX'):'')}</p>${history.length?`<details><summary>Historial de estados</summary><div class="tracking-history">${history.map((item)=>`<div><b>${esc(item.status)}</b><span>${esc(item.at?new Date(item.at).toLocaleString('es-MX'):'')}</span></div>`).join('')}</div></details>`:""}</div>`;
}
async function bindTracking() {
  const node=$('.tracking-shell'),host=$('#tracking-view');if(!node||!host)return;
  const number=decodeURIComponent(node.dataset.trackingNumber||''),token=node.dataset.trackingToken||'';
  if(!number||!token){host.innerHTML='<p class="mu">Enlace de seguimiento inválido.</p>';return;}
  if(window.__ataTrackingCleanup){window.__ataTrackingCleanup();window.__ataTrackingCleanup=null;}
  let stopped=false,busy=false;
  const refresh=async()=>{if(stopped||busy||document.hidden)return;busy=true;try{const {data,error}=await client.rpc('consultar_pedido',{p_n:Number(number),p_token:token});if(error)throw error;if(!data){host.innerHTML='<p class="mu">No pudimos encontrar este pedido. Revisa el enlace de seguimiento.</p>';return;}host.innerHTML=trackingCard(data,token);$('[data-copy-tracking]',host)?.addEventListener('click',async(event)=>{try{await navigator.clipboard.writeText(event.currentTarget.dataset.copyTracking);toast('Enlace copiado.');}catch(_){toast('No se pudo copiar el enlace.');}});}catch(error){console.error('No se pudo consultar el pedido:',error);host.innerHTML='<p class="mu">No se pudo consultar el pedido. Intenta nuevamente en unos segundos.</p>';}finally{busy=false;}};
  await refresh();const timer=setInterval(refresh,10000);window.__ataTrackingCleanup=()=>{stopped=true;clearInterval(timer);};
}

function adminLogin(){
  if(recoveryMode) return `<section class="f admin-login"><h2>Nueva contraseña</h2><p class="mu">Escribe tu nueva contraseña para recuperar el acceso.</p><form id="recovery-form"><label>Nueva contraseña<input id="new-password" type="password" autocomplete="new-password" minlength="6" required placeholder="Mínimo 6 caracteres"></label><label>Repetir contraseña<input id="new-password-2" type="password" autocomplete="new-password" minlength="6" required placeholder="Repite la contraseña"></label><div class="acts"><button class="btn" type="submit" id="recovery-submit">Guardar contraseña</button></div><p id="recovery-error" class="mu" role="alert"></p></form></section>`;
  return `<section class="f admin-login"><h2>Acceso de administración</h2><p class="mu">Inicia sesión con tu cuenta de Supabase.</p><form id="admin-login-form"><label>Correo<input id="admin-email" type="email" autocomplete="email" required placeholder="tu@correo.com"></label><label>Contraseña<input id="admin-password" type="password" autocomplete="current-password" minlength="6" required placeholder="Tu contraseña"></label><div class="acts"><button class="btn" type="submit" id="login-submit">Entrar al panel</button><button class="btn s" type="button" id="signup-submit">Crear cuenta</button></div><button class="link-btn" type="button" id="forgot-submit">¿Olvidaste tu contraseña?</button><p id="login-error" class="mu" role="alert"></p></form></section>`;
}
async function bindRecovery(){
  const form=$('#recovery-form'); if(!form||form.dataset.bound)return; form.dataset.bound='1';
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const p1=$('#new-password').value,p2=$('#new-password-2').value,error=$('#recovery-error'),button=$('#recovery-submit');
    if(p1.length<6)return error.textContent='La contraseña debe tener al menos 6 caracteres.';
    if(p1!==p2)return error.textContent='Las contraseñas no coinciden.';
    button.disabled=true;button.textContent='Guardando…';error.textContent='';
    try{
      const {error:updateError}=await client.auth.updateUser({password:p1});
      if(updateError)throw updateError;
      recoveryMode=false; await client.auth.signOut(); render(); toast('Contraseña actualizada. Ya puedes iniciar sesión.');
    }catch(errorValue){error.textContent=authErrorMessage(errorValue);button.disabled=false;button.textContent='Guardar contraseña';}
  });
}
function bindAdminLogin(){
  const form=$('#admin-login-form');
  if(!form || form.dataset.bound)return;
  form.dataset.bound='1';
  const emailInput=$('#admin-email'), passwordInput=$('#admin-password'), error=$('#login-error');
  const loginButton=$('#login-submit'), signupButton=$('#signup-submit'), forgotButton=$('#forgot-submit');
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const email=emailInput.value.trim(),password=passwordInput.value;
    if(!email||!password)return;
    loginButton.disabled=true;signupButton.disabled=true;loginButton.textContent='Verificando…';error.textContent='';
    try{
      const {data,error:authError}=await client.auth.signInWithPassword({email,password});
      if(authError)throw authError;
      if(!data.session)throw new Error('No se pudo iniciar la sesión.');
      isAdmin=true;
      await Promise.all([loadProducts(),loadOrders(),loadPromotions(),loadBanners(),loadSettings()]);
      render();toast('Sesión iniciada.');
    }catch(errorValue){
      isAdmin=false;
      error.textContent=authErrorMessage(errorValue);
      loginButton.disabled=false;signupButton.disabled=false;loginButton.textContent='Entrar al panel';
    }
  });
  forgotButton?.addEventListener('click',async()=>{
    const email=emailInput.value.trim();
    if(!email)return error.textContent='Escribe tu correo para enviarte el enlace de recuperación.';
    loginButton.disabled=true;signupButton.disabled=true;forgotButton.disabled=true;error.textContent='';forgotButton.textContent='Enviando…';
    try{
      const {error:resetError}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'#/admin'});
      if(resetError)throw resetError;
      error.textContent='Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.';
    }catch(errorValue){error.textContent=authErrorMessage(errorValue);}
    finally{loginButton.disabled=false;signupButton.disabled=false;forgotButton.disabled=false;forgotButton.textContent='¿Olvidaste tu contraseña?';}
  });
  signupButton.addEventListener('click',async()=>{
    const email=emailInput.value.trim(),password=passwordInput.value;
    if(!email)return error.textContent='Escribe tu correo.';
    if(password.length<6)return error.textContent='La contraseña debe tener al menos 6 caracteres.';
    loginButton.disabled=true;signupButton.disabled=true;signupButton.textContent='Creando…';error.textContent='';
    try{
      const {data,error:authError}=await client.auth.signUp({email,password});
      if(authError)throw authError;
      if(data.session){
        isAdmin=true;await Promise.all([loadProducts(),loadOrders(),loadPromotions(),loadBanners(),loadSettings()]);render();toast('Cuenta creada y sesión iniciada.');
      }else{
        error.textContent='Cuenta creada. Revisa tu correo para confirmar la cuenta y después inicia sesión.';
        loginButton.disabled=false;signupButton.disabled=false;signupButton.textContent='Crear cuenta';
      }
    }catch(errorValue){
      error.textContent=authErrorMessage(errorValue);
      loginButton.disabled=false;signupButton.disabled=false;signupButton.textContent='Crear cuenta';
    }
  });
}
function authErrorMessage(errorValue){
  const message=String(errorValue?.message||'No se pudo autenticar.');
  if(/invalid login credentials/i.test(message))return 'Correo o contraseña incorrectos.';
  if(/email not confirmed/i.test(message))return 'Confirma tu correo antes de iniciar sesión.';
  return message;
}
async function verifyAdminSession(){
  if(authChecking)return;
  authChecking=true;
  render();
  try{
    const user=await currentUser();
    isAdmin=!!user;
    if(isAdmin){await Promise.all([loadProducts(),loadOrders(),loadPromotions(),loadBanners(),loadSettings()]);}
  }catch(error){
    console.error('No se pudo verificar la sesión:',error);
    isAdmin=false;S.o=[];S.promos=[];
  }finally{authChecking=false;render();}
}
async function signOut(){
  const {error}=await client.auth.signOut();
  if(error){toast('No se pudo cerrar sesión.');return;}
  isAdmin=false;S.o=[];S.promos=[];
  try{await Promise.all([loadProducts(),loadPromotions(),loadBanners(),loadSettings()]);}catch(errorValue){console.warn('No se pudo restaurar el catálogo público tras cerrar sesión:',errorValue);}
  render();toast('Sesión cerrada.');
}

function dashboard() {
  const pending=S.o.filter((o)=>o.status==='Pendiente de confirmar').length;
  const confirmed=S.o.filter((o)=>o.status==='Confirmado'||o.status==='Preparando'||o.status==='Enviado').length;
  const delivered=S.o.filter((o)=>o.status==='Entregado').length;
  const cancelled=S.o.filter((o)=>o.status==='Cancelado').length;
  const revenue=S.o.filter((o)=>o.status!=='Cancelado').reduce((sum,o)=>sum+orderTotal(o),0);
  const low=S.p.filter((p)=>totalStock(p)>0&&totalStock(p)<=2).length;
  const out=S.p.filter((p)=>totalStock(p)<=0).length;
  const published=S.p.filter((p)=>p.status==='published').length;
  return `<h2>Resumen de la tienda</h2><div class="dash-grid">
    <a class="f stat" href="#/admin/pedidos"><b>${S.o.length}</b><span>Pedidos totales</span></a>
    <a class="f stat" href="#/admin/pedidos"><b>${pending}</b><span>Por confirmar</span></a>
    <a class="f stat" href="#/admin/inventario"><b>${low}</b><span>Stock bajo</span></a>
    <a class="f stat" href="#/admin/inventario"><b>${out}</b><span>Agotados</span></a>
    <a class="f stat" href="#/admin/productos"><b>${published}</b><span>Publicados</span></a>
    <div class="f stat"><b>${money(revenue)}</b><span>Ventas registradas*</span></div>
  </div><section class="f"><h2>Estado de pedidos</h2><p>Confirmados/en proceso: <b>${confirmed}</b> · Entregados: <b>${delivered}</b> · Cancelados: <b>${cancelled}</b></p><p class="mu">* Total de pedidos no cancelados; no significa necesariamente pagos cobrados.</p></section>
  <section class="f"><h2>Acciones rápidas</h2><div class="row"><a class="btn" href="#/admin/producto/nuevo">Nuevo producto</a><a class="btn s" href="#/admin/pedidos">Ver pedidos</a><a class="btn s" href="#/admin/promociones">Nueva promoción</a><button class="btn s" onclick="exportOrders()">Exportar pedidos CSV</button></div></section>`;
}

function salesSettings() {
  const wa=whatsappUrl('Hola, quiero contactar a Tienda Ata.');
  return `<section class="f sales-settings"><div class="admin-section-head"><div><span class="admin-eyebrow">VENTAS</span><h2>Comunicación y checkout</h2><p class="mu">Configura WhatsApp, formas de pago, formas de entrega y el mensaje que verá el cliente durante el seguimiento.</p></div></div><div class="sales-settings-grid"><label>WhatsApp de atención<input id="store-whatsapp" value="${esc(settingValue('whatsapp'))}" inputmode="tel" placeholder="52 + 10 dígitos"></label><label>Formas de pago<textarea id="store-payment-methods" rows="4" placeholder="Una por línea">${esc(settingValue('payment_methods'))}</textarea></label><label>Formas de entrega<textarea id="store-delivery-methods" rows="4" placeholder="Una por línea">${esc(settingValue('delivery_methods'))}</textarea></label><label>Mensaje en seguimiento<textarea id="store-tracking-message" rows="4">${esc(settingValue('tracking_message',DEFAULT_TRACKING_MESSAGE))}</textarea></label></div><div class="acts"><button class="btn" id="save-sales-settings" type="button">Guardar configuración</button>${wa?`<a class="btn s" href="${esc(wa)}" target="_blank" rel="noopener">Probar WhatsApp</a>`:""}</div></section>`;
}
async function bindSalesSettings() {
  const button=$('#save-sales-settings');if(!button||button.dataset.bound)return;button.dataset.bound='1';
  button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Guardando…';try{await requireAuthenticatedUser();const stamp=new Date().toISOString();const rows=[{key:'whatsapp',value:$('#store-whatsapp')?.value.trim()||'',updated_at:stamp},{key:'payment_methods',value:$('#store-payment-methods')?.value.trim()||'',updated_at:stamp},{key:'delivery_methods',value:$('#store-delivery-methods')?.value.trim()||'',updated_at:stamp},{key:'tracking_message',value:$('#store-tracking-message')?.value.trim()||DEFAULT_TRACKING_MESSAGE,updated_at:stamp}];const {error}=await client.from('store_settings').upsert(rows,{onConflict:'key'});if(error)throw error;await loadSettings();render();toast('Configuración de ventas guardada.');}catch(error){console.error('No se pudo guardar la configuración de ventas:',error);toast(error.message||'No se pudo guardar la configuración.');button.disabled=false;button.textContent='Guardar configuración';}});
}
function bannerSettings() {
  return DEFAULT_BANNERS.map((fallback) => {
    const saved = (S.banners || []).find((item) => item.id === fallback.id);
    return {
      ...fallback,
      title: saved?.title ?? fallback.title,
      subtitle: saved?.subtitle ?? fallback.subtitle,
      link: saved?.link ?? fallback.link,
      button_text: saved?.button_text ?? fallback.button_text,
      active: saved?.active ?? fallback.active
    };
  });
}

function safeBannerLink(value) {
  const link = String(value || '').trim();
  if (link.startsWith('#/') || (link.startsWith('/') && !link.startsWith('//'))) return link;
  try {
    const url = new URL(link, location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch (_) {}
  return '#/catalogo';
}

function bannerPreviewMarkup(banner) {
  const preset = Number(banner.position) + 1;
  return `<div class="banner-preview-card banner-preset-${preset}">
    <div class="banner-preview-orb"></div>
    <div class="banner-preview-copy">
      <span class="banner-kind">${esc(banner.kind)}</span>
      <strong>${esc(banner.title || 'Sin título')}</strong>
      <span>${esc(banner.subtitle || 'Agrega un mensaje para tus clientes.')}</span>
      <b>${esc(banner.button_text || 'Ver más')}</b>
    </div>
  </div>`;
}

function banners() {
  return `<section class="f banner-editor">
    <div class="admin-section-head"><div><span class="admin-eyebrow">PORTADA</span><h2>Banners predeterminados</h2><p class="mu">Hay 3 diseños fijos. Aquí solo cambias el texto, el destino del botón y si cada banner está encendido.</p></div></div>
    <div class="banner-fixed-list">
      ${bannerSettings().map((banner) => `<article class="banner-editor-item" data-banner-id="${esc(banner.id)}">
        <div class="banner-editor-preview">${bannerPreviewMarkup(banner)}</div>
        <div class="banner-editor-fields">
          <div class="banner-editor-title"><span class="admin-eyebrow">PREDETERMINADO ${Number(banner.position) + 1}</span><strong>${esc(banner.title || 'Banner')}</strong></div>
          <label>Título<input data-banner-field="title" value="${esc(banner.title)}" maxlength="80"></label>
          <label>Texto<input data-banner-field="subtitle" value="${esc(banner.subtitle)}" maxlength="180"></label>
          <div class="row">
            <label>Texto del botón<input data-banner-field="button_text" value="${esc(banner.button_text)}" maxlength="40"></label>
            <label>Enlace del botón<input data-banner-field="link" value="${esc(banner.link)}" maxlength="300" placeholder="#/catalogo o https://..."></label>
          </div>
          <label class="ck"><input data-banner-field="active" type="checkbox" ${banner.active ? 'checked' : ''}> Mostrar banner</label>
          <div class="acts"><button class="btn" type="button" data-banner-save>Guardar cambios</button></div>
        </div>
      </article>`).join('')}
    </div>
  </section>
  <section class="f banner-help">
    <h3>Cómo funciona</h3>
    <p class="mu">Los 3 banners siempre existen para que no tengas que estar creando ni borrando. Puedes prenderlos o apagarlos y editar su contenido cuando quieras.</p>
  </section>`;
}

function bindBanners() {
  $('.banner-editor-item').forEach((item) => {
    const id = item.dataset.bannerId;
    const saveButton = $('[data-banner-save]', item);
    if (!id || !saveButton) return;

    saveButton.addEventListener('click', async () => {
      const title = $('[data-banner-field="title"]', item)?.value.trim() || '';
      const subtitle = $('[data-banner-field="subtitle"]', item)?.value.trim() || '';
      const buttonText = $('[data-banner-field="button_text"]', item)?.value.trim() || '';
      const link = safeBannerLink($('[data-banner-field="link"]', item)?.value);
      const active = $('[data-banner-field="active"]', item)?.checked !== false;
      if (!title) return toast('El banner necesita un título.');

      saveButton.disabled = true;
      saveButton.textContent = 'Guardando…';
      try {
        await requireAuthenticatedUser();
        const { error } = await client.from('banners')
          .update({ title, subtitle, button_text: buttonText, link, active })
          .eq('id', id);
        if (error) throw error;
        await loadBanners();
        toast('Banner actualizado.');
        render();
      } catch (error) {
        console.error('No se pudo actualizar el banner:', error);
        toast(error.message || 'No se pudo guardar el banner.');
        saveButton.disabled = false;
        saveButton.textContent = 'Guardar cambios';
      }
    });
  });
}

function adminShell(section, content) {
  const tabs = [['dashboard', 'Resumen', 0], ['pedidos', 'Pedidos', S.o.filter((o) => o.status === 'Pendiente de confirmar').length], ['productos', 'Productos', S.p.length], ['promociones', 'Promos', S.promos.filter((promo) => promo.active).length], ['banners', 'Banners', S.banners.filter((banner) => banner.active).length], ['inventario', 'Inventario', 0]];
  return `<div class="admin-shell"><div class="ahd"><div><span class="admin-eyebrow">TIENDA ATA</span><h1>Panel de administración</h1></div><div class="row admin-actions"><a class="nav-btn" href="#/">Ver tienda</a><button class="btn s sm" id="logout-button">Cerrar sesión</button></div></div><div class="tabs">${tabs.map(([key, title, count]) => `<a href="#/admin/${key}" class="${key === section ? 'on' : ''}">${title}${count ? `<span class="bad">${count}</span>` : ''}</a>`).join('')}</div>${content}</div>`;
}

function orders(query = '') {
  return `<div class="row"><input id="oq" value="${esc(query)}" placeholder="Buscar por pedido, cliente, teléfono o estado" oninput="refreshOrderList()" style="flex:1"><button class="btn s" type="button" onclick="exportOrders()">Exportar CSV</button></div><div id="ol" style="margin-top:10px">${orderTable(S.o.filter((order)=>!query||`${order.n} ${order.name||''} ${order.phone||''} ${order.status||''}`.toLowerCase().includes(query.toLowerCase())) )}</div>`;
}
function orderTable(list) {
  return list.length
    ? `<table><thead><tr><th>N.º</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${list.map((order) => `<tr><td>#${esc(order.n)}</td><td>${esc(order.name)}</td><td>${money(orderTotal(order))}</td><td>${esc(order.status)}</td><td><a class="btn s sm" href="#/admin/pedido/${encodeURIComponent(order.n)}">Abrir</a></td></tr>`).join('')}</tbody></table>`
    : '<p class="mu">No hay pedidos que coincidan.</p>';
}
function refreshOrderList() {
  const input=$('#oq'); const host=$('#ol'); if(host){const q=input?.value.trim().toLowerCase()||'';host.innerHTML=orderTable(S.o.filter((o)=>!q||`${o.n} ${o.name||''} ${o.phone||''} ${o.status||''}`.toLowerCase().includes(q)));}
}
function exportOrders() {
  if(!S.o.length)return toast('No hay pedidos para exportar.');
  const rows=[['Pedido','Fecha','Cliente','Teléfono','Estado','Total'],...S.o.map((o)=>[o.n,o.date||'',o.name||'',o.phone||'',o.status||'',orderTotal(o).toFixed(2)])];
  const csv='\uFEFF'+rows.map((row)=>row.map((v)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='pedidos-tienda-ata.csv';link.click();URL.revokeObjectURL(url);toast('Pedidos exportados.');
}


function orderDetail(number){
  const order=S.o.find((item)=>String(item.n)===String(number));if(!order)return '<p>Pedido no encontrado.</p>';
  const date=order.date?new Date(order.date).toLocaleString('es-MX'):'';const token=order.tracking_token||'';const follow=token?trackingUrl(order.n,token):'';const wa=whatsappUrl(`Hola ${order.name||''}, somos Tienda Ata. Te contactamos sobre tu pedido #${order.n}. Estado actual: ${order.status||'Pendiente de confirmar'}.`);
  return `<a href="#/admin/pedidos">← Pedidos</a><div class="order-detail-head"><div><span class="sales-kicker">VENTA</span><h2>Pedido #${esc(order.n)}</h2><p class="mu">${esc(date)}</p></div><span class="tracking-status">${esc(order.status||'Pendiente de confirmar')}</span></div><section class="f order-controls"><div class="order-controls-grid"><label>Estado del pedido<select id="order-status">${ORDER_STATUSES.map((status)=>`<option ${status===order.status?'selected':''}>${esc(status)}</option>`).join('')}</select></label><label>Estado del pago<select id="order-payment-status">${PAYMENT_STATUSES.map((status)=>`<option ${status===(order.payment_status||'Pendiente')?'selected':''}>${esc(status)}</option>`).join('')}</select></label><label>Estado de entrega<select id="order-delivery-status">${DELIVERY_STATUSES.map((status)=>`<option ${status===(order.delivery_status||'Pendiente')?'selected':''}>${esc(status)}</option>`).join('')}</select></label></div><div class="acts">${wa?`<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>`:""}${follow?`<button class="btn s" id="copy-order-link" type="button">Copiar seguimiento</button><a class="btn s" href="${esc(follow)}" target="_blank" rel="noopener">Ver seguimiento</a>`:""}</div></section><table><thead><tr><th>Producto</th><th>Talla</th><th>Cant.</th><th>Precio</th></tr></thead><tbody>${(order.items||[]).map((item)=>`<tr><td>${esc(item.name)}</td><td>${esc(item.size||'—')}</td><td>${esc(item.qty)}</td><td>${money(item.price)}</td></tr>`).join('')}</tbody></table><h3 style="margin-top:12px">Total: ${money(orderTotal(order))}</h3><section class="f order-customer"><h3>Cliente</h3><p><b>Nombre:</b> ${esc(order.name)}<br><b>WhatsApp / Teléfono:</b> ${esc(order.phone)}<br><b>Dirección:</b> ${esc(order.addr)}<br><b>Entrega:</b> ${esc(order.delivery_method||'Por confirmar')}<br><b>Pago:</b> ${esc(order.payment_method||'Por confirmar')}<br><b>Notas:</b> ${esc(order.notes||'—')}</p></section>${Array.isArray(order.status_history)&&order.status_history.length?`<section class="f"><h3>Historial de estados</h3><div class="admin-history">${order.status_history.slice().reverse().map((item)=>`<div><b>${esc(item.status)}</b><span>${esc(item.at?new Date(item.at).toLocaleString('es-MX'):'')}</span></div>`).join('')}</div></section>`:""}`;
}
async function updateOrderFields(number,fields){
  const order=S.o.find((item)=>String(item.n)===String(number));if(!order)return false;const before={status:order.status,payment_status:order.payment_status,delivery_status:order.delivery_status},next={...before,...fields};
  if(next.status==='Enviado'&&next.delivery_status==='Pendiente')next.delivery_status='En camino';if(next.status==='Entregado')next.delivery_status='Entregado';
  const history=Array.isArray(order.status_history)?order.status_history.slice():[];if(next.status!==before.status)history.push({status:next.status,at:new Date().toISOString()});
  const payload={...order,status:next.status,payment_status:next.payment_status,delivery_status:next.delivery_status,status_history:history,updated_at:new Date().toISOString()};const {n,...data}=payload;
  try{await requireAuthenticatedUser();const {error}=await client.from('orders').update({data}).eq('n',number);if(error)throw error;Object.assign(order,payload);toast('Pedido actualizado.');return true;}catch(error){console.error('No se pudo actualizar el pedido:',error);toast('No se pudo actualizar el pedido.');return false;}
}
function bindOrderDetail(number){
  const order=S.o.find((item)=>String(item.n)===String(number));if(!order)return;
  [['order-status','status'],['order-payment-status','payment_status'],['order-delivery-status','delivery_status']].forEach(([id,key])=>{const el=$('#'+id);if(!el||el.dataset.bound)return;el.dataset.bound='1';el.addEventListener('change',async()=>{const ok=await updateOrderFields(number,{[key]:el.value});if(ok)render();});});
  $('#copy-order-link')?.addEventListener('click',async()=>{if(!order.tracking_token)return;try{await navigator.clipboard.writeText(trackingUrl(order.n,order.tracking_token));toast('Enlace de seguimiento copiado.');}catch(_){toast('No se pudo copiar el enlace.');}});
}
async function setSt(number,status){await updateOrderFields(number,{status});}


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
    try { await requireAuthenticatedUser(); const {error}=await client.from('promotions').upsert(row,{onConflict:'id'}); if(error)throw error; await loadPromotions(); toast('Promoción creada.'); render(); }
    catch (error) { toast(error.message || 'No se pudo guardar la promoción.'); if (button) { button.disabled = false; button.textContent = 'Crear promoción'; } }
  });
}
async function togglePromo(id) {
  const promo = S.promos.find((item) => item.id === id); if (!promo) return;
  try { await requireAuthenticatedUser(); const {error}=await client.from('promotions').update({active:!promo.active}).eq('id',id); if(error)throw error; await loadPromotions(); render(); }
  catch (error) { toast(error.message || 'No se pudo actualizar la promoción.'); }
}
async function deletePromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  try { await requireAuthenticatedUser(); const {error}=await client.from('promotions').delete().eq('id',id); if(error)throw error; await loadPromotions(); render(); toast('Promoción eliminada.'); }
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

async function uploadPhoto(file){
  if(!isAdmin)throw new Error('Inicia sesión como administrador para subir fotos.');
  if(!file.type.startsWith('image/'))throw new Error('El archivo debe ser una imagen.');
  await requireAuthenticatedUser();
  const blob=await resizeImage(file);
  const name=`${Date.now()}-${Math.random().toString(36).slice(2,9)}.jpg`;
  const {error}=await client.storage.from('fotos').upload(name,blob,{contentType:'image/jpeg',upsert:false});
  if(error)throw error;
  const {data}=client.storage.from('fotos').getPublicUrl(name);
  return data.publicUrl;
}

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
  if (authChecking) return '<section class="f"><h2>Verificando acceso…</h2><p class="mu">Comprobando tu sesión de Supabase antes de cargar el panel.</p></section>';
  if (!isAdmin) return adminLogin();
  let content;
  let after;
  if (section === 'pedidos') content = orders();
  else if (section === 'pedido') content = orderDetail(route[2]);
  else if (section === 'productos') content = products();
  else if (section === 'promociones') content = promotions();
  else if (section === 'banners') content = banners();
  else if (section === 'ventas') { content = salesSettings(); after = bindSalesSettings; }
  else if (section === 'producto') { content = editor(route[2] || 'nuevo'); after = bindEditor; }
  else if (section === 'inventario') content = inventory();
  else if (section === 'dashboard') content = dashboard();
  else content = '<p>Página no encontrada.</p>';
  return { html: adminShell(section === 'pedido' ? 'pedidos' : section === 'producto' ? 'productos' : section, content), after };
}

const CHAT_KEY='tienda-ata-chat-v1';
function chatHistory(){try{const h=JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');return Array.isArray(h)?h.slice(-12):[];}catch(_){return []}}
function saveChatHistory(h){try{localStorage.setItem(CHAT_KEY,JSON.stringify(h.slice(-12)));}catch(_){}}
function chatNorm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function chatFind(q){const words=chatNorm(q).split(/\s+/).filter(w=>w.length>2);return publishedProducts().map(p=>{const hay=chatNorm([p.name,p.brand,p.cat,p.gender,p.desc].join(' '));let score=0;words.forEach(w=>{if(hay.includes(w))score+=w.length>4?2:1});return {p,score};}).filter(x=>x.score).sort((a,b)=>b.score-a.score).map(x=>x.p);}
function chatProductLine(p){const stock=totalStock(p);const sizes=p.sizes?Object.keys(p.sizes).filter(s=>Number(p.sizes[s])>0):[];return '• '+p.name+' — '+money(effectivePrice(p))+(stock?' · Disponible':' · Agotado')+(sizes.length?' · Tallas: '+sizes.join(', '):'');}
function chatReply(q){const n=chatNorm(q),all=publishedProducts(),available=all.filter(p=>totalStock(p)>0),found=chatFind(q);
if(!n)return 'Dime qué producto buscas, tu presupuesto, talla o si quieres ver ofertas.';
if(/\b(hola|buenas|hey|holi)\b/.test(n))return '¡Hola! 👋 Soy el asistente de Tienda Ata. Puedo ayudarte con productos, precios, tallas, disponibilidad, ofertas, pedidos y dudas comunes. ¿Qué buscas?';
if(/gracias|perfecto|excelente/.test(n))return '¡Con gusto! 👋 Si necesitas algo más, aquí estoy.';
if(/ayuda|que puedes hacer|como me ayudas/.test(n))return 'Puedo buscar productos, precios, tallas, stock, ofertas, categorías, productos para hombre o mujer y ayudarte a comprar desde el carrito.';
if(/comprar|pedido|pedir|carrito/.test(n))return 'Para comprar: abre un producto, elige talla si aplica, pulsa “Agregar al carrito”, entra al carrito y después “Finalizar pedido”. Ahí se solicitan nombre, teléfono y dirección.';
if(/envio|entrega|domicilio/.test(n)){const methods=settingOptions('delivery_methods');return methods.length?'Las formas de entrega disponibles son: '+methods.join(', ')+'.':'La forma de entrega se confirma con la tienda.';}
if(/pago|pagar|efectivo|tarjeta|transferencia/.test(n)){const methods=settingOptions('payment_methods');return methods.length?'Las formas de pago disponibles son: '+methods.join(', ')+'.':'La forma de pago se confirma con la tienda.';}
if(/cambio|devolucion|reembolso|garantia/.test(n))return 'No encuentro una política publicada de cambios o devoluciones, así que prefiero no inventarte una. Confírmala directamente con la tienda.';
if(/oferta|promocion|descuento|rebaja/.test(n)){const promos=activePromotions();const sale=available.filter(p=>effectivePrice(p)<Number(p.price||0)||Number(p.old)>Number(p.price));if(promos.length||sale.length)return 'Sí, tengo promociones activas.'+(promos.length?'\n'+promos.slice(0,5).map(x=>'• '+x.title+(x.description?' — '+x.description:'')).join('\n'):'')+(sale.length?'\\n\\nProductos con precio reducido:\\n'+sale.slice(0,5).map(chatProductLine).join('\n'):'');return 'Ahora mismo no veo promociones activas.';}
const amount=n.match(/(?:menos de|hasta|maximo de|máximo de)\s*\$?([0-9][0-9,]*)/);if(amount){const max=Number(amount[1].replace(/,/g,''));const list=available.filter(p=>effectivePrice(p)<=max).sort((a,b)=>effectivePrice(a)-effectivePrice(b)).slice(0,6);return list.length?'Encontré estas opciones dentro de tu presupuesto:\\n'+list.map(chatProductLine).join('\n'):'No encontré productos disponibles dentro de ese presupuesto.';}
if(/\b(hombre|caballero|masculino)\b/.test(n)){const list=available.filter(p=>p.gender==='hombre');return list.length?'Para hombre tengo:\\n'+list.slice(0,6).map(chatProductLine).join('\n'):'No veo productos disponibles para hombre.';}
if(/\b(mujer|dama|femenino)\b/.test(n)){const list=available.filter(p=>p.gender==='mujer');return list.length?'Para mujer tengo:\\n'+list.slice(0,6).map(chatProductLine).join('\n'):'No veo productos disponibles para mujer.';}
if(/talla|tallas|stock|disponible|agotado/.test(n)&&found.length)return found.slice(0,5).map(chatProductLine).join('\n');
if(/precio|cuanto|cuesta|vale|costo/.test(n)&&found.length)return found.slice(0,5).map(chatProductLine).join('\n');
if(/catalogo|productos|ropa|que tienes|que hay/.test(n))return available.length?'Tengo '+available.length+' producto(s) disponibles. Algunas opciones:\\n'+available.slice(0,8).map(chatProductLine).join('\n'):'No hay productos disponibles ahora.';
if(found.length)return 'Encontré estas opciones relacionadas:\\n'+found.slice(0,5).map(chatProductLine).join('\n');
return 'No encontré ese producto. Prueba con su nombre, categoría, “para hombre”, “para mujer”, una talla o un presupuesto.';
}
function chatMessage(text,role){const box=$('#ata-chat-messages');if(!box)return;const item=document.createElement('div');item.className='ata-msg '+role;item.textContent=text;box.append(item);box.scrollTop=box.scrollHeight;}
function bindChat(){const fab=$('#ata-chat-fab'),panel=$('#ata-chat'),close=$('#ata-chat-close'),form=$('#ata-chat-form'),input=$('#ata-chat-input');if(!fab||!panel||!close||!form||!input||fab.dataset.bound)return;fab.dataset.bound='1';const history=chatHistory();history.forEach(m=>chatMessage(m.content,m.role==='user'?'user':'bot'));if(!history.length)chatMessage('Hola 👋 Soy el asistente de Tienda Ata. Puedo ayudarte a encontrar productos, precios, tallas, disponibilidad y ofertas.','bot');const toggle=open=>{panel.hidden=!open;if(open)input.focus()};fab.onclick=()=>toggle(true);close.onclick=()=>toggle(false);form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value='';chatMessage(q,'user');const h=[...chatHistory(),{role:'user',content:q}];const send=form.querySelector('button[type="submit"]');send.disabled=true;input.disabled=true;setTimeout(()=>{const reply=chatReply(q);chatMessage(reply,'bot');saveChatHistory([...h,{role:'assistant',content:reply}]);send.disabled=false;input.disabled=false;input.focus()},120);};}

function render() {
  const app = $('#app');
  if (!ready) { app.innerHTML = '<p class="mu">Conectando con la tienda…</p>'; return; }
  if (/\/admin\/?$/.test(location.pathname) && !location.hash) location.hash = '#/admin';
  if(window.__ataBannerAutoplayCleanup){window.__ataBannerAutoplayCleanup();window.__ataBannerAutoplayCleanup=null;}
  if(window.__ataTrackingCleanup){window.__ataTrackingCleanup();window.__ataTrackingCleanup=null;}
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const route = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');

  if (route[0] === 'admin') {
    const section = route[1] || 'dashboard';
    const result = loginOrAdminContent(section, route);
    app.innerHTML = shell(typeof result === 'string' ? result : result.html);
    applyTheme(); bindThemeToggle(); bindChat();
    if (typeof result === 'string') { bindAdminLogin(); void bindRecovery(); }
    else { result.after?.(); if (section === 'promociones') bindPromotions(); if (section === 'banners') bindBanners(); if (section === 'pedido') bindOrderDetail(route[2]); }
    $('#logout-button')?.addEventListener('click', () => { void signOut(); });
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
  else if (route[0] === 'seguimiento') { content = tracking(route[1] || '', params.get('token') || ''); after = bindTracking; }
  else content = '<p>Página no encontrada.</p>';
  app.innerHTML = shell(content);
  applyTheme(); bindThemeToggle(); bindChat(); setupBannerAutoplay();
  if (route[0] === 'catalogo') renderProductList();
  if (route[0] === 'pedido') $('#checkout-form')?.addEventListener('submit', placeOrder);
  after?.();
}

function applyTheme() {
  const theme = localStorage.getItem('tienda-ata-theme') || 'light';
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.textContent = theme === 'dark' ? '☀ Claro' : '☾ Oscuro';
    button.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
}
function bindThemeToggle() {
  const button = document.getElementById('theme-toggle');
  if (!button || button.dataset.bound) return;
  button.dataset.bound = '1';
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tienda-ata-theme', next);
    applyTheme();
  });
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
client?.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    const nextIsAdmin=!!session?.user;
    if(event==='PASSWORD_RECOVERY'){recoveryMode=true;isAdmin=false;}
    if(event==='SIGNED_OUT'){isAdmin=false;S.o=[];S.promos=[];}
    else if(nextIsAdmin && !isAdmin && ready && location.hash.startsWith('#/admin')){
      isAdmin=true;
      try{await loadProducts();await loadOrders();await loadPromotions();}catch(error){console.error('No se pudo cargar el panel tras autenticar:',error);isAdmin=false;}
    }else{isAdmin=nextIsAdmin;}
    if(ready)render();
  },0);
});

async function init(){
  const app = $('#app');
  ready = true;
  currentRoute = location.hash;
  if (!client) {
    console.error('Supabase JS no se pudo cargar. La interfaz seguirá visible, pero los datos no estarán disponibles.');
    render();
    return;
  }
  // Pintar la interfaz inmediatamente. La tienda no debe quedarse en blanco si Supabase tarda o falla.
  render();
  try {
    await Promise.all([loadProducts(), loadPromotions(), loadBanners(), loadSettings()]);
  } catch(error) {
    console.error('No se pudieron cargar todos los datos públicos:', error);
  }
  render();
  if(location.hash.startsWith('#/admin')) void verifyAdminSession();
}
applyTheme();
void init();
