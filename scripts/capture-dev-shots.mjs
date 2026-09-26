// Capture named/debug shot URLs from a running dev server (or any base URL).
// Usage:
//   node scripts/capture-dev-shots.mjs --base http://localhost:3000/CVWebsite/en/ \
//     --out-dir .playwright-artifacts/dev-shots --viewport 1600x842 \
//     "cards-settled=?alcheShot=cards-settled" "kv=?alcheSection=kv&alcheIntro=1"
// Each positional arg is `<name>=<query string>`.

import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const argv = process.argv.slice(2);
let base = "http://localhost:3000/CVWebsite/en/";
let outDir = ".playwright-artifacts/dev-shots";
let width = 1600;
let height = 842;
let settleMs = 2500;
const shots = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--base") base = argv[++i];
  else if (arg === "--out-dir") outDir = argv[++i];
  else if (arg === "--viewport") [width, height] = argv[++i].split("x").map(Number);
  else if (arg === "--settle-ms") settleMs = Number(argv[++i]);
  else {
    const eq = arg.indexOf("=");
    shots.push({ name: arg.slice(0, eq), query: arg.slice(eq + 1) });
  }
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox", "--ignore-gpu-blocklist"],
});
try {
  const context = await browser.newContext({ viewport: { width, height }, locale: "en-US", reducedMotion: "no-preference" });
  for (const shot of shots) {
    const page = await context.newPage();
    const joiner = shot.query.startsWith("?") ? "" : "?";
    const url = `${base}${joiner}${shot.query}${shot.query.includes("alcheHideDebugUi") ? "" : "&alcheHideDebugUi=1"}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("canvas", { state: "attached", timeout: 90000 });
    await page.waitForTimeout(settleMs);
    const debug = await page.evaluate(() => {
      const layer = window.__getAlcheLayerDebugState?.() ?? null;
      if (!layer) return null;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const card = (i) => {
        const l = layer[`card${i}ScreenLeft`];
        const r = layer[`card${i}ScreenRight`];
        const t = layer[`card${i}ScreenTop`];
        const b = layer[`card${i}ScreenBottom`];
        if (l == null) return null;
        // bounds are reported in px; express as viewport ratios
        return { l: +(l / w).toFixed(3), r: +(r / w).toFixed(3), t: +(t / h).toFixed(3), b: +(b / h).toFixed(3) };
      };
      return { section: layer.sceneActiveSection ?? null, card0: card(0), card1: card(1) };
    });
    await page.screenshot({ path: path.join(outDir, `${shot.name}.png`) });
    console.log(shot.name, JSON.stringify(debug));
    await page.close();
  }
} finally {
  await browser.close();
}
