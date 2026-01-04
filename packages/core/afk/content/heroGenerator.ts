import {
  Hero,
  HeroSkill,
  HeroStats,
  Role,
  Rarity,
  VisualDNA,
  VisualFxStyle,
  VisualSilhouette,
} from "../types.js";
import { makeRng, hashString } from "../seed.js";
import { rarityScale } from "../heroFactory.js";

const ROLE_POOL: Role[] = ["tank", "fighter", "ranger", "support", "mage"];
const SILHOUETTES: VisualSilhouette[] = ["vanguard", "assassin", "mystic", "warden", "trickster"];
const VFX_STYLES: VisualFxStyle[] = ["spark", "slash", "bloom", "ember", "pulse"];

const NAME_FRAGMENTS = [
  "Astra",
  "Nyra",
  "Kael",
  "Sorin",
  "Veya",
  "Lumi",
  "Riven",
  "Eira",
  "Nox",
  "Zuri",
  "Kaia",
  "Theron",
];

const PALETTES: Array<VisualDNA["palette"]> = [
  { primary: "#1e2a44", secondary: "#3f6ed4", accent: "#9dd2ff" },
  { primary: "#2c1f39", secondary: "#a043e4", accent: "#f2b3ff" },
  { primary: "#163328", secondary: "#2fa678", accent: "#9ef7c2" },
  { primary: "#3b2f21", secondary: "#d28c45", accent: "#ffe6b0" },
  { primary: "#18243a", secondary: "#3e97c7", accent: "#9bf0ff" },
  { primary: "#2b233c", secondary: "#6a4ee8", accent: "#c6b8ff" },
];

function pick<T>(rng: () => number, items: T[]): T {
  const idx = Math.floor(rng() * items.length);
  return items[Math.min(idx, items.length - 1)];
}

function rollRarity(rng: () => number): Rarity {
  const roll = rng();
  if (roll > 0.93) return "legendary";
  if (roll > 0.75) return "epic";
  if (roll > 0.45) return "rare";
  return "common";
}

function roleMultiplier(role: Role) {
  switch (role) {
    case "tank":
      return { hp: 1.25, atk: 0.92, def: 1.25, speed: 0.9 };
    case "fighter":
      return { hp: 1, atk: 1.1, def: 1, speed: 1 };
    case "ranger":
      return { hp: 0.92, atk: 1.18, def: 0.96, speed: 1.08 };
    case "support":
      return { hp: 1, atk: 0.95, def: 1, speed: 1 };
    case "mage":
      return { hp: 0.88, atk: 1.26, def: 0.92, speed: 1.05 };
    default:
      return { hp: 1, atk: 1, def: 1, speed: 1 };
  }
}

function computeStats(seed: string, role: Role, rarity: Rarity, level: number): HeroStats {
  const rng = makeRng(`${seed}-stats-${level}`);
  const mult = roleMultiplier(role);
  const rarityMult = rarityScale(rarity);
  const hp = Math.round((540 + rng() * 220) * mult.hp * rarityMult * (1 + level * 0.04));
  const atk = Math.round((78 + rng() * 38) * mult.atk * rarityMult * (1 + level * 0.05));
  const def = Math.round((58 + rng() * 26) * mult.def * rarityMult * (1 + level * 0.03));
  const speed = Math.round((90 + rng() * 20) * mult.speed);
  return { hp, atk, def, speed };
}

function buildName(rng: () => number) {
  const first = pick(rng, NAME_FRAGMENTS);
  const second = pick(rng, NAME_FRAGMENTS);
  return `${first}${second.slice(-2)}`;
}

function buildVisualDNA(seed: string): VisualDNA {
  const rng = makeRng(`${seed}-visual`);
  return {
    silhouette: pick(rng, SILHOUETTES),
    palette: pick(rng, PALETTES),
    vfxStyle: pick(rng, VFX_STYLES),
  };
}

function buildSkills(seed: string, role: Role): HeroSkill[] {
  const rng = makeRng(`${seed}-skills`);
  const element: HeroSkill["element"] = role === "mage" ? "arcane" : role === "support" ? "nature" : "physical";
  const basic: HeroSkill = {
    id: `${seed}-basic`,
    name: pick(rng, ["Strike", "Volley", "Flow", "Pulse", "Slash"]),
    kind: "basic",
    power: Math.round(1 + rng() * 0.35),
    element,
  };
  const ultimate: HeroSkill = {
    id: `${seed}-ult`,
    name: pick(rng, ["Nova", "Tempest", "Surge", "Bloom", "Rend"]),
    kind: "ultimate",
    power: Math.round(1.5 + rng() * 0.8),
    element,
  };
  const support: HeroSkill = {
    id: `${seed}-support`,
    name: pick(rng, ["Ward", "Echo", "Bond", "Veil", "Guard"]),
    kind: role === "support" ? "support" : "basic",
    power: Math.round(0.8 + rng() * 0.4),
    element,
  };
  return [basic, ultimate, support];
}

export type GeneratedHero = Hero & {
  visuals: VisualDNA;
  skills: HeroSkill[];
};

export function generateHero(seed: string, idx: number, level = 1): GeneratedHero {
  const heroSeed = `${seed}-${idx}`;
  const rng = makeRng(heroSeed);
  const role = pick(rng, ROLE_POOL);
  const rarity = rollRarity(rng);
  const name = buildName(rng);
  const stats = computeStats(heroSeed, role, rarity, level);
  const visuals = buildVisualDNA(heroSeed);
  const power = Math.round(
    stats.hp / 8 + stats.atk * 2.1 + stats.def * 1.35 + stats.speed * 0.72 + rarityScale(rarity) * 18 + level * 6
  );
  return {
    id: `hero-${hashString(heroSeed).toString(36)}`,
    name,
    level,
    rarity,
    role,
    power,
    stats,
    visualSeed: heroSeed,
    visuals,
    skills: buildSkills(heroSeed, role),
  };
}

export function generateTeam(seed: string, count = 5, level = 1): GeneratedHero[] {
  const heroes: GeneratedHero[] = [];
  for (let i = 0; i < count; i += 1) {
    heroes.push(generateHero(seed, i, level));
  }
  return heroes;
}
