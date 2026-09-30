const SB_URL = 'https://svvylvtmmynxkmdowymx.supabase.co';
const SB_PUBLISHABLE_KEY = 'sb_publishable_RYbyrmTxY4Qv2rKTuxeT6Q_70Juauak';
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

async function currentUser() {
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

async function refreshAdminState(){
  if(!isAdmin){S.o=[];return;}
  try{await loadOrders();await loadPromotions();}
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
    <nav><a href="#/">Inicio</a><a href="#/catalogo">Catálogo</a><a href="#/carrito">Carrito <span class="cart-pill" id="cc">${cartCount()}</span></a></nav>
  </header>
  <main class="store-main">${content}</main>
  <footer class="pf"><div class="pf-bottom"><span>© ${new Date().getFullYear()} Tienda Ata</span><div class="pf-nav"><a href="#/">Inicio</a><a href="#/catalogo">Catálogo</a><a href="#/carrito">Carrito</a><a href="#/admin">Administración</a></div></div></footer>`;
}

function productCard(product) {
  const photos = product.photos || [];
  return `<a class="card" href="#/producto/${encodeURIComponent(product.id)}">${im(photos[0], product.name)}<b>${esc(product.name)}</b><span>${productPrice(product)}</span>${totalStock(product) ? '' : '<em>Agotado</em>'}</a>`;
}

function home() {
  const list = publishedProducts();
  const offers = list.filter((product) => effectivePrice(product) < Number(product.price || 0) || Number(product.old) > Number(product.price));
  const categories = [...new Set(list.map((product) => product.cat).filter(Boolean))];
  return `<section class="home-clean">
    <div class="home-top"><span class="eyebrow">TIENDA ATA</span><a href="#/catalogo" class="home-link">Ver catálogo →</a></div>
    <div class="home-products">${list.slice(-8).reverse().map(productCard).join("")}</div>
  </section>
  <section class="store-section compact-section">
    <div class="section-head"><h2>Categorías</h2><a href="#/catalogo">Ver todo →</a></div>
    <div class="chips">${CATEGORIES.map((category) => `<a href="#/catalogo?cat=${encodeURIComponent(category)}">${esc(category)}</a>`).join("")}</div>
  </section>
  ${offers.length ? `<section class="store-section offer-block"><div class="section-head"><h2>Ofertas</h2><a href="#/catalogo">Ver todo →</a></div><div class="grid">${offers.slice(0,8).map(productCard).join("")}</div></section>` : ""}`;
}
