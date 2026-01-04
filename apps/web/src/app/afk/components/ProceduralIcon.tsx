"use client";

import { IconSpec } from "@/lib/afkProcedural";

type Props = {
  icon: IconSpec;
  size?: number;
  label?: string;
};

export function ProceduralIcon({ icon, size = 42, label }: Props) {
  const radius = 18;
  const view = 64;
  const shape =
    icon.shape === "diamond"
      ? `M${view / 2} 6 L ${view - 6} ${view / 2} L ${view / 2} ${view - 6} L 6 ${view / 2} Z`
      : icon.shape === "hex"
        ? `M${view / 2} 6 L ${view - 10} ${view / 3} L ${view - 10} ${(view * 2) / 3} L ${view / 2} ${view - 6} L 10 ${(view * 2) / 3} L 10 ${view / 3} Z`
        : "";
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${view} ${view}`} style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>
        <defs>
          <linearGradient id={`icon-grad-${icon.seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={icon.tones[0]} />
            <stop offset="100%" stopColor={icon.tones[1]} />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width={view - 12} height={view - 12} rx={radius} ry={radius} fill={`url(#icon-grad-${icon.seed})`} stroke={icon.border} strokeWidth="3" />
        {shape && <path d={shape} fill="rgba(255,255,255,0.08)" stroke={icon.glow} strokeWidth="2" />}
        <circle cx={view / 2} cy={view / 2} r={12} fill="rgba(0,0,0,0.2)" />
        <text x={view / 2} y={view / 2 + 4} fontSize="18" textAnchor="middle" fill="#fff">
          {icon.glyph}
        </text>
      </svg>
      {label && <span style={{ fontSize: 11, color: "#dbeafe" }}>{label}</span>}
    </div>
  );
}
