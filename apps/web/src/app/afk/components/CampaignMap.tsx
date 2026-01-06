"use client";

import { useMemo, useRef, useState } from "react";
import { AfkStage } from "@ai-studio/core";
import styles from "../afk.module.css";

type Props = {
  stages: AfkStage[];
  currentId: string;
  unlocked: Set<string>;
  completed: Set<string>;
  onSelect: (stageId: string) => void;
  onBattle: (stageId: string) => void;
};

type Point = { x: number; y: number };

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 580;
const NODE_HALF = 39;

export function CampaignMap({ stages, currentId, unlocked, completed, onSelect, onBattle }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

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

  return (
    <div
      ref={viewportRef}
      className={styles.mapViewport}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className={styles.mapInner}>
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
