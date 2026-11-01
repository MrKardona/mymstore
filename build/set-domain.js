// Cambia el dominio del sitio en un solo paso.
// Uso: node build/set-domain.js https://mimstore.com
// Hace: actualiza site.config.json, reemplaza las URLs absolutas en index.html,
// crea el archivo CNAME para GitHub Pages y reconstruye las páginas de producto.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const nueva = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(nueva)) {
  console.error("Uso: node build/set-domain.js https://tudominio.com");
  process.exit(1);
}

const cfgPath = path.join(ROOT, "site.config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const vieja = cfg.url.replace(/\/+$/, "");

// 1) config
cfg.url = nueva;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

// 2) URLs absolutas (canonical, og, JSON-LD y sitemap de robots)
for (const nombre of ["index.html", "robots.txt"]) {
  const f = path.join(ROOT, nombre);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").split(vieja).join(nueva));
}

// El enlace de 404.html es absoluto: debe apuntar a la ruta base del sitio nuevo
const f404 = path.join(ROOT, "404.html");
const baseVieja = new URL(vieja).pathname.replace(/\/*$/, "/");
const baseNueva = new URL(nueva).pathname.replace(/\/*$/, "/");
fs.writeFileSync(f404, fs.readFileSync(f404, "utf8").split(`href="${baseVieja}"`).join(`href="${baseNueva}"`));

// 3) CNAME para GitHub Pages (solo el host)
fs.writeFileSync(path.join(ROOT, "CNAME"), new URL(nueva).host + "\n");

// 4) reconstruir páginas de producto y sitemap con el dominio nuevo
execSync("node " + path.join(__dirname, "build-products.js"), { stdio: "inherit" });

console.log(`Dominio cambiado: ${vieja} -> ${nueva}`);
console.log("Falta: en GitHub > Settings > Pages poner el dominio y activar HTTPS,");
console.log("y en el proveedor del dominio apuntar el DNS a GitHub Pages.");
