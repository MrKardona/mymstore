/* ============================================================
   M&M Store — lógica de tienda (catálogo, carrito, WhatsApp, animaciones)
   ============================================================ */

// ⚙️ CONFIGURACIÓN — cambia aquí el número de WhatsApp de la tienda
// Formato internacional sin "+" ni espacios. Ej Colombia: 573001234567
const STORE = {
  whatsapp: "573000000000", // ← REEMPLAZAR con el número real de M&M Store
  name: "M&M Store",
};

// Base de rutas: las páginas de producto viven en /producto/
const BASE = location.pathname.includes("/producto/") ? "../" : "";

const fmtCOP = (n) => "$" + n.toLocaleString("es-CO");

function waUrl(message) {
  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`;
}

/* ---------- Carrito (localStorage) ---------- */
const CART_KEY = "mym_cart_v1";
const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
const saveCart = (c) => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch {} };
let cart = loadCart();

const byId = (id) => (typeof PRODUCTS !== "undefined" ? PRODUCTS.find((p) => p.id === id) : null);

function addToCart(id) {
  const p = byId(id);
  if (!p) return;
  const item = cart.find((i) => i.id === id);
  if (item) {
    if (item.qty >= p.qty) { toast(`Solo quedan ${p.qty} unidad(es) de este par 👟`); return; }
    item.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  saveCart(cart);
  renderCart();
  toast(`${p.name} agregado al carrito 🔥`);
  openDrawer();
}

function setQty(id, qty) {
  const p = byId(id);
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  if (qty <= 0) cart = cart.filter((i) => i.id !== id);
  else item.qty = Math.min(qty, p ? p.qty : qty);
  saveCart(cart);
  renderCart();
}

function cartTotal() {
  return cart.reduce((s, i) => { const p = byId(i.id); return s + (p ? p.price * i.qty : 0); }, 0);
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const countEl = document.getElementById("cartCount");
  if (countEl) {
    countEl.textContent = count;
    countEl.classList.toggle("hide", count === 0);
  }
  const box = document.getElementById("cartItems");
  if (!box) return;
  if (!cart.length) {
    box.innerHTML = `<p class="drawer__empty">Tu carrito está vacío…<br>¡Los grails no se compran solos! 👟</p>`;
  } else {
    box.innerHTML = cart.map((i) => {
      const p = byId(i.id);
      if (!p) return "";
      return `
      <div class="ci">
        <img src="${BASE}assets/img/thumbs/${p.img.replace(".webp", "")}.webp" alt="${p.name}" loading="lazy">
        <div>
          <h4>${p.name}</h4>
          <div class="ci__price">${fmtCOP(p.price)} · ${p.sizes}</div>
          <div class="ci__qty">
            <button aria-label="Quitar uno" onclick="setQty('${p.id}', ${i.qty - 1})">−</button>
            <span>${i.qty}</span>
            <button aria-label="Agregar uno" onclick="setQty('${p.id}', ${i.qty + 1})">+</button>
          </div>
        </div>
        <button class="ci__rm" aria-label="Eliminar del carrito" onclick="setQty('${p.id}', 0)">🗑</button>
      </div>`;
    }).join("");
  }
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = fmtCOP(cartTotal());
}

function checkout() {
  if (!cart.length) { toast("Tu carrito está vacío 👟"); return; }
  const lines = cart.map((i) => {
    const p = byId(i.id);
    return `• ${p.name} (${p.sizes}) x${i.qty} — ${fmtCOP(p.price * i.qty)}`;
  });
  const msg = `Hola ${STORE.name} 👟 Quiero este pedido:\n\n${lines.join("\n")}\n\nTotal: ${fmtCOP(cartTotal())}\n\n¿Está disponible para entrega?`;
  window.open(waUrl(msg), "_blank", "noopener");
}

/* ---------- Drawer ---------- */
const drawer = document.getElementById("cartDrawer");
const backdrop = document.getElementById("drawerBackdrop");
function openDrawer() { drawer?.classList.add("open"); backdrop?.classList.add("open"); }
function closeDrawer() { drawer?.classList.remove("open"); backdrop?.classList.remove("open"); }
document.getElementById("cartFab")?.addEventListener("click", openDrawer);
document.getElementById("drawerClose")?.addEventListener("click", closeDrawer);
backdrop?.addEventListener("click", closeDrawer);
document.getElementById("checkoutBtn")?.addEventListener("click", checkout);

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Enlaces de WhatsApp (data-wa) ---------- */
document.querySelectorAll("[data-wa]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    window.open(waUrl(el.dataset.wa), "_blank", "noopener");
  });
});

/* ---------- Render de catálogo (solo en index) ---------- */
const grid = document.getElementById("productGrid");

function cardHTML(p) {
  const few = p.qty === 1;
  const tag = p.tag ? `<span class="card__tag">${p.tag}</span>` : (few ? `<span class="card__tag card__tag--few">Última unidad</span>` : "");
  return `
  <article class="card reveal" data-cat="${p.cat}">
    <a class="card__media" href="${BASE}producto/${p.id}.html" aria-label="Ver ${p.name}">
      <img src="${BASE}assets/img/products/${p.img}" alt="${p.name} — ${p.brand} original en M&M Store Medellín" loading="lazy" width="900" height="900">
      ${tag}
    </a>
    <div class="card__body">
      <span class="card__brand">${p.brand}</span>
      <a href="${BASE}producto/${p.id}.html"><h3 class="card__name">${p.name}</h3></a>
      <span class="card__sizes">Talla: ${p.sizes}</span>
      <div class="card__footer">
        <div class="card__price">${fmtCOP(p.price)}<small>Entrega inmediata Medellín</small></div>
        <button class="card__add" aria-label="Agregar ${p.name} al carrito" onclick="addToCart('${p.id}')">+</button>
      </div>
    </div>
  </article>`;
}

let activeCat = "all";
let searchQ = "";

function renderGrid() {
  if (!grid || typeof PRODUCTS === "undefined") return;
  const q = searchQ.trim().toLowerCase();
  const items = PRODUCTS.filter((p) =>
    (activeCat === "all" || p.cat === activeCat) &&
    (!q || (p.name + " " + p.brand + " " + p.desc).toLowerCase().includes(q))
  );
  grid.innerHTML = items.length
    ? items.map(cardHTML).join("")
    : `<p class="grid__empty">No encontramos pares con ese filtro 😿 — <a href="#" onclick="resetFilters();return false;" style="color:var(--orange)">ver todo el catálogo</a></p>`;
  observeReveals(grid);
}

function resetFilters() {
  activeCat = "all"; searchQ = "";
  const s = document.getElementById("search"); if (s) s.value = "";
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.cat === "all"));
  renderGrid();
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    activeCat = chip.dataset.cat;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderGrid();
  });
});
document.getElementById("search")?.addEventListener("input", (e) => { searchQ = e.target.value; renderGrid(); });

/* ---------- Drops destacados ---------- */
const dropsGrid = document.getElementById("dropsGrid");
if (dropsGrid && typeof PRODUCTS !== "undefined") {
  const featured = ["jellyfish-onix-aurora", "bad-bunny-campus", "superstar-bape-azul", "bad-bunny-bo-1-0", "superstar-coca-cola", "yeezy-350-steel-grey"];
  dropsGrid.innerHTML = featured.map((id, i) => {
    const p = byId(id);
    if (!p) return "";
    return `
    <article class="drop reveal" style="--i:${i}">
      <img src="assets/img/products/${p.img}" alt="${p.name} — colaboración exclusiva disponible en M&M Store" loading="lazy">
      <span class="drop__badge">${p.qty === 1 ? "Última unidad" : p.tag || "Drop"}</span>
      <div class="drop__body">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="drop__price">${fmtCOP(p.price)}</div>
        <a class="btn btn--fire" href="producto/${p.id}.html">Lo quiero 🔥</a>
      </div>
    </article>`;
  }).join("");
}

/* ---------- Animaciones: reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } });
}, { threshold: 0.12 });

function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.in-view)").forEach((el) => io.observe(el));
}

/* ---------- Contadores animados ---------- */
const counterIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    counterIO.unobserve(el);
    const target = +el.dataset.count;
    const t0 = performance.now();
    const dur = 1400;
    (function tick(t) {
      const k = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  });
}, { threshold: 0.5 });
document.querySelectorAll("[data-count]").forEach((el) => counterIO.observe(el));

/* ---------- Parallax suave en hero ---------- */
const parallaxEls = [...document.querySelectorAll(".parallax")];
if (parallaxEls.length && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  addEventListener("scroll", () => {
    const y = scrollY;
    parallaxEls.forEach((el) => { el.style.translate = `0 ${y * +el.dataset.speed}px`; });
  }, { passive: true });
}

/* ---------- Nav scrolled ---------- */
const nav = document.getElementById("nav");
addEventListener("scroll", () => nav?.classList.toggle("scrolled", scrollY > 30), { passive: true });

/* ---------- Init ---------- */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
renderGrid();
renderCart();
observeReveals();
