"use client";

import { AfkHeroVisual } from "@ai-studio/core";
import { useMemo } from "react";
import { buildHeroArtProfile } from "@/lib/afkProcedural";

type Props = {
  visual: AfkHeroVisual;
  seed: string;
  role?: "tank" | "fighter" | "ranger" | "support" | "mage";
  rarity?: "common" | "rare" | "epic" | "legendary";
  size?: number;
  label?: string;
  name?: string;
};

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function HeroPortrait({ visual, seed, role = "fighter", rarity = "common", size = 90, label, name }: Props) {
  const h = hash(seed);
  const angle = ((h % 40) - 20) / 10;
  const profile = useMemo(
    () =>
      buildHeroArtProfile({
        visualSeed: seed,
        role,
        rarity,
        id: seed,
      }),
    [rarity, role, seed]
  );

  const viewSize = 96;
  const bandHeight = 20 + profile.armor.band * 30;
  const edgeColor = visual.accent ?? profile.palette.accent;
  const detailColor = visual.detail ?? profile.palette.glow;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 96 112"
        style={{ borderRadius: 18, overflow: "hidden", background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1), transparent)" }}
      >
        <defs>
          <linearGradient id={`hero-grad-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={visual.body} />
            <stop offset="100%" stopColor={visual.secondary} />
          </linearGradient>
          <linearGradient id={`hero-frame-${seed}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={profile.palette.glow} />
            <stop offset="100%" stopColor={profile.palette.accent} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={viewSize} height="112" rx="16" fill={`url(#hero-grad-${seed})`} />
        <rect x="4" y="4" width={viewSize - 8} height="104" rx="14" fill="rgba(0,0,0,0.22)" />

        {/* Back item */}
        {profile.back.item === "wings" && (
          <>
            <path
              d="M16 70 C 8 56, 8 44, 20 36 L 26 40 C 20 50, 22 60, 30 70 Z"
              fill={detailColor}
              opacity={0.3}
              transform={`translate(0 2) rotate(${angle} 24 64)`}
            />
            <path
              d="M80 70 C 88 56, 88 44, 76 36 L 70 40 C 76 50, 74 60, 66 70 Z"
              fill={detailColor}
              opacity={0.3}
              transform={`translate(0 2) rotate(${-angle} 72 64)`}
            />
          </>
        )}
        {profile.back.item === "banner" && <rect x="18" y="18" width="60" height="12" rx="6" fill={edgeColor} opacity={0.3} />}
        {profile.back.item === "rune" && (
          <circle cx="48" cy="32" r="16" fill={detailColor} opacity={0.2} stroke={edgeColor} strokeWidth="2" />
        )}

        {/* Silhouette */}
        <path
          d={`M24 ${64 + profile.silhouette.cut * 6} C 24 44, 36 26, 48 24 C 60 26, 72 44, 72 ${
            64 + profile.silhouette.cut * 6
          } C 68 84, 28 84, 24 ${64 + profile.silhouette.cut * 6} Z`}
          fill={`url(#hero-frame-${seed})`}
          opacity={0.35}
        />
        <path
          d={`M28 ${68 + profile.silhouette.cut * 4} C 28 48, 38 30, 48 30 C 58 30, 68 48, 68 ${
            68 + profile.silhouette.cut * 4
          } C 64 88, 32 88, 28 ${68 + profile.silhouette.cut * 4} Z`}
          fill={profile.palette.primary}
          stroke={profile.palette.line}
          strokeWidth="2"
          transform={`rotate(${angle} 48 60)`}
        />

        {/* Armor bands */}
        <rect x="26" y={58} width="44" height={bandHeight} rx="12" fill={edgeColor} opacity={0.7} />
        <rect x="30" y={62} width="36" height={bandHeight - 10} rx="10" fill={profile.palette.secondary} opacity={0.9} />

        {/* Visor */}
        <rect x="32" y="38" width="32" height="18" rx="10" fill={profile.palette.secondary} stroke={edgeColor} strokeWidth="2" />
        <rect x="36" y="42" width="8" height="10" rx="4" fill={profile.palette.glow} opacity={0.85} />
        <rect x="52" y="42" width="8" height="10" rx="4" fill={profile.palette.glow} opacity={0.85} />

        {/* Weapon */}
        {profile.weapon.type === "blade" && (
          <path d="M14 86 L 46 68 L 50 74 L 18 92 Z" fill={detailColor} stroke={edgeColor} strokeWidth="1" opacity="0.9" />
        )}
        {profile.weapon.type === "bow" && (
          <path d="M18 84 Q 48 60 78 84" fill="none" stroke={edgeColor} strokeWidth="3" />
        )}
        {profile.weapon.type === "staff" && <rect x="20" y="60" width="8" height="36" rx="4" fill={edgeColor} opacity="0.8" />}
        {profile.weapon.type === "hammer" && (
          <>
            <rect x="22" y="62" width="8" height="34" rx="4" fill={edgeColor} />
            <rect x="18" y="58" width="16" height="12" rx="4" fill={detailColor} opacity="0.9" />
          </>
        )}

        {/* Sigil */}
        <circle cx="48" cy="26" r="12" fill={profile.palette.shadow} stroke={edgeColor} strokeWidth="2" />
        <text x="48" y="30" textAnchor="middle" fontSize="12" fill={profile.palette.glow}>
          {profile.sigil.glyph}
        </text>

        {/* Rarity frame */}
        <rect x="4" y="4" width={viewSize - 8} height="104" rx="14" fill="none" stroke={`url(#hero-frame-${seed})`} strokeWidth="2" />
      </svg>
      {(label || name) && (
        <span style={{ fontSize: 12, color: "#e5e7eb", textAlign: "center", maxWidth: size }}>
          {name ?? label}
          {label && name ? ` · ${label}` : ""}
        </span>
      )}
    </div>
  );
}
