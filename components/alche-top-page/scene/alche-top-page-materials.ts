"use client";

import * as THREE from "three";

import { ALCHE_TOP_MEDIA_WALL, ALCHE_TOP_WALL_TILE_DENSITY } from "@/lib/alche-top-page";

const ALCHE_TOP_WALL_CURVED_GRID_DENSITY_SCALE = 1.45;
const ALCHE_TOP_WALL_CURVE_DEPTH_SCALE = 1.70352;

export interface MaskedPrismLineArtUniforms {
  uOpacity: { value: number };
}

export interface PrismSideRainbowUniforms {
  uTime: { value: number };
  uOpacity: { value: number };
  uRainbowMix: { value: number };
  uBlackMix: { value: number };
  uCoverMix: { value: number };
  uTargetFaceNormal: { value: THREE.Vector3 };
}

export interface PrismIceUniforms {
  uSceneTexture: { value: THREE.Texture | null };
  uViewportPx: { value: THREE.Vector2 };
  uMaskBoundary: { value: number };
  uClipMode: { value: number };
  uRefractionStrength: { value: number };
  uLensWarpStrength: { value: number };
  uChromaticStrength: { value: number };
  uSceneRefractionMix: { value: number };
}

function spectralPalette(t: number) {
  const a = new THREE.Color("#89f2ff");
  const b = new THREE.Color("#f8fbff");
  const c = new THREE.Color("#ffd9f4");
  const d = new THREE.Color("#fff0cb");

  if (t < 0.33) return a.clone().lerp(b, t / 0.33);
  if (t < 0.66) return b.clone().lerp(c, (t - 0.33) / 0.33);
  return c.clone().lerp(d, (t - 0.66) / 0.34);
}

export function createPrismIceMaterial(map: THREE.Texture, uniforms: PrismIceUniforms) {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#f4fbff",
    emissiveIntensity: 0,
    roughness: 0.18,
    metalness: 0.02,
    map,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
  });
  material.forceSinglePass = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uViewportPx = uniforms.uViewportPx;
    shader.uniforms.uMaskBoundary = uniforms.uMaskBoundary;
    shader.uniforms.uClipMode = uniforms.uClipMode;
    shader.uniforms.uSceneTexture = uniforms.uSceneTexture;
    shader.uniforms.uRefractionStrength = uniforms.uRefractionStrength;
    shader.uniforms.uLensWarpStrength = uniforms.uLensWarpStrength;
    shader.uniforms.uChromaticStrength = uniforms.uChromaticStrength;
    shader.uniforms.uSceneRefractionMix = uniforms.uSceneRefractionMix;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `
          uniform sampler2D uSceneTexture;
          uniform vec2 uViewportPx;
          uniform float uMaskBoundary;
          uniform float uClipMode;
          uniform float uRefractionStrength;
          uniform float uLensWarpStrength;
          uniform float uChromaticStrength;
          uniform float uSceneRefractionMix;

          float alcheIceHash(vec2 p) {
            p = fract(p * vec2(123.34, 345.45));
            p += dot(p, p + 34.345);
            return fract(p.x * p.y);
          }

          float alcheIceNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = alcheIceHash(i);
            float b = alcheIceHash(i + vec2(1.0, 0.0));
            float c = alcheIceHash(i + vec2(0.0, 1.0));
            float d = alcheIceHash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          float alcheIceFbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 3; i++) {
              value += alcheIceNoise(p) * amplitude;
              p = p * 2.07 + vec2(7.13, 3.71);
              amplitude *= 0.5;
            }
            return value;
          }

          void main() {
            float screenY = gl_FragCoord.y / max(uViewportPx.y, 1.0);
            float epsilon = 0.75 / max(uViewportPx.y, 1.0);
            if (uClipMode < 0.5) {
              if (screenY < uMaskBoundary - epsilon) discard;
            } else {
              if (screenY >= uMaskBoundary - epsilon) discard;
            }
        `,
      )
      .replace(
        "#include <dithering_fragment>",
        `
          float iceFresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 1.65);
          float iceBaseAlpha = gl_FragColor.a;
          #ifdef USE_MAP
            vec2 iceUv = vMapUv;
            float grainNoise = alcheIceNoise(iceUv * 124.0 + vec2(3.7, 8.2));
            float broadNoise = alcheIceFbm(iceUv * 6.6 + vec2(2.1, 6.4));
            vec2 noiseWarp = vec2(
              alcheIceNoise(iceUv * 9.0 + vec2(11.0 + broadNoise * 2.0, 17.0)),
              alcheIceNoise(iceUv * 10.5 + vec2(29.0, 5.0 + broadNoise * 2.5))
            ) - 0.5;
            vec2 paneUv = iceUv - 0.5;
            float roundedBox = pow(abs(paneUv.x), 8.0) + pow(abs(paneUv.y), 8.0);
            float glassBody = clamp((1.0 - roundedBox * 190.0) * 3.0, 0.0, 1.0);
            float glassBorder =
              clamp((0.95 - roundedBox * 178.0) * 8.0, 0.0, 1.0) -
              clamp((0.78 - roundedBox * 178.0) * 8.0, 0.0, 1.0);
            float lensStrength = clamp((1.0 - roundedBox * 58.0) * 0.16, -0.18, 0.18);
            vec2 lensUv = clamp((iceUv - 0.5) * (1.0 - lensStrength) + 0.5 + noiseWarp * 0.018, vec2(0.001), vec2(0.999));
            float iceBand = smoothstep(
              0.76,
              0.985,
              sin((lensUv.y + lensUv.x * 0.34) * 31.0 + sin(lensUv.x * 19.0 + broadNoise * 5.0) * 2.1 + broadNoise * 6.5) * 0.5 + 0.5
            );
            float lensTransition = smoothstep(0.0, 1.0, glassBody + glassBorder);
            float refractionCaustic = smoothstep(0.42, 0.95, broadNoise + grainNoise * 0.25) * glassBody;
            vec2 screenUv = clamp(gl_FragCoord.xy / max(uViewportPx, vec2(1.0)), vec2(0.001), vec2(0.999));
            vec2 radialWarp = (paneUv + noiseWarp * 0.035) * (1.35 - roundedBox * 18.0);
            radialWarp = clamp(radialWarp, vec2(-0.82), vec2(0.82));
            vec2 bandWarp = vec2(
              sin((iceUv.y + broadNoise * 0.09) * 18.0 + iceUv.x * 5.5),
              cos((iceUv.x + grainNoise * 0.04) * 11.0 + iceUv.y * 6.2)
            );
            float refractMask = lensTransition * (0.35 + glassBody * 0.65);
            vec2 sceneOffset =
              (radialWarp * uLensWarpStrength * 1.18 + noiseWarp * 0.24 + bandWarp * iceBand * 0.08) *
              uRefractionStrength *
              refractMask;
            sceneOffset = clamp(sceneOffset, vec2(-0.035), vec2(0.035));
            vec2 sceneUv = clamp(screenUv + sceneOffset, vec2(0.001), vec2(0.999));
            float chromaMask = clamp((glassBorder * 1.05 + iceFresnel * 0.55) * refractMask, 0.0, 1.0);
            vec2 chromaOffset = normalize(sceneOffset + vec2(0.0001, -0.0002)) * uChromaticStrength * chromaMask;
            float sceneRefractionMix = clamp(uSceneRefractionMix, 0.0, 1.0);
            vec3 directScene = texture2D(uSceneTexture, sceneUv).rgb;
            vec3 chromaScene = directScene;
            if (sceneRefractionMix > 0.001) {
              chromaScene = vec3(
                texture2D(uSceneTexture, clamp(sceneUv + chromaOffset, vec2(0.001), vec2(0.999))).r,
                directScene.g,
                texture2D(uSceneTexture, clamp(sceneUv - chromaOffset, vec2(0.001), vec2(0.999))).b
              );
            }
            vec3 lensColor = gl_FragColor.rgb;
            float edgeSparkle = clamp(glassBorder * 1.1 + iceFresnel * 0.85, 0.0, 1.0);
            lensColor += vec3(0.98, 0.995, 1.0) * glassBody * 0.04;
            lensColor += vec3(0.9, 0.98, 1.0) * glassBorder * 0.82;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, lensColor, lensTransition * 0.14);

            // Reference kv crystal: the body is a thick violet glass that shows
            // the scene behind it magnified and frost-smeared (the wordmark
            // turns into white spray inside the prism). Split/mission mode
            // (uSceneRefractionMix 0.28) keeps the legacy pale-ice read.
            float bodyMix = smoothstep(0.3, 0.95, sceneRefractionMix);
            if (bodyMix > 0.001) {
              vec2 frostJitter =
                (vec2(alcheIceNoise(gl_FragCoord.xy * 0.73), alcheIceNoise(gl_FragCoord.xy * 0.73 + 17.0)) - 0.5) *
                (0.006 + broadNoise * 0.014);
              // Lens magnification toward the crystal centre + frost offset.
              vec2 bodyOffset = clamp(sceneOffset * 2.4 - paneUv * 0.05, vec2(-0.08), vec2(0.08));
              vec3 refrA = texture2D(uSceneTexture, clamp(screenUv + bodyOffset + frostJitter, vec2(0.001), vec2(0.999))).rgb;
              vec3 refrB = texture2D(uSceneTexture, clamp(screenUv + bodyOffset * 1.4 - frostJitter * 1.7, vec2(0.001), vec2(0.999))).rgb;
              vec3 refracted = (refrA + refrB) * 0.5;
              float refrLum = dot(refracted, vec3(0.2126, 0.7152, 0.0722));
              vec3 violet = vec3(0.3, 0.13, 0.95);
              vec3 body = refracted * mix(vec3(1.0), violet * 1.25, 0.78) * 1.35 + violet * 0.05;
              float frostMask = smoothstep(0.2, 0.8, refrLum) * smoothstep(0.35, 0.9, broadNoise + grainNoise * 0.4);
              body = mix(body, vec3(refrLum * 1.1) + violet * 0.08, frostMask * 0.5);
              body += vec3(0.75, 0.72, 1.0) * refractionCaustic * 0.03;
              // Glass lift: the crystal body sits a touch brighter than the
              // wall seen through the hole so the frame reads as a solid.
              body += violet * 0.09 * (0.6 + broadNoise * 0.8);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, body, bodyMix * 0.92);
            }
            gl_FragColor.rgb += (chromaScene - directScene) * chromaMask * sceneRefractionMix * 0.72;
            gl_FragColor.rgb += vec3(0.98, 1.0, 1.0) * iceBand * edgeSparkle * 0.095;
            gl_FragColor.rgb += vec3(0.9, 0.97, 1.0) * iceBand * iceFresnel * 0.16;
            gl_FragColor.rgb += vec3(0.9, 0.985, 1.0) * refractionCaustic * iceFresnel * 0.32;
            gl_FragColor.rgb += (grainNoise - 0.5) * vec3(0.004) * iceBaseAlpha;
            gl_FragColor.a = min(iceBaseAlpha + iceBaseAlpha * (iceBand * edgeSparkle * 0.025 + glassBorder * 0.14 + refractMask * 0.04), 0.6);
            // Refracted body already carries the background, so it can go
            // near-opaque (scaled by the fade-in opacity, target 0.62).
            gl_FragColor.a = mix(gl_FragColor.a, clamp(iceBaseAlpha / 0.62, 0.0, 1.0) * 0.97, bodyMix);
          #endif
          gl_FragColor.rgb += vec3(0.52, 0.68, 0.82) * iceFresnel * 0.16;
          gl_FragColor.rgb += vec3(0.96, 0.995, 1.0) * iceFresnel * 0.48;
          float iceAlphaCap = mix(0.6, 0.98, smoothstep(0.3, 0.95, clamp(uSceneRefractionMix, 0.0, 1.0)));
          gl_FragColor.a = min(gl_FragColor.a + iceBaseAlpha * iceFresnel * 0.09, iceAlphaCap);
          #include <dithering_fragment>
        `,
      );
  };
  material.customProgramCacheKey = () => `alche-prism-ice:single-clear-gem:${uniforms.uClipMode.value}`;
  material.needsUpdate = true;

  return material;
}

export interface WorksPosterUniforms {
  uTime: { value: number };
  uSheen: { value: number };
}

export function createWorksPosterMaterial(map: THREE.Texture, uniforms: WorksPosterUniforms) {
  const material = new THREE.MeshBasicMaterial({
    map,
    color: "#ffffff",
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSheen = uniforms.uSheen;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `
          uniform float uTime;
          uniform float uSheen;

          vec3 posterHsv2rgb(vec3 c) {
            vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            rgb = rgb * rgb * (3.0 - 2.0 * rgb);
            return c.z * mix(vec3(1.0), rgb, c.y);
          }

          void main() {
        `,
      )
      .replace(
        "#include <dithering_fragment>",
        `
          #ifdef USE_MAP
            vec2 posterUv = vMapUv;
            // Moving vertical specular streaks (reference LED-screen highlights).
            float streakPhase = posterUv.x * 4.6 - posterUv.y * 0.55 - uTime * 0.34;
            float streakA = smoothstep(0.9, 0.995, sin(streakPhase * 6.2831) * 0.5 + 0.5);
            float streakB = smoothstep(0.86, 0.99, sin(streakPhase * 2.7 + 1.7) * 0.5 + 0.5);
            float streak = clamp(streakA * 0.75 + streakB * 0.45, 0.0, 1.0);

            // Chromatic fringe hugging the card border.
            float edgeDist = min(min(posterUv.x, 1.0 - posterUv.x), min(posterUv.y, 1.0 - posterUv.y));
            float fringeMask = 1.0 - smoothstep(0.0, 0.055, edgeDist);
            vec3 fringe = posterHsv2rgb(vec3(fract(posterUv.x * 1.4 + posterUv.y * 0.9 + uTime * 0.05), 0.72, 1.0));

            gl_FragColor.rgb += vec3(1.0, 0.99, 0.97) * streak * 0.2 * uSheen;
            gl_FragColor.rgb += fringe * fringeMask * 0.28 * uSheen;
            // faint screen-edge falloff keeps the panel reading as a lit screen
            gl_FragColor.rgb *= 0.92 + 0.08 * smoothstep(0.0, 0.12, edgeDist);
          #endif
          #include <dithering_fragment>
        `,
      );
  };
  material.customProgramCacheKey = () => "alche-works-poster-sheen";
  material.needsUpdate = true;

  return material;
}

export function createCurvedGridMaterial(_wallTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uWhiteMix: { value: 0 },
      uGlow: { value: 0.7 },
      uExposure: { value: 1 },
      uFlatten: { value: 0 },
      uSceneFade: { value: 1 },
      uWallRadius: { value: 5 },
      uWallHalfWidth: { value: 11 },
      uWallHalfHeight: { value: 5.7 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      attribute float aWallU;
      attribute float aWallV;

      uniform float uFlatten;
      uniform float uWallRadius;
      uniform float uWallHalfWidth;
      uniform float uWallHalfHeight;

      varying vec2 vMediaUv;

      void main() {
        float safeFlatten = clamp(uFlatten, 0.0, 1.0);
        float flattenMix = smoothstep(0.0, 1.0, safeFlatten);
        float curveMix = 1.0 - flattenMix;
        float radius = max(uWallRadius, 0.001);
        float wallU = aWallU * uWallHalfWidth;
        float wallV = aWallV * uWallHalfHeight;
        float planeZ = mix(radius, -radius, flattenMix);
        float curveDepth = radius * ${ALCHE_TOP_WALL_CURVE_DEPTH_SCALE.toFixed(5)};
        float edgeSag = (1.0 - cos(min(abs(aWallU), 1.0) * 1.5707963)) * curveDepth * curveMix;
        float z = planeZ - curveDepth * curveMix + edgeSag;

        vec3 transformed = vec3(wallU, wallV, z);

        vec4 world = modelMatrix * vec4(transformed, 1.0);
        vMediaUv = vec2(aWallU * 0.5 + 0.5, aWallV * 0.5 + 0.5);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec2 vMediaUv;

      uniform float uTime;
      uniform float uIntro;
      uniform float uWhiteMix;
      uniform float uGlow;
      uniform float uExposure;
      uniform float uFlatten;
      uniform float uSceneFade;
      uniform vec2 uViewportPx;

      float linePulse(float value, float width) {
        float grid = abs(fract(value - 0.5) - 0.5) / fwidth(value);
        return 1.0 - min(grid / width, 1.0);
      }

      float wallHash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 uv = vMediaUv;
        float flattenMix = smoothstep(0.0, 1.0, clamp(uFlatten, 0.0, 1.0));
        float gridDensityScale = mix(${ALCHE_TOP_WALL_CURVED_GRID_DENSITY_SCALE.toFixed(2)}, 1.0, flattenMix);
        vec2 gridUv = (uv - 0.5) * gridDensityScale + 0.5;
        // Denser tile lattice for the dark LED wall (reference tiles are
        // roughly 1.7x finer); the light technical-paper grid keeps its scale.
        float earlyWhiteMix = smoothstep(0.0, 1.0, clamp(uWhiteMix, 0.0, 1.0));
        float tileDensityMul = mix(1.75, 1.0, earlyWhiteMix);
        vec2 microGridUv = vec2(
          gridUv.x * ${(ALCHE_TOP_MEDIA_WALL.cellColumns * ALCHE_TOP_WALL_TILE_DENSITY).toFixed(1)},
          gridUv.y * ${(ALCHE_TOP_MEDIA_WALL.cellRows * ALCHE_TOP_WALL_TILE_DENSITY).toFixed(1)}
        ) * tileDensityMul;
        vec2 frameGridUv = vec2(
          gridUv.x * ${ALCHE_TOP_MEDIA_WALL.cellColumns.toFixed(1)},
          gridUv.y * ${ALCHE_TOP_MEDIA_WALL.cellRows.toFixed(1)}
        ) * tileDensityMul;
        float microV = linePulse(microGridUv.x, 1.05);
        float microH = linePulse(microGridUv.y, 1.05);
        float frameV = linePulse(frameGridUv.x, 1.75);
        float frameH = linePulse(frameGridUv.y, 1.75);
        float microGrid = clamp(microV + microH, 0.0, 1.0);
        float frameGrid = clamp(frameV + frameH, 0.0, 1.0);
        float verticalShade = 1.0 - abs(uv.y - 0.5) * 0.05;
        float introExposure = mix(0.94, 1.0, smoothstep(0.0, 0.92, uIntro));

        // --- dark LED media-wall palette ---
        // Values are LINEAR (OutputPass encodes to sRGB, ~3x brighter on
        // screen). Reference kv wall: near-black panels with little per-panel
        // variance, a violet bloom behind the crystal, thin grey LED lattice
        // lines, black panel seams and a sparse "+" marker lattice.
        vec2 tileId = floor(frameGridUv);
        float tileVar = wallHash21(tileId);
        float tileFlicker = 0.5 + 0.5 * sin(uTime * 0.42 + tileVar * 6.28318 + tileId.x * 0.7);
        float tileLevel = mix(0.55, 1.0, tileVar);
        tileLevel *= 0.9 + tileFlicker * 0.1;

        // LED pixel lattice inside each tile
        vec2 dotUv = fract(microGridUv) - 0.5;
        float dotMask = smoothstep(0.46, 0.16, length(dotUv));
        float dotField = dotMask * (0.5 + tileVar * 0.5);

        // Violet bloom behind the crystal (reference kv purple haze), wide and
        // centred slightly above the word line.
        // Only the central ~60% of the wall uv is on screen at kv framing.
        vec2 glowCentered = vec2((uv.x - 0.5) * 3.1, (uv.y - 0.5) * 3.6);
        float centerGlow = exp(-dot(glowCentered, glowCentered) * 1.9) * clamp(uGlow, 0.0, 1.4);
        vec2 glowTight = vec2((uv.x - 0.5) * 4.6, (uv.y - 0.5) * 5.2);
        float glowCore = exp(-dot(glowTight, glowTight) * 2.4) * clamp(uGlow, 0.0, 1.4);

        vec3 darkBase = vec3(0.0016, 0.0014, 0.0032);
        vec3 darkTileTint = vec3(0.0046, 0.0042, 0.0085);
        vec3 darkDotColor = vec3(0.03, 0.028, 0.045);
        vec3 darkSeamColor = vec3(0.0003, 0.0003, 0.0006);
        vec3 violetHaze = vec3(0.034, 0.011, 0.13);
        vec3 violetCore = vec3(0.045, 0.016, 0.16);

        vec3 darkColor = mix(darkBase, darkTileTint, tileLevel);
        darkColor += darkDotColor * dotField * (0.12 + glowCore * 0.5);

        // Thin LED lattice lines (reference: faint grey hairlines inside each
        // panel, brighter than the panel body, darker than content).
        darkColor += vec3(0.011, 0.011, 0.016) * microGrid * (0.6 + centerGlow * 0.8);

        // Rare colour-tinted tiles: faint content reflections on the LED wall.
        float accentVar = wallHash21(tileId + vec2(7.31, 3.17));
        float accentMask = step(0.93, accentVar);
        float accentPulse = 0.6 + 0.4 * sin(uTime * 0.5 + accentVar * 31.4);
        vec3 accentColor = mix(vec3(0.05, 0.03, 0.12), vec3(0.03, 0.04, 0.08), fract(accentVar * 7.0));
        darkColor += accentColor * accentMask * accentPulse * (0.25 + dotField * 0.2);

        // Diagonal zebra light sweep drifting across the LED wall (reference
        // works_outro stripes); rides on tile brightness so seams stay black.
        float sweepPhase = uv.x * 2.6 - uv.y * 1.35 - uTime * 0.045;
        float sweepBand = smoothstep(0.62, 0.98, sin(sweepPhase * 6.2831) * 0.5 + 0.5);
        float sweepBandWide = smoothstep(0.3, 0.9, sin(sweepPhase * 2.2 + 0.9) * 0.5 + 0.5);
        darkColor += vec3(0.012, 0.012, 0.016) * sweepBand * (0.35 + tileLevel * 0.65);
        darkColor += vec3(0.004, 0.004, 0.006) * sweepBandWide * tileLevel;

        darkColor += violetHaze * centerGlow * (0.55 + dotField * 0.45);
        darkColor += violetCore * glowCore * (0.35 + dotField * 0.35);
        darkColor = mix(darkColor, darkSeamColor, frameGrid * 0.94);

        // Sparse "+" marker lattice floating on the wall (reference kv).
        vec2 markUv = gridUv * vec2(${(ALCHE_TOP_MEDIA_WALL.cellColumns / 2).toFixed(1)}, ${(ALCHE_TOP_MEDIA_WALL.cellRows / 2).toFixed(1)});
        vec2 markLocal = (fract(markUv) - 0.5) / max(fwidth(markUv), vec2(1e-5));
        float markArm = 7.0;
        float markH = step(abs(markLocal.y), 0.6) * step(abs(markLocal.x), markArm);
        float markV = step(abs(markLocal.x), 0.6) * step(abs(markLocal.y), markArm);
        float marker = clamp(markH + markV, 0.0, 1.0);
        darkColor = mix(darkColor, vec3(0.16, 0.16, 0.19), marker * 0.75);

        // --- light technical-paper palette (mission side) ---
        vec3 baseColor = vec3(0.972, 0.976, 0.98);
        vec3 microLineColor = vec3(0.82, 0.835, 0.85);
        vec3 frameLineColor = vec3(0.08, 0.085, 0.095);
        vec3 lightColor = mix(baseColor, microLineColor, microGrid * 0.88);
        lightColor = mix(lightColor, frameLineColor, frameGrid * 0.9);

        float whiteMix = smoothstep(0.0, 1.0, clamp(uWhiteMix, 0.0, 1.0));
        vec3 color = mix(darkColor, lightColor, whiteMix);
        color *= verticalShade * introExposure * uExposure;
        color *= mix(1.0, 0.992, uFlatten);

        float alpha = 0.995 * uIntro * uSceneFade;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createGalleryPlaneMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uVisibility: { value: 0 },
      uWhiteMix: { value: 0 },
      uIndex: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vPosition;

      uniform float uTime;
      uniform float uVisibility;
      uniform float uWhiteMix;
      uniform float uIndex;

      float linePulse(float value, float width) {
        float grid = abs(fract(value - 0.5) - 0.5) / fwidth(value);
        return 1.0 - min(grid / width, 1.0);
      }

      void main() {
        vec2 uv = vUv;
        vec2 centered = uv - 0.5;
        float frame = smoothstep(0.06, 0.0, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
        float diagonal = linePulse((uv.x + uv.y * 0.72 + uIndex * 0.17) * 10.0, 1.8) * 0.16;
        float scan = linePulse(uv.y * 38.0 + uTime * 0.2, 2.4) * 0.08;
        float slabA = smoothstep(0.14, 0.145, uv.y) * (1.0 - smoothstep(0.28, 0.285, uv.y));
        float slabB = smoothstep(0.43, 0.435, uv.y) * (1.0 - smoothstep(0.72, 0.725, uv.y));
        float caption = smoothstep(0.79, 0.794, uv.y) * (1.0 - smoothstep(0.9, 0.905, uv.y));
        float rim = smoothstep(0.7, 0.04, abs(centered.x * 0.88 + centered.y * 1.3 - 0.08)) * 0.16;

        vec3 darkBase = vec3(0.052, 0.06, 0.076);
        vec3 lightBase = vec3(0.96, 0.965, 0.975);
        vec3 darkInk = vec3(0.66, 0.76, 0.92);
        vec3 lightInk = vec3(0.14, 0.15, 0.18);
        vec3 base = mix(darkBase, lightBase, uWhiteMix);
        vec3 ink = mix(darkInk, lightInk, uWhiteMix);

        vec3 color = base;
        color += ink * (frame * 0.28 + diagonal * 0.52 + scan * 0.62);
        color += ink * (slabA * 0.08 + slabB * 0.06 + caption * 0.07);
        color += rim * mix(vec3(0.44, 0.68, 0.84), vec3(0.18), uWhiteMix);
        color += mix(vec3(0.06, 0.22, 0.26), vec3(0.05), uWhiteMix) * smoothstep(0.82, 0.06, length(centered * vec2(0.9, 0.72))) * 0.26;

        float alpha = (0.045 + frame * 0.18 + diagonal * 0.12 + slabB * 0.06) * uVisibility;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createMaskedPrismLineArtMaterial(uniforms?: MaskedPrismLineArtUniforms) {
  const sharedUniforms: MaskedPrismLineArtUniforms =
    uniforms ??
    {
      uOpacity: { value: 0 },
    };

  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    uniforms: {
      uOpacity: sharedUniforms.uOpacity,
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vModelPos;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vModelPos = position;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;

      varying vec2 vUv;
      varying vec3 vModelPos;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      float linePulse(float value, float width) {
        float grid = abs(fract(value - 0.5) - 0.5) / fwidth(value);
        return 1.0 - min(grid / width, 1.0);
      }

      void main() {
        vec2 uv = vUv;
        vec3 normal = normalize(vNormalWorld);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.25);

        float diagonalA = linePulse((vModelPos.y + vModelPos.x * 0.22 + 1.8) * 2.9, 1.25) * 0.34;
        float diagonalB = linePulse((vModelPos.y - vModelPos.x * 0.38 + 1.25) * 3.3, 1.2) * 0.26;
        float vertical = linePulse((vModelPos.x + 0.72) * 5.2, 1.4) * 0.18;
        float horizontal = linePulse((vModelPos.y + 1.55) * 5.8, 1.45) * 0.14;
        float uvFrame = smoothstep(0.08, 0.0, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y))) * 0.42;
        float uvDiagonal = linePulse((uv.x + uv.y * 0.82) * 8.5, 1.2) * 0.18;
        float uvCross = linePulse((uv.x - uv.y * 0.94 + 0.18) * 10.0, 1.2) * 0.14;
        float contour = smoothstep(0.16, 0.84, fresnel) * 0.52;

        float lineField = diagonalA + diagonalB + vertical + horizontal + uvFrame + uvDiagonal + uvCross + contour;
        float alpha = clamp(lineField, 0.0, 1.0) * uOpacity;
        vec3 color = vec3(0.58, 0.62, 0.7);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createPrismSideRainbowMaterial(uniforms?: PrismSideRainbowUniforms) {
  const sharedUniforms: PrismSideRainbowUniforms =
    uniforms ??
    {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uRainbowMix: { value: 0 },
      uBlackMix: { value: 0 },
      uCoverMix: { value: 0 },
      uTargetFaceNormal: { value: new THREE.Vector3(-0.866025, 0.5, 0) },
    };

  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uOpacity: sharedUniforms.uOpacity,
      uRainbowMix: sharedUniforms.uRainbowMix,
      uBlackMix: sharedUniforms.uBlackMix,
      uCoverMix: sharedUniforms.uCoverMix,
      uTargetFaceNormal: sharedUniforms.uTargetFaceNormal,
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vModelPos;
      varying vec3 vWorldPos;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vModelPos = position;
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uRainbowMix;
      uniform float uBlackMix;
      uniform float uCoverMix;
      uniform vec3 uTargetFaceNormal;

      varying vec2 vUv;
      varying vec3 vModelPos;
      varying vec3 vWorldPos;

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 faceNormalModel = normalize(cross(dFdx(vModelPos), dFdy(vModelPos)));
        vec3 targetFaceNormal = normalize(uTargetFaceNormal);
        float faceMask = smoothstep(0.985, 0.9985, dot(faceNormalModel, targetFaceNormal));
        if (faceMask <= 0.0001 || uOpacity <= 0.0001) discard;

        vec3 worldNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - abs(dot(viewDir, worldNormal)), 1.7);

        float flowA = sin(vModelPos.y * 3.2 + vModelPos.x * 1.45 + uTime * 0.78);
        float flowB = sin(vModelPos.x * 4.9 - vModelPos.y * 1.18 - uTime * 0.64);
        float flowC = sin((vModelPos.x + vModelPos.y) * 2.7 + uTime * 0.42);
        float warp = flowA * 0.11 + flowB * 0.09 + flowC * 0.07;
        float hueDrift =
          vUv.y * 0.18 +
          vModelPos.y * 0.12 +
          vModelPos.x * 0.08 +
          warp +
          uTime * 0.028;
        // Narrow the sweep to a soft cyan -> violet -> pink iridescence.
        float hue = fract(0.42 + sin(hueDrift * 2.4) * 0.21);

        float band = sin((vModelPos.y * 2.2 - vModelPos.x * 1.05) * 2.6 + uTime * 0.9) * 0.5 + 0.5;
        float grain = hash21(gl_FragCoord.xy * 0.91 + vec2(uTime * 24.0, uTime * 16.0));
        float sparkle = smoothstep(0.76, 0.995, grain) * (0.16 + uRainbowMix * 0.1);
        float saturation = mix(0.34, 0.58, uRainbowMix);
        float value = 0.8 + band * 0.1 + fresnel * 0.14 + sparkle * 0.18;

        vec3 rainbow = hsv2rgb(vec3(hue, saturation, min(value, 1.0)));
        rainbow = mix(rainbow, vec3(0.985, 0.985, 1.0), 0.06 + fresnel * 0.05);

        // Reference vision slab: as the face covers the viewport it turns into
        // a heavily dithered monochrome-noise panel with rainbow smears.
        float coverMix = clamp(uCoverMix, 0.0, 1.0);
        if (coverMix > 0.001) {
          float slabGrain = hash21(gl_FragCoord.xy * 0.97 + vec2(uTime * 41.0, -uTime * 27.0));
          float slabGrainB = hash21(gl_FragCoord.xy * 0.53 + vec2(-uTime * 19.0, uTime * 33.0));
          float smear = sin((vUv.y * 2.4 - vUv.x * 1.3) * 3.1 + uTime * 0.5) * 0.5 + 0.5;
          float mono = step(slabGrain, 0.32 + smear * 0.5 + (slabGrainB - 0.5) * 0.3);
          vec3 slabColor = mix(vec3(slabGrain * 0.9), rainbow * (0.55 + smear * 0.7), smoothstep(0.55, 0.95, smear));
          slabColor *= 0.25 + mono * 0.95;
          rainbow = mix(rainbow, slabColor, coverMix * 0.85);
        }

        vec3 finalColor = mix(rainbow, vec3(0.0), clamp(uBlackMix, 0.0, 1.0));
        float alpha = faceMask * uOpacity * (0.96 + fresnel * 0.18);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });
}

export function createPrismMaterial(layer: "core" | "shell" = "core") {
  const isShell = layer === "shell";

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uWhiteMix: { value: 0 },
      uIntensity: { value: isShell ? 0.44 : 1 },
      uResolution: { value: new THREE.Vector2(1440, 900) },
      uOpacity: { value: isShell ? 0.24 : 0.7 },
      uShellMix: { value: isShell ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vClipPos = projectionMatrix * viewMatrix * world;
        gl_Position = vClipPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntro;
      uniform float uWhiteMix;
      uniform float uIntensity;
      uniform vec2 uResolution;
      uniform float uOpacity;
      uniform float uShellMix;

      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;

      vec3 palette(float t) {
        vec3 a = vec3(0.48, 0.97, 1.0);
        vec3 b = vec3(0.98, 0.995, 1.0);
        vec3 c = vec3(1.0, 0.82, 0.95);
        vec3 d = vec3(1.0, 0.94, 0.76);

        if (t < 0.33) return mix(a, b, t / 0.33);
        if (t < 0.66) return mix(b, c, (t - 0.33) / 0.33);
        return mix(c, d, (t - 0.66) / 0.34);
      }

      float linePulse(float value, float width) {
        float grid = abs(fract(value - 0.5) - 0.5) / fwidth(value);
        return 1.0 - min(grid / width, 1.0);
      }

      vec2 lens(vec2 uv, float amount) {
        vec2 p = uv * 2.0 - 1.0;
        float r2 = dot(p, p);
        p *= 1.0 + r2 * amount;
        return p * 0.5 + 0.5;
      }

      vec3 chamberField(vec2 uv, float shift, float whiteMix) {
        uv = lens(uv + vec2(shift * 0.008, shift * 0.003), 0.028 + shift * 0.01);
        vec2 wallUv = uv;
        vec2 cellUv = vec2(wallUv.x * 26.0, wallUv.y * 14.0);
        float seamV = linePulse(cellUv.x, 0.92);
        float seamH = linePulse(cellUv.y, 0.92);
        float microV = linePulse(cellUv.x * 4.0, 2.8) * 0.14;
        float microH = linePulse(cellUv.y * 4.0, 2.8) * 0.14;
        float coreBand = smoothstep(0.88, 0.1, abs(wallUv.x - 0.5)) * smoothstep(0.94, 0.24, abs(wallUv.y - 0.48));
        float wordBars = smoothstep(0.28, 0.24, abs(wallUv.y - 0.5));

        vec3 darkBase = vec3(0.006, 0.008, 0.011);
        vec3 lightBase = vec3(0.97, 0.975, 0.985);
        vec3 darkLines = vec3(0.85, 0.9, 0.98) * 0.28;
        vec3 lightLines = vec3(0.15, 0.16, 0.19) * 0.3;
        vec3 base = mix(darkBase, lightBase, whiteMix);
        vec3 lineColor = mix(darkLines, lightLines, whiteMix);
        vec3 wordGlow = mix(vec3(0.92), vec3(0.16), whiteMix);

        vec3 color = base + lineColor * (seamV + seamH + microV + microH);
        color += wordGlow * coreBand * wordBars * 0.42;
        return color;
      }

      void main() {
        vec3 normal = normalize(vNormalWorld);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.1);
        vec2 screenUv = (vClipPos.xy / max(vClipPos.w, 0.0001)) * 0.5 + 0.5;

        vec2 flow = vec2(
          sin(vWorldPos.y * 3.4 + uTime * 0.28),
          cos(vWorldPos.x * 4.2 - uTime * 0.24)
        ) * 0.003;
        vec2 normalDrift = normal.xy * (0.018 + fresnel * 0.048) + flow;

        vec3 refracted;
        refracted.r = chamberField(screenUv + normalDrift * 0.62, 0.5, uWhiteMix).r;
        refracted.g = chamberField(screenUv + normalDrift * 0.96, 0.0, uWhiteMix).g;
        refracted.b = chamberField(screenUv + normalDrift * 1.28, -0.5, uWhiteMix).b;

        float liquid = 0.5 + 0.5 * sin(vWorldPos.y * 5.8 + vWorldPos.x * 2.4 - uTime * 0.34);
        float verticalBias = smoothstep(-1.2, 1.4, vWorldPos.y);
        float contour = linePulse((vWorldPos.y + vWorldPos.x * 0.2 + 2.0) * 1.45, 2.2) * 0.09;

        vec3 spectral = palette(clamp(fresnel * 0.8 + liquid * 0.2, 0.0, 1.0));
        vec3 darkBody = mix(vec3(0.018, 0.022, 0.034), spectral, 0.5 + fresnel * 0.12);
        vec3 lightBody = mix(vec3(0.95, 0.965, 0.99), spectral, 0.16 + fresnel * 0.08);
        vec3 body = mix(darkBody, lightBody, uWhiteMix);
        body = mix(body, spectral, verticalBias * 0.06);

        vec3 color = mix(refracted, body, 0.34 + uShellMix * 0.22);
        color += spectral * fresnel * (0.26 + uShellMix * 0.12);
        color += contour * mix(vec3(0.42, 0.52, 0.72), vec3(0.18), uWhiteMix);
        color *= 0.92 + uIntensity * 0.16;

        float alpha = (0.34 + fresnel * 0.24 + uShellMix * 0.06) * uOpacity * mix(0.0, 1.0, uIntro);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createHaloMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uWhiteMix: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform float uTime;
      uniform float uIntro;
      uniform float uWhiteMix;

      void main() {
        vec2 uv = vUv - 0.5;
        float ring = smoothstep(0.48, 0.12, abs(length(uv) - 0.36));
        float sweep = 0.5 + 0.5 * sin(atan(uv.y, uv.x) * 4.0 - uTime * 0.18);
        float pulse = 0.5 + 0.5 * sin(uTime * 0.26);
        vec3 dark = vec3(0.16, 0.4, 0.84);
        vec3 light = vec3(1.0);
        vec3 color = mix(dark, light, uWhiteMix);
        gl_FragColor = vec4(color * ring * (0.06 + sweep * 0.08 + pulse * 0.03) * uIntro, ring * 0.24 * uIntro);
      }
    `,
  });
}

export function createEmissiveWordMaterial(color = "#ffffff") {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.4,
    metalness: 0.08,
    roughness: 0.24,
    transparent: true,
    opacity: 1,
  });
}

export function createStructureMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#0a0d12",
    emissive: "#1d2534",
    emissiveIntensity: 0.2,
    metalness: 0.42,
    roughness: 0.76,
    transparent: true,
    opacity: 0,
  });
}

export function createPrismEdgeColor(progress: number, whiteMix: number) {
  const spectral = spectralPalette((progress % 1 + 1) % 1);
  return whiteMix > 0.5 ? spectral.multiplyScalar(0.32) : spectral.multiplyScalar(0.72);
}
// dark-direction pass 2026-07-13
