/* ============================================================
   M&M Store — Guía de tallas por marca y región
   Tablas oficiales de cada marca (US · UK · Europa · cm).
   Se abre con cualquier elemento [data-guia-tallas]; en la ficha de
   producto lee data-marca y data-tallas para marcar "este par".
   ============================================================ */
(function () {
  // [US, UK, EU, cm] — tablas oficiales de cada marca, por género
  const TABLAS = {
    nike: {
      nombre: "Nike · Jordan",
      m: [[3.5,3,35.5,22.5],[4,3.5,36,23],[4.5,4,36.5,23.5],[5,4.5,37.5,23.5],[5.5,5,38,24],[6,5.5,38.5,24],[6.5,6,39,24.5],[7,6,40,25],[7.5,6.5,40.5,25.5],[8,7,41,26],[8.5,7.5,42,26.5],[9,8,42.5,27],[9.5,8.5,43,27.5],[10,9,44,28],[10.5,9.5,44.5,28.5],[11,10,45,29],[11.5,10.5,45.5,29.5],[12,11,46,30],[12.5,11.5,47,30.5],[13,12,47.5,31],[14,13,48.5,32]],
      w: [[5,2.5,35.5,22],[5.5,3,36,22.5],[6,3.5,36.5,23],[6.5,4,37.5,23.5],[7,4.5,38,24],[7.5,5,38.5,24.5],[8,5.5,39,25],[8.5,6,40,25.5],[9,6.5,40.5,26],[9.5,7,41,26.5],[10,7.5,42,27],[10.5,8,42.5,27.5],[11,8.5,43,28],[11.5,9,44,28.5],[12,9.5,44.5,29]],
      nota: "La mayoría de modelos Nike y Jordan vienen a tu talla de siempre. Si tienes el pie ancho o quedas entre dos tallas, elige media talla más.",
    },
    adidas: {
      nombre: "adidas · Yeezy",
      m: [[3.5,3,"35 1/3",21.6],[4,3.5,36,22.1],[4.5,4,"36 2/3",22.5],[5,4.5,"37 1/3",22.9],[5.5,5,38,23.3],[6,5.5,"38 2/3",23.8],[6.5,6,"39 1/3",24.2],[7,6.5,40,24.6],[7.5,7,"40 2/3",25],[8,7.5,"41 1/3",25.5],[8.5,8,42,25.9],[9,8.5,"42 2/3",26.3],[9.5,9,"43 1/3",26.7],[10,9.5,44,27.1],[10.5,10,"44 2/3",27.6],[11,10.5,"45 1/3",28],[11.5,11,46,28.4],[12,11.5,"46 2/3",28.8],[12.5,12,"47 1/3",29.3],[13,12.5,48,29.7]],
      w: [[5,3.5,36,22.1],[5.5,4,"36 2/3",22.5],[6,4.5,"37 1/3",22.9],[6.5,5,38,23.3],[7,5.5,"38 2/3",23.8],[7.5,6,"39 1/3",24.2],[8,6.5,40,24.6],[8.5,7,"40 2/3",25],[9,7.5,"41 1/3",25.5],[9.5,8,42,25.9],[10,8.5,"42 2/3",26.3],[10.5,9,"43 1/3",26.7],[11,9.5,44,27.1],[11.5,10,"44 2/3",27.6],[12,10.5,"45 1/3",28]],
      nota: "Las tallas europeas de adidas van en tercios (ej. 42 ⅔). Los Yeezy Boost 350 suelen quedar ajustados: mucha gente pide media talla más.",
    },
    nb: {
      nombre: "New Balance",
      m: [[3.5,3,35.5,21.5],[4,3.5,36,22],[4.5,4,37,22.5],[5,4.5,37.5,23],[5.5,5,38,23.5],[6,5.5,38.5,24],[6.5,6,39.5,24.5],[7,6.5,40,25],[7.5,7,40.5,25.5],[8,7.5,41.5,26],[8.5,8,42,26.5],[9,8.5,42.5,27],[9.5,9,43,27.5],[10,9.5,44,28],[10.5,10,44.5,28.5],[11,10.5,45,29],[11.5,11,45.5,29.5],[12,11.5,46.5,30],[12.5,12,47,30.5],[13,12.5,47.5,31]],
      w: [[5,3,35,22],[5.5,3.5,36,22.5],[6,4,36.5,23],[6.5,4.5,37,23.5],[7,5,37.5,24],[7.5,5.5,38,24.5],[8,6,39,25],[8.5,6.5,40,25.5],[9,7,40.5,26],[9.5,7.5,41,26.5],[10,8,41.5,27],[10.5,8.5,42.5,27.5],[11,9,43,28],[11.5,9.5,43.5,28.5],[12,10,44,29]],
      nota: "New Balance suele ser fiel a la medida del pie: si conoces tus centímetros, búscalos directo en la tabla.",
    },
  };
  const REGIONES = [
    { k: 0, corto: "US", largo: "US" },
    { k: 1, corto: "UK", largo: "UK" },
    { k: 2, corto: "Europa", largo: "Europa (EU)" },
    { k: 3, corto: "Cm", largo: "Centímetros" },
  ];
  const GENEROS = { m: "Hombre", w: "Mujer" };
  const PREF_KEY = "mym_talla_v1";

  const marcaDe = (txt) => (/new balance/i.test(txt) ? "nb" : /adidas|yeezy/i.test(txt) ? "adidas" : "nike");
  const num = (v) => (typeof v === "number" ? v : (() => { const [e, f] = v.split(" "); const [a, b] = f.split("/"); return +e + a / b; })());
  const fmt = (v) => (typeof v === "number" ? String(v) : v.replace(" 1/3", " ⅓").replace(" 2/3", " ⅔"));
  const fmtCelda = (v, k) => fmt(v) + (k === 3 ? " cm" : "");

  // "6 US Men · 7 US Women", "8.5 y 9 US Men", "6Y · 7Y", "6–9.5 US Men" → [{g, min, max}]
  function leerTallas(txt) {
    const out = [];
    const segs = String(txt || "").split("·");
    // "6 · 6.5 US Women": un segmento sin género toma el del siguiente que lo diga
    const generoDe = (i) => {
      for (let j = i; j < segs.length; j++) {
        if (/women|mujer/i.test(segs[j])) return "w";
        if (/\bmen\b|hombre|\dY/i.test(segs[j])) return "m";
      }
      return "m";
    };
    for (const [i, seg] of segs.entries()) {
      const g = generoDe(i);
      const rango = seg.match(/(\d+(?:\.5)?)\s*(?:–|-|\ba\b)\s*(\d+(?:\.5)?)/);
      if (rango) { out.push({ g, min: +rango[1], max: +rango[2] }); continue; }
      for (const n of seg.match(/\d+(?:\.5)?/g) || []) out.push({ g, min: +n, max: +n });
    }
    return out.filter((t) => t.min >= 3 && t.max <= 16);
  }
  const esDelPar = (tallas, g, us) => tallas.some((t) => t.g === g && us >= t.min && us <= t.max);
  // "Este par" solo se marca en la tabla de la marca del producto
  const parVisible = () => estado.marca === estado.marcaPar ? estado.tallas : [];

  const leerPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || null; } catch { return null; } };
  const guardarPref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} };

  // Fila más cercana a un valor en una región (empate → la más grande)
  function filaCercana(filas, k, valor) {
    let mejor = 0;
    filas.forEach((f, i) => { if (Math.abs(num(f[k]) - valor) <= Math.abs(num(filas[mejor][k]) - valor)) mejor = i; });
    return mejor;
  }

  const estado = { marca: "nike", marcaPar: "nike", g: "m", region: 0, fila: -1, tallas: [], producto: "" };
  let raiz, ultimoFoco;

  function construir() {
    const velo = document.createElement("div");
    velo.className = "tg-velo";
    velo.addEventListener("click", cerrar);
    raiz = document.createElement("aside");
    raiz.className = "tg";
    raiz.setAttribute("role", "dialog");
    raiz.setAttribute("aria-modal", "true");
    raiz.setAttribute("aria-labelledby", "tgTitulo");
    raiz.innerHTML = `
      <header class="tg__head">
        <div>
          <p class="tg__kicker">Guía de tallas</p>
          <h2 id="tgTitulo">Encuentra tu talla</h2>
        </div>
        <button class="tg__x" type="button" aria-label="Cerrar guía de tallas">✕</button>
      </header>
      <div class="tg__body" data-lenis-prevent>
        <div class="tg__tabs" role="group" aria-label="Marca">
          ${Object.entries(TABLAS).map(([k, t]) => `<button type="button" class="tg__tab" data-marca="${k}">${t.nombre}</button>`).join("")}
        </div>
        <div class="tg__seg" role="group" aria-label="Género">
          <button type="button" data-g="m">Hombre</button><button type="button" data-g="w">Mujer</button>
        </div>

        <section class="tg__conv" aria-labelledby="tgConvT">
          <h3 id="tgConvT">¿Qué talla usas normalmente?</h3>
          <div class="tg__conv-row">
            <label><span>Región</span><select id="tgRegion">${REGIONES.map((r) => `<option value="${r.k}">${r.largo}</option>`).join("")}</select></label>
            <label><span>Tu talla</span><select id="tgValor"></select></label>
          </div>
          <div class="tg__equiv" id="tgEquiv" aria-live="polite"></div>
          <div class="tg__match" id="tgMatch"></div>
        </section>

        <div class="tg__tabla-wrap">
          <table class="tg__tabla">
            <caption id="tgCaption"></caption>
            <thead><tr>${REGIONES.map((r) => `<th scope="col">${r.corto}</th>`).join("")}</tr></thead>
            <tbody id="tgFilas"></tbody>
          </table>
        </div>
        <p class="tg__nota" id="tgNota"></p>

        <section class="tg__medir" aria-labelledby="tgMedirT">
          <svg viewBox="0 0 120 150" aria-hidden="true">
            <rect x="8" y="4" width="104" height="10" rx="2" class="tg__pared"/>
            <rect x="22" y="14" width="76" height="128" rx="3" class="tg__hoja"/>
            <path d="M60 22c-14 0-22 14-22 34 0 16 5 26 6 40 1 16-2 28 6 36 6 6 16 6 21 0 7-8 5-22 6-36 2-18 7-28 7-44 0-18-10-30-24-30z" class="tg__pie"/>
            <line x1="104" y1="14" x2="104" y2="140" class="tg__flecha"/>
            <path d="M100 20l4-6 4 6M100 134l4 6 4-6" class="tg__flecha"/>
            <line x1="40" y1="141" x2="108" y2="141" class="tg__marca"/>
          </svg>
          <div>
            <h3 id="tgMedirT">Mide tu pie en 1 minuto</h3>
            <ol>
              <li>Pon una hoja en el piso, pegada a la pared.</li>
              <li>Párate descalzo con el talón contra la pared y marca dónde llega tu dedo más largo.</li>
              <li>Mide de la pared a la marca en centímetros y búscalo en la tabla. Si quedas entre dos medidas, elige la mayor.</li>
            </ol>
            <p>Mide en la tarde (el pie se hincha un poco durante el día) y los dos pies: manda el más largo.</p>
          </div>
        </section>

        <p class="tg__col"><strong>¿Y la talla colombiana?</strong> El número de almacén (“calzo 40”) cambia de una fábrica a otra, así que no sirve para tenis importados. Para acertar usa la talla US que traen la caja y la etiqueta, o tus centímetros.</p>
        <p class="tg__col">Las tallas juveniles (ej. <strong>6Y</strong>) equivalen a la misma talla US de hombre: 6Y = US 6 Hombre.</p>

        <a href="#" class="btn btn--wa tg__wa" id="tgWa">¿Dudas con tu talla? Te asesoramos por WhatsApp <span class="btn__arrow">→</span></a>
      </div>`;
    document.body.append(velo, raiz);

    raiz.querySelector(".tg__x").addEventListener("click", cerrar);
    raiz.querySelectorAll("[data-marca]").forEach((b) => b.addEventListener("click", () => { estado.marca = b.dataset.marca; reubicar(); pintar(); }));
    raiz.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => { estado.g = b.dataset.g; reubicar(); pintar(); }));
    raiz.querySelector("#tgRegion").addEventListener("change", (e) => { estado.region = +e.target.value; pintar(); });
    raiz.querySelector("#tgValor").addEventListener("change", (e) => { estado.fila = +e.target.value; recordar(); pintar(); });
    raiz.querySelector("#tgFilas").addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-i]");
      if (tr) { estado.fila = +tr.dataset.i; recordar(); pintar(); }
    });
    raiz.querySelector("#tgWa").addEventListener("click", (e) => { e.preventDefault(); window.open(waUrl(mensajeWa()), "_blank", "noopener"); });
    raiz.addEventListener("keydown", atraparFoco);
  }

  const filas = () => TABLAS[estado.marca][estado.g];

  // Al cambiar de marca o género, conserva la talla en la región elegida (US 9 sigue siendo US 9)
  function reubicar() {
    const pref = leerPref();
    if (pref && pref.g === estado.g) estado.fila = filaCercana(filas(), pref.region, pref.valor);
    else estado.fila = -1;
  }
  function recordar() {
    const f = filas()[estado.fila];
    if (f) guardarPref({ g: estado.g, region: estado.region, valor: num(f[estado.region]) });
  }

  function pintar() {
    const t = TABLAS[estado.marca], lista = filas(), k = estado.region;
    raiz.querySelectorAll("[data-marca]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.marca === estado.marca));
    raiz.querySelectorAll("[data-g]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.g === estado.g));
    raiz.querySelector("#tgRegion").value = k;

    // Selector de talla: valores de la región elegida (sin repetidos; el repetido apunta a la talla mayor)
    const vistos = new Map();
    lista.forEach((f, i) => vistos.set(fmtCelda(f[k], k), i));
    const sel = raiz.querySelector("#tgValor");
    sel.innerHTML = `<option value="-1">Elige…</option>` + [...vistos].map(([txt, i]) => `<option value="${i}">${txt}</option>`).join("");
    const elegido = estado.fila >= 0 ? fmtCelda(lista[estado.fila][k], k) : null;
    sel.value = elegido && vistos.has(elegido) ? vistos.get(elegido) : -1;

    const f = lista[estado.fila];
    raiz.querySelector("#tgEquiv").innerHTML = f
      ? REGIONES.map((r) => `<div class="${r.k === k ? "is-base" : ""}"><span>${r.corto}</span><strong>${fmt(f[r.k])}</strong></div>`).join("")
      : `<p>Elige tu talla de siempre y te mostramos su equivalente en las demás regiones para ${t.nombre}.</p>`;

    const match = raiz.querySelector("#tgMatch");
    const par = parVisible();
    const hayPar = par.some((x) => x.g === estado.g);
    if (f && hayPar) {
      const ok = esDelPar(par, estado.g, f[0]);
      match.className = "tg__match " + (ok ? "is-ok" : "is-no");
      match.textContent = ok ? "✓ Este par es tu talla" : "Este par no viene en tu talla: escríbenos y te buscamos uno.";
    } else {
      match.className = "tg__match";
      match.textContent = "";
    }

    raiz.querySelector("#tgCaption").textContent = `${t.nombre} · ${GENEROS[estado.g]}`;
    raiz.querySelector("#tgFilas").innerHTML = lista.map((r, i) => {
      const delPar = esDelPar(par, estado.g, r[0]);
      const cls = [delPar && "es-par", i === estado.fila && "es-tuya"].filter(Boolean).join(" ");
      return `<tr data-i="${i}"${cls ? ` class="${cls}"` : ""}>${r.map((v, c) => `<td${c === k ? ' class="is-col"' : ""}>${c === 0 && delPar ? `<span class="tg__etq">Este par</span>` : ""}${fmtCelda(v, c)}</td>`).join("")}</tr>`;
    }).join("");
    raiz.querySelector("#tgNota").textContent = t.nota;

    const tuya = raiz.querySelector("tr.es-tuya") || raiz.querySelector("tr.es-par");
    // Centra la fila elegida dentro de la tabla (en celular la tabla no tiene scroll propio)
    if (tuya) requestAnimationFrame(() => {
      const wrap = raiz.querySelector(".tg__tabla-wrap");
      if (wrap.scrollHeight > wrap.clientHeight) wrap.scrollTop = tuya.offsetTop - wrap.clientHeight / 2 + tuya.offsetHeight / 2;
    });
  }

  function mensajeWa() {
    const f = filas()[estado.fila];
    const mia = f ? ` Uso talla US ${fmt(f[0])} ${GENEROS[estado.g].toLowerCase()} (EU ${fmt(f[2])}, ${fmt(f[3])} cm).` : "";
    return estado.producto
      ? `Hola M&M Store 👟 Tengo una duda de talla con el ${estado.producto}.${mia}`
      : `Hola M&M Store 👟 Necesito ayuda con mi talla.${mia}`;
  }

  function abrir(origen) {
    if (!raiz) construir();
    ultimoFoco = document.activeElement;
    const d = (origen && origen.dataset) || {};
    estado.tallas = leerTallas(d.tallas);
    estado.producto = d.producto || "";
    estado.marca = estado.marcaPar = marcaDe(d.marca || "");
    const pref = leerPref();
    const gs = new Set(estado.tallas.map((t) => t.g));
    estado.g = gs.size === 1 ? [...gs][0] : pref ? pref.g : "m";
    estado.region = pref && pref.g === estado.g ? pref.region : 0;
    reubicar();
    pintar();
    document.documentElement.classList.add("tg-abierta");
    requestAnimationFrame(() => raiz.querySelector(".tg__x").focus());
  }
  function cerrar() {
    document.documentElement.classList.remove("tg-abierta");
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  function atraparFoco(e) {
    if (e.key === "Escape") { e.stopPropagation(); cerrar(); return; }
    if (e.key !== "Tab") return;
    const focos = [...raiz.querySelectorAll("button, select, a[href]")].filter((el) => el.offsetParent);
    const [a, z] = [focos[0], focos[focos.length - 1]];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  // Resumen en la ficha: "US 8.5 Hombre → EU 42 · UK 7.5 · 26,5 cm"
  function resumen(el) {
    const tallas = leerTallas(el.dataset.tallas).filter((t) => t.min === t.max).slice(0, 4);
    const t = TABLAS[marcaDe(el.dataset.marca || "")];
    const caja = el.querySelector("[data-equivalencias]");
    if (!caja || !tallas.length) return;
    // "6 US Men · 7 US Women" es el mismo par: una sola línea si las equivalencias coinciden
    const lineas = new Map();
    for (const { g, min } of tallas) {
      const f = t[g].find((r) => r[0] === min);
      if (!f) continue;
      const eq = `EU ${fmt(f[2])} · UK ${fmt(f[1])} · ${fmt(f[3])} cm`;
      lineas.set(eq, (lineas.get(eq) || []).concat(`US ${fmt(min)} ${GENEROS[g]}`));
    }
    if (lineas.size) caja.innerHTML = [...lineas].map(([eq, us]) => `<li><strong>${us.join(" · ")}</strong><span>${eq}</span></li>`).join("");
  }

  document.querySelectorAll("[data-guia-resumen]").forEach(resumen);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-guia-tallas]");
    if (!b) return;
    e.preventDefault();
    abrir(b.closest("[data-tallas]") || b);
  });
})();
