/* Panel de administración M&M Store
 * - Lee el catálogo directo del repositorio (siempre la última versión)
 * - Permite editar precio/tallas/cantidad, crear, editar y eliminar productos
 * - Procesa las fotos en el navegador (recorte, cuadrado 900px, WebP)
 * - Publica TODO en un solo commit vía la API de GitHub; el robot (Action)
 *   reconstruye las páginas de producto automáticamente.
 */
"use strict";

const REPO = "MrKardona/mymstore";
const RAMA = "main";
const RAW = `https://raw.githubusercontent.com/${REPO}/${RAMA}`;

/* ---------- PIN de entrada ----------
 * El PIN protege la entrada al panel y CIFRA la clave de GitHub guardada.
 * PIN inicial: 1234 (cámbialo con "Cambiar PIN de entrada").
 */
const PIN_SALT = "mym-7f3a19";
let PIN_HASH = "6f9210943923b08ea80a251605f755c48de9b3e6d5e24bc075db96c6b64cb1c9";
let PIN_ACTUAL = "";   // en memoria mientras la pestaña está abierta
let TOKEN = "";        // clave de GitHub descifrada, solo en memoria

async function sha256hex(txt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function clavePin(pin) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(PIN_SALT), iterations: 120000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function cifrarToken(tok, pin) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await clavePin(pin), new TextEncoder().encode(tok));
  localStorage.setItem("mym_admin_token_enc", JSON.stringify({ iv: [...iv], data: [...new Uint8Array(data)] }));
}
async function descifrarToken(pin) {
  const raw = localStorage.getItem("mym_admin_token_enc");
  if (!raw) return "";
  const { iv, data } = JSON.parse(raw);
  const b = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, await clavePin(pin), new Uint8Array(data));
  return new TextDecoder().decode(b);
}
/* ---------- Acceso universal: la clave viaja cifrada DENTRO del repo ----------
 * admin/acceso.enc.json guarda la clave de GitHub cifrada con una contraseña
 * fuerte (PBKDF2 600.000 iteraciones + AES-GCM). Cualquier dispositivo entra
 * con solo la contraseña: nada que pegar ni vincular.
 */
let ACCESO = null; // {salt, iv, data, iter} si el acceso universal está activo

async function claveMaestra(pass, saltBytes, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(saltBytes), iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function desbloquear() {
  const pin = $("pinInput").value.trim();

  // Modo contraseña universal
  if (ACCESO) {
    $("btnPin").disabled = true;
    try {
      const k = await claveMaestra(pin, ACCESO.salt, ACCESO.iter || 600000);
      const b = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(ACCESO.iv) }, k, new Uint8Array(ACCESO.data));
      TOKEN = new TextDecoder().decode(b);
      PIN_ACTUAL = pin;
      $("claveOk").classList.remove("hide");
      $("token").value = "••••••••••••••••";
      $("candado").classList.add("hide");
      actualizarCambios();
    } catch {
      $("pinError").classList.remove("hide");
      $("pinInput").value = "";
    }
    $("btnPin").disabled = false;
    return;
  }

  // Modo PIN local (mientras no se active el acceso universal)
  const hash = await sha256hex(PIN_SALT + pin);
  const override = localStorage.getItem("mym_pin_hash");
  if (hash !== PIN_HASH && hash !== override) {
    $("pinError").classList.remove("hide");
    $("pinInput").value = "";
    return;
  }
  PIN_ACTUAL = pin;
  // migrar clave vieja en texto plano, o descifrar la existente
  const plano = localStorage.getItem("mym_admin_token");
  if (plano && !plano.startsWith("•")) {
    await cifrarToken(plano, pin);
    localStorage.removeItem("mym_admin_token");
    TOKEN = plano;
  } else {
    try { TOKEN = await descifrarToken(pin); }
    catch { TOKEN = ""; localStorage.removeItem("mym_admin_token_enc"); toast("Tu clave de GitHub estaba cifrada con otro PIN: vuelve a pegarla.", true); }
  }
  if (TOKEN) $("claveOk").classList.remove("hide");
  $("candado").classList.add("hide");
  if (hash === (await sha256hex(PIN_SALT + "1234"))) toast("Estás usando el PIN inicial 1234: cámbialo con \"Cambiar PIN de entrada\".", true);
  actualizarCambios();
}

const $ = (id) => document.getElementById(id);
let CATS = [];
let catsDirty = false;
let CAT_NOMBRE = {};

let PRODUCTOS = [];        // estado editable
let ORIGINAL = "[]";       // snapshot para detectar cambios
let GALERIA = {};          // id -> número de vistas existentes
let fotosNuevas = [];      // fotos del formulario: {file, canvas900, canvas450}
let editandoId = null;     // id del producto en edición (null = nuevo)
let imagenesPendientes = []; // {path, blob} a subir al publicar
let eliminados = [];

/* ---------- utilidades ---------- */
const fmtCOP = (n) => "$" + Number(n || 0).toLocaleString("es-CO");
function toast(msg, esError) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!esError);
  t.classList.remove("hide");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hide"), 4200);
}
function slug(nombre) {
  return nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
function token() { return TOKEN; }

/* ---------- carga del catálogo ---------- */
async function cargar() {
  const code = await (await fetch(`${RAW}/assets/js/products.js?t=${Date.now()}`)).text();
  PRODUCTOS = new Function(code + "; return PRODUCTS;")();
  ORIGINAL = JSON.stringify(PRODUCTOS);
  try {
    const cc = await (await fetch(`${RAW}/assets/js/categories.js?t=${Date.now()}`)).text();
    CATS = new Function(cc + "; return CATEGORIAS;")();
  } catch {
    CATS = [
      { id: "nike", nombre: "Nike · Jordan" }, { id: "colabs", nombre: "Colabs" },
      { id: "yeezy", nombre: "Yeezy" }, { id: "lifestyle", nombre: "Lifestyle" },
      { id: "running", nombre: "Running" }, { id: "guayos", nombre: "Guayos" },
    ];
  }
  CAT_NOMBRE = Object.fromEntries(CATS.map((c) => [c.id, c.nombre]));
  poblarCategorias();
  try {
    const g = await (await fetch(`${RAW}/assets/js/gallery.js?t=${Date.now()}`)).text();
    GALERIA = new Function(g + "; return GALLERY;")();
  } catch { GALERIA = {}; }
  pintar();
  $("estado").textContent = `${PRODUCTOS.length} productos en el catálogo`;
}

function poblarCategorias() {
  const ops = CATS.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");
  $("filtroCat").innerHTML = `<option value="all">Todas las categorías</option>` + ops;
  $("fCat").innerHTML = ops + `<option value="__nueva">➕ Crear nueva categoría…</option>`;
}

/* ---------- tabla ---------- */
function pintar() {
  const q = ($("buscar").value || "").toLowerCase();
  const cat = $("filtroCat").value;
  const tb = $("tbody");
  tb.innerHTML = "";
  for (const p of PRODUCTOS) {
    if (cat !== "all" && p.cat !== cat) continue;
    if (q && !(p.name + " " + p.brand).toLowerCase().includes(q)) continue;
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    tr.title = "Toca para editar";
    if (p.qty <= 0) tr.classList.add("agotado");
    const foto = p._nueva ? p._nueva : `${RAW}/assets/img/thumbs/${p.img}`;
    tr.innerHTML = `
      <td><img src="${foto}" alt="" loading="lazy"></td>
      <td><div class="nombre">${p.name}</div><div class="cat">${p.brand} · ${CAT_NOMBRE[p.cat] || p.cat}</div></td>
      <td><input class="precio" type="number" min="0" step="1000" value="${p.price}" data-id="${p.id}" data-k="price"></td>
      <td><input class="tallas" value="${p.sizes.replace(/"/g, "&quot;")}" data-id="${p.id}" data-k="sizes"></td>
      <td><input class="qty" type="number" min="0" step="1" value="${p.qty}" data-id="${p.id}" data-k="qty"></td>
      <td class="acciones">
        <button class="icono" title="Editar" data-editar="${p.id}">✎</button>
        <button class="icono icono--rojo" title="Eliminar" data-borrar="${p.id}">🗑</button>
      </td>`;
    tb.appendChild(tr);
  }
  actualizarCambios();
}

function actualizarCambios() {
  const limpio = PRODUCTOS.map(({ _nueva, ...p }) => p);
  const n = (JSON.stringify(limpio) !== ORIGINAL ? 1 : 0) && (contarCambios() || 1);
  const hay = JSON.stringify(limpio) !== ORIGINAL || imagenesPendientes.length > 0 || eliminados.length > 0 || catsDirty;
  $("btnPublicar").disabled = !hay || !token();
  $("nCambios").classList.toggle("hide", !hay);
  if (hay) $("nCambios").textContent = contarCambios() + imagenesPendientes.length;
}
function contarCambios() {
  try {
    const antes = JSON.parse(ORIGINAL);
    const mapa = Object.fromEntries(antes.map((p) => [p.id, p]));
    let n = eliminados.length + (catsDirty ? 1 : 0);
    for (const p of PRODUCTOS) {
      const o = mapa[p.id];
      if (!o) { n++; continue; }
      if (o.price !== p.price || o.qty !== p.qty || o.sizes !== p.sizes || o.name !== p.name ||
          o.desc !== p.desc || o.tag !== p.tag || o.cat !== p.cat || o.brand !== p.brand) n++;
    }
    return n;
  } catch { return 1; }
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.id) return;
  const p = PRODUCTOS.find((x) => x.id === el.dataset.id);
  if (!p) return;
  const k = el.dataset.k;
  p[k] = k === "sizes" ? el.value : Math.max(0, parseInt(el.value || "0", 10));
  el.closest("tr").classList.add("dirty");
  el.closest("tr").classList.toggle("agotado", p.qty <= 0);
  actualizarCambios();
});

document.addEventListener("click", (e) => {
  const ed = e.target.closest("[data-editar]");
  if (ed) return abrirForm(ed.dataset.editar);
  const bo = e.target.closest("[data-borrar]");
  if (bo) {
    const p = PRODUCTOS.find((x) => x.id === bo.dataset.borrar);
    if (p && confirm(`¿Eliminar "${p.name}" del catálogo?\n(Las fotos quedan en el repositorio por si lo devuelves.)`)) {
      PRODUCTOS = PRODUCTOS.filter((x) => x.id !== p.id);
      eliminados.push(p.id);
      pintar();
      toast("Eliminado de la lista. Recuerda publicar los cambios.");
    }
    return;
  }
  // clic en cualquier parte del producto (foto, nombre…) abre el editor,
  // excepto sobre los campos rápidos y botones
  const fila = e.target.closest("#tbody tr[data-id]");
  if (fila && !e.target.closest("input, button, select, a, textarea")) abrirForm(fila.dataset.id);
});

$("buscar").addEventListener("input", pintar);
$("filtroCat").addEventListener("change", pintar);

/* ---------- clave ---------- */
async function validarClave(valor) {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { Authorization: "Bearer " + valor, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error("GitHub respondió " + r.status);
  const j = await r.json();
  if (!j.permissions || !j.permissions.push) throw new Error("La clave no tiene permiso de escritura (Contents: Read and write)");
}
$("btnGuardarClave").addEventListener("click", async () => {
  const v = $("token").value.trim();
  if (!v) return toast("Pega la clave primero", true);
  $("btnGuardarClave").disabled = true;
  try {
    await validarClave(v);
    TOKEN = v;
    await cifrarToken(v, PIN_ACTUAL);
    $("claveOk").classList.remove("hide");
    toast("Clave guardada. Ya puedes publicar.");
  } catch (err) {
    toast("Clave inválida: " + err.message, true);
  }
  $("btnGuardarClave").disabled = false;
  actualizarCambios();
});

/* ---------- fotos: recorte + cuadrado + webp ---------- */
async function procesarFoto(file) {
  const bmp = await createImageBitmap(file);
  // detectar color de fondo (esquina) y recortar bordes de ese color
  const esc = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc);
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const cx = c.getContext("2d", { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  const [br, bg, bb] = [d[0], d[1], d[2]];
  const difiere = (i) => Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 48;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (difiere((y * w + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = w; y1 = h; }
  const sx = x0 / esc, sy = y0 / esc, sw = (x1 - x0) / esc, sh = (y1 - y0) / esc;

  function cuadro(size) {
    const box = size * 0.89;
    const r = Math.min(box / sw, box / sh);
    const dw = sw * r, dh = sh * r;
    const cv = Object.assign(document.createElement("canvas"), { width: size, height: size });
    const g = cv.getContext("2d");
    g.fillStyle = `rgb(${br},${bg},${bb})`;
    g.fillRect(0, 0, size, size);
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, sx, sy, sw, sh, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return cv;
  }
  return { c900: cuadro(900), c450: cuadro(450), url: cuadro(240).toDataURL("image/jpeg", 0.8) };
}
function aBlob(canvas) {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b && b.type === "image/webp" ? res(b) : rej(new Error("Este navegador no genera WebP; usa Chrome o Edge."))), "image/webp", 0.8);
  });
}

/* ---------- formulario ---------- */
function abrirForm(id) {
  editandoId = id || null;
  fotosNuevas = [];
  $("previews").innerHTML = "";
  $("formTitulo").textContent = id ? "Editar producto" : "Nuevo producto";
  const p = id ? PRODUCTOS.find((x) => x.id === id) : null;
  if (p) {
    // mostrar la foto principal actual como referencia
    const fig = document.createElement("figure");
    fig.innerHTML = `<img src="${p._nueva ? p._nueva : `${RAW}/assets/img/thumbs/${p.img}`}" alt=""><figcaption>ACTUAL</figcaption>`;
    $("previews").appendChild(fig);
  }
  $("fNombre").value = p ? p.name : "";
  $("fMarca").value = p ? p.brand : "Nike";
  $("fCat").value = p ? p.cat : "nike";
  $("fPrecio").value = p ? p.price : "";
  $("fTallas").value = p ? p.sizes : "";
  $("fCantidad").value = p ? p.qty : 1;
  $("fTag").value = p ? p.tag || "" : "";
  $("fDesc").value = p ? p.desc : "";
  $("velo").classList.remove("hide");
  $("form").classList.remove("hide");
}
function cerrarForm() { $("velo").classList.add("hide"); $("form").classList.add("hide"); }
$("fCat").addEventListener("change", () => {
  if ($("fCat").value !== "__nueva") return;
  const nombre = (prompt("Nombre de la nueva categoría (ej: Botas, New Balance, Niños):") || "").trim();
  if (!nombre) { $("fCat").value = CATS[0].id; return; }
  let id = slug(nombre) || "categoria";
  while (CATS.some((c) => c.id === id)) id += "-2";
  CATS.push({ id, nombre });
  CAT_NOMBRE[id] = nombre;
  catsDirty = true;
  poblarCategorias();
  $("fCat").value = id;
  actualizarCambios();
  toast(`Categoría "${nombre}" creada. Se publica junto con tus cambios.`);
});

$("btnNuevo").addEventListener("click", () => abrirForm(null));
$("btnCerrarForm").addEventListener("click", cerrarForm);
$("btnCancelar").addEventListener("click", cerrarForm);
$("velo").addEventListener("click", cerrarForm);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarForm(); });

async function agregarFotos(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    try {
      const r = await procesarFoto(f);
      fotosNuevas.push(r);
      const fig = document.createElement("figure");
      fig.innerHTML = `<img src="${r.url}" alt="">` +
        (fotosNuevas.length === 1 && !editandoId ? "<figcaption>PRINCIPAL</figcaption>" : "") +
        `<button class="quitar" type="button">✕</button>`;
      fig.querySelector(".quitar").onclick = () => { fotosNuevas.splice(fotosNuevas.indexOf(r), 1); fig.remove(); };
      $("previews").appendChild(fig);
    } catch (err) { toast(err.message, true); }
  }
}
$("fFotos").addEventListener("change", (e) => agregarFotos([...e.target.files]));
const drop = $("drop");
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("arrastrando"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("arrastrando"); }));
drop.addEventListener("drop", (e) => agregarFotos([...e.dataTransfer.files]));

$("btnGuardarProducto").addEventListener("click", async () => {
  const nombre = $("fNombre").value.trim();
  const precio = parseInt($("fPrecio").value || "0", 10);
  if (!nombre) return toast("Ponle nombre al producto", true);
  if (!precio) return toast("Ponle precio", true);
  if (!editandoId && fotosNuevas.length === 0) return toast("Sube al menos una foto", true);

  let p;
  if (editandoId) {
    p = PRODUCTOS.find((x) => x.id === editandoId);
  } else {
    let id = slug(nombre) || "producto";
    while (PRODUCTOS.some((x) => x.id === id)) id += "-2";
    p = { id, img: id + ".webp", price: 0, qty: 1, tag: "", desc: "" };
    PRODUCTOS.push(p);
  }
  Object.assign(p, {
    name: nombre, brand: $("fMarca").value.trim() || "Nike", cat: $("fCat").value,
    price: precio, sizes: $("fTallas").value.trim() || "Única",
    qty: Math.max(0, parseInt($("fCantidad").value || "0", 10)),
    tag: $("fTag").value.trim(), desc: $("fDesc").value.trim() || nombre + " 100% original.",
  });

  // fotos → cola de subida
  try {
    let vista = (GALERIA[p.id] || 1);
    for (let i = 0; i < fotosNuevas.length; i++) {
      const f = fotosNuevas[i];
      if (i === 0 && !editandoId) {
        imagenesPendientes.push({ path: `assets/img/products/${p.id}.webp`, blob: await aBlob(f.c900) });
        imagenesPendientes.push({ path: `assets/img/thumbs/${p.id}.webp`, blob: await aBlob(f.c450) });
        p._nueva = f.url;
      } else {
        vista += 1;
        imagenesPendientes.push({ path: `assets/img/products/gallery/${p.id}-${vista}.webp`, blob: await aBlob(f.c900) });
      }
    }
    GALERIA[p.id] = vista;
  } catch (err) { return toast(err.message, true); }

  cerrarForm();
  pintar();
  toast(editandoId ? "Producto actualizado en la lista." : "Producto agregado al final del catálogo. Recuerda publicar.");
  editandoId = null;
});

/* ---------- publicar: un solo commit con la API de GitHub ---------- */
async function gh(ruta, opt = {}) {
  const r = await fetch("https://api.github.com" + ruta, {
    method: opt.method || "GET",
    headers: { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 180)}`);
  return r.json();
}
const blobABase64 = (blob) => new Promise((res) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1]);
  fr.readAsDataURL(blob);
});
function serializar(lista) {
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const filas = lista.map(({ _nueva, ...p }) =>
    `  { id: "${p.id}", name: "${esc(p.name)}", brand: "${esc(p.brand)}", cat: "${p.cat}", img: "${p.img}", price: ${p.price}, sizes: "${esc(p.sizes)}", qty: ${p.qty}, tag: "${esc(p.tag)}", desc: "${esc(p.desc)}" }`);
  return `// Catálogo M&M Store — editado desde el panel /admin\nconst PRODUCTS = [\n${filas.join(",\n")}\n];\n`;
}

$("btnPublicar").addEventListener("click", async () => {
  if (!token()) return toast("Primero conecta tu clave de acceso", true);
  const btn = $("btnPublicar");
  btn.disabled = true;
  const rotulo = $("pubTxt");
  try {
    rotulo.textContent = "Publicando…";
    // base
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${RAMA}`);
    const baseSha = ref.object.sha;
    const baseCommit = await gh(`/repos/${REPO}/git/commits/${baseSha}`);
    // blobs
    const arbol = [];
    let n = 0;
    for (const img of imagenesPendientes) {
      rotulo.textContent = `Subiendo fotos ${++n}/${imagenesPendientes.length}…`;
      const b = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: await blobABase64(img.blob), encoding: "base64" } });
      arbol.push({ path: img.path, mode: "100644", type: "blob", sha: b.sha });
    }
    rotulo.textContent = "Guardando catálogo…";
    if (catsDirty) {
      const escC = (x) => String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const cuerpo = "// Categorías de la tienda — se administran desde el panel /admin\nconst CATEGORIAS = [\n" +
        CATS.map((c) => `  { id: "${c.id}", nombre: "${escC(c.nombre)}" }`).join(",\n") + "\n];\n";
      const bc = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: cuerpo, encoding: "utf-8" } });
      arbol.push({ path: "assets/js/categories.js", mode: "100644", type: "blob", sha: bc.sha });
    }
    const cat = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: serializar(PRODUCTOS), encoding: "utf-8" } });
    arbol.push({ path: "assets/js/products.js", mode: "100644", type: "blob", sha: cat.sha });
    // commit
    const tree = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: { base_tree: baseCommit.tree.sha, tree: arbol } });
    const msg = `Admin: ${contarCambios()} cambio(s) de inventario` + (imagenesPendientes.length ? ` + ${imagenesPendientes.length} foto(s)` : "");
    const commit = await gh(`/repos/${REPO}/git/commits`, { method: "POST", body: { message: msg, tree: tree.sha, parents: [baseSha] } });
    await gh(`/repos/${REPO}/git/refs/heads/${RAMA}`, { method: "PATCH", body: { sha: commit.sha } });

    imagenesPendientes = [];
    eliminados = [];
    catsDirty = false;
    PRODUCTOS.forEach((p) => delete p._nueva);
    ORIGINAL = JSON.stringify(PRODUCTOS);
    pintar();
    toast("✓ Publicado. La tienda se actualiza en 1–2 minutos.");
    $("estado").textContent = `${PRODUCTOS.length} productos · publicado ${new Date().toLocaleTimeString("es-CO")}`;
  } catch (err) {
    toast("No se pudo publicar: " + err.message, true);
  }
  rotulo.textContent = "Publicar cambios";
  btn.disabled = false;
  actualizarCambios();
});

/* ---------- cambiar PIN ---------- */
$("btnCambiarPin").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!PIN_ACTUAL) return toast("Primero entra con tu PIN actual.", true);
  const p1 = (prompt("Nuevo PIN (4 a 8 dígitos):") || "").trim();
  if (!/^\d{4,8}$/.test(p1)) return toast("El PIN debe ser de 4 a 8 dígitos.", true);
  const p2 = (prompt("Repite el nuevo PIN:") || "").trim();
  if (p1 !== p2) return toast("Los PIN no coinciden.", true);
  const nuevoHash = await sha256hex(PIN_SALT + p1);
  localStorage.setItem("mym_pin_hash", nuevoHash);
  if (TOKEN) await cifrarToken(TOKEN, p1);
  PIN_ACTUAL = p1;
  // publicar el nuevo PIN en el código del panel (para que aplique en cualquier dispositivo)
  if (TOKEN) {
    try {
      const actual = await gh(`/repos/${REPO}/contents/admin/admin.js?ref=${RAMA}`);
      const codigo = decodeURIComponent(escape(atob(actual.content)));
      const nuevo = codigo.replace(/let PIN_HASH = "[0-9a-f]+";/, `let PIN_HASH = "${nuevoHash}";`);
      await gh(`/repos/${REPO}/contents/admin/admin.js`, {
        method: "PUT",
        body: { message: "Admin: cambio de PIN [auto-build]", content: btoa(unescape(encodeURIComponent(nuevo))), sha: actual.sha, branch: RAMA },
      });
      toast("✓ PIN cambiado. En 1–2 minutos aplica también en otros dispositivos.");
    } catch (err) { toast("PIN cambiado en este navegador, pero no pude publicarlo: " + err.message, true); }
  } else {
    toast("PIN cambiado en este navegador. Conecta tu clave para publicarlo a todos los dispositivos.");
  }
});

/* ---------- activar / cambiar la contraseña de acceso universal ---------- */
$("btnAccesoUni").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!TOKEN) return toast("Primero conecta la clave de GitHub en este equipo (solo esta vez).", true);
  const p1 = (prompt("Contraseña de acceso (mínimo 10 caracteres, con letras y números).\nCon ella entrarás desde cualquier dispositivo:") || "").trim();
  if (p1.length < 10 || !/[a-zA-Z]/.test(p1) || !/\d/.test(p1)) {
    return toast("Debe tener al menos 10 caracteres y mezclar letras y números.", true);
  }
  const p2 = (prompt("Repite la contraseña:") || "").trim();
  if (p1 !== p2) return toast("No coinciden.", true);
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iter = 600000;
    const k = await claveMaestra(p1, salt, iter);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(TOKEN));
    const cuerpo = JSON.stringify({ v: 1, iter, salt: [...salt], iv: [...iv], data: [...new Uint8Array(data)] });
    // crear o actualizar admin/acceso.enc.json en el repositorio
    let sha;
    try { sha = (await gh(`/repos/${REPO}/contents/admin/acceso.enc.json?ref=${RAMA}`)).sha; } catch {}
    await gh(`/repos/${REPO}/contents/admin/acceso.enc.json`, {
      method: "PUT",
      body: Object.assign(
        { message: "Admin: contraseña de acceso universal [auto-build]", content: btoa(cuerpo), branch: RAMA },
        sha ? { sha } : {}
      ),
    });
    toast("✓ Listo. En 1–2 minutos podrás entrar desde cualquier dispositivo solo con esa contraseña.");
  } catch (err) {
    toast("No se pudo activar: " + err.message, true);
  }
});

/* ---------- arranque ---------- */
(async function init() {
  if (localStorage.getItem("mym_admin_token_enc") || localStorage.getItem("mym_admin_token")) {
    $("token").value = "••••••••••••••••";
  }
  // ¿Está activo el acceso universal?
  try {
    const r = await fetch(`${RAW}/admin/acceso.enc.json?t=${Date.now()}`);
    if (r.ok) {
      ACCESO = await r.json();
      const caja = document.querySelector(".candado__caja p");
      if (caja) caja.textContent = "Ingresa tu contraseña";
      $("pinInput").placeholder = "Contraseña";
      $("pinInput").removeAttribute("maxlength");
      $("pinInput").removeAttribute("inputmode");
      $("pinInput").setAttribute("autocomplete", "current-password");
      $("pinInput").style.letterSpacing = "0.1em";
      $("pinInput").style.fontSize = "1.05rem";
      $("pinError").textContent = "Contraseña incorrecta";
      $("btnCambiarPin").classList.add("hide");
      [...$("btnCambiarPin").parentElement.childNodes].forEach((n) => { if (n.nodeType === 3) n.textContent = ""; });
      $("btnAccesoUni").textContent = "Cambiar contraseña de acceso";
    }
  } catch {}
  $("btnPin").addEventListener("click", desbloquear);
  $("pinInput").addEventListener("keydown", (e) => { if (e.key === "Enter") desbloquear(); });
  $("pinInput").focus();
  try { await cargar(); }
  catch (e) { $("estado").textContent = "No pude cargar el catálogo: " + e.message; }
})();
