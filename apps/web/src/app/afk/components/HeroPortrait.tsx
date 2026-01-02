"use client";

import { AfkHeroVisual } from "@ai-studio/core";

type Props = {
  visual: AfkHeroVisual;
  seed: string;
  size?: number;
  label?: string;
};

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function HeroPortrait({ visual, seed, size = 72, label }: Props) {
  const h = hash(seed);
  const angle = (h % 50) - 25;
  const offset = (h % 12) - 6;
  const eyeOffset = (h % 8) - 4;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ borderRadius: 14, overflow: "hidden" }}>
        <defs>
          <linearGradient id={`grad-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={visual.body} />
            <stop offset="100%" stopColor={visual.secondary} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="64" height="64" fill={`url(#grad-${seed})`} />
        <rect
          x={10 + offset}
          y={14}
          width="44"
          height="36"
          rx="12"
          fill={visual.accent}
          opacity={0.9}
          transform={`rotate(${angle} 32 32)`}
        />
        <circle cx={26 + eyeOffset} cy="30" r="4" fill={visual.detail} />
        <circle cx={40 - eyeOffset} cy="30" r="4" fill={visual.detail} />
        <rect x="22" y="40" width="20" height="6" rx="3" fill={visual.detail} opacity={0.7} />
        {visual.pattern === "stripes" && (
          <>
            <rect x="8" y="14" width="6" height="40" fill={visual.detail} opacity={0.35} />
            <rect x="50" y="10" width="4" height="44" fill={visual.detail} opacity={0.35} />
          </>
        )}
        {visual.pattern === "bars" && (
          <>
            <rect x="18" y="8" width="4" height="48" fill={visual.secondary} opacity={0.25} />
            <rect x="42" y="8" width="4" height="48" fill={visual.secondary} opacity={0.25} />
          </>
        )}
        {visual.pattern === "rings" && (
          <>
            <circle cx="32" cy="32" r="18" fill="none" stroke={visual.detail} strokeWidth="3" opacity={0.5} />
            <circle cx="32" cy="32" r="12" fill="none" stroke={visual.detail} strokeWidth="2" opacity={0.6} />
          </>
        )}
      </svg>
      {label && <span style={{ fontSize: 12, color: "#cfd8ff" }}>{label}</span>}
    </div>
  );
}
