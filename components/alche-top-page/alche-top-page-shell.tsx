"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

import {
  ALCHE_ENDMARK_DEBUG_STAGES,
  AlcheEndmarkOverlay,
  type AlcheEndmarkDebugStage,
  type AlcheEndmarkDebugState,
} from "@/components/alche-top-page/alche-endmark-overlay";
import { alcheTopPageCopy } from "@/data/alche-top-page";
import type { ContactLink, StudioDossierAsset } from "@/data/profile";
import {
  ALCHE_TOP_GROUP_IDS,
  ALCHE_TOP_MISSION_PANEL_LAYOUT,
  type AlchePointerDebugState,
  ALCHE_TOP_SCROLL_TRACK_SECTIONS,
  ALCHE_TOP_SECTION_IDS,
  ALCHE_TOP_SECTIONS,
  ALCHE_TOP_WORKS_CARDS,
  deriveMissionTransitionOverlayState,
  normalizeTopRuntimeSection,
  type AlcheScrollableSectionId,
  type AlcheTopSectionId,
} from "@/lib/alche-top-page";
import { readAlcheHeroShotId, type AlcheHeroShotId } from "@/lib/alche-hero-lock";
import {
  ALCHE_WORKS_CAPTURE_SHOTS,
  getAlcheWorksCardsSegment,
  getDefaultAlcheWorksCardDebugMode,
  getAdjacentAlcheWorksShotId,
  getAlcheWorksShotOverride,
  readAlcheWorksShotId,
  resolveAlcheWorksCardDebugMode,
  type AlcheWorksCardDebugMode,
  type AlcheWorksShotId,
} from "@/lib/alche-works-shotbook";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { SITE, assetPath } from "@/lib/site";
import { useTopPageScroll } from "@/components/alche-top-page/use-top-page-scroll";

import styles from "@/components/alche-top-page/alche-top-page-shell.module.scss";

const AlcheTopPageCanvas = dynamic(
  () => import("@/components/alche-top-page/alche-top-page-canvas").then((module) => module.AlcheTopPageCanvas),
  { ssr: false },
);

interface AlcheTopPageShellProps {
  locale: Locale;
  contacts: ContactLink[];
  dossier: StudioDossierAsset;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface AlcheShellDebugOverride {
  section: AlcheTopSectionId;
  progress: number;
  intro: number;
  missionTurnProgress?: number;
  visionCoverProgress?: number;
  heroShotId: AlcheHeroShotId | null;
  shotId: AlcheWorksShotId | null;
}

function createShellDebugOverrideFromShot(shotId: AlcheWorksShotId, heroShotId: AlcheHeroShotId | null): AlcheShellDebugOverride | null {
  const shotOverride = getAlcheWorksShotOverride(shotId);
  if (!shotOverride) return null;

  return {
    ...shotOverride,
    section: normalizeTopRuntimeSection(shotOverride.section),
    missionTurnProgress: 0,
    visionCoverProgress: 0,
    heroShotId,
  };
}

function readShellDebugOverride(params: Pick<URLSearchParams, "get"> | null): AlcheShellDebugOverride | null {
  if (!params) return null;
  const shotId = readAlcheWorksShotId(params.get("alcheShot"));
  const heroShotId = readAlcheHeroShotId(params.get("alcheHeroShot"));
  if (shotId) {
    return createShellDebugOverrideFromShot(shotId, heroShotId);
  }

  const section = params.get("alcheSection");
  if (!section || !ALCHE_TOP_SECTION_IDS.includes(section as AlcheTopSectionId)) return null;
  const normalizedSection = normalizeTopRuntimeSection(section as AlcheTopSectionId);

  return {
    shotId: null,
    section: normalizedSection,
    progress: Number(params.get("alcheProgress") ?? (normalizedSection === "loading" ? "0" : "1")),
    intro: Number(params.get("alcheIntro") ?? (normalizedSection === "loading" ? "0.2" : "1")),
    missionTurnProgress:
      params.get("alcheMissionTurnProgress") === null ? undefined : Number(params.get("alcheMissionTurnProgress")),
    visionCoverProgress:
      params.get("alcheVisionCoverProgress") === null ? undefined : Number(params.get("alcheVisionCoverProgress")),
    heroShotId,
  };
}

function writeShellDebugOverrideToLocation(nextOverride: AlcheShellDebugOverride | null) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const normalizedOverride = nextOverride
    ? {
        ...nextOverride,
        section: normalizeTopRuntimeSection(nextOverride.section),
      }
    : null;

  if (!normalizedOverride) {
    url.searchParams.delete("alcheShot");
    url.searchParams.delete("alcheSection");
    url.searchParams.delete("alcheProgress");
    url.searchParams.delete("alcheIntro");
    url.searchParams.delete("alcheMissionTurnProgress");
    url.searchParams.delete("alcheVisionCoverProgress");
    url.searchParams.delete("alcheHeroShot");
  } else {
    if (normalizedOverride.shotId) {
      url.searchParams.set("alcheShot", normalizedOverride.shotId);
      url.searchParams.delete("alcheSection");
      url.searchParams.delete("alcheProgress");
      url.searchParams.delete("alcheIntro");
    } else {
      url.searchParams.delete("alcheShot");
      url.searchParams.set("alcheSection", normalizedOverride.section);
      url.searchParams.set("alcheProgress", String(normalizedOverride.progress));
      url.searchParams.set("alcheIntro", String(normalizedOverride.intro));
    }

    if (normalizedOverride.heroShotId) {
      url.searchParams.set("alcheHeroShot", normalizedOverride.heroShotId);
    } else {
      url.searchParams.delete("alcheHeroShot");
    }

    if (normalizedOverride.missionTurnProgress === undefined) {
      url.searchParams.delete("alcheMissionTurnProgress");
    } else {
      url.searchParams.set("alcheMissionTurnProgress", String(normalizedOverride.missionTurnProgress));
    }

    if (normalizedOverride.visionCoverProgress === undefined) {
      url.searchParams.delete("alcheVisionCoverProgress");
    } else {
      url.searchParams.set("alcheVisionCoverProgress", String(normalizedOverride.visionCoverProgress));
    }
  }

  window.history.replaceState(window.history.state, "", url.toString());
}

function writeAlcheCardDebugModeToLocation(nextMode: AlcheWorksCardDebugMode) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const defaultMode = getDefaultAlcheWorksCardDebugMode(url.searchParams, url.hostname);
  if (nextMode === defaultMode) {
    url.searchParams.delete("alcheCardDebug");
  } else {
    url.searchParams.set("alcheCardDebug", nextMode);
  }

  window.history.replaceState(window.history.state, "", url.toString());
}

function readEndmarkDebugStage(params: Pick<URLSearchParams, "get"> | null): AlcheEndmarkDebugStage | null {
  if (!params) return null;
  const stage = params.get("alcheEndmarkStage");
  if (!stage) return null;
  return ALCHE_ENDMARK_DEBUG_STAGES.includes(stage as AlcheEndmarkDebugStage)
    ? (stage as AlcheEndmarkDebugStage)
    : null;
}

function splitCopyIntoLines(text: string, maxLines: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (maxLines <= 1) return [trimmed];

  const hasSpaces = trimmed.includes(" ");
  if (hasSpaces) {
    const words = trimmed.split(/\s+/);
    if (words.length <= maxLines) return words.length <= 1 ? [trimmed] : [trimmed];
    const perLine = Math.ceil(words.length / maxLines);
    const lines: string[] = [];
    for (let index = 0; index < words.length; index += perLine) {
      lines.push(words.slice(index, index + perLine).join(" "));
    }
    return lines;
  }

  const perLine = Math.ceil(trimmed.length / maxLines);
  const lines: string[] = [];
  for (let index = 0; index < trimmed.length; index += perLine) {
    lines.push(trimmed.slice(index, index + perLine));
  }
  return lines;
}

function readEndmarkTimeScale(params: Pick<URLSearchParams, "get"> | null) {
  if (!params) return 1;
  const rawValue = params.get("alcheEndmarkTimeScale");
  if (!rawValue) return 1;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 0.1), 40);
}

export function AlcheTopPageShell({ locale, contacts }: AlcheTopPageShellProps) {
  const copy = alcheTopPageCopy[locale];
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [canvasEventSource, setCanvasEventSource] = useState<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<AlcheScrollableSectionId, HTMLElement | null>>({
    kv: null,
    works_intro: null,
    works: null,
    works_cards: null,
    works_outro: null,
    mission_in: null,
    mission: null,
    vision: null,
    vision_out: null,
    service_in: null,
    service: null,
    stellla: null,
    outro: null,
  });
  const [canRenderLive, setCanRenderLive] = useState(true);
  const [captureMode, setCaptureMode] = useState(false);
  const [pointerDebugEnabled, setPointerDebugEnabled] = useState(false);
  const [pointerDebugState, setPointerDebugState] = useState<AlchePointerDebugState | null>(null);
  const [endmarkDebugState, setEndmarkDebugState] = useState<AlcheEndmarkDebugState>({
    stage: "idle",
    ready: false,
    visible: false,
    triggerActive: false,
    debugStage: null,
    overlayAlpha: 0,
    bgGlowAlpha: 0,
    gridAlpha: 0,
    guidePersistentAlpha: 0,
    guideFadeAlpha: 0,
    outlineAlpha: 0,
    fillAlpha: 0,
    fillRevealWidth: 0,
  });
  const [debugOverrideVersion, setDebugOverrideVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);
  const {
    reducedMotion,
    activeSection,
    trackedSection,
    sectionProgress,
    worksCardsProgress,
    introProgress,
    missionTurnProgress,
    visionCoverProgress,
    serviceProgress,
    stelllaProgress,
    outroApproachProgress,
    endmarkFooterProgress,
    heroShotId,
    worksWordHandoff,
    scrollToSection,
  } =
    useTopPageScroll({
      sectionRefs,
    });
  // Read window-derived state only after hydration so the first client render
  // matches SSR output exactly. A mismatch here crashes hydration, remounts the
  // tree, and can leave the R3F canvases holding force-lost WebGL contexts.
  const runtimeSearchParams = hydrated ? new URLSearchParams(window.location.search) : null;
  const debugOverride = readShellDebugOverride(runtimeSearchParams);
  const endmarkDebugStage = readEndmarkDebugStage(runtimeSearchParams);
  const endmarkTimeScale = readEndmarkTimeScale(runtimeSearchParams);
  const endmarkDisabled = runtimeSearchParams?.get("alcheDisableEndmark") === "1";
  const debugUiHidden = runtimeSearchParams?.get("alcheHideDebugUi") === "1";
  const runtimeHostname = hydrated ? window.location.hostname : null;
  const currentCardDebugMode = resolveAlcheWorksCardDebugMode(runtimeSearchParams, runtimeHostname);
  const currentSectionProgress = debugOverride?.progress ?? sectionProgress;
  const currentWorksCardsProgress = debugOverride ? (debugOverride.section === "works_cards" ? debugOverride.progress : 0) : worksCardsProgress;
  const currentIntroProgress = debugOverride?.intro ?? introProgress;
  const currentHeroShotId = debugOverride?.heroShotId ?? heroShotId;
  const kvWallTexturePath = assetPath("/alche-top-page/kv/hero-wall-grid-white.png");
  const worksCardItems = copy.works.items.slice(0, ALCHE_TOP_WORKS_CARDS.queueCount).map((item) => ({
    title: item.title,
    imageSrc: item.imageSrc,
  }));
  const introSettled = currentIntroProgress > 0.995 || captureMode;
  const baseTrackedSection =
    debugOverride?.section === "loading" ? "kv" : ((debugOverride?.section as AlcheScrollableSectionId | undefined) ?? trackedSection ?? "kv");
  const currentActiveSection = normalizeTopRuntimeSection(
    debugOverride?.section ?? (introSettled ? baseTrackedSection : activeSection),
  );
  const currentTrackedSection = currentActiveSection === "loading" ? "kv" : baseTrackedSection;
  const currentShotId = debugOverride?.shotId ?? null;
  const endmarkBlueprintPath = assetPath("/alche-top-page/endmark/alche-wordmark-blueprint.svg");
  const missionGridTexturePath = assetPath("/alche-top-page/mission/mission-grid-tile.png");
  const endmarkTriggerActive = !endmarkDisabled && outroApproachProgress >= 0.98;
  const visibleEndmarkFooterProgress = endmarkDebugState.stage === "settled" ? endmarkFooterProgress : 0;
  const endmarkFooterVisible = visibleEndmarkFooterProgress > 0.01;
  const showShotSelector = !debugUiHidden && !captureMode && currentShotId !== null;
  const showCardDebugToggle =
    !debugUiHidden && !captureMode && (runtimeHostname === "localhost" || runtimeHostname === "127.0.0.1" || currentShotId !== null);
  const { missionPanelProgress } = deriveMissionTransitionOverlayState(currentActiveSection, currentSectionProgress);
  const missionPanelVisible = missionPanelProgress > 0.001;
  const activeGroupId = ALCHE_TOP_SECTIONS.find((section) => section.id === currentTrackedSection)?.groupId ?? null;
  const newsRailVisible = introSettled && currentActiveSection === "kv" && !endmarkFooterVisible;
  const cardsSegment = getAlcheWorksCardsSegment(Math.min(currentWorksCardsProgress, 1));
  const cardsCycleIndex = Math.max(
    0,
    Math.min(Math.floor(currentWorksCardsProgress), ALCHE_TOP_WORKS_CARDS.cyclesTotal - 1),
  );
  const cardsCycleU = Math.min(Math.max(currentWorksCardsProgress - cardsCycleIndex, 0), 1);
  const cardsCaptionIndex =
    currentWorksCardsProgress <= 1
      ? cardsSegment.phase === "entry" || cardsSegment.phase === "queue"
        ? 0
        : cardsSegment.phase === "handoff" && cardsSegment.mix < 0.5
          ? 0
          : 1
      : cardsCycleU >= (ALCHE_TOP_WORKS_CARDS.extraCycleQueueEnd + ALCHE_TOP_WORKS_CARDS.extraCycleLeadEnd) / 2
        ? cardsCycleIndex + 1
        : cardsCycleIndex;
  const worksCaptionVisible =
    currentActiveSection === "works_cards" && currentWorksCardsProgress > 0.055 && !endmarkFooterVisible;
  const worksCaptionItem = copy.works.items[Math.min(cardsCaptionIndex, copy.works.items.length - 1)];
  const worksMoreVisible = worksCaptionVisible;
  const missionCopyVisible =
    (currentActiveSection === "mission" || (missionPanelProgress >= 0.96 && missionTurnProgress < 0.42)) &&
    !endmarkFooterVisible;
  const visionCopyVisible =
    (currentActiveSection === "vision" || missionTurnProgress > 0.72) &&
    visionCoverProgress < 0.5 &&
    !endmarkFooterVisible;
  const missionTitleLines = splitCopyIntoLines(copy.mission.title, 3);
  const visionTitleLines = splitCopyIntoLines(copy.vision.title, 2);
  const contactHref = contacts.find((contact) => contact.key === "email")?.href || null;
  const githubHref = contacts.find((contact) => contact.key === "github")?.href || null;
  const footerScrollTargets: Record<string, AlcheScrollableSectionId> = {
    Top: "kv",
    News: "kv",
    Works: "works",
    stellla: "stellla",
    Contact: "outro",
  };
  const footerExternalTargets: Record<string, string | null> = {
    GitHub: githubHref,
    Email: contactHref,
  };
  const servicePanelVisible = serviceProgress > 0.02 && serviceProgress < 0.97 && !endmarkFooterVisible;
  const stelllaPanelVisible = stelllaProgress > 0.06 && outroApproachProgress < 0.5 && !endmarkFooterVisible;
  const missionLightPhase =
    missionPanelProgress > 0.6 && serviceProgress < 0.08 && visionCoverProgress < 0.72 && !endmarkTriggerActive;
  // stellla is a dark stage in the reference; only the mission paper phase flips the shell light.
  const shellTheme = missionLightPhase ? "light" : "dark";
  const lateBackdropOpacity = Math.min(
    1,
    Math.max(serviceProgress > 0 ? serviceProgress * 6 : 0, 0) + (stelllaProgress > 0 ? 1 : 0),
  );
  const setRootRef = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setCanvasEventSource(node);
  }, []);

  useEffect(() => {
    setCanRenderLive(supportsWebGL());
  }, []);

  const handleShotOverride = useCallback(
    (shotId: AlcheWorksShotId | null) => {
      if (typeof window === "undefined") return;
      const host = window as typeof window & {
        __setAlcheDebugOverride?: (nextOverride: AlcheShellDebugOverride | null) => void;
      };
      const nextOverride = shotId ? createShellDebugOverrideFromShot(shotId, currentHeroShotId) : null;
      host.__setAlcheDebugOverride?.(nextOverride);
    },
    [currentHeroShotId],
  );

  const handleCardDebugModeChange = useCallback((nextMode: AlcheWorksCardDebugMode) => {
    if (typeof window === "undefined") return;
    writeAlcheCardDebugModeToLocation(nextMode);
    flushSync(() => {
      setDebugOverrideVersion((currentValue) => currentValue + 1);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setCaptureMode(params.get("alcheCapture") === "1");
    setPointerDebugEnabled(params.get("alchePointerDebug") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !pointerDebugEnabled) {
      setPointerDebugState(null);
      return;
    }

    const host = window as typeof window & {
      __getAlchePointerDebugState?: () => AlchePointerDebugState | null;
    };

    const interval = window.setInterval(() => {
      setPointerDebugState(host.__getAlchePointerDebugState?.() ?? null);
    }, 120);

    setPointerDebugState(host.__getAlchePointerDebugState?.() ?? null);

    return () => {
      window.clearInterval(interval);
    };
  }, [pointerDebugEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window as typeof window & {
      __setAlcheDebugOverride?: (nextOverride: AlcheShellDebugOverride | null) => void;
      __setAlcheSceneOverride?: (nextOverride: {
        section: AlcheTopSectionId;
        progress: number;
        intro: number;
        missionTurnProgress?: number;
        visionCoverProgress?: number;
        heroShotId: AlcheHeroShotId | null;
      } | null) => void;
    };

    host.__setAlcheDebugOverride = (nextOverride) => {
      const normalizedOverride = nextOverride
        ? {
            ...nextOverride,
            section: normalizeTopRuntimeSection(nextOverride.section),
          }
        : null;

      writeShellDebugOverrideToLocation(normalizedOverride);

      flushSync(() => {
        setDebugOverrideVersion((currentValue) => currentValue + 1);
      });
      host.__setAlcheSceneOverride?.(
        normalizedOverride
          ? {
              section: normalizedOverride.section,
              progress: normalizedOverride.progress,
              intro: normalizedOverride.intro,
              missionTurnProgress: normalizedOverride.missionTurnProgress,
              visionCoverProgress: normalizedOverride.visionCoverProgress,
              heroShotId: normalizedOverride.heroShotId,
            }
          : null,
      );

      const stage = stageRef.current;
      if (!stage) return;

      const nextTrackedSection =
        normalizedOverride?.section === "loading" ? "kv" : ((normalizedOverride?.section as AlcheScrollableSectionId | undefined) ?? "kv");
      const nextIntroSettled = Boolean(normalizedOverride && normalizedOverride.section !== "loading");
      const loadingOverlay = stage.querySelector<HTMLElement>("[data-loading-overlay]");

      stage.setAttribute("data-active-section", normalizedOverride?.section ?? "loading");
      stage.setAttribute("data-tracked-section", nextTrackedSection);
      stage.setAttribute("data-intro-ready", nextIntroSettled ? "true" : "false");
      loadingOverlay?.setAttribute("data-hidden", nextIntroSettled ? "true" : "false");
    };

    // Plain state update: calling flushSync from inside an effect is
    // disallowed in React 19 (dev warning) and unnecessary here.
    setDebugOverrideVersion((currentValue) => currentValue + 1);

    return () => {
      delete host.__setAlcheDebugOverride;
    };
  }, []);
  function setSectionRef(sectionId: AlcheScrollableSectionId, node: HTMLElement | null) {
    sectionRefs.current[sectionId] = node;
  }

  function handleLocaleChange(nextLocale: Locale) {
    if (nextLocale === locale) return;
    localStorage.setItem(SITE.localeStorageKey, nextLocale);
    router.push(`/${nextLocale}/`);
  }

  const stageStyle = useMemo(
    () =>
      ({
        "--alche-intro": currentIntroProgress.toFixed(3),
        "--alche-mission-panel-progress": missionPanelProgress.toFixed(3),
        "--alche-mission-panel-top-vh": ALCHE_TOP_MISSION_PANEL_LAYOUT.topVh.toString(),
        "--alche-mission-panel-travel-vh": ALCHE_TOP_MISSION_PANEL_LAYOUT.travelVh.toString(),
        "--alche-mission-panel-bottom-vh": ALCHE_TOP_MISSION_PANEL_LAYOUT.bottomVh.toString(),
        "--alche-mission-grid-url": `url("${missionGridTexturePath}")`,
        "--alche-endmark-footer-progress": visibleEndmarkFooterProgress.toFixed(3),
        "--alche-endmark-footer-offset": `${((1 - visibleEndmarkFooterProgress) * 2).toFixed(3)}rem`,
      }) as CSSProperties,
    [currentIntroProgress, missionGridTexturePath, missionPanelProgress, visibleEndmarkFooterProgress],
  );

  return (
    <div
      ref={setRootRef}
      className={styles.root}
      style={stageStyle}
      data-active-section={currentActiveSection}
      data-tracked-section={currentTrackedSection}
      data-intro-ready={introSettled ? "true" : "false"}
      data-render-active-section={currentActiveSection}
      data-render-tracked-section={currentTrackedSection}
      data-render-intro-ready={introSettled ? "true" : "false"}
      data-render-debug-version={debugOverrideVersion}
      data-pointer-debug={pointerDebugEnabled ? "true" : "false"}
      data-mission-panel-visible={missionPanelVisible ? "true" : "false"}
      data-mission-panel-progress={missionPanelProgress.toFixed(3)}
      data-endmark-stage={endmarkDebugState.stage}
      data-endmark-visible={endmarkDebugState.visible ? "true" : "false"}
      data-endmark-ready={endmarkDebugState.ready ? "true" : "false"}
      data-endmark-footer-progress={visibleEndmarkFooterProgress.toFixed(3)}
      data-endmark-footer-visible={endmarkFooterVisible ? "true" : "false"}
      data-header-brand-hidden={endmarkFooterVisible ? "true" : "false"}
      data-shell-theme={shellTheme}
    >
      <div className={styles.stage}>
        <div className={styles.canvasLayer}>
          {canRenderLive ? (
            <AlcheTopPageCanvas
              activeSection={currentActiveSection}
              sectionProgress={currentSectionProgress}
              worksCardsProgress={currentWorksCardsProgress}
              introProgress={currentIntroProgress}
              missionTurnProgress={missionTurnProgress}
              visionCoverProgress={visionCoverProgress}
              heroShotId={currentHeroShotId}
              cardDebugMode={currentCardDebugMode}
              reducedMotion={reducedMotion}
              kvWallTexturePath={kvWallTexturePath}
              worksCardItems={worksCardItems}
              workCount={worksCardItems.length}
              serviceCount={copy.service.items.length}
              canvasEventSource={canvasEventSource}
              pointerDebugEnabled={pointerDebugEnabled}
              worksWordHandoff={worksWordHandoff}
              renderMode="full"
            />
          ) : (
            <div className={styles.fallback}>WebGL unavailable. The DOM shell remains available.</div>
          )}
        </div>

        <div className={styles.overlay}>
          <div className={styles.loadingOverlay} data-loading-overlay data-hidden={introSettled} data-render-hidden={introSettled}>
            <p className={styles.loadingEyebrow}>{copy.loading.eyebrow}</p>
            <p className={styles.loadingBody}>{copy.loading.body}</p>
            <div className={styles.loadingRule}>
              <span style={{ transform: `scaleX(${Math.max(currentIntroProgress, 0.02)})` }} />
            </div>
          </div>

          <div
            className={styles.missionTransition}
            data-mission-transition
            data-visible={missionPanelVisible ? "true" : "false"}
            aria-hidden={missionPanelVisible ? "false" : "true"}
          >
            <div className={styles.missionTransitionPanel} data-mission-panel />
          </div>

          {canRenderLive ? (
            <div className={styles.edgeOverlayLayer}>
              <AlcheTopPageCanvas
                activeSection={currentActiveSection}
                sectionProgress={currentSectionProgress}
                worksCardsProgress={currentWorksCardsProgress}
                introProgress={currentIntroProgress}
                missionTurnProgress={missionTurnProgress}
                visionCoverProgress={visionCoverProgress}
                heroShotId={currentHeroShotId}
                cardDebugMode={currentCardDebugMode}
                reducedMotion={reducedMotion}
                kvWallTexturePath={kvWallTexturePath}
                worksCardItems={worksCardItems}
                workCount={worksCardItems.length}
                serviceCount={copy.service.items.length}
                canvasEventSource={null}
                pointerDebugEnabled={false}
                worksWordHandoff={worksWordHandoff}
                renderMode="edge-overlay"
              />
            </div>
          ) : null}

          <div className={styles.endmarkOverlay}>
            <AlcheEndmarkOverlay
              assetUrl={endmarkBlueprintPath}
              triggerActive={endmarkTriggerActive}
              reducedMotion={reducedMotion}
              captureMode={captureMode}
              debugStage={endmarkDebugStage}
              timeScale={endmarkTimeScale}
              onDebugStateChange={setEndmarkDebugState}
            />
            <div
              className={styles.endmarkFooter}
              data-endmark-footer
              data-visible={endmarkFooterVisible ? "true" : "false"}
              aria-hidden={endmarkFooterVisible ? undefined : "true"}
            >
              <div className={styles.endmarkFooterColumns}>
                {copy.outro.footer.columns.map((column) => (
                  <div key={column.title} className={styles.endmarkFooterColumn}>
                    <span className={styles.endmarkFooterHeading}>{column.title}</span>
                    {column.items.map((item) => {
                      const scrollTarget = footerScrollTargets[item];
                      const externalTarget = footerExternalTargets[item];
                      if (externalTarget) {
                        return (
                          <a
                            key={item}
                            className={`${styles.endmarkFooterItem} ${styles.endmarkFooterLink}`}
                            href={externalTarget}
                            target={externalTarget.startsWith("mailto:") ? undefined : "_blank"}
                            rel="noreferrer"
                            tabIndex={endmarkFooterVisible ? 0 : -1}
                          >
                            {item}
                          </a>
                        );
                      }
                      if (scrollTarget) {
                        return (
                          <button
                            key={item}
                            type="button"
                            className={`${styles.endmarkFooterItem} ${styles.endmarkFooterLink}`}
                            onClick={() => scrollToSection(sectionRefs.current[scrollTarget])}
                            tabIndex={endmarkFooterVisible ? 0 : -1}
                          >
                            {item}
                          </button>
                        );
                      }
                      return (
                        <span key={item} className={styles.endmarkFooterItem}>
                          {item}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className={styles.endmarkFooterAside}>
                <div className={styles.endmarkFooterActions}>
                  {copy.outro.footer.actions.map((action) =>
                    contactHref ? (
                      <a
                        key={action}
                        className={`${styles.endmarkFooterAction} ${styles.endmarkFooterLink}`}
                        href={contactHref}
                        tabIndex={endmarkFooterVisible ? 0 : -1}
                      >
                        {action}
                      </a>
                    ) : (
                      <span key={action} className={styles.endmarkFooterAction}>
                        {action}
                      </span>
                    ),
                  )}
                </div>
                <div className={styles.endmarkFooterLegal}>
                  {copy.outro.footer.legalLinks.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <span className={styles.endmarkFooterCopyright}>{copy.outro.footer.copyright}</span>
              </div>
            </div>
          </div>

          <header className={styles.header}>
            <button
              type="button"
              className={styles.headerBrand}
              data-header-brand
              aria-hidden={endmarkFooterVisible ? "true" : undefined}
              tabIndex={endmarkFooterVisible ? -1 : undefined}
              onClick={() => scrollToSection(sectionRefs.current.kv)}
            >
              <span className={styles.headerBrandWord}>MOONFLOW</span>
            </button>

            <nav className={styles.headerNav} aria-label={copy.header.navAria}>
              {copy.header.navItems.map((item) => {
                const targetSection = normalizeTopRuntimeSection(item.target) as AlcheScrollableSectionId;
                const targetGroup = ALCHE_TOP_SECTIONS.find((section) => section.id === targetSection)?.groupId ?? null;
                const isActive = targetGroup !== null && targetGroup === activeGroupId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.headerNavButton} ${isActive ? styles.headerNavButtonActive : ""}`}
                    onClick={() => scrollToSection(sectionRefs.current[targetSection])}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className={styles.headerRight}>
              <button
                type="button"
                className={styles.headerAction}
                onClick={() => scrollToSection(sectionRefs.current.outro)}
              >
                {copy.header.contactLabel} / {copy.header.recruitLabel}
              </button>

              <button type="button" className={styles.soundToggle} aria-label={copy.header.soundLabel}>
                <span />
                <span />
                <span />
              </button>

              <label className={styles.localeField}>
                <span className="sr-only">{copy.header.localeLabel}</span>
                <select
                  className={styles.localeSelect}
                  value={locale}
                  onChange={(event) => handleLocaleChange(event.target.value as Locale)}
                >
                  {LOCALES.map((entry) => (
                    <option key={entry} value={entry}>
                      {LOCALE_LABELS[entry]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          <aside className={styles.scrollIndicator} aria-hidden="true">
            {ALCHE_TOP_GROUP_IDS.map((groupId) => {
              const isActive = groupId === activeGroupId;
              return (
                <div
                  key={groupId}
                  className={`${styles.scrollIndicatorGroup} ${isActive ? styles.scrollIndicatorGroupActive : ""}`}
                >
                  <span className={styles.scrollIndicatorMain}>
                    <span className={styles.scrollIndicatorLine} />
                    {isActive ? <span className={styles.scrollIndicatorLabel}>{copy.indicator.groups[groupId]}</span> : null}
                  </span>
                </div>
              );
            })}
          </aside>

          <aside className={styles.newsRail} data-visible={newsRailVisible ? "true" : "false"} aria-hidden={newsRailVisible ? undefined : "true"}>
            <p className={styles.newsTitle}>{copy.news.title}</p>
            <div className={styles.newsList}>
              {copy.news.items.slice(0, 3).map((item) => (
                <div key={item.title} className={styles.newsItem}>
                  <p className={styles.newsDate}>{item.date}</p>
                  <p className={styles.newsLink}>{item.title}</p>
                </div>
              ))}
            </div>
          </aside>

          <div
            className={styles.worksCardCaption}
            data-visible={worksCaptionVisible ? "true" : "false"}
            aria-hidden={worksCaptionVisible ? undefined : "true"}
          >
            <p className={styles.worksCardCaptionDate}>{worksCaptionItem.date}</p>
            <h3 className={styles.worksCardCaptionTitle}>{worksCaptionItem.title}</h3>
            <p className={styles.worksCardCaptionSubtitle}>{worksCaptionItem.subtitle}</p>
            <ul className={styles.worksCardCaptionTags}>
              {worksCaptionItem.categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className={styles.worksMoreLink}
            data-visible={worksMoreVisible ? "true" : "false"}
            aria-hidden={worksMoreVisible ? undefined : "true"}
            tabIndex={worksMoreVisible ? 0 : -1}
          >
            {copy.works.moreLabel} ↗
          </button>

          <div
            className={`${styles.sectionCopy} ${styles.missionCopy}`}
            data-visible={missionCopyVisible ? "true" : "false"}
            aria-hidden={missionCopyVisible ? undefined : "true"}
          >
            <div className={styles.sectionCopyLines}>
              {missionTitleLines.map((line) => (
                <span key={line} className={styles.sectionCopyLine}>
                  {line}
                </span>
              ))}
            </div>
            <p className={styles.sectionCopyCaption}>{copy.mission.body}</p>
          </div>

          <div
            className={`${styles.sectionCopy} ${styles.visionCopy}`}
            data-visible={visionCopyVisible ? "true" : "false"}
            aria-hidden={visionCopyVisible ? undefined : "true"}
          >
            <p className={styles.sectionCopyWatermark}>{copy.vision.eyebrow}</p>
            <div className={styles.sectionCopyLines}>
              {visionTitleLines.map((line) => (
                <span key={line} className={styles.sectionCopyLine}>
                  {line}
                </span>
              ))}
            </div>
            <p className={styles.sectionCopyCaption}>{copy.vision.body}</p>
          </div>

          <div
            className={styles.lateBackdrop}
            style={{ opacity: lateBackdropOpacity }}
            data-stellla={stelllaPanelVisible ? "true" : "false"}
            aria-hidden="true"
          />

          <div
            className={styles.serviceOverlay}
            data-visible={servicePanelVisible ? "true" : "false"}
            aria-hidden={servicePanelVisible ? undefined : "true"}
          >
            <p className={styles.serviceOverlayEyebrow}>{copy.service.eyebrow}</p>
            <h3 className={styles.serviceOverlayTitle}>{copy.service.title}</h3>
            <div className={styles.serviceOverlayItems}>
              {copy.service.items.map((item) => (
                <article key={item.code} className={styles.serviceOverlayItem}>
                  <span className={styles.serviceOverlayItemCode}>{item.code}</span>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div
            className={styles.stelllaOverlay}
            data-visible={stelllaPanelVisible ? "true" : "false"}
            aria-hidden={stelllaPanelVisible ? undefined : "true"}
          >
            <p className={styles.serviceOverlayEyebrow}>{copy.stellla.frameLabel}</p>
            <h3 className={styles.stelllaOverlayWord}>{copy.stellla.eyebrow}</h3>
            <p className={styles.stelllaOverlayTitle}>{copy.stellla.title}</p>
            <p className={styles.stelllaOverlayBody}>{copy.stellla.body}</p>
          </div>
        </div>

        {pointerDebugEnabled ? (
          <div
            data-pointer-debug-panel
            style={{
              position: "absolute",
              left: "1rem",
              bottom: "1rem",
              zIndex: 30,
              maxWidth: "min(26rem, calc(100vw - 2rem))",
              padding: "0.8rem 0.9rem",
              borderRadius: "0.75rem",
              background: "rgba(8, 8, 12, 0.82)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontFamily: "\"IBM Plex Mono\", \"Courier New\", monospace",
              fontSize: "0.68rem",
              lineHeight: 1.55,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              pointerEvents: "none",
              whiteSpace: "pre-wrap",
            }}
          >
            {[
              `reduced: ${pointerDebugState?.reducedMotion ? "true" : "false"} / prefers: ${
                pointerDebugState?.prefersReducedMotion ? "true" : "false"
              }`,
              `dom: ${pointerDebugState?.domPointerInside ? "inside" : "outside"} x=${
                pointerDebugState?.domPointerClientX?.toFixed(1) ?? "null"
              } y=${pointerDebugState?.domPointerClientY?.toFixed(1) ?? "null"}`,
              `r3f: x=${pointerDebugState?.r3fPointerX?.toFixed(3) ?? "0.000"} y=${
                pointerDebugState?.r3fPointerY?.toFixed(3) ?? "0.000"
              }`,
              `model: x=${pointerDebugState?.modelRotationX?.toFixed(3) ?? "null"} y=${
                pointerDebugState?.modelRotationY?.toFixed(3) ?? "null"
              } z=${pointerDebugState?.modelRotationZ?.toFixed(3) ?? "null"}`,
            ].join("\n")}
          </div>
        ) : null}
        {showShotSelector || showCardDebugToggle ? (
          <div
            data-alche-shot-selector
            style={{
              position: "absolute",
              right: "1rem",
              bottom: pointerDebugEnabled ? "10rem" : "1rem",
              zIndex: 30,
              width: "min(22rem, calc(100vw - 2rem))",
              padding: "0.8rem 0.9rem",
              borderRadius: "0.85rem",
              background: "rgba(8, 8, 12, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              fontFamily: "\"IBM Plex Mono\", \"Courier New\", monospace",
              fontSize: "0.7rem",
              lineHeight: 1.5,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <strong style={{ fontSize: "0.74rem" }}>{showShotSelector ? "MOONFLOW Shotbook" : "MOONFLOW Card Debug"}</strong>
              <span style={{ color: "rgba(255,255,255,0.62)" }}>
                {currentShotId ?? "manual"} / {currentCardDebugMode}
              </span>
            </div>
            {showShotSelector ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", marginTop: "0.65rem" }}>
                <select
                  value={currentShotId ?? ""}
                  onChange={(event) => handleShotOverride(readAlcheWorksShotId(event.target.value))}
                  style={{
                    minWidth: 0,
                    padding: "0.5rem 0.65rem",
                    borderRadius: "0.6rem",
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(18,22,28,0.95)",
                    color: "#fff",
                    font: "inherit",
                    textTransform: "none",
                  }}
                >
                  <option value="">manual / non-shot</option>
                  {ALCHE_WORKS_CAPTURE_SHOTS.map((shot) => (
                    <option key={shot.id} value={shot.id}>
                      {shot.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => currentShotId && handleShotOverride(getAdjacentAlcheWorksShotId(currentShotId, -1))}
                  disabled={!currentShotId || !getAdjacentAlcheWorksShotId(currentShotId, -1)}
                  style={{
                    padding: "0.5rem 0.7rem",
                    borderRadius: "0.6rem",
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(18,22,28,0.95)",
                    color: "#fff",
                    font: "inherit",
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => currentShotId && handleShotOverride(getAdjacentAlcheWorksShotId(currentShotId, 1))}
                  disabled={!currentShotId || !getAdjacentAlcheWorksShotId(currentShotId, 1)}
                  style={{
                    padding: "0.5rem 0.7rem",
                    borderRadius: "0.6rem",
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(18,22,28,0.95)",
                    color: "#fff",
                    font: "inherit",
                  }}
                >
                  Next
                </button>
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
              {(["identity", "poster"] as const).map((mode) => {
                const selected = currentCardDebugMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleCardDebugModeChange(mode)}
                    style={{
                      padding: "0.5rem 0.7rem",
                      borderRadius: "0.6rem",
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: selected ? "rgba(124, 156, 255, 0.24)" : "rgba(18,22,28,0.95)",
                      color: "#fff",
                      font: "inherit",
                    }}
                  >
                    {mode === "identity" ? "Identity" : "Poster"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <main className={styles.sectionTrack}>
        {ALCHE_TOP_SCROLL_TRACK_SECTIONS.map((sectionId) => {
          const section = ALCHE_TOP_SECTIONS.find((entry) => entry.id === sectionId);
          if (!section) return null;

          return (
          <section
            key={section.id}
            id={section.id}
            ref={(node) => setSectionRef(section.id, node)}
            className={`${styles.section} ${styles[`section${section.id[0].toUpperCase()}${section.id.slice(1)}`] ?? ""}`}
            style={{ minHeight: section.minHeight }}
            data-top_section={section.id}
            data-snap-ratio={section.snapRatio}
            aria-label={section.label}
          >
            <h2 className="sr-only">{section.label}</h2>
          </section>
          );
        })}
      </main>
    </div>
  );
}
