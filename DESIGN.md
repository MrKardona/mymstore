# DESIGN.md — Sistema de diseño M&M Store

## Color (tokens en assets/css/style.css)
| Token | Valor | Uso |
|---|---|---|
| `--ink` | #0b1420 | Fondo base (navy tinta, nunca negro puro) |
| `--ink-2` | #101c2e | Superficies elevadas (cards, drawer, nav) |
| `--ink-3` | #16253c | Superficie terciaria, hovers |
| `--blue` | #36a9e1 | Azul eléctrico del logo; links, chips activos, acentos |
| `--blue-soft` | #7cc6ea | Azul suave para metadatos y marcas |
| `--orange` | #f58220 | Naranja del logo; CTAs, badges, acento principal |
| `--orange-hot` | #ff6a1a | Extremo cálido de gradientes de CTA |
| `--cream` | #f6f2ea | Texto principal (crema, nunca blanco puro) |
| `--cream-dim` | #c9c3b8 | Texto secundario |
| `--line` | rgba(246,242,234,.12) | Bordes de 1px |
| `--ok` | #3ddc84 | Estado disponible/en stock |

Estrategia: "committed" — navy domina, naranja carga los CTAs, azul acompaña.
`color-scheme: dark` fijo: el modo claro/oscuro del sistema no altera la paleta.

## Tipografía
- Display: **Anton** (Google Fonts) — titulares monumentales, uppercase,
  `letter-spacing: -0.015em`, `line-height: 0.88–0.95`.
- Cuerpo/UI: **Archivo** 400–900.
- Acento de marca: **Rubik Wet Paint** solo para el eslogan (estilo graffiti).
- Escala: hero `clamp(3.4rem, 12.5vw, 11.5rem)`; títulos de sección
  `clamp(2.4rem, 7vw, 5.6rem)`; cuerpo 16–17px.

## Espaciado y layout
- Secciones: `padding clamp(70px, 10vw, 140px)`; contenedor max 1380px.
- Composición asimétrica: hero alineado a la izquierda, números de sección
  gigantes delineados (01–04), título del catálogo alineado a la derecha.
- Grid de productos: `auto-fill minmax(250px, 1fr)` (160px en móvil).
- Radios: 14px (cards 18px, drops 20px, pills 999px).

## Imágenes de producto
- Fuente: upscales 2K (Higgsfield/bytedance) recortadas de bordes blancos y
  re-encuadradas centradas en lienzo cuadrado 900×900 blanco (margen uniforme).
- Entrega: WebP q82 (900px) + thumbs 450px; siempre `object-fit: contain`.
- Pipeline: `scratchpad/imgtool/retrim.js` (sharp).

## Motion
- Smooth scroll: Lenis (lerp 0.1), desactivado con `prefers-reduced-motion`.
- Easing global: `cubic-bezier(0.16, 1, 0.3, 1)` y variantes expo-out. Nunca
  `ease`/`linear`.
- Reveals: IntersectionObserver + clase `.in-view`, stagger con `--i`.
- Firma: coreografía de entrada del hero (3 líneas), botones magnéticos
  (pointer fine), parallax suave en flotantes, barra de progreso de scroll.

## Iconografía
- SVG inline stroke 2 (check, rayo, caja, sneaker, carrito, lupa, WhatsApp).
- Prohibido: emojis en la interfaz (solo en mensajes prellenados de WhatsApp).

## Componentes clave
- `.btn--fire` (CTA naranja), `.btn--wa` (verde WhatsApp), `.btn--ghost`.
- `.card` producto, `.drop` editorial (el primero ocupa 2 columnas).
- Drawer de carrito (localStorage `mym_cart_v1`), FABs flotantes, topbar de
  urgencia, toast.
- Checkout: mensaje de pedido armado → `wa.me/<STORE.whatsapp>` (número en
  `assets/js/store.js`).
