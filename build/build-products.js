// Genera las páginas estáticas de producto (producto/<id>.html) y sitemap.xml
// Uso: node build/build-products.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SITE = "https://mrkardona.github.io/mymstore";

// Cargar PRODUCTS desde assets/js/products.js
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/products.js"), "utf8") + "; this.PRODUCTS = PRODUCTS;", ctx);
const PRODUCTS = ctx.PRODUCTS;

const fmtCOP = (n) => "$" + n.toLocaleString("es-CO");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const CAT_LABEL = { colabs: "Colaboraciones", yeezy: "Yeezy", lifestyle: "Lifestyle", running: "Running", guayos: "Guayos", nike: "Sneakers" };

// Vistas adicionales disponibles en assets/img/products/gallery/<id>-<n>.webp
const GALLERY_DIR = path.join(ROOT, "assets/img/products/gallery");
function galleryViews(id) {
  if (!fs.existsSync(GALLERY_DIR)) return [];
  return fs.readdirSync(GALLERY_DIR)
    .filter((f) => new RegExp(`^${id}-\\d+\\.webp$`).test(f))
    .sort((a, b) => parseInt(a.match(/-(\d+)\.webp$/)[1], 10) - parseInt(b.match(/-(\d+)\.webp$/)[1], 10));
}

function productPage(p) {
  const url = `${SITE}/producto/${p.id}.html`;
  const img = `${SITE}/assets/img/products/${p.img}`;
  const views = galleryViews(p.id);
  const title = `${p.name} — ${fmtCOP(p.price)} | M&M Store Medellín`;
  const desc = `${p.desc} Talla ${p.sizes}. ${fmtCOP(p.price)} COP. 100% original, entrega inmediata en Medellín y envíos a toda Colombia.`;
  const few = p.qty === 1;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: views.length ? [img, ...views.map((v) => `${SITE}/assets/img/products/gallery/${v}`)] : img,
    description: desc,
    sku: p.id,
    brand: { "@type": "Brand", name: p.brand },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "COP",
      price: p.price,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "M&M Store" },
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Catálogo", item: `${SITE}/#catalogo` },
      { "@type": "ListItem", position: 3, name: p.name, item: url },
    ],
  };

  return `<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0b1420">
  <meta name="color-scheme" content="dark">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="M&M Store">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${img}">
  <meta property="og:locale" content="es_CO">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.name)} | M&M Store">
  <meta name="twitter:image" content="${img}">
  <link rel="icon" type="image/png" sizes="48x48" href="../assets/img/brand/favicon-48.png">
  <link rel="apple-touch-icon" href="../assets/img/brand/favicon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800;900&family=Rubik+Wet+Paint&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css?v=10">
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body class="bg-noise">
  <div class="topbar">ENTREGA <strong>INMEDIATA</strong> EN MEDELLÍN&nbsp;·&nbsp;ENVÍOS A <strong>TODA COLOMBIA</strong>&nbsp;·&nbsp;100% ORIGINALES</div>
  <nav class="nav scrolled" id="nav">
    <a href="../index.html" class="nav__logo" aria-label="M&M Store — inicio">
      <img src="../assets/img/brand/logo-t.webp" alt="Logo M&M Store" width="110" height="73">
    </a>
    <div class="nav__links">
      <a href="../index.html#drops">Drops</a>
      <a href="../index.html#catalogo">Catálogo</a>
      <a href="../index.html#nosotros">Nosotros</a>
      <a href="../index.html#faq">FAQ</a>
      <a href="#" class="nav__cta" data-wa="Hola M&M Store 👟 Quiero info del ${esc(p.name)}">Escríbenos</a>
    </div>
  </nav>

  <main class="pdp">
    <p class="pdp__crumbs"><a href="../index.html">Inicio</a> / <a href="../index.html#catalogo">Catálogo</a> / ${esc(p.name)}</p>
    <div class="pdp__grid">
      <div class="pdp__gallery">
        <figure class="pdp__media">
          <img id="pdpMainImg" src="../assets/img/products/${p.img}" alt="${esc(p.name)} — ${esc(p.brand)} original, talla ${esc(p.sizes)}, disponible en M&M Store Medellín" decoding="async" width="900" height="900">
        </figure>${views.length ? `
        <div class="pdp__thumbs" id="pdpThumbs" aria-label="Más vistas del producto">
          <button class="pdp__thumb is-active" type="button" data-src="../assets/img/products/${p.img}" aria-label="Vista 1"><img src="../assets/img/products/${p.img}" alt="" loading="lazy" decoding="async" width="120" height="120"></button>
${views.map((v, i) => `          <button class="pdp__thumb" type="button" data-src="../assets/img/products/gallery/${v}" aria-label="Vista ${i + 2}"><img src="../assets/img/products/gallery/${v}" alt="" loading="lazy" decoding="async" width="120" height="120"></button>`).join("\n")}
        </div>` : ""}
      </div>
      <div>
        <p class="pdp__brand">${esc(p.brand)} · ${CAT_LABEL[p.cat] || "Sneakers"}</p>
        <h1>${esc(p.name)}</h1>
        <p class="pdp__price">${fmtCOP(p.price)} <small>COP · Precio final</small></p>
        <p class="pdp__stock${few ? " pdp__stock--few" : ""}"><span class="dot"></span> ${few ? "¡Última unidad disponible!" : `${p.qty} unidades disponibles`}</p>
        <p class="pdp__desc">${esc(p.desc)}</p>
        <div class="pdp__row">
          <button class="btn btn--fire magnetic" onclick="addToCart('${p.id}')">Agregar al carrito</button>
          <a href="#" class="btn btn--wa magnetic" data-wa="Hola M&M Store 👟 Quiero el ${esc(p.name)} (${esc(p.sizes)}) por ${fmtCOP(p.price)}. ¿Está disponible?">Comprar ya por WhatsApp <span class="btn__arrow">→</span></a>
        </div>
        <dl class="pdp__meta">
          <div><dt>Talla</dt><dd>${esc(p.sizes)}</dd></div>
          <div><dt>Marca</dt><dd>${esc(p.brand)}</dd></div>
          <div><dt>Condición</dt><dd>Nuevo · 100% original</dd></div>
          <div><dt>Entrega Medellín</dt><dd>Inmediata (mismo día)</dd></div>
          <div><dt>Pago en Medellín</dt><dd>Contra entrega disponible</dd></div>
          <div><dt>Envío nacional</dt><dd>1–3 días hábiles</dd></div>
        </dl>
        <div class="pdp__ship">
          <p><span class="pdp__tick">→</span> Entrega inmediata en Medellín y área metropolitana</p>
          <p><span class="pdp__tick">→</span> Envíos a toda Colombia con transportadora</p>
          <p><span class="pdp__tick">→</span> Verificación de autenticidad al recibir</p>
        </div>
      </div>
    </div>
    <section class="pdp__related">
      <h2>También te pueden gustar</h2>
      <div class="grid" id="relatedGrid"></div>
    </section>
  </main>

  <a href="#" class="fab fab--wa" data-wa="Hola M&M Store 👟 Quiero info del ${esc(p.name)}" aria-label="Chatear por WhatsApp">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3 0-.2 0-.3-.1-.4l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6a9 9 0 0 0 3.8 3.4c1.4.6 2 .7 2.7.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z"/></svg>
  </a>
  <button class="fab fab--cart" id="cartFab" aria-label="Abrir carrito">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="26" height="26"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2.5 3h2l3.1 13h11.9l2-9H6.1"/></svg>
    <span class="fab__count hide" id="cartCount">0</span>
  </button>

  <div class="drawer-backdrop" id="drawerBackdrop"></div>
  <aside class="drawer" id="cartDrawer" aria-label="Carrito de compras">
    <div class="drawer__head"><h3>Tu carrito</h3><button class="drawer__close" id="drawerClose" aria-label="Cerrar carrito">✕</button></div>
    <div class="drawer__items" id="cartItems"></div>
    <div class="drawer__foot">
      <div class="drawer__total"><span>Total</span><span id="cartTotal">$0</span></div>
      <button class="btn btn--wa" id="checkoutBtn">Finalizar por WhatsApp <span class="btn__arrow">→</span></button>
      <p class="drawer__note">Te confirmamos disponibilidad, pago y entrega al instante.</p>
    </div>
  </aside>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script src="https://unpkg.com/lenis@1.1.14/dist/lenis.min.js" defer></script>
  <script src="../assets/js/products.js?v=11"></script>
  <script src="../assets/js/gallery.js?v=2"></script>
  <script src="../assets/js/store.js?v=10" defer></script>
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      var rel = PRODUCTS.filter(function (x) { return x.cat === "${p.cat}" && x.id !== "${p.id}"; }).slice(0, 4);
      if (rel.length < 4) rel = rel.concat(PRODUCTS.filter(function (x) { return x.cat !== "${p.cat}"; }).slice(0, 4 - rel.length));
      document.getElementById("relatedGrid").innerHTML = rel.map(cardHTML).join("");
      observeReveals(document.getElementById("relatedGrid"));
      var thumbs = document.getElementById("pdpThumbs");
      if (thumbs) thumbs.addEventListener("click", function (e) {
        var b = e.target.closest(".pdp__thumb");
        if (!b) return;
        var main = document.getElementById("pdpMainImg");
        main.style.opacity = "0";
        var next = new Image();
        next.onload = function () { main.src = b.dataset.src; main.style.opacity = "1"; };
        next.src = b.dataset.src;
        thumbs.querySelectorAll(".pdp__thumb").forEach(function (t) { t.classList.toggle("is-active", t === b); });
      });
    });
  </script>
</body>
</html>`;
}

// Generar páginas
const outDir = path.join(ROOT, "producto");
fs.mkdirSync(outDir, { recursive: true });
for (const p of PRODUCTS) {
  fs.writeFileSync(path.join(outDir, `${p.id}.html`), productPage(p));
}

// sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`].concat(PRODUCTS.map((p) => `${SITE}/producto/${p.id}.html`));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith("/") ? "1.0" : "0.8"}</priority></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log(`OK: ${PRODUCTS.length} páginas de producto + sitemap.xml`);
