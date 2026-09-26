# MOONFLOW / Alche Top-Page Handoff

Date: `2026-07-13` (second pass appended same day)

Supersedes: [`alche-top-page-handoff-2026-04-29.md`](./alche-top-page-handoff-2026-04-29.md)

## Third pass (2026-09-26): kv frame parity vs `Task/滚动前.png`

- **Wall grey root cause:** the dark palette values are linear and
  `OutputPass` sRGB-encodes them (~3x brighter), and strong per-tile variance
  read as a checkerboard. Palette rebuilt in linear terms: near-black panels,
  low variance, violet haze/core centred behind the crystal (only the central
  ~60% of wall uv is on screen at kv framing), faint LED hairlines, and a
  sparse `+` marker lattice (`cellColumns/2 x cellRows/2`).
- **Prism body:** when `uSceneRefractionMix` is ~1 (not mission split), the ice
  shader now shows the refraction-target scene magnified, violet-tinted, and
  frost-smeared (bright content such as the wordmark turns into white spray),
  and goes near-opaque. Split mode (0.28) keeps the legacy pale-ice alpha/cap.
- **Prism depth:** the GLB tunnel is 1.0 deep vs 2.08 tall. `kvDepthScale`
  (0.55) squashes Z while front-facing and blends back to 1 as `rotation.y`
  approaches `missionTurnRadians`, so the mission side-slab is unchanged.
  A solid-colour debug confirmed the through-hole is geometrically clear; the
  "filled hole" read was only the body matching the wall glow's brightness.
- **Wordmark:** faux-bold via same-colour troika outline
  (`ALCHE_TOP_MOONFLOW.strokeBoldWidth`), letterSpacing 0.012; dark-side
  bloom strength 0.2 / radius 0.4 / threshold 0.8.
- **Header:** stays single-row down to 769px (the reference is single-row at 1024);
  stacking moved to the <=768px block.
- Crystal edge line opacity 0.3 -> 0.62.
- Not verified in this pass: typecheck/build/Playwright (the session shell was
  unusable), and the final body-brightness tweak (the preview pane was hidden).

## Second pass (user-approved: orientation -> 4-card queue -> fine tuning)

1. **Validator fix:** `launchValidationBrowser` used legacy `--use-gl=swiftshader`,
   which modern Chromium removed — headless WebGL never initialized, the shell
   rendered its no-WebGL fallback, and `assertTopPageShell` failed with
   "Expected at least one canvas". Now uses `--enable-unsafe-swiftshader`
   (Playwright-default-compatible), and the canvas assertion waits for the
   client-side canvas mount instead of racing `networkidle`.
2. **Prism orientation (①):** `ALCHE_TOP_CENTER_MODEL.baseRotationZ` Math.PI -> 0
   (reference crystal points up; GLB is authored apex-up). Mission turn is a
   Y-axis rotation so choreography is unaffected; verify the vision rainbow
   face on-screen position after the turn and negate `rainbowFaceNormal` if it
   lands on the wrong side.
3. **4-card rolling queue (②):** `worksCardsProgress` axis extended to
   `[0, cyclesTotal=3]`; `[0,1]` is byte-identical to the legacy A/B cycle so
   every shotbook-pinned validator state is preserved. Extra cycles use
   `extraCycleQueueEnd/LeadEnd` windows (lead -> support -> exit while the next
   card queues in). `works_cards` minHeight 1.18 -> 2.8. WorksCardPair now
   renders `queueCount=4` meshes; identity labels A-D; debug slot 0 = mesh 0,
   slot 1 = legacy "B" role (last card during works_outro) so the existing
   card0/card1 assertions keep their meaning. Shell caption follows the cycle.
4. **New trap:** running `npm run build` and then `npm run dev` against the same
   `.next` directory can 500 every page route (prod artifacts contaminate the
   dev server). Fix: stop dev, delete `.next`, restart dev. Static assets still
   200 while all pages 500 is the signature of this state.
5. **Follow-up fixes found during ② verification:**
   - `use-top-page-scroll` was missing the `ALCHE_TOP_WORKS_CARDS` import
     (SSR-safe now).
   - `deriveTopSceneState` clamped `worksCardsProgress` to [0,1], silently
     collapsing every extra cycle to the cycle boundary; now clamps to
     `[0, cyclesTotal]`.
   - **All verified 2026-07-25:** `--cards-only` validator passed on the fresh
     export (cycle-0 compat + orientation + canvas fix), and headless captures
     of the fresh export confirmed cycle-1 mid (B exits left, C queues in
     right, caption holds B until the handoff midpoint) and cycle-2 mid
     (C exits, D enters, caption switches to item 2). Artifacts:
     `.playwright-artifacts/cycles/cycle1-mid.png`, `cycle2-mid.png`.
   - ③ fine pass: dark-section bloom rebalanced to strength 0.48 / radius 0.48
     / threshold 0.7 (the previous fine pass had over-suppressed the kv
     wordmark glow). Live-scroll cycling feel and further art passes (wall
     tile distribution, prism internal texture, vision slab palette vs the
     reference video) remain open for eyeball tuning.
   - Reminder: extension screenshots of a hidden tab show frozen DOM with an
     empty canvas — do not misread that as a scene bug; check
     `document.visibilityState` first.

## What changed in this pass

The user explicitly authorized two direction changes on 2026-07-13:

1. **Art direction switched from cold-white/light to reference-accurate dark** for
   `loading -> kv -> works -> works_cards -> works_outro`:
   - wall shader now renders a dark LED media-wall (per-tile brightness variance,
     LED dot lattice, near-black seams, center letter-glow bleed) with the light
     technical-paper palette still reachable through `uWhiteMix` for mission;
   - kv brand word and works wall word are white emissive (`0xf6f8ff`,
     toneMapped=false) with retuned bloom (`strength ~0.4 / radius 0.44 /
     threshold 0.78` on dark, easing to near-off as `whiteMix` rises);
   - kv word `widthRatio` 0.46 -> 0.8; center model `targetHeight` 1.84 -> 2.3;
     prism ice opacity 0.42 -> 0.62, refraction/chroma strengths raised,
     emissive fog target reduced (0.44 -> 0.16), dark scene-texture fallback;
   - works card posters are unlit `MeshBasicMaterial` (LED screen read).

2. **Previously frozen sections re-opened and implemented as shell DOM**
   (per handoff rule these needed explicit user authorization, which was given):
   - scroll track extended: `... mission, vision, vision_out, service_in,
     service, stellla, outro`;
   - new scroll channels in `use-top-page-scroll`: `serviceProgress`,
     `stelllaProgress`, `outroApproachProgress` (plus debug resolvers for
     `alcheSection=service|stellla|outro` URLs);
   - **endmark trigger moved** from `visionCoverProgress >= 0.98` to
     `outroApproachProgress >= 0.98`; legacy capture URLs that pass
     `alcheVisionCoverProgress=1` still force the trigger via the debug
     resolver, so existing validator shots remain valid;
   - shell-owned overlays: service panel (dark), stellla panel (soft light),
     `lateBackdrop` continuity layer, mission/vision highlight-block copy
     (JP-style black-bar lines + mono caption + outline watermark);
   - header center nav (News/Works/About/stellla) + Contact/Recruit pill,
     left scroll-indicator rail, kv news list, works-cards DOM caption
     (date/title/subtitle/tags) + More Works link;
   - endmark footer items are now real controls: section scroll buttons plus
     GitHub / Email links from `data/profile.ts`; footer copy `Links` column
     now lists GitHub/Email instead of placeholder social labels;
   - light-section theme swap via `data-shell-theme` (dark ink header/rail on
     mission/stellla paper backgrounds).

3. **Stability fixes (root-caused, not cosmetic):**
   - `reactStrictMode: false` in `next.config.mjs` — R3F v9 inherits StrictMode
     into the Canvas; the dev double-mount force-lost both WebGL contexts
     permanently (black canvas, dead frame loop). Production export is
     unaffected by this flag.
   - Hydration attribute mismatches eliminated: `use-top-page-scroll` no longer
     reads query params during render (initial state matches SSR; the existing
     mount effect applies URL debug state), and the shell reads
     `window.location` only after a `hydrated` flag flips in an effect.
     Previously React kept stale server attributes forever ("won't be patched
     up"), which left the loading overlay stuck.
   - `flushSync` removed from the mount effect (React 19 lifecycle warning);
     kept inside the externally invoked debug callbacks where it is legal.

## Validation state

- Environment note: the sandbox used for this session cannot run
  `npm run build` or long Playwright suites (any process is killed when a tool
  call returns; 45s cap). Visual validation was done against the user's own
  `npm run dev` server through the browser, per user's choice.
- Verified live (free scroll, no debug params, dev server):
  kv dark LED wall + glowing word + prism -> works word/cards entry ->
  A/B queue handoff (identity mode) -> mission white panel + mission copy
  (light theme swap) -> vision cover black -> service panel -> endmark +
  interactive footer. Named-shot URLs additionally verified for kv,
  cards-a-center (poster), mission copy, vision copy, service, stellla,
  endmark-footer.
- **Not yet verified in this pass:** `npm run typecheck`, `npm run build`,
  `npm run verify:static`, Playwright suites (`--cards-only` etc. must be
  re-run against a fresh `out/` after the next build), stellla live-scroll
  screenshot (only the fixed-state URL was captured), poster mode during live
  scroll, mobile viewports, remote GitHub Pages evidence.
- A chunked capture helper was added for constrained sandboxes:
  `scripts/capture-shots-chunk.mjs` (serves `out/` in-process, captures a
  given list of shot URLs, exits; run several small invocations instead of one
  long suite).

## Files changed in this pass

- `next.config.mjs` (reactStrictMode)
- `lib/alche-top-page.ts` (scroll track extension, MOONFLOW widthRatio,
  center model targetHeight)
- `components/alche-top-page/use-top-page-scroll.ts` (hydration-safe init,
  service/stellla/outro channels, debug resolvers)
- `components/alche-top-page/alche-top-page-shell.tsx` (hydrated gate, header
  nav, indicator rail, news rail, cards caption, mission/vision copy,
  service/stellla overlays, lateBackdrop, endmark trigger swap, footer links,
  theme attribute, flushSync fix)
- `components/alche-top-page/alche-top-page-shell.module.scss` (dark-theme
  additions, light-theme swap block, new overlay styles, z-index ladder:
  edge 9 < lateBackdrop/service/stellla 10 < endmark 11 < header/indicator 12)
- `components/alche-top-page/scene/kv-scene-system.tsx` (word colors, unlit
  posters, prism constants, dark fallback texture)
- `components/alche-top-page/scene/alche-top-page-materials.ts` (dark LED wall
  palette, softened prism-side iridescence hue/saturation)
- `components/alche-top-page/scene/alche-top-page-postprocessing.tsx` (bloom)
- `data/alche-top-page.ts` (footer Links column -> GitHub/Email)
- `scripts/capture-shots-chunk.mjs` (new)

## Open items / next moves

1. Run on the dev machine: `npm run typecheck && npm run build &&
   npm run verify:static`, then re-run focused Playwright validators against
   the fresh export (`node scripts/validate-playwright.mjs --cards-only`, then
   `--works-outro-live-only`, `--endmark-live-only`).
2. Art-direction fine pass against `Task/参考视频.mp4`: letter glow amount,
   wall tile brightness distribution, prism internal texture/contrast, vision
   slab palette.
3. **Prism orientation question for the user:** reference kv crystal points up
   (△), current model points down (▽ via baseRotationZ = π). Flipping affects
   mission-turn/cover choreography — needs a deliberate pass, not a hot patch.
4. Works cards: reference shows >2 posters cycling; current queue holds 2
   works items (`copy.works.items.slice(0, 2)` in the shell). Extending the
   queue is a choreography change (shotbook segments assume A/B).
5. Mission grid tile asset (`mission-grid-tile.png`) may need a darker variant
   check against the new dark works_outro handoff.
6. stellla section: reference uses a full-bleed soft video; current is a
   gradient backdrop + copy. Asset needed if closer parity is wanted.
7. Remote GitHub Pages evidence still not refreshed (Pages deployment
   currently returns 404 — check repo Pages settings before relying on it).

## Known traps (additions)

1. Dev black-canvas + stuck loading = check `document.visibilityState` first:
   Chrome freezes rAF for hidden/background tabs; the intro and R3F loop stop.
2. Do not reintroduce render-time `window`/query reads in the shell or the
   scroll hook; attribute-level hydration mismatches are never repaired by
   React and leave stale `data-*` state.
3. Do not re-enable `reactStrictMode` while on R3F 9.x without re-testing the
   dev context-loss behavior.
4. The in-sandbox bash mirror of the repo can lag or wedge on freshly edited
   files (observed truncated `alche-top-page-materials.ts`); trust the
   file-tool/dev-server view of the real disk and re-verify before trusting
   sandbox `tsc` failures.
