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

// 2) URLs absolutas en index.html (canonical, og, JSON-LD)
const idx = path.join(ROOT, "index.html");
fs.writeFileSync(idx, fs.readFileSync(idx, "utf8").split(vieja).join(nueva));

// 3) CNAME para GitHub Pages (solo el host)
fs.writeFileSync(path.join(ROOT, "CNAME"), new URL(nueva).host + "\n");

// 4) reconstruir páginas de producto y sitemap con el dominio nuevo
execSync("node " + path.join(__dirname, "build-products.js"), { stdio: "inherit" });

console.log(`Dominio cambiado: ${vieja} -> ${nueva}`);
console.log("Falta: en GitHub > Settings > Pages poner el dominio y activar HTTPS,");
console.log("y en el proveedor del dominio apuntar el DNS a GitHub Pages.");
