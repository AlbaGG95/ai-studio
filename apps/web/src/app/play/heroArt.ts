"use client";

import * as Phaser from "phaser";
import { EngineUnitTemplate } from "@ai-studio/core";

export type HeroArtSpec = {
  id: string;
  projectId?: string;
  role: string;
  faction?: string;
  rarity?: string;
  palette: { primary: number; secondary: number; accent: number; aura: number; border: number };
  silhouette: "bulky" | "balanced" | "slim" | "robed";
  armor: "none" | "light" | "heavy" | "mystic";
  weapon: "shield" | "sword" | "staff" | "bow" | "claws" | "dagger" | "hammer";
  auraStyle: "ring" | "halo" | "sparks";
  rarityRank: number;
};

const ROLE_PALETTES: Record<string, { primary: number; secondary: number; accent: number }> = {
  tank: { primary: 0x2d3748, secondary: 0x4b5563, accent: 0x22c55e },
  dps: { primary: 0x1f2937, secondary: 0x374151, accent: 0xf97316 },
  support: { primary: 0x1e293b, secondary: 0x334155, accent: 0x22d3ee },
  mage: { primary: 0x24163a, secondary: 0x3b2f4b, accent: 0xa855f7 },
  default: { primary: 0x1f2937, secondary: 0x374151, accent: 0x7ce4ff },
};

const FACTION_COLORS: Record<string, number> = {
  lightbearer: 0xfacc15,
  graveborn: 0x22c55e,
  wilder: 0x10b981,
  mauler: 0xf97316,
  celestial: 0x93c5fd,
  hypogean: 0xa855f7,
  default: 0x7ce4ff,
};

const RARITY_BORDER: Record<string, number> = {
  common: 0x6b7280,
  rare: 0x38bdf8,
  epic: 0xa855f7,
  legendary: 0xf59e0b,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const hashString = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
};

const seeded = (id: string, salt: string, min = 0, max = 1) => {
  const h = hashString(`${id}|${salt}`);
  const n = (h % 1000) / 1000;
  return min + n * (max - min);
};

export const rarityRank = (rarity?: string) => {
  const r = (rarity || "").toLowerCase();
  if (r.includes("legend")) return 3;
  if (r.includes("epic")) return 2;
  if (r.includes("rare")) return 1;
  return 0;
};

export function buildHeroArtSpec(hero: Pick<EngineUnitTemplate, "id" | "role" | "faction" | "rarity">, projectId?: string) {
  const role = hero.role?.toLowerCase() || "dps";
  const basePalette = ROLE_PALETTES[role] || ROLE_PALETTES.default;
  const factionColor = FACTION_COLORS[hero.faction || ""] ?? FACTION_COLORS.default;
  const rarity = hero.rarity?.toLowerCase() || "common";
  const rank = rarityRank(rarity);
  const uid = `${projectId || "offline"}|${hero.id}|${role}|${hero.faction || "f"}|${rarity}`;
  const primary = Phaser.Display.Color.ValueToColor(basePalette.primary);
  const accent = Phaser.Display.Color.ValueToColor(basePalette.accent);
  const auraColor = Phaser.Display.Color.ValueToColor(factionColor);
  const secondary = Phaser.Display.Color.Interpolate.ColorWithColor(primary, auraColor, 100, 35 + rank * 8);
  const borderColor = RARITY_BORDER[rarity] ?? RARITY_BORDER.common;

  const silhouetteRoll = seeded(uid, "silhouette", 0, 1);
  let silhouette: HeroArtSpec["silhouette"] = "balanced";
  if (role === "tank" || silhouetteRoll > 0.78) silhouette = "bulky";
  else if (role === "mage") silhouette = "robed";
  else if (role === "support") silhouette = "slim";

  const armorRoll = seeded(uid, "armor", 0, 1);
  const armor: HeroArtSpec["armor"] =
    role === "tank" || armorRoll > 0.66 ? "heavy" : role === "mage" || armorRoll < 0.28 ? "mystic" : "light";

  const weaponPool: HeroArtSpec["weapon"][] =
    role === "tank"
      ? ["shield", "hammer", "sword"]
      : role === "mage"
      ? ["staff", "dagger"]
      : role === "support"
      ? ["staff", "bow", "dagger"]
      : ["sword", "claws", "dagger", "bow"];
  const weapon = weaponPool[Math.floor(seeded(uid, "weapon", 0, weaponPool.length - 1e-3))];

  const auraStyle: HeroArtSpec["auraStyle"] =
    seeded(uid, "aura", 0, 1) > 0.66 ? "halo" : seeded(uid, "aura2", 0, 1) > 0.33 ? "ring" : "sparks";

  return {
    id: hero.id,
    projectId,
    role,
    faction: hero.faction,
    rarity: hero.rarity,
    palette: {
      primary: primary.color,
      secondary: Phaser.Display.Color.GetColor(secondary.r, secondary.g, secondary.b),
      accent: accent.color,
      aura: auraColor.color,
      border: borderColor,
    },
    silhouette,
    armor,
    weapon,
    auraStyle,
    rarityRank: rank,
  };
}

const portraitMemoryCache: Record<string, string> = {};

export function getPortraitDataUri(spec: HeroArtSpec) {
  const key = `${spec.projectId || "offline"}|${spec.id}`;
  if (portraitMemoryCache[key]) return portraitMemoryCache[key];
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(`portrait:${key}`);
    if (stored) {
      portraitMemoryCache[key] = stored;
      return stored;
    }
  }

  const svg = buildPortraitSvg(spec);
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  portraitMemoryCache[key] = uri;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`portrait:${key}`, uri);
    } catch {
      // ignore quota errors
    }
  }
  return uri;
}

function buildPortraitSvg(spec: HeroArtSpec) {
  const { palette, rarityRank: rank } = spec;
  const w = 220;
  const h = 260;
  const r = 18;
  const frameStroke = rank >= 2 ? 6 : 4;
  const body = buildBodySvg(spec);
  const weapon = buildWeaponSvg(spec);
  const aura = buildAuraSvg(spec);
  return `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g-${spec.id}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${hex(palette.secondary)}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${hex(palette.primary)}" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="g-${spec.id}-border" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${hex(palette.border)}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${hex(palette.accent)}" stop-opacity="0.8"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="${r}" ry="${r}" fill="url(#g-${spec.id}-bg)" stroke="url(#g-${spec.id}-border)" stroke-width="${frameStroke}"/>
  ${aura}
  ${body}
  ${weapon}
</svg>`;
}

function buildBodySvg(spec: HeroArtSpec) {
  const { palette, silhouette, armor } = spec;
  const torsoWidth = silhouette === "bulky" ? 120 : silhouette === "slim" ? 90 : 104;
  const torsoHeight = silhouette === "robed" ? 140 : 120;
  const torsoX = 110 - torsoWidth / 2;
  const torsoY = 90;
  const headR = silhouette === "bulky" ? 34 : 30;
  const armorOpacity = armor === "heavy" ? 0.48 : armor === "mystic" ? 0.32 : 0.26;
  return `
  <g>
    <ellipse cx="110" cy="${torsoY + torsoHeight - 10}" rx="${torsoWidth * 0.52}" ry="${torsoHeight * 0.25}" fill="${hex(
      palette.secondary
    )}" opacity="0.22"/>
    <rect x="${torsoX}" y="${torsoY}" width="${torsoWidth}" height="${torsoHeight}" rx="28" fill="${hex(
      palette.primary
    )}" />
    <rect x="${torsoX + 10}" y="${torsoY + 18}" width="${torsoWidth - 20}" height="${torsoHeight - 36}" rx="18" fill="${hex(
      palette.secondary
    )}" />
    <circle cx="110" cy="${torsoY - 10}" r="${headR}" fill="${hex(palette.primary)}" stroke="${hex(
    palette.accent
  )}" stroke-width="4"/>
    <rect x="${torsoX + 14}" y="${torsoY + 12}" width="${torsoWidth - 28}" height="${torsoHeight - 48}" rx="14" fill="${hex(
      palette.accent
    )}" opacity="${armorOpacity}"/>
  </g>`;
}

function buildWeaponSvg(spec: HeroArtSpec) {
  const { weapon, palette } = spec;
  if (weapon === "shield") {
    return `<path d="M40 120 Q70 80 110 100 Q110 170 70 190 Q40 160 40 120 Z" fill="${hex(
      palette.secondary
    )}" stroke="${hex(palette.border)}" stroke-width="4"/>`;
  }
  if (weapon === "bow") {
    return `<path d="M160 90 Q190 140 160 190" stroke="${hex(palette.border)}" stroke-width="6" fill="none"/>
            <line x1="160" y1="90" x2="160" y2="190" stroke="${hex(palette.accent)}" stroke-width="3"/>`;
  }
  if (weapon === "staff") {
    return `<rect x="170" y="80" width="10" height="140" rx="4" fill="${hex(palette.border)}"/>
            <circle cx="175" cy="78" r="14" fill="${hex(palette.accent)}" opacity="0.8"/>`;
  }
  if (weapon === "hammer") {
    return `<rect x="170" y="110" width="12" height="110" rx="4" fill="${hex(palette.border)}"/>
            <rect x="154" y="88" width="44" height="28" rx="6" fill="${hex(palette.secondary)}" stroke="${hex(
              palette.accent
            )}" stroke-width="4"/>`;
  }
  if (weapon === "claws" || weapon === "dagger") {
    return `<path d="M160 120 L190 108 L192 124 L162 134 Z" fill="${hex(palette.accent)}" opacity="0.9"/>
            <path d="M156 150 L186 138 L188 154 L158 164 Z" fill="${hex(palette.border)}" opacity="0.9"/>`;
  }
  // sword default
  return `<rect x="168" y="90" width="10" height="120" rx="4" fill="${hex(palette.border)}"/>
          <polygon points="173,80 188,100 158,100" fill="${hex(palette.accent)}"/>
          <rect x="160" y="118" width="26" height="10" rx="3" fill="${hex(palette.secondary)}"/>`;
}

function buildAuraSvg(spec: HeroArtSpec) {
  const { palette, auraStyle, rarityRank: rank } = spec;
  const auraOpacity = 0.18 + rank * 0.05;
  if (auraStyle === "halo") {
    return `<ellipse cx="110" cy="96" rx="86" ry="32" fill="${hex(palette.aura)}" opacity="${auraOpacity}"/>`;
  }
  if (auraStyle === "sparks") {
    const spark = (x: number, y: number, r: number) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${hex(palette.aura)}" opacity="${auraOpacity + 0.08}"/>`;
    return `
      ${spark(50, 210, 10)}
      ${spark(90, 70, 8)}
      ${spark(160, 200, 12)}
      ${spark(170, 120, 9)}
      ${spark(70, 150, 7)}
    `;
  }
  // ring
  return `<circle cx="110" cy="160" r="96" stroke="${hex(palette.aura)}" stroke-width="${6 + rank * 1.5}" fill="none" opacity="${
    auraOpacity + 0.05
  }"/>`;
}

function hex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
