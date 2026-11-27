/* ============================================================
   Promoción vigente de M&M Store
   El descuento es REAL: se calcula sobre el precio publicado de cada
   producto (el que se ve tachado). Para apagarla: activa: false.
   Las fechas usan la hora de Colombia (-05:00); fuera de ellas la
   tienda vuelve sola a los precios normales.
   "tramos" cambia el % en días puntuales; fuera de un tramo rige pct.
   ============================================================ */
const PROMO = {
  activa: true,
  nombre: "Black Friday",
  pct: 10,
  desde: "2026-11-18T00:00:00-05:00",
  hasta: "2026-11-30T23:59:59-05:00",
  tramos: [
    { pct: 20, etiqueta: "Solo hoy", desde: "2026-11-27T00:00:00-05:00", hasta: "2026-11-27T23:59:59-05:00" },
  ],
};

function promoVigente(ahora = Date.now()) {
  return !!PROMO.activa && ahora >= Date.parse(PROMO.desde) && ahora <= Date.parse(PROMO.hasta);
}
function tramoVigente(ahora = Date.now()) {
  if (!promoVigente(ahora)) return null;
  return (PROMO.tramos || []).find((t) => ahora >= Date.parse(t.desde) && ahora <= Date.parse(t.hasta)) || null;
}
// % que rige en este momento (0 si no hay promo)
function pctVigente(ahora = Date.now()) {
  if (!promoVigente(ahora)) return 0;
  const t = tramoVigente(ahora);
  return t ? t.pct : PROMO.pct;
}
// Precio con descuento, redondeado hacia abajo a la centena (nunca cobra más del % prometido)
function precioPromo(precio, pct = pctVigente()) {
  return Math.floor((precio * (100 - pct)) / 100 / 100) * 100;
}

// En el navegador: marca la página y pinta el % y los precios que rigen ahora mismo
if (typeof document !== "undefined" && promoVigente()) {
  document.documentElement.classList.add("promo-on");
  document.addEventListener("DOMContentLoaded", () => {
    const pct = pctVigente();
    const tramo = tramoVigente();
    const cop = (n) => "$" + n.toLocaleString("es-CO");
    const dia = (f) => new Date(f).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });

    const bar = document.querySelector(".topbar");
    // Un solo bloque de texto: la barra es flex y si no partiría cada pedazo en su propia línea
    if (bar) bar.innerHTML = tramo
      ? `<span><strong>${PROMO.nombre.toUpperCase()} · ${tramo.etiqueta.toUpperCase()} ${pct}% OFF</strong> EN TODA LA TIENDA · MAÑANA VUELVE AL ${PROMO.pct}%</span>`
      : `<span><strong>${PROMO.nombre.toUpperCase()}</strong> · ${pct}% OFF EN TODA LA TIENDA · HASTA EL ${dia(PROMO.hasta).toUpperCase()}</span>`;

    document.querySelectorAll("[data-promo-pct]").forEach((el) => { el.textContent = pct; });
    document.querySelectorAll("[data-precio-base]").forEach((el) => { el.textContent = cop(precioPromo(+el.dataset.precioBase, pct)); });
    const kicker = document.querySelector("[data-bf-kicker]");
    if (kicker && tramo) kicker.textContent = `${tramo.etiqueta}: ${pct}% en todo`;

    const fecha = document.querySelector("[data-bf-fecha]");
    if (fecha) {
      const dias = Math.ceil((Date.parse(PROMO.hasta) - Date.now()) / 86400000);
      fecha.textContent = tramo
        ? `${tramo.etiqueta} hasta las 11:59 p. m. · después sigue el ${PROMO.pct}% hasta el ${dia(PROMO.hasta)}`
        : `Hasta el ${dia(PROMO.hasta)}` + (dias <= 1 ? " · ¡último día!" : ` · quedan ${dias} días`);
    }
    // Mensajes de WhatsApp de la página de producto: plantilla con {precio} y {pct}
    document.querySelectorAll("[data-wa-promo]").forEach((el) => {
      el.dataset.wa = el.dataset.waPromo
        .replace("{pct}", pct)
        .replace("{precio}", el.dataset.precioWa ? cop(precioPromo(+el.dataset.precioWa, pct)) : "");
    });
  });
}
if (typeof module !== "undefined") module.exports = { PROMO, promoVigente, tramoVigente, pctVigente, precioPromo };
