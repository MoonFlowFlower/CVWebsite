import { ALCHE_HERO_LOCK, ALCHE_HERO_SHOTS, type AlcheHeroShotId } from "@/lib/alche-hero-lock";

export const ALCHE_TOP_SECTION_IDS = [
  "loading",
  "kv",
  "works_intro",
  "works",
  "works_cards",
  "works_outro",
  "mission_in",
  "mission",
  "vision",
  "vision_out",
  "service_in",
  "service",
  "stellla",
  "outro",
] as const;

export type AlcheTopSectionId = (typeof ALCHE_TOP_SECTION_IDS)[number];

export const ALCHE_TOP_RUNTIME_MODE = "kv-works" as const;

export const ALCHE_SCROLLABLE_SECTION_IDS = ALCHE_TOP_SECTION_IDS.filter(
  (sectionId): sectionId is Exclude<AlcheTopSectionId, "loading"> => sectionId !== "loading",
);

export type AlcheScrollableSectionId = (typeof ALCHE_SCROLLABLE_SECTION_IDS)[number];

export const ALCHE_TOP_RENDERABLE_SECTIONS: readonly AlcheScrollableSectionId[] = [
  "kv",
  "works_intro",
  "works",
  "works_cards",
  "works_outro",
  "mission_in",
];

export const ALCHE_TOP_SCROLL_TRACK_SECTIONS: readonly AlcheScrollableSectionId[] = [
  ...ALCHE_TOP_RENDERABLE_SECTIONS,
  "mission",
  "vision",
  "vision_out",
  "service_in",
  "service",
  "stellla",
  "outro",
];

export const ALCHE_TOP_GROUP_IDS = ["top", "works", "about", "vision", "service"] as const;

export type AlcheTopGroupId = (typeof ALCHE_TOP_GROUP_IDS)[number];

export interface AlcheTopSectionDefinition {
  id: AlcheScrollableSectionId;
  label: string;
  groupId: AlcheTopGroupId | null;
  snapRatio: number;
  minHeight: string;
}

export interface AlcheTopGroupDefinition {
  id: AlcheTopGroupId;
  label: string;
  scrollTarget: AlcheScrollableSectionId;
  subsections: readonly AlcheScrollableSectionId[];
}

export interface AlcheTopSectionState {
  activeSection: AlcheTopSectionId;
  activeGroup: AlcheTopGroupId | null;
  sectionProgress: number;
  groupProgress: number;
  heroShotId: AlcheHeroShotId | null;
  introProgress: number;
}

export interface AlcheTopCameraState {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
}

export interface AlcheTopMediaWallConfig {
  worldZ: number;
  radius: number;
  height: number;
  radialSegments: number;
  heightSegments: number;
  cellColumns: number;
  cellRows: number;
}

export interface AlcheMissionPanelLayout {
  topVh: number;
  travelVh: number;
  bottomVh: number;
}

export interface AlcheKvSceneState {
  visible: number;
  wallVisibility: number;
  wallGlow: number;
  wallExposure: number;
  wallWhiteMix: number;
  wallFlatten: number;
  // 0 = violet kv LED haze, 1 = greyscale zebra LED content (works entry).
  wallZebra: number;
  wordVisibility: number;
  prismVisibility: number;
  prismScale: number;
  prismRotationX: number;
  prismRotationY: number;
  prismRotationZ: number;
  prismRainbowMix: number;
  prismRainbowBlackMix: number;
  prismGroupScale: number;
  hudVisibility: number;
}

export interface AlchePointerDebugState {
  enabled: boolean;
  prefersReducedMotion: boolean;
  reducedMotion: boolean;
  domPointerClientX: number | null;
  domPointerClientY: number | null;
  domPointerInside: boolean;
  r3fPointerX: number;
  r3fPointerY: number;
  modelRotationX: number | null;
  modelRotationY: number | null;
  modelRotationZ: number | null;
}

export interface AlcheLayerDebugState {
  sceneActiveSection: AlcheTopSectionId | null;
  missionTurnProgress: number | null;
  visionCoverProgress: number | null;
  prismGroupScale: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  cameraPosition: readonly [number, number, number];
  cameraTarget: readonly [number, number, number];
  wallWorldZ: number | null;
  wallRotationY: number | null;
  worksWorldX: number | null;
  modelWorldZ: number | null;
  modelScale: number | null;
  moonflowWorldZ: number | null;
  worksWorldZ: number | null;
  worksRotationY: number | null;
  worksHandoff: number | null;
  moonflowOpacity: number | null;
  worksOpacity: number | null;
  worksDepthTest: boolean | null;
  worksDepthWrite: boolean | null;
  worksTransparent: boolean | null;
  cardsOpacity: number | null;
  cardsLeadIndex: number | null;
  cardsLeadOpacity: number | null;
  cardsSupportOpacity: number | null;
  card0Opacity: number | null;
  card1Opacity: number | null;
  card0WorldX: number | null;
  card0WorldZ: number | null;
  card1WorldX: number | null;
  card1WorldZ: number | null;
  card0ArcAngle: number | null;
  card1ArcAngle: number | null;
  card0FacingError: number | null;
  card1FacingError: number | null;
  card0ScreenLeft: number | null;
  card0ScreenRight: number | null;
  card0ScreenTop: number | null;
  card0ScreenBottom: number | null;
  card1ScreenLeft: number | null;
  card1ScreenRight: number | null;
  card1ScreenTop: number | null;
  card1ScreenBottom: number | null;
  card0Visible: boolean;
  card1Visible: boolean;
  cardsLeadWorldX: number | null;
  cardsLeadWorldZ: number | null;
  cardsSupportWorldX: number | null;
  cardsSupportWorldZ: number | null;
  worksOutroClearMix: number | null;
  missionFlattenMix: number | null;
  missionWhiteMix: number | null;
  missionEmblemMix: number | null;
  missionPanelProgress: number | null;
  missionOutlineOpacity: number | null;
  kvWallFlatten: number | null;
  prismFullOpacity: number | null;
  prismEdgeOpacity: number | null;
  prismLineOpacity: number | null;
  prismRefractionCaptureCount: number;
  prismRefractionTargetWidth: number | null;
  prismRefractionTargetHeight: number | null;
  prismRefractionLastCaptureMs: number | null;
  prismRefractionCaptureMode: "active" | "idle" | "skipped";
  prismRefractionActiveMotion: boolean;
}

export interface AlcheWorksIntroSceneState {
  visible: number;
  handoffMix: number;
  sweepMix: number;
  alcheFade: number;
}

export interface AlcheWorksSceneState {
  visible: number;
  cardMix: number;
  browseProgress: number;
  travel: number;
  activeIndex: number;
  activeBlend: number;
}

export interface AlcheWorksOutroSceneState {
  visible: number;
  clearMix: number;
  residualMix: number;
}

export interface AlcheMissionInSceneState {
  visible: number;
  flattenMix: number;
  whiteMix: number;
  emblemMix: number;
}

export interface AlcheMissionSceneState {
  visible: number;
  whiteMix: number;
  emblemMix: number;
}

export interface AlcheVisionSceneState {
  visible: number;
  lineMix: number;
  densityMix: number;
  drainMix: number;
}

export interface AlcheVisionOutSceneState {
  visible: number;
  drainMix: number;
}

export interface AlcheServiceInSceneState {
  visible: number;
  entryMix: number;
  densityMix: number;
}

export interface AlcheServiceSceneState {
  visible: number;
  densityMix: number;
  browse: number;
  activeIndex: number;
}

export interface AlcheStelllaSceneState {
  visible: number;
  architectureMix: number;
  editorialMix: number;
  frameMix: number;
}

export interface AlcheOutroSceneState {
  visible: number;
  stageMix: number;
  wordmarkMix: number;
  footerMix: number;
}

export interface AlcheTopSceneState {
  activeSection: AlcheTopSectionId;
  sectionProgress: number;
  worksCardsProgress: number;
  introProgress: number;
  heroShotId: AlcheHeroShotId | null;
  camera: AlcheTopCameraState;
  kv: AlcheKvSceneState;
  worksIntro: AlcheWorksIntroSceneState;
  works: AlcheWorksSceneState;
  worksOutro: AlcheWorksOutroSceneState;
  missionIn: AlcheMissionInSceneState;
  mission: AlcheMissionSceneState;
  vision: AlcheVisionSceneState;
  visionOut: AlcheVisionOutSceneState;
  serviceIn: AlcheServiceInSceneState;
  service: AlcheServiceSceneState;
  stellla: AlcheStelllaSceneState;
  outro: AlcheOutroSceneState;
}

export const ALCHE_TOP_TIMINGS = {
  loadingFade: 0.92,
  introDuration: 1.82,
  navReveal: 0.74,
  indicatorReveal: 0.86,
  newsReveal: 0.96,
} as const;

export const ALCHE_TOP_SCROLL_TUNING = {
  duration: 2.36,
  lerp: 0.028,
  wheelMultiplier: 0.36,
  touchMultiplier: 0.65,
  activeViewport: 0.38,
  activeTriggerStart: "top 38%",
  activeTriggerEnd: "bottom 38%",
} as const;

export const ALCHE_TOP_MEDIA_WALL: AlcheTopMediaWallConfig = {
  worldZ: -5,
  radius: 9.6,
  height: 11.4,
  radialSegments: 68,
  heightSegments: 24,
  cellColumns: 26,
  cellRows: 14,
};

export const ALCHE_TOP_WALL_TILE_DENSITY = 12 as const;
export const ALCHE_TOP_KV_WALL_ARC_STRENGTH = 1.95 as const;
export const ALCHE_TOP_MISSION_PANEL_LAYOUT: AlcheMissionPanelLayout = {
  topVh: -4,
  travelVh: 162,
  bottomVh: -4,
} as const;
export const ALCHE_TOP_MOONFLOW = {
  y: 0.18,
  depthMix: 0.5,
  zOffset: -0.48,
  widthRatio: 0.8,
  fontPath: "/fonts/space-grotesk-500.woff",
  letterSpacing: 0.012,
  baseFontSize: 1,
  // SDF outline (fraction of font size) used as faux-bold.
  strokeBoldWidth: 0.022,
} as const;

export const ALCHE_TOP_WALL_WORD = {
  text: "WORKS",
  y: -0.04,
  fontPath: "/fonts/space-grotesk-500.woff",
  fontSize: 2.68,
  // Linear alpha: 0.28 reads as the reference's mid-grey LED lettering
  // (~145/255) instead of near-white.
  fillOpacity: 0.28,
  // Dim ghost read of the word behind the flying cards (reference behavior).
  // Multiplied by fillOpacity: effective linear alpha ~0.025.
  ghostOpacity: 0.09,
  wallInset: 0.0,
  worldZ: -4.9,
  surfaceOffset: 0.0,
  polygonDepthOffset: -0.02,
  enterX: -2.3,
  centerX: 0.0,
  exitX: 2.1,
  enterStart: 0.18,
  enterEnd: 0.48,
  holdEnd: 0.72,
  fadeEnd: 1,
} as const;

export const ALCHE_TOP_WORKS_CARDS = {
  // Reference lead card spans ~51% x 57% of the viewport with a gentle bend
  // (measured on 滚动stage8 / video 11.1s).
  width: 3.35,
  height: 1.9,
  bendRadius: 6.2,
  segments: 80,
  groupY: 0.22,
  groupZ: -4.15,
  arcCenterX: 0,
  arcCenterZ: 2.2,
  baseRadius: 2.48,
  // Rolling queue: cycle 0 keeps the original shotbook axis [0,1] untouched
  // (validator-pinned states stay identical); each extra unit of
  // worksCardsProgress plays one more queue->lead handoff cycle.
  queueCount: 4,
  cyclesTotal: 3,
  // The lead holds center until the crossover starts, then the handoff is
  // quick so the center never sits empty (reference pacing).
  extraCycleQueueEnd: 0.45,
  extraCycleLeadEnd: 0.8,
} as const;

export const ALCHE_TOP_CENTER_MODEL = {
  path: "/alche-top-page/kv/triangular-through-hole-solid.glb",
  y: 0.08,
  depthMix: 0.5,
  depthOffset: 0.38,
  targetHeight: 2.3,
  // Front-facing depth multiplier (restored to 1 through the mission turn).
  // 1 = full GLB depth: the clear-glass crystal needs the tunnel walls as a
  // visible bevel band (0.55 was only needed while the body was opaque).
  kvDepthScale: 1,
  // Outer side face that turns toward the camera after the +Y mission turn.
  // With the apex-up orientation (baseRotationZ 0) this is the left face; the
  // old +x normal landed on the back side and the visible slab stayed grey.
  rainbowFaceNormal: [-0.866025, 0.5, 0] as const,
  baseRotationX: 0,
  baseRotationY: 0.002754,
  // Reference kv crystal points up (apex at top); the GLB is authored apex-up,
  // so no Z flip. (Was Math.PI during the inverted-triangle phase.)
  baseRotationZ: 0,
  // Reference vision pose (from its logo vertex shader): only ~13.5 deg of
  // yaw plus a slight pitch, so the outline stays front-facing and the left
  // side face opens into a slanted rainbow band. (1.57 turned it edge-on.)
  missionTurnRadians: 0.236,
  missionTurnPitch: -0.1,
  // Side-view yaw the cover ends on (the old mission turn).
  coverTurnRadians: 1.57,
  missionTurnStartOffset: 0,
  coverScale: 6.2,
  // Mouse-follow tilt in radians at the viewport edge.
  pointerYawStrength: 0.42,
  pointerPitchStrength: 0.26,
  rotationDamp: 3.8,
} as const;

export const ALCHE_TOP_POST = {
  bloomStrength: 0.22,
  bloomRadius: 0.52,
  bloomThreshold: 0.84,
  chromaticOffset: 0.0011,
  filmNoise: 0.017,
  vignette: 0.24,
} as const;

function sectionHeight(ratio: number) {
  return `${Math.round(112 * ratio)}svh`;
}

export const ALCHE_TOP_SECTIONS: readonly AlcheTopSectionDefinition[] = [
  { id: "kv", label: "kv", groupId: "top", snapRatio: 1, minHeight: sectionHeight(1) },
  { id: "works_intro", label: "works_intro", groupId: "top", snapRatio: 1, minHeight: sectionHeight(1) },
  { id: "works", label: "works", groupId: "works", snapRatio: 1, minHeight: sectionHeight(1.35) },
  { id: "works_cards", label: "works_cards", groupId: "works", snapRatio: 1, minHeight: sectionHeight(2.8) },
  { id: "works_outro", label: "works_outro", groupId: "works", snapRatio: 1.5, minHeight: sectionHeight(1.5) },
  { id: "mission_in", label: "mission_in", groupId: "about", snapRatio: 1, minHeight: sectionHeight(1) },
  { id: "mission", label: "mission", groupId: "about", snapRatio: 1, minHeight: sectionHeight(1.05) },
  { id: "vision", label: "vision", groupId: "vision", snapRatio: 1.8, minHeight: sectionHeight(1.7) },
  // Reference cuts from the full-screen rainbow slab (16.0s) to service
  // (16.5s) almost immediately; full-height vision_out + service_in left
  // ~2.5 viewports of empty black scroll.
  { id: "vision_out", label: "vision_out", groupId: "vision", snapRatio: 1, minHeight: sectionHeight(0.4) },
  { id: "service_in", label: "service_in", groupId: "service", snapRatio: 1, minHeight: sectionHeight(0.5) },
  { id: "service", label: "service", groupId: "service", snapRatio: 1, minHeight: sectionHeight(1.15) },
  // Taller so the framed stage holds before the outro approach starts
  // (the endmark trigger lands at stellla progress ~(H - 55vh) / H).
  { id: "stellla", label: "stellla", groupId: "service", snapRatio: 1, minHeight: sectionHeight(1.8) },
  { id: "outro", label: "outro", groupId: null, snapRatio: 1.5, minHeight: sectionHeight(1.45) },
] as const;

export const ALCHE_TOP_SECTION_MAP = Object.fromEntries(
  ALCHE_TOP_SECTIONS.map((section) => [section.id, section]),
) as Record<AlcheScrollableSectionId, AlcheTopSectionDefinition>;

export const ALCHE_TOP_GROUPS: readonly AlcheTopGroupDefinition[] = [
  { id: "top", label: "TOP", scrollTarget: "kv", subsections: ["kv", "works_intro"] },
  { id: "works", label: "WORKS", scrollTarget: "works", subsections: ["works", "works_cards", "works_outro"] },
  { id: "about", label: "ABOUT", scrollTarget: "mission", subsections: ["mission_in", "mission"] },
  { id: "vision", label: "VISION", scrollTarget: "vision", subsections: ["vision", "vision_out"] },
  { id: "service", label: "SERVICE", scrollTarget: "service", subsections: ["service", "stellla"] },
] as const;

export const ALCHE_TOP_NEWS_VISIBILITY: readonly AlcheTopSectionId[] = ["kv", "works_intro", "works", "works_outro"] as const;
export const ALCHE_TOP_HERO_HUD_VISIBILITY: readonly AlcheTopSectionId[] = ["kv", "works_intro"] as const;
export const ALCHE_TOP_WORKS_VISIBILITY: readonly AlcheTopSectionId[] = ["works_intro", "works", "works_outro"] as const;
export const ALCHE_TOP_MISSION_VISIBILITY: readonly AlcheTopSectionId[] = ["mission_in", "mission"] as const;
export const ALCHE_TOP_VISION_VISIBILITY: readonly AlcheTopSectionId[] = ["vision", "vision_out"] as const;
export const ALCHE_TOP_SERVICE_VISIBILITY: readonly AlcheTopSectionId[] = ["service_in", "service"] as const;
export const ALCHE_TOP_STELLLA_VISIBILITY: readonly AlcheTopSectionId[] = ["stellla"] as const;

export const ALCHE_TOP_CAMERA_STATES: Record<AlcheTopSectionId, AlcheTopCameraState> = {
  loading: {
    position: [0.08, 0.14, 5.68],
    target: [0.02, 0.02, -0.86],
    fov: 31.6,
  },
  kv: {
    position: [0.02, 0.08, 5.38],
    target: [0.04, 0.02, -1.02],
    fov: 30.2,
  },
  works_intro: {
    position: [0.18, 0.14, 5.84],
    target: [0.28, 0.06, -1.02],
    fov: 31.8,
  },
  works: {
    position: [0.46, 0.08, 6.18],
    target: [0.58, 0.02, -1.38],
    fov: 33.6,
  },
  works_cards: {
    position: [0.18, 0.08, 6.28],
    target: [0.3, 0.02, -1.72],
    fov: 32.6,
  },
  works_outro: {
    position: [0.22, 0.1, 6.32],
    target: [0.14, 0.02, -1.72],
    fov: 33.2,
  },
  mission_in: {
    position: [0.08, 0.14, 6.1],
    target: [0, 0.02, -1.88],
    fov: 34,
  },
  mission: {
    position: [0, 0.04, 5.82],
    target: [0, 0, -2.12],
    fov: 32.4,
  },
  vision: {
    position: [0.02, 0.02, 5.56],
    target: [0.02, 0, -2.34],
    fov: 30.8,
  },
  vision_out: {
    position: [0.16, 0.02, 5.76],
    target: [0.14, 0, -2.18],
    fov: 31.8,
  },
  service_in: {
    position: [0.28, 0.08, 5.98],
    target: [0.42, 0.02, -2.3],
    fov: 33.2,
  },
  service: {
    position: [0.58, 0.08, 6.22],
    target: [0.78, -0.02, -2.84],
    fov: 34.6,
  },
  stellla: {
    position: [0.84, 0.12, 6],
    target: [1.04, 0.02, -3.46],
    fov: 32.6,
  },
  outro: {
    position: [-0.42, 0.02, 6.44],
    target: [-0.36, 0.02, -3.84],
    fov: 31.6,
  },
};

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function deriveMissionPanelBoundaryFromProgress(progress: number) {
  const clampedProgress = clamp01(progress);
  const panelTopVh =
    ALCHE_TOP_MISSION_PANEL_LAYOUT.topVh + (1 - clampedProgress) * ALCHE_TOP_MISSION_PANEL_LAYOUT.travelVh;
  return clamp01(1 - panelTopVh / 100);
}

export function remapRange(value: number, start: number, end: number) {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

export function smoothstep(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

export function lerpCameraState(a: AlcheTopCameraState, b: AlcheTopCameraState, mix: number): AlcheTopCameraState {
  const t = clamp01(mix);
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * t,
      a.position[1] + (b.position[1] - a.position[1]) * t,
      a.position[2] + (b.position[2] - a.position[2]) * t,
    ],
    target: [
      a.target[0] + (b.target[0] - a.target[0]) * t,
      a.target[1] + (b.target[1] - a.target[1]) * t,
      a.target[2] + (b.target[2] - a.target[2]) * t,
    ],
    fov: a.fov + (b.fov - a.fov) * t,
  };
}

export function getTopGroupForSection(sectionId: AlcheTopSectionId): AlcheTopGroupId | null {
  if (sectionId === "loading") return null;
  return ALCHE_TOP_SECTION_MAP[sectionId].groupId;
}

export function normalizeTopRuntimeSection(sectionId: AlcheTopSectionId): AlcheTopSectionId {
  if (
    sectionId === "loading" ||
    sectionId === "kv" ||
    sectionId === "works_intro" ||
    sectionId === "works" ||
    sectionId === "works_cards" ||
    sectionId === "works_outro" ||
    sectionId === "mission_in"
  ) {
    return sectionId;
  }

  return "mission_in";
}

export function deriveKvState(introProgress: number) {
  return {
    wallEstablish: smoothstep(remapRange(introProgress, 0.08, 0.42)),
    wordReveal: smoothstep(remapRange(introProgress, 0.24, 0.62)),
    hudReveal: smoothstep(remapRange(introProgress, 0.56, 0.9)),
  };
}

export function deriveWorksIntroState(progress: number) {
  return {
    handoffMix: smoothstep(remapRange(progress, 0.0, 0.82)),
    sweepMix: smoothstep(remapRange(progress, 0.06, 0.74)),
    alcheFade: smoothstep(remapRange(progress, 0.0, 0.35)),
  };
}

export function deriveWorksState(progress: number, workCount: number) {
  const clamped = clamp01(progress);
  const cardMix = smoothstep(remapRange(clamped, 0.14, 0.68));
  const browseProgress = smoothstep(remapRange(clamped, 0.46, 1.0));
  const travel = browseProgress * Math.max(workCount - 1, 0);
  const activeIndex = Math.min(workCount - 1, Math.floor(travel + 0.35));

  return {
    cardMix,
    browseProgress,
    travel,
    activeIndex,
    activeBlend: travel - Math.floor(travel),
  };
}

export function deriveWorksOutroState(progress: number) {
  return {
    clearMix: smoothstep(remapRange(progress, 0.08, 0.78)),
    residualMix: 1 - smoothstep(remapRange(progress, 0.26, 0.88)),
  };
}

export function deriveMissionState(progress: number) {
  return {
    flattenMix: smoothstep(remapRange(progress, 0.0, 0.82)),
    whiteMix: smoothstep(remapRange(progress, 0.16, 0.92)),
    emblemMix: smoothstep(remapRange(progress, 0.34, 1.0)),
  };
}

export function deriveVisionState(progress: number) {
  return {
    lineMix: smoothstep(remapRange(progress, 0.0, 0.7)),
    densityMix: smoothstep(remapRange(progress, 0.18, 0.94)),
    drainMix: smoothstep(remapRange(progress, 0.52, 1.0)),
  };
}

export function deriveServiceState(progress: number, itemCount: number) {
  const clamped = clamp01(progress);
  const densityMix = smoothstep(remapRange(clamped, 0.0, 0.72));
  const browse = smoothstep(remapRange(clamped, 0.24, 1.0)) * Math.max(itemCount - 1, 0);
  const activeIndex = Math.min(itemCount - 1, Math.floor(browse + 0.25));

  return {
    densityMix,
    browse,
    activeIndex,
  };
}

export function deriveStelllaState(progress: number) {
  return {
    architectureMix: smoothstep(remapRange(progress, 0.0, 0.56)),
    editorialMix: smoothstep(remapRange(progress, 0.38, 0.92)),
    frameMix: smoothstep(remapRange(progress, 0.2, 0.84)),
  };
}

export function deriveOutroState(progress: number) {
  return {
    stageMix: smoothstep(remapRange(progress, 0.0, 0.54)),
    wordmarkMix: smoothstep(remapRange(progress, 0.34, 0.92)),
    footerMix: smoothstep(remapRange(progress, 0.56, 1.0)),
  };
}

export function deriveKvSceneState(introProgress: number, heroShotId: AlcheHeroShotId | null, handoffMix = 0): AlcheKvSceneState {
  const intro = deriveKvState(introProgress);
  const heroShot = heroShotId ? ALCHE_HERO_SHOTS[heroShotId] : null;
  return {
    visible: 1,
    wallVisibility: intro.wallEstablish,
    wallGlow: heroShot?.chamberMassing.roomGlow ?? 0.96,
    wallExposure: heroShot?.chamberMassing.roomExposure ?? 0.94,
    wallWhiteMix: 0,
    wallFlatten: 0,
    wallZebra: 0,
    wordVisibility: intro.wordReveal * (1 - handoffMix),
    // Reference keeps the crystal fully present through the works entry.
    prismVisibility: 1,
    prismScale: (heroShot?.prismEmphasis.scale ?? 1) * ALCHE_HERO_LOCK.prism.scale,
    prismRotationX: ALCHE_TOP_CENTER_MODEL.baseRotationX,
    prismRotationY: ALCHE_TOP_CENTER_MODEL.baseRotationY,
    prismRotationZ: ALCHE_TOP_CENTER_MODEL.baseRotationZ,
    prismRainbowMix: 0,
    prismRainbowBlackMix: 0,
    prismGroupScale: 1,
    hudVisibility: intro.hudReveal * (1 - handoffMix * 0.72),
  };
}

export function deriveWorksIntroSceneState(progress: number): AlcheWorksIntroSceneState {
  const state = deriveWorksIntroState(progress);
  return {
    visible: state.handoffMix,
    handoffMix: state.handoffMix,
    sweepMix: state.sweepMix,
    alcheFade: state.alcheFade,
  };
}

export function deriveWorksSceneState(progress: number, workCount: number): AlcheWorksSceneState {
  const state = deriveWorksState(progress, workCount);
  return {
    visible: state.cardMix,
    cardMix: state.cardMix,
    browseProgress: state.browseProgress,
    travel: state.travel,
    activeIndex: state.activeIndex,
    activeBlend: state.activeBlend,
  };
}

export function deriveWorksOutroSceneState(progress: number): AlcheWorksOutroSceneState {
  const state = deriveWorksOutroState(progress);
  return {
    visible: Math.max(state.residualMix, 1 - state.clearMix * 0.4),
    clearMix: state.clearMix,
    residualMix: state.residualMix,
  };
}

export function deriveMissionInSceneState(progress: number): AlcheMissionInSceneState {
  const state = deriveMissionState(progress);
  return {
    visible: Math.max(state.flattenMix, state.whiteMix),
    flattenMix: state.flattenMix,
    whiteMix: state.whiteMix,
    emblemMix: state.emblemMix * 0.78,
  };
}

export function deriveMissionTransitionOverlayState(activeSection: AlcheTopSectionId, sectionProgress: number) {
  const runtimeSection = normalizeTopRuntimeSection(activeSection);

  if (runtimeSection === "works_outro") {
    const worksOutro = deriveWorksOutroState(sectionProgress);
    return {
      missionPanelProgress: worksOutro.clearMix * 0.42,
      missionOutlineOpacity: 0,
    };
  }

  if (runtimeSection === "mission_in") {
    const missionIn = deriveMissionInSceneState(sectionProgress);
    const missionPanelProgress = 0.42 + missionIn.flattenMix * 0.58;
    return {
      missionPanelProgress,
      missionOutlineOpacity: 0,
    };
  }

  return {
    missionPanelProgress: 0,
    missionOutlineOpacity: 0,
  };
}

export function deriveMissionSceneState(progress: number): AlcheMissionSceneState {
  const state = deriveMissionState(progress);
  return {
    visible: Math.max(state.whiteMix, state.emblemMix),
    whiteMix: state.whiteMix,
    emblemMix: state.emblemMix,
  };
}

export function deriveVisionSceneState(progress: number): AlcheVisionSceneState {
  const state = deriveVisionState(progress);
  return {
    visible: Math.max(state.lineMix, state.densityMix),
    lineMix: state.lineMix,
    densityMix: state.densityMix,
    drainMix: state.drainMix,
  };
}

export function deriveVisionOutSceneState(progress: number): AlcheVisionOutSceneState {
  const state = deriveVisionState(progress);
  return {
    visible: 1 - state.drainMix * 0.68,
    drainMix: state.drainMix,
  };
}

export function deriveServiceInSceneState(progress: number): AlcheServiceInSceneState {
  const densityMix = smoothstep(remapRange(progress, 0.0, 0.82));
  return {
    visible: densityMix,
    entryMix: smoothstep(remapRange(progress, 0.08, 0.74)),
    densityMix,
  };
}

export function deriveServiceSceneState(progress: number, itemCount: number): AlcheServiceSceneState {
  const state = deriveServiceState(progress, itemCount);
  return {
    visible: Math.max(state.densityMix, 0.12),
    densityMix: state.densityMix,
    browse: state.browse,
    activeIndex: state.activeIndex,
  };
}

export function deriveStelllaSceneState(progress: number): AlcheStelllaSceneState {
  const state = deriveStelllaState(progress);
  return {
    visible: Math.max(state.architectureMix, state.editorialMix),
    architectureMix: state.architectureMix,
    editorialMix: state.editorialMix,
    frameMix: state.frameMix,
  };
}

export function deriveOutroSceneState(progress: number): AlcheOutroSceneState {
  const state = deriveOutroState(progress);
  return {
    visible: Math.max(state.stageMix, 0.16),
    stageMix: state.stageMix,
    wordmarkMix: state.wordmarkMix,
    footerMix: state.footerMix,
  };
}

export function deriveGroupProgress(sectionId: AlcheTopSectionId, sectionProgress: number) {
  const groupId = getTopGroupForSection(sectionId);
  if (!groupId) return 0;

  const group = ALCHE_TOP_GROUPS.find((entry) => entry.id === groupId);
  if (!group) return 0;

  const index = Math.max(group.subsections.indexOf(sectionId as AlcheScrollableSectionId), 0);
  return clamp01((index + clamp01(sectionProgress)) / group.subsections.length);
}

export interface AlcheServicePanelPose {
  /** Horizontal offset of the whole panel group, in vw. */
  x: number;
  /** Panel yaw in degrees (panels face the room centre). */
  rotateY: number;
  opacity: number;
  /** 0..1 left-to-right reveal of the title/description column. */
  reveal: number;
  /** Item-local timeline: <0 queued, 0..1 on stage, >1 gone. */
  local: number;
}

const ALCHE_SERVICE_ITEMS_START = 0.1;
const ALCHE_SERVICE_ITEMS_END = 0.97;

/** Reference 16.25-16.6s: the room is seen through the rainbow portal, zoomed
 * in and colour-split, then settles. 0 = portal close-up, 1 = settled. */
export function deriveServiceEntry(progress: number) {
  return smoothstep(remapRange(progress, 0, 0.12));
}

/** Reference 17.0-19.0s: each service panel slides in from the right edge,
 * holds centre-left with its copy column to the right, then exits left while
 * the next one enters. */
export function deriveServicePanelPose(progress: number, index: number, count: number): AlcheServicePanelPose {
  const slot = (ALCHE_SERVICE_ITEMS_END - ALCHE_SERVICE_ITEMS_START) / Math.max(count, 1);
  const local = (progress - ALCHE_SERVICE_ITEMS_START) / slot - index;
  const enter = smoothstep(remapRange(local, -0.15, 0.35));
  const exit = index === count - 1 ? 0 : smoothstep(remapRange(local, 0.8, 1.3));
  const x = 52 * (1 - enter) - 78 * exit;
  const rotateY = -26 * (1 - enter) + 12 * enter + 18 * exit;
  const opacity = smoothstep(remapRange(local, -0.2, 0.05)) * (1 - smoothstep(remapRange(local, 1.1, 1.3)));
  const reveal = smoothstep(remapRange(local, 0.12, 0.5)) * (1 - exit);
  return { x, rotateY, opacity, reveal, local };
}

export function deriveServiceActiveIndex(progress: number, count: number) {
  const slot = (ALCHE_SERVICE_ITEMS_END - ALCHE_SERVICE_ITEMS_START) / Math.max(count, 1);
  const raw = Math.floor((progress - ALCHE_SERVICE_ITEMS_START) / slot + 0.2);
  return Math.max(0, Math.min(count - 1, raw));
}

/** Reference 18.9-20.2s stellla stage, driven by stelllaProgress:
 * - entry: the last service panel ("stellla Platform") grows from its hold
 *   rect to full-bleed;
 * - copy: frame, wordmark, sparkle and text arrive once the media fills;
 * - exit: the whole stage scrolls up like a page block and finishes exactly
 *   when the endmark triggers (outroApproachProgress 0.98), so no black gap. */
export function deriveStelllaStage(progress: number, outroApproachProgress: number) {
  return {
    entry: smoothstep(remapRange(progress, 0, 0.22)),
    copy: smoothstep(remapRange(progress, 0.16, 0.34)),
    exit: smoothstep(remapRange(outroApproachProgress, 0, 0.98)),
  };
}

export function deriveWorksWordHandoff(activeSection: AlcheTopSectionId, sectionProgress: number) {
  const progress = clamp01(sectionProgress);

  switch (activeSection) {
    case "loading":
    case "kv":
      return 0;
    case "works_intro":
      return progress * 0.45;
    case "works":
      return 0.45 + progress * 0.55;
    case "works_cards":
      return 1;
    default:
      return 1;
  }
}

export function deriveTopSceneState(
  activeSection: AlcheTopSectionId,
  sectionProgress: number,
  worksCardsProgress: number,
  introProgress: number,
  missionTurnProgress: number,
  visionCoverProgress: number,
  heroShotId: AlcheHeroShotId | null,
  workCount: number,
  serviceCount: number,
): AlcheTopSceneState {
  const runtimeSection = normalizeTopRuntimeSection(activeSection);
  const progress = clamp01(sectionProgress);
  // Cards axis spans [0, cyclesTotal]; [0,1] is the legacy single-pair cycle.
  const cardsProgress = Math.min(Math.max(worksCardsProgress, 0), ALCHE_TOP_WORKS_CARDS.cyclesTotal);
  const worksIntro: AlcheWorksIntroSceneState =
    runtimeSection === "works_intro"
      ? deriveWorksIntroSceneState(progress)
      : { visible: 0, handoffMix: 0, sweepMix: 0, alcheFade: 0 };
  const works: AlcheWorksSceneState =
    runtimeSection === "works"
      ? deriveWorksSceneState(progress, workCount)
      : { visible: 0, cardMix: 0, browseProgress: 0, travel: 0, activeIndex: 0, activeBlend: 0 };
  const worksOutro: AlcheWorksOutroSceneState =
    runtimeSection === "works_outro"
      ? deriveWorksOutroSceneState(progress)
      : { visible: 0, clearMix: 0, residualMix: 0 };
  const missionIn: AlcheMissionInSceneState =
    runtimeSection === "mission_in"
      ? deriveMissionInSceneState(progress)
      : { visible: 0, flattenMix: 0, whiteMix: 0, emblemMix: 0 };
  const mission: AlcheMissionSceneState =
    runtimeSection === "mission"
      ? deriveMissionSceneState(progress)
      : { visible: 0, whiteMix: 0, emblemMix: 0 };
  const vision: AlcheVisionSceneState =
    runtimeSection === "vision"
      ? deriveVisionSceneState(progress)
      : { visible: 0, lineMix: 0, densityMix: 0, drainMix: 0 };
  const visionOut: AlcheVisionOutSceneState =
    runtimeSection === "vision_out"
      ? deriveVisionOutSceneState(progress)
      : { visible: 0, drainMix: 0 };
  const serviceIn: AlcheServiceInSceneState =
    runtimeSection === "service_in"
      ? deriveServiceInSceneState(progress)
      : { visible: 0, entryMix: 0, densityMix: 0 };
  const service: AlcheServiceSceneState =
    runtimeSection === "service"
      ? deriveServiceSceneState(progress, serviceCount)
      : { visible: 0, densityMix: 0, browse: 0, activeIndex: 0 };
  const stellla: AlcheStelllaSceneState =
    runtimeSection === "stellla"
      ? deriveStelllaSceneState(progress)
      : { visible: 0, architectureMix: 0, editorialMix: 0, frameMix: 0 };
  const outro: AlcheOutroSceneState =
    runtimeSection === "outro"
      ? deriveOutroSceneState(progress)
      : { visible: 0, stageMix: 0, wordmarkMix: 0, footerMix: 0 };

  let camera = ALCHE_TOP_CAMERA_STATES[runtimeSection];

  if (
    runtimeSection === "works_intro" ||
    runtimeSection === "works" ||
    runtimeSection === "works_cards" ||
    runtimeSection === "works_outro" ||
    runtimeSection === "mission_in"
  ) {
    camera = ALCHE_TOP_CAMERA_STATES.kv;
  } else {
    switch (runtimeSection) {
      case "loading":
        camera = lerpCameraState(
          ALCHE_TOP_CAMERA_STATES.loading,
          ALCHE_TOP_CAMERA_STATES.kv,
          smoothstep(remapRange(introProgress, 0.08, 0.48)),
        );
        break;
      case "vision_out":
        camera = lerpCameraState(ALCHE_TOP_CAMERA_STATES.vision, ALCHE_TOP_CAMERA_STATES.service_in, visionOut.drainMix);
        break;
      case "service_in":
        camera = lerpCameraState(ALCHE_TOP_CAMERA_STATES.vision_out, ALCHE_TOP_CAMERA_STATES.service, serviceIn.entryMix);
        break;
      case "outro":
        camera = lerpCameraState(ALCHE_TOP_CAMERA_STATES.stellla, ALCHE_TOP_CAMERA_STATES.outro, outro.stageMix);
        break;
      default:
        break;
    }
  }

  const kv = deriveKvSceneState(
    runtimeSection === "loading" ? introProgress : Math.max(introProgress, 1),
    runtimeSection === "kv" || runtimeSection === "loading" ? heroShotId : null,
    runtimeSection === "works_intro" ? worksIntro.handoffMix : runtimeSection === "works" ? 1 : 0,
  );
  const missionTurnMix = smoothstep(clamp01(missionTurnProgress));
  const visionCoverMix = smoothstep(clamp01(visionCoverProgress));
  // Keep the rainbow vivid while it floods the screen; darken only at the end.
  const visionBlackMix = smoothstep(remapRange(visionCoverProgress, 0.85, 1.0));

  if (missionTurnMix > 0) {
    kv.prismRotationY =
      ALCHE_TOP_CENTER_MODEL.baseRotationY +
      ALCHE_TOP_CENTER_MODEL.missionTurnStartOffset +
      ALCHE_TOP_CENTER_MODEL.missionTurnRadians * missionTurnMix;
    kv.prismRotationX = ALCHE_TOP_CENTER_MODEL.baseRotationX + ALCHE_TOP_CENTER_MODEL.missionTurnPitch * missionTurnMix;
  }
  if (visionCoverMix > 0) {
    // Reference cover: the logo morphs toward its 90-degree side view while
    // it grows, so the rainbow face swings toward the camera and widens into
    // the slab that floods the screen.
    kv.prismRotationY += (ALCHE_TOP_CENTER_MODEL.coverTurnRadians - ALCHE_TOP_CENTER_MODEL.missionTurnRadians) * smoothstep(visionCoverMix);
  }
  kv.prismRainbowMix = missionTurnMix;
  // Ease-in zoom: reference keeps a slanted slab (~1.6x at 16.0s) and only
  // floods the screen at the end of the cover.
  kv.prismGroupScale = 1 + (ALCHE_TOP_CENTER_MODEL.coverScale - 1) * Math.pow(visionCoverMix, 2.4);
  kv.prismRainbowBlackMix = visionBlackMix;

  if (runtimeSection === "works_intro") {
    kv.wordVisibility *= 1 - worksIntro.alcheFade;
    // Reference 6.0-8.0s: the crystal tumbles a half turn toward the camera
    // (edge-on at the midpoint), swelling then settling upright. A half turn
    // about Y maps the symmetric frame onto itself, so it lands "upright".
    const spin = smoothstep(remapRange(progress, 0.04, 0.92));
    const wobble = Math.sin(Math.PI * spin);
    kv.prismRotationY = ALCHE_TOP_CENTER_MODEL.baseRotationY + Math.PI * spin;
    kv.prismRotationX = ALCHE_TOP_CENTER_MODEL.baseRotationX + 0.3 * wobble;
    kv.prismRotationZ = ALCHE_TOP_CENTER_MODEL.baseRotationZ - 0.24 * wobble;
    kv.prismGroupScale = 1 + 0.42 * wobble;
    kv.wallZebra = smoothstep(remapRange(progress, 0.3, 0.8));
  }

  if (runtimeSection === "works") {
    // Upright after the half turn; zebra wall holds behind the WORKS word and
    // clears as the first card arrives.
    kv.prismRotationY = ALCHE_TOP_CENTER_MODEL.baseRotationY + Math.PI;
    kv.wallZebra = 1 - smoothstep(remapRange(progress, 0.62, 1.0));
  }

  const worksOutroWallFlatten = worksOutro.clearMix * 0.78;
  const missionInWallFlatten = 0.78 + missionIn.flattenMix * 0.22;
  const missionInPanelProgress = 0.42 + missionIn.flattenMix * 0.58;

  if (runtimeSection === "works" || runtimeSection === "works_outro" || runtimeSection === "mission_in") {
    kv.wallVisibility = runtimeSection === "mission_in" ? 1 - missionIn.whiteMix : 1;
    kv.wordVisibility = 0;
    kv.prismVisibility =
      runtimeSection === "works"
        ? 1 - smoothstep(remapRange(progress, 0.6, 0.95))
        : runtimeSection === "works_outro"
          ? // Reference works_outro: the glass A returns front-and-center as the
            // cards clear, instead of fading to a residual ghost.
            Math.min(1, 0.2 + worksOutro.clearMix * 0.8)
          : 1;
    if (runtimeSection === "works_outro") {
      kv.prismGroupScale = 1 + worksOutro.clearMix * 0.38;
    }
    kv.wallFlatten = runtimeSection === "works_outro" ? worksOutroWallFlatten : runtimeSection === "mission_in" ? missionInWallFlatten : 0;
    kv.wallWhiteMix = runtimeSection === "mission_in" ? missionIn.whiteMix * 0.86 : 0;
    kv.visible = runtimeSection === "mission_in" ? 1 - missionIn.whiteMix * 0.64 : 1;
  }

  if (runtimeSection === "works_cards") {
    // Reference: no crystal while the poster cards cycle.
    kv.prismVisibility = 0.04;
  }

  if (runtimeSection === "mission" || runtimeSection === "vision" || runtimeSection === "vision_out" || runtimeSection === "service_in" || runtimeSection === "service" || runtimeSection === "stellla" || runtimeSection === "outro") {
    kv.visible = 0;
    kv.wallVisibility = 0;
    kv.wordVisibility = 0;
    kv.prismVisibility = 0;
    kv.hudVisibility = 0;
  }

  return {
    activeSection: runtimeSection,
    sectionProgress: progress,
    worksCardsProgress: cardsProgress,
    introProgress,
    heroShotId,
    camera,
    kv,
    worksIntro,
    works,
    worksOutro,
    missionIn,
    mission,
    vision,
    visionOut,
    serviceIn,
    service,
    stellla,
    outro,
  };
}
