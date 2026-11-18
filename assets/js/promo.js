/* ============================================================
   Promoción vigente de M&M Store
   El descuento es REAL: se calcula sobre el precio publicado de cada
   producto (el que se ve tachado). Para apagarla: activa: false.
   Las fechas usan la hora de Colombia (-05:00); fuera de ellas la
   tienda vuelve sola a los precios normales.
   ============================================================ */
const PROMO = {
  activa: true,
  nombre: "Black Friday",
  pct: 10,
  desde: "2026-11-18T00:00:00-05:00",
  hasta: "2026-11-30T23:59:59-05:00",
};

function promoVigente(ahora = Date.now()) {
  return !!PROMO.activa && ahora >= Date.parse(PROMO.desde) && ahora <= Date.parse(PROMO.hasta);
}
// Precio con descuento, redondeado hacia abajo a la centena (nunca cobra más del % prometido)
function precioPromo(precio) {
  return Math.floor((precio * (100 - PROMO.pct)) / 100 / 100) * 100;
}

// En el navegador: marca la página para mostrar precios y avisos de la promo
if (typeof document !== "undefined" && promoVigente()) {
  document.documentElement.classList.add("promo-on");
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.querySelector(".topbar");
    // Un solo bloque de texto: la barra es flex y si no partiría cada pedazo en su propia línea
    if (bar) bar.innerHTML = `<span><strong>${PROMO.nombre.toUpperCase()}</strong> · ${PROMO.pct}% OFF EN TODA LA TIENDA · HASTA EL ${new Date(PROMO.hasta).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).toUpperCase()}</span>`;
    const fecha = document.querySelector("[data-bf-fecha]");
    if (fecha) {
      const dias = Math.ceil((Date.parse(PROMO.hasta) - Date.now()) / 86400000);
      const hasta = new Date(PROMO.hasta).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });
      fecha.textContent = `Hasta el ${hasta}` + (dias <= 1 ? " · ¡último día!" : ` · quedan ${dias} días`);
    }
    // Mensajes de WhatsApp con el precio de la promo (los genera la página de producto)
    document.querySelectorAll("[data-wa-promo]").forEach((el) => { el.dataset.wa = el.dataset.waPromo; });
  });
}
if (typeof module !== "undefined") module.exports = { PROMO, promoVigente, precioPromo };
