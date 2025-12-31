export type ThemeTokens = {
  id: string;
  name: string;
  colors: {
    bg1: string;
    bg2: string;
    panel: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accentStrong: string;
    success: string;
    warn: string;
    info: string;
    gradientStart: string;
    gradientEnd: string;
    navBg?: string;
  };
  typography?: {
    heading?: string;
    body?: string;
  };
};

export type ContentData = {
  heroes: Array<{
    id: string;
    name: string;
    role: string;
    rarity: string;
    power: number;
    level: number;
  }>;
  stage: {
    enemyPower: number;
    reward: { gold: number; essence: number };
  };
  upgrades: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
};

export type GameStrings = {
  title: string;
  tagline: string;
  collectCta: string;
  startCta: string;
  bankLabel: string;
};

export type BalanceTuning = {
  baseGoldPerTick: number;
  baseEssencePerTick: number;
  rewardMultiplier: number;
};

export type GameConfig = {
  id: string;
  name: string;
  themeTokens: ThemeTokens;
  contentData: ContentData;
  strings: GameStrings;
  balance: BalanceTuning;
};

export const fantasyDark: GameConfig = {
  id: "fantasy_dark",
  name: "Fantasy Dark",
  themeTokens: {
    id: "fantasy_dark",
    name: "Nightfall Arcana",
    colors: {
      bg1: "#141826",
      bg2: "#0a0f1c",
      panel: "#0f1526",
      border: "#27344f",
      text: "#e6ecff",
      muted: "#9fb1d9",
      accent: "#7ea4ff",
      accentStrong: "#5c7cff",
      success: "#5ee1a0",
      warn: "#ffc46b",
      info: "#7ea4ff",
      gradientStart: "#5c7cff",
      gradientEnd: "#7cf0ff",
      navBg: "rgba(17, 23, 40, 0.92)",
    },
    typography: {
      heading: "'Cinzel', serif",
      body: "'Inter', system-ui",
    },
  },
  contentData: {
    heroes: [
      { id: "nova", name: "Nova", role: "fighter", rarity: "rare", power: 35, level: 3 },
      { id: "aeris", name: "Aeris", role: "mage", rarity: "epic", power: 40, level: 3 },
      { id: "thorn", name: "Thorn", role: "tank", rarity: "rare", power: 32, level: 2 },
    ],
    stage: { enemyPower: 24, reward: { gold: 14, essence: 3 } },
    upgrades: [
      { id: "u-resource", name: "Flow of Mana", description: "Más oro/esencia" },
      { id: "u-combat", name: "Blade Memory", description: "Daño incremental" },
    ],
  },
  strings: {
    title: "Nightfall Realm",
    tagline: "Guía a tus héroes en una campaña eterna.",
    collectCta: "Reclamar botín",
    startCta: "Entrar en combate",
    bankLabel: "Botín AFK",
  },
  balance: {
    baseGoldPerTick: 2,
    baseEssencePerTick: 1,
    rewardMultiplier: 1.1,
  },
};

export const scifiClean: GameConfig = {
  id: "scifi_clean",
  name: "Sci-Fi Clean",
  themeTokens: {
    id: "scifi_clean",
    name: "Neon Horizon",
    colors: {
      bg1: "#0f1724",
      bg2: "#0c1320",
      panel: "#0d1828",
      border: "#1f3555",
      text: "#e5f1ff",
      muted: "#9cc1e8",
      accent: "#4df0ff",
      accentStrong: "#6ee0ff",
      success: "#52f9c9",
      warn: "#ffc977",
      info: "#6ee0ff",
      gradientStart: "#4df0ff",
      gradientEnd: "#6f8bff",
      navBg: "rgba(10, 18, 32, 0.9)",
    },
    typography: {
      heading: "'Orbitron', 'Inter', system-ui",
      body: "'Inter', system-ui",
    },
  },
  contentData: {
    heroes: [
      { id: "vega", name: "Vega-7", role: "ranger", rarity: "epic", power: 42, level: 3 },
      { id: "ion", name: "ION", role: "support", rarity: "rare", power: 30, level: 2 },
      { id: "kora", name: "KORA", role: "fighter", rarity: "rare", power: 34, level: 3 },
    ],
    stage: { enemyPower: 26, reward: { gold: 16, essence: 4 } },
    upgrades: [
      { id: "u-resource", name: "Data Mining", description: "Generación x%" },
      { id: "u-combat", name: "Targeting Suite", description: "Precisión y daño" },
    ],
  },
  strings: {
    title: "Neon Frontiers",
    tagline: "Simula expediciones automáticas en el borde de la galaxia.",
    collectCta: "Harvest",
    startCta: "Deploy",
    bankLabel: "Harvest Bank",
  },
  balance: {
    baseGoldPerTick: 3,
    baseEssencePerTick: 1,
    rewardMultiplier: 1.2,
  },
};

export const gameConfigs: GameConfig[] = [fantasyDark, scifiClean];
export const defaultGameConfigId = fantasyDark.id;
