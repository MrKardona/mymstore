/* ============================================================
   M&M Store — lógica de tienda (catálogo, carrito, WhatsApp, animaciones)
   ============================================================ */

// ⚙️ CONFIGURACIÓN — cambia aquí el número de WhatsApp de la tienda
// Formato internacional sin "+" ni espacios. Ej Colombia: 573001234567
const STORE = {
  whatsapp: "573013058412", // WhatsApp oficial M&M Store
  name: "M&M Store",
};

// Base de rutas: las páginas de producto viven en /producto/
const BASE = location.pathname.includes("/producto/") ? "../" : "";

const fmtCOP = (n) => "$" + n.toLocaleString("es-CO");

// Precio 0 = "precio a consultar": no entra al carrito, se pregunta por WhatsApp
const KIT_ID = "kit-limpieza-tenis";
const aConsultar = (p) => !(p.price > 0);
const precioTxt = (p) => (aConsultar(p) ? "Precio a consultar" : fmtCOP(p.price));
const etiquetaTalla = (p) => (p.cat === "cuidado" ? "Incluye" : "Talla");
const msgConsulta = (p) => `Hola M&M Store 👟 Quiero saber el precio y las tallas disponibles del ${p.name}.`;
function consultar(id) { const p = byId(id); if (p) window.open(waUrl(msgConsulta(p)), "_blank", "noopener"); }

// Regalo de lanzamiento: cada kit del carrito suma un paño de microfibra gratis
const REGALO = { nombre: "Paño de microfibra", img: "assets/img/brand/regalo-pano.webp" };
const ICONO_REGALO = `<svg class="ico-regalo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>`;
const kitsEnCarrito = () => cart.find((i) => i.id === KIT_ID)?.qty || 0;

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
  if (aConsultar(p)) { consultar(id); return; }
  const item = cart.find((i) => i.id === id);
  if (item) {
    if (item.qty >= p.qty) { toast(`Solo quedan ${p.qty} unidad(es) de este par`); return; }
    item.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  saveCart(cart);
  renderCart();
  toast(id === KIT_ID ? "Kit agregado · el paño de microfibra va de regalo" : `${p.name} agregado al carrito`);
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
  document.getElementById("cartFab")?.setAttribute("aria-label", count ? `Abrir carrito, ${count} par(es)` : "Abrir carrito, vacío");
  const box = document.getElementById("cartItems");
  if (!box) return;
  if (!cart.length) {
    box.innerHTML = `<p class="drawer__empty">Tu carrito está vacío…<br>¡Los grails no se compran solos!</p>`;
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
        <button class="ci__rm" aria-label="Eliminar del carrito" onclick="setQty('${p.id}', 0)">✕</button>
      </div>`;
    }).join("");
    const kit = byId(KIT_ID);
    const regalos = kitsEnCarrito();
    if (regalos) {
      box.innerHTML += `
      <div class="ci ci--gift" role="note">
        <img src="${BASE}${REGALO.img}" alt="${REGALO.nombre} de regalo" loading="lazy">
        <div>
          <span class="ci__kicker ci__kicker--gift">${ICONO_REGALO} Regalo por tu kit</span>
          <h4>${REGALO.nombre}${regalos > 1 ? ` x${regalos}` : ""}</h4>
          <div class="ci__price"><b class="ci__gratis">GRATIS</b> · se agrega solo a tu pedido</div>
        </div>
      </div>`;
    }
    if (kit && kit.qty > 0 && !aConsultar(kit) && !regalos) {
      box.innerHTML += `
      <div class="ci ci--upsell">
        <img src="${BASE}assets/img/thumbs/${KIT_ID}.webp" alt="${kit.name}" loading="lazy">
        <div>
          <span class="ci__kicker">Cuídalos desde el día uno</span>
          <h4>${kit.name}</h4>
          <div class="ci__price">${fmtCOP(kit.price)} <span class="ci__plus">+ paño de regalo</span></div>
        </div>
        <button class="ci__add" aria-label="Agregar ${kit.name}" onclick="addToCart('${KIT_ID}')">+ Agregar</button>
      </div>`;
    }
  }
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = fmtCOP(cartTotal());
}

function checkout() {
  if (!cart.length) { toast("Tu carrito está vacío"); return; }
  const lines = cart.map((i) => {
    const p = byId(i.id);
    return `• ${p.name} (${p.sizes}) x${i.qty} — ${fmtCOP(p.price * i.qty)}`;
  });
  const regalos = kitsEnCarrito();
  if (regalos) lines.push(`🎁 De regalo por el kit: ${REGALO.nombre} x${regalos} — GRATIS`);
  const msg = `Hola ${STORE.name} 👟 Quiero este pedido:\n\n${lines.join("\n")}\n\nTotal: ${fmtCOP(cartTotal())}\n\n¿Está disponible para entrega?`;
  window.open(waUrl(msg), "_blank", "noopener");
}

/* ---------- Drawer ---------- */
const drawer = document.getElementById("cartDrawer");
const backdrop = document.getElementById("drawerBackdrop");
let lastFocus = null;
function openDrawer() {
  if (!drawer) return;
  lastFocus = document.activeElement;
  drawer.classList.add("open");
  backdrop?.classList.add("open");
  document.getElementById("drawerClose")?.focus({ preventScroll: true });
}
function closeDrawer() {
  drawer?.classList.remove("open");
  backdrop?.classList.remove("open");
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer?.classList.contains("open")) closeDrawer();
});
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
  const agotado = p.qty <= 0;
  const consulta = aConsultar(p);
  const few = p.qty === 1 && !consulta;
  const tag = agotado ? `<span class="card__tag card__tag--out">Agotado</span>`
    : p.tag ? `<span class="card__tag">${p.tag}</span>`
    : (few ? `<span class="card__tag card__tag--few">Última unidad</span>` : "");
  return `
  <article class="card reveal${agotado ? " card--soldout" : ""}" data-cat="${p.cat}">
    <a class="card__media" href="${BASE}producto/${p.id}.html" aria-label="Ver ${p.name}"${typeof GALLERY !== "undefined" && GALLERY[p.id] > 1 ? ` data-alt="${BASE}assets/img/products/gallery/${p.id}-2.webp"` : ""}>
      <img src="${BASE}assets/img/products/${p.img}" alt="${p.name} — ${p.brand} original en M&M Store Medellín" loading="lazy" decoding="async" width="900" height="900">
      ${tag}
    </a>
    <div class="card__body">
      <span class="card__brand">${p.brand}</span>
      <a href="${BASE}producto/${p.id}.html"><h3 class="card__name">${p.name}</h3></a>
      <span class="card__sizes">${etiquetaTalla(p)}: ${p.sizes}</span>
      <div class="card__footer">
        <div class="card__price${consulta ? " card__price--consulta" : ""}">${precioTxt(p)}</div>
        ${p.qty <= 0 ? "" : consulta
          ? `<button class="card__add card__add--wa" aria-label="Consultar precio de ${p.name} por WhatsApp" onclick="consultar('${p.id}')"><svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg></button>`
          : `<button class="card__add" aria-label="Agregar ${p.name} al carrito" onclick="addToCart('${p.id}')">+</button>`}
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

/* ---------- Chips de categorías (desde categories.js) ---------- */
const chipTodos = document.querySelector('.chip[data-cat="all"]');
if (chipTodos && typeof CATEGORIAS !== "undefined") {
  let prev = chipTodos;
  for (const c of CATEGORIAS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.dataset.cat = c.id;
    b.textContent = c.nombre;
    prev.after(b);
    prev = b;
  }
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    activeCat = chip.dataset.cat;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderGrid();
  });
});
document.getElementById("search")?.addEventListener("input", (e) => { searchQ = e.target.value; renderGrid(); });

/* ---------- Banner del kit: precio en vivo; se oculta si se agota ---------- */
const kitBanner = document.getElementById("kit");
if (kitBanner) {
  const kit = byId(KIT_ID);
  if (!kit || kit.qty <= 0) kitBanner.hidden = true;
  else kitBanner.querySelector("[data-kit-precio]").textContent = precioTxt(kit);
}

/* ---------- Drops destacados ---------- */
const dropsGrid = document.getElementById("dropsGrid");
if (dropsGrid && typeof PRODUCTS !== "undefined") {
  const featured = ["jellyfish-onix-aurora", "bad-bunny-campus", "superstar-bape-azul", "bad-bunny-bo-1-0", "superstar-coca-cola", "yeezy-350-steel-grey"];
  dropsGrid.innerHTML = featured.map((id, i) => {
    const p = byId(id);
    if (!p) return "";
    return `
    <article class="drop reveal" style="--i:${i}">
      <img src="assets/img/products/${p.img}" alt="${p.name} — colaboración exclusiva disponible en M&M Store" loading="lazy" decoding="async">
      <span class="drop__badge">${p.qty === 1 ? "Última unidad" : p.tag || "Drop"}</span>
      <div class="drop__body">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="drop__price">${precioTxt(p)}</div>
        <a class="btn btn--fire" href="producto/${p.id}.html">Lo quiero <span class="btn__arrow">→</span></a>
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

/* ---------- Nav scrolled + barra de progreso ---------- */
const nav = document.getElementById("nav");
const progressBar = document.getElementById("scrollProgress");
addEventListener("scroll", () => {
  nav?.classList.toggle("scrolled", scrollY > 30);
  if (progressBar) {
    const max = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }
}, { passive: true });

/* ---------- Smooth scroll (Lenis) ---------- */
if (window.Lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const lenis = new Lenis({ lerp: 0.1 });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
}

/* ---------- Botones magnéticos ---------- */
if (matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
  });
}

/* ---------- Tarjetas: segunda vista al pasar el cursor ---------- */
if (matchMedia("(pointer: fine)").matches) {
  document.addEventListener("mouseover", (e) => {
    const media = e.target.closest?.(".card__media[data-alt]");
    if (!media || media.contains(e.relatedTarget)) return;
    const img = media.querySelector("img");
    if (!img.dataset.main) img.dataset.main = img.src;
    img.src = media.dataset.alt;
  });
  document.addEventListener("mouseout", (e) => {
    const media = e.target.closest?.(".card__media[data-alt]");
    if (!media || media.contains(e.relatedTarget)) return;
    const img = media.querySelector("img");
    if (img.dataset.main) img.src = img.dataset.main;
  });
}

/* ---------- Recorrido trust: el tenis baja con el scroll y enciende cada paso ---------- */
const viaje = document.getElementById("viaje");
if (viaje && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const shoe = document.getElementById("viajeShoe");
  const fill = document.getElementById("viajeFill");
  const pasos = [...viaje.querySelectorAll(".viaje__paso")];
  let ticking = false;

  // explosión de mini-tenis del logo al encender un punto
  function explotar(dot) {
    const dr = dot.getBoundingClientRect();
    const vr = viaje.getBoundingClientRect();
    const cx = dr.left - vr.left + dr.width / 2;
    const cy = dr.top - vr.top + dr.height / 2;
    for (let i = 0; i < 9; i++) {
      const img = document.createElement("img");
      img.src = "assets/img/brand/logo-t.webp";
      img.alt = "";
      img.className = "viaje__boom";
      const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 46 + Math.random() * 44;
      img.style.left = cx + "px";
      img.style.top = cy + "px";
      img.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      img.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      img.style.setProperty("--rot", (Math.random() * 300 - 150) + "deg");
      img.addEventListener("animationend", () => img.remove());
      viaje.appendChild(img);
    }
  }

  function actualizarViaje() {
    ticking = false;
    const r = viaje.getBoundingClientRect();
    const foco = window.innerHeight * 0.55; // punto de lectura en pantalla
    const progreso = Math.min(1, Math.max(0, (foco - r.top) / r.height));
    const y = progreso * r.height;
    shoe.style.top = y + "px";
    fill.style.height = y + "px";
    for (const paso of pasos) {
      const centro = paso.offsetTop + paso.offsetHeight / 2;
      const encendido = y >= centro - 8;
      if (encendido && !paso.classList.contains("lit")) explotar(paso.querySelector(".viaje__dot"));
      paso.classList.toggle("lit", encendido);
    }
  }
  function pedirViaje() {
    if (!ticking) { ticking = true; requestAnimationFrame(actualizarViaje); }
  }
  window.addEventListener("scroll", pedirViaje, { passive: true });
  window.addEventListener("resize", pedirViaje);
  actualizarViaje();
} else if (viaje) {
  viaje.querySelectorAll(".viaje__paso").forEach((p) => p.classList.add("lit"));
}

/* ---------- Logo del hero: kickflip al clic ---------- */
const heroLogo = document.getElementById("heroLogo");
heroLogo?.addEventListener("click", () => {
  heroLogo.classList.remove("kick");
  void heroLogo.offsetWidth; // reinicia la animación
  heroLogo.classList.add("kick");
});
heroLogo?.addEventListener("animationend", (e) => {
  if (e.animationName === "kickflip") heroLogo.classList.remove("kick");
});

/* ---------- Foto del fundador: tilt 3D siguiendo el cursor ---------- */
const aboutPhoto = document.getElementById("aboutPhoto");
if (aboutPhoto && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const img = aboutPhoto.querySelector("img");
  aboutPhoto.addEventListener("mousemove", (e) => {
    const r = aboutPhoto.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -10;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
    img.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.02)`;
  });
  aboutPhoto.addEventListener("mouseleave", () => { img.style.transform = ""; });
}

/* ---------- Init ---------- */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
renderGrid();
renderCart();
observeReveals();
