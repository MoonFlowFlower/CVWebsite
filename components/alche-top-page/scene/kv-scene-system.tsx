"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { Text, configureTextBuilder } from "troika-three-text";

import {
  type AlcheWorksCardDebugMode,
  getCompensatedAlcheWorksCardPoseDefinition,
  getAlcheWorksCardPoseDefinition,
  getAlcheWorksCardsSegment,
} from "@/lib/alche-works-shotbook";
import {
  ALCHE_TOP_CENTER_MODEL,
  ALCHE_TOP_MOONFLOW,
  ALCHE_TOP_KV_WALL_ARC_STRENGTH,
  ALCHE_TOP_MEDIA_WALL,
  deriveMissionPanelBoundaryFromProgress,
  deriveMissionTransitionOverlayState,
  ALCHE_TOP_WORKS_CARDS,
  ALCHE_TOP_WALL_WORD,
  ALCHE_TOP_WALL_TILE_DENSITY,
  clamp01,
  remapRange,
  smoothstep,
  type AlcheLayerDebugState,
  type AlchePointerDebugState,
  type AlcheTopSceneState,
} from "@/lib/alche-top-page";
import {
  createCurvedGridMaterial,
  createPrismIceMaterial,
  type PrismIceUniforms,
  createMaskedPrismLineArtMaterial,
  type MaskedPrismLineArtUniforms,
  createPrismSideRainbowMaterial,
  type PrismSideRainbowUniforms,
  createWorksPosterMaterial,
  type WorksPosterUniforms,
} from "@/components/alche-top-page/scene/alche-top-page-materials";
import { createBentCardGeometry, placeOnArc } from "@/components/alche-top-page/scene/bent-card-helpers";
import { assetPath } from "@/lib/site";

configureTextBuilder({ useWorker: false });

interface KvSceneSystemProps {
  sceneState: AlcheTopSceneState;
  reducedMotion: boolean;
  wallTexturePath: string;
  worksCardItems: readonly { title: string; imageSrc: string }[];
  cardDebugMode: AlcheWorksCardDebugMode;
  captureMode: boolean;
  worksWordHandoff: number;
  renderMode: "full" | "edge-overlay";
  pointerOverride?: { x: number; y: number } | null;
  pointerDebugRef?: { current: AlchePointerDebugState };
  layerDebugRef?: { current: AlcheLayerDebugState };
}

/** Written by WorksCardPair each frame, read by the LED wall: which poster
 * leads (and which one it is handing off to) so the wall can echo it. */
interface WallMediaState {
  from: number;
  to: number;
  blend: number;
  strength: number;
}

interface CurvedMediaWallProps {
  sceneState: AlcheTopSceneState;
  wallTexturePath: string;
  worksCardItems: KvSceneSystemProps["worksCardItems"];
  wallMediaRef: { current: WallMediaState };
  layerDebugRef?: { current: AlcheLayerDebugState };
  animateContent: boolean;
}

/** Faint giant wordmark tiled across the kv LED wall (alpha mask). */
function createWallWordmarkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "800 250px 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("MOONFLOW", canvas.width / 2, canvas.height / 2 + 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface WorksCardPose {
  angle: number;
  radiusOffset: number;
  yOffset: number;
  scale: number;
}

interface CenterHeroRenderState {
  shadedScene: THREE.Group;
  edgeScene: THREE.Group;
  maskedLineArtScene: THREE.Group;
  rainbowScene: THREE.Group;
  modelScale: number;
  iceTexture: THREE.Texture;
  shadedMaterials: THREE.MeshStandardMaterial[];
  hiddenMaterial: THREE.MeshBasicMaterial;
  edgeMaterial: LineMaterial;
  maskedLineArtMaterial: THREE.ShaderMaterial;
  rainbowMaterial: THREE.ShaderMaterial;
  shadedGeometries: Set<THREE.BufferGeometry>;
  edgeGeometries: THREE.BufferGeometry[];
  prismIceUniforms: PrismIceUniforms;
  sceneTextureFallback: THREE.DataTexture;
  maskedLineArtUniforms: MaskedPrismLineArtUniforms;
  rainbowUniforms: PrismSideRainbowUniforms;
}

const ALCHE_TOP_PRISM_ICE_OPACITY = 0.62;
// Reference kv crystal has no wireframe; edges come from the bevel shading.
const ALCHE_TOP_PRISM_CRYSTAL_EDGE_OPACITY = 0;
const ALCHE_TOP_PRISM_CRYSTAL_EDGE_COLOR = "#e8fbff";
// Reference mission line-art (滚动stage6 / video 15.0s): crisp white strokes
// on the light paper, no hatch fill.
const ALCHE_TOP_PRISM_EDGE_OVERLAY_COLOR = "#ffffff";
const ALCHE_TOP_PRISM_EDGE_OVERLAY_WIDTH_PX = 2.6;
const ALCHE_TOP_PRISM_CRYSTAL_EDGE_WIDTH_PX = 1.2;

/**
 * Logo line-art for the mission overlay, in the GLB's model space (outer
 * apex (0, 1.386), base y -0.693, half-width 1.2; inner triangle at 43%;
 * faces at z = +-0.5). Adds the brand-mark base notch the plain GLB frame
 * lacks: the base steps up 3.5% of the height across ~19-81% of its width
 * (measured on 滚动stage6). Returns flat segment pairs for LineSegmentsGeometry.
 */
/** Logo outline in GLB model space: outer path (with the brand-mark base
 * notch) and inner triangle. Shared by the mission line-art and the kv body. */
function getPrismLogoOutline() {
  const apexY = 1.386;
  const baseY = -0.693;
  const halfWidth = 1.2;
  const notchRise = 0.073;
  const notchHalfSpan = 0.74;
  const notchEase = 0.07;
  const inner = [
    [0, 0.596],
    [-0.516, -0.298],
    [0.516, -0.298],
  ];

  // Smooth S-step between (x0, y0) and (x1, y1) (cubic ease, 6 samples).
  const step = (x0: number, y0: number, x1: number, y1: number) => {
    const points: number[][] = [];
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      const eased = t * t * (3 - 2 * t);
      points.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * eased]);
    }
    return points;
  };

  const outerPath: number[][] = [
    [-halfWidth, baseY],
    ...step(-notchHalfSpan - notchEase, baseY, -notchHalfSpan + notchEase * 0.4, baseY + notchRise),
    ...step(notchHalfSpan - notchEase * 0.4, baseY + notchRise, notchHalfSpan + notchEase, baseY),
    [halfWidth, baseY],
    [0, apexY],
    [-halfWidth, baseY],
  ];

  return { outerPath, inner, apexY, baseY, halfWidth };
}

/**
 * Bevelled crystal body for the kv render (the GLB is a 12-vertex flat
 * extrusion). The screen-space transmission shader bends the background by
 * the surface normal, so the bevel band is where displacement, dispersion
 * and specular highlights happen. Same model space and silhouette as the GLB
 * (negative bevel offset keeps the outline), so scale/centring are shared.
 */
function createPrismCrystalBodyGeometry() {
  const { outerPath, inner } = getPrismLogoOutline();
  const shape = new THREE.Shape(outerPath.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
  const depth = 0.66;
  const bevelThickness = 0.11;
  const bevelSize = 0.07;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelOffset: -bevelSize,
    bevelSegments: 6,
  });
  geometry.translate(0, 0, -depth * 0.5);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPrismLogoLineArtPositions() {
  const { outerPath, inner, apexY, baseY, halfWidth } = getPrismLogoOutline();
  const positions: number[] = [];
  const pushPath = (path: number[][], z: number, closed: boolean) => {
    const count = closed ? path.length : path.length - 1;
    for (let i = 0; i < count; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      positions.push(a[0], a[1], z, b[0], b[1], z);
    }
  };

  for (const z of [0.5, -0.5]) {
    pushPath(outerPath, z, false);
    pushPath(inner, z, true);
  }
  // Depth edges at the outer and inner corners.
  for (const [x, y] of [[0, apexY], [-halfWidth, baseY], [halfWidth, baseY], ...inner]) {
    positions.push(x, y, 0.5, x, y, -0.5);
  }
  return positions;
}
// Clear-glass crystal shows the scene behind it almost 1:1, so the capture
// needs enough resolution to stay crisp (512 read visibly blurry).
const ALCHE_TOP_PRISM_REFRACTION_IDLE_TARGET_MAX = 1024;
const ALCHE_TOP_PRISM_REFRACTION_ACTIVE_TARGET_MAX = 512;
const ALCHE_TOP_PRISM_REFRACTION_ACTIVE_INTERVAL = 1 / 30;
const ALCHE_TOP_PRISM_REFRACTION_IDLE_INTERVAL = 0.5;
const ALCHE_TOP_PRISM_REFRACTION_ACTIVE_HOLD = 0.18;
// works_outro glass A: stronger refraction + colour dispersion (reference read)
const ALCHE_TOP_PRISM_READABLE_REFRACTION_STRENGTH = 0.14;
const ALCHE_TOP_PRISM_READABLE_LENS_WARP_STRENGTH = 1.32;
const ALCHE_TOP_PRISM_READABLE_CHROMATIC_STRENGTH = 0.0145;
const ALCHE_TOP_PRISM_EMISSIVE_TARGET = 0.16;

const cardForwardAxis = new THREE.Vector3(0, 0, 1);

function configureCardTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
}

function createIdentityCardTexture(label: string, background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create card debug canvas context.");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.68)";
  context.lineWidth = 14;
  context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '700 420px "IBM Plex Mono", "Arial Black", sans-serif';
  context.fillText(label, canvas.width * 0.5, canvas.height * 0.54);

  const texture = new THREE.CanvasTexture(canvas);
  configureCardTexture(texture);
  return texture;
}

function createIcePrismTexture() {
  const data = new Uint8Array([250, 253, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function measureObjectScreenBounds(
  object: THREE.Object3D,
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number,
  box: THREE.Box3,
  points: THREE.Vector3[],
  projected: THREE.Vector3,
  target: ScreenBounds,
) {
  box.setFromObject(object);
  if (box.isEmpty()) {
    target.left = Number.NaN;
    target.right = Number.NaN;
    target.top = Number.NaN;
    target.bottom = Number.NaN;
    return target;
  }

  const min = box.min;
  const max = box.max;
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z],
  ] as const;

  let minScreenX = Number.POSITIVE_INFINITY;
  let maxScreenX = Number.NEGATIVE_INFINITY;
  let minScreenY = Number.POSITIVE_INFINITY;
  let maxScreenY = Number.NEGATIVE_INFINITY;

  corners.forEach(([x, y, z], index) => {
    points[index].set(x, y, z);
    projected.copy(points[index]).project(camera);
    const screenX = ((projected.x + 1) * 0.5) * viewportWidth;
    const screenY = ((1 - projected.y) * 0.5) * viewportHeight;
    minScreenX = Math.min(minScreenX, screenX);
    maxScreenX = Math.max(maxScreenX, screenX);
    minScreenY = Math.min(minScreenY, screenY);
    maxScreenY = Math.max(maxScreenY, screenY);
  });

  target.left = THREE.MathUtils.clamp(minScreenX, 0, viewportWidth);
  target.right = THREE.MathUtils.clamp(maxScreenX, 0, viewportWidth);
  target.top = THREE.MathUtils.clamp(minScreenY, 0, viewportHeight);
  target.bottom = THREE.MathUtils.clamp(maxScreenY, 0, viewportHeight);
  return target;
}

function lerpWorksCardPose(from: WorksCardPose, to: WorksCardPose, mix: number): WorksCardPose {
  return {
    angle: THREE.MathUtils.lerp(from.angle, to.angle, mix),
    radiusOffset: THREE.MathUtils.lerp(from.radiusOffset, to.radiusOffset, mix),
    yOffset: THREE.MathUtils.lerp(from.yOffset, to.yOffset, mix),
    scale: THREE.MathUtils.lerp(from.scale, to.scale, mix),
  };
}

interface WorksCardTrackTiming {
  queueStart: number;
  queueEnd: number;
  leadEnd: number;
  supportStart: number | null;
  supportEnd: number | null;
}

interface ResolveWorksCardTrackPoseOptions {
  progress: number;
  timing: WorksCardTrackTiming;
  queueOffscreenPose: WorksCardPose;
  queuePose: WorksCardPose;
  leadPose: WorksCardPose;
  supportPose: WorksCardPose;
}

function normalizeTrackWindow(progress: number, start: number, end: number) {
  return smoothstep(clamp01((progress - start) / Math.max(end - start, 0.0001)));
}

function resolveWorksCardTrackPose({
  progress,
  timing,
  queueOffscreenPose,
  queuePose,
  leadPose,
  supportPose,
}: ResolveWorksCardTrackPoseOptions): WorksCardPose {
  if (progress <= timing.queueEnd) {
    return lerpWorksCardPose(queueOffscreenPose, queuePose, normalizeTrackWindow(progress, timing.queueStart, timing.queueEnd));
  }

  if (progress <= timing.leadEnd) {
    return lerpWorksCardPose(queuePose, leadPose, normalizeTrackWindow(progress, timing.queueEnd, timing.leadEnd));
  }

  if (timing.supportStart !== null && timing.supportEnd !== null && progress >= timing.supportStart) {
    return lerpWorksCardPose(leadPose, supportPose, normalizeTrackWindow(progress, timing.supportStart, timing.supportEnd));
  }

  return leadPose;
}

function isWorksCardTrackVisible(progress: number, timing: WorksCardTrackTiming) {
  const queueMix = normalizeTrackWindow(progress, timing.queueStart, timing.queueEnd);
  return progress > timing.queueStart && queueMix >= 0.18;
}

const ALCHE_TOP_WALL_PARAMETRIC_WIDTH_RATIO = 2.25;
const ALCHE_TOP_WALL_PARAMETRIC_HEIGHT_RATIO = 1.04;

function createParametricWallGeometry() {
  const widthSegments = ALCHE_TOP_MEDIA_WALL.radialSegments * 2;
  const heightSegments = ALCHE_TOP_MEDIA_WALL.heightSegments * 2;

  const positions: number[] = [];
  const wallU: number[] = [];
  const wallV: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= heightSegments; row += 1) {
    const v = row / Math.max(heightSegments, 1) * 2 - 1;

    for (let column = 0; column <= widthSegments; column += 1) {
      const u = column / Math.max(widthSegments, 1) * 2 - 1;
      positions.push(u, v, 0);
      wallU.push(u);
      wallV.push(v);
    }
  }

  const rowStride = widthSegments + 1;
  for (let row = 0; row < heightSegments; row += 1) {
    for (let column = 0; column < widthSegments; column += 1) {
      const a = row * rowStride + column;
      const b = row * rowStride + column + 1;
      const c = (row + 1) * rowStride + column + 1;
      const d = (row + 1) * rowStride + column;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aWallU", new THREE.Float32BufferAttribute(wallU, 1));
  geometry.setAttribute("aWallV", new THREE.Float32BufferAttribute(wallV, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function CurvedMediaWall({
  sceneState,
  wallTexturePath,
  worksCardItems,
  wallMediaRef,
  layerDebugRef,
  animateContent,
}: CurvedMediaWallProps) {
  const roomRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const wallTexture = useLoader(THREE.TextureLoader, wallTexturePath);
  // Same URLs as WorksCardPair, so useLoader returns the cached textures.
  const posterPaths = useMemo(() => worksCardItems.map((item) => assetPath(item.imageSrc)), [worksCardItems]);
  const posterTextures = useLoader(THREE.TextureLoader, posterPaths);
  const material = useMemo(() => createCurvedGridMaterial(wallTexture), [wallTexture]);
  const wordmarkTexture = useMemo(() => createWallWordmarkTexture(), []);
  useEffect(() => {
    material.uniforms.uLogoTex.value = wordmarkTexture;
    return () => wordmarkTexture.dispose();
  }, [material, wordmarkTexture]);
  const effectiveRadius = ALCHE_TOP_MEDIA_WALL.radius / ALCHE_TOP_KV_WALL_ARC_STRENGTH;
  const geometry = useMemo(() => createParametricWallGeometry(), []);

  useEffect(() => {
    wallTexture.colorSpace = THREE.SRGBColorSpace;
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.minFilter = THREE.LinearFilter;
    wallTexture.magFilter = THREE.LinearFilter;
    wallTexture.generateMipmaps = false;
    wallTexture.repeat.set(
      ALCHE_TOP_MEDIA_WALL.cellColumns * ALCHE_TOP_WALL_TILE_DENSITY,
      ALCHE_TOP_MEDIA_WALL.cellRows * ALCHE_TOP_WALL_TILE_DENSITY,
    );
    wallTexture.needsUpdate = true;
  }, [wallTexture]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    if (!roomRef.current) return;

    const wallVisible = sceneState.kv.wallVisibility * sceneState.kv.visible;

    roomRef.current.rotation.y = THREE.MathUtils.damp(roomRef.current.rotation.y, 0, 2.4, delta);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uIntro.value = sceneState.introProgress;
    material.uniforms.uGlow.value = THREE.MathUtils.damp(material.uniforms.uGlow.value, sceneState.kv.wallGlow, 3.4, delta);
    material.uniforms.uExposure.value = THREE.MathUtils.damp(material.uniforms.uExposure.value, sceneState.kv.wallExposure, 3.4, delta);
    material.uniforms.uWhiteMix.value = THREE.MathUtils.damp(material.uniforms.uWhiteMix.value, sceneState.kv.wallWhiteMix, 3.4, delta);
    material.uniforms.uFlatten.value = THREE.MathUtils.damp(material.uniforms.uFlatten.value, sceneState.kv.wallFlatten, 3.2, delta);
    material.uniforms.uZebra.value = THREE.MathUtils.damp(material.uniforms.uZebra.value, sceneState.kv.wallZebra, 3.6, delta);
    // Palette rotation only when motion is welcome (static violet otherwise,
    // and in captures so pinned shots are deterministic).
    material.uniforms.uThemeCycle.value = animateContent ? 1 : 0;
    const wallMedia = wallMediaRef.current;
    const posterFrom = posterTextures[Math.min(wallMedia.from, posterTextures.length - 1)];
    const posterTo = posterTextures[Math.min(wallMedia.to, posterTextures.length - 1)];
    if (posterFrom) material.uniforms.uPosterA.value = posterFrom;
    if (posterTo) material.uniforms.uPosterB.value = posterTo;
    material.uniforms.uPosterBlend.value = wallMedia.blend;
    material.uniforms.uPosterMix.value = THREE.MathUtils.damp(material.uniforms.uPosterMix.value, wallMedia.strength, 3, delta);
    material.uniforms.uSceneFade.value = THREE.MathUtils.damp(material.uniforms.uSceneFade.value, wallVisible, 3.2, delta);
    material.uniforms.uWallRadius.value = effectiveRadius;
    material.uniforms.uWallHalfWidth.value = effectiveRadius * ALCHE_TOP_WALL_PARAMETRIC_WIDTH_RATIO;
    material.uniforms.uWallHalfHeight.value = ALCHE_TOP_MEDIA_WALL.height * 0.5 * ALCHE_TOP_WALL_PARAMETRIC_HEIGHT_RATIO;
    material.uniforms.uViewportPx.value.set(state.size.width, state.size.height);
    if (layerDebugRef) {
      const worldPosition = roomRef.current.getWorldPosition(new THREE.Vector3());
      layerDebugRef.current.wallWorldZ = worldPosition.z;
      layerDebugRef.current.wallRotationY = roomRef.current.rotation.y;
    }
  });

  return (
    <mesh ref={roomRef} geometry={geometry} position={[0, 0, ALCHE_TOP_MEDIA_WALL.worldZ]} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// HDR white: the final composite multiplies the screen centre by ~0.41 (see
// handoff: inverted vignette), so the wordmark is emitted at ~2.35x to land
// pure white there without relying on bloom (which caused the halo).
const TITLE_COLOR = new THREE.Color(2.35, 2.35, 2.4);
const TITLE_DIM_COLOR = TITLE_COLOR.clone().multiplyScalar(0.36);

function MoonflowTitle({ sceneState, worksWordHandoff, layerDebugRef }: KvSceneSystemProps) {
  const { camera, size } = useThree();
  const textRef = useRef<Text>(null);
  const effectiveRadius = ALCHE_TOP_MEDIA_WALL.radius / ALCHE_TOP_KV_WALL_ARC_STRENGTH;
  const fontPath = useMemo(() => assetPath(ALCHE_TOP_MOONFLOW.fontPath), []);
  const targetPosition = useMemo(
    () => new THREE.Vector3(0, ALCHE_TOP_MOONFLOW.y, -effectiveRadius * ALCHE_TOP_MOONFLOW.depthMix + ALCHE_TOP_MOONFLOW.zOffset),
    [effectiveRadius],
  );
  const measuredWidthRef = useRef(1);
  const titleColorRef = useRef(TITLE_COLOR.clone());
  const textReadyRef = useRef(false);
  const text = useMemo(() => new Text(), []);

  useEffect(() => {
    textReadyRef.current = false;
    text.text = "MOONFLOW";
    text.font = fontPath;
    text.fontSize = ALCHE_TOP_MOONFLOW.baseFontSize;
    text.anchorX = "center";
    text.anchorY = "middle";
    text.textAlign = "center";
    text.whiteSpace = "nowrap";
    text.letterSpacing = ALCHE_TOP_MOONFLOW.letterSpacing;
    text.color = TITLE_COLOR.clone();
    text.fillOpacity = 0;
    // Only the 500 weight ships; a same-colour SDF outline thickens the
    // strokes toward the reference's heavy geometric wordmark.
    text.outlineWidth = ALCHE_TOP_MOONFLOW.strokeBoldWidth;
    text.outlineColor = TITLE_COLOR.clone();
    text.outlineOpacity = 0;
    text.outlineBlur = 0;
    (text.material as THREE.Material & { toneMapped?: boolean }).toneMapped = false;
    text.renderOrder = 1;
    text.position.set(0, ALCHE_TOP_MOONFLOW.y, targetPosition.z);
    const isLocalValidation =
      window.location.hostname === "127.0.0.1" &&
      !window.location.search.includes("alcheCapture=1");
    const syncDelay = isLocalValidation ? 6000 : 0;
    const syncHandle = window.setTimeout(() => {
      text.sync(() => {
        const bounds = text.textRenderInfo?.blockBounds;
        measuredWidthRef.current = bounds ? Math.max(bounds[2] - bounds[0], 0.0001) : 1;
        textReadyRef.current = true;
      });
    }, syncDelay);

    return () => {
      window.clearTimeout(syncHandle);
      text.dispose();
    };
  }, [fontPath, targetPosition.z, text]);

  useFrame((state, delta) => {
    if (!textRef.current) return;

    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const handoff = sceneState.activeSection === "loading" ? 0 : worksWordHandoff;
    const baseVisibility = sceneState.kv.visible * (sceneState.activeSection === "loading" || sceneState.activeSection === "kv" ? sceneState.kv.wordVisibility : 1);
    const handoffFade = 1 - smoothstep(remapRange(handoff, 0.18, 0.36));
    const visibility = baseVisibility * handoffFade;
    // Reference 6.5-7.0s: the wordmark greys out while the crystal turns,
    // before it fades behind the works wall.
    const dimMix = smoothstep(remapRange(handoff, 0.03, 0.16));
    titleColorRef.current.copy(TITLE_COLOR).lerp(TITLE_DIM_COLOR, dimMix);
    textRef.current.color = titleColorRef.current;
    textRef.current.outlineColor = textRef.current.color;
    const distance = perspectiveCamera.position.distanceTo(targetPosition);
    const viewportHeight = 2 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov * 0.5)) * distance;
    const viewportWidth = viewportHeight * (size.width / Math.max(size.height, 1));
    const targetScale = (viewportWidth * ALCHE_TOP_MOONFLOW.widthRatio) / measuredWidthRef.current;
    const ready = textReadyRef.current;
    textRef.current.visible = ready;
    textRef.current.frustumCulled = false;
    if (!ready) {
      textRef.current.fillOpacity = 0;
      textRef.current.outlineOpacity = 0;
      return;
    }

    textRef.current.position.x = THREE.MathUtils.damp(textRef.current.position.x, targetPosition.x, 3.6, delta);
    textRef.current.position.y = THREE.MathUtils.damp(textRef.current.position.y, targetPosition.y, 3.6, delta);
    textRef.current.position.z = THREE.MathUtils.damp(textRef.current.position.z, targetPosition.z, 3.6, delta);
    textRef.current.rotation.set(0, 0, 0);
    textRef.current.scale.setScalar(THREE.MathUtils.damp(textRef.current.scale.x, targetScale, 3.8, delta));
    textRef.current.fillOpacity = THREE.MathUtils.damp(textRef.current.fillOpacity ?? 0, visibility * 0.98, 4.2, delta);
    textRef.current.outlineOpacity = textRef.current.fillOpacity;
    if (layerDebugRef) {
      const worldPosition = textRef.current.getWorldPosition(new THREE.Vector3());
      layerDebugRef.current.worksHandoff = handoff;
      layerDebugRef.current.moonflowWorldZ = worldPosition.z;
      layerDebugRef.current.moonflowOpacity = textRef.current.fillOpacity ?? 0;
    }
  });

  return <primitive ref={textRef} object={text} visible={false} />;
}

function WallWordSweep({ sceneState, worksWordHandoff, layerDebugRef }: KvSceneSystemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<Text>(null);
  const effectiveRadius = ALCHE_TOP_MEDIA_WALL.radius / ALCHE_TOP_KV_WALL_ARC_STRENGTH;
  const radius = effectiveRadius - ALCHE_TOP_WALL_WORD.wallInset;
  const localDepth = ALCHE_TOP_WALL_WORD.worldZ - ALCHE_TOP_MEDIA_WALL.worldZ + ALCHE_TOP_WALL_WORD.surfaceOffset;
  const fontPath = useMemo(() => assetPath(ALCHE_TOP_WALL_WORD.fontPath), []);
  const textReadyRef = useRef(false);
  const text = useMemo(() => new Text(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xf6f8ff,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    const curvedText = text as Text & { curveRadius?: number; depthOffset?: number };
    textReadyRef.current = false;
    text.text = ALCHE_TOP_WALL_WORD.text;
    text.font = fontPath;
    text.fontSize = ALCHE_TOP_WALL_WORD.fontSize;
    text.anchorX = "center";
    text.anchorY = "middle";
    text.textAlign = "center";
    text.whiteSpace = "nowrap";
    text.color = 0xf6f8ff;
    text.fillOpacity = 1;
    curvedText.curveRadius = radius;
    curvedText.depthOffset = ALCHE_TOP_WALL_WORD.polygonDepthOffset;
    text.material = material;
    text.frustumCulled = false;
    text.position.set(0, ALCHE_TOP_WALL_WORD.y, localDepth);
    text.sync(() => {
      textReadyRef.current = true;
    });

    return () => {
      textReadyRef.current = false;
      text.dispose();
      material.dispose();
    };
  }, [fontPath, localDepth, material, radius, text]);

  useFrame((state, delta) => {
    if (!groupRef.current || !textRef.current) return;

    const ready = textReadyRef.current;
    groupRef.current.visible = ready;
    textRef.current.visible = ready;
    if (!ready) {
      material.opacity = 0;
      return;
    }

    const handoff = worksWordHandoff;
    const enterMix = smoothstep(remapRange(handoff, ALCHE_TOP_WALL_WORD.enterStart, ALCHE_TOP_WALL_WORD.enterEnd));
    const fadeMix = smoothstep(remapRange(handoff, ALCHE_TOP_WALL_WORD.holdEnd, ALCHE_TOP_WALL_WORD.fadeEnd));
    // Reference keeps the giant word on the wall as a dim ghost behind the
    // flying cards; it re-centers and fades back in during works_cards only.
    const ghostActive = sceneState.activeSection === "works_cards";
    const targetX = ghostActive
      ? ALCHE_TOP_WALL_WORD.centerX
      : handoff <= ALCHE_TOP_WALL_WORD.enterEnd
        ? THREE.MathUtils.lerp(ALCHE_TOP_WALL_WORD.enterX, ALCHE_TOP_WALL_WORD.centerX, enterMix)
        : handoff <= ALCHE_TOP_WALL_WORD.holdEnd
          ? ALCHE_TOP_WALL_WORD.centerX
          : THREE.MathUtils.lerp(ALCHE_TOP_WALL_WORD.centerX, ALCHE_TOP_WALL_WORD.exitX, fadeMix);
    const opacityTarget = ghostActive
      ? ALCHE_TOP_WALL_WORD.ghostOpacity
      : handoff < ALCHE_TOP_WALL_WORD.enterStart
        ? 0
        : handoff <= ALCHE_TOP_WALL_WORD.enterEnd
          ? enterMix
          : handoff <= ALCHE_TOP_WALL_WORD.holdEnd
            ? 1
            : 1 - fadeMix;

    textRef.current.position.x = ghostActive
      ? targetX
      : THREE.MathUtils.damp(textRef.current.position.x, targetX, 4.4, delta);
    textRef.current.rotation.set(0, 0, 0);
    material.opacity = THREE.MathUtils.damp(material.opacity, opacityTarget * ALCHE_TOP_WALL_WORD.fillOpacity, 5, delta);
    if (layerDebugRef) {
      const worldPosition = textRef.current.getWorldPosition(new THREE.Vector3());
      layerDebugRef.current.worksWorldX = worldPosition.x;
      layerDebugRef.current.worksWorldZ = worldPosition.z;
      layerDebugRef.current.worksRotationY = textRef.current.rotation.y;
      layerDebugRef.current.worksHandoff = handoff;
      layerDebugRef.current.worksOpacity = material.opacity;
      layerDebugRef.current.worksDepthTest = material.depthTest;
      layerDebugRef.current.worksDepthWrite = material.depthWrite;
      layerDebugRef.current.worksTransparent = material.transparent;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, ALCHE_TOP_MEDIA_WALL.worldZ]} visible={false}>
      <primitive ref={textRef} object={text} visible={false} />
    </group>
  );
}

function WorksCardPair({
  sceneState,
  worksCardItems,
  cardDebugMode,
  reducedMotion,
  worksWordHandoff,
  layerDebugRef,
  wallMediaRef,
}: Pick<KvSceneSystemProps, "sceneState" | "worksCardItems" | "cardDebugMode" | "reducedMotion" | "worksWordHandoff" | "layerDebugRef"> & {
  wallMediaRef: { current: WallMediaState };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cardRefs = useRef<(THREE.Mesh | null)[]>([]);
  const texturePaths = useMemo(() => worksCardItems.map((item) => assetPath(item.imageSrc)), [worksCardItems]);
  const posterTextures = useLoader(THREE.TextureLoader, texturePaths);
  const identityTextures = useMemo(
    () => worksCardItems.map((_, index) => createIdentityCardTexture(String.fromCharCode(65 + (index % 26)), "#242934")),
    [worksCardItems],
  );
  const card0WorldRef = useRef(new THREE.Vector3());
  const card1WorldRef = useRef(new THREE.Vector3());
  const card0ScreenBoundsRef = useRef<ScreenBounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const card1ScreenBoundsRef = useRef<ScreenBounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const leadWorldRef = useRef(new THREE.Vector3());
  const supportWorldRef = useRef(new THREE.Vector3());
  const projectedRef = useRef(new THREE.Vector3());
  const card0BoxRef = useRef(new THREE.Box3());
  const card1BoxRef = useRef(new THREE.Box3());
  const card0PointsRef = useRef(Array.from({ length: 8 }, () => new THREE.Vector3()));
  const card1PointsRef = useRef(Array.from({ length: 8 }, () => new THREE.Vector3()));
  const card0FacingTargetRef = useRef(new THREE.Vector3());
  const card1FacingTargetRef = useRef(new THREE.Vector3());
  const card0ForwardRef = useRef(new THREE.Vector3());
  const card1ForwardRef = useRef(new THREE.Vector3());
  const pinnedShotMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("alcheShot");
  const geometry = useMemo(
    () =>
      createBentCardGeometry({
        width: ALCHE_TOP_WORKS_CARDS.width,
        height: ALCHE_TOP_WORKS_CARDS.height,
        radius: ALCHE_TOP_WORKS_CARDS.bendRadius,
        segments: ALCHE_TOP_WORKS_CARDS.segments,
      }),
    [],
  );
  const posterUniforms = useMemo<WorksPosterUniforms>(() => ({ uTime: { value: 0 }, uSheen: { value: 1 } }), []);
  const posterMaterials = useMemo(
    () => posterTextures.map((texture) => createWorksPosterMaterial(texture, posterUniforms)),
    [posterTextures, posterUniforms],
  );
  const identityMaterials = useMemo(
    () =>
      identityTextures.map(
        (texture) =>
          new THREE.MeshBasicMaterial({
            map: texture,
            color: "#ffffff",
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            toneMapped: false,
          }),
      ),
    [identityTextures],
  );
  const materials = cardDebugMode === "identity" ? identityMaterials : posterMaterials;

  useEffect(() => {
    posterTextures.forEach((texture) => {
      configureCardTexture(texture);
    });
  }, [posterTextures]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      posterMaterials.forEach((material) => material.dispose());
      identityMaterials.forEach((material) => material.dispose());
      identityTextures.forEach((texture) => texture.dispose());
    };
  }, [geometry, identityMaterials, identityTextures, posterMaterials]);

  useFrame((state, delta) => {
    if (!groupRef.current || materials.length < 2) return;
    posterUniforms.uTime.value = state.clock.elapsedTime;
    const meshes = materials.map((_, index) => cardRefs.current[index]);
    if (meshes.some((mesh) => !mesh)) return;

    const cardCount = materials.length;
    const lastIndex = cardCount - 1;
    const inWorksCards = sceneState.activeSection === "works_cards";
    const inWorksOutro = sceneState.activeSection === "works_outro";
    const outroMix = inWorksOutro ? smoothstep(clamp01(sceneState.worksOutro.clearMix)) : sceneState.activeSection === "mission_in" ? 1 : 0;
    const cardsVisible = worksWordHandoff >= 0.985 && (inWorksCards || inWorksOutro) && outroMix < 0.999;
    const progress = sceneState.worksCardsProgress;
    const cycle0Progress = Math.min(progress, 1);
    const segment = getAlcheWorksCardsSegment(cycle0Progress);
    const handoffMix = smoothstep(clamp01(segment.phase === "handoff" ? segment.mix : segment.phase === "settled" ? 1 : 0));
    const cardsSequenceVisible = cardsVisible && inWorksCards;
    const maxCycleIndex = Math.max(0, Math.min(ALCHE_TOP_WORKS_CARDS.cyclesTotal - 1, cardCount - 2));
    const cycleIndex = Math.max(0, Math.min(Math.floor(progress), maxCycleIndex));
    const cycleU = clamp01(progress - cycleIndex);
    const extraQueueEnd = ALCHE_TOP_WORKS_CARDS.extraCycleQueueEnd;
    const extraLeadEnd = ALCHE_TOP_WORKS_CARDS.extraCycleLeadEnd;
    const extraHandoffMix = smoothstep(clamp01((cycleU - extraQueueEnd) / Math.max(extraLeadEnd - extraQueueEnd, 0.0001)));
    // Per-viewport: narrow screens scale the whole carousel (see shotbook).
    const leadCenterPose = getCompensatedAlcheWorksCardPoseDefinition("lead-center", state.size.width, state.size.height);
    const compensatedQueueRightLowerOffscreenPose = getCompensatedAlcheWorksCardPoseDefinition(
      "queue-right-lower-offscreen",
      state.size.width,
      state.size.height,
    );
    const compensatedQueueRightLowerPose = getCompensatedAlcheWorksCardPoseDefinition(
      "queue-right-lower",
      state.size.width,
      state.size.height,
    );
    const compensatedSupportLeftUpperPose = getCompensatedAlcheWorksCardPoseDefinition(
      "support-left-upper",
      state.size.width,
      state.size.height,
    );
    const compensatedExitLeftOffscreenPose = getCompensatedAlcheWorksCardPoseDefinition(
      "exit-left-offscreen",
      state.size.width,
      state.size.height,
    );
    const compensatedWorksOutroLeftClearPose = {
      ...compensatedSupportLeftUpperPose,
      angle: compensatedSupportLeftUpperPose.angle - 0.18,
      radiusOffset: compensatedSupportLeftUpperPose.radiusOffset + 0.18,
      yOffset: compensatedSupportLeftUpperPose.yOffset + 0.04,
    };
    const card0Timing: WorksCardTrackTiming = {
      queueStart: 0,
      queueEnd: segment.entryShot.progress,
      leadEnd: segment.centerShot.progress,
      supportStart: segment.queueShot.progress,
      supportEnd: segment.settledShot.progress,
    };
    const card1Timing: WorksCardTrackTiming = {
      queueStart: segment.centerShot.progress,
      queueEnd: segment.queueShot.progress,
      leadEnd: segment.settledShot.progress,
      supportStart: null,
      supportEnd: null,
    };

    // Reference pacing: the lead card HOLDS center while the next card slides
    // into the right-edge queue; the actual handoff is a fast crossover
    // (outgoing exits left while the incoming commits to center), so the lead
    // slot is never left empty.
    const extraQueueCommitMix = Math.pow(extraHandoffMix, 1.35);
    const resolveExtraLeadPose = (u: number): WorksCardPose => {
      if (u <= extraQueueEnd) return leadCenterPose;
      if (extraHandoffMix <= 0.6) {
        return lerpWorksCardPose(leadCenterPose, compensatedSupportLeftUpperPose, smoothstep(clamp01(extraHandoffMix / 0.6)));
      }
      return lerpWorksCardPose(
        compensatedSupportLeftUpperPose,
        compensatedExitLeftOffscreenPose,
        smoothstep(clamp01((extraHandoffMix - 0.6) / 0.4)),
      );
    };
    const extraQueueInEnd = 0.3;
    const resolveExtraQueuePose = (u: number): WorksCardPose => {
      if (u <= extraQueueInEnd) {
        return lerpWorksCardPose(
          compensatedQueueRightLowerOffscreenPose,
          compensatedQueueRightLowerPose,
          smoothstep(clamp01(u / Math.max(extraQueueInEnd, 0.0001))),
        );
      }
      if (u <= extraQueueEnd) return compensatedQueueRightLowerPose;
      if (u <= extraLeadEnd) {
        return lerpWorksCardPose(compensatedQueueRightLowerPose, leadCenterPose, extraQueueCommitMix);
      }
      return leadCenterPose;
    };
    // Softer facing for the edge-hugging incoming card; eases out as it lands.
    const extraQueueYawOffset = -0.16 * (1 - extraQueueCommitMix);

    const poses: WorksCardPose[] = [];
    const visibles: boolean[] = [];
    const yawOffsets: number[] = [];
    for (let index = 0; index < cardCount; index += 1) {
      yawOffsets.push(index === cycleIndex + 1 && cycleIndex > 0 && !inWorksOutro ? extraQueueYawOffset : 0);
      if (inWorksOutro) {
        if (index === lastIndex) {
          poses.push(lerpWorksCardPose(leadCenterPose, compensatedWorksOutroLeftClearPose, outroMix));
          visibles.push(cardsVisible && outroMix < 0.985);
        } else {
          poses.push(compensatedExitLeftOffscreenPose);
          visibles.push(cardsVisible);
        }
        continue;
      }

      if (cycleIndex === 0 && index === 0) {
        poses.push(
          resolveWorksCardTrackPose({
            progress: cycle0Progress,
            timing: card0Timing,
            queueOffscreenPose: compensatedQueueRightLowerOffscreenPose,
            queuePose: compensatedQueueRightLowerPose,
            leadPose: leadCenterPose,
            supportPose: compensatedExitLeftOffscreenPose,
          }),
        );
        visibles.push(cardsSequenceVisible && isWorksCardTrackVisible(cycle0Progress, card0Timing));
        continue;
      }

      if (cycleIndex === 0 && index === 1) {
        poses.push(
          resolveWorksCardTrackPose({
            progress: cycle0Progress,
            timing: card1Timing,
            queueOffscreenPose: compensatedQueueRightLowerOffscreenPose,
            queuePose: compensatedQueueRightLowerPose,
            leadPose: leadCenterPose,
            supportPose: compensatedSupportLeftUpperPose,
          }),
        );
        visibles.push(cardsSequenceVisible && isWorksCardTrackVisible(cycle0Progress, card1Timing));
        continue;
      }

      if (index < cycleIndex) {
        poses.push(compensatedExitLeftOffscreenPose);
        visibles.push(false);
      } else if (index === cycleIndex) {
        poses.push(resolveExtraLeadPose(cycleU));
        visibles.push(cardsSequenceVisible);
      } else if (index === cycleIndex + 1) {
        poses.push(resolveExtraQueuePose(cycleU));
        visibles.push(cardsSequenceVisible && cycleU > 0.02);
      } else {
        poses.push(compensatedQueueRightLowerOffscreenPose);
        visibles.push(false);
      }
    }

    const realLeadIndex = !cardsVisible
      ? null
      : inWorksOutro
        ? lastIndex
        : cycleIndex === 0
          ? segment.phase === "entry" || segment.phase === "queue"
            ? 0
            : handoffMix >= 0.5
              ? 1
              : 0
          : extraHandoffMix >= 0.5
            ? Math.min(cycleIndex + 1, lastIndex)
            : cycleIndex;

    // LED wall echo of the lead poster (reference 9.5-11s): crossfades with
    // the same handoff that swaps the lead card.
    const wallMedia = wallMediaRef.current;
    if (inWorksOutro) {
      wallMedia.from = lastIndex;
      wallMedia.to = lastIndex;
      wallMedia.blend = 0;
    } else if (cycleIndex === 0) {
      wallMedia.from = 0;
      wallMedia.to = 1;
      wallMedia.blend = segment.phase === "entry" || segment.phase === "queue" ? 0 : handoffMix;
    } else {
      wallMedia.from = cycleIndex;
      wallMedia.to = Math.min(cycleIndex + 1, lastIndex);
      wallMedia.blend = extraHandoffMix;
    }
    wallMedia.strength = cardsVisible ? (inWorksOutro ? 1 - outroMix : 1) : 0;

    // Debug slots: slot 0 always mirrors mesh 0; slot 1 mirrors the card that
    // plays the legacy "B" role (last card during works_outro).
    const secondarySlotIndex = inWorksOutro ? lastIndex : cycleIndex === 0 ? 1 : Math.min(cycleIndex + 1, lastIndex);
    const card0Visible = inWorksOutro ? cardsVisible : visibles[0];
    const card1Visible = visibles[secondarySlotIndex];
    const leadIndex =
      realLeadIndex === null ? null : inWorksOutro ? 1 : realLeadIndex === secondarySlotIndex ? 1 : realLeadIndex === 0 ? 0 : 0;
    const supportIndex = !card1Visible || leadIndex === null ? null : leadIndex === 0 ? 1 : 0;
    const leftMesh = meshes[0] as THREE.Mesh;
    const rightMesh = meshes[secondarySlotIndex] as THREE.Mesh;

    groupRef.current.visible = cardsVisible && visibles.some(Boolean);
    if (!cardsVisible) {
      materials.forEach((material) => {
        material.opacity = THREE.MathUtils.damp(material.opacity, 0, 6.2, delta);
      });
      if (layerDebugRef) {
        layerDebugRef.current.cardsOpacity = 0;
        layerDebugRef.current.cardsLeadIndex = null;
        layerDebugRef.current.cardsLeadOpacity = null;
        layerDebugRef.current.cardsSupportOpacity = null;
        layerDebugRef.current.card0Opacity = null;
        layerDebugRef.current.card1Opacity = null;
        layerDebugRef.current.card0WorldX = null;
        layerDebugRef.current.card0WorldZ = null;
        layerDebugRef.current.card1WorldX = null;
        layerDebugRef.current.card1WorldZ = null;
        layerDebugRef.current.card0ArcAngle = null;
        layerDebugRef.current.card1ArcAngle = null;
        layerDebugRef.current.card0FacingError = null;
        layerDebugRef.current.card1FacingError = null;
        layerDebugRef.current.card0ScreenLeft = null;
        layerDebugRef.current.card0ScreenRight = null;
        layerDebugRef.current.card0ScreenTop = null;
        layerDebugRef.current.card0ScreenBottom = null;
        layerDebugRef.current.card1ScreenLeft = null;
        layerDebugRef.current.card1ScreenRight = null;
        layerDebugRef.current.card1ScreenTop = null;
        layerDebugRef.current.card1ScreenBottom = null;
        layerDebugRef.current.card0Visible = false;
        layerDebugRef.current.card1Visible = false;
        layerDebugRef.current.cardsLeadWorldX = null;
        layerDebugRef.current.cardsLeadWorldZ = null;
        layerDebugRef.current.cardsSupportWorldX = null;
        layerDebugRef.current.cardsSupportWorldZ = null;
      }
      return;
    }
    for (let index = 0; index < cardCount; index += 1) {
      const mesh = meshes[index] as THREE.Mesh;
      const pose = poses[index];
      const cardFloat =
        reducedMotion || pinnedShotMode || !visibles[index]
          ? 0
          : Math.sin(state.clock.elapsedTime * (0.48 - index * 0.05) + index * 1.4) * (0.012 - index * 0.001);
      const targetY = pose.yOffset + cardFloat;
      const radius = Math.max(0.001, ALCHE_TOP_WORKS_CARDS.baseRadius + pose.radiusOffset);

      placeOnArc(mesh, {
        angle: pose.angle,
        radius,
        centerX: ALCHE_TOP_WORKS_CARDS.arcCenterX,
        centerZ: ALCHE_TOP_WORKS_CARDS.arcCenterZ,
        y: pose.yOffset,
        yawOffset: yawOffsets[index],
      });
      mesh.position.y = pinnedShotMode ? targetY : THREE.MathUtils.damp(mesh.position.y, targetY, 4.2, delta);
      mesh.scale.setScalar(pinnedShotMode ? pose.scale : THREE.MathUtils.damp(mesh.scale.x, pose.scale, 4.2, delta));
      mesh.visible = visibles[index] || (inWorksOutro && cardsVisible);

      const targetOpacity = inWorksOutro
        ? index === lastIndex
          ? card1Visible
            ? 1 - outroMix
            : 0
          : cardsVisible
            ? 1 - outroMix * 0.72
            : 0
        : visibles[index]
          ? 1
          : 0;
      materials[index].opacity = targetOpacity;
    }

    if (layerDebugRef) {
      const secondaryMaterial = materials[secondarySlotIndex];
      leftMesh.getWorldPosition(card0WorldRef.current);
      measureObjectScreenBounds(
        leftMesh,
        state.camera,
        state.size.width,
        state.size.height,
        card0BoxRef.current,
        card0PointsRef.current,
        projectedRef.current,
        card0ScreenBoundsRef.current,
      );

      if (card1Visible) {
        rightMesh.getWorldPosition(card1WorldRef.current);
        measureObjectScreenBounds(
          rightMesh,
          state.camera,
          state.size.width,
          state.size.height,
          card1BoxRef.current,
          card1PointsRef.current,
          projectedRef.current,
          card1ScreenBoundsRef.current,
        );
      }

      if (leadIndex === 0) {
        leadWorldRef.current.copy(card0WorldRef.current);
      } else if (leadIndex === 1 && card1Visible) {
        leadWorldRef.current.copy(card1WorldRef.current);
      }

      if (supportIndex === 0) {
        supportWorldRef.current.copy(card0WorldRef.current);
      } else if (supportIndex === 1 && card1Visible) {
        supportWorldRef.current.copy(card1WorldRef.current);
      }

      // Any on-screen card counts: in extra queue cycles the lead card is
      // neither mesh 0 nor the legacy "B" slot, so the two-slot max read ~0
      // while a card sat centre-screen.
      layerDebugRef.current.cardsOpacity = materials.reduce(
        (maxOpacity, material, index) => (visibles[index] ? Math.max(maxOpacity, material.opacity) : maxOpacity),
        0,
      );
      layerDebugRef.current.cardsLeadIndex = leadIndex;
      layerDebugRef.current.cardsLeadOpacity =
        leadIndex === null ? null : (leadIndex === 0 ? materials[0] : secondaryMaterial)?.opacity ?? null;
      layerDebugRef.current.cardsSupportOpacity =
        supportIndex === null ? null : (supportIndex === 0 ? materials[0] : secondaryMaterial)?.opacity ?? null;
      layerDebugRef.current.card0Opacity = card0Visible ? materials[0]?.opacity ?? null : null;
      layerDebugRef.current.card1Opacity = card1Visible ? secondaryMaterial?.opacity ?? null : null;
      layerDebugRef.current.card0WorldX = card0WorldRef.current.x;
      layerDebugRef.current.card0WorldZ = card0WorldRef.current.z;
      layerDebugRef.current.card1WorldX = card1Visible ? card1WorldRef.current.x : null;
      layerDebugRef.current.card1WorldZ = card1Visible ? card1WorldRef.current.z : null;
      card0FacingTargetRef.current
        .set(
          leftMesh.position.x - ALCHE_TOP_WORKS_CARDS.arcCenterX,
          0,
          leftMesh.position.z - ALCHE_TOP_WORKS_CARDS.arcCenterZ,
        )
        .normalize();
      card0ForwardRef.current.copy(cardForwardAxis).applyQuaternion(leftMesh.quaternion).setY(0).normalize();
      layerDebugRef.current.card0ArcAngle = Math.atan2(
        leftMesh.position.x - ALCHE_TOP_WORKS_CARDS.arcCenterX,
        leftMesh.position.z - ALCHE_TOP_WORKS_CARDS.arcCenterZ,
      );
      layerDebugRef.current.card0FacingError = card0ForwardRef.current.angleTo(card0FacingTargetRef.current);

      if (card1Visible) {
        card1FacingTargetRef.current
          .set(
            rightMesh.position.x - ALCHE_TOP_WORKS_CARDS.arcCenterX,
            0,
            rightMesh.position.z - ALCHE_TOP_WORKS_CARDS.arcCenterZ,
          )
          .normalize();
        card1ForwardRef.current.copy(cardForwardAxis).applyQuaternion(rightMesh.quaternion).setY(0).normalize();
        layerDebugRef.current.card1ArcAngle = Math.atan2(
          rightMesh.position.x - ALCHE_TOP_WORKS_CARDS.arcCenterX,
          rightMesh.position.z - ALCHE_TOP_WORKS_CARDS.arcCenterZ,
        );
        layerDebugRef.current.card1FacingError = card1ForwardRef.current.angleTo(card1FacingTargetRef.current);
      } else {
        layerDebugRef.current.card1ArcAngle = null;
        layerDebugRef.current.card1FacingError = null;
      }
      layerDebugRef.current.card0ScreenLeft = card0ScreenBoundsRef.current.left;
      layerDebugRef.current.card0ScreenRight = card0ScreenBoundsRef.current.right;
      layerDebugRef.current.card0ScreenTop = card0ScreenBoundsRef.current.top;
      layerDebugRef.current.card0ScreenBottom = card0ScreenBoundsRef.current.bottom;
      layerDebugRef.current.card1ScreenLeft = card1Visible ? card1ScreenBoundsRef.current.left : null;
      layerDebugRef.current.card1ScreenRight = card1Visible ? card1ScreenBoundsRef.current.right : null;
      layerDebugRef.current.card1ScreenTop = card1Visible ? card1ScreenBoundsRef.current.top : null;
      layerDebugRef.current.card1ScreenBottom = card1Visible ? card1ScreenBoundsRef.current.bottom : null;
      layerDebugRef.current.card0Visible = card0Visible;
      layerDebugRef.current.card1Visible = card1Visible;
      layerDebugRef.current.cardsLeadWorldX = leadIndex === null ? null : leadWorldRef.current.x;
      layerDebugRef.current.cardsLeadWorldZ = leadIndex === null ? null : leadWorldRef.current.z;
      layerDebugRef.current.cardsSupportWorldX = supportIndex === null ? null : supportWorldRef.current.x;
      layerDebugRef.current.cardsSupportWorldZ = supportIndex === null ? null : supportWorldRef.current.z;
    }
  });

  return (
    <group ref={groupRef} position={[0, ALCHE_TOP_WORKS_CARDS.groupY, ALCHE_TOP_WORKS_CARDS.groupZ]} visible={false}>
      {materials.map((material, index) => (
        <mesh
          key={index}
          ref={(node) => {
            cardRefs.current[index] = node;
          }}
          geometry={geometry}
          material={material}
          renderOrder={6}
        />
      ))}
    </group>
  );
}

function CenterHeroModel({
  sceneState,
  captureMode,
  reducedMotion,
  renderMode,
  pointerOverride,
  pointerDebugRef,
  layerDebugRef,
}: Pick<
  KvSceneSystemProps,
  "sceneState" | "captureMode" | "reducedMotion" | "wallTexturePath" | "renderMode" | "pointerOverride" | "pointerDebugRef" | "layerDebugRef"
>) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useLoader(GLTFLoader, assetPath(ALCHE_TOP_CENTER_MODEL.path));
  const effectiveRadius = ALCHE_TOP_MEDIA_WALL.radius / ALCHE_TOP_KV_WALL_ARC_STRENGTH;
  const targetPosition = useMemo(
    () =>
      new THREE.Vector3(
        0,
        ALCHE_TOP_CENTER_MODEL.y,
        -effectiveRadius * ALCHE_TOP_CENTER_MODEL.depthMix + ALCHE_TOP_CENTER_MODEL.depthOffset,
      ),
    [effectiveRadius],
  );
  const backgroundRenderTarget = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      // Half float: the wordmark is HDR white; 8-bit clipped it and letters
      // behind the crystal went grey.
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    target.texture.name = "alche-prism-background-refraction";
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return target;
  }, []);
  const drawingBufferSize = useMemo(() => new THREE.Vector2(1, 1), []);
  const lastRefractionCaptureTimeRef = useRef(-Infinity);
  const refractionCaptureCountRef = useRef(0);
  const lastRefractionStateKeyRef = useRef("");
  const lastRefractionMotionTimeRef = useRef(-Infinity);
  // Window-level pointer (the DOM shell sits above the canvas, so R3F's own
  // pointer never updates). Normalised to [-1, 1], +y up.
  const windowPointerRef = useRef({ x: 0, y: 0 });
  const pointerTiltRef = useRef({ yaw: 0, pitch: 0, weight: 0 });
  const texturedScene = useMemo<CenterHeroRenderState>(() => {
    const shadedScene = gltf.scene.clone(true) as THREE.Group;
    const edgeScene = gltf.scene.clone(true) as THREE.Group;
    const maskedLineArtScene = gltf.scene.clone(true) as THREE.Group;
    const rainbowScene = gltf.scene.clone(true) as THREE.Group;
    const iceTexture = createIcePrismTexture();
    const sceneTextureFallback = new THREE.DataTexture(new Uint8Array([12, 13, 18, 255]), 1, 1, THREE.RGBAFormat);
    sceneTextureFallback.colorSpace = THREE.SRGBColorSpace;
    sceneTextureFallback.needsUpdate = true;
    const shadedMaterials: THREE.MeshStandardMaterial[] = [];
    const shadedGeometries = new Set<THREE.BufferGeometry>();
    const edgeGeometries: THREE.BufferGeometry[] = [];
    const prismIceUniforms: PrismIceUniforms = {
      uSceneTexture: { value: sceneTextureFallback },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uMaskBoundary: { value: -1 },
      uClipMode: { value: 0 },
      uRefractionStrength: { value: ALCHE_TOP_PRISM_READABLE_REFRACTION_STRENGTH },
      uLensWarpStrength: { value: ALCHE_TOP_PRISM_READABLE_LENS_WARP_STRENGTH },
      uChromaticStrength: { value: ALCHE_TOP_PRISM_READABLE_CHROMATIC_STRENGTH },
      uSceneRefractionMix: { value: 1 },
      uVioletMix: { value: 1 },
    };
    const maskedLineArtUniforms: MaskedPrismLineArtUniforms = {
      uOpacity: { value: 0 },
    };
    const rainbowUniforms: PrismSideRainbowUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uRainbowMix: { value: 0 },
      uBlackMix: { value: 0 },
      uCoverMix: { value: 0 },
      uTargetFaceNormal: {
        value: new THREE.Vector3(...ALCHE_TOP_CENTER_MODEL.rainbowFaceNormal),
      },
    };
    const hiddenMaterial = new THREE.MeshBasicMaterial({
      transparent: false,
      opacity: 1,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
    });
    // Fat lines: WebGL ignores LineBasicMaterial.linewidth (always 1px), which
    // could never match the reference's ~3px strokes.
    const edgeMaterial = new LineMaterial({
      color: new THREE.Color(ALCHE_TOP_PRISM_EDGE_OVERLAY_COLOR).getHex(),
      linewidth: renderMode === "full" ? ALCHE_TOP_PRISM_CRYSTAL_EDGE_WIDTH_PX : ALCHE_TOP_PRISM_EDGE_OVERLAY_WIDTH_PX,
      worldUnits: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const maskedLineArtMaterial = createMaskedPrismLineArtMaterial(maskedLineArtUniforms);
    const rainbowMaterial = createPrismSideRainbowMaterial(rainbowUniforms);
    const prismIceMaterial = createPrismIceMaterial(iceTexture, prismIceUniforms);
    shadedMaterials.push(prismIceMaterial);

    const crystalBodyGeometry = createPrismCrystalBodyGeometry();
    shadedScene.traverse((child) => {
      if (!("isMesh" in child) || child.isMesh !== true) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 4;
      mesh.geometry = crystalBodyGeometry;
      mesh.material = prismIceMaterial;
      shadedGeometries.add(mesh.geometry as THREE.BufferGeometry);
    });

    // Collect first: LineSegments2 is itself a Mesh, so adding it during
    // traverse() would be visited and recurse forever.
    const edgeMeshes: THREE.Mesh[] = [];
    edgeScene.traverse((child) => {
      if ("isMesh" in child && child.isMesh === true) edgeMeshes.push(child as THREE.Mesh);
    });
    edgeMeshes.forEach((mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 5;
      mesh.material = hiddenMaterial;
      const lineGeometry = new LineSegmentsGeometry();
      if (renderMode === "full") {
        const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry);
        lineGeometry.fromEdgesGeometry(edgesGeometry);
        edgesGeometry.dispose();
      } else {
        lineGeometry.setPositions(createPrismLogoLineArtPositions());
      }
      const lines = new LineSegments2(lineGeometry, edgeMaterial);
      lines.renderOrder = 7;
      lines.frustumCulled = false;
      edgeGeometries.push(lineGeometry);
      mesh.add(lines);
    });

    maskedLineArtScene.traverse((child) => {
      if (!("isMesh" in child) || child.isMesh !== true) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 6;
      mesh.material = maskedLineArtMaterial;
    });

    rainbowScene.traverse((child) => {
      if (!("isMesh" in child) || child.isMesh !== true) return;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 5.5;
      mesh.material = rainbowMaterial;
    });

    // Measured on the GLB (edge scene) so the bevelled body shares the exact
    // scale/centre of the line-art and rainbow layers.
    const bounds = new THREE.Box3().setFromObject(edgeScene);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const modelHeight = Math.max(size.y, 0.0001);
    const scale = ALCHE_TOP_CENTER_MODEL.targetHeight / modelHeight;
    shadedScene.scale.setScalar(scale);
    edgeScene.scale.setScalar(scale);
    maskedLineArtScene.scale.setScalar(scale);
    rainbowScene.scale.setScalar(scale);
    bounds.setFromObject(edgeScene);
    const center = bounds.getCenter(new THREE.Vector3());
    shadedScene.position.sub(center);
    edgeScene.position.sub(center);
    maskedLineArtScene.position.sub(center);
    rainbowScene.position.sub(center);

    return {
      shadedScene,
      edgeScene,
      maskedLineArtScene,
      rainbowScene,
      modelScale: scale,
      iceTexture,
      shadedMaterials,
      hiddenMaterial,
      edgeMaterial,
      maskedLineArtMaterial,
      rainbowMaterial,
      shadedGeometries,
      edgeGeometries,
      prismIceUniforms,
      sceneTextureFallback,
      maskedLineArtUniforms,
      rainbowUniforms,
    };
    // renderMode picks the edge geometry (EdgesGeometry vs logo line-art).
  }, [gltf.scene, renderMode]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      windowPointerRef.current.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      windowPointerRef.current.y = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    };
    const handlePointerLeave = () => {
      windowPointerRef.current.x = 0;
      windowPointerRef.current.y = 0;
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    if (renderMode !== "full") return;
    if (typeof window === "undefined") return;

    const host = window as typeof window & {
      __getAlcheHeroModelRotation?: () => { x: number; y: number; z: number } | null;
    };

    host.__getAlcheHeroModelRotation = () => {
      if (!groupRef.current) return null;
      return {
        x: groupRef.current.rotation.x,
        y: groupRef.current.rotation.y,
        z: groupRef.current.rotation.z,
      };
    };

    return () => {
      delete host.__getAlcheHeroModelRotation;
    };
  }, [renderMode, texturedScene]);

  useEffect(
    () => () => {
      texturedScene.iceTexture.dispose();
      texturedScene.sceneTextureFallback.dispose();
      texturedScene.shadedMaterials.forEach((material) => material.dispose());
      texturedScene.hiddenMaterial.dispose();
      texturedScene.edgeMaterial.dispose();
      texturedScene.maskedLineArtMaterial.dispose();
      texturedScene.rainbowMaterial.dispose();
      texturedScene.shadedGeometries.forEach((geometry) => geometry.dispose());
      texturedScene.edgeGeometries.forEach((geometry) => geometry.dispose());
      backgroundRenderTarget.dispose();
    },
    [backgroundRenderTarget, texturedScene],
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const { missionPanelProgress } = deriveMissionTransitionOverlayState(sceneState.activeSection, sceneState.sectionProgress);
    const splitEnabled = sceneState.activeSection === "mission_in";
    const maskBoundary = splitEnabled ? deriveMissionPanelBoundaryFromProgress(missionPanelProgress) : -1;
    const visibility =
      splitEnabled
        ? sceneState.kv.prismVisibility
        : sceneState.activeSection === "works_intro" || sceneState.activeSection === "works" || sceneState.activeSection === "works_outro"
        ? sceneState.kv.visible
        : sceneState.activeSection === "works_cards"
          ? // Reference: the crystal fully yields the stage to the flying cards
            // and only returns for the works_outro flip.
            0
          : sceneState.kv.prismVisibility * sceneState.kv.visible;


    state.gl.getDrawingBufferSize(drawingBufferSize);
    texturedScene.prismIceUniforms.uViewportPx.value.copy(drawingBufferSize);
    texturedScene.prismIceUniforms.uMaskBoundary.value = maskBoundary;
    texturedScene.rainbowUniforms.uTime.value = state.clock.elapsedTime;

    const missionPanelActive = missionPanelProgress > 0.001;
    const splitFullFade = splitEnabled ? smoothstep(remapRange(missionPanelProgress, 0.62, 0.84)) : 0;
    const fullBridgeVisibility = splitEnabled ? visibility * (1 - splitFullFade) : visibility;
    const edgeBridgeVisibility =
      renderMode === "edge-overlay" && missionPanelActive
        ? splitEnabled
          ? visibility
          : sceneState.activeSection === "works_outro"
          ? visibility * smoothstep(remapRange(missionPanelProgress, 0.08, 0.36))
          : 0
        : 0;
    const edgeOverlayActive = renderMode === "edge-overlay" && edgeBridgeVisibility > 0.001;
    const iceVisibilityTarget = renderMode === "full" ? fullBridgeVisibility : 0;
    const crystalEdgeVisibility = renderMode === "full" ? iceVisibilityTarget * ALCHE_TOP_PRISM_CRYSTAL_EDGE_OPACITY : 0;
    const edgeVisibilityTarget = renderMode === "full" ? crystalEdgeVisibility : edgeBridgeVisibility;
    texturedScene.prismIceUniforms.uSceneRefractionMix.value = splitEnabled ? 0.28 : 1;
    texturedScene.prismIceUniforms.uVioletMix.value = THREE.MathUtils.damp(
      texturedScene.prismIceUniforms.uVioletMix.value,
      1 - sceneState.kv.wallZebra,
      3.6,
      delta,
    );
    texturedScene.shadedMaterials.forEach((material) => {
      const iceDamp = splitEnabled ? 10 : 4;
      material.opacity = THREE.MathUtils.damp(material.opacity, iceVisibilityTarget * ALCHE_TOP_PRISM_ICE_OPACITY, iceDamp, delta);
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        iceVisibilityTarget * ALCHE_TOP_PRISM_EMISSIVE_TARGET,
        iceDamp,
        delta,
      );
    });
    const edgeDamp = missionPanelActive ? 10 : 4;
    texturedScene.hiddenMaterial.depthWrite = renderMode === "edge-overlay";
    texturedScene.hiddenMaterial.polygonOffset = renderMode === "edge-overlay";
    texturedScene.edgeMaterial.color.set(renderMode === "full" ? ALCHE_TOP_PRISM_CRYSTAL_EDGE_COLOR : ALCHE_TOP_PRISM_EDGE_OVERLAY_COLOR);
    texturedScene.edgeMaterial.resolution.set(state.size.width, state.size.height);
    texturedScene.edgeMaterial.opacity = THREE.MathUtils.damp(
      texturedScene.edgeMaterial.opacity,
      edgeVisibilityTarget,
      edgeDamp,
      delta,
    );
    texturedScene.maskedLineArtUniforms.uOpacity.value = THREE.MathUtils.damp(
      texturedScene.maskedLineArtUniforms.uOpacity.value,
      edgeBridgeVisibility * 0.86,
      edgeDamp,
      delta,
    );
    texturedScene.rainbowUniforms.uOpacity.value = THREE.MathUtils.damp(
      texturedScene.rainbowUniforms.uOpacity.value,
      splitEnabled ? edgeBridgeVisibility * sceneState.kv.prismRainbowMix * 0.92 : 0,
      edgeDamp,
      delta,
    );
    texturedScene.rainbowUniforms.uRainbowMix.value = THREE.MathUtils.damp(
      texturedScene.rainbowUniforms.uRainbowMix.value,
      splitEnabled ? sceneState.kv.prismRainbowMix : 0,
      edgeDamp,
      delta,
    );
    texturedScene.rainbowUniforms.uBlackMix.value = THREE.MathUtils.damp(
      texturedScene.rainbowUniforms.uBlackMix.value,
      splitEnabled ? sceneState.kv.prismRainbowBlackMix : 0,
      edgeDamp,
      delta,
    );
    texturedScene.rainbowUniforms.uCoverMix.value = THREE.MathUtils.damp(
      texturedScene.rainbowUniforms.uCoverMix.value,
      splitEnabled
        ? clamp01((sceneState.kv.prismGroupScale - 1) / Math.max(ALCHE_TOP_CENTER_MODEL.coverScale - 1, 0.0001))
        : 0,
      6.4,
      delta,
    );

    const prismFullOpacity = texturedScene.shadedMaterials.reduce((maxOpacity, material) => Math.max(maxOpacity, material.opacity), 0);
    const prismEdgeOpacity = texturedScene.edgeMaterial.opacity;
    const prismLineOpacity = texturedScene.maskedLineArtUniforms.uOpacity.value;
    if (layerDebugRef) {
      if (renderMode === "full") {
        layerDebugRef.current.prismFullOpacity = prismFullOpacity;
      } else {
        layerDebugRef.current.prismEdgeOpacity = prismEdgeOpacity;
        layerDebugRef.current.prismLineOpacity = prismLineOpacity;
      }
    }

    const shadedVisible =
      renderMode === "full" && (iceVisibilityTarget > 0.001 || texturedScene.shadedMaterials.some((material) => material.opacity > 0.001));
    const fullEdgeVisible = renderMode === "full" && (crystalEdgeVisibility > 0.001 || prismEdgeOpacity > 0.001);
    const edgeVisible =
      fullEdgeVisible ||
      (renderMode === "edge-overlay" &&
        (edgeOverlayActive || prismEdgeOpacity > 0.001 || prismLineOpacity > 0.001 || texturedScene.rainbowUniforms.uOpacity.value > 0.001));
    const lineArtVisible = renderMode === "edge-overlay" && edgeVisible;
    const rainbowVisible =
      lineArtVisible &&
      splitEnabled &&
      (sceneState.kv.prismRainbowMix > 0.001 || texturedScene.rainbowUniforms.uOpacity.value > 0.001);
    texturedScene.shadedScene.visible = shadedVisible;
    texturedScene.edgeScene.visible = edgeVisible;
    // Reference mission line-art is outline-only; the hatch fill read as a grey
    // shaded body. (lineArtVisible still gates the rainbow face below.)
    texturedScene.maskedLineArtScene.visible = false;
    texturedScene.rainbowScene.visible = rainbowVisible;
    groupRef.current.visible = shadedVisible || edgeVisible;
    if (!groupRef.current.visible) {
      if (pointerDebugRef) {
        pointerDebugRef.current.modelRotationX = groupRef.current.rotation.x;
        pointerDebugRef.current.modelRotationY = groupRef.current.rotation.y;
        pointerDebugRef.current.modelRotationZ = groupRef.current.rotation.z;
      }
      if (layerDebugRef) {
        layerDebugRef.current.modelWorldZ = null;
        layerDebugRef.current.modelScale = null;
        layerDebugRef.current.prismGroupScale = null;
        if (renderMode === "full") {
          layerDebugRef.current.prismRefractionCaptureMode = "skipped";
          layerDebugRef.current.prismRefractionActiveMotion = false;
        }
      }
      return;
    }

    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      targetPosition.x,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      targetPosition.y,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z,
      targetPosition.z,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    // Mouse-follow tilt (reference kv "MainLogo" reacts to the cursor). Only
    // in the crystal-led sections; the mission turn / vision cover keep their
    // scripted pose. Disabled for reduced motion and pinned captures unless a
    // pointer override is supplied.
    const pointerSection =
      sceneState.activeSection === "loading" ||
      sceneState.activeSection === "kv" ||
      sceneState.activeSection === "works_intro" ||
      sceneState.activeSection === "works" ||
      sceneState.activeSection === "works_cards" ||
      sceneState.activeSection === "works_outro";
    const pointerSource = pointerOverride ?? (captureMode || reducedMotion ? null : windowPointerRef.current);
    const tilt = pointerTiltRef.current;
    tilt.weight = THREE.MathUtils.damp(tilt.weight, pointerSection && pointerSource ? 1 : 0, 3, delta);
    tilt.yaw = THREE.MathUtils.damp(tilt.yaw, (pointerSource?.x ?? 0) * ALCHE_TOP_CENTER_MODEL.pointerYawStrength, 2.6, delta);
    tilt.pitch = THREE.MathUtils.damp(tilt.pitch, -(pointerSource?.y ?? 0) * ALCHE_TOP_CENTER_MODEL.pointerPitchStrength, 2.6, delta);
    if (pointerDebugRef) {
      pointerDebugRef.current.r3fPointerX = pointerSource?.x ?? 0;
      pointerDebugRef.current.r3fPointerY = pointerSource?.y ?? 0;
    }

    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      sceneState.kv.prismRotationX + tilt.pitch * tilt.weight,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    // The frame is symmetric under a half turn about Y, so when the target
    // jumps by ~pi (e.g. leaving the works-entry half turn) re-express the
    // current angle one half turn over instead of visibly spinning back.
    const targetYaw = sceneState.kv.prismRotationY + tilt.yaw * tilt.weight;
    const yawGap = targetYaw - groupRef.current.rotation.y;
    if (Math.abs(yawGap) > Math.PI * 0.75) {
      groupRef.current.rotation.y += Math.sign(yawGap) * Math.PI;
    }
    groupRef.current.rotation.y = THREE.MathUtils.damp(
      groupRef.current.rotation.y,
      targetYaw,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    groupRef.current.rotation.z = THREE.MathUtils.damp(
      groupRef.current.rotation.z,
      sceneState.kv.prismRotationZ,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    const targetGroupScale = sceneState.kv.prismGroupScale;
    const nextGroupScale = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      targetGroupScale,
      ALCHE_TOP_CENTER_MODEL.rotationDamp,
      delta,
    );
    groupRef.current.scale.setScalar(nextGroupScale);
    // The GLB tunnel is ~half as deep as it is tall, which hides the
    // through-hole in perspective. Reference kv crystal is a shallow frame,
    // so squash depth while front-facing and restore it for the mission turn
    // (whose side-slab read depends on the full depth).
    // Distance to the nearest front-facing yaw (0 or pi, by half-turn symmetry).
    const yawFromBase = Math.abs(groupRef.current.rotation.y - ALCHE_TOP_CENTER_MODEL.baseRotationY) % Math.PI;
    const yawFromFront = Math.min(yawFromBase, Math.PI - yawFromBase);
    const turnMix = smoothstep(remapRange(yawFromFront / ALCHE_TOP_CENTER_MODEL.missionTurnRadians, 0.25, 0.9));
    const depthScale = texturedScene.modelScale * THREE.MathUtils.lerp(ALCHE_TOP_CENTER_MODEL.kvDepthScale, 1, turnMix);
    texturedScene.shadedScene.scale.z = depthScale;
    // Line-art (edge-overlay) reads as a flat logo outline while front-facing
    // (reference 滚動stage6: single strokes); separated front/back faces
    // doubled every line. Depth returns with the mission turn.
    // The rainbow face and hatch live in the same layer, so they share it.
    const overlayDepthScale =
      renderMode === "edge-overlay" ? texturedScene.modelScale * THREE.MathUtils.lerp(0.04, 1, turnMix) : depthScale;
    texturedScene.edgeScene.scale.z = overlayDepthScale;
    texturedScene.maskedLineArtScene.scale.z = overlayDepthScale;
    texturedScene.rainbowScene.scale.z = overlayDepthScale;
    if (pointerDebugRef) {
      pointerDebugRef.current.modelRotationX = groupRef.current.rotation.x;
      pointerDebugRef.current.modelRotationY = groupRef.current.rotation.y;
      pointerDebugRef.current.modelRotationZ = groupRef.current.rotation.z;
    }
    if (layerDebugRef) {
      const worldPosition = groupRef.current.getWorldPosition(new THREE.Vector3());
      layerDebugRef.current.modelWorldZ = worldPosition.z;
      layerDebugRef.current.modelScale = texturedScene.modelScale * groupRef.current.scale.x;
      layerDebugRef.current.prismGroupScale = groupRef.current.scale.x;
    }

    const refractionStateKey = [
      sceneState.activeSection,
      Math.round(sceneState.sectionProgress * 200),
      Math.round(sceneState.worksCardsProgress * 200),
      Math.round(sceneState.kv.wallFlatten * 200),
      Math.round(sceneState.camera.fov * 100),
      ...sceneState.camera.position.map((value) => Math.round(value * 100)),
      ...sceneState.camera.target.map((value) => Math.round(value * 100)),
      Math.round(groupRef.current.position.x * 100),
      Math.round(groupRef.current.position.y * 100),
      Math.round(groupRef.current.position.z * 100),
      Math.round(groupRef.current.rotation.x * 1000),
      Math.round(groupRef.current.rotation.y * 1000),
      Math.round(groupRef.current.rotation.z * 1000),
      Math.round(groupRef.current.scale.x * 1000),
    ].join(":");
    const refractionStateChanged = refractionStateKey !== lastRefractionStateKeyRef.current;
    if (refractionStateChanged) {
      lastRefractionMotionTimeRef.current = state.clock.elapsedTime;
    }
    const secondsSinceRefractionCapture = state.clock.elapsedTime - lastRefractionCaptureTimeRef.current;
    const refractionActiveMotion =
      state.clock.elapsedTime - lastRefractionMotionTimeRef.current <= ALCHE_TOP_PRISM_REFRACTION_ACTIVE_HOLD;
    const refractionCaptureInterval = refractionActiveMotion
      ? ALCHE_TOP_PRISM_REFRACTION_ACTIVE_INTERVAL
      : ALCHE_TOP_PRISM_REFRACTION_IDLE_INTERVAL;
    const refractionVisibleEnough = iceVisibilityTarget > 0.04 || prismFullOpacity > 0.04;
    const refractionCaptureEnabled =
      renderMode === "full" &&
      !splitEnabled &&
      shadedVisible &&
      refractionVisibleEnough &&
      (!captureMode || refractionCaptureCountRef.current < 1);
    const refractionCaptureMode = refractionCaptureEnabled
      ? refractionActiveMotion
        ? "active"
        : "idle"
      : "skipped";
    if (refractionCaptureEnabled && secondsSinceRefractionCapture >= refractionCaptureInterval) {
      lastRefractionCaptureTimeRef.current = state.clock.elapsedTime;
      lastRefractionStateKeyRef.current = refractionStateKey;
      refractionCaptureCountRef.current += 1;
      const refractionTargetMax =
        refractionCaptureCountRef.current === 1 || !refractionActiveMotion
          ? ALCHE_TOP_PRISM_REFRACTION_IDLE_TARGET_MAX
          : ALCHE_TOP_PRISM_REFRACTION_ACTIVE_TARGET_MAX;
      const targetScale = Math.min(
        1,
        refractionTargetMax / Math.max(drawingBufferSize.x, drawingBufferSize.y, 1),
      );
      const targetWidth = Math.max(1, Math.floor(drawingBufferSize.x * targetScale));
      const targetHeight = Math.max(1, Math.floor(drawingBufferSize.y * targetScale));
      if (backgroundRenderTarget.width !== targetWidth || backgroundRenderTarget.height !== targetHeight) {
        backgroundRenderTarget.setSize(targetWidth, targetHeight);
      }

      const previousRenderTarget = state.gl.getRenderTarget();
      const previousAutoClear = state.gl.autoClear;
      const previousXrEnabled = state.gl.xr.enabled;
      const previousShadowAutoUpdate = state.gl.shadowMap.autoUpdate;
      const previousShadedVisible = texturedScene.shadedScene.visible;
      const previousEdgeVisible = texturedScene.edgeScene.visible;

      // Hide the crystal's own body and edge lines so they are not baked into
      // what is seen through the glass.
      texturedScene.shadedScene.visible = false;
      texturedScene.edgeScene.visible = false;
      state.gl.xr.enabled = false;
      state.gl.shadowMap.autoUpdate = false;
      state.gl.autoClear = true;
      state.gl.setRenderTarget(backgroundRenderTarget);
      state.gl.clear(true, true, true);
      state.gl.render(state.scene, state.camera);
      state.gl.setRenderTarget(previousRenderTarget);
      state.gl.autoClear = previousAutoClear;
      state.gl.xr.enabled = previousXrEnabled;
      state.gl.shadowMap.autoUpdate = previousShadowAutoUpdate;
      texturedScene.shadedScene.visible = previousShadedVisible;
      texturedScene.edgeScene.visible = previousEdgeVisible;
      texturedScene.prismIceUniforms.uSceneTexture.value = backgroundRenderTarget.texture;
    }

    if (layerDebugRef && renderMode === "full") {
      const lastCaptureTime = lastRefractionCaptureTimeRef.current;
      layerDebugRef.current.prismRefractionCaptureCount = refractionCaptureCountRef.current;
      layerDebugRef.current.prismRefractionTargetWidth = backgroundRenderTarget.width;
      layerDebugRef.current.prismRefractionTargetHeight = backgroundRenderTarget.height;
      layerDebugRef.current.prismRefractionLastCaptureMs = Number.isFinite(lastCaptureTime) ? Math.round(lastCaptureTime * 1000) : null;
      layerDebugRef.current.prismRefractionCaptureMode = refractionCaptureMode;
      layerDebugRef.current.prismRefractionActiveMotion = refractionActiveMotion && refractionCaptureEnabled;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={texturedScene.shadedScene} />
      <primitive object={texturedScene.edgeScene} />
      <primitive object={texturedScene.rainbowScene} />
      <primitive object={texturedScene.maskedLineArtScene} />
    </group>
  );
}

export function KvSceneSystem(props: KvSceneSystemProps) {
  const wallMediaRef = useRef<WallMediaState>({ from: 0, to: 0, blend: 0, strength: 0 });

  if (props.renderMode === "edge-overlay") {
    return <CenterHeroModel {...props} />;
  }

  return (
    <>
      <CurvedMediaWall
        sceneState={props.sceneState}
        wallTexturePath={props.wallTexturePath}
        worksCardItems={props.worksCardItems}
        wallMediaRef={wallMediaRef}
        layerDebugRef={props.layerDebugRef}
        animateContent={!props.reducedMotion && !props.captureMode}
      />
      <WallWordSweep {...props} />
      <WorksCardPair
        sceneState={props.sceneState}
        worksCardItems={props.worksCardItems}
        cardDebugMode={props.cardDebugMode}
        reducedMotion={props.reducedMotion}
        worksWordHandoff={props.worksWordHandoff}
        layerDebugRef={props.layerDebugRef}
        wallMediaRef={wallMediaRef}
      />
      <MoonflowTitle {...props} />
      <CenterHeroModel {...props} />
    </>
  );
}
