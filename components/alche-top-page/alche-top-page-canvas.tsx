"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AlcheTopPageScene } from "@/components/alche-top-page/scene/alche-top-page-scene";
import type { AlcheHeroShotId } from "@/lib/alche-hero-lock";
import { ALCHE_HERO_LOCK } from "@/lib/alche-hero-lock";
import type { AlcheWorksCardDebugMode } from "@/lib/alche-works-shotbook";
import {
  deriveMissionTransitionOverlayState,
  deriveTopSceneState,
  deriveWorksWordHandoff,
  type AlcheLayerDebugState,
  type AlchePointerDebugState,
  type AlcheTopSectionId,
} from "@/lib/alche-top-page";

interface AlcheTopPageCanvasProps {
  activeSection: AlcheTopSectionId;
  sectionProgress: number;
  worksCardsProgress: number;
  introProgress: number;
  missionTurnProgress: number;
  visionCoverProgress: number;
  heroShotId: AlcheHeroShotId | null;
  cardDebugMode: AlcheWorksCardDebugMode;
  worksWordHandoff: number;
  reducedMotion: boolean;
  kvWallTexturePath: string;
  worksCardItems: readonly { title: string; imageSrc: string }[];
  workCount: number;
  serviceCount: number;
  canvasEventSource: HTMLElement | null;
  pointerDebugEnabled: boolean;
  renderMode: "full" | "edge-overlay";
}

interface AlcheCanvasCaptureOverride {
  section: AlcheTopSectionId;
  progress: number;
  intro: number;
  missionTurnProgress?: number;
  visionCoverProgress?: number;
  heroShotId: AlcheHeroShotId | null;
}

interface AlchePointerOverride {
  x: number;
  y: number;
}

export function AlcheTopPageCanvas({
  activeSection,
  sectionProgress,
  worksCardsProgress,
  introProgress,
  missionTurnProgress,
  visionCoverProgress,
  heroShotId,
  cardDebugMode,
  worksWordHandoff,
  reducedMotion,
  kvWallTexturePath,
  worksCardItems,
  workCount,
  serviceCount,
  canvasEventSource,
  pointerDebugEnabled,
  renderMode,
}: AlcheTopPageCanvasProps) {
  const captureMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("alcheCapture") === "1";
  const [captureOverride, setCaptureOverride] = useState<AlcheCanvasCaptureOverride | null>(null);
  const [pointerOverride, setPointerOverride] = useState<AlchePointerOverride | null>(null);
  const resolvedActiveSection = captureOverride?.section ?? activeSection;
  const resolvedSectionProgress = captureOverride?.progress ?? sectionProgress;
  const resolvedWorksCardsProgress = captureOverride ? (captureOverride.section === "works_cards" ? captureOverride.progress : 0) : worksCardsProgress;
  const resolvedIntroProgress = captureOverride?.intro ?? introProgress;
  const resolvedMissionTurnProgress = captureOverride?.missionTurnProgress ?? missionTurnProgress;
  const resolvedVisionCoverProgress = captureOverride?.visionCoverProgress ?? visionCoverProgress;
  const resolvedHeroShotId = captureOverride?.heroShotId ?? heroShotId;
  const sceneState = useMemo(
    () =>
      deriveTopSceneState(
        resolvedActiveSection,
        resolvedSectionProgress,
        resolvedWorksCardsProgress,
        resolvedIntroProgress,
        resolvedMissionTurnProgress,
        resolvedVisionCoverProgress,
        resolvedHeroShotId,
        workCount,
        serviceCount,
      ),
    [
      resolvedActiveSection,
      resolvedHeroShotId,
      resolvedIntroProgress,
      resolvedMissionTurnProgress,
      resolvedVisionCoverProgress,
      resolvedSectionProgress,
      resolvedWorksCardsProgress,
      serviceCount,
      workCount,
    ],
  );
  const { missionPanelProgress, missionOutlineOpacity } = deriveMissionTransitionOverlayState(
    sceneState.activeSection,
    sceneState.sectionProgress,
  );
  const sceneReducedMotion = reducedMotion || captureMode;
  const pointerDebugRef = useRef<AlchePointerDebugState>({
    enabled: pointerDebugEnabled,
    prefersReducedMotion: reducedMotion,
    reducedMotion: sceneReducedMotion,
    domPointerClientX: null,
    domPointerClientY: null,
    domPointerInside: false,
    r3fPointerX: 0,
    r3fPointerY: 0,
    modelRotationX: null,
    modelRotationY: null,
    modelRotationZ: null,
  });
  const layerDebugRef = useRef<AlcheLayerDebugState>({
    sceneActiveSection: null,
    missionTurnProgress: null,
    visionCoverProgress: null,
    prismGroupScale: null,
    viewportWidth: null,
    viewportHeight: null,
    cameraPosition: [0, 0, 0],
    cameraTarget: [0, 0, 0],
    wallWorldZ: null,
    wallRotationY: null,
    worksWorldX: null,
    modelWorldZ: null,
    modelScale: null,
    moonflowWorldZ: null,
    worksWorldZ: null,
    worksRotationY: null,
    worksHandoff: null,
    moonflowOpacity: null,
    worksOpacity: null,
    worksDepthTest: null,
    worksDepthWrite: null,
    worksTransparent: null,
    cardsOpacity: null,
    cardsLeadIndex: null,
    cardsLeadOpacity: null,
    cardsSupportOpacity: null,
    card0Opacity: null,
    card1Opacity: null,
    card0WorldX: null,
    card0WorldZ: null,
    card1WorldX: null,
    card1WorldZ: null,
    card0ArcAngle: null,
    card1ArcAngle: null,
    card0FacingError: null,
    card1FacingError: null,
    card0ScreenLeft: null,
    card0ScreenRight: null,
    card0ScreenTop: null,
    card0ScreenBottom: null,
    card1ScreenLeft: null,
    card1ScreenRight: null,
    card1ScreenTop: null,
    card1ScreenBottom: null,
    card0Visible: false,
    card1Visible: false,
    cardsLeadWorldX: null,
    cardsLeadWorldZ: null,
    cardsSupportWorldX: null,
    cardsSupportWorldZ: null,
    worksOutroClearMix: null,
    missionFlattenMix: null,
    missionWhiteMix: null,
    missionEmblemMix: null,
    missionPanelProgress: null,
    missionOutlineOpacity: null,
    kvWallFlatten: null,
    prismFullOpacity: null,
    prismEdgeOpacity: null,
    prismLineOpacity: null,
    prismRefractionCaptureCount: 0,
    prismRefractionTargetWidth: null,
    prismRefractionTargetHeight: null,
    prismRefractionLastCaptureMs: null,
    prismRefractionCaptureMode: "skipped",
    prismRefractionActiveMotion: false,
  });

  pointerDebugRef.current.enabled = pointerDebugEnabled;
  pointerDebugRef.current.reducedMotion = sceneReducedMotion;
  layerDebugRef.current.worksOutroClearMix = sceneState.worksOutro.clearMix;
  layerDebugRef.current.missionFlattenMix = sceneState.missionIn.flattenMix;
  layerDebugRef.current.missionWhiteMix = sceneState.missionIn.whiteMix;
  layerDebugRef.current.missionEmblemMix = sceneState.missionIn.emblemMix;
  layerDebugRef.current.missionPanelProgress = missionPanelProgress;
  layerDebugRef.current.missionOutlineOpacity = missionOutlineOpacity;
  layerDebugRef.current.kvWallFlatten = sceneState.kv.wallFlatten;
  layerDebugRef.current.sceneActiveSection = sceneState.activeSection;
  layerDebugRef.current.missionTurnProgress = resolvedMissionTurnProgress;
  layerDebugRef.current.visionCoverProgress = resolvedVisionCoverProgress;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      pointerDebugRef.current.prefersReducedMotion = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, [pointerDebugRef]);

  useEffect(() => {
    if (renderMode !== "full" || !pointerDebugEnabled || !canvasEventSource) {
      pointerDebugRef.current.domPointerInside = false;
      pointerDebugRef.current.domPointerClientX = null;
      pointerDebugRef.current.domPointerClientY = null;
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerDebugRef.current.domPointerClientX = event.clientX;
      pointerDebugRef.current.domPointerClientY = event.clientY;
      pointerDebugRef.current.domPointerInside = true;
    };

    const handlePointerLeave = () => {
      pointerDebugRef.current.domPointerInside = false;
    };

    canvasEventSource.addEventListener("pointermove", handlePointerMove);
    canvasEventSource.addEventListener("pointerenter", handlePointerMove);
    canvasEventSource.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      canvasEventSource.removeEventListener("pointermove", handlePointerMove);
      canvasEventSource.removeEventListener("pointerenter", handlePointerMove);
      canvasEventSource.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [canvasEventSource, pointerDebugEnabled, pointerDebugRef, renderMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window as typeof window & {
      __setAlcheSceneOverride?: (nextOverride: AlcheCanvasCaptureOverride | null) => void;
      __setAlchePointerOverride?: (nextOverride: AlchePointerOverride | null) => void;
      __clearAlchePointerOverride?: () => void;
      __getAlchePointerDebugState?: () => AlchePointerDebugState;
      __getAlcheLayerDebugState?: () => AlcheLayerDebugState;
      __getAlcheEdgeOverlayLayerDebugState?: () => AlcheLayerDebugState;
    };

    if (renderMode === "edge-overlay") {
      host.__getAlcheEdgeOverlayLayerDebugState = () => ({ ...layerDebugRef.current });

      return () => {
        delete host.__getAlcheEdgeOverlayLayerDebugState;
      };
    }

    host.__setAlcheSceneOverride = (nextOverride) => {
      setCaptureOverride(nextOverride);
    };

    host.__setAlchePointerOverride = (nextOverride) => {
      setPointerOverride(nextOverride);
    };

    host.__clearAlchePointerOverride = () => {
      setPointerOverride(null);
    };

    host.__getAlchePointerDebugState = () => ({ ...pointerDebugRef.current });
    host.__getAlcheLayerDebugState = () => {
      const edgeState = host.__getAlcheEdgeOverlayLayerDebugState?.();
      return {
        ...layerDebugRef.current,
        prismEdgeOpacity: edgeState?.prismEdgeOpacity ?? layerDebugRef.current.prismEdgeOpacity,
        prismLineOpacity: edgeState?.prismLineOpacity ?? layerDebugRef.current.prismLineOpacity,
        // During mission/vision the visible crystal is the edge-overlay one
        // (the full-render group is hidden), so report its scale then.
        prismGroupScale: layerDebugRef.current.prismGroupScale ?? edgeState?.prismGroupScale ?? null,
      };
    };

    return () => {
      delete host.__setAlcheSceneOverride;
      delete host.__setAlchePointerOverride;
      delete host.__clearAlchePointerOverride;
      delete host.__getAlchePointerDebugState;
      delete host.__getAlcheLayerDebugState;
    };
  }, [layerDebugRef, pointerDebugRef, renderMode]);

  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: ALCHE_HERO_LOCK.camera.position, fov: ALCHE_HERO_LOCK.camera.fov }}
      gl={{ antialias: true, alpha: renderMode === "edge-overlay", powerPreference: "high-performance" }}
      eventSource={renderMode === "full" ? canvasEventSource ?? undefined : undefined}
      eventPrefix="client"
      onCreated={({ gl }) => {
        gl.toneMapping = renderMode === "edge-overlay" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = renderMode === "edge-overlay" ? 1 : 1.04;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor("#000000", renderMode === "edge-overlay" ? 0 : 1);
      }}
    >
      <AlcheTopPageScene
        sceneState={sceneState}
        reducedMotion={sceneReducedMotion}
        kvWallTexturePath={kvWallTexturePath}
        worksCardItems={worksCardItems}
        cardDebugMode={cardDebugMode}
        captureMode={captureMode}
        worksWordHandoff={captureOverride ? deriveWorksWordHandoff(captureOverride.section, captureOverride.progress) : worksWordHandoff}
        pointerOverride={pointerOverride}
        pointerDebugRef={pointerDebugRef}
        layerDebugRef={layerDebugRef}
        renderMode={renderMode}
      />
    </Canvas>
  );
}
