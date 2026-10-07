// Genera las imágenes de vista previa de img/ con Playwright.
// Uso: python3 -m http.server 8000 &  node scripts/capturas.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000/";
const VISTAS = [
  { nombre: "euskadi", hash: "8.35/43.02/-2.62", ancho: 1600, alto: 1000 },
  { nombre: "bilbao", hash: "15.2/43.2585/-2.9245", ancho: 1600, alto: 1000 },
  { nombre: "donostia", hash: "14.6/43.3175/-1.9840", ancho: 1600, alto: 1000 },
  { nombre: "trevino", hash: "10.9/42.7150/-2.7000", ancho: 1600, alto: 1000 },
];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
for (const v of VISTAS) {
  const page = await browser.newPage({ viewport: { width: v.ancho, height: v.alto } });
  page.on("pageerror", (e) => console.error(v.nombre, e.message));
  await page.goto(`${BASE}?lang=ofi#${v.hash}`);
  await page.waitForFunction(() => window.map && window.map.loaded() && window.map.areTilesLoaded(), null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `img/${v.nombre}.png` });
  console.log("img/" + v.nombre + ".png");
  await page.close();
}
await browser.close();
