// Genera las imágenes de vista previa de img/ con Playwright.
// Uso: python3 -m http.server 8000 &  node scripts/capturas.mjs [nombre…]
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000/";
const VISTAS = [
  { nombre: "euskadi", url: "index.html#8.35/43.02/-2.62" },
  { nombre: "bilbao", url: "index.html#15.2/43.2585/-2.9245" },
  { nombre: "donostia", url: "index.html#14.6/43.3175/-1.9840" },
  { nombre: "trevino", url: "index.html#10.9/42.7150/-2.7000" },
  { nombre: "3d-euskadi", url: "3d.html#8.7/42.93/-2.62/-12/55" },
  { nombre: "3d-bilbao", url: "3d.html#16.2/43.2645/-2.9370/35/62" },
  { nombre: "3d-anboto", url: "3d.html#12.6/43.1150/-2.6200/160/72" },
  { nombre: "tema-claro", url: "index.html#13.6/42.8470/-2.6730", tema: "claro" },
  { nombre: "calles-bilbao", url: "index.html#12.45/43.2530/-2.9330", extra: "&calles=bilbao&modo=arcoiris&base=0" },
  { nombre: "calles-donostia", url: "index.html#12/43.3/-1.98", extra: "&calles=donostia&modo=tipo" },
  { nombre: "tema-ikurrina", url: "3d.html#14.7/43.3195/-1.9850/-30/60", tema: "ikurrina" },
];

const solo = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
for (const v of VISTAS) {
  if (solo.length && !solo.includes(v.nombre)) continue;
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => console.error(v.nombre, e.message));
  await page.addInitScript(() => localStorage.clear());
  const [ruta, hash] = v.url.split("#");
  await page.goto(`${BASE}${ruta}?lang=ofi${v.tema ? "&tema=" + v.tema : ""}${v.extra || ""}#${hash}`);
  await page.waitForFunction(() => window.map && window.map.loaded() && window.map.areTilesLoaded(), null, { timeout: 180000 });
  await page.waitForTimeout(v.extra ? 9000 : 4000);
  await page.screenshot({ path: `img/${v.nombre}.png` });
  console.log("img/" + v.nombre + ".png");
  await page.close();
}
await browser.close();
