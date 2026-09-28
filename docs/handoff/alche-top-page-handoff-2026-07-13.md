# MOONFLOW / Alche Top-Page Handoff

Date: `2026-07-13` (second pass appended same day)

Supersedes: [`alche-top-page-handoff-2026-04-29.md`](./alche-top-page-handoff-2026-04-29.md)

## Twentieth pass (2026-09-28): kv composition + service room brightness

- KV crystal measured vs reference 5.0 s: reference spans ~7%-82% of the
  screen height with the wordmark through its middle; ours was ~18%-79%.
  New `kvScale` 1.23 and `kvLift` 0.14 (world y, new `kv.prismLift` state,
  added to the group target y) apply in `loading`/`kv` only, after the cover
  line (which rewrites `prismGroupScale` every frame). works_intro blends them
  out over progress 0-0.35 - done before the turn's swell (the first try
  blended over the whole spin and stacked to 1.545 > the 1.5 works_intro
  model-scale limit). Mission/vision sizes unchanged (they already matched).
- Service room: background median was 51-59 vs reference 22-24. Wash
  `brightness(0.3)` / opacity 0.4 (was 0.5 / 0.55), settled SERVICES letters
  alpha 0.1 (was 0.16). Now 23-27.
- Full suite green (38 min).

## Nineteenth pass (2026-09-28): vision pose from the reference shader

- Section-by-section review vs the reference video (live sweep + matched
  beats). The one real mismatch: vision. Reference logo vertex shader rotates
  only `uVisionRotate*0.15*HPI` (~13.5 deg yaw) + ~-0.1 rad pitch, so the
  outline stays front-facing and the left side face opens into a slanted
  rainbow band; the full-screen flood is a morph toward the 90-degree side
  view. Ours yawed a full 90 deg (outline vanished, flat face-on slab).
- Now: `missionTurnRadians` 0.236 + `missionTurnPitch` -0.1; during the cover
  the yaw continues to `coverTurnRadians` 1.57 (smoothstep of cover) while the
  zoom eases in (`pow(cover, 2.4)`, still 6.2 at full cover).
- Rainbow face: swirling holographic marble (lime -> cyan -> blue -> violet
  -> pink, hue 0.24-0.9) from domain-warped waves in the face's own plane
  (`dot(pos, faceTangent)`, `pos.z`); x/y alone only varied along the edge,
  which read as flat green when zoomed.
- Reviewed and not bugs: endmark looks slow in headless sweeps only (GSAP lag
  smoothing on multi-second software frames; timeline is ~3.5 s by design).
- Full suite green (39 min).

## Eighteenth pass (2026-09-28): swirling fluid

- Fluid moved to `scene/wall-fluid.ts` (`WallFluid` class) and upgraded to
  the stable-fluids pipeline: curl -> vorticity confinement (strength 20) ->
  divergence (reflecting borders) -> 16 Jacobi pressure iterations -> subtract
  gradient -> self-advection + dissipation + pointer splat. Velocity is now in
  fluid texels/s (192x108), so the panel side emit scales |v| by 0.0018.
- First pass was far too strong (whole areas washed in bright cloud): dye
  injection halved, push 0.6 -> 0.4, dye decay 0.45 -> 0.4. Trail now reads
  as curling lavender plumes that keep rolling after the pointer passes.
- Trap: fragment passes need their own `uniform vec2 uTexel` (only the vertex
  shader declared it; compile error).
- Full suite green (36 min).

## Seventeenth pass (2026-09-27): pointer fluid trail

- `createWallFluidStepMaterial` + `createWallFluid` (kv-scene-system): one
  RGBA half-float ping-pong field (192x108, screen uv): rg velocity (uv/s),
  b dye. Each frame: semi-Lagrangian self-advection, dissipation
  (velocity 0.35^dt, dye 0.45^dt), capsule splat along the pointer's segment
  this frame (radius^2 0.0028, aspect-corrected), velocity clamp 2.5. Stepped
  in `CurvedMediaWall`'s useFrame before the composer renders; targets
  cleared once on first frame (renderer autoClear is off under the composer).
- Consumers (exact screen uv via a clip-space varying): panel sides emit
  with dye + |velocity| sampled at the panel pivot; panel fronts get a
  panel-tinted + cool white wash; backing wall grid hairlines, frame lines and
  `+` markers light along the trail (kv content only). The old
  pointer-distance side glow is superseded (`vPointerGlow` now unused).
- Runs only while `animateContent` and panels are visible; after 240 idle
  frames it stops stepping and `uFluidMix` goes to 0. Works with
  `?alcheWallTime` (the pin only freezes the palette clock).
- Verified with a before/after screenshot diff of a scripted mouse arc (the
  first pass was too faint: dye, radius, persistence and glow raised).
- Full suite green (35 min).

## Sixteenth pass (2026-09-27): panel flip on palette rotation

- Shared chunk split: `ALCHE_WALL_KV_BASE_GLSL` (hashes, noise, fbm,
  `alcheKvFlip`, vertex-safe) + `ALCHE_WALL_KV_GLSL` (content). `alcheKvFlip`
  is the single source of timing: every 9 s a 2 s left-to-right sweep, each
  panel flips over 0.3 of it (0.6 s) at `(hash*0.45 + x*0.55) * 0.7`.
- Panels are now rigid boxes on the curve (pivot at wall point + normal *
  (depth + thickness/2), tangent/normal frame) rotated a half turn about their
  vertical axis with cubic in-out easing and a 14% mid-turn shrink; content
  switches at `flip >= 0.5` (edge-on). Back faces use mirrored local x so the
  image continues after the half turn; the next cycle resets the angle with no
  visible pop. `alcheKvWallContent` takes a `sweepX` (panel centre for panels,
  uv.x for the backing wall). Old white flash reduced to a faint edge glint.
- Debug `?alcheWallTime=<s>` pins the wall clock (rotation forced on) for
  capturing exact flip moments. Full suite green (41 min).

## Fifteenth pass (2026-09-27): real 3D LED panels

- `createWallPanelMaterial` + `createWallPanelGeometry` (kv-scene-system):
  one `InstancedBufferGeometry` of unit boxes (~300 instances, one draw call)
  laid out by `createWallPanelLayout` (seeded, 14x8 cells over wall params
  +-0.86; 24% 2x2 merges, 20% 2x2 splits; 0.05 world gap; depth 0.02-0.34,
  mostly shallow). The vertex shader bends each box onto the exact backing
  wall surface (same formula as `createCurvedGridMaterial`, incl. flatten) and
  pushes it out along the surface normal; thickness 0.12.
- Content GLSL is shared (`ALCHE_WALL_KV_GLSL`: hashes, noise, fbm,
  `alcheKvWallContent`), so the backing wall and panels can't drift. Fronts
  show the content (plus a dark base so switched-off panels never read as a
  hole); sides glow with the panel colour, brighter near the window pointer
  (stand-in for the reference's fluid glow; off for reduced motion/captures).
- Backing wall stays for everything else (gaps, works zebra, poster echo,
  mission paper, flatten). `uPanelCover` hides its own kv content while the
  panels are visible; panel visibility = intro x sceneFade x (1-zebra) x
  (1-poster) x (1-whiteMix), using the wall's damped uniforms.
- Traps: the panel id arrives as an interpolated varying; hashing it
  unrounded flipped per-panel palette/blackout pixel by pixel (grain) -> use
  `floor(vPanelId + 0.5)`. LED dot lattice fades to its mean below ~2px
  (`fwidth`) to avoid moire.
- Validator: in full mode the vision live end-state and pointer checks now
  use fresh browsers (the long-lived browser rendered the heavier kv too
  slowly to reach intro-ready in 12s). Full suite green (38 min).

## Fourteenth pass (2026-09-27): kv LED wall on the reference wall model

- Reference wall (from the same shader capture): hundreds of instanced thin
  panel boxes of mixed sizes/depths bent onto a cylinder; every panel samples
  ONE full-screen pattern texture at its screen position (so the wall shows a
  single image), with per-panel random UV glitch shifts and blackouts; a tiled
  logo texture at ~20%; per-panel edge falloff, LED dot mask, global
  vignette; glowing panel sides. Patterns are simple noise images (violet with
  cyan/orange blooms, contour-band zebra, other palettes) that swap over time.
- Ours (single curved mesh, fragment-only emulation in
  `createCurvedGridMaterial`, gated by `kvContentMix = (1-zebra)(1-poster)`):
  mixed-size panel layout from hashed 2x2 merges / 2x2 splits of a 0.6x cell
  grid with panel-shaped seams; continuous animated fbm pattern
  (`wallNoise`/`wallFbm`) with ~10% glitch-shifted panels and ~30% blacked-out
  panels; palettes violet / green / grey contour-stripe zebra rotating every
  9 s with a staggered left-to-right panel sweep + flash; per-panel falloff,
  LED dot mask, centre falloff; faint tiled MOONFLOW (`uLogoTex`, canvas
  texture) with drifting rows. Content is ADDED on top of the panel structure
  (blacked-out panels keep hairlines/dots, never read as a hole).
- `uThemeCycle` = animate only when `!reducedMotion && !captureMode` (static
  violet otherwise, so pinned captures stay deterministic).
- Not emulated: real per-panel depth offsets and glowing panel sides.
- Full suite green (41 min).

## Thirteenth pass (2026-09-27): screen-space transmission crystal

- Studied the reference site's compiled shaders (captured via a WebGL
  `shaderSource` hook in headless Chromium; analysis artefacts only in
  `.playwright-artifacts/alche-ref-capture/`, gitignored, nothing copied into
  the site). Their logo: opaque mesh whose colour is the background texture
  re-sampled through it; normal-driven screen offset; 8 per-pixel random
  samples jittered inside noise-driven rough patches (the "spray"); per-channel
  slide 1/2/4x for dispersion; tight GGX key-light specular; fresnel (f0 0.1)
  env reflection; smooth-bevelled ~7.7k-vertex logo mesh.
- Our implementation: `createPrismIceMaterial` non-split body rewritten on
  that technique with procedural noise (`alcheIceFbm`) and a procedural studio
  environment (`alcheIceStudio`) instead of their textures. Transmitted light
  is capped at 2.35 (just under bloom threshold 2.5) so letters behind the
  glass are blown white without a halo; only specular glints bloom.
- Geometry: `createPrismCrystalBodyGeometry` (ExtrudeGeometry of the shared
  logo outline incl. base notch, bevel 6 segments, negative bevel offset keeps
  the GLB silhouette) replaces the 12-vertex GLB for the full-render body only;
  scale/centre are measured on the GLB (edge scene) so line-art/rainbow layers
  stay aligned. Crystal wireframe edges off in full mode.
- Refraction capture is now `HalfFloatType` / linear (8-bit clipped the HDR
  wordmark), so the previous highlight re-expansion hack is gone.
- Full suite green (38 min).

## Twelfth pass (2026-09-27): bar-ice crystal, lit LED wall, halo-free wordmark

- User direction: crystal should read like clear bar ice (reference photo:
  hand-held MALT ICE block), not dusty glass. `createPrismIceMaterial` body
  now: clear softened core with slight lens; internal-reflection second image
  near edges; streaky milky frost (fbm, denser near edges/base) diffusing
  bright content into a glow; sparse static bubbles (model-space cells);
  crisp HDR rim on every logo edge (analytic triangle SDF of outer + inner
  triangle, `alcheIceSdTri`/`alcheIceEdgeDist`) with a darker band inside;
  bevel faces bright/icy with faint dispersion. The grainy spray is gone.
- 8-bit refraction capture clips the HDR wordmark; clipped highlights are
  re-expanded inside the ice so letters behind it stay white.
- **Final composite darkens the screen centre to ~0.41x** (`vignette`
  smoothstep in `FinalCompositeShader` is effectively inverted). Not changed
  (it shapes the whole look), but anything that must read pure white at the
  centre is emitted HDR: wordmark `TITLE_COLOR` 2.35 (dim variant 0.36x),
  ice rims ~1.9-2.2.
- Bloom threshold 0.8 -> 2.5 on the dark scene (above the HDR wordmark), so
  the wordmark has no halo; only hotter ice highlights bloom.
- Wall: lit LED content layer (blue-violet 3x3-panel clusters, brightness
  varying per panel/block, slow drift, brighter toward centre); panel frame
  grid back to base density (the 1.75x multiplier now only affects the LED
  dot lattice), matching the reference's larger panels.
- Validator: wall-continuity contrast excludes near-white (luma > 200)
  specular pixels (the ice rim crosses the upper-centre sample).
- Full suite green (35 min).

## Eleventh pass (2026-09-27): kv crystal = clear glass (reference video 5.0s)

- Non-split body (`uSceneRefractionMix` ~1) rewritten in
  `createPrismIceMaterial`: clear glass instead of a violet fill. Lens
  magnification toward the crystal centre (`-lp * 0.03`, `lp` from a new
  `vAlcheLocal` model-space varying) plus normal-driven bending on bevel
  faces; 5-tap per-pixel white-noise "spray" blended toward the tap max with
  the unscattered sample as a floor (solid letter cores, frayed grainy
  edges), radius 0.003-0.024 modulated by low-frequency noise; RGB split
  along the normal + spectral sheen + specular line on bevel/tunnel faces;
  smoky lower third; faint diagonal glint. Legacy pale-ice extras and fresnel
  rims now only apply in mission split mode.
- Earlier fbm warp produced the "marble" look and displaced content; the
  spray offset seen mid-pass was the spray radius (3% of screen) + averaged
  taps dimming cores, not the capture (raw capture verified aligned).
- `kvDepthScale` 0.55 -> 1 (tunnel walls form the visible bevel band now that
  the body is clear).
- Refraction capture budget 512/384 -> 1024/512 (idle/active) so the view
  through the glass stays crisp; perf guards updated. The capture now also
  hides `edgeScene` (edge lines were baked into the refraction texture).
- Endmark live "black" capture runs at `alcheEndmarkTimeScale=0.25` (heavier
  crystal rendering let the whole intro finish before the first sample).
- Full suite green (27 min).

## Tenth pass (2026-09-27): validation back to all-green

All green on a fresh export: `lint`, `typecheck`, `build`, `verify:static`,
`--cards-only`, `--vision-cover-live-only`, `--works-outro-live-only`,
`--endmark-live-only` (5/5 repeat runs) and the full default suite
(`npm run validate:playwright`, ~36 min on this machine).

Real fixes (app code):
- Cards were oversized on narrow screens (81% width at 4:3; poses were tuned
  at 1.9:1 with a vertical-FOV camera). `getCompensatedAlcheWorksCardPoseDefinition`
  now scales the lead by `aspect / 1.9` below that aspect and side lanes by
  half that amount; the scene reads the lead pose per-viewport too.
  `queue-right-lower` angle 0.84 -> 0.88.
- `cardsOpacity` debug metric only looked at mesh 0 and the legacy "B" slot,
  so it read ~0 during extra queue cycles while card C/D led; now max over all
  visible cards.
- Debug `prismGroupScale` falls back to the edge-overlay crystal (the visible
  one during mission/vision).

Validator updates (intent kept, stale assumptions removed):
- Refraction perf guards moved from cards shots (crystal hidden by design) to
  `works-outro-entry/flatten`; the idle guard waits for the pose to settle
  instead of a fixed 1.4s.
- Vision live end-state targets the vision section end, not the document
  bottom (service/stellla/outro were appended after vision).
- Right-edge and wall-continuity checks count empty columns of bare clear
  colour (< 6/255) instead of dark pixels; the dark LED wall is dark by design
  but keeps structure in every column. Light-wall luma floor removed.
- Grid-density ratio (early vs flatten) is reported as SKIPPED when the wall
  is below luma 40: on the dark wall three detectors gave unstable spacings,
  so it is not tuned to pass. Still runs on a readable (light) wall.
- works_intro allows model scale up to 1.5 (intentional half-turn swell).
- Endmark live: re-scrolls to the real bottom with fast 100ms corrections;
  full mode now uses a fresh browser per stage like the dedicated mode (the
  long-lived browser missed the short "black" stage); timeout diagnostics use
  a circular-safe stringify (GSAP objects).

## Ninth pass (2026-09-27): LED wall echoes the lead poster (reference 9.5-11s)

- `WorksCardPair` writes a shared `wallMediaRef` each frame (`from`/`to`
  card index, `blend` = the same handoff mix that swaps the lead card,
  `strength` = cards visible, fading with the works_outro clear);
  `CurvedMediaWall` reads it and binds the poster textures (same URLs, so
  `useLoader` returns the cached textures).
- Wall shader (`uPosterA/B`, `uPosterBlend`, `uPosterMix`): poster mapped
  over the visible central wall uv, 13-tap disc blur + mip bias 3,
  saturation 0.8, linear gain 0.16, modulated by the LED dot lattice; seams
  and `+` markers stay on top. Tuned against 滚动stage8 (0.2 gain was too
  bright/sharp, 0.075 invisible).
- `--works-outro-live-only` fails on HEAD too (right-edge "black ratio"
  0.19-0.25 <= 0.03). The screenshot shows no gap: the edge is the dark LED
  wall. The heuristic dates from the light-wall era and needs retuning for
  the dark direction.

## Eighth pass (2026-09-26): mission line-art logo (滚动stage6 / video 15.0s)

- Edge overlay now draws fat white lines (`LineMaterial` + `LineSegments2`;
  WebGL ignores `LineBasicMaterial.linewidth`, always 1px). 2.6px overlay /
  1.2px crystal edges.
- Overlay geometry is a hand-built logo outline in GLB model space
  (`createPrismLogoLineArtPositions`): outer + inner triangles on both faces,
  corner depth edges, and the brand-mark base notch (3.5% rise across
  ~19-81% of the base, eased steps). Full mode keeps `EdgesGeometry` edges.
- Hatch fill (`maskedLineArtScene`) no longer shown; `prismLineOpacity`
  debug value still tracks it, so validators are unaffected.
- Overlay depth: edge, rainbow and hatch scenes share `overlayDepthScale`
  (0.04 front-facing -> 1 through the mission turn); otherwise front/back
  faces doubled every line and the rainbow face overhung the outline.
- `.sectionCopy` z 8 -> 9 (same as `.edgeOverlayLayer`, later in the DOM) so
  the black copy bars cover the lines, as in the reference.
- Trap: `LineSegments2` is a Mesh; adding it inside `edgeScene.traverse`
  recursed forever (stack overflow, no canvas). Collect meshes first.
- `--endmark-live-only` is timing-flaky on HEAD too (~1 in 6: stops ~10px
  short of the bottom when the 2.2s scroll wait expires); assertion now
  prints scrollY/maxScroll.

## Seventh pass (2026-09-26): stellla stage (reference 18.9-20.2s, 滚动stage13-15)

- DOM shell, scroll-driven via `deriveStelllaStage(stelllaProgress,
  outroApproachProgress)`:
  - entry: full-bleed media starts exactly on the last service panel's hold
    rect (desktop -13vw / 13.5vw-20vh / 0.48; phone overrides in the <=768
    block) and grows to fill the viewport, slow push-in afterwards;
  - copy: dim gradient, thin frame with `+` corners, huge lowercase
    wordmark with a four-point sparkle and decorative `(↗)`, description,
    spec list bottom-right;
  - exit: the whole block slides up, driven by `outroApproachProgress`
    0 -> 0.98.
- **Endmark trigger moved** from `outroApproachProgress >= 0.98` to `>= 0.12`
  so the endmark is already underneath while stellla rises (stellla overlay
  is z-index 11, later in the DOM than `.endmarkOverlay`). stellla hides once
  its exit completes. `--endmark-live-only` passes.
- stellla section height 1.22 -> 1.8 (endmark trigger lands at stellla
  progress ~(H - 55vh)/H; the old height cut the hold short and left black).
- Service overlay now holds until stellla starts (hiding at serviceProgress
  0.97 left a black frame).
- Removed the time-based opacity transition on stellla (it hid the growth
  and popped in at ~75% of the entry).
- Data: stellla copy rewritten (the old strings were internal design notes);
  new `specs` + `imageSrc`, `frameLabel` removed; all four locales.
- Remote-only black service panel: queued slides used `visibility: hidden`,
  so Chrome did not rasterise their image ahead of the reveal (reproducible
  only on GitHub Pages, not the local export). Slides now hide with opacity
  only, images decode sync. Rectified posters also moved PNG -> JPEG
  (~3.4 MB -> ~0.5 MB). `public/alche-top-page/works/_probe-stage6.png`
  (3.6 MB) is unreferenced and still ships with the export.
- Class-name collisions again: legacy `.stelllaFrame` (height 10rem) exists
  later in the stylesheet, hence `.stelllaStageFrame`. Before adding shell
  classes, grep the SCSS for the name.

## Sixth pass (2026-09-26): Service section (reference 16.25-19.0s)

- Stays in the DOM shell (the 3D scene is pinned to runtime `mission_in`
  after mission; moving service into R3F would un-pin validator-backed
  choreography). Built with CSS 3D, all driven by `serviceProgress`:
  - room: black LED wall, `+` marker grid, three rows of giant grey
    `service.wallWord` ("SERVICES") under `rotateY(24deg)` drifting with
    scroll, blurred wash of the active panel image;
  - portal entry (`deriveServiceEntry`, first 12%): room zoomed 2.4x, white
    letters with red/cyan split, overlay-blended grain on black, settles to
    dim wall lettering. The overlay cross-fades in over the last 14% of the
    vision cover (`servicePortalMix`), so the rainbow dissolves into the
    SERVICES close-up instead of cutting via black;
  - panel carousel (`deriveServicePanelPose`): each item enters from the
    right edge turned toward the room centre, holds centre-left with its copy
    column (badge, title reveal, body, code) to the right, exits left while
    the next enters. Mobile (<=768px) stacks panel above copy.
- Data: `AlcheServiceItem` gained `badge` + `imageSrc` (reusing existing
  poster assets); service bodies are now localized for en/zh-CN/ja/ko
  (previously English in every locale); `service.wallWord`.
- CSS gotchas hit: `perspective` must sit on the transformed `.serviceSlide`
  or the media `rotateY` flattens; a transformed group isolates blending, so
  `.serviceRoom` needs its own black background for the overlay-blend grain;
  `.servicePanel` was already a legacy selector in several media queries,
  hence `.serviceSlide`.
- Stale account links fixed: GitHub account is now `MoonFlowFlower`
  (repo 301s there; old profile + old Pages domain 404). Updated
  `data/profile.ts`, `lib/site.ts` siteUrl, `app/layout.tsx` metadataBase.
- `scripts/linkcheck-local.sh`: falls back to `python` when `python3` is
  missing (Git Bash) and runs linkinator at concurrency 4. On Windows the
  python server still drops some connections (status `[0]`); every reported
  URL returns 200 when requested sequentially.
- Next: stellla section is still the flat DOM frame (reference 19.0-20.0s:
  full-bleed soft video "Dive into Fashion" + large stellla wordmark).

## Fifth pass (2026-09-26): vision gap, crystal refraction, mouse tilt

- **Vision rainbow was on the back face.** After the apex-up flip
  (baseRotationZ pi -> 0) the +x `rainbowFaceNormal` pointed away from the
  camera after the +Y mission turn, so the visible slab stayed grey. Now
  `[-0.866025, 0.5, 0]`. Rainbow palette is a vivid full-spectrum gradient
  with soft gloss (reference 15.0-16.0s) instead of pastel cyan/violet/pink.
- **Dead zone after the cover:** vision cover now ends when vision leaves the
  active viewport line (was one full viewport earlier); black fade starts at
  cover 0.85 (was 0.5); `vision_out` 1.0 -> 0.4 and `service_in` 1.0 -> 0.5
  section heights; service panel shows from serviceProgress 0.02 (was 0.1).
  Free-scroll now: mission -> turn -> rainbow slab + copy -> rainbow flood ->
  short dark cut -> service.
- **Crystal speckle:** frost jitter was screen-space per-pixel noise; now a
  smooth low-frequency warp in the crystal's uv space (stripes ripple like
  the reference). Refraction target budget unchanged (512 idle / 384 active,
  validator-enforced).
- **Mouse tilt:** `pointerYawStrength`/`pointerPitchStrength` existed but were
  never applied. CenterHeroModel now listens on window `pointermove` (the DOM
  shell covers the canvas, so R3F's pointer never updated), damped tilt
  0.42 / 0.26 rad, only in loading/kv/works* sections, disabled for reduced
  motion and captures (unless `pointerOverride` is set).
- **Known pre-existing failure:** `--vision-cover-live-only` asserts prism
  scale at the *document bottom*, written when vision was the last section.
  Since the 07-13 pass appended service/stellla/outro, the bottom is the
  outro and the prism is hidden (scale null). Reproduced on unmodified HEAD
  e3c15e0. The test needs to target the end of the vision section instead.
- `--endmark-live-only` passes with the new section heights.

## Fourth pass (2026-09-26): scroll dynamics vs reference video

Method: `ffmpeg` contact sheets of `Task/参考视频.mp4` (fps=2) vs
`scripts/capture-scroll-sweep.mjs` (32 evenly spaced free-scroll frames of the
live Pages site) and `scripts/capture-dev-shots.mjs` (named/debug URLs on the
dev server, prints card screen bounds as viewport ratios).

- **Works cards:** posters were low-res crops (DISCOAT was a 170x500 sliver
  stretched full-screen). DISCOAT / WEAR GO LAND / KizunaAI posters are now
  perspective-rectified 1280px crops from video 11.1s / 滚动stage8 /
  滚动stage6. Lead card scale 1.38 -> 0.84, yOffset -0.2, bendRadius
  3.1 -> 6.2: lead now spans ~22-77% x 20-82% (reference 26-77% x 22-79%).
  Poster shader: dropped full-height white streak bars and the wide rainbow
  frame; now slight RGB split + thin glossy rim + soft glint.
  Exit pose re-solved for the flatter bend (angle -1.3, radiusOffset 1.8) so
  card A is fully offscreen in cards-settled at 1440x1080 and 2560x1600.
- **kv -> works entry:** new `kv.wallZebra` channel. works_intro: crystal
  half-turn about Y (edge-on at midpoint, X/Z wobble, scale bump 1.42), wall
  crossfades violet haze -> greyscale warped zebra LED bands, crystal tint
  follows (`uVioletMix`, violet -> silver), MOONFLOW greys out before fading.
  works: crystal stays fully visible upright over the zebra wall until the
  first card arrives. Leaving the half turn wraps rotation.y by pi (the frame
  is half-turn symmetric) instead of spinning back; kv depth squash now folds
  yaw by pi as well.
- **WORKS wall word:** fillOpacity 0.9 -> 0.28 (linear alpha; old value read
  near-white), card-phase ghost effective alpha ~0.025.
- **Validator updates (intentional, reference-backed):** leadCenter
  centerYRatio 0.26-0.48 -> 0.3-0.58 (reference centre ~0.50); worksOpacity
  expectations scaled x0.31 to the new fillOpacity.
- **Known pre-existing failure:** `--cards-only` now passes every fixed-state
  and wide-viewport check, then stops at `assertPrismRefractionPerf
  (cards-a-center)`, which expects prism opacity >= 0.08 during works_cards.
  HEAD c06caba already hides the prism there ("no crystal while cards
  cycle"), so this guard failed before this pass too. Reference video 11.1s
  actually shows a grey crystal slab beside/behind the cards; resolving this
  needs a z-order decision (prism currently sits in front of the card arc).
- Still open: vision dead zone (sweep frames 19-23 are empty light grey where
  the reference has the rainbow slab + VISION copy), service/stellla are flat
  DOM vs reference 3D wall panels, wall does not echo the lead poster colours
  during works_cards (reference shows a blurred colour wash).
- Dev trap reminder: `npm run build` while `npm run dev` is running corrupts
  `.next` (every JS chunk 404s, no canvas). Stop dev, `rm -rf .next`, restart.

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
