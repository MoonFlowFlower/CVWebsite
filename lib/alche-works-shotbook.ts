import shotbookJson from "@/data/alche-works-shotbook.json";

export const ALCHE_WORKS_CARD_POSE_IDS = [
  "lead-center",
  "queue-right-lower-offscreen",
  "queue-right-lower",
  "support-left-upper",
  "exit-left-offscreen",
] as const;

export type AlcheWorksCardPoseId = (typeof ALCHE_WORKS_CARD_POSE_IDS)[number];

export const ALCHE_WORKS_CARD_DEBUG_MODES = ["identity", "poster"] as const;

export type AlcheWorksCardDebugMode = (typeof ALCHE_WORKS_CARD_DEBUG_MODES)[number];

export interface AlcheWorksCardPoseDefinition {
  angle: number;
  radiusOffset: number;
  yOffset: number;
  scale: number;
}

const ALCHE_WORKS_DESKTOP_ASPECT_BASE = 1440 / 1080;
const ALCHE_WORKS_DESKTOP_ASPECT_TARGET = 2560 / 1600;
const ALCHE_WORKS_DESKTOP_MIN_WIDTH = 1200;
const ALCHE_WORKS_DESKTOP_MIN_HEIGHT = 700;

export const ALCHE_WORKS_SHOT_IDS = [
  "works-out",
  "cards-a-entry",
  "cards-a-center",
  "cards-b-queue",
  "cards-handoff-mid",
  "cards-settled",
  "works-outro-entry",
  "works-outro-flatten",
  "mission-in-panel",
  "mission-in-settled",
] as const;

export type AlcheWorksShotId = (typeof ALCHE_WORKS_SHOT_IDS)[number];

export interface AlcheWorksShotCardDefinition {
  visible: boolean;
  poseId: AlcheWorksCardPoseId | null;
}

export interface AlcheWorksShotReference {
  videoTime: number;
  taskStillPath?: string;
}

export interface AlcheWorksShotDefinition {
  id: AlcheWorksShotId;
  section: "works" | "works_cards" | "works_outro" | "mission_in";
  progress: number;
  intro: number;
  card0: AlcheWorksShotCardDefinition;
  card1: AlcheWorksShotCardDefinition;
  reference: AlcheWorksShotReference;
}

export type AlcheWorksCardsShotDefinition = AlcheWorksShotDefinition & { section: "works_cards" };

export interface AlcheWorksCardsSegment {
  phase: "entry" | "queue" | "handoff" | "settled";
  mix: number;
  entryShot: AlcheWorksCardsShotDefinition;
  centerShot: AlcheWorksCardsShotDefinition;
  queueShot: AlcheWorksCardsShotDefinition;
  handoffShot: AlcheWorksCardsShotDefinition;
  settledShot: AlcheWorksCardsShotDefinition;
}

interface AlcheWorksShotbookData {
  poses: Record<AlcheWorksCardPoseId, AlcheWorksCardPoseDefinition>;
  shots: readonly AlcheWorksShotDefinition[];
}

const shotbook = shotbookJson as AlcheWorksShotbookData;

export const ALCHE_WORKS_CARD_POSES = shotbook.poses;
export const ALCHE_WORKS_SHOTS = shotbook.shots;
export const ALCHE_WORKS_SHOTS_BY_ID = new Map(ALCHE_WORKS_SHOTS.map((shot) => [shot.id, shot] as const));
export const ALCHE_WORKS_CAPTURE_SHOTS = ALCHE_WORKS_SHOTS;
export const ALCHE_WORKS_CARDS_SHOTS = ALCHE_WORKS_SHOTS.filter(
  (shot): shot is AlcheWorksCardsShotDefinition => shot.section === "works_cards",
);

export function readAlcheWorksShotId(value: string | null | undefined): AlcheWorksShotId | null {
  if (!value) return null;
  return ALCHE_WORKS_SHOT_IDS.find((shotId) => shotId === value) ?? null;
}

export function readAlcheWorksCardDebugMode(value: string | null | undefined): AlcheWorksCardDebugMode | null {
  if (!value) return null;
  return ALCHE_WORKS_CARD_DEBUG_MODES.find((mode) => mode === value) ?? null;
}

export function getDefaultAlcheWorksCardDebugMode(
  params: Pick<URLSearchParams, "get"> | null,
  _hostname?: string | null,
): AlcheWorksCardDebugMode {
  // Posters are the reference-accurate default everywhere (including localhost
  // and GitHub Pages); identity letters stay available for capture/validator
  // URLs and via alcheCardDebug=identity.
  if (!params) return "poster";
  const captureMode = params.get("alcheCapture") === "1";
  const shotId = readAlcheWorksShotId(params.get("alcheShot"));
  return captureMode || shotId ? "identity" : "poster";
}

export function resolveAlcheWorksCardDebugMode(
  params: Pick<URLSearchParams, "get"> | null,
  hostname?: string | null,
): AlcheWorksCardDebugMode {
  if (!params) return "poster";
  return readAlcheWorksCardDebugMode(params.get("alcheCardDebug")) ?? getDefaultAlcheWorksCardDebugMode(params, hostname);
}

export function getAlcheWorksShotDefinition(shotId: AlcheWorksShotId) {
  return ALCHE_WORKS_SHOTS_BY_ID.get(shotId) ?? null;
}

export function getAlcheWorksCardPoseDefinition(poseId: AlcheWorksCardPoseId) {
  return ALCHE_WORKS_CARD_POSES[poseId];
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function lerp(start: number, end: number, mix: number) {
  return start + (end - start) * mix;
}

export function getAlcheWorksDesktopAspectCompensation(viewportWidth: number, viewportHeight: number) {
  if (viewportWidth < ALCHE_WORKS_DESKTOP_MIN_WIDTH || viewportHeight < ALCHE_WORKS_DESKTOP_MIN_HEIGHT) {
    return 0;
  }

  const aspect = viewportWidth / Math.max(viewportHeight, 1);
  return clamp01(
    (aspect - ALCHE_WORKS_DESKTOP_ASPECT_BASE) /
      Math.max(ALCHE_WORKS_DESKTOP_ASPECT_TARGET - ALCHE_WORKS_DESKTOP_ASPECT_BASE, 0.0001),
  );
}

// Card poses were tuned at ~1.9:1 (1600x842, lead card ~56% of the width).
// The camera FOV is vertical, so on narrower screens the same world-size card
// fills more of the width (81% at 4:3). Scale the whole carousel down below
// this aspect so the framing holds; wider screens are unchanged.
const ALCHE_WORKS_CARD_TUNED_ASPECT = 1.9;

export function getCompensatedAlcheWorksCardPoseDefinition(
  poseId: AlcheWorksCardPoseId,
  viewportWidth: number,
  viewportHeight: number,
): AlcheWorksCardPoseDefinition {
  const pose = getAspectCompensatedAlcheWorksCardPoseDefinition(poseId, viewportWidth, viewportHeight);
  const aspect = viewportWidth / Math.max(viewportHeight, 1);
  const narrowScale = Math.min(1, aspect / ALCHE_WORKS_CARD_TUNED_ASPECT);
  if (narrowScale >= 1) return pose;
  // Side lanes are half offscreen, so full scaling made them too thin; they
  // shrink half as much as the lead.
  const poseScale = poseId === "lead-center" ? narrowScale : 1 - (1 - narrowScale) * 0.5;
  return { ...pose, scale: pose.scale * poseScale };
}

function getAspectCompensatedAlcheWorksCardPoseDefinition(
  poseId: AlcheWorksCardPoseId,
  viewportWidth: number,
  viewportHeight: number,
): AlcheWorksCardPoseDefinition {
  const pose = getAlcheWorksCardPoseDefinition(poseId);
  const compensation = getAlcheWorksDesktopAspectCompensation(viewportWidth, viewportHeight);
  if (compensation <= 0) return pose;

  if (poseId === "support-left-upper") {
    return {
      ...pose,
      // Keep the support card's facing shallow on wide displays; the previous
      // -0.3 swing turned it into a near-edge-on sliver (reference reads
      // roughly 35-40 degrees).
      angle: pose.angle + lerp(0, -0.14, compensation),
      radiusOffset: pose.radiusOffset + lerp(0, 0.18, compensation),
    };
  }

  if (poseId === "exit-left-offscreen") {
    return {
      ...pose,
      angle: pose.angle + lerp(0, -0.16, compensation),
      radiusOffset: pose.radiusOffset + lerp(0, 0.18, compensation),
    };
  }

  if (poseId === "queue-right-lower") {
    return {
      ...pose,
      // Wider viewports push the queue card further toward the right edge so
      // it keeps the reference "half offscreen" read instead of floating
      // inboard on 16:9+ displays.
      angle: pose.angle + lerp(0, 0.2, compensation),
      radiusOffset: pose.radiusOffset + lerp(0, 0.12, compensation),
    };
  }

  if (poseId === "queue-right-lower-offscreen") {
    return {
      ...pose,
      angle: pose.angle + lerp(0, 0.24, compensation),
      radiusOffset: pose.radiusOffset + lerp(0, 0.12, compensation),
    };
  }

  return pose;
}

export function getAdjacentAlcheWorksShotId(shotId: AlcheWorksShotId, direction: -1 | 1) {
  const currentIndex = ALCHE_WORKS_SHOT_IDS.indexOf(shotId);
  if (currentIndex < 0) return null;
  return ALCHE_WORKS_SHOT_IDS[currentIndex + direction] ?? null;
}

export function getAlcheWorksShotOverride(shotId: AlcheWorksShotId) {
  const shot = getAlcheWorksShotDefinition(shotId);
  if (!shot) return null;
  return {
    shotId,
    section: shot.section,
    progress: shot.progress,
    intro: shot.intro,
  };
}

export function getAlcheWorksCardsSegment(progress: number): AlcheWorksCardsSegment {
  const [entryShot, centerShot, queueShot, handoffShot, settledShot] = ALCHE_WORKS_CARDS_SHOTS;
  if (!entryShot || !centerShot || !queueShot || !handoffShot || !settledShot) {
    throw new Error("ALCHE works shotbook is missing required works_cards shots.");
  }

  if (progress <= entryShot.progress) {
    return {
      phase: "entry" as const,
      mix: 0,
      entryShot,
      centerShot,
      queueShot,
      handoffShot,
      settledShot,
    };
  }

  if (progress <= centerShot.progress) {
    return {
      phase: "entry" as const,
      mix: (progress - entryShot.progress) / Math.max(centerShot.progress - entryShot.progress, 0.0001),
      entryShot,
      centerShot,
      queueShot,
      handoffShot,
      settledShot,
    };
  }

  if (progress <= queueShot.progress) {
    return {
      phase: "queue" as const,
      mix: (progress - centerShot.progress) / Math.max(queueShot.progress - centerShot.progress, 0.0001),
      entryShot,
      centerShot,
      queueShot,
      handoffShot,
      settledShot,
    };
  }

  if (progress < settledShot.progress) {
    return {
      phase: "handoff" as const,
      mix: (progress - queueShot.progress) / Math.max(settledShot.progress - queueShot.progress, 0.0001),
      entryShot,
      centerShot,
      queueShot,
      handoffShot,
      settledShot,
    };
  }

  return {
    phase: "settled" as const,
    mix: 1,
    entryShot,
    centerShot,
    queueShot,
    handoffShot,
    settledShot,
  };
}
