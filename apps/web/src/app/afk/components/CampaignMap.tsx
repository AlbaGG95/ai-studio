"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AfkStage } from "@ai-studio/core";
import styles from "../afk.module.css";

type Props = {
  stages: AfkStage[];
  currentId: string;
  unlocked: Set<string>;
  completed: Set<string>;
  onSelect: (stageId: string) => void;
  onBattle: (stageId: string) => void;
  variant?: "default" | "background";
};

type Point = { x: number; y: number };

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 580;
const NODE_HALF = 39;

export function CampaignMap({
  stages,
  currentId,
  unlocked,
  completed,
  onSelect,
  onBattle,
  variant = "default",
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [backgroundTransform, setBackgroundTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const isBackground = variant === "background";

  const positions = useMemo(() => {
    const coords: Record<string, Point> = {};
    stages.forEach((stage, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const baseX = 120 + col * 200 + (row % 2 === 0 ? 20 : -20);
      const baseY = 120 + row * 120;
      coords[stage.id] = { x: baseX, y: baseY };
    });
    return coords;
  }, [stages]);

  const pathD = useMemo(() => {
    return stages
      .map((stage, idx) => {
        const pos = positions[stage.id];
        if (!pos) return "";
        const next = stages[idx + 1];
        if (!next) return "";
        const nextPos = positions[next.id];
        return `M ${pos.x} ${pos.y} Q ${(pos.x + nextPos.x) / 2} ${pos.y - 30} ${nextPos.x} ${nextPos.y}`;
      })
      .join(" ");
  }, [positions, stages]);

  const startDrag = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    setDrag({ x: ev.clientX, y: ev.clientY });
    viewportRef.current.setPointerCapture(ev.pointerId);
  };

  const moveDrag = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !viewportRef.current) return;
    const dx = drag.x - ev.clientX;
    const dy = drag.y - ev.clientY;
    viewportRef.current.scrollBy(dx, dy);
    setDrag({ x: ev.clientX, y: ev.clientY });
  };

  const endDrag = (ev: React.PointerEvent<HTMLDivElement>) => {
    setDrag(null);
    if (viewportRef.current) {
      viewportRef.current.releasePointerCapture(ev.pointerId);
    }
  };

  useEffect(() => {
    if (!isBackground) return;
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 520px)");
    const update = () => setIsMobile(query.matches);
    update();
    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, [isBackground]);

  useEffect(() => {
    if (!isBackground) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) return;
      setViewportSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };
    updateSize();
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(viewport);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isBackground]);

  useEffect(() => {
    if (!isBackground || isMobile) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateTransform = () => {
      const rect = viewport.getBoundingClientRect();
      const viewportW = rect.width;
      const viewportH = rect.height;
      if (!viewportW || !viewportH) return;

      const scale = Math.max(viewportW / MAP_WIDTH, viewportH / MAP_HEIGHT);
      const scaledW = MAP_WIDTH * scale;
      const scaledH = MAP_HEIGHT * scale;
      const offsetX = (viewportW - scaledW) / 2;
      const offsetY = (viewportH - scaledH) / 2;

      setBackgroundTransform({ scale, offsetX, offsetY });
    };

    updateTransform();
  }, [isBackground, isMobile]);

  const focusStageId = useMemo(() => {
    if (!isBackground) return null;
    if (positions[currentId]) return currentId;
    const firstUnlocked = stages.find((stage) => unlocked.has(stage.id));
    if (firstUnlocked) return firstUnlocked.id;
    const lastCompleted = [...stages].reverse().find((stage) => completed.has(stage.id));
    if (lastCompleted) return lastCompleted.id;
    return stages[0]?.id ?? null;
  }, [isBackground, positions, currentId, stages, unlocked, completed]);

  const mobileTransform = useMemo(() => {
    if (!isBackground || !isMobile) return null;
    if (!viewportSize.width || !viewportSize.height) return null;
    if (!focusStageId) return null;
    const focusPos = positions[focusStageId];
    if (!focusPos) return null;

    const scale = 1.35;
    const targetX = viewportSize.width * 0.5;
    const targetY = viewportSize.height * 0.4;
    const translateX = targetX - focusPos.x * scale;
    const translateY = targetY - focusPos.y * scale;
    return { scale, translateX, translateY };
  }, [isBackground, isMobile, viewportSize, focusStageId, positions]);

  const mapInnerStyle = isBackground
    ? {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        transform: mobileTransform
          ? `translate3d(${mobileTransform.translateX}px, ${mobileTransform.translateY}px, 0) scale(${mobileTransform.scale})`
          : `translate3d(${backgroundTransform.offsetX}px, ${backgroundTransform.offsetY}px, 0) scale(${backgroundTransform.scale})`,
        transformOrigin: "top left",
      }
    : undefined;

  return (
    <div
      ref={viewportRef}
      className={styles.mapViewport}
      onPointerDown={isBackground ? undefined : startDrag}
      onPointerMove={isBackground ? undefined : moveDrag}
      onPointerUp={isBackground ? undefined : endDrag}
      onPointerLeave={isBackground ? undefined : endDrag}
    >
      <div className={styles.mapInner} data-variant={variant} style={mapInnerStyle}>
        <svg className={styles.mapBg} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Mapa de campa\u00f1a">
          <defs>
            <linearGradient id="map-sky" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0f1c34" />
              <stop offset="100%" stopColor="#0a1222" />
            </linearGradient>
            <linearGradient id="map-path" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4b8bff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-sky)" />
          <path d={pathD} fill="none" stroke="url(#map-path)" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
        </svg>
        {stages.map((stage) => {
          const pos = positions[stage.id];
          if (!pos) return null;
          const isUnlocked = unlocked.has(stage.id);
          const isCompleted = completed.has(stage.id);
          const isCurrent = currentId === stage.id;
          const state = isCompleted ? "cleared" : isUnlocked ? "ready" : "locked";

          return (
            <div
              key={stage.id}
              className={styles.stageNode}
              data-active={isCurrent}
              style={{ transform: `translate3d(${pos.x - NODE_HALF}px, ${pos.y - NODE_HALF}px, 0)` }}
              role="button"
              tabIndex={isUnlocked ? 0 : -1}
              aria-label={`Stage ${stage.id}, poder ${stage.enemyPower}`}
              onClick={() => {
                if (!isUnlocked) return;
                onSelect(stage.id);
                onBattle(stage.id);
              }}
            >
              <div className={styles.stageCore}>
                <div className={styles.stageCircle} data-state={state} data-active={isCurrent} />
                <div className={styles.stageLabel}>{stage.id}</div>
                <div className={styles.stageState}>{state}</div>
              </div>
              <div className={styles.stageMarkers}>
                <div className={styles.stageMarker}>
                  <span className={`${styles.stageMarkerDot} ${styles.gold}`} />
                  <span>{stage.reward.gold}</span>
                </div>
                <div className={styles.stageMarker}>
                  <span className={`${styles.stageMarkerDot} ${styles.exp}`} />
                  <span>{stage.reward.exp}</span>
                </div>
                <div className={styles.stageMarker}>
                  <span className={`${styles.stageMarkerDot} ${styles.mats}`} />
                  <span>{stage.reward.materials}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
