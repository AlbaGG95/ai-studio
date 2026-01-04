import { AfkHero, AfkStage } from "@ai-studio/core";

type Rng = () => number;

export type HeroArtProfile = {
  seed: string;
  rarity: AfkHero["rarity"];
  role: AfkHero["role"];
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
    shadow: string;
    line: string;
  };
  silhouette: { wobble: number; cut: number };
  armor: { band: number; plating: number; cape: boolean; crest: boolean };
  head: { visor: number; crest: number };
  weapon: { type: "blade" | "staff" | "bow" | "hammer"; edge: number };
  back: { item: "wings" | "banner" | "rune" | "totem"; intensity: number };
  sigil: { glyph: string; stroke: string; inner: string };
};

export type IconSpec = {
  seed: string;
  glyph: string;
  tones: [string, string];
  border: string;
  glow: string;
  shape: "diamond" | "hex" | "circle";
};

export type SkillBlueprint = {
  id: string;
  name: string;
  description: string;
  element: string;
  icon: IconSpec;
};

type Biome = {
  id: "forest" | "desert" | "ruins" | "city";
  name: string;
  palette: {
    sky: string;
    ground: string;
    accent: string;
    mist: string;
  };
  props: string[];
};

function seeded(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return (t % 1000) / 1000;
  };
}

function pick<T>(rng: Rng, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function mixColor(base: string, delta: number) {
  const num = parseInt(base.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + delta));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + delta));
  const b = Math.min(255, Math.max(0, (num & 0xff) + delta));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const ROLE_GLYPHS: Record<AfkHero["role"], string> = {
  tank: "\u25B2",
  fighter: "\u2694",
  ranger: "\u27B3",
  support: "\u2726",
  mage: "\u272A",
};

const ROLE_WEAPON: Record<AfkHero["role"], HeroArtProfile["weapon"]["type"]> = {
  tank: "hammer",
  fighter: "blade",
  ranger: "bow",
  support: "staff",
  mage: "staff",
};

const RARITY_FRAMES: Record<AfkHero["rarity"], [string, string]> = {
  common: ["#6b7280", "#9ca3af"],
  rare: ["#3b82f6", "#93c5fd"],
  epic: ["#a855f7", "#c084fc"],
  legendary: ["#f59e0b", "#fcd34d"],
};

const BIOMES: Biome[] = [
  { id: "forest", name: "Bosk of Echoes", palette: { sky: "#15344e", ground: "#0f253c", accent: "#6ee7b7", mist: "#1e3a5f" }, props: ["roots", "fireflies", "vines"] },
  { id: "desert", name: "Amber Dunes", palette: { sky: "#3b2f1f", ground: "#2a2117", accent: "#f59e0b", mist: "#4a341c" }, props: ["pillars", "mirage", "sun"] },
  { id: "ruins", name: "Fallen Spires", palette: { sky: "#1f2438", ground: "#14192b", accent: "#7dd3fc", mist: "#252b45" }, props: ["arches", "glyphs", "mist"] },
  { id: "city", name: "Skyward Market", palette: { sky: "#162533", ground: "#0f1b29", accent: "#67e8f9", mist: "#1f3649" }, props: ["banners", "lamps", "steam"] },
];

export function buildHeroArtProfile(hero: Pick<AfkHero, "visualSeed" | "rarity" | "role" | "id">): HeroArtProfile {
  const rng = seeded(hero.visualSeed ?? hero.id);
  const frame = RARITY_FRAMES[hero.rarity];
  const palette = {
    primary: mixColor(frame[0], Math.round(rng() * 20) - 10),
    secondary: mixColor(frame[1], Math.round(rng() * 14) - 7),
    accent: mixColor(frame[1], Math.round(rng() * 32) - 16),
    glow: mixColor(frame[1], 40),
    shadow: "#0a0f1c",
    line: "#0b1220",
  };
  const wobble = 0.12 + rng() * 0.35;
  const crest = Math.round(rng() * 3);
  const armorBand = 0.15 + rng() * 0.3;
  const weaponType = ROLE_WEAPON[hero.role] ?? "blade";
  const backItem = pick(rng, ["wings", "banner", "rune", "totem"] as const);
  return {
    seed: hero.visualSeed,
    rarity: hero.rarity,
    role: hero.role,
    palette,
    silhouette: { wobble, cut: rng() * 0.3 },
    armor: { band: armorBand, plating: 0.3 + rng() * 0.35, cape: rng() > 0.5, crest: rng() > 0.35 },
    head: { visor: 0.3 + rng() * 0.4, crest },
    weapon: { type: weaponType, edge: 0.2 + rng() * 0.4 },
    back: { item: backItem, intensity: 0.4 + rng() * 0.4 },
    sigil: { glyph: ROLE_GLYPHS[hero.role], stroke: frame[0], inner: frame[1] },
  };
}

export function generateIcon(seed: string, role?: AfkHero["role"]): IconSpec {
  const rng = seeded(seed);
  const glyph = pick(rng, ["\u2605", "\u25C6", "\u2698", "\u2726", "\u2736", "\u2740"]);
  const shape = pick(rng, ["diamond", "hex", "circle"] as const);
  const tones =
    role === "fighter"
      ? ["#ef4444", "#fb7185"]
      : role === "tank"
        ? ["#22d3ee", "#0ea5e9"]
        : role === "ranger"
          ? ["#a3e635", "#65a30d"]
          : role === "mage"
            ? ["#a855f7", "#8b5cf6"]
            : ["#fbbf24", "#f59e0b"];
  return {
    seed,
    glyph,
    shape,
    tones,
    border: mixColor(tones[0], 14),
    glow: mixColor(tones[1], 24),
  };
}

export function biomeForStage(stage: AfkStage): Biome {
  const index = Number(stage.id.split("-")[1] ?? "1");
  return BIOMES[index % BIOMES.length];
}

export function buildSkillset(hero: AfkHero): SkillBlueprint[] {
  const rng = seeded(`${hero.id}-skills`);
  const elements = ["ember", "frost", "storm", "void", "aura", "stone"];
  const verbsByRole: Record<AfkHero["role"], string[]> = {
    fighter: ["Cleave", "Burst", "Flurry", "Dash"],
    tank: ["Guard", "Bulwark", "Shield", "Anchor"],
    ranger: ["Volley", "Pierce", "Ricochet", "Hawkeye"],
    support: ["Mend", "Rally", "Ward", "Chime"],
    mage: ["Nova", "Ray", "Sigil", "Cascade"],
  };
  const nouns = ["Echo", "Vow", "Breach", "Crown", "Spiral", "Oath", "Bloom", "Chord", "Rune"];
  const element = pick(rng, elements);
  const verbs = verbsByRole[hero.role] ?? ["Strike"];
  const count = 3;
  const list: SkillBlueprint[] = [];
  for (let i = 0; i < count; i += 1) {
    const name = `${pick(rng, verbs)} ${pick(rng, nouns)}`;
    const id = `${hero.id}-skill-${i}`;
    const magnitude = 10 + Math.round(rng() * 40);
    const description =
      hero.role === "support"
        ? `Cura aliados cercanos por ${magnitude}% y otorga ${element} durante 6s.`
        : `Inflige ${magnitude}% de poder como da\u00f1o ${element} y aplica marca durante 4s.`;
    list.push({
      id,
      name,
      description,
      element,
      icon: generateIcon(`${hero.visualSeed}-${i}`, hero.role),
    });
  }
  return list;
}

export function seedInventory(stage: AfkStage) {
  const biome = biomeForStage(stage);
  return [
    { id: `${stage.id}-relic`, name: `${biome.name} Relic`, kind: "artifact", icon: generateIcon(`${stage.id}-artifact`) },
    { id: `${stage.id}-supply`, name: `${biome.name} Supply`, kind: "material", icon: generateIcon(`${stage.id}-supply`) },
  ];
}
