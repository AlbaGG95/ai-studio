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
      <svg className={styles.worldMap} viewBox="0 0 1100 580" role="img" aria-label="Mapa de campa\u00f1a">
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
        <rect x="0" y="0" width="1100" height="580" fill="url(#map-sky)" />
        <path d={pathD} fill="none" stroke="url(#map-path)" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
        {stages.map((stage) => {
          const pos = positions[stage.id];
          if (!pos) return null;
          const isUnlocked = unlocked.has(stage.id);
          const isCompleted = completed.has(stage.id);
          const isCurrent = currentId === stage.id;
          const state = isCompleted ? "cleared" : isUnlocked ? "ready" : "locked";
          const stroke = isCurrent ? "#fbbf24" : isUnlocked ? "#67e8f9" : "#334155";
          const fill = isCompleted ? "#14b8a6" : isUnlocked ? "#1d4ed8" : "#111827";
          const rewardY = pos.y + 32;

          return (
            <g
              key={stage.id}
              className={styles.stageNodeGraphic}
              transform={`translate(${pos.x} ${pos.y})`}
              onClick={() => {
                if (!isUnlocked) return;
                onSelect(stage.id);
                onBattle(stage.id);
              }}
              role="button"
              aria-label={`Stage ${stage.id}, poder ${stage.enemyPower}`}
            >
              <circle cx="0" cy="0" r="34" fill={fill} stroke={stroke} strokeWidth="4" opacity={isUnlocked ? 0.9 : 0.5} />
              <circle cx="0" cy="0" r="28" fill={isUnlocked ? "#0b1627" : "#0f172a"} />
              <text x="0" y="-2" textAnchor="middle" fontSize="14" fill="#e5e7eb">
                {stage.id}
              </text>
              <text x="0" y="14" textAnchor="middle" fontSize="11" fill="#cbd5f5">
                {state}
              </text>
              <rect x="-42" y="44" width="84" height="42" rx="10" fill="rgba(8,12,24,0.8)" stroke={stroke} strokeWidth="2" />
              <text x="0" y="62" textAnchor="middle" fontSize="11" fill="#dbeafe">
                Poder {stage.enemyPower}
              </text>
              <g transform={`translate(-28 ${rewardY})`}>
                <circle cx="0" cy="0" r="6" fill="#fbbf24" />
                <text x="10" y="4" fontSize="10" fill="#f8fafc">
                  {stage.reward.gold}
                </text>
              </g>
              <g transform={`translate(-28 ${rewardY + 12})`}>
                <circle cx="0" cy="0" r="6" fill="#22d3ee" />
                <text x="10" y="4" fontSize="10" fill="#f8fafc">
                  {stage.reward.exp}
                </text>
              </g>
              <g transform={`translate(-28 ${rewardY + 24})`}>
                <circle cx="0" cy="0" r="6" fill="#a855f7" />
                <text x="10" y="4" fontSize="10" fill="#f8fafc">
                  {stage.reward.materials}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
