// Chunked shot capture for constrained sandboxes (<=45s per invocation).
// Serves the static export in-process, captures the requested shots, exits.
// Usage:
//   node scripts/capture-shots-chunk.mjs --out-dir .playwright-artifacts/baseline \
//     "name=kv-settled&search=?alcheSection=kv&alcheIntro=1&alcheCapture=1" ...
// Each positional arg is `name=<file>&search=<query>` where <query> is the raw
// top-page query string (may itself contain & and ?).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { chromium } from "playwright";

const root = process.cwd();
const exportDir = path.join(root, "out");
const basePath = "/CVWebsite";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
};

function parseArgs(argv) {
  const shots = [];
  let outDir = path.join(root, ".playwright-artifacts", "baseline");
  let viewportWidth = 1600;
  let viewportHeight = 842;
  let settleMs = 900;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir") {
      outDir = path.resolve(root, argv[i + 1]);
      i += 1;
    } else if (arg === "--viewport") {
      const [w, h] = argv[i + 1].split("x").map(Number);
      viewportWidth = w;
      viewportHeight = h;
      i += 1;
    } else if (arg === "--settle-ms") {
      settleMs = Number(argv[i + 1]);
      i += 1;
    } else {
      const nameMatch = arg.match(/^name=([^&]+)&search=(.*)$/s);
      if (!nameMatch) {
        console.error(`Skipping malformed shot arg: ${arg}`);
        continue;
      }
      shots.push({ name: nameMatch[1], search: nameMatch[2] });
    }
  }

  return { shots, outDir, viewportWidth, viewportHeight, settleMs };
}

function createStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
        if (pathname === "" || pathname === "/") pathname = "/index.html";
        let filePath = path.join(exportDir, pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
        if (!fs.existsSync(filePath)) {
          const htmlFallback = `${filePath}.html`;
          if (fs.existsSync(htmlFallback)) {
            filePath = htmlFallback;
          } else {
            res.writeHead(404);
            res.end("not found");
            return;
          }
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "content-type": contentTypes[ext] ?? "application/octet-stream" });
        fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        res.writeHead(500);
        res.end(String(error));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(server);
    });
  });
}

async function main() {
  const { shots, outDir, viewportWidth, viewportHeight, settleMs } = parseArgs(process.argv.slice(2));
  if (shots.length === 0) {
    console.error("No shots requested.");
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createStaticServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}${basePath}`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"],
  });

  const failures = [];
  try {
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const shot of shots) {
      const target = `${baseUrl}/en/${shot.search}`;
      try {
        await page.goto(target, { waitUntil: "networkidle", timeout: 25000 });
        await page.waitForFunction(() => typeof window.__getAlcheLayerDebugState === "function", undefined, {
          timeout: 15000,
        });
        await page.waitForTimeout(settleMs);
        await page.screenshot({ path: path.join(outDir, `${shot.name}.png`) });
        console.log(`captured ${shot.name}`);
      } catch (error) {
        failures.push({ name: shot.name, error: String(error) });
        console.error(`FAILED ${shot.name}: ${error}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
