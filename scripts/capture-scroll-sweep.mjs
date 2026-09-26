// Free-scroll sweep capture for comparing scroll dynamics against the
// reference video contact sheets.
// Usage:
//   node scripts/capture-scroll-sweep.mjs --url https://moonflowflower.github.io/CVWebsite/en/ \
//     --out-dir .playwright-artifacts/sweep-remote --frames 32 [--viewport 1600x1002] [--settle-ms 900]
// Frames are evenly spaced over the document scroll range and written as
// frame-XX.png plus frames.json (scrollY + active section per frame).

import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    url: "http://localhost:3000/CVWebsite/en/",
    outDir: ".playwright-artifacts/sweep",
    frames: 32,
    width: 1600,
    height: 1002,
    settleMs: 900,
    from: 0,
    to: 1,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url") options.url = next;
    else if (arg === "--out-dir") options.outDir = next;
    else if (arg === "--frames") options.frames = Number(next);
    else if (arg === "--settle-ms") options.settleMs = Number(next);
    else if (arg === "--from") options.from = Number(next);
    else if (arg === "--to") options.to = Number(next);
    else if (arg === "--viewport") [options.width, options.height] = next.split("x").map(Number);
    else continue;
    i += 1;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const outDir = path.resolve(process.cwd(), options.outDir);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox", "--ignore-gpu-blocklist"],
});

try {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    locale: "en-US",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const separator = options.url.includes("?") ? "&" : "?";
  await page.goto(`${options.url}${separator}alcheHideDebugUi=1`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page
    .waitForFunction(() => window.__getAlcheLayerDebugState?.()?.activeSection && window.__getAlcheLayerDebugState().activeSection !== "loading", null, {
      timeout: 60000,
    })
    .catch(() => console.warn("activeSection never left loading; continuing"));
  await page.waitForTimeout(2500);

  const scrollMax = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const records = [];
  for (let index = 0; index < options.frames; index += 1) {
    const t = options.frames === 1 ? options.from : options.from + ((options.to - options.from) * index) / (options.frames - 1);
    const targetY = Math.round(scrollMax * t);
    await page.evaluate((y) => window.scrollTo(0, y), targetY);
    await page.waitForTimeout(options.settleMs);
    const state = await page.evaluate(() => {
      const layer = window.__getAlcheLayerDebugState?.() ?? null;
      return { scrollY: window.scrollY, section: layer?.activeSection ?? null };
    });
    const file = `frame-${String(index).padStart(2, "0")}.png`;
    await page.screenshot({ path: path.join(outDir, file) });
    records.push({ file, t: Number(t.toFixed(4)), ...state });
    console.log(`${file} t=${t.toFixed(3)} y=${state.scrollY} section=${state.section}`);
  }
  fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify({ url: options.url, scrollMax, records }, null, 2));
} finally {
  await browser.close();
}
