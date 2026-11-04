/* Panel de administración M&M Store
 * - Lee el catálogo directo del repositorio (siempre la última versión)
 * - Edita todo el producto: datos, visibilidad y galería de fotos completa
 *   (ver en grande, ordenar, elegir la principal, quitar y subir desde PC o celular)
 * - Procesa las fotos en el navegador (recorte, cuadrado 900px, WebP, sin metadatos)
 * - Publica TODO en un solo commit vía la API de GitHub; el robot (Action)
 *   reconstruye las páginas de producto automáticamente.
 */
"use strict";

const REPO = "MrKardona/mymstore";
const RAMA = "main";
const RAW = `https://raw.githubusercontent.com/${REPO}/${RAMA}`;
const BLOQUEO_MIN = 20; // minutos sin uso antes de volver a pedir la contraseña

/* ---------- Acceso: la clave de GitHub viaja cifrada DENTRO del repo ----------
 * admin/acceso.enc.json guarda la clave cifrada con la contraseña del panel
 * (PBKDF2 600.000 iteraciones + AES-GCM). Descifrada vive solo en memoria:
 * se borra al pulsar Salir, al cerrar la pestaña o tras 20 minutos sin uso.
 */
let ACCESO = null; // {salt, iv, data, iter}
let TOKEN = "";
let publicando = false;

async function claveMaestra(pass, saltBytes, iter) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(saltBytes), iterations: iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function desbloquear() {
  const pass = $("pinInput").value;
  if (!ACCESO || !pass) return;
  $("btnPin").disabled = true;
  $("btnPin").textContent = "Verificando…";
  try {
    const k = await claveMaestra(pass, ACCESO.salt, ACCESO.iter || 600000);
    const b = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(ACCESO.iv) }, k, new Uint8Array(ACCESO.data));
    TOKEN = new TextDecoder().decode(b);
    $("pinError").classList.add("hide");
    $("candadoMsg").textContent = "Ingresa tu contraseña";
    $("claveOk").classList.remove("hide");
    $("candado").classList.add("hide");
    tocar();
    actualizarCambios();
  } catch {
    $("pinError").classList.remove("hide");
  }
  $("pinInput").value = "";
  $("btnPin").disabled = false;
  $("btnPin").textContent = "Entrar";
}

function bloquear(motivo) {
  TOKEN = "";
  $("claveOk").classList.add("hide");
  $("candadoMsg").textContent = motivo || "Ingresa tu contraseña";
  $("pinError").classList.add("hide");
  $("candado").classList.remove("hide");
  actualizarCambios();
  $("pinInput").focus();
}

let ultimoUso = Date.now();
function tocar() { ultimoUso = Date.now(); }
["pointerdown", "keydown", "input"].forEach((ev) => document.addEventListener(ev, tocar, { passive: true }));
setInterval(() => {
  if (TOKEN && !publicando && Date.now() - ultimoUso > BLOQUEO_MIN * 60000) {
    bloquear("Se cerró por seguridad tras 20 minutos sin uso. Tus cambios sin publicar siguen aquí.");
  }
}, 30000);

const $ = (id) => document.getElementById(id);
let CATS = [];
let catsDirty = false;
let CAT_NOMBRE = {};

let PRODUCTOS = [];        // estado editable (incluye ocultos con oculto: true)
let ORIGINAL = new Map();  // id -> huella publicada, para detectar cambios
let GALERIA = {};          // id -> número de la última vista en la galería
let eliminados = [];
let VERS = Date.now();     // rompe la caché de raw.githubusercontent al ver fotos

/* Cada foto es { k, ruta, src, blob?, c450? }
 *  ruta = dónde vive hoy en el repo (null si se acaba de subir)
 *  blob = imagen 900px lista para subir; c450 = lienzo para la miniatura
 */
let PENDIENTES = {};       // id -> lista de fotos cambiada; se aplica al publicar
let CONOCIDAS = {};        // id -> lista de fotos tal como está publicada
let fotosEd = [];          // fotos de la ficha abierta
let firmaFotos = "";
let cargandoFotos = false;
let editandoId = null;     // id del producto en edición (null = nuevo)
let nFoto = 0;

/* ---------- utilidades ---------- */
function toast(msg, esError) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!esError);
  t.classList.remove("hide");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hide"), 4200);
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Texto de una línea, sin < > (la tienda lo pinta como HTML)
const limpio = (s) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
function slug(nombre) {
  return nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
const svg = (d) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  izq: svg('<path d="M15 18l-6-6 6-6"/>'),
  der: svg('<path d="M9 18l6-6-6-6"/>'),
  estrella: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  basura: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
};

/* ---------- carga del catálogo ---------- */
const CAMPOS = ["id", "name", "brand", "cat", "img", "price", "sizes", "qty", "tag", "desc"];
const huella = (p) => JSON.stringify(CAMPOS.map((k) => p[k] ?? "").concat(!!p.oculto));
function tomarFoto() { ORIGINAL = new Map(PRODUCTOS.map((p) => [p.id, huella(p)])); }

async function cargar() {
  const code = await (await fetch(`${RAW}/assets/js/products.js?t=${Date.now()}`, { cache: "no-store" })).text();
  const datos = new Function(code + "; return { v: PRODUCTS, o: typeof PRODUCTS_OCULTOS !== 'undefined' ? PRODUCTS_OCULTOS : [] };")();
  PRODUCTOS = datos.v.map((p) => ({ ...p, oculto: false })).concat(datos.o.map((p) => ({ ...p, oculto: true })));
  tomarFoto();
  try {
    const cc = await (await fetch(`${RAW}/assets/js/categories.js?t=${Date.now()}`, { cache: "no-store" })).text();
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
    const g = await (await fetch(`${RAW}/assets/js/gallery.js?t=${Date.now()}`, { cache: "no-store" })).text();
    Object.assign(GALERIA, new Function(g + "; return GALLERY;")());
  } catch {}
  pintar();
  const ocultos = PRODUCTOS.filter((p) => p.oculto).length;
  $("estado").textContent = `${PRODUCTOS.length - ocultos} productos en la tienda` + (ocultos ? ` · ${ocultos} oculto(s)` : "");
}

function poblarCategorias() {
  const ops = CATS.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("");
  const filtro = $("filtroCat").value || "all";
  $("filtroCat").innerHTML = `<option value="all">Todas las categorías</option>` + ops + `<option value="__ocultos">Ocultos de la tienda</option>`;
  $("filtroCat").value = filtro;
  $("fCat").innerHTML = ops + `<option value="__nueva">➕ Crear nueva categoría…</option>`;
}

/* ---------- tabla ---------- */
function fotoTabla(p) {
  const l = PENDIENTES[p.id] || CONOCIDAS[p.id];
  return l && l[0] ? l[0].src : `${RAW}/assets/img/thumbs/${p.img}`;
}

function pintar() {
  const q = ($("buscar").value || "").toLowerCase();
  const cat = $("filtroCat").value;
  const tb = $("tbody");
  tb.innerHTML = "";
  for (const p of PRODUCTOS) {
    if (cat === "__ocultos" ? !p.oculto : cat !== "all" && p.cat !== cat) continue;
    if (q && !(p.name + " " + p.brand).toLowerCase().includes(q)) continue;
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    tr.title = "Toca para editar";
    if (p.qty <= 0) tr.classList.add("agotado");
    if (p.oculto) tr.classList.add("oculto");
    if (ORIGINAL.get(p.id) !== huella(p) || PENDIENTES[p.id]) tr.classList.add("dirty");
    tr.innerHTML = `
      <td><img src="${esc(fotoTabla(p))}" alt="" loading="lazy"></td>
      <td><div class="nombre">${esc(p.name)}${p.oculto ? ' <span class="etq">Oculto</span>' : ""}</div><div class="cat">${esc(p.brand)} · ${esc(CAT_NOMBRE[p.cat] || p.cat)}</div></td>
      <td><input class="precio" type="number" inputmode="numeric" min="0" step="1000" value="${p.price}" data-id="${p.id}" data-k="price" aria-label="Precio"></td>
      <td><input class="tallas" value="${esc(p.sizes)}" data-id="${p.id}" data-k="sizes" aria-label="Tallas"></td>
      <td><input class="qty" type="number" inputmode="numeric" min="0" step="1" value="${p.qty}" data-id="${p.id}" data-k="qty" aria-label="Cantidad"></td>
      <td class="acciones">
        <button class="icono" title="Editar" data-editar="${p.id}">✎</button>
        <button class="icono icono--rojo" title="Eliminar" data-borrar="${p.id}">🗑</button>
      </td>`;
    tb.appendChild(tr);
  }
  actualizarCambios();
}

function cambiados() {
  const s = new Set(Object.keys(PENDIENTES));
  for (const p of PRODUCTOS) if (ORIGINAL.get(p.id) !== huella(p)) s.add(p.id);
  return s;
}
function nCambios() { return cambiados().size + eliminados.length + (catsDirty ? 1 : 0); }
function actualizarCambios() {
  const n = nCambios();
  $("btnPublicar").disabled = !n || !TOKEN || publicando;
  $("nCambios").classList.toggle("hide", !n);
  $("nCambios").textContent = n;
  $("btnDeshacer").classList.toggle("hide", !n || publicando);
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.id) return;
  const p = PRODUCTOS.find((x) => x.id === el.dataset.id);
  if (!p) return;
  const k = el.dataset.k;
  p[k] = k === "sizes" ? el.value : Math.max(0, parseInt(el.value || "0", 10));
  const tr = el.closest("tr");
  tr.classList.toggle("dirty", ORIGINAL.get(p.id) !== huella(p) || !!PENDIENTES[p.id]);
  tr.classList.toggle("agotado", p.qty <= 0);
  actualizarCambios();
});

function borrarProducto(id) {
  const p = PRODUCTOS.find((x) => x.id === id);
  if (!p) return false;
  if (!confirm(`¿Eliminar "${p.name}" del catálogo?\n\nSi solo quieres esconderlo un tiempo, mejor ábrelo y apaga "Mostrar en la tienda".`)) return false;
  PRODUCTOS = PRODUCTOS.filter((x) => x.id !== id);
  delete PENDIENTES[id];
  if (ORIGINAL.has(id)) eliminados.push(id);
  pintar();
  toast("Eliminado de la lista. Recuerda publicar los cambios.");
  return true;
}

document.addEventListener("click", (e) => {
  const ed = e.target.closest("[data-editar]");
  if (ed) return abrirForm(ed.dataset.editar);
  const bo = e.target.closest("[data-borrar]");
  if (bo) return void borrarProducto(bo.dataset.borrar);
  // clic en cualquier parte del producto (foto, nombre…) abre el editor,
  // excepto sobre los campos rápidos y botones
  const fila = e.target.closest("#tbody tr[data-id]");
  if (fila && !e.target.closest("input, button, select, a, textarea")) abrirForm(fila.dataset.id);
});

$("buscar").addEventListener("input", pintar);
$("filtroCat").addEventListener("change", pintar);

$("btnDeshacer").addEventListener("click", async () => {
  if (!confirm("¿Descartar todos los cambios que no has publicado?")) return;
  PENDIENTES = {};
  eliminados = [];
  catsDirty = false;
  try { await cargar(); toast("Cambios descartados."); }
  catch (err) { toast("No pude recargar el catálogo: " + err.message, true); }
});

window.addEventListener("beforeunload", (e) => {
  if (nCambios()) { e.preventDefault(); e.returnValue = ""; }
});

/* ---------- clave de GitHub (solo para renovarla) ---------- */
async function validarClave(valor) {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { Authorization: "Bearer " + valor, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error("GitHub respondió " + r.status);
  const j = await r.json();
  if (!j.permissions || !j.permissions.push) throw new Error("la clave no tiene permiso de escritura (Contents: Read and write)");
}
$("btnGuardarClave").addEventListener("click", async () => {
  const v = $("token").value.trim();
  if (!v) return toast("Pega la clave nueva primero", true);
  $("btnGuardarClave").disabled = true;
  try {
    await validarClave(v);
    TOKEN = v;
    $("token").value = "";
    $("claveOk").classList.remove("hide");
    toast("Clave conectada. Ahora pulsa “Cambiar contraseña de acceso” para guardarla en todos los dispositivos.");
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
  const escala = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
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
  const sx = x0 / escala, sy = y0 / escala, sw = (x1 - x0) / escala, sh = (y1 - y0) / escala;

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
  return { c900: cuadro(900), c450: cuadro(450) };
}
function aBlob(canvas) {
  return new Promise((res, rej) => canvas.toBlob((b) => {
    if (b && b.type === "image/webp") return res(b);
    // Safari (iPhone) no genera WebP: se guarda en JPEG, que los navegadores muestran igual
    canvas.toBlob((j) => (j ? res(j) : rej(new Error("No pude procesar la foto."))), "image/jpeg", 0.86);
  }, "image/webp", 0.8));
}
async function bajar(ruta) {
  const r = await fetch(`${RAW}/${ruta}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`no pude leer la foto ${ruta.split("/").pop()} (${r.status})`);
  return r.blob();
}
async function miniatura(blob) {
  const bmp = await createImageBitmap(blob);
  const c = Object.assign(document.createElement("canvas"), { width: 450, height: 450 });
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, 450, 450);
  return aBlob(c);
}

/* ---------- galería de la ficha ---------- */
const firma = (lista) => lista.map((f) => f.k).join("|");

// Fotos publicadas de un producto: principal + vistas de la galería que existan
async function fotosDe(p) {
  if (PENDIENTES[p.id]) return PENDIENTES[p.id];
  if (CONOCIDAS[p.id]) return CONOCIDAS[p.id];
  if (!ORIGINAL.has(p.id)) return [];
  const rutas = [`assets/img/products/${p.img}`];
  for (let n = 2; n <= (GALERIA[p.id] || 1); n++) rutas.push(`assets/img/products/gallery/${p.id}-${n}.webp`);
  const lista = (await Promise.all(rutas.map((ruta) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ k: ruta, ruta, src: im.src });
    im.onerror = () => res(null);
    im.src = `${RAW}/${ruta}?v=${VERS}`;
  })))).filter(Boolean);
  CONOCIDAS[p.id] = lista;
  return lista;
}

function pintarFotos() {
  const g = $("fotosGrid");
  $("fotosN").textContent = cargandoFotos ? "· cargando…" : fotosEd.length ? `· ${fotosEd.length}` : "";
  const ultima = fotosEd.length - 1;
  g.innerHTML = (cargandoFotos ? '<div class="foto foto--cargando"></div>'.repeat(3) : fotosEd.map((f, i) => `
    <figure class="foto" draggable="true" data-i="${i}">
      <button type="button" class="foto__ver" data-ver="${i}" aria-label="Ver foto ${i + 1} en grande"><img src="${esc(f.src)}" alt="" draggable="false"></button>
      ${i === 0 ? '<span class="foto__badge">Principal</span>' : ""}${f.ruta ? "" : '<span class="foto__badge foto__badge--nueva">Nueva</span>'}
      <div class="foto__ctrl">
        <button type="button" data-mover="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="Mover a la izquierda" title="Mover a la izquierda">${ICO.izq}</button>
        <button type="button" data-principal="${i}" ${i === 0 ? "disabled" : ""} aria-label="Usar como principal" title="Usar como principal">${ICO.estrella}</button>
        <button type="button" data-mover="${i}" data-d="1" ${i === ultima ? "disabled" : ""} aria-label="Mover a la derecha" title="Mover a la derecha">${ICO.der}</button>
        <button type="button" class="peligro" data-quitar="${i}" aria-label="Quitar foto" title="Quitar foto">${ICO.basura}</button>
      </div>
    </figure>`).join("")) +
    `<label class="foto foto--agregar" for="fFotos">${ICO.mas}<span>Agregar fotos</span><small>o arrástralas aquí</small></label>`;
}

function moverFoto(i, j) {
  if (j < 0 || j >= fotosEd.length || i === j) return;
  const [f] = fotosEd.splice(i, 1);
  fotosEd.splice(j, 0, f);
  pintarFotos();
}
function quitarFoto(i) {
  if (fotosEd.length <= 1) return toast("El producto necesita al menos una foto: sube la nueva antes de quitar esta.", true);
  fotosEd.splice(i, 1);
  pintarFotos();
  toast(editandoId ? "Foto quitada. Desaparece de la tienda al publicar." : "Foto quitada.");
}

async function agregarFotos(files) {
  const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!imgs.length) return toast("Eso no parece una foto.", true);
  if (cargandoFotos) return toast("Espera a que carguen las fotos actuales.", true);
  $("fotosN").textContent = "· procesando…";
  for (const f of imgs) {
    if (f.size > 40 * 1024 * 1024) { toast(`"${f.name}" pesa demasiado (máximo 40 MB).`, true); continue; }
    try {
      const r = await procesarFoto(f);
      const blob = await aBlob(r.c900);
      fotosEd.push({ k: "n" + ++nFoto, ruta: null, src: URL.createObjectURL(blob), blob, c450: r.c450 });
      pintarFotos();
    } catch {
      toast(`No pude abrir "${f.name}". Usa fotos JPG, PNG o WebP.`, true);
    }
  }
  pintarFotos();
}

$("fFotos").addEventListener("change", (e) => { agregarFotos([...e.target.files]); e.target.value = ""; });
$("fotosGrid").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.ver) return abrirVisor(+b.dataset.ver);
  if (b.dataset.mover) return moverFoto(+b.dataset.mover, +b.dataset.mover + +b.dataset.d);
  if (b.dataset.principal) { moverFoto(+b.dataset.principal, 0); return toast("Ahora es la foto principal."); }
  if (b.dataset.quitar) quitarFoto(+b.dataset.quitar);
});

// Arrastrar: fotos del computador para subirlas, o una foto de la ficha para ordenarla
let arrastrada = null;
const zona = $("fotos");
zona.addEventListener("dragstart", (e) => {
  const f = e.target.closest(".foto[data-i]");
  if (!f) return;
  arrastrada = +f.dataset.i;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(arrastrada));
  f.classList.add("foto--moviendo");
});
zona.addEventListener("dragend", () => {
  arrastrada = null;
  zona.querySelectorAll(".foto--moviendo, .foto--destino").forEach((x) => x.classList.remove("foto--moviendo", "foto--destino"));
});
zona.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (arrastrada === null) return zona.classList.add("arrastrando");
  const t = e.target.closest(".foto[data-i]");
  zona.querySelectorAll(".foto--destino").forEach((x) => x !== t && x.classList.remove("foto--destino"));
  if (t && +t.dataset.i !== arrastrada) t.classList.add("foto--destino");
});
zona.addEventListener("dragleave", (e) => { if (!zona.contains(e.relatedTarget)) zona.classList.remove("arrastrando"); });
zona.addEventListener("drop", (e) => {
  e.preventDefault();
  zona.classList.remove("arrastrando");
  if (arrastrada !== null) {
    const t = e.target.closest(".foto[data-i]");
    if (t) moverFoto(arrastrada, +t.dataset.i);
    arrastrada = null;
    return;
  }
  if (e.dataTransfer.files.length) agregarFotos([...e.dataTransfer.files]);
});

/* ---------- visor de fotos en grande ---------- */
let visorI = 0;
function abrirVisor(i) { visorI = i; pintarVisor(); $("visor").classList.remove("hide"); }
function cerrarVisor() { $("visor").classList.add("hide"); }
function pintarVisor() {
  const f = fotosEd[visorI];
  if (!f) return cerrarVisor();
  $("visorImg").src = f.src;
  $("visorN").textContent = `Foto ${visorI + 1} de ${fotosEd.length}${visorI === 0 ? " · principal" : ""}`;
  $("visorAnt").disabled = visorI === 0;
  $("visorSig").disabled = visorI === fotosEd.length - 1;
  $("visorIzq").disabled = visorI === 0;
  $("visorDer").disabled = visorI === fotosEd.length - 1;
  $("visorPrincipal").disabled = visorI === 0;
}
function moverEnVisor(d) { moverFoto(visorI, visorI + d); visorI = Math.min(Math.max(visorI + d, 0), fotosEd.length - 1); pintarVisor(); }
$("visorCerrar").addEventListener("click", cerrarVisor);
$("visorAnt").addEventListener("click", () => { visorI = Math.max(0, visorI - 1); pintarVisor(); });
$("visorSig").addEventListener("click", () => { visorI = Math.min(fotosEd.length - 1, visorI + 1); pintarVisor(); });
$("visorIzq").addEventListener("click", () => moverEnVisor(-1));
$("visorDer").addEventListener("click", () => moverEnVisor(1));
$("visorPrincipal").addEventListener("click", () => { moverFoto(visorI, 0); visorI = 0; pintarVisor(); toast("Ahora es la foto principal."); });
$("visorQuitar").addEventListener("click", () => {
  if (fotosEd.length <= 1) return quitarFoto(visorI);
  quitarFoto(visorI);
  visorI = Math.min(visorI, fotosEd.length - 1);
  pintarVisor();
});
$("visor").addEventListener("click", (e) => { if (e.target === e.currentTarget || e.target.classList.contains("visor__img")) cerrarVisor(); });

/* ---------- ficha del producto ---------- */
let aperturas = 0;
async function abrirForm(id, copia) {
  const turno = ++aperturas;
  editandoId = id || null;
  const p = id ? PRODUCTOS.find((x) => x.id === id) : copia ? copia.datos : null;
  $("formTitulo").textContent = id ? "Editar producto" : copia ? "Duplicar producto" : "Nuevo producto";
  $("fNombre").value = p ? (copia ? p.name + " (copia)" : p.name) : "";
  $("fMarca").value = p ? p.brand : "Nike";
  $("fCat").value = p ? p.cat : CATS[0] ? CATS[0].id : "";
  $("fPrecio").value = p ? p.price : "";
  $("fTallas").value = p ? p.sizes : "";
  $("fCantidad").value = p ? p.qty : 1;
  $("fTag").value = p ? p.tag || "" : "";
  $("fDesc").value = p ? p.desc : "";
  $("fVisible").checked = p ? !p.oculto : true;
  contarDesc();
  const enTienda = id && ORIGINAL.has(id) && !p.oculto;
  $("verTienda").classList.toggle("hide", !enTienda);
  if (enTienda) $("verTienda").href = `../producto/${id}.html`;
  $("btnDuplicar").classList.toggle("hide", !id);
  $("btnEliminarForm").classList.toggle("hide", !id);
  $("velo").classList.remove("hide");
  $("form").classList.remove("hide");
  $("form").scrollTop = 0;

  fotosEd = copia ? copia.fotos.map((f) => ({ ...f, k: "c" + ++nFoto })) : [];
  firmaFotos = "";
  cargandoFotos = !!id;
  pintarFotos();
  if (!id) return;
  const lista = await fotosDe(p);
  if (turno !== aperturas) return; // se abrió otra ficha mientras cargaba
  fotosEd = lista.slice();
  firmaFotos = firma(fotosEd);
  cargandoFotos = false;
  pintarFotos();
}
function cerrarForm() {
  aperturas++;
  cargandoFotos = false;
  cerrarVisor();
  $("velo").classList.add("hide");
  $("form").classList.add("hide");
  editandoId = null;
}
function contarDesc() { $("descN").textContent = `${$("fDesc").value.length}/600`; }
$("fDesc").addEventListener("input", contarDesc);

$("fCat").addEventListener("change", () => {
  if ($("fCat").value !== "__nueva") return;
  const nombre = limpio(prompt("Nombre de la nueva categoría (ej: Botas, New Balance, Niños):") || "");
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
document.addEventListener("keydown", (e) => {
  if (!$("visor").classList.contains("hide")) {
    if (e.key === "Escape") cerrarVisor();
    if (e.key === "ArrowLeft") $("visorAnt").click();
    if (e.key === "ArrowRight") $("visorSig").click();
    return;
  }
  if (e.key === "Escape" && !$("form").classList.contains("hide")) cerrarForm();
});

function leerFicha() {
  return {
    name: limpio($("fNombre").value),
    brand: limpio($("fMarca").value) || "Nike",
    cat: $("fCat").value,
    price: parseInt($("fPrecio").value || "0", 10),
    sizes: limpio($("fTallas").value) || "Única",
    qty: Math.max(0, parseInt($("fCantidad").value || "0", 10)),
    tag: limpio($("fTag").value),
    desc: limpio($("fDesc").value),
    oculto: !$("fVisible").checked,
  };
}

$("btnDuplicar").addEventListener("click", () => {
  if (cargandoFotos) return toast("Espera a que carguen las fotos.", true);
  const datos = leerFicha();
  abrirForm(null, { datos, fotos: fotosEd });
  toast("Copia lista: cámbiale el nombre, la talla o las fotos y guárdala.");
});
$("btnEliminarForm").addEventListener("click", () => { if (borrarProducto(editandoId)) cerrarForm(); });

$("btnGuardarProducto").addEventListener("click", () => {
  const d = leerFicha();
  if (!d.name) return toast("Ponle nombre al producto", true);
  if ($("fPrecio").value === "" || !(d.price >= 0)) return toast("Ponle precio (0 = precio a consultar)", true);
  if (cargandoFotos) return toast("Espera a que carguen las fotos.", true);
  if (!fotosEd.length) return toast("Sube al menos una foto", true);
  if (!CAT_NOMBRE[d.cat]) return toast("Elige una categoría", true);

  let p;
  if (editandoId) {
    p = PRODUCTOS.find((x) => x.id === editandoId);
  } else {
    let id = slug(d.name) || "producto";
    while (PRODUCTOS.some((x) => x.id === id) || eliminados.includes(id)) id += "-2";
    p = { id, img: id + ".webp" };
    PRODUCTOS.push(p);
  }
  Object.assign(p, d, { desc: d.desc || d.name + " 100% original." });
  if (!editandoId || firma(fotosEd) !== firmaFotos) PENDIENTES[p.id] = fotosEd.slice();

  const eraNuevo = !editandoId;
  cerrarForm();
  pintar();
  toast(eraNuevo ? "Producto agregado al final del catálogo. Recuerda publicar." : "Cambios guardados en la lista. Recuerda publicar.");
});

/* ---------- publicar: un solo commit con la API de GitHub ---------- */
async function gh(ruta, opt = {}) {
  const r = await fetch("https://api.github.com" + ruta, {
    method: opt.method || "GET",
    headers: { Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json" },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 180)}`), { status: r.status });
  return r.json();
}
const blobABase64 = (blob) => new Promise((res) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(",")[1]);
  fr.readAsDataURL(blob);
});
function serializar(lista) {
  const s = (v) => JSON.stringify(limpio(v));
  const fila = (p) =>
    `  { id: "${p.id}", name: ${s(p.name)}, brand: ${s(p.brand)}, cat: "${p.cat}", img: "${p.img}", price: ${Number(p.price) || 0}, sizes: ${s(p.sizes)}, qty: ${Number(p.qty) || 0}, tag: ${s(p.tag)}, desc: ${s(p.desc)} }`;
  const vis = lista.filter((p) => !p.oculto), ocu = lista.filter((p) => p.oculto);
  return `// Catálogo M&M Store — editado desde el panel /admin\nconst PRODUCTS = [\n${vis.map(fila).join(",\n")}\n];\n` +
    (ocu.length ? `\n// Ocultos: no aparecen en la tienda; se vuelven a mostrar desde /admin\nconst PRODUCTS_OCULTOS = [\n${ocu.map(fila).join(",\n")}\n];\n` : "");
}

// Convierte las galerías editadas en archivos a subir y a borrar
async function planFotos() {
  const subir = [], borrar = [], publicadas = {};
  for (const [id, lista] of Object.entries(PENDIENTES)) {
    const p = PRODUCTOS.find((x) => x.id === id);
    if (!p) continue;
    const destino = lista.map((f, i) => (i === 0 ? `assets/img/products/${p.img}` : `assets/img/products/gallery/${id}-${i + 1}.webp`));
    publicadas[id] = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      if (f.ruta === destino[i]) { publicadas[id].push(f); continue; }
      const blob = f.blob || (await bajar(f.ruta));
      subir.push({ path: destino[i], blob });
      if (i === 0) subir.push({ path: `assets/img/thumbs/${p.img}`, blob: f.c450 ? await aBlob(f.c450) : await miniatura(blob) });
      publicadas[id].push({ k: destino[i], ruta: destino[i], src: f.blob ? f.src : URL.createObjectURL(blob), blob });
    }
    for (const f of CONOCIDAS[id] || []) {
      if (f.ruta.startsWith(`assets/img/products/gallery/${id}-`) && !destino.includes(f.ruta)) borrar.push(f.ruta);
    }
  }
  return { subir, borrar, publicadas };
}

$("btnPublicar").addEventListener("click", async () => {
  if (!TOKEN) return toast("Entra con tu contraseña para publicar", true);
  const btn = $("btnPublicar");
  const rotulo = $("pubTxt");
  publicando = true;
  btn.disabled = true;
  actualizarCambios();
  try {
    rotulo.textContent = "Preparando fotos…";
    const { subir, borrar, publicadas } = await planFotos();
    const arbol = [];
    let n = 0;
    for (const img of subir) {
      rotulo.textContent = `Subiendo fotos ${++n}/${subir.length}…`;
      const b = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: await blobABase64(img.blob), encoding: "base64" } });
      arbol.push({ path: img.path, mode: "100644", type: "blob", sha: b.sha });
    }
    for (const path of borrar) arbol.push({ path, mode: "100644", type: "blob", sha: null });
    rotulo.textContent = "Guardando catálogo…";
    if (catsDirty) {
      const cuerpo = "// Categorías de la tienda — se administran desde el panel /admin\nconst CATEGORIAS = [\n" +
        CATS.map((c) => `  { id: "${c.id}", nombre: ${JSON.stringify(limpio(c.nombre))} }`).join(",\n") + "\n];\n";
      const bc = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: cuerpo, encoding: "utf-8" } });
      arbol.push({ path: "assets/js/categories.js", mode: "100644", type: "blob", sha: bc.sha });
    }
    const cat = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: { content: serializar(PRODUCTOS), encoding: "utf-8" } });
    arbol.push({ path: "assets/js/products.js", mode: "100644", type: "blob", sha: cat.sha });

    const msg = `Admin: ${cambiados().size + eliminados.length} producto(s) actualizados` +
      (subir.length ? ` · ${subir.length} foto(s) subidas` : "") + (borrar.length ? ` · ${borrar.length} foto(s) quitadas` : "");
    // Si el robot publicó algo justo en medio, se vuelve a armar sobre lo último
    for (let intento = 1; ; intento++) {
      const ref = await gh(`/repos/${REPO}/git/ref/heads/${RAMA}`);
      const baseSha = ref.object.sha;
      const baseCommit = await gh(`/repos/${REPO}/git/commits/${baseSha}`);
      const tree = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: { base_tree: baseCommit.tree.sha, tree: arbol } });
      const commit = await gh(`/repos/${REPO}/git/commits`, { method: "POST", body: { message: msg, tree: tree.sha, parents: [baseSha] } });
      try {
        await gh(`/repos/${REPO}/git/refs/heads/${RAMA}`, { method: "PATCH", body: { sha: commit.sha } });
        break;
      } catch (err) {
        if (err.status !== 422 || intento >= 3) throw err;
      }
    }

    Object.assign(CONOCIDAS, publicadas);
    for (const [id, lista] of Object.entries(publicadas)) GALERIA[id] = lista.length;
    PENDIENTES = {};
    eliminados = [];
    catsDirty = false;
    VERS = Date.now();
    tomarFoto();
    pintar();
    toast("✓ Publicado. La tienda se actualiza en 1–2 minutos.");
    const ocultos = PRODUCTOS.filter((p) => p.oculto).length;
    $("estado").textContent = `${PRODUCTOS.length - ocultos} productos en la tienda · publicado ${new Date().toLocaleTimeString("es-CO")}`;
  } catch (err) {
    toast("No se pudo publicar: " + err.message, true);
  }
  publicando = false;
  rotulo.textContent = "Publicar cambios";
  actualizarCambios();
});

/* ---------- cambiar la contraseña de acceso ---------- */
$("btnAccesoUni").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!TOKEN) return toast("Entra con tu contraseña actual primero.", true);
  const p1 = (prompt("Contraseña nueva (mínimo 10 caracteres, con letras y números).\nCon ella entrarás desde cualquier dispositivo:") || "").trim();
  if (!p1) return;
  if (p1.length < 10 || !/[a-zA-Z]/.test(p1) || !/\d/.test(p1)) {
    return toast("Debe tener al menos 10 caracteres y mezclar letras y números.", true);
  }
  const p2 = (prompt("Repite la contraseña nueva:") || "").trim();
  if (p1 !== p2) return toast("No coinciden.", true);
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iter = 600000;
    const k = await claveMaestra(p1, salt, iter);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(TOKEN));
    const cuerpo = JSON.stringify({ v: 1, iter, salt: [...salt], iv: [...iv], data: [...new Uint8Array(data)] });
    let sha;
    try { sha = (await gh(`/repos/${REPO}/contents/admin/acceso.enc.json?ref=${RAMA}`)).sha; } catch {}
    await gh(`/repos/${REPO}/contents/admin/acceso.enc.json`, {
      method: "PUT",
      body: Object.assign(
        { message: "Admin: contraseña de acceso universal [auto-build]", content: btoa(cuerpo), branch: RAMA },
        sha ? { sha } : {}
      ),
    });
    ACCESO = JSON.parse(cuerpo);
    toast("✓ Contraseña cambiada. En 1–2 minutos aplica en todos los dispositivos.");
  } catch (err) {
    toast("No se pudo cambiar: " + err.message, true);
  }
});

$("btnSalir").addEventListener("click", () => {
  cerrarForm();
  bloquear(nCambios() ? "Sesión cerrada. Tus cambios sin publicar siguen aquí mientras no cierres la página." : "Sesión cerrada.");
});

/* ---------- arranque ---------- */
(async function init() {
  $("btnPin").addEventListener("click", desbloquear);
  $("pinInput").addEventListener("keydown", (e) => { if (e.key === "Enter") desbloquear(); });
  try {
    const r = await fetch(`${RAW}/admin/acceso.enc.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    ACCESO = await r.json();
  } catch {
    $("candadoMsg").textContent = "No pude verificar el acceso. Revisa tu internet y recarga la página.";
    $("btnPin").disabled = true;
  }
  $("pinInput").focus();
  try { await cargar(); }
  catch (e) { $("estado").textContent = "No pude cargar el catálogo: " + e.message; }
})();
