import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, devices } from "playwright";
import { generateAlcheReferenceFrames } from "./generate-alche-reference-frames.mjs";

const root = process.cwd();
const exportDir = path.join(root, "out");
const outputDir = path.join(root, ".playwright-artifacts", "alche-top-page");
const basePath = "/CVWebsite";
const preferredPort = Number(process.env.ALCHE_PLAYWRIGHT_PORT ?? "3000");
let baseUrl = `http://127.0.0.1:${preferredPort}/CVWebsite`;
const cliArgs = new Set(process.argv.slice(2));
const cardsOnlyMode = cliArgs.has("--cards-only");
const visionCoverLiveOnlyMode = cliArgs.has("--vision-cover-live-only");
const endmarkLiveOnlyMode = cliArgs.has("--endmark-live-only");
const worksOutroLiveOnlyMode = cliArgs.has("--works-outro-live-only");
const ultraWideViewport = { width: 2000, height: 1080 };
const worksOutroEdgeViewport = { width: 2048, height: 1152 };

fs.mkdirSync(outputDir, { recursive: true });

const worksShotbook = JSON.parse(fs.readFileSync(path.join(root, "data", "alche-works-shotbook.json"), "utf8"));
const worksShotNames = worksShotbook.shots.map((shot) => shot.id);

function withIdentityCardDebug(search) {
  return search.includes("alcheCardDebug=") ? search : `${search}${search.includes("?") ? "&" : "?"}alcheCardDebug=identity`;
}

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
};

const expectedSections = ["kv", "works_intro", "works", "works_cards", "works_outro", "mission_in", "outro"];

const fixedStateShots = [
  { name: "loading-settled", search: withIdentityCardDebug("?alcheSection=loading&alcheIntro=0.4&alcheCapture=1") },
  { name: "kv-settled", search: withIdentityCardDebug("?alcheSection=kv&alcheIntro=1&alcheCapture=1") },
  { name: "works-intro-enter-early", search: withIdentityCardDebug("?alcheSection=works_intro&alcheProgress=0.62&alcheIntro=1&alcheCapture=1") },
  { name: "works-intro-settle", search: withIdentityCardDebug("?alcheSection=works_intro&alcheProgress=0.92&alcheIntro=1&alcheCapture=1") },
  { name: "works-hold", search: withIdentityCardDebug("?alcheSection=works&alcheProgress=0.22&alcheIntro=1&alcheCapture=1") },
  ...worksShotbook.shots.map((shot) => ({
    name: shot.id,
    search: withIdentityCardDebug(`?alcheShot=${shot.id}&alcheCapture=1`),
    override: {
      shotId: shot.id,
      section: shot.section,
      progress: shot.progress,
      intro: shot.intro,
      heroShotId: null,
    },
  })),
  {
    name: "works-outro-unroll-early",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.32&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-curvature-early",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.28&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-unroll-mid",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.44&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-curvature-mid",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.48&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-unroll-late",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.56&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-curvature-late",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.68&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "works-outro-prism-bridge",
    search: withIdentityCardDebug("?alcheSection=works_outro&alcheProgress=0.78&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "mission-in-prism-bridge-early",
    search: withIdentityCardDebug("?alcheSection=mission_in&alcheProgress=0.08&alcheIntro=1&alcheCapture=1"),
  },
  {
    name: "mission-turn-mid",
    search: withIdentityCardDebug("?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=0.5&alcheCapture=1"),
  },
  {
    name: "mission-turn-side",
    search: withIdentityCardDebug("?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheCapture=1"),
  },
  {
    name: "vision-cover-mid",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=0.5&alcheCapture=1",
    ),
  },
  {
    name: "vision-cover-black-mid",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=0.75&alcheCapture=1",
    ),
  },
  {
    name: "vision-cover-full",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheCapture=1",
    ),
  },
  {
    name: "endmark-black",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=black&alcheCapture=1",
    ),
  },
  {
    name: "endmark-guides",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=guides&alcheCapture=1",
    ),
  },
  {
    name: "endmark-outline",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=outline&alcheCapture=1",
    ),
  },
  {
    name: "endmark-fill",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=fill&alcheCapture=1",
    ),
  },
  {
    name: "endmark-settled",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=settled&alcheCapture=1",
    ),
  },
  {
    name: "endmark-footer-settled",
    endmarkStage: "settled",
    search: withIdentityCardDebug(
      "?alcheSection=mission_in&alcheProgress=1&alcheMissionTurnProgress=1&alcheVisionCoverProgress=1&alcheEndmarkStage=settled&alcheEndmarkFooterProgress=1&alcheCapture=1",
    ),
  },
];

const referenceBoardShots = worksShotNames;
const cardsOnlyShotNames = new Set(referenceBoardShots);
const activeFixedStateShots = cardsOnlyMode
  ? fixedStateShots.filter((shot) => cardsOnlyShotNames.has(shot.name))
  : fixedStateShots;

const pointerInteractionShots = [
  { name: "kv-pointer-left-real", move: { x: 280, y: 240 } },
  { name: "kv-pointer-right-real", move: { x: 1160, y: 780 } },
];

const kvLockedCamera = {
  position: [0.02, 0.08, 5.38],
  target: [0.04, 0.02, -1.02],
};
const expectedWallWorldZ = -5;
const expectedWorksWorldZ = -4.9;
const expectedWorksWorldX = {
  "works-intro-enter-early": { min: -2.0, max: -1.4 },
  "works-intro-settle": { min: -0.35, max: 0.35 },
  "works-hold": { min: -0.2, max: 0.45 },
  "works-out": { min: 1.5, max: 2.25 },
};
const expectedHandoff = {
  "works-intro-enter-early": { min: 0.24, max: 0.32 },
  "works-intro-settle": { min: 0.38, max: 0.45 },
  "works-hold": { min: 0.5, max: 0.65 },
  "works-out": { min: 0.92, max: 1.0 },
  ...Object.fromEntries(worksShotNames.filter((shotName) => shotName !== "works-out").map((shotName) => [shotName, { min: 0.99, max: 1.01 }])),
};
// worksOpacity is the final WORKS material alpha (fillOpacity x target). The
// 2026-09-26 reference pass dimmed fillOpacity 0.9 -> 0.28 (linear alpha; the
// old value read near-white) and the card-phase ghost to ~0.025, so these
// ranges are the previous ones scaled by ~0.31.
const expectedShotStates = {
  "works-intro-enter-early": {
    mode: "hidden",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.035, max: 0.11 },
    cardsOpacity: { max: 0.04 },
    moonflowOpacity: { min: 0.12, max: 0.5 },
  },
  "works-intro-settle": {
    mode: "hidden",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.22, max: 0.3 },
    cardsOpacity: { max: 0.04 },
    moonflowOpacity: { max: 0.08 },
  },
  "works-hold": {
    mode: "hidden",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.21, max: 0.3 },
    cardsOpacity: { max: 0.04 },
    moonflowOpacity: { max: 0.08 },
  },
  "works-out": {
    mode: "hidden",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { max: 0.025 },
    cardsOpacity: { max: 0.04 },
    moonflowOpacity: { max: 0.02 },
  },
  "cards-a-entry": {
    mode: "single-card-state",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.012, max: 0.05 },
    cardsOpacity: { min: 0.98, max: 1.01 },
    moonflowOpacity: { max: 0.02 },
    cardsLeadIndex: 0,
    card0Visible: true,
    card1Visible: false,
    card0Opacity: { min: 0.98, max: 1.01 },
  },
  "cards-a-center": {
    mode: "single-card-state",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.012, max: 0.05 },
    cardsOpacity: { min: 0.98, max: 1.01 },
    moonflowOpacity: { max: 0.02 },
    cardsLeadIndex: 0,
    card0Visible: true,
    card1Visible: false,
    card0Opacity: { min: 0.98, max: 1.01 },
  },
  "cards-b-queue": {
    mode: "dual-card-state",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.012, max: 0.05 },
    cardsOpacity: { min: 0.98, max: 1.01 },
    moonflowOpacity: { max: 0.02 },
    cardsLeadIndex: 0,
    card0Visible: true,
    card1Visible: true,
    card0Opacity: { min: 0.98, max: 1.01 },
    card1Opacity: { min: 0.98, max: 1.01 },
  },
  "cards-handoff-mid": {
    mode: "dual-card-state",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.012, max: 0.05 },
    cardsOpacity: { min: 0.98, max: 1.01 },
    moonflowOpacity: { max: 0.02 },
    card0Visible: true,
    card1Visible: true,
    card0Opacity: { min: 0.98, max: 1.01 },
    card1Opacity: { min: 0.98, max: 1.01 },
  },
  "cards-settled": {
    mode: "dual-card-state",
    camera: kvLockedCamera,
    cameraTolerance: 0.08,
    worksOpacity: { min: 0.012, max: 0.05 },
    cardsOpacity: { min: 0.98, max: 1.01 },
    moonflowOpacity: { max: 0.02 },
    cardsLeadIndex: 1,
    card0Visible: true,
    card1Visible: true,
    card0Opacity: { min: 0.98, max: 1.01 },
    card1Opacity: { min: 0.98, max: 1.01 },
    card0MayBeOffscreenLeft: true,
  },
};

const laneTargets = {
  leadCenter: {
    centerXRatio: { min: 0.36, max: 0.6 },
    // Reference stage8 lead card centre sits at ~0.50 of viewport height.
    centerYRatio: { min: 0.3, max: 0.58 },
    widthRatio: { min: 0.43, max: 0.7 },
  },
  supportLeft: {
    centerYRatio: { min: 0.17, max: 0.4 },
    screenLeftRatio: { min: 0, max: 0.02 },
    screenRightRatio: { min: 0.2, max: 0.36 },
    widthRatio: { min: 0.18, max: 0.28 },
  },
  queueRight: {
    centerYRatio: { min: 0.46, max: 0.72 },
    screenLeftRatio: { min: 0.73, max: 0.9 },
    screenRightRatio: { min: 0.98, max: 1 },
    widthRatio: { min: 0.18, max: 0.3 },
  },
};

function resolveRequestPath(requestPath) {
  const normalizedPath = requestPath === "/" ? basePath : requestPath;

  if (!normalizedPath.startsWith(basePath)) {
    return null;
  }

  const relativePath = normalizedPath.slice(basePath.length) || "/";
  const cleanPath = decodeURIComponent(relativePath).replace(/^\/+/, "");
  const candidate = path.join(exportDir, cleanPath);

  const relativeFromExport = path.relative(exportDir, candidate);
  if (relativeFromExport.startsWith("..") || path.isAbsolute(relativeFromExport)) {
    return null;
  }

  return candidate;
}

async function readRequestFile(requestPath) {
  const candidate = resolveRequestPath(requestPath);
  if (!candidate) return null;

  const candidates = requestPath.endsWith("/")
    ? [path.join(candidate, "index.html")]
    : [candidate, `${candidate}.html`, path.join(candidate, "index.html")];

  for (const filePath of candidates) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) return filePath;
    } catch {}
  }

  return null;
}

async function createStaticServer(port) {
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const filePath = await readRequestFile(requestUrl.pathname);

    if (!filePath) {
      const fallback404 = path.join(exportDir, "404.html");
      if (fs.existsSync(fallback404)) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end(await fs.promises.readFile(fallback404));
        return;
      }

      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(await fs.promises.readFile(filePath));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return server;
}

async function waitForServer(url, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}

    await delay(250);
  }

  throw new Error(`Server did not become ready: ${url}`);
}

async function expectNoHorizontalOverflow(page, scenarioName) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - window.innerWidth;
  });

  assert(overflow <= 1, `Horizontal overflow detected for ${scenarioName}: ${overflow}px`);
}

async function assertRightBandBlackRatio(page, screenshotBuffer, label, maxRatio = 0.03) {
  const ratio = await page.evaluate(
    async ({ source, region }) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return 1;

      context.drawImage(image, 0, 0);
      const x = Math.floor(canvas.width * region.xRatio);
      const y = Math.floor(canvas.height * region.yRatio);
      const width = Math.max(1, Math.floor(canvas.width * region.widthRatio));
      const height = Math.max(1, Math.floor(canvas.height * region.heightRatio));
      const pixels = context.getImageData(x, y, width, height).data;
      // A real unroll gap exposes the bare #000 clear colour as solid empty
      // columns. The dark LED wall is also mostly < 22/255 but every column
      // carries structure (grid lines, dots, markers), so count empty
      // columns rather than dark pixels.
      let emptyColumns = 0;
      for (let column = 0; column < width; column += 1) {
        let emptyPixels = 0;
        for (let row = 0; row < height; row += 1) {
          const index = (row * width + column) * 4;
          if (pixels[index + 3] > 180 && Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) < 6 /* bare clear colour; dim wall edges peak >= 6 */) {
            emptyPixels += 1;
          }
        }
        if (emptyPixels / height >= 0.98) emptyColumns += 1;
      }

      return emptyColumns / width;
    },
    {
      source: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
      region: {
        xRatio: 0.92,
        yRatio: 0.12,
        widthRatio: 0.07,
        heightRatio: 0.76,
      },
    },
  );

  assert(ratio <= maxRatio, `Expected ${label} right edge empty-column ratio <= ${maxRatio}, got ${ratio.toFixed(4)}.`);
  return ratio;
}

async function assertWallContinuity(page, screenshotBuffer, label) {
  const stats = await page.evaluate(
    async ({ source, regions }) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [];

      context.drawImage(image, 0, 0);
      return regions.map((region) => {
        const x = Math.floor(canvas.width * region.xRatio);
        const y = Math.floor(canvas.height * region.yRatio);
        const width = Math.max(1, Math.floor(canvas.width * region.widthRatio));
        const height = Math.max(1, Math.floor(canvas.height * region.heightRatio));
        const pixels = context.getImageData(x, y, width, height).data;
        const totalPixels = width * height;
        let lumaSum = 0;
        let lumaSqSum = 0;
        let lumaCount = 0;
        let emptyColumns = 0;

        for (let column = 0; column < width; column += 1) {
          let emptyPixels = 0;
          for (let row = 0; row < height; row += 1) {
            const index = (row * width + column) * 4;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
            // Seams/shadows are dark contrast. Near-white specular pixels (the
            // ice crystal's rim highlights crossing the sample) are excluded.
            if (luma <= 200) {
              lumaSum += luma;
              lumaSqSum += luma * luma;
              lumaCount += 1;
            }
            if (pixels[index + 3] > 180 && Math.max(red, green, blue) < 6 /* bare clear colour; dim wall edges peak >= 6 */) emptyPixels += 1;
          }
          if (emptyPixels / height >= 0.98) emptyColumns += 1;
        }

        const lumaMean = lumaSum / Math.max(lumaCount, 1);
        const variance = Math.max(0, lumaSqSum / Math.max(lumaCount, 1) - lumaMean * lumaMean);
        return {
          name: region.name,
          emptyColumnRatio: emptyColumns / width,
          lumaMean,
          lumaStdDev: Math.sqrt(variance),
        };
      });
    },
    {
      source: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
      regions: [
        { name: "upper-center", xRatio: 0.46, yRatio: 0.04, widthRatio: 0.08, heightRatio: 0.16 },
        { name: "left-upper-sidewall", xRatio: 0.12, yRatio: 0.06, widthRatio: 0.1, heightRatio: 0.42 },
        { name: "right-upper-sidewall", xRatio: 0.78, yRatio: 0.06, widthRatio: 0.1, heightRatio: 0.42 },
        { name: "right-center", xRatio: 0.76, yRatio: 0.34, widthRatio: 0.16, heightRatio: 0.2 },
        { name: "lower-right", xRatio: 0.78, yRatio: 0.68, widthRatio: 0.14, heightRatio: 0.2 },
      ],
    },
  );

  // Wall continuity for both art directions: the works_outro wall is the dark
  // LED wall (07-13 pass) and only whitens toward mission. A hole exposes the
  // bare #000 clear colour as solid empty columns; the real dark wall keeps
  // grid/dot structure in every column (measured <= 3.6% empty columns).
  for (const stat of stats) {
    assert(
      stat.emptyColumnRatio <= 0.1,
      `Expected ${label} ${stat.name} wall continuity (empty-column ratio <= 0.1), got ${stat.emptyColumnRatio.toFixed(4)}.`,
    );
    // No brightness floor: the flattened dark wall legitimately averages ~3/255
    // in places; holes are caught by the empty-column check above.
    assert(stat.lumaStdDev <= 58, `Expected ${label} ${stat.name} to avoid harsh seam/shadow contrast, got ${stat.lumaStdDev.toFixed(2)}.`);
  }

  return stats;
}

async function sampleVerticalFrameSpacing(page, screenshotPath, label) {
  assert(fs.existsSync(screenshotPath), `Expected ${label} screenshot to exist for grid-density comparison.`);
  const screenshotBuffer = fs.readFileSync(screenshotPath);
  const stats = await page.evaluate(
    async ({ source, region }) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      context.drawImage(image, 0, 0);
      const x = Math.floor(canvas.width * region.xRatio);
      const y = Math.floor(canvas.height * region.yRatio);
      const width = Math.max(1, Math.floor(canvas.width * region.widthRatio));
      const height = Math.max(1, Math.floor(canvas.height * region.heightRatio));
      const pixels = context.getImageData(x, y, width, height).data;
      const columns = [];
      let lumaTotal = 0;

      for (let column = 0; column < width; column += 1) {
        let darkness = 0;
        for (let row = 0; row < height; row += 1) {
          const index = (row * width + column) * 4;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
          lumaTotal += luma;
          darkness += Math.max(0, 190 - luma);
        }
        columns.push(darkness / height);
      }

      const smoothed = columns.map((_, index) => {
        const start = Math.max(0, index - 3);
        const end = Math.min(columns.length - 1, index + 3);
        let sum = 0;
        for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {
          sum += columns[sampleIndex];
        }
        return sum / (end - start + 1);
      });
      const mean = smoothed.reduce((sum, value) => sum + value, 0) / smoothed.length;
      const variance = smoothed.reduce((sum, value) => sum + (value - mean) ** 2, 0) / smoothed.length;
      const sorted = [...smoothed].sort((a, b) => a - b);
      const threshold = Math.max(mean + Math.sqrt(variance) * 1.35, sorted[Math.floor(sorted.length * 0.88)] ?? 0);
      const minGap = Math.max(42, width * 0.035);
      const peaks = [];

      for (let index = 1; index < smoothed.length - 1; index += 1) {
        if (smoothed[index] < threshold || smoothed[index] < smoothed[index - 1] || smoothed[index] < smoothed[index + 1]) {
          continue;
        }
        const lastPeak = peaks[peaks.length - 1];
        if (lastPeak !== undefined && index - lastPeak < minGap) {
          if (smoothed[index] > smoothed[lastPeak]) {
            peaks[peaks.length - 1] = index;
          }
        } else {
          peaks.push(index);
        }
      }

      const spacings = [];
      for (let index = 1; index < peaks.length; index += 1) {
        const spacing = peaks[index] - peaks[index - 1];
        if (spacing >= minGap * 0.75) {
          spacings.push(spacing);
        }
      }
      spacings.sort((a, b) => a - b);
      const spacingMedian = spacings.length > 0 ? spacings[Math.floor(spacings.length / 2)] : null;

      return {
        peakCount: peaks.length,
        spacingMedian,
        meanLuma: lumaTotal / (width * height),
      };
    },
    {
      source: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
      region: { xRatio: 0.18, yRatio: 0.08, widthRatio: 0.64, heightRatio: 0.16 },
    },
  );

  assert(stats, `Expected ${label} grid-density sampling to return stats.`);
  return stats;
}

// Frame-line detection needs a readable wall. On the dark LED wall (07-13
// art direction) seams sit only a few levels below the panels, and three
// detectors (raw darkness, high-pass peaks, autocorrelation) gave unstable
// spacings, so the comparison is reported as skipped there instead of being
// tuned until it passes.
const GRID_DENSITY_MIN_WALL_LUMA = 40;

function assertFrameSpacingReadable(stats, label) {
  assert(stats.peakCount >= 4, `Expected ${label} to expose at least 4 vertical frame lines, got ${stats.peakCount}.`);
  assert(stats.spacingMedian !== null, `Expected ${label} to expose measurable vertical frame spacing.`);
}

async function assertWorksOutroGridDensityRatio() {
  await withFreshBrowser(async (freshBrowser) => {
    const context = await freshBrowser.newContext({ viewport: ultraWideViewport, locale: "en-US", reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      const early = await sampleVerticalFrameSpacing(
        page,
        path.join(outputDir, "works-outro-curvature-early-desktop-2000x1080.png"),
        "works-outro-curvature-early",
      );
      const flatten = await sampleVerticalFrameSpacing(
        page,
        path.join(outputDir, "works-outro-wheel-flatten-desktop-2000x1080.png"),
        "works-outro-wheel-flatten",
      );
      if (early.meanLuma < GRID_DENSITY_MIN_WALL_LUMA || flatten.meanLuma < GRID_DENSITY_MIN_WALL_LUMA) {
        console.log(
          `SKIPPED works outro grid density ratio: dark LED wall is below the readable luma floor (early ${early.meanLuma.toFixed(1)}, flatten ${flatten.meanLuma.toFixed(1)}).`,
        );
        return;
      }
      assertFrameSpacingReadable(early, "works-outro-curvature-early");
      assertFrameSpacingReadable(flatten, "works-outro-wheel-flatten");
      const ratio = early.spacingMedian / flatten.spacingMedian;
      assert(
        ratio >= 0.8 && ratio <= 1.25,
        `Expected works outro early/flatten frame grid spacing ratio to stay within 0.8..1.25, got ${ratio.toFixed(3)}.`,
      );
      console.log(`Works outro grid density ratio early/flatten: ${ratio.toFixed(3)}`);
    } finally {
      await context.close();
    }
  });
}

function isAlreadyClosedPlaywrightError(error) {
  return String(error?.message ?? error).includes("Target page, context or browser has been closed");
}

async function closeBrowserIfOpen(browser) {
  try {
    await browser.close();
  } catch (error) {
    if (!isAlreadyClosedPlaywrightError(error)) {
      throw error;
    }
  }
}

async function launchValidationBrowser() {
  // Legacy "--use-gl=swiftshader" was removed from modern Chromium and breaks
  // WebGL context creation in headless mode (no canvas ever mounts). Rely on
  // Playwright defaults and keep the software fallback explicitly enabled.
  return chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
  });
}

async function sampleEndmarkLiveState(page) {
  return page.evaluate(() => {
    const endmark = window.__getAlcheEndmarkDebugState?.() ?? null;
    const layerState = window.__getAlcheLayerDebugState?.() ?? null;
    const root = document.querySelector("[data-endmark-footer-progress]");
    return {
      endmark,
      layerState: layerState
        ? {
            activeSection: layerState.activeSection ?? null,
            missionTurnProgress: layerState.missionTurnProgress ?? null,
            visionCoverProgress: layerState.visionCoverProgress ?? null,
            prismGroupScale: layerState.prismGroupScale ?? null,
          }
        : null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(Math.max(document.documentElement.scrollHeight - window.innerHeight, 0)),
      footerProgress: Number(root?.getAttribute("data-endmark-footer-progress") ?? "0"),
      footerVisible: root?.getAttribute("data-endmark-footer-visible") === "true",
    };
  });
}

// Debug snapshots can carry animation-library objects (GSAP targets are
// circular); never let the diagnostic itself throw.
function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, entry) => {
    if (key.startsWith("_")) return undefined;
    if (entry && typeof entry === "object") {
      if (seen.has(entry)) return "[circular]";
      seen.add(entry);
    }
    return entry;
  });
}

async function waitForEndmarkLiveStage(page, expectedStage, timeoutMs, pollMs = 250) {
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = await sampleEndmarkLiveState(page);
    if (
      lastSnapshot.endmark?.stage === expectedStage &&
      lastSnapshot.endmark?.visible === true &&
      lastSnapshot.endmark?.ready === true &&
      (lastSnapshot.layerState?.visionCoverProgress ?? 0) >= 0.98
    ) {
      return lastSnapshot;
    }

    await page.waitForTimeout(pollMs);
  }

  throw new Error(
    `Timed out waiting for endmark stage "${expectedStage}". Last snapshot: ${safeStringify(lastSnapshot)}`,
  );
}

function assertEndmarkSettledLineState(endmark, label) {
  assert(endmark, `Missing endmark debug state for ${label}.`);
  assert((endmark.gridAlpha ?? 1) <= 0.01, `Expected ${label} grid alpha to be cleared.`);
  assert((endmark.guidePersistentAlpha ?? 1) <= 0.01, `Expected ${label} persistent guide alpha to be cleared.`);
  assert((endmark.guideFadeAlpha ?? 1) <= 0.01, `Expected ${label} fade guide alpha to be cleared.`);
  assert((endmark.outlineAlpha ?? 1) <= 0.01, `Expected ${label} outline alpha to be cleared.`);
  assert((endmark.fillAlpha ?? 0) >= 0.99, `Expected ${label} fill alpha to stay visible.`);
  assert((endmark.fillRevealWidth ?? 0) >= 1910, `Expected ${label} fill reveal to cover the viewport.`);
}

async function assertHeaderBrandHiddenForEndmarkFooter(page, label) {
  const state = await page.evaluate(() => {
    const root = document.querySelector("[data-header-brand-hidden]");
    const brand = document.querySelector("[data-header-brand]");
    if (!(brand instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(brand);
    return {
      rootHidden: root?.getAttribute("data-header-brand-hidden") === "true",
      visibility: style.visibility,
      opacity: Number(style.opacity),
      pointerEvents: style.pointerEvents,
      tabIndex: brand.tabIndex,
      ariaHidden: brand.getAttribute("aria-hidden"),
    };
  });

  assert(state, `Expected ${label} header brand state.`);
  assert(state.rootHidden === true, `Expected ${label} root header brand hidden marker.`);
  assert(state.visibility === "hidden" || state.opacity <= 0.01, `Expected ${label} header brand to be invisible.`);
  assert(state.pointerEvents === "none", `Expected ${label} header brand pointer-events to be none.`);
  assert(state.tabIndex === -1, `Expected ${label} header brand to be removed from tab order.`);
  assert(state.ariaHidden === "true", `Expected ${label} header brand aria-hidden.`);
}

async function assertMissionGridPanelBackground(page, label) {
  const state = await page.evaluate(() => {
    const panel = document.querySelector("[data-mission-panel]");
    if (!(panel instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(panel);
    return {
      backgroundImage: style.backgroundImage,
      backgroundRepeat: style.backgroundRepeat,
    };
  });

  assert(state, `Expected ${label} mission panel background state.`);
  assert(
    state.backgroundImage.includes("mission-grid-tile.png"),
    `Expected ${label} mission panel to use mission grid tile, got ${state.backgroundImage}`,
  );
  assert(state.backgroundRepeat.includes("repeat"), `Expected ${label} mission panel grid to repeat.`);
}

async function assertTopPageShell(page, scenarioName) {
  // The canvas mounts client-side (dynamic import after hydration); wait for it
  // instead of racing "networkidle".
  await page.waitForSelector("canvas", { state: "attached", timeout: 20000 }).catch(() => {});
  assert((await page.locator("canvas").count()) >= 1, `Expected at least one canvas for ${scenarioName}`);
  assert((await page.locator("body").textContent())?.includes("MOONFLOW"), `Missing MOONFLOW branding for ${scenarioName}`);

  for (const sectionId of expectedSections) {
    assert((await page.locator(`[data-top_section="${sectionId}"]`).count()) === 1, `Missing ${sectionId} section for ${scenarioName}`);
  }

  assert((await page.locator("[data-mission-transition]").count()) === 1, `Expected mission transition overlay for ${scenarioName}`);
  assert((await page.locator("[data-mission-panel]").count()) === 1, `Expected mission transition panel for ${scenarioName}`);
  assert((await page.locator("[data-endmark-footer]").count()) === 1, `Expected endmark footer overlay for ${scenarioName}`);
  assert((await page.locator("[data-mission-outline]").count()) === 0, `Unexpected mission transition outline for ${scenarioName}`);
  assert((await page.locator("[data-top-scroll-indicator]").count()) === 0, `Unexpected top scroll indicator for ${scenarioName}`);
  assert((await page.locator('[data-top-panel="works"]').count()) === 0, `Unexpected works panel for ${scenarioName}`);
}

function approxEqual(a, b, tolerance = 0.03) {
  return Math.abs(a - b) <= tolerance;
}

function assertRange(value, range, label) {
  assert(value !== null && value !== undefined, `Missing ${label}`);
  if (range.min !== undefined) {
    assert(value >= range.min, `Expected ${label} >= ${range.min}, got ${value}`);
  }
  if (range.max !== undefined) {
    assert(value <= range.max, `Expected ${label} <= ${range.max}, got ${value}`);
  }
}

function getPrismVisibleOpacity(layerState) {
  return Math.max(
    layerState?.prismFullOpacity ?? 0,
    layerState?.prismEdgeOpacity ?? 0,
    layerState?.prismLineOpacity ?? 0,
  );
}

function assertCameraState(layerState, camera, tolerance, label) {
  assert(
    layerState.cameraPosition.every((value, index) => approxEqual(value, camera.position[index], tolerance)),
    `Expected ${label} camera position`,
  );
  assert(
    layerState.cameraTarget.every((value, index) => approxEqual(value, camera.target[index], tolerance)),
    `Expected ${label} camera target`,
  );
}

function assertCardAheadOfModel(layerState, cardWorldZ, label) {
  if (cardWorldZ === null || layerState.modelWorldZ === null) return;
  assert(cardWorldZ > layerState.modelWorldZ + 0.8, `Expected ${label} clearly ahead of model`);
}

function assertFacingError(layerState, cardIndex, maxError, label) {
  const error = layerState[`card${cardIndex}FacingError`];
  assert(error !== null && error !== undefined, `Missing ${label} card${cardIndex} facing error`);
  assert(error <= maxError, `Expected ${label} card${cardIndex} facing error <= ${maxError}, got ${error}`);
}

function assertScreenGap(layerState, minimumGap, label) {
  const leftRight = layerState.card0ScreenRight;
  const rightLeft = layerState.card1ScreenLeft;
  const gap = rightLeft - leftRight;

  assert(leftRight !== null && rightLeft !== null, `Missing ${label} screen bounds`);
  assert(gap >= minimumGap, `Expected ${label} screen gap >= ${minimumGap}, got ${gap}`);
}

function getCardScreenCenterX(layerState, cardIndex) {
  const left = layerState[`card${cardIndex}ScreenLeft`];
  const right = layerState[`card${cardIndex}ScreenRight`];
  assert(left !== null && right !== null, `Missing card${cardIndex} screen x bounds`);
  return (left + right) * 0.5;
}

function getCardScreenCenterY(layerState, cardIndex) {
  const top = layerState[`card${cardIndex}ScreenTop`];
  const bottom = layerState[`card${cardIndex}ScreenBottom`];
  assert(top !== null && bottom !== null, `Missing card${cardIndex} screen y bounds`);
  return (top + bottom) * 0.5;
}

function getCardScreenWidth(layerState, cardIndex) {
  const left = layerState[`card${cardIndex}ScreenLeft`];
  const right = layerState[`card${cardIndex}ScreenRight`];
  assert(left !== null && right !== null, `Missing card${cardIndex} screen width`);
  return right - left;
}

function assertCardOffscreenLeft(layerState, cardIndex, maxRightRatio, label) {
  const right = layerState[`card${cardIndex}ScreenRight`];
  assert(
    right === null || right / getViewportWidth(layerState) <= maxRightRatio,
    `Expected ${label} card${cardIndex} offscreen left, got right=${right}`,
  );
}

function assertCardQueueEntryParity(entryState, queueState) {
  const entryWidthRatio = getCardScreenWidth(entryState, 0) / getViewportWidth(entryState);
  const queueWidthRatio = getCardScreenWidth(queueState, 1) / getViewportWidth(queueState);
  const widthRatio = entryWidthRatio / Math.max(queueWidthRatio, 0.0001);
  assertRange(widthRatio, { min: 0.88, max: 1.12 }, "A/B queue entry width parity");

  const entryYRatio = getCardScreenCenterY(entryState, 0) / getViewportHeight(entryState);
  const queueYRatio = getCardScreenCenterY(queueState, 1) / getViewportHeight(queueState);
  assert(Math.abs(entryYRatio - queueYRatio) <= 0.08, "Expected A queue entry vertical lane to match B queue entry.");

  const entryAngle = entryState.card0ArcAngle;
  const queueAngle = queueState.card1ArcAngle;
  assert(entryAngle !== null && queueAngle !== null, "Missing A/B queue entry arc angles.");
  assert(Math.abs(entryAngle - queueAngle) <= 0.08, "Expected A queue entry arc angle to match B queue entry.");
}

function getViewportWidth(layerState) {
  assert(layerState.viewportWidth !== null && layerState.viewportWidth !== undefined, "Missing viewport width");
  return layerState.viewportWidth;
}

function getViewportHeight(layerState) {
  assert(layerState.viewportHeight !== null && layerState.viewportHeight !== undefined, "Missing viewport height");
  return layerState.viewportHeight;
}

function assertCardInLane(layerState, cardIndex, lane, label) {
  const centerX = getCardScreenCenterX(layerState, cardIndex);
  const centerY = getCardScreenCenterY(layerState, cardIndex);
  const width = getCardScreenWidth(layerState, cardIndex);
  const left = layerState[`card${cardIndex}ScreenLeft`];
  const right = layerState[`card${cardIndex}ScreenRight`];
  const viewportWidth = getViewportWidth(layerState);
  const viewportHeight = getViewportHeight(layerState);
  if (lane.centerX) {
    assertRange(centerX, lane.centerX, `${label} card${cardIndex} lane center x`);
  }
  if (lane.centerXRatio) {
    assertRange(centerX / viewportWidth, lane.centerXRatio, `${label} card${cardIndex} lane center x ratio`);
  }
  if (lane.centerY) {
    assertRange(centerY, lane.centerY, `${label} card${cardIndex} lane center y`);
  }
  if (lane.centerYRatio) {
    assertRange(centerY / viewportHeight, lane.centerYRatio, `${label} card${cardIndex} lane center y ratio`);
  }
  if (lane.width) {
    assertRange(width, lane.width, `${label} card${cardIndex} lane width`);
  }
  if (lane.widthRatio) {
    assertRange(width / viewportWidth, lane.widthRatio, `${label} card${cardIndex} lane width ratio`);
  }
  if (lane.screenLeft) {
    assertRange(left, lane.screenLeft, `${label} card${cardIndex} lane screen left`);
  }
  if (lane.screenLeftRatio) {
    assertRange(left / viewportWidth, lane.screenLeftRatio, `${label} card${cardIndex} lane screen left ratio`);
  }
  if (lane.screenRight) {
    assertRange(right, lane.screenRight, `${label} card${cardIndex} lane screen right`);
  }
  if (lane.screenRightRatio) {
    assertRange(right / viewportWidth, lane.screenRightRatio, `${label} card${cardIndex} lane screen right ratio`);
  }
}

function assertCardVisibility(layerState, cardIndex, expectedVisible, label) {
  assert(layerState[`card${cardIndex}Visible`] === expectedVisible, `Expected ${label} card${cardIndex} visible=${expectedVisible}`);
}

function assertCardSeparation(layerState, minimumGap, label) {
  const leftRight = layerState.card0ScreenRight;
  const rightLeft = layerState.card1ScreenLeft;
  assert(leftRight !== null && rightLeft !== null, `Missing ${label} separation bounds`);
  const gap = rightLeft - leftRight;
  const centerGap = getCardScreenCenterX(layerState, 1) - getCardScreenCenterX(layerState, 0);
  assert(
    gap >= minimumGap || centerGap >= 260,
    `Expected ${label} visual separation, got gap=${gap} centerGap=${centerGap}`,
  );
}

function matchesCardInLane(layerState, cardIndex, lane) {
  try {
    assertCardInLane(layerState, cardIndex, lane, "lane-check");
    return true;
  } catch {
    return false;
  }
}

function matchesCardSeparation(layerState, minimumGap) {
  try {
    assertCardSeparation(layerState, minimumGap, "gap-check");
    return true;
  } catch {
    return false;
  }
}

async function waitForShotLayerState(page, shotName, expectedState) {
  if (!expectedState) {
    await page.waitForTimeout(420);
    return;
  }

  await page.waitForFunction(
    ({ shotName: currentShotName, expected }) => {
      const state = window.__getAlcheLayerDebugState?.();
      if (!state) return false;

      const hasBounds = (cardIndex) =>
        state[`card${cardIndex}ScreenLeft`] !== null &&
        state[`card${cardIndex}ScreenRight`] !== null &&
        state[`card${cardIndex}ScreenTop`] !== null &&
        state[`card${cardIndex}ScreenBottom`] !== null;
      const lacksBounds = (cardIndex) =>
        state[`card${cardIndex}ScreenLeft`] === null &&
        state[`card${cardIndex}ScreenRight`] === null &&
        state[`card${cardIndex}ScreenTop`] === null &&
        state[`card${cardIndex}ScreenBottom`] === null;

      if (expected.mode === "single-card-state") {
        const card0Ready = expected.card0Visible ? hasBounds(0) : lacksBounds(0);
        const card1Ready = expected.card1Visible ? hasBounds(1) : lacksBounds(1);
        return (
          state.cardsOpacity !== null &&
          state.card0Opacity !== null &&
          (expected.card1Visible ? state.card1Opacity !== null : state.card1Opacity === null) &&
          state.card0Visible === expected.card0Visible &&
          state.card1Visible === expected.card1Visible &&
          card0Ready &&
          card1Ready
        );
      }

      if (expected.mode === "dual-card-state") {
        return (
          state.cardsOpacity !== null &&
          state.card0Opacity !== null &&
          state.card1Opacity !== null &&
          state.card0Visible === expected.card0Visible &&
          state.card1Visible === expected.card1Visible &&
          hasBounds(0) &&
          hasBounds(1)
        );
      }

      if (expected.mode === "hidden") {
        return (
          state.cardsOpacity !== null &&
          state.worksOpacity !== null &&
          state.card0Visible === false &&
          state.card1Visible === false &&
          lacksBounds(0) &&
          lacksBounds(1)
        );
      }

      if (currentShotName === "works-out") {
        return state.cardsOpacity !== null && state.card0Visible === false && state.card1Visible === false;
      }

      return state.wallWorldZ !== null;
    },
    { shotName, expected: expectedState },
    { timeout: 5000 },
  );

  await page.waitForTimeout(180);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLayerStateSummary(layerState) {
  if (!layerState) return "debug: unavailable";

  const card0CenterX =
    layerState.card0ScreenLeft !== null && layerState.card0ScreenRight !== null
      ? ((layerState.card0ScreenLeft + layerState.card0ScreenRight) * 0.5).toFixed(1)
      : "null";
  const card0CenterY =
    layerState.card0ScreenTop !== null && layerState.card0ScreenBottom !== null
      ? ((layerState.card0ScreenTop + layerState.card0ScreenBottom) * 0.5).toFixed(1)
      : "null";
  const card1CenterX =
    layerState.card1ScreenLeft !== null && layerState.card1ScreenRight !== null
      ? ((layerState.card1ScreenLeft + layerState.card1ScreenRight) * 0.5).toFixed(1)
      : "null";
  const card1CenterY =
    layerState.card1ScreenTop !== null && layerState.card1ScreenBottom !== null
      ? ((layerState.card1ScreenTop + layerState.card1ScreenBottom) * 0.5).toFixed(1)
      : "null";
  const screenGap =
    layerState.card0ScreenRight !== null && layerState.card1ScreenLeft !== null
      ? (layerState.card1ScreenLeft - layerState.card0ScreenRight).toFixed(1)
      : "null";
  const card0FacingError = layerState.card0FacingError !== null ? layerState.card0FacingError.toFixed(3) : "null";
  const card1FacingError = layerState.card1FacingError !== null ? layerState.card1FacingError.toFixed(3) : "null";

  return [
    `debug: c0=${layerState.card0Visible ? "on" : "off"} @ ${card0CenterX},${card0CenterY}`,
    `debug: c1=${layerState.card1Visible ? "on" : "off"} @ ${card1CenterX},${card1CenterY}`,
    `debug: lead=${layerState.cardsLeadIndex ?? "null"} gap=${screenGap}`,
    `debug: facing c0=${card0FacingError} c1=${card1FacingError}`,
  ].join(" | ");
}

async function writeReferenceBoard(layerStates) {
  const boardPath = path.join(outputDir, "reference-board.html");
  const shotsByName = new Map(fixedStateShots.map((shot) => [shot.name, shot]));
  const videoSrc = path.relative(outputDir, path.join(root, "Task", "参考视频.mp4")).replaceAll(path.sep, "/");
  const shotRows = worksShotbook.shots
    .map((shot) => {
      const capture = shotsByName.get(shot.id);
      const taskStillSrc = shot.reference.taskStillPath
        ? path.relative(outputDir, path.join(root, shot.reference.taskStillPath)).replaceAll(path.sep, "/")
        : null;
      const layerState = layerStates.get(shot.id) ?? null;
      return `
        <section class="shot">
          <div class="shotMeta">
            <h2>${escapeHtml(shot.id)}</h2>
            <p>${escapeHtml(capture?.search ?? "")}</p>
            <p>${escapeHtml(`section=${shot.section} progress=${shot.progress.toFixed(2)} intro=${shot.intro.toFixed(2)}`)}</p>
            <p>${escapeHtml(`videoTime=${shot.reference.videoTime.toFixed(2)}s`)}</p>
            <p>${escapeHtml(formatLayerStateSummary(layerState))}</p>
          </div>
          <div class="shotGrid">
            <article class="panel">
              <img src="${escapeHtml(`${shot.id}.png`)}" alt="${escapeHtml(`${shot.id} current`)}" />
              <h2>Current</h2>
            </article>
            <article class="panel">
              <img src="${escapeHtml(`reference-video/${shot.id}.png`)}" alt="${escapeHtml(`${shot.id} video reference`)}" />
              <h2>Video Reference</h2>
            </article>
            <article class="panel">
              ${
                taskStillSrc
                  ? `<img src="${escapeHtml(taskStillSrc)}" alt="${escapeHtml(`${shot.id} task still`)}" />`
                  : `<div class="placeholder">No task still</div>`
              }
              <h2>Task Still</h2>
            </article>
          </div>
        </section>
      `;
    })
    .join("");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MOONFLOW Cards Reference Board</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050608;
        --panel: #101317;
        --border: rgba(255, 255, 255, 0.12);
        --text: #f5f7fb;
        --muted: #a8b0bd;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: radial-gradient(circle at top, #18202d, var(--bg) 42%);
        color: var(--text);
        font-family: "IBM Plex Mono", ui-monospace, monospace;
      }
      h1, h2 { margin: 0; }
      p { margin: 0; color: var(--muted); }
      .section { margin-top: 28px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .shot {
        margin-top: 18px;
        border: 1px solid var(--border);
        background: rgba(8, 12, 18, 0.88);
        border-radius: 20px;
        padding: 16px;
      }
      .shotMeta {
        display: grid;
        gap: 6px;
      }
      .shotGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 14px;
      }
      .panel {
        border: 1px solid var(--border);
        background: rgba(8, 12, 18, 0.88);
        border-radius: 18px;
        padding: 14px;
      }
      .panel img, video, .placeholder {
        display: block;
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #000;
      }
      .placeholder {
        min-height: 180px;
        display: grid;
        place-items: center;
        color: var(--muted);
        font-size: 12px;
      }
      .panel h2 {
        font-size: 14px;
        margin-top: 10px;
      }
      .panel p {
        font-size: 12px;
        margin-top: 8px;
        line-height: 1.5;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <h1>MOONFLOW Cards Reference Board</h1>
    <p>Current shots, extracted video references, task stills, and the source video in one place.</p>

    <section class="section">
      <h2>Shotbook</h2>
      ${shotRows}
    </section>

    <section class="section">
      <h2>Reference Video</h2>
      <div class="grid">
        <article class="panel">
          <video controls preload="metadata" src="${escapeHtml(videoSrc)}"></video>
          <h2>Task/参考视频.mp4</h2>
        </article>
      </div>
    </section>
  </body>
</html>`;

  await fs.promises.writeFile(boardPath, html, "utf8");
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext(
    scenario.device
      ? {
          ...scenario.device,
          locale: scenario.locale,
        }
      : {
          viewport: scenario.viewport,
          locale: scenario.locale,
        },
  );

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.waitForURL(`**${scenario.expectedPath}`, { timeout: 5000 });
    await page.waitForFunction(
      () => document.querySelectorAll("canvas").length >= 1 && document.querySelector("[data-active-section]") !== null,
      undefined,
      { timeout: 12000 },
    );

    await assertTopPageShell(page, scenario.name);

    await expectNoHorizontalOverflow(page, scenario.name);
    await page.screenshot({
      path: path.join(outputDir, `${scenario.name}.png`),
      fullPage: false,
    });
  } finally {
    try {
      await context.close();
    } catch (error) {
      if (!isAlreadyClosedPlaywrightError(error)) {
        throw error;
      }
    }
  }
}

async function captureFixedStates(browser, shots, options = {}) {
  const viewport = options.viewport ?? { width: 1440, height: 1080 };
  const fileSuffix = options.fileSuffix ?? "";
  const layerStates = new Map();
  for (const shot of shots) {
    console.log(`Capturing ${shot.name}...`);
    const context = await browser.newContext({
      viewport,
      locale: "en-US",
      reducedMotion: "reduce",
    });

    try {
      const page = await context.newPage();
      await page.goto(`${baseUrl}/en/${shot.search}`, { waitUntil: "networkidle" });
      await assertTopPageShell(page, shot.name);
      const params = new URLSearchParams(shot.search.slice(1));
      const override = shot.override ?? {
        section: params.get("alcheSection"),
        progress: Number(params.get("alcheProgress") ?? ((params.get("alcheSection") ?? "loading") === "loading" ? "0" : "1")),
        intro: Number(params.get("alcheIntro") ?? ((params.get("alcheSection") ?? "loading") === "loading" ? "0.2" : "1")),
        missionTurnProgress:
          params.get("alcheMissionTurnProgress") === null ? undefined : Number(params.get("alcheMissionTurnProgress")),
        visionCoverProgress:
          params.get("alcheVisionCoverProgress") === null ? undefined : Number(params.get("alcheVisionCoverProgress")),
        heroShotId: params.get("alcheHeroShot"),
      };
      const sectionId = override.section;
      await page.waitForFunction(() => typeof window.__setAlcheDebugOverride === "function", undefined, { timeout: 20000 });
      await page.evaluate((nextOverride) => {
        window.__setAlcheDebugOverride?.(nextOverride);
      }, override);
      if (sectionId && sectionId !== "loading") {
        try {
          await page.waitForFunction(
            (expectedSection) => {
              const root = document.querySelector("[data-active-section]");
              const loadingOverlay = document.querySelector("[data-loading-overlay]");
              return (
                root?.getAttribute("data-render-active-section") === expectedSection &&
                root?.getAttribute("data-render-intro-ready") === "true" &&
                loadingOverlay?.getAttribute("data-render-hidden") === "true"
              );
            },
            sectionId,
            { timeout: 2500 },
          );
        } catch {
          await page.waitForFunction(
            (expectedSection) => {
              const root = document.querySelector("[data-active-section]");
              const loadingOverlay = document.querySelector("[data-loading-overlay]");
              return (
                root?.getAttribute("data-active-section") === expectedSection &&
                root?.getAttribute("data-intro-ready") === "true" &&
                loadingOverlay?.getAttribute("data-hidden") === "true"
              );
            },
            sectionId,
            { timeout: 5000 },
          );
        }
      } else {
        try {
          await page.waitForFunction(
            () => document.querySelector("[data-active-section]")?.getAttribute("data-render-active-section") === "loading",
            undefined,
            { timeout: 2500 },
          );
        } catch {
          await page.waitForFunction(
            () => document.querySelector("[data-active-section]")?.getAttribute("data-active-section") === "loading",
            undefined,
            { timeout: 5000 },
          );
        }
      }
      await page.waitForFunction(() => typeof window.__getAlcheLayerDebugState === "function", undefined, { timeout: 20000 });
      const expectedEndmarkStage = shot.endmarkStage ?? (shot.name.startsWith("endmark-") ? shot.name.replace("endmark-", "") : null);
      if (expectedEndmarkStage) {
        await page.waitForFunction(
          (stageName) => {
            const state = window.__getAlcheEndmarkDebugState?.();
            return state?.ready === true && state?.visible === true && state?.stage === stageName;
          },
          expectedEndmarkStage,
          { timeout: 5000 },
        );
        if (expectedEndmarkStage === "settled") {
          const endmarkState = await page.evaluate(() => window.__getAlcheEndmarkDebugState?.() ?? null);
          assertEndmarkSettledLineState(endmarkState, shot.name);
        }
        if (shot.name === "endmark-settled") {
          const footerState = await page.evaluate(() => ({
            progress: Number(document.querySelector("[data-endmark-footer-progress]")?.getAttribute("data-endmark-footer-progress") ?? "0"),
            visible: document.querySelector("[data-endmark-footer-progress]")?.getAttribute("data-endmark-footer-visible") === "true",
          }));
          assert(footerState.progress <= 0.01, "Expected fixed endmark-settled to keep footer hidden.");
          assert(footerState.visible === false, "Expected fixed endmark-settled footer visibility to be false.");
        }
        if (shot.name === "endmark-footer-settled") {
          const footerState = await page.evaluate(() => ({
            progress: Number(document.querySelector("[data-endmark-footer-progress]")?.getAttribute("data-endmark-footer-progress") ?? "0"),
            visible: document.querySelector("[data-endmark-footer-progress]")?.getAttribute("data-endmark-footer-visible") === "true",
          }));
          assert(footerState.progress >= 0.99, "Expected fixed endmark footer progress to be complete.");
          assert(footerState.visible === true, "Expected fixed endmark footer to be visible.");
          await assertHeaderBrandHiddenForEndmarkFooter(page, shot.name);
        }
      }
      if (["mission-turn-side", "mission-in-panel"].includes(shot.name)) {
        await assertMissionGridPanelBackground(page, shot.name);
      }
      await waitForShotLayerState(page, shot.name, expectedShotStates[shot.name]);
      if (shot.name in expectedShotStates) {
        await page.waitForFunction(
          () => {
            const state = window.__getAlcheLayerDebugState?.();
            return state !== null && state !== undefined && state.wallWorldZ !== null && state.worksWorldZ !== null;
          },
          undefined,
          { timeout: 2500 },
        );
      }
      if (["works-outro-prism-bridge", "mission-in-prism-bridge-early"].includes(shot.name)) {
        await page.waitForFunction(
          () => {
            const state = window.__getAlcheLayerDebugState?.();
            return Math.max(state?.prismFullOpacity ?? 0, state?.prismEdgeOpacity ?? 0, state?.prismLineOpacity ?? 0) >= 0.08;
          },
          undefined,
          { timeout: 3500 },
        );
      }
      const layerState = await page.evaluate(() => window.__getAlcheLayerDebugState?.() ?? null);
      layerStates.set(shot.name, layerState);
      assert(layerState, `Missing layer debug state for ${shot.name}`);
      if (["works-outro-prism-bridge", "mission-in-prism-bridge-early"].includes(shot.name)) {
        assert(getPrismVisibleOpacity(layerState) >= 0.08, `Expected visible prism bridge during ${shot.name}.`);
      }

      if (shot.name in expectedShotStates) {
        const expected = expectedShotStates[shot.name];
        assertCameraState(layerState, expected.camera, expected.cameraTolerance, shot.name);
        assert(approxEqual(layerState.wallWorldZ, expectedWallWorldZ), `Expected wall world z for ${shot.name}`);
        assert((layerState.wallRotationY ?? 0) <= 0.02 && (layerState.wallRotationY ?? 0) >= -0.02, `Expected wall rotation locked for ${shot.name}`);
        assert(approxEqual(layerState.worksWorldZ, expectedWorksWorldZ, 0.05), `Expected WORKS world z for ${shot.name}`);
        assertRange(layerState.worksHandoff, expectedHandoff[shot.name] ?? { min: 0.99, max: 1.01 }, `${shot.name} works handoff`);
        assertRange(layerState.worksOpacity ?? 0, expected.worksOpacity, `${shot.name} works opacity`);
        assertRange(layerState.cardsOpacity ?? 0, expected.cardsOpacity, `${shot.name} cards opacity`);
        assertRange(layerState.moonflowOpacity ?? 0, expected.moonflowOpacity, `${shot.name} moonflow opacity`);
        if (layerState.modelScale !== null) {
          // works_intro swells the crystal up to 1.42x mid half-turn (reference
          // 6.0-8.0s, fourth pass); everywhere else it stays near 1.
          const modelScaleMax = layerState.sceneActiveSection === "works_intro" ? 1.5 : 1.2;
          assertRange(layerState.modelScale, { min: 0.5, max: modelScaleMax }, `${shot.name} model scale`);
        }

        if (expected.mode === "single-card-state") {
          if (expected.cardsLeadIndex !== undefined) {
            assert(layerState.cardsLeadIndex === expected.cardsLeadIndex, `Expected lead card index ${expected.cardsLeadIndex} for ${shot.name}`);
          }
          assertCardVisibility(layerState, 0, expected.card0Visible, shot.name);
          assertCardVisibility(layerState, 1, expected.card1Visible, shot.name);
          assertRange(layerState.card0Opacity, expected.card0Opacity, `${shot.name} card0 opacity`);
          assert((layerState.card0ScreenLeft ?? 0) < (layerState.card0ScreenRight ?? 0), `Expected ${shot.name} card0 screen bounds`);
          assert(layerState.card1Opacity === null, `Expected ${shot.name} card1 opacity to be null while hidden`);
          assert(layerState.card1ScreenLeft === null && layerState.card1ScreenRight === null, `Expected ${shot.name} card1 screen bounds to be null while hidden`);
          assert(layerState.cardsSupportWorldX === null && layerState.cardsSupportWorldZ === null, `Expected ${shot.name} support card debug to stay null while B is hidden`);
          assertCardAheadOfModel(layerState, layerState.card0WorldZ, `${shot.name} card0`);
          assertCardAheadOfModel(layerState, layerState.cardsLeadWorldZ, `${shot.name} lead card`);
          assertFacingError(layerState, 0, 0.06, shot.name);
          assert(layerState.card1FacingError === null, `Expected ${shot.name} card1 facing error to stay null while hidden`);
        } else if (expected.mode === "dual-card-state") {
          if (expected.cardsLeadIndex !== undefined) {
            assert(layerState.cardsLeadIndex === expected.cardsLeadIndex, `Expected lead card index ${expected.cardsLeadIndex} for ${shot.name}`);
          }
          assertCardVisibility(layerState, 0, expected.card0Visible, shot.name);
          assertCardVisibility(layerState, 1, expected.card1Visible, shot.name);
          assertRange(layerState.card0Opacity, expected.card0Opacity, `${shot.name} card0 opacity`);
          assertRange(layerState.card1Opacity, expected.card1Opacity, `${shot.name} card1 opacity`);
          if (expected.card0MayBeOffscreenLeft) {
            assertCardOffscreenLeft(layerState, 0, 0.03, shot.name);
          } else {
            assert((layerState.card0ScreenLeft ?? 0) < (layerState.card0ScreenRight ?? 0), `Expected ${shot.name} card0 screen bounds`);
          }
          assert((layerState.card1ScreenLeft ?? 0) < (layerState.card1ScreenRight ?? 0), `Expected ${shot.name} card1 screen bounds`);
          if (!expected.card0MayBeOffscreenLeft) {
            assertCardAheadOfModel(layerState, layerState.card0WorldZ, `${shot.name} card0`);
          }
          assertCardAheadOfModel(layerState, layerState.card1WorldZ, `${shot.name} card1`);
          assertCardAheadOfModel(layerState, layerState.cardsLeadWorldZ, `${shot.name} lead card`);
          if (!expected.card0MayBeOffscreenLeft) {
            assertCardAheadOfModel(layerState, layerState.cardsSupportWorldZ, `${shot.name} support card`);
          }
          assertFacingError(layerState, 0, 0.06, shot.name);
          assertFacingError(layerState, 1, 0.06, shot.name);
        } else if (expected.cardsLeadIndex !== undefined) {
          assert(layerState.cardsLeadIndex === expected.cardsLeadIndex, `Expected lead card index ${expected.cardsLeadIndex} for ${shot.name}`);
          assertRange(layerState.cardsLeadWorldX, expected.cardsLeadX, `${shot.name} lead card x`);
          assertRange(layerState.cardsSupportWorldX, expected.cardsSupportX, `${shot.name} support card x`);
          assertCardAheadOfModel(layerState, layerState.cardsLeadWorldZ, `${shot.name} lead card`);
          assertCardAheadOfModel(layerState, layerState.cardsSupportWorldZ, `${shot.name} support card`);
          assert((layerState.cardsLeadOpacity ?? 0) >= (layerState.cardsSupportOpacity ?? 0) * 0.82, `Expected lead card to remain visually dominant for ${shot.name}`);
        } else {
          assert((layerState.cardsOpacity ?? 0) <= 0.08, `Expected cards hidden during ${shot.name}`);
          assertRange(layerState.worksWorldX, expectedWorksWorldX[shot.name], `${shot.name} works x`);
          assert(Math.abs(layerState.worksRotationY ?? 0) <= 0.001, `Expected WORKS rotation.y frozen for ${shot.name}`);
          if (layerState.modelWorldZ !== null) {
            assert(layerState.modelWorldZ > layerState.worksWorldZ, `Expected model ahead of WORKS for ${shot.name}`);
          }
        }

        if ((layerState.moonflowOpacity ?? 0) > 0.04 && layerState.modelWorldZ !== null && layerState.moonflowWorldZ !== null) {
          assert(layerState.modelWorldZ > layerState.moonflowWorldZ, `Expected model ahead of MOONFLOW for ${shot.name}`);
        }
        assert(layerState.worksDepthTest === true, `Expected WORKS depthTest enabled for ${shot.name}`);
        assert(layerState.worksDepthWrite === false, `Expected WORKS depthWrite disabled for ${shot.name}`);
        assert(layerState.worksTransparent === true, `Expected WORKS transparent material for ${shot.name}`);
      }
      const screenshot = await page.screenshot({
        path: path.join(outputDir, `${shot.name}${fileSuffix}.png`),
        fullPage: false,
      });
      if (["works-outro-curvature-early", "works-outro-curvature-mid", "works-outro-curvature-late"].includes(shot.name)) {
        await assertWallContinuity(page, screenshot, `${shot.name}${fileSuffix}`);
      }
    } finally {
      try {
        await context.close();
      } catch (error) {
        if (!isAlreadyClosedPlaywrightError(error)) {
          throw error;
        }
      }
    }
  }
  const earlyState = layerStates.get("works-intro-enter-early");
  const settleState = layerStates.get("works-intro-settle");
  const holdState = layerStates.get("works-hold");
  const outState = layerStates.get("works-out");
  const cardsAEntryState = layerStates.get("cards-a-entry");
  const cardsACenterState = layerStates.get("cards-a-center");
  const cardsBQueueState = layerStates.get("cards-b-queue");
  const cardsHandoffMidState = layerStates.get("cards-handoff-mid");
  const cardsSettledState = layerStates.get("cards-settled");
  const worksOutroEntryState = layerStates.get("works-outro-entry");
  const worksOutroFlattenState = layerStates.get("works-outro-flatten");
  const missionInPanelState = layerStates.get("mission-in-panel");
  const missionInSettledState = layerStates.get("mission-in-settled");

  if (earlyState && settleState && holdState && outState) {
    assert(earlyState.worksHandoff < settleState.worksHandoff, "Expected WORKS handoff to increase through intro.");
    assert(settleState.worksHandoff < holdState.worksHandoff, "Expected WORKS handoff to continue into hold.");
    assert(holdState.worksHandoff < outState.worksHandoff, "Expected WORKS handoff to continue into out.");
    assert(earlyState.worksWorldX < settleState.worksWorldX, "Expected WORKS to move right during enter.");
    assert(Math.abs((settleState.worksWorldX ?? 0) - (holdState.worksWorldX ?? 0)) < 0.6, "Expected WORKS to hold near center before fade.");
    assert(holdState.worksWorldX < outState.worksWorldX, "Expected WORKS to move right again during out.");
    assert((earlyState.moonflowOpacity ?? 0) > (settleState.moonflowOpacity ?? 0), "Expected MOONFLOW to fade out only once.");
    assert((settleState.moonflowOpacity ?? 0) >= (holdState.moonflowOpacity ?? 0), "Expected MOONFLOW to stay off after fade.");
    assert((holdState.moonflowOpacity ?? 0) >= (outState.moonflowOpacity ?? 0), "Expected MOONFLOW to remain off into out.");
    assert((earlyState.worksOpacity ?? 0) < (settleState.worksOpacity ?? 0), "Expected WORKS to fade in during enter.");
    assert(Math.abs((settleState.worksOpacity ?? 0) - (holdState.worksOpacity ?? 0)) < 0.16, "Expected WORKS to hold opacity in center.");
    assert((holdState.worksOpacity ?? 0) > (outState.worksOpacity ?? 0), "Expected WORKS to fade out once.");
  }

  if (outState && cardsAEntryState && cardsACenterState && cardsBQueueState && cardsHandoffMidState && cardsSettledState) {
    if (holdState) {
      assert((holdState.cardsOpacity ?? 0) <= 0.04, "Expected cards to stay hidden during works hold.");
    }
    assert((outState.cardsOpacity ?? 0) <= 0.04, "Expected cards to remain hidden until works fully exits.");
    assert((cardsAEntryState.cardsOpacity ?? 0) > 0.98, "Expected card A to appear immediately in works_cards.");
    assert(cardsAEntryState.cardsLeadIndex === 0, "Expected card 0 to lead during A entry.");
    assert(cardsACenterState.cardsLeadIndex === 0, "Expected card 0 to still lead at A center.");
    assert(cardsBQueueState.cardsLeadIndex === 0, "Expected card 0 to still lead while B queues.");
    assert(cardsSettledState.cardsLeadIndex === 1, "Expected card 1 to take over by settled works_cards.");
    assert(
      cardsAEntryState.card1Visible === false &&
        cardsACenterState.card1Visible === false,
      "Expected card B to remain unloaded until the queue phase.",
    );
    assert(cardsBQueueState.card1Visible === true, "Expected card B to load only during queue.");
    assertCardInLane(cardsAEntryState, 0, laneTargets.queueRight, "cards-a-entry");
    assertCardInLane(cardsACenterState, 0, laneTargets.leadCenter, "cards-a-center");
    assertCardInLane(cardsBQueueState, 0, laneTargets.leadCenter, "cards-b-queue");
    assertCardInLane(cardsBQueueState, 1, laneTargets.queueRight, "cards-b-queue");
    assertCardQueueEntryParity(cardsAEntryState, cardsBQueueState);
    assertCardInLane(cardsSettledState, 1, laneTargets.leadCenter, "cards-settled");
    assertCardSeparation(cardsBQueueState, 12, "cards-b-queue");
    assertCardSeparation(cardsHandoffMidState, 12, "cards-handoff-mid");
    assertCardOffscreenLeft(cardsSettledState, 0, 0.03, "cards-settled");
    assert(getCardScreenCenterX(cardsAEntryState, 0) > getCardScreenCenterX(cardsACenterState, 0), "Expected card A to move from right toward center first.");
    assert(getCardScreenCenterX(cardsACenterState, 0) > getCardScreenCenterX(cardsHandoffMidState, 0), "Expected card A to move left only after reaching center.");
    assert((cardsHandoffMidState.card0ScreenRight ?? 0) > (cardsSettledState.card0ScreenRight ?? 0), "Expected card A to continue moving left until it exits.");
    assert(getCardScreenCenterY(cardsAEntryState, 0) > getCardScreenCenterY(cardsACenterState, 0), "Expected card A to move upward from right-lower into center.");
    assert(getCardScreenCenterX(cardsBQueueState, 1) > getCardScreenCenterX(cardsHandoffMidState, 1), "Expected card B to move left from queue into center.");
    assert(getCardScreenCenterX(cardsHandoffMidState, 1) > getCardScreenCenterX(cardsSettledState, 1), "Expected card B to continue left into the lead slot.");
    assert(getCardScreenCenterY(cardsBQueueState, 1) > getCardScreenCenterY(cardsHandoffMidState, 1), "Expected card B to move upward from right-lower into center.");
    assert(getCardScreenCenterY(cardsHandoffMidState, 1) > getCardScreenCenterY(cardsSettledState, 1), "Expected card B to keep moving upward into the center slot.");
    assert(
      (cardsHandoffMidState.card0ScreenRight ?? 0) < (cardsBQueueState.card0ScreenRight ?? 0) - 180,
      "Expected handoff-mid A to have moved substantially left from B queue.",
    );
    assertRange(
      (cardsHandoffMidState.card0ScreenRight ?? 0) / getViewportWidth(cardsHandoffMidState),
      { min: 0.06, max: 0.32 },
      "cards-handoff-mid card0 right ratio",
    );
    const stableModelReference = holdState ?? outState;
    const modelTracked =
      stableModelReference &&
      stableModelReference.modelScale !== null &&
      stableModelReference.modelWorldZ !== null &&
      cardsACenterState.modelScale !== null &&
      cardsACenterState.modelWorldZ !== null &&
      cardsSettledState.modelScale !== null &&
      cardsSettledState.modelWorldZ !== null;
    if (modelTracked) {
      if (
        holdState &&
        earlyState &&
        holdState.modelScale !== null &&
        holdState.modelWorldZ !== null &&
        earlyState.modelScale !== null &&
        earlyState.modelWorldZ !== null
      ) {
        assert(approxEqual(earlyState.modelScale, holdState.modelScale, 0.01), "Expected center model scale to stay fixed through works.");
        assert(approxEqual(earlyState.modelWorldZ, holdState.modelWorldZ, 0.05), "Expected center model z to stay fixed through works.");
      }
      assert(approxEqual(stableModelReference.modelScale, cardsACenterState.modelScale, 0.01), "Expected center model scale to stay fixed into cards center.");
      assert(approxEqual(cardsACenterState.modelScale, cardsSettledState.modelScale, 0.01), "Expected center model scale to stay fixed through cards swap.");
      assert(approxEqual(stableModelReference.modelWorldZ, cardsACenterState.modelWorldZ, 0.05), "Expected center model z to stay fixed into cards center.");
      assert(approxEqual(cardsACenterState.modelWorldZ, cardsSettledState.modelWorldZ, 0.05), "Expected center model z to stay fixed through cards swap.");
    }
  }

  if (worksOutroEntryState && worksOutroFlattenState && missionInPanelState && missionInSettledState) {
    assert((worksOutroEntryState.worksOpacity ?? 1) <= 0.08, "Expected WORKS to remain gone at works_outro entry.");
    assert((worksOutroEntryState.cardsOpacity ?? 0) >= 0.82, "Expected cards to still dominate at works_outro entry.");
    assertCardVisibility(worksOutroEntryState, 0, true, "works-outro-entry");
    assertCardVisibility(worksOutroEntryState, 1, true, "works-outro-entry");
    assertCardOffscreenLeft(worksOutroEntryState, 0, 0.03, "works-outro-entry");
    assertCardInLane(worksOutroEntryState, 1, laneTargets.leadCenter, "works-outro-entry");
    assertFacingError(worksOutroEntryState, 0, 0.06, "works-outro-entry");
    assertFacingError(worksOutroEntryState, 1, 0.06, "works-outro-entry");
    assertRange(worksOutroEntryState.worksOutroClearMix, { min: 0.03, max: 0.14 }, "works-outro-entry clear mix");
    assertRange(worksOutroEntryState.missionPanelProgress, { min: 0.01, max: 0.08 }, "works-outro-entry panel progress");
    assertRange(worksOutroEntryState.missionOutlineOpacity, { min: 0, max: 0.001 }, "works-outro-entry outline opacity");

    assert((worksOutroFlattenState.worksOpacity ?? 1) <= 0.08, "Expected WORKS to remain gone during works_outro flatten.");
    assert((worksOutroFlattenState.cardsOpacity ?? 0) >= 0.12 && (worksOutroFlattenState.cardsOpacity ?? 0) <= 0.42, "Expected cards to be clearing during works_outro flatten.");
    assertCardVisibility(worksOutroFlattenState, 0, true, "works-outro-flatten");
    assertCardVisibility(worksOutroFlattenState, 1, true, "works-outro-flatten");
    assertCardOffscreenLeft(worksOutroFlattenState, 0, 0.03, "works-outro-flatten");
    assertFacingError(worksOutroFlattenState, 0, 0.06, "works-outro-flatten");
    assertFacingError(worksOutroFlattenState, 1, 0.06, "works-outro-flatten");
    assertRange(worksOutroFlattenState.worksOutroClearMix, { min: 0.8, max: 0.95 }, "works-outro-flatten clear mix");
    assertRange(worksOutroFlattenState.missionPanelProgress, { min: 0.35, max: 0.5 }, "works-outro-flatten panel progress");
    assertRange(worksOutroFlattenState.missionOutlineOpacity, { min: 0, max: 0.001 }, "works-outro-flatten outline opacity");
    assert((worksOutroFlattenState.card1Opacity ?? 1) < (worksOutroEntryState.card1Opacity ?? 0), "Expected B to fade during works_outro flatten.");
    assert(getCardScreenCenterX(worksOutroFlattenState, 1) < getCardScreenCenterX(worksOutroEntryState, 1), "Expected B to continue moving left during works_outro flatten.");
    assert((worksOutroEntryState.kvWallFlatten ?? 0) < (worksOutroFlattenState.kvWallFlatten ?? 0), "Expected wall flatten to keep increasing through works_outro.");

    assert((missionInPanelState.cardsOpacity ?? 0) <= 0.02, "Expected cards cleared by mission-in-panel.");
    assertCardVisibility(missionInPanelState, 0, false, "mission-in-panel");
    assertCardVisibility(missionInPanelState, 1, false, "mission-in-panel");
    assertRange(missionInPanelState.missionFlattenMix, { min: 0.52, max: 0.78 }, "mission-in-panel flatten mix");
    assertRange(missionInPanelState.missionWhiteMix, { min: 0.18, max: 0.45 }, "mission-in-panel white mix");
    assertRange(missionInPanelState.missionPanelProgress, { min: 0.72, max: 0.9 }, "mission-in-panel panel progress");
    assertRange(missionInPanelState.missionOutlineOpacity, { min: 0, max: 0.001 }, "mission-in-panel outline opacity");

    assert((missionInSettledState.cardsOpacity ?? 0) <= 0.02, "Expected cards cleared by mission-in-settled.");
    assertCardVisibility(missionInSettledState, 0, false, "mission-in-settled");
    assertCardVisibility(missionInSettledState, 1, false, "mission-in-settled");
    assertRange(missionInSettledState.missionFlattenMix, { min: 0.95, max: 1.01 }, "mission-in-settled flatten mix");
    assertRange(missionInSettledState.missionWhiteMix, { min: 0.9, max: 1.01 }, "mission-in-settled white mix");
    assertRange(missionInSettledState.missionEmblemMix, { min: 0.4, max: 0.75 }, "mission-in-settled emblem mix");
    assertRange(missionInSettledState.missionPanelProgress, { min: 0.95, max: 1.01 }, "mission-in-settled panel progress");
    assertRange(missionInSettledState.missionOutlineOpacity, { min: 0, max: 0.001 }, "mission-in-settled outline opacity");
    assert((worksOutroFlattenState.kvWallFlatten ?? 0) <= (missionInPanelState.kvWallFlatten ?? 0), "Expected mission_in wall flatten to inherit works_outro end state without rollback.");
    assert((missionInPanelState.kvWallFlatten ?? 0) <= (missionInSettledState.kvWallFlatten ?? 0), "Expected wall flatten to remain monotonic into mission_in settled.");
    assert((missionInSettledState.missionPanelProgress ?? 0) > (missionInPanelState.missionPanelProgress ?? 1), "Expected mission panel to continue rising into settled state.");
  }

  return layerStates;
}

async function withFreshBrowser(callback) {
  const freshBrowser = await launchValidationBrowser();
  try {
    return await callback(freshBrowser);
  } finally {
    await closeBrowserIfOpen(freshBrowser);
  }
}

async function assertPrismRefractionPerf(browser, shotId, options = {}) {
  const viewport = options.viewport ?? { width: 1440, height: 1080 };
  const shot = worksShotbook.shots.find((candidate) => candidate.id === shotId);
  assert(shot, `Missing shotbook entry for ${shotId}.`);
  const context = await browser.newContext({
    viewport,
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/?alcheHideDebugUi=1&alcheCardDebug=identity`, { waitUntil: "networkidle" });
    await assertTopPageShell(page, `prism-refraction-perf-${shotId}`);
    await page.waitForFunction(
      () =>
        typeof window.__setAlcheDebugOverride === "function" &&
        typeof window.__getAlcheLayerDebugState === "function",
      undefined,
      { timeout: 12000 },
    );
    await page.evaluate((nextOverride) => {
      window.__setAlcheDebugOverride?.(nextOverride);
    }, {
      shotId: shot.id,
      section: shot.section,
      progress: shot.progress,
      intro: shot.intro,
      heroShotId: null,
    });
    await page.waitForFunction(
      (expectedSection) => {
        const root = document.querySelector("[data-active-section]");
        const loadingOverlay = document.querySelector("[data-loading-overlay]");
        const state = window.__getAlcheLayerDebugState?.();
        return (
          root?.getAttribute("data-render-active-section") === expectedSection &&
          root?.getAttribute("data-render-intro-ready") === "true" &&
          loadingOverlay?.getAttribute("data-render-hidden") === "true" &&
          (state?.prismRefractionCaptureCount ?? 0) >= 1 &&
          Math.max(state?.prismRefractionTargetWidth ?? 0, state?.prismRefractionTargetHeight ?? 0) > 1
        );
      },
      shot.section,
      { timeout: 12000 },
    );
    // Wait for the damped pose to settle (a fixed 1.4s was too short for
    // shots with a larger scale step); still fails if it never goes idle.
    await page
      .waitForFunction(() => window.__getAlcheLayerDebugState?.()?.prismRefractionActiveMotion === false, undefined, {
        timeout: 6000,
      })
      .catch(() => {});
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.__getAlcheLayerDebugState?.() ?? null);
    await page.waitForTimeout(1100);
    const after = await page.evaluate(() => window.__getAlcheLayerDebugState?.() ?? null);

    assert(before && after, `Missing prism refraction perf state for ${shotId}.`);
    assert((after.prismFullOpacity ?? 0) >= 0.08, `Expected visible full prism during ${shotId} perf guard.`);
    assert(
      after.prismRefractionCaptureMode !== "active" || after.prismRefractionActiveMotion === false,
      `Expected ${shotId} to settle out of active refraction mode during idle perf guard.`,
    );
    assert(
      // Budget raised 512 -> 1024 for the clear-glass crystal (2026-09-27).
      Math.max(after.prismRefractionTargetWidth ?? 0, after.prismRefractionTargetHeight ?? 0) <= 1024,
      `Expected ${shotId} refraction target max dimension <= 1024, got ${after.prismRefractionTargetWidth}x${after.prismRefractionTargetHeight}.`,
    );
    const captureDelta = (after.prismRefractionCaptureCount ?? 0) - (before.prismRefractionCaptureCount ?? 0);
    assert(
      captureDelta <= 3,
      `Expected ${shotId} idle refraction captures to stay <= 3 per ~1.1s, got ${captureDelta}.`,
    );
  } finally {
    try {
      await context.close();
    } catch (error) {
      if (!isAlreadyClosedPlaywrightError(error)) {
        throw error;
      }
    }
  }
}

async function assertPrismRefractionActivePerf(browser, shotId, options = {}) {
  const viewport = options.viewport ?? { width: 1440, height: 1080 };
  const shot = worksShotbook.shots.find((candidate) => candidate.id === shotId);
  assert(shot, `Missing shotbook entry for ${shotId}.`);
  const context = await browser.newContext({
    viewport,
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/?alcheHideDebugUi=1&alcheCardDebug=identity`, { waitUntil: "networkidle" });
    await assertTopPageShell(page, `prism-refraction-active-perf-${shotId}`);
    await page.waitForFunction(
      () =>
        typeof window.__setAlcheDebugOverride === "function" &&
        typeof window.__getAlcheLayerDebugState === "function",
      undefined,
      { timeout: 12000 },
    );
    const startProgress = Math.max(0.04, shot.progress - 0.05);
    const endProgress = Math.min(0.96, shot.progress + 0.05);
    await page.evaluate((nextOverride) => {
      window.__setAlcheDebugOverride?.(nextOverride);
    }, {
      shotId: shot.id,
      section: shot.section,
      progress: startProgress,
      intro: shot.intro,
      heroShotId: null,
    });
    await page.waitForFunction(
      (expectedSection) => {
        const root = document.querySelector("[data-active-section]");
        const loadingOverlay = document.querySelector("[data-loading-overlay]");
        const state = window.__getAlcheLayerDebugState?.();
        return (
          root?.getAttribute("data-render-active-section") === expectedSection &&
          root?.getAttribute("data-render-intro-ready") === "true" &&
          loadingOverlay?.getAttribute("data-render-hidden") === "true" &&
          (state?.prismRefractionCaptureCount ?? 0) >= 1
        );
      },
      shot.section,
      { timeout: 12000 },
    );
    const before = await page.evaluate(() => window.__getAlcheLayerDebugState?.() ?? null);
    const activeSample = await page.evaluate(
      async ({ section, intro, heroShotId, start, end }) => {
        const steps = 30;
        const result = {
          activeSeen: false,
          activeTargetSeen: false,
          activeTargetMax: 0,
        };
        for (let index = 1; index <= steps; index += 1) {
          const t = index / steps;
          const eased = t * t * (3 - 2 * t);
          window.__setAlcheDebugOverride?.({
            section,
            progress: start + (end - start) * eased,
            intro,
            heroShotId,
          });
          await new Promise((resolve) => window.setTimeout(resolve, 33));
          const state = window.__getAlcheLayerDebugState?.();
          if (state?.prismRefractionCaptureMode === "active" || state?.prismRefractionActiveMotion === true) {
            result.activeSeen = true;
            if ((state.prismRefractionCaptureCount ?? 0) > 1) {
              result.activeTargetSeen = true;
              result.activeTargetMax = Math.max(
                result.activeTargetMax,
                state.prismRefractionTargetWidth ?? 0,
                state.prismRefractionTargetHeight ?? 0,
              );
            }
          }
        }
        return result;
      },
      {
        section: shot.section,
        intro: shot.intro,
        heroShotId: null,
        start: startProgress,
        end: endProgress,
      },
    );
    const after = await page.evaluate(() => window.__getAlcheLayerDebugState?.() ?? null);

    assert(before && after, `Missing prism active refraction state for ${shotId}.`);
    assert((after.prismFullOpacity ?? 0) >= 0.08, `Expected visible full prism during ${shotId} active perf guard.`);
    assert(
      activeSample.activeSeen,
      `Expected ${shotId} to enter active refraction mode during animated progress.`,
    );
    assert(
      activeSample.activeTargetSeen && activeSample.activeTargetMax <= 512,
      `Expected ${shotId} active refraction target max dimension <= 512, got ${activeSample.activeTargetMax}.`,
    );
    const captureDelta = (after.prismRefractionCaptureCount ?? 0) - (before.prismRefractionCaptureCount ?? 0);
    assert(
      captureDelta >= 10,
      `Expected ${shotId} active refraction captures to exceed low-frequency 5fps behavior, got ${captureDelta}.`,
    );
  } finally {
    try {
      await context.close();
    } catch (error) {
      if (!isAlreadyClosedPlaywrightError(error)) {
        throw error;
      }
    }
  }
}

async function captureFixedStatesWithFreshBrowsers(shots, options = {}) {
  const layerStates = new Map();
  for (const shot of shots) {
    const shotLayerStates = await withFreshBrowser((freshBrowser) => captureFixedStates(freshBrowser, [shot], options));
    for (const [key, value] of shotLayerStates.entries()) {
      layerStates.set(key, value);
    }
  }
  return layerStates;
}

async function capturePointerInteraction(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/?alchePointerDebug=1&alcheEndmarkTimeScale=240`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll("canvas").length >= 1, undefined, { timeout: 5000 });
    await assertTopPageShell(page, "kv-pointer-interaction");
    await page.waitForFunction(
      () =>
        typeof window.__setAlcheDebugOverride === "function" &&
        typeof window.__getAlchePointerDebugState === "function",
      undefined,
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      window.__setAlcheDebugOverride?.({
        section: "kv",
        progress: 1,
        intro: 1,
        heroShotId: null,
      });
    });
    await page.waitForFunction(
      () => {
        const root = document.querySelector("[data-active-section]");
        const loadingOverlay = document.querySelector("[data-loading-overlay]");
        return (
          root?.getAttribute("data-render-active-section") === "kv" &&
          root?.getAttribute("data-render-intro-ready") === "true" &&
          loadingOverlay?.getAttribute("data-render-hidden") === "true"
        );
      },
      undefined,
      { timeout: 5000 },
    );
    await page.waitForTimeout(400);

    const pointerSamples = [];
    for (const shot of pointerInteractionShots) {
      await page.mouse.move(shot.move.x, shot.move.y);
      await page.waitForFunction(
        ({ clientX, clientY, expectLeft }) => {
          const debug = window.__getAlchePointerDebugState?.();
          if (!debug) return false;
          const domMatches =
            debug.domPointerInside &&
            debug.domPointerClientX !== null &&
            debug.domPointerClientY !== null &&
            Math.abs(debug.domPointerClientX - clientX) < 6 &&
            Math.abs(debug.domPointerClientY - clientY) < 6;
          const r3fMatches = expectLeft
            ? debug.r3fPointerX < -0.45 && debug.r3fPointerY > 0.45
            : debug.r3fPointerX > 0.45 && debug.r3fPointerY < -0.35;
          return domMatches && r3fMatches;
        },
        {
          clientX: shot.move.x,
          clientY: shot.move.y,
          expectLeft: shot.name.includes("left"),
        },
        { timeout: 5000 },
      );
      await page.waitForTimeout(120);
      const debug = await page.evaluate(() => window.__getAlchePointerDebugState?.() ?? null);
      pointerSamples.push({ name: shot.name, debug });
      await page.screenshot({
        path: path.join(outputDir, `${shot.name}.png`),
        fullPage: false,
      });
    }

    const leftDebug = pointerSamples[0]?.debug;
    const rightDebug = pointerSamples[1]?.debug;
    assert(leftDebug && rightDebug, "Missing pointer debug samples.");
    assert(leftDebug.domPointerInside && rightDebug.domPointerInside, "Expected DOM pointer to enter the canvas event source.");
    assert(leftDebug.r3fPointerX < rightDebug.r3fPointerX, "Expected real mouse movement to change R3F pointer x.");
    assert(leftDebug.r3fPointerY > rightDebug.r3fPointerY, "Expected real mouse movement to change R3F pointer y.");
  } finally {
    await context.close();
  }
}

async function captureRealWheelHandoff(browser, options = {}) {
  const viewport = options.viewport ?? { width: 1440, height: 1080 };
  const fileSuffix = options.fileSuffix ?? "";
  const scrollSettleTimeoutMs = options.scrollSettleTimeoutMs ?? 1200;
  const stepWaitMs = options.stepWaitMs ?? 140;
  const captureSearch = options.captureMode ? "&alcheCapture=1" : "";
  const context = await browser.newContext({
    viewport,
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/?alchePointerDebug=1&alcheEndmarkTimeScale=240${captureSearch}`, { waitUntil: "networkidle" });
    await assertTopPageShell(page, "works-wheel-handoff");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-active-section]")?.getAttribute("data-intro-ready") === "true" &&
        typeof window.__getAlcheLayerDebugState === "function",
      undefined,
      { timeout: 12000 },
    );
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    const readLiveSnapshot = async (stepLabel) =>
      page.evaluate((resolvedStepLabel) => {
        const root = document.querySelector("[data-active-section]");
        const layerState = window.__getAlcheLayerDebugState?.() ?? null;
        const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        return {
          step: resolvedStepLabel,
          scrollY: Math.round(window.scrollY),
          maxScroll: Math.round(maxScroll),
          active: root?.getAttribute("data-active-section"),
          tracked: root?.getAttribute("data-tracked-section"),
          introReady: root?.getAttribute("data-intro-ready"),
          sceneActive: layerState?.sceneActiveSection ?? null,
          missionTurnProgress: layerState?.missionTurnProgress ?? null,
          visionCoverProgress: layerState?.visionCoverProgress ?? null,
          prismGroupScale: layerState?.prismGroupScale ?? null,
          handoff: layerState?.worksHandoff ?? null,
          worksOpacity: layerState?.worksOpacity ?? null,
          moonflowOpacity: layerState?.moonflowOpacity ?? null,
          worksWorldX: layerState?.worksWorldX ?? null,
          worksRotationY: layerState?.worksRotationY ?? null,
          modelWorldZ: layerState?.modelWorldZ ?? null,
          worksWorldZ: layerState?.worksWorldZ ?? null,
          cardsOpacity: layerState?.cardsOpacity ?? null,
          cardsLeadIndex: layerState?.cardsLeadIndex ?? null,
          card0Visible: layerState?.card0Visible ?? false,
          card1Visible: layerState?.card1Visible ?? false,
          card0FacingError: layerState?.card0FacingError ?? null,
          card1FacingError: layerState?.card1FacingError ?? null,
          worksOutroClearMix: layerState?.worksOutroClearMix ?? null,
          missionFlattenMix: layerState?.missionFlattenMix ?? null,
          missionWhiteMix: layerState?.missionWhiteMix ?? null,
          missionEmblemMix: layerState?.missionEmblemMix ?? null,
          missionPanelProgress: layerState?.missionPanelProgress ?? null,
          missionOutlineOpacity: layerState?.missionOutlineOpacity ?? null,
          kvWallFlatten: layerState?.kvWallFlatten ?? null,
          viewportWidth: layerState?.viewportWidth ?? null,
          viewportHeight: layerState?.viewportHeight ?? null,
          card0ScreenLeft: layerState?.card0ScreenLeft ?? null,
          card0ScreenRight: layerState?.card0ScreenRight ?? null,
          card0ScreenTop: layerState?.card0ScreenTop ?? null,
          card0ScreenBottom: layerState?.card0ScreenBottom ?? null,
          card1ScreenLeft: layerState?.card1ScreenLeft ?? null,
          card1ScreenRight: layerState?.card1ScreenRight ?? null,
          card1ScreenTop: layerState?.card1ScreenTop ?? null,
          card1ScreenBottom: layerState?.card1ScreenBottom ?? null,
        };
      }, stepLabel);
    const scrollPositions = await page.evaluate(() => {
      const activeViewportLine = window.innerHeight * 0.38;
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const readSectionTop = (sectionId) => {
        const node = document.querySelector(`[data-top_section="${sectionId}"]`);
        if (!(node instanceof HTMLElement)) return null;
        const rect = node.getBoundingClientRect();
        return rect.top + window.scrollY - activeViewportLine;
      };
      const worksCardsStart = readSectionTop("works_cards");
      const worksOutroStart = readSectionTop("works_outro");
      const missionInStart = readSectionTop("mission_in");

      const positions = [];
      const pushRange = (from, to, steps) => {
        if (!Number.isFinite(from) || !Number.isFinite(to)) return;
        const clampedFrom = Math.max(0, Math.min(maxScroll, from));
        const clampedTo = Math.max(0, Math.min(maxScroll, to));
        const segments = Math.max(steps - 1, 1);
        for (let index = 0; index < steps; index += 1) {
          positions.push(Math.round(clampedFrom + ((clampedTo - clampedFrom) * index) / segments));
        }
      };

      if (worksCardsStart === null || worksOutroStart === null || missionInStart === null) {
        const fallbackSteps = 240;
        for (let step = 0; step < fallbackSteps; step += 1) {
          positions.push(Math.round((maxScroll * step) / Math.max(fallbackSteps - 1, 1)));
        }
      } else {
        pushRange(0, worksCardsStart, 48);
        pushRange(worksCardsStart, worksOutroStart, 88);
        pushRange(worksOutroStart, missionInStart, 72);
        pushRange(missionInStart, maxScroll, 44);
      }

      return Array.from(new Set(positions)).sort((left, right) => left - right);
    });

    const samples = [];
    const capturedShots = new Set();
    const capturedStates = new Map();

    // Validate the live scroll-owned choreography by stepping through actual page
    // positions. Raw Playwright wheel events were skipping the intermediate
    // sections under this sticky/Lenis setup, while direct scroll positions track
    // the real user-visible section ownership correctly.
    for (let step = 0; step < scrollPositions.length; step += 1) {
      const top = scrollPositions[step];
      await page.evaluate((nextTop) => {
        window.scrollTo(0, nextTop);
      }, top);
      await page
        .waitForFunction((expectedTop) => Math.abs(window.scrollY - expectedTop) <= 2, top, {
          timeout: scrollSettleTimeoutMs,
        })
        .catch(() => {});
      await page.waitForTimeout(stepWaitMs);
      const snapshot = await readLiveSnapshot(step);
      samples.push(snapshot);

      if (
        !capturedShots.has("cards-wheel-entry") &&
        (snapshot.worksOpacity ?? 1) <= 0.08 &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === false
      ) {
        await page.screenshot({
          path: path.join(outputDir, `cards-wheel-entry${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("cards-wheel-entry");
        capturedStates.set("cards-wheel-entry", snapshot);
      }

      if (
        !capturedShots.has("cards-wheel-center") &&
        (snapshot.worksOpacity ?? 1) <= 0.08 &&
        (snapshot.cardsOpacity ?? 0) > 0.98 &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === false &&
        matchesCardInLane(snapshot, 0, laneTargets.leadCenter)
      ) {
        await page.screenshot({
          path: path.join(outputDir, `cards-wheel-center${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("cards-wheel-center");
        capturedStates.set("cards-wheel-center", snapshot);
      }

      if (
        !capturedShots.has("cards-wheel-queue") &&
        (snapshot.worksOpacity ?? 1) <= 0.08 &&
        (snapshot.cardsOpacity ?? 0) > 0.98 &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === true &&
        snapshot.cardsLeadIndex === 0 &&
        matchesCardInLane(snapshot, 0, laneTargets.leadCenter) &&
        matchesCardInLane(snapshot, 1, laneTargets.queueRight) &&
        matchesCardSeparation(snapshot, 12)
      ) {
        await page.screenshot({
          path: path.join(outputDir, `cards-wheel-queue${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("cards-wheel-queue");
        capturedStates.set("cards-wheel-queue", snapshot);
      }

      const queueState = capturedStates.get("cards-wheel-queue");
      if (
        !capturedShots.has("cards-wheel-handoff") &&
        queueState &&
        (snapshot.worksOpacity ?? 1) <= 0.08 &&
        (snapshot.cardsOpacity ?? 0) > 0.98 &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === true &&
        matchesCardSeparation(snapshot, 12) &&
        getCardScreenCenterX(snapshot, 0) < getCardScreenCenterX(queueState, 0) - 40 &&
        getCardScreenCenterX(snapshot, 1) < getCardScreenCenterX(queueState, 1) - 40 &&
        getCardScreenCenterY(snapshot, 0) < getCardScreenCenterY(queueState, 0) + 10 &&
        getCardScreenCenterY(snapshot, 1) < getCardScreenCenterY(queueState, 1) - 30
      ) {
        await page.screenshot({
          path: path.join(outputDir, `cards-wheel-handoff${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("cards-wheel-handoff");
        capturedStates.set("cards-wheel-handoff", snapshot);
      }

      if (
        !capturedShots.has("works-outro-wheel-entry") &&
        snapshot.active === "works_outro" &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === true &&
        snapshot.cardsLeadIndex === 1 &&
        (snapshot.cardsOpacity ?? 0) >= 0.55
      ) {
        await page.screenshot({
          path: path.join(outputDir, `works-outro-wheel-entry${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("works-outro-wheel-entry");
        capturedStates.set("works-outro-wheel-entry", snapshot);
      }

      if (
        !capturedShots.has("works-outro-wheel-flatten") &&
        snapshot.active === "works_outro" &&
        (snapshot.worksOutroClearMix ?? 0) >= 0.88 &&
        (snapshot.cardsOpacity ?? 0) <= 0.34 &&
        snapshot.card0Visible === true
      ) {
        await page.screenshot({
          path: path.join(outputDir, `works-outro-wheel-flatten${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("works-outro-wheel-flatten");
        capturedStates.set("works-outro-wheel-flatten", snapshot);
      }

      if (
        !capturedShots.has("mission-in-wheel-panel") &&
        snapshot.active === "mission_in" &&
        (snapshot.cardsOpacity ?? 0) <= 0.02 &&
        (snapshot.missionPanelProgress ?? 0) >= 0.72
      ) {
        await page.screenshot({
          path: path.join(outputDir, `mission-in-wheel-panel${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("mission-in-wheel-panel");
        capturedStates.set("mission-in-wheel-panel", snapshot);
      }

      if (
        !capturedShots.has("mission-in-wheel-settled") &&
        snapshot.active === "mission_in" &&
        (snapshot.cardsOpacity ?? 0) <= 0.02 &&
        (snapshot.missionPanelProgress ?? 0) >= 0.9
      ) {
        await page.screenshot({
          path: path.join(outputDir, `mission-in-wheel-settled${fileSuffix}.png`),
          fullPage: false,
        });
        capturedShots.add("mission-in-wheel-settled");
        capturedStates.set("mission-in-wheel-settled", snapshot);
      }

      if (capturedShots.size >= 8) {
        break;
      }
    }

    const handoffSamples = samples.filter((sample) => sample.handoff !== null);
    const cardsWheelEntry = capturedStates.get("cards-wheel-entry");
    const cardsWheelCenter = capturedStates.get("cards-wheel-center");
    const cardsWheelQueue = capturedStates.get("cards-wheel-queue");
    const cardsWheelHandoff = capturedStates.get("cards-wheel-handoff");
    const worksOutroWheelEntry = capturedStates.get("works-outro-wheel-entry");
    const worksOutroWheelFlatten = capturedStates.get("works-outro-wheel-flatten");
    const missionInWheelPanel = capturedStates.get("mission-in-wheel-panel");
    const missionInWheelSettled = capturedStates.get("mission-in-wheel-settled");
    const firstVisibleCardsIndex = samples.findIndex((sample) => sample.card0Visible === true);
    const firstVisibleCardsSample = firstVisibleCardsIndex >= 0 ? samples[firstVisibleCardsIndex] : null;
    const cardSequenceSamples =
      firstVisibleCardsIndex >= 0 && worksOutroWheelEntry
        ? samples.slice(firstVisibleCardsIndex, worksOutroWheelEntry.step + 1)
        : firstVisibleCardsIndex >= 0
          ? samples.slice(firstVisibleCardsIndex)
          : [];

    assert(cardsWheelEntry, "Expected real scrolling to capture card A entering from the right-lower lane.");
    assert(cardsWheelCenter, "Expected real scrolling to capture card A reaching center before B appears.");
    assert(cardsWheelQueue, "Expected real scrolling to capture card B queuing from the right-lower lane.");
    assert(cardsWheelHandoff, "Expected real scrolling to capture the A-left / B-center handoff.");
    assert(worksOutroWheelEntry, "Expected real scrolling to capture works_outro entry.");
    assert(worksOutroWheelFlatten, "Expected real scrolling to capture works_outro flatten.");
    assert(missionInWheelPanel, "Expected real scrolling to capture mission_in panel takeover.");
    assert(missionInWheelSettled, "Expected real scrolling to capture mission_in settled takeover.");
    assert(cardsWheelEntry.step < cardsWheelCenter.step, "Expected wheel entry to occur before wheel center.");
    assert(cardsWheelCenter.step < cardsWheelQueue.step, "Expected wheel center to occur before B queues.");
    assert(cardsWheelQueue.step < cardsWheelHandoff.step, "Expected B queue to occur before the handoff mid-state.");
    assert(cardsWheelHandoff.step < worksOutroWheelEntry.step, "Expected works_outro to begin after the card handoff.");
    assert(worksOutroWheelEntry.step < worksOutroWheelFlatten.step, "Expected works_outro flatten to occur after works_outro entry.");
    assert(worksOutroWheelFlatten.step < missionInWheelPanel.step, "Expected mission_in panel to begin after works_outro flatten.");
    assert(missionInWheelPanel.step < missionInWheelSettled.step, "Expected mission_in settled to occur after mission_in panel.");
    assert(firstVisibleCardsSample, "Expected real wheel scrolling to eventually reveal cards.");
    assert((firstVisibleCardsSample.worksOpacity ?? 1) <= 0.08, "Expected WORKS to be gone before cards first appear during real scrolling.");
    assert(firstVisibleCardsSample.card0Visible === true && firstVisibleCardsSample.card1Visible === false, "Expected only card A to appear first during real scrolling.");
    assert(
      !samples.slice(0, firstVisibleCardsIndex).some((sample) => sample.card1Visible === true),
      "Expected card B to remain hidden until after card A has already appeared.",
    );
    assert(
      !cardSequenceSamples.some((sample) => (sample.cardsOpacity ?? 0) < 0.5),
      "Expected cards to stay on-screen until works_outro begins.",
    );
    assertCardInLane(cardsWheelCenter, 0, laneTargets.leadCenter, "cards-wheel-center");
    assertCardInLane(cardsWheelQueue, 0, laneTargets.leadCenter, "cards-wheel-queue");
    assertCardInLane(cardsWheelQueue, 1, laneTargets.queueRight, "cards-wheel-queue");
    assertCardSeparation(cardsWheelQueue, 12, "cards-wheel-queue");
    assertCardSeparation(cardsWheelHandoff, 12, "cards-wheel-handoff");
    assertFacingError(cardsWheelEntry, 0, 0.06, "cards-wheel-entry");
    assertFacingError(cardsWheelCenter, 0, 0.06, "cards-wheel-center");
    assertFacingError(cardsWheelQueue, 0, 0.06, "cards-wheel-queue");
    assertFacingError(cardsWheelQueue, 1, 0.06, "cards-wheel-queue");
    assertFacingError(cardsWheelHandoff, 0, 0.06, "cards-wheel-handoff");
    assertFacingError(cardsWheelHandoff, 1, 0.06, "cards-wheel-handoff");
    assert(getCardScreenCenterX(cardsWheelEntry, 0) > getCardScreenCenterX(cardsWheelCenter, 0) + 40, "Expected first wheel-visible A to start to the right of center.");
    assert(getCardScreenCenterY(cardsWheelEntry, 0) > getCardScreenCenterY(cardsWheelCenter, 0) + 20, "Expected first wheel-visible A to start below center.");
    assert(getCardScreenCenterX(cardsWheelEntry, 0) > getCardScreenCenterX(cardsWheelCenter, 0), "Expected wheel A to move left from entry into center.");
    assert(getCardScreenCenterY(cardsWheelEntry, 0) > getCardScreenCenterY(cardsWheelCenter, 0), "Expected wheel A to move upward from entry into center.");
    assert(getCardScreenCenterX(cardsWheelCenter, 0) > getCardScreenCenterX(cardsWheelHandoff, 0), "Expected wheel A to start moving left only after it reaches center.");
    assert(getCardScreenCenterX(cardsWheelQueue, 1) > getCardScreenCenterX(cardsWheelHandoff, 1), "Expected wheel B to move left from queue toward center.");
    assert(getCardScreenCenterY(cardsWheelQueue, 1) > getCardScreenCenterY(cardsWheelHandoff, 1), "Expected wheel B to move upward from queue toward center.");
    assert((worksOutroWheelEntry.worksOpacity ?? 1) <= 0.08, "Expected WORKS to stay gone when works_outro starts during real scrolling.");
    assert((worksOutroWheelEntry.cardsOpacity ?? 0) >= 0.82, "Expected cards to remain dominant at works_outro entry during real scrolling.");
    assert((worksOutroWheelFlatten.cardsOpacity ?? 0) < (worksOutroWheelEntry.cardsOpacity ?? 1), "Expected cards to clear during works_outro flatten in real scrolling.");
    assert(getCardScreenCenterX(worksOutroWheelFlatten, 1) < getCardScreenCenterX(worksOutroWheelEntry, 1), "Expected B to move left during real-scroll works_outro clearing.");
    assert((worksOutroWheelEntry.kvWallFlatten ?? 0) < (worksOutroWheelFlatten.kvWallFlatten ?? 0), "Expected wall flatten to keep increasing through real-scroll works_outro.");
    assert((missionInWheelPanel.cardsOpacity ?? 0) <= 0.02, "Expected cards to be gone by mission_in panel during real scrolling.");
    assert((missionInWheelPanel.missionPanelProgress ?? 0) >= 0.72, "Expected mission panel to be established during mission_in panel shot.");
    assertRange(missionInWheelPanel.missionOutlineOpacity, { min: 0, max: 0.001 }, "mission-in-wheel-panel outline opacity");
    assert((worksOutroWheelFlatten.kvWallFlatten ?? 0) <= (missionInWheelPanel.kvWallFlatten ?? 0), "Expected mission_in flatten to inherit works_outro progress during real scrolling.");
    assert((missionInWheelPanel.kvWallFlatten ?? 0) <= (missionInWheelSettled.kvWallFlatten ?? 0), "Expected wall flatten to remain monotonic into mission_in settled during real scrolling.");
    assert((missionInWheelSettled.missionPanelProgress ?? 0) > (missionInWheelPanel.missionPanelProgress ?? 1), "Expected mission panel to continue rising into settled state.");
    assertRange(missionInWheelSettled.missionOutlineOpacity, { min: 0, max: 0.001 }, "mission-in-wheel-settled outline opacity");

    for (let index = 1; index < handoffSamples.length; index += 1) {
      const previous = handoffSamples[index - 1].handoff ?? 0;
      const next = handoffSamples[index].handoff ?? 0;
      assert(next + 0.02 >= previous, "Expected real wheel handoff to stay monotonic while scrolling down.");
    }
  } finally {
    await context.close();
  }
}

async function captureWorksOutroWheelFocused(browser, options = {}) {
  const viewport = options.viewport ?? ultraWideViewport;
  const fileSuffix = options.fileSuffix ?? "";
  const requireMissionPanel = options.requireMissionPanel ?? true;
  const captureMode = options.captureMode ?? true;
  const captureEdgeState = options.captureEdgeState ?? false;
  const captureEntryState = options.captureEntryState ?? true;
  const captureFlattenState = options.captureFlattenState ?? true;
  const requireEntryState = options.requireEntryState ?? true;
  const requireFlattenState = options.requireFlattenState ?? true;
  const requireMissionBridge = options.requireMissionBridge ?? requireMissionPanel;
  const pointerDebug = options.pointerDebug ?? true;
  const captureSearch = captureMode ? "&alcheCapture=1" : "";
  const pointerDebugSearch = pointerDebug ? "&alchePointerDebug=1" : "";
  const context = await browser.newContext({
    viewport,
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/?alcheEndmarkTimeScale=240&alcheHideDebugUi=1${pointerDebugSearch}${captureSearch}`, {
      waitUntil: "networkidle",
    });
    await assertTopPageShell(page, `works-outro-wheel-focused${fileSuffix}`);
    await page.waitForFunction(
      () =>
        document.querySelector("[data-active-section]")?.getAttribute("data-intro-ready") === "true" &&
        typeof window.__getAlcheLayerDebugState === "function",
      undefined,
      { timeout: 12000 },
    );

    const scrollPositions = await page.evaluate(() => {
      const activeViewportLine = window.innerHeight * 0.38;
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const readSectionTop = (sectionId) => {
        const node = document.querySelector(`[data-top_section="${sectionId}"]`);
        if (!(node instanceof HTMLElement)) return null;
        const rect = node.getBoundingClientRect();
        return rect.top + window.scrollY - activeViewportLine;
      };
      const worksOutroStart = readSectionTop("works_outro");
      const missionInStart = readSectionTop("mission_in");
      if (worksOutroStart === null || missionInStart === null) return [];

      const from = Math.max(0, Math.min(maxScroll, worksOutroStart - window.innerHeight * 0.04));
      const to = Math.max(0, Math.min(maxScroll, missionInStart + window.innerHeight * 0.85));
      const steps = 72;
      return Array.from({ length: steps }, (_, index) => {
        const ratio = index / Math.max(steps - 1, 1);
        return Math.round(from + (to - from) * ratio);
      });
    });

    assert(scrollPositions.length > 0, "Expected works_outro and mission_in scroll anchors for focused wheel validation.");

    const readFocusedSnapshot = async (stepLabel) =>
      page.evaluate((resolvedStepLabel) => {
        const root = document.querySelector("[data-active-section]");
        const layerState = window.__getAlcheLayerDebugState?.() ?? null;
        return {
          step: resolvedStepLabel,
          scrollY: Math.round(window.scrollY),
          active: root?.getAttribute("data-active-section"),
          cardsOpacity: layerState?.cardsOpacity ?? null,
          cardsLeadIndex: layerState?.cardsLeadIndex ?? null,
          card0Visible: layerState?.card0Visible ?? false,
          card1Visible: layerState?.card1Visible ?? false,
          worksOutroClearMix: layerState?.worksOutroClearMix ?? null,
          kvWallFlatten: layerState?.kvWallFlatten ?? null,
          missionPanelProgress: layerState?.missionPanelProgress ?? null,
          missionOutlineOpacity: layerState?.missionOutlineOpacity ?? null,
          prismFullOpacity: layerState?.prismFullOpacity ?? null,
          prismEdgeOpacity: layerState?.prismEdgeOpacity ?? null,
          prismLineOpacity: layerState?.prismLineOpacity ?? null,
          card0ScreenLeft: layerState?.card0ScreenLeft ?? null,
          card0ScreenRight: layerState?.card0ScreenRight ?? null,
          card1ScreenLeft: layerState?.card1ScreenLeft ?? null,
          card1ScreenRight: layerState?.card1ScreenRight ?? null,
        };
      }, stepLabel);

    const samples = [];
    const capturedStates = new Map();

    for (let step = 0; step < scrollPositions.length; step += 1) {
      const top = scrollPositions[step];
      await page.evaluate((nextTop) => {
        window.scrollTo(0, nextTop);
      }, top);
      await page
        .waitForFunction((expectedTop) => Math.abs(window.scrollY - expectedTop) <= 2, top, {
          timeout: 180,
        })
        .catch(() => {});
      await page.waitForTimeout(70);

      const snapshot = await readFocusedSnapshot(step);
      samples.push(snapshot);

      if (
        captureEntryState &&
        !capturedStates.has("works-outro-wheel-entry") &&
        snapshot.active === "works_outro" &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === true &&
        snapshot.cardsLeadIndex === 1 &&
        (snapshot.cardsOpacity ?? 0) >= 0.55
      ) {
        console.log(`Capturing works-outro-wheel-entry${fileSuffix}...`);
        await page.screenshot({
          path: path.join(outputDir, `works-outro-wheel-entry${fileSuffix}.png`),
          fullPage: false,
        });
        capturedStates.set("works-outro-wheel-entry", snapshot);
      }

      if (
        captureEdgeState &&
        !capturedStates.has("works-outro-wheel-unroll-edge") &&
        snapshot.active === "works_outro" &&
        snapshot.card0Visible === true &&
        snapshot.card1Visible === true &&
        snapshot.cardsLeadIndex === 1 &&
        (snapshot.cardsOpacity ?? 0) >= 0.45 &&
        (snapshot.worksOutroClearMix ?? 0) >= 0.22 &&
        (snapshot.worksOutroClearMix ?? 0) <= 0.74 &&
        (snapshot.kvWallFlatten ?? 0) >= 0.08
      ) {
        console.log(`Capturing works-outro-wheel-unroll-edge${fileSuffix}...`);
        const screenshot = await page.screenshot({
          path: path.join(outputDir, `works-outro-wheel-unroll-edge${fileSuffix}.png`),
          fullPage: false,
        });
        await assertRightBandBlackRatio(page, screenshot, `works-outro-wheel-unroll-edge${fileSuffix}`);
        capturedStates.set("works-outro-wheel-unroll-edge", snapshot);
      }

      if (
        captureFlattenState &&
        !capturedStates.has("works-outro-wheel-flatten") &&
        snapshot.active === "works_outro" &&
        (snapshot.worksOutroClearMix ?? 0) >= 0.88 &&
        (snapshot.cardsOpacity ?? 0) <= 0.34 &&
        snapshot.card0Visible === true
      ) {
        console.log(`Capturing works-outro-wheel-flatten${fileSuffix}...`);
        await page.screenshot({
          path: path.join(outputDir, `works-outro-wheel-flatten${fileSuffix}.png`),
          fullPage: false,
        });
        capturedStates.set("works-outro-wheel-flatten", snapshot);
      }

      if (
        !capturedStates.has("mission-in-wheel-bridge") &&
        snapshot.active === "mission_in" &&
        (snapshot.cardsOpacity ?? 0) <= 0.04 &&
        (snapshot.missionPanelProgress ?? 0) >= 0.43 &&
        (snapshot.missionPanelProgress ?? 0) <= 0.68
      ) {
        console.log(`Capturing mission-in-wheel-bridge${fileSuffix}...`);
        await page.screenshot({
          path: path.join(outputDir, `mission-in-wheel-bridge${fileSuffix}.png`),
          fullPage: false,
        });
        capturedStates.set("mission-in-wheel-bridge", snapshot);
      }

      if (
        !capturedStates.has("mission-in-wheel-panel") &&
        snapshot.active === "mission_in" &&
        (snapshot.cardsOpacity ?? 0) <= 0.02 &&
        (snapshot.missionPanelProgress ?? 0) >= 0.72
      ) {
        console.log(`Capturing mission-in-wheel-panel${fileSuffix}...`);
        await page.screenshot({
          path: path.join(outputDir, `mission-in-wheel-panel${fileSuffix}.png`),
          fullPage: false,
        });
        capturedStates.set("mission-in-wheel-panel", snapshot);
      }

      if (
        (!captureEntryState || capturedStates.has("works-outro-wheel-entry")) &&
        (!captureFlattenState || capturedStates.has("works-outro-wheel-flatten")) &&
        (!captureEdgeState || capturedStates.has("works-outro-wheel-unroll-edge")) &&
        (!requireMissionBridge || capturedStates.has("mission-in-wheel-bridge")) &&
        (!requireMissionPanel || capturedStates.has("mission-in-wheel-panel"))
      ) {
        break;
      }
    }

    const worksOutroWheelEntry = capturedStates.get("works-outro-wheel-entry");
    const worksOutroWheelUnrollEdge = capturedStates.get("works-outro-wheel-unroll-edge");
    const worksOutroWheelFlatten = capturedStates.get("works-outro-wheel-flatten");
    const missionInWheelBridge = capturedStates.get("mission-in-wheel-bridge");
    const missionInWheelPanel = capturedStates.get("mission-in-wheel-panel");

    if (requireEntryState) {
      assert(worksOutroWheelEntry, "Expected focused scrolling to capture works_outro entry.");
    }
    if (captureEdgeState) {
      assert(worksOutroWheelUnrollEdge, "Expected focused scrolling to capture works_outro edge coverage state.");
    }
    if (requireFlattenState) {
      assert(worksOutroWheelFlatten, "Expected focused scrolling to capture works_outro flatten.");
    }
    if (worksOutroWheelEntry && worksOutroWheelFlatten) {
      assert(
        worksOutroWheelEntry.step < worksOutroWheelFlatten.step,
        "Expected focused works_outro flatten to occur after works_outro entry.",
      );
      assert(
        (worksOutroWheelEntry.kvWallFlatten ?? 0) < (worksOutroWheelFlatten.kvWallFlatten ?? 0),
        "Expected focused wall flatten to increase during works_outro.",
      );
      assert(
        (worksOutroWheelFlatten.cardsOpacity ?? 0) < (worksOutroWheelEntry.cardsOpacity ?? 1),
        "Expected focused cards opacity to clear during works_outro flatten.",
      );
    }

    if (requireMissionBridge) {
      assert(missionInWheelBridge, "Expected focused scrolling to capture mission_in prism bridge.");
      assert(
        getPrismVisibleOpacity(missionInWheelBridge) >= 0.08,
        "Expected at least one prism layer visible during focused mission bridge.",
      );
      assertRange(missionInWheelBridge.missionPanelProgress, { min: 0.43, max: 0.68 }, "focused mission bridge panel progress");
    }

    if (requireMissionPanel) {
      assert(missionInWheelPanel, "Expected focused scrolling to capture mission_in panel takeover.");
      if (worksOutroWheelFlatten) {
        assert(
          worksOutroWheelFlatten.step < missionInWheelPanel.step,
          "Expected focused mission panel to begin after works_outro flatten.",
        );
        assert(
          (worksOutroWheelFlatten.kvWallFlatten ?? 0) <= (missionInWheelPanel.kvWallFlatten ?? 0),
          "Expected focused mission_in flatten to inherit works_outro progress.",
        );
      }
      if (missionInWheelBridge) {
        assert(
          missionInWheelBridge.step < missionInWheelPanel.step,
          "Expected focused mission bridge to happen before mission panel takeover.",
        );
      }
      assertRange(missionInWheelPanel.missionOutlineOpacity, { min: 0, max: 0.001 }, "focused mission panel outline opacity");
    }

    const flattenSamples = samples.filter((sample) => sample.kvWallFlatten !== null);
    for (let index = 1; index < flattenSamples.length; index += 1) {
      const previous = flattenSamples[index - 1].kvWallFlatten ?? 0;
      const next = flattenSamples[index].kvWallFlatten ?? 0;
      assert(next + 0.02 >= previous, "Expected focused kvWallFlatten to stay monotonic while scrolling down.");
    }
  } finally {
    try {
      await context.close();
    } catch (error) {
      if (!isAlreadyClosedPlaywrightError(error)) {
        throw error;
      }
    }
  }
}

async function captureVisionCoverLiveEndState(browser, options = {}) {
  const viewport = options.viewport ?? ultraWideViewport;
  const fileSuffix = options.fileSuffix ?? "";
  const disableEndmark = options.disableEndmark ?? false;
  const context = await browser.newContext({
    viewport,
    locale: "en-US",
    reducedMotion: "no-preference",
  });

  try {
    const page = await context.newPage();
    const search = disableEndmark ? "?alchePointerDebug=1&alcheDisableEndmark=1" : "?alchePointerDebug=1";
    await page.goto(`${baseUrl}/en/${search}`, { waitUntil: "networkidle" });
    await assertTopPageShell(page, "vision-cover-live-end");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-active-section]")?.getAttribute("data-intro-ready") === "true" &&
        typeof window.__getAlcheLayerDebugState === "function",
      undefined,
      { timeout: 12000 },
    );
    await page.mouse.move(viewport.width / 2, viewport.height / 2);

    const readSnapshot = async (stepLabel) =>
      page.evaluate((resolvedStepLabel) => {
        const root = document.querySelector("[data-active-section]");
        const layerState = window.__getAlcheLayerDebugState?.() ?? null;
        const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        return {
          step: resolvedStepLabel,
          scrollY: Math.round(window.scrollY),
          maxScroll: Math.round(maxScroll),
          active: root?.getAttribute("data-active-section"),
          tracked: root?.getAttribute("data-tracked-section"),
          sceneActive: layerState?.sceneActiveSection ?? null,
          missionTurnProgress: layerState?.missionTurnProgress ?? null,
          visionCoverProgress: layerState?.visionCoverProgress ?? null,
          prismGroupScale: layerState?.prismGroupScale ?? null,
          viewportWidth: layerState?.viewportWidth ?? null,
          viewportHeight: layerState?.viewportHeight ?? null,
        };
      }, stepLabel);

    // Since service/stellla/outro were appended after vision (07-13 pass), the
    // document bottom is the outro. The cover end-state lives where vision
    // leaves the active viewport line (getVisionCoverProgress end).
    const settleAtBottom = async (targetScroll) => {
      let previousSnapshot = null;
      let stableSamples = 0;

      for (let attempt = 0; attempt < 24; attempt += 1) {
        const snapshot = await readSnapshot(`vision-live-bottom-${attempt}`);
        const atBottom = Math.abs((snapshot.scrollY ?? 0) - targetScroll) <= 2;
        const coverReady = (snapshot.visionCoverProgress ?? 0) >= 0.98;
        const scaleReady = (snapshot.prismGroupScale ?? 0) >= 3.95;
        const scaleDelta =
          previousSnapshot === null
            ? Number.POSITIVE_INFINITY
            : Math.abs((snapshot.prismGroupScale ?? 0) - (previousSnapshot.prismGroupScale ?? 0));

        if (atBottom && coverReady && scaleReady && scaleDelta <= 0.0025) {
          stableSamples += 1;
        } else {
          stableSamples = 0;
        }

        previousSnapshot = snapshot;

        if (stableSamples >= 3) {
          return snapshot;
        }

        await page.waitForTimeout(160);
      }

      return readSnapshot("vision-live-bottom-timeout");
    };

    const scrollTargets = await page.evaluate(() => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const viewportLine = window.innerHeight * 0.38;
      const visionNode = document.querySelector('[data-top_section="vision"]');
      if (!(visionNode instanceof HTMLElement)) {
        return {
          visionStart: null,
          visionEnd: maxScroll,
          maxScroll,
        };
      }

      const rect = visionNode.getBoundingClientRect();
      const visionTop = rect.top + window.scrollY;
      return {
        visionStart: Math.max(0, Math.min(maxScroll, Math.round(visionTop - viewportLine))),
        visionEnd: Math.max(0, Math.min(maxScroll, Math.round(visionTop + visionNode.offsetHeight - viewportLine + 4))),
        maxScroll,
      };
    });

    if (scrollTargets.visionStart !== null) {
      await page.evaluate((nextTop) => {
        window.scrollTo(0, nextTop);
      }, scrollTargets.visionStart);
      await page
        .waitForFunction((expectedTop) => Math.abs(window.scrollY - expectedTop) <= 2, scrollTargets.visionStart, {
          timeout: 1600,
        })
        .catch(() => {});
      await page.waitForTimeout(220);
    }

    await page.evaluate((nextTop) => {
      window.scrollTo(0, nextTop);
    }, scrollTargets.visionEnd);
    await page
      .waitForFunction((expectedTop) => Math.abs(window.scrollY - expectedTop) <= 2, scrollTargets.visionEnd, {
        timeout: 2200,
      })
      .catch(() => {});

    const bottomSnapshot = await settleAtBottom(scrollTargets.visionEnd);

    await page.screenshot({
      path: path.join(outputDir, `vision-cover-live-wheel-bottom${fileSuffix}.png`),
      fullPage: false,
    });

    assert((bottomSnapshot.visionCoverProgress ?? 0) >= 0.98, "Expected wide live end-state to reach full vision cover progress.");
    assert(
      (bottomSnapshot.prismGroupScale ?? 0) >= 3.95,
      `Expected wide live end-state to reach the configured prism group scale, got ${bottomSnapshot.prismGroupScale} (section ${bottomSnapshot.active ?? "?"}).`,
    );
    assert(
      Math.abs((bottomSnapshot.scrollY ?? 0) - scrollTargets.visionEnd) <= 2,
      `Expected wide live end-state capture at the vision end (scrollY ${bottomSnapshot.scrollY}, target ${scrollTargets.visionEnd}).`,
    );
    assert(
      bottomSnapshot.viewportWidth === viewport.width && bottomSnapshot.viewportHeight === viewport.height,
      "Expected wide live end-state viewport debug to match the requested viewport.",
    );
  } finally {
    await context.close();
  }
}

async function captureEndmarkLiveSequence(browser, options = {}) {
  const viewport = options.viewport ?? ultraWideViewport;
  const fileSuffix = options.fileSuffix ?? "";
  const freshBrowserPerStage = options.freshBrowserPerStage ?? false;
  const prepareLivePage = async (page, scenarioName, timeScale) => {
    await page.goto(`${baseUrl}/en/?alcheEndmarkTimeScale=${timeScale}&alcheHideDebugUi=1`, { waitUntil: "networkidle" });
    await assertTopPageShell(page, scenarioName);
    await page.waitForFunction(
      () =>
        document.querySelector("[data-active-section]") !== null &&
        typeof window.__getAlcheLayerDebugState === "function" &&
        typeof window.__getAlcheEndmarkDebugState === "function",
      undefined,
      { timeout: 12000 },
    );
    await page.waitForTimeout(600);

    const scrollTargets = await page.evaluate(() => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const viewportLine = window.innerHeight * 0.38;
      const visionNode = document.querySelector('[data-top_section="vision"]');
      if (!(visionNode instanceof HTMLElement)) {
        return { visionStart: null, maxScroll };
      }

      const rect = visionNode.getBoundingClientRect();
      return {
        visionStart: Math.max(0, Math.min(maxScroll, Math.round(rect.top + window.scrollY - viewportLine))),
        maxScroll,
      };
    });

    if (scrollTargets.visionStart !== null) {
      await page.evaluate((nextTop) => {
        window.scrollTo(0, nextTop);
      }, scrollTargets.visionStart);
      await page
        .waitForFunction((expectedTop) => Math.abs(window.scrollY - expectedTop) <= 2, scrollTargets.visionStart, {
          timeout: 1600,
        })
        .catch(() => {});
      await page.waitForTimeout(240);
    }

    // Re-measure and re-issue the scroll until it lands on the real bottom:
    // a single scrollTo + fixed 2.2s wait intermittently stopped ~10px short
    // (late layout/scroll settle), failing the "at document bottom" check.
    // Keep corrections fast: the endmark timeline is time-based and starts at
    // the trigger, so slow retries let its short "black" stage play out.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = await page.evaluate(() => {
        const bottom = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        if (Math.abs(window.scrollY - bottom) > 2) window.scrollTo(0, bottom);
        return { bottom, scrollY: window.scrollY };
      });
      scrollTargets.maxScroll = state.bottom;
      if (Math.abs(state.scrollY - state.bottom) <= 2) break;
      await page.waitForTimeout(100);
    }

    return scrollTargets;
  };

  const captureLiveStage = async ({
    expectedStage,
    screenshotName,
    timeScale,
    timeoutMs,
    pollMs,
    settleDelayMs = 0,
  }) => {
    const stageBrowser = freshBrowserPerStage ? await launchValidationBrowser() : browser;
    const context = await stageBrowser.newContext({
      viewport,
      locale: "en-US",
      reducedMotion: "no-preference",
    });

    try {
      const page = await context.newPage();
      const scenarioName = `${screenshotName}${fileSuffix}`;
      const scrollTargets = await prepareLivePage(page, scenarioName, timeScale);
      const stageSnapshot = await waitForEndmarkLiveStage(page, expectedStage, timeoutMs, pollMs);

      if (settleDelayMs > 0) {
        await page.waitForTimeout(settleDelayMs);
      }

      await page.screenshot({
        path: path.join(outputDir, `${screenshotName}${fileSuffix}.png`),
        fullPage: false,
      });

      const finalSnapshot = await sampleEndmarkLiveState(page);
      return {
        scrollTargets,
        stageSnapshot,
        finalSnapshot,
      };
    } finally {
      try {
        await context.close();
      } catch (error) {
        if (!isAlreadyClosedPlaywrightError(error)) {
          throw error;
        }
      }
      if (freshBrowserPerStage) {
        await closeBrowserIfOpen(stageBrowser);
      }
    }
  };

  const blackCapture = await captureLiveStage({
    expectedStage: "black",
    screenshotName: "endmark-live-black",
    // Slowed 4x: the black stage is short and the timeline is time-based, so
    // a busy main thread (heavy crystal refraction before the jump) could let
    // the whole intro finish before the first sample. Still the real stage.
    timeScale: 0.25,
    timeoutMs: 8000,
    pollMs: 80,
    settleDelayMs: 40,
  });

  assert(blackCapture.stageSnapshot.endmark?.stage === "black", "Expected live endmark black capture to hit the black stage.");
  assert(blackCapture.stageSnapshot.endmark?.visible === true, "Expected live endmark black capture to be visible.");
  assert(blackCapture.stageSnapshot.endmark?.ready === true, "Expected live endmark black SVG to be ready.");
  assert(
    (blackCapture.stageSnapshot.layerState?.visionCoverProgress ?? 0) >= 0.98,
    "Expected live endmark black capture to keep full vision cover progress.",
  );
  assert(
    Math.abs((blackCapture.stageSnapshot.scrollY ?? 0) - (blackCapture.stageSnapshot.maxScroll ?? 0)) <= 2,
    `Expected live endmark black capture to occur at the document bottom (scrollY ${blackCapture.stageSnapshot.scrollY}, maxScroll ${blackCapture.stageSnapshot.maxScroll}, initial target ${blackCapture.scrollTargets?.maxScroll}).`,
  );
  assert(blackCapture.stageSnapshot.footerVisible === false, "Expected live endmark black capture to keep footer hidden.");

  const settledCapture = await captureLiveStage({
    expectedStage: "settled",
    screenshotName: "endmark-live-settled",
    timeScale: 240,
    timeoutMs: 36000,
    pollMs: 1000,
    settleDelayMs: 120,
  });

  assert(settledCapture.finalSnapshot.endmark?.stage === "settled", "Expected live endmark capture to reach the settled stage.");
  assert(settledCapture.finalSnapshot.endmark?.visible === true, "Expected live endmark capture to stay visible.");
  assert(settledCapture.finalSnapshot.endmark?.ready === true, "Expected live endmark SVG to be ready.");
  assertEndmarkSettledLineState(settledCapture.finalSnapshot.endmark, "live endmark settled");
  assert(
    (settledCapture.finalSnapshot.layerState?.visionCoverProgress ?? 0) >= 0.98,
    "Expected live endmark capture to keep full vision cover progress.",
  );
  assert(
    Math.abs((settledCapture.finalSnapshot.scrollY ?? 0) - (settledCapture.finalSnapshot.maxScroll ?? 0)) <= 2,
    "Expected live endmark capture to occur at the document bottom.",
  );
  assert((settledCapture.finalSnapshot.footerProgress ?? 0) >= 0.99, "Expected live endmark footer progress to complete at bottom.");
  assert(settledCapture.finalSnapshot.footerVisible === true, "Expected live endmark footer to be visible at bottom.");
  assert(
    settledCapture.finalSnapshot.viewport.width === viewport.width &&
      settledCapture.finalSnapshot.viewport.height === viewport.height,
    "Expected live endmark capture viewport debug to match the requested viewport.",
  );
}

async function run() {
  let server;
  try {
    server = await createStaticServer(preferredPort);
  } catch (error) {
    if (error?.code !== "EADDRINUSE") {
      throw error;
    }

    server = await createStaticServer(0);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to resolve fallback Playwright validation server port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}${basePath}`;
    console.warn(`Port ${preferredPort} is busy; using ${address.port} for Playwright validation.`);
  }

  try {
    await waitForServer(`${baseUrl}/en/`);
    generateAlcheReferenceFrames({ root, outputDir: path.join(outputDir, "reference-video") });
    const browser = await launchValidationBrowser();

    try {
      if (visionCoverLiveOnlyMode) {
        await captureFixedStates(
          browser,
          activeFixedStateShots.filter((shot) => shot.name === "vision-cover-full"),
          {
            viewport: ultraWideViewport,
            fileSuffix: "-desktop-2000x1080",
          },
        );
        await captureVisionCoverLiveEndState(browser, {
          viewport: ultraWideViewport,
          fileSuffix: "-desktop-2000x1080",
          disableEndmark: true,
        });
        console.log("Playwright validation passed (vision-cover-live-only).");
        return;
      }

      if (endmarkLiveOnlyMode) {
        await captureFixedStates(
          browser,
          activeFixedStateShots.filter((shot) =>
            ["endmark-black", "endmark-guides", "endmark-outline", "endmark-fill", "endmark-settled", "endmark-footer-settled"].includes(shot.name),
          ),
          {
            viewport: ultraWideViewport,
            fileSuffix: "-desktop-2000x1080",
          },
        );
        await closeBrowserIfOpen(browser);
        const liveBrowser = await launchValidationBrowser();
        try {
          await captureEndmarkLiveSequence(liveBrowser, {
            viewport: ultraWideViewport,
            fileSuffix: "-desktop-2000x1080",
            freshBrowserPerStage: true,
          });
        } finally {
          await closeBrowserIfOpen(liveBrowser);
        }
        console.log("Playwright validation passed (endmark-live-only).");
        return;
      }

      if (worksOutroLiveOnlyMode) {
        const worksOutroFixedShots = activeFixedStateShots.filter((shot) =>
          [
            "works-outro-entry",
            "works-outro-unroll-early",
            "works-outro-curvature-early",
            "works-outro-unroll-mid",
            "works-outro-curvature-mid",
            "works-outro-unroll-late",
            "works-outro-curvature-late",
            "works-outro-flatten",
            "works-outro-prism-bridge",
            "mission-in-prism-bridge-early",
          ].includes(shot.name),
        );
        const worksOutroFixedShots2000 = worksOutroFixedShots.filter((shot) =>
          [
            "works-outro-unroll-early",
            "works-outro-curvature-early",
            "works-outro-unroll-mid",
            "works-outro-curvature-mid",
            "works-outro-curvature-late",
            "works-outro-prism-bridge",
            "mission-in-prism-bridge-early",
          ].includes(shot.name),
        );
        await closeBrowserIfOpen(browser);
        await withFreshBrowser((freshBrowser) =>
          captureWorksOutroWheelFocused(freshBrowser, {
            viewport: worksOutroEdgeViewport,
            fileSuffix: "-desktop-2048x1152",
            captureMode: false,
            captureEdgeState: true,
            captureEntryState: false,
            captureFlattenState: false,
            requireEntryState: false,
            requireFlattenState: false,
            pointerDebug: false,
            requireMissionPanel: false,
          }),
        );
        await captureFixedStatesWithFreshBrowsers(worksOutroFixedShots2000, {
          viewport: ultraWideViewport,
          fileSuffix: "-desktop-2000x1080",
        });
        await captureFixedStatesWithFreshBrowsers(
          worksOutroFixedShots.filter((shot) => shot.name === "works-outro-unroll-early"),
          {
            viewport: worksOutroEdgeViewport,
            fileSuffix: "-desktop-2048x1152",
          },
        );
        await captureFixedStatesWithFreshBrowsers(
          worksOutroFixedShots.filter((shot) => shot.name === "works-outro-unroll-late"),
          {
            viewport: { width: 2560, height: 1600 },
            fileSuffix: "-desktop-16x10",
          },
        );
        await withFreshBrowser((freshBrowser) =>
          captureWorksOutroWheelFocused(freshBrowser, {
            viewport: ultraWideViewport,
            fileSuffix: "-desktop-2000x1080",
          }),
        );
        await withFreshBrowser((freshBrowser) =>
          captureWorksOutroWheelFocused(freshBrowser, {
            viewport: { width: 2560, height: 1600 },
            fileSuffix: "-desktop-16x10",
            requireMissionPanel: false,
          }),
        );
        await assertWorksOutroGridDensityRatio();
        console.log("Playwright validation passed (works-outro-live-only).");
        return;
      }

      if (!cardsOnlyMode) {
        const scenarios = [
          {
            name: "desktop-en",
            locale: "en-US",
            expectedPath: "/en/",
            viewport: { width: 1440, height: 1080 },
          },
          {
            name: "desktop-16x10-en",
            locale: "en-US",
            expectedPath: "/en/",
            viewport: { width: 2560, height: 1600 },
          },
          {
            name: "tablet-ja",
            locale: "ja-JP",
            expectedPath: "/ja/",
            viewport: { width: 834, height: 1194 },
          },
          {
            name: "mobile-zh",
            locale: "zh-CN",
            expectedPath: "/zh-CN/",
            device: devices["iPhone 12"],
          },
        ];

        for (const scenario of scenarios) {
          await runScenario(browser, scenario);
        }
      }

      const desktopWideShots = activeFixedStateShots.filter((shot) =>
        ["cards-b-queue", "cards-handoff-mid", "cards-settled"].includes(shot.name),
      );
      const ultraWideTransitionShots = activeFixedStateShots.filter((shot) =>
        ["works-outro-flatten", "mission-in-panel", "vision-cover-full", "endmark-settled"].includes(shot.name),
      );
      const layerStates = cardsOnlyMode
        ? await captureFixedStatesWithFreshBrowsers(activeFixedStateShots)
        : await captureFixedStates(browser, activeFixedStateShots);

      if (cardsOnlyMode) {
        await closeBrowserIfOpen(browser);
        await captureFixedStatesWithFreshBrowsers(desktopWideShots, {
          viewport: { width: 2560, height: 1600 },
          fileSuffix: "-desktop-16x10",
        });
        await captureFixedStatesWithFreshBrowsers(ultraWideTransitionShots, {
          viewport: ultraWideViewport,
          fileSuffix: "-desktop-2000x1080",
        });
        // Refraction perf budget needs a rendered crystal. It is hidden while
        // the cards cycle (reference behaviour since the 07-13 pass), so the
        // guards run on the works_outro shots where it returns full-size and
        // moves with progress (scale + wall flatten).
        await withFreshBrowser((freshBrowser) => assertPrismRefractionPerf(freshBrowser, "works-outro-entry"));
        await withFreshBrowser((freshBrowser) => assertPrismRefractionPerf(freshBrowser, "works-outro-flatten"));
        await withFreshBrowser((freshBrowser) => assertPrismRefractionActivePerf(freshBrowser, "works-outro-entry"));
        await withFreshBrowser((freshBrowser) => assertPrismRefractionActivePerf(freshBrowser, "works-outro-flatten"));
      } else {
        await captureFixedStates(browser, desktopWideShots, {
          viewport: { width: 2560, height: 1600 },
          fileSuffix: "-desktop-16x10",
        });
        await captureFixedStates(browser, ultraWideTransitionShots, {
          viewport: ultraWideViewport,
          fileSuffix: "-desktop-2000x1080",
        });
      }
      if (!cardsOnlyMode) {
        await captureRealWheelHandoff(browser);
        await captureRealWheelHandoff(browser, {
          viewport: { width: 2560, height: 1600 },
          fileSuffix: "-desktop-16x10",
        });
        // Fresh browser like --vision-cover-live-only: after every fixed shot
        // the long-lived browser renders the heavy kv (3D panels + crystal
        // transmission) too slowly to report intro-ready within 12s.
        await withFreshBrowser((freshBrowser) =>
          captureVisionCoverLiveEndState(freshBrowser, {
            viewport: ultraWideViewport,
            fileSuffix: "-desktop-2000x1080",
            disableEndmark: true,
          }),
        );
        // Same as --endmark-live-only: the endmark timeline is time-based and its
        // short "black" stage is missed in the long-lived browser that already
        // rendered every fixed shot, so each stage gets a fresh browser.
        await captureEndmarkLiveSequence(browser, {
          viewport: ultraWideViewport,
          fileSuffix: "-desktop-2000x1080",
          freshBrowserPerStage: true,
        });
        await withFreshBrowser((freshBrowser) => capturePointerInteraction(freshBrowser));
      }
      await writeReferenceBoard(layerStates);
    } finally {
      await closeBrowserIfOpen(browser);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  console.log(`Playwright validation passed (${cardsOnlyMode ? "cards-only" : "full"}).`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
