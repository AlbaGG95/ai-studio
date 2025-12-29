export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type HeroClass = "mage" | "tank" | "warrior" | "ranger" | "support";
export type Faction =
  | "Lightbearer"
  | "Mauler"
  | "Wilder"
  | "Graveborn"
  | "Celestial"
  | "Hypogean"
  | "Dimensional";
export type Biome =
  | "forest"
  | "desert"
  | "mountain"
  | "swamp"
  | "ruins"
  | "ice"
  | "volcanic"
  | "coast";

export interface SkillSpec {
  id: string;
  name: string;
  description: string;
  cooldown?: number;
  tags?: string[];
  type: "passive" | "active" | "ultimate";
}

export interface HeroSpec {
  id: string;
  name: string;
  class: HeroClass;
  faction: Faction;
  rarity: Rarity;
  ascensionTier: number;
  roleHint: "tank" | "dps" | "support";
  lore: string;
  stats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
    crit: number;
    critDmg: number;
  };
  skills: {
    passives: SkillSpec[];
    actives: SkillSpec[];
    ultimate: SkillSpec;
  };
}

export interface EnemySpec {
  id: string;
  name: string;
  description: string;
  faction: Faction;
  isBoss: boolean;
  stats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
  };
  lootTableRef: string;
  xpRange: [number, number];
  goldRange: [number, number];
  skills?: SkillSpec[];
}

export interface RegionSpec {
  id: string;
  name: string;
  biome: Biome;
  levelRange: [number, number];
  enemyPool: string[];
  bossRef: string;
  events: string[];
  puzzles: string[];
  fastTravelPoints: string[];
}

export interface WorldSpec {
  id: string;
  name: string;
  description: string;
  regions: RegionSpec[];
  meta: {
    createdAt: string;
    version: string;
    seed: number;
  };
}

export interface LootItem {
  id: string;
  name: string;
  rarity: Rarity;
  slot: "weapon" | "armor" | "trinket" | "artifact";
  stats: {
    atk?: number;
    def?: number;
    hp?: number;
    spd?: number;
    crit?: number;
    critDmg?: number;
  };
  tags?: string[];
}

export interface LootTable {
  id: string;
  name: string;
  rarityWeights: Record<Rarity, number>;
  items: LootItem[];
}

export interface SetBonus {
  id: string;
  name: string;
  description: string;
  required: number;
  bonus: string;
}

export interface GameSpec {
  meta: {
    name: string;
    description: string;
    themePreset: string;
    createdAt: string;
    version: string;
    seed: number;
  };
  progression: {
    stage: number;
    xpCurve: number[];
    goldPerSec: number;
    difficultyCurve: number[];
    offlineCapMinutes: number;
    tickMs: number;
  };
  roster: {
    heroes: HeroSpec[];
  };
  enemies: EnemySpec[];
  items: {
    lootTables: LootTable[];
    affixes: string[];
    setBonuses: SetBonus[];
    sampleItems: LootItem[];
  };
  world: WorldSpec;
  modes: {
    campaign: boolean;
    dailyTrials: boolean;
    arenaMock: boolean;
    towerMock: boolean;
  };
  uiHints: {
    palette: string[];
    factionColors: Record<Faction, string>;
    biomeStyles: Record<Biome, string>;
    iconMap: Record<string, string>;
  };
}

export interface GenerateGameParams {
  projectName: string;
  description: string;
  themePreset?: string;
}

export interface GenerateHeroParams {
  class?: HeroClass;
  faction?: Faction;
  rarity?: Rarity;
  seed?: number;
}

export interface GenerateWorldParams {
  numRegions?: number;
  themePreset?: string;
  seed?: number;
}
