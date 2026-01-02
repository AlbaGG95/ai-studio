import { Hero, HeroStats, HeroVisual, Rarity, Role } from "./types.js";
import { SeededRng } from "./rng.js";

const ROLE_POOL: Role[] = ["tank", "fighter", "ranger", "support", "mage"];
const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

const NAME_PREFIXES = ["Nova", "Aeris", "Koru", "Vexa", "Ili", "Ryn", "Sera", "Orr", "Nyx", "Aro"];
const NAME_SUFFIXES = ["blade", "flare", "song", "ward", "gale", "thorn", "bolt", "veil", "rune", "crest"];

function rollRarity(rng: SeededRng): Rarity {
  const roll = rng.next();
  if (roll > 0.92) return "legendary";
  if (roll > 0.72) return "epic";
  if (roll > 0.42) return "rare";
  return "common";
}

function roleMultiplier(role: Role) {
  switch (role) {
    case "tank":
      return { hp: 1.25, atk: 0.9, def: 1.2, speed: 0.9 };
    case "fighter":
      return { hp: 1, atk: 1.15, def: 1, speed: 1 };
    case "ranger":
      return { hp: 0.9, atk: 1.2, def: 0.95, speed: 1.1 };
    case "support":
      return { hp: 1, atk: 0.95, def: 1, speed: 1 };
    case "mage":
      return { hp: 0.85, atk: 1.3, def: 0.9, speed: 1.05 };
    default:
      return { hp: 1, atk: 1, def: 1, speed: 1 };
  }
}

export function rarityScale(rarity: Rarity): number {
  switch (rarity) {
    case "legendary":
      return 1.45;
    case "epic":
      return 1.25;
    case "rare":
      return 1.1;
    default:
      return 1;
  }
}

function computeStats(baseSeed: string, role: Role, rarity: Rarity, level: number): HeroStats {
  const rng = new SeededRng(`${baseSeed}-stats-${level}`);
  const mult = roleMultiplier(role);
  const rarityMult = rarityScale(rarity);
  const hp = Math.round((520 + rng.int(0, 180)) * mult.hp * rarityMult * (1 + level * 0.04));
  const atk = Math.round((75 + rng.int(0, 30)) * mult.atk * rarityMult * (1 + level * 0.05));
  const def = Math.round((55 + rng.int(0, 25)) * mult.def * rarityMult * (1 + level * 0.03));
  const speed = Math.round((92 + rng.int(0, 18)) * mult.speed);
  return { hp, atk, def, speed };
}

function buildName(rng: SeededRng): string {
  const prefix = rng.pick(NAME_PREFIXES);
  const suffix = rng.pick(NAME_SUFFIXES);
  return `${prefix}${suffix}`;
}

export function generateHero(seed: string, idx: number, level = 1): Hero {
  const rng = new SeededRng(`${seed}-${idx}`);
  const role = rng.pick(ROLE_POOL);
  const rarity = rollRarity(rng);
  const name = buildName(rng);
  const stats = computeStats(seed, role, rarity, level);
  const power = Math.round(stats.hp / 8 + stats.atk * 2.2 + stats.def * 1.4 + stats.speed * 0.7 + level * 6);
  return {
    id: `hero-${idx + 1}`,
    name,
    level,
    rarity,
    role,
    power,
    stats,
    visualSeed: `${seed}-${idx}`,
  };
}

export function generateRoster(count: number, seedBase: number | string): Hero[] {
  const heroes: Hero[] = [];
  const usedVisuals = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    let seed = `${seedBase}-${i + 1}`;
    while (usedVisuals.has(seed)) {
      seed = `${seed}-r`;
    }
    const hero = generateHero(seed, i);
    usedVisuals.add(hero.visualSeed);
    heroes.push(hero);
  }
  return heroes;
}

const VISUAL_PALETTES: HeroVisual[] = [
  { body: "#2c3e50", accent: "#7ea4ff", secondary: "#0fbcf9", detail: "#c2e9fb", pattern: "bars" },
  { body: "#4b2c5e", accent: "#e07be0", secondary: "#f7b731", detail: "#fbc02d", pattern: "stripes" },
  { body: "#234e52", accent: "#38b2ac", secondary: "#9ae6b4", detail: "#c6f6d5", pattern: "rings" },
  { body: "#3b3a6f", accent: "#7c83fd", secondary: "#a3bffa", detail: "#c3dafe", pattern: "none" },
  { body: "#5b3412", accent: "#f6ad55", secondary: "#fbd38d", detail: "#fff5eb", pattern: "rings" },
  { body: "#12324f", accent: "#4dd0e1", secondary: "#80deea", detail: "#e0f7fa", pattern: "bars" },
  { body: "#2f3b52", accent: "#c084fc", secondary: "#a78bfa", detail: "#ede9fe", pattern: "stripes" },
];

export function buildHeroVisual(seed: string): HeroVisual {
  const rng = new SeededRng(`visual-${seed}`);
  const palette = rng.pick(VISUAL_PALETTES);
  const nudge = (hex: string, delta: number) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + delta));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + delta));
    const b = Math.min(255, Math.max(0, (num & 0xff) + delta));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  return {
    body: palette.body,
    accent: palette.accent,
    secondary: palette.secondary,
    detail: nudge(palette.detail, rng.int(-10, 18)),
    pattern: palette.pattern,
  };
}
