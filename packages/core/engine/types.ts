export type Role = "tank" | "fighter" | "support" | "mage" | "ranger";
export type Faction =
  | "lightbearer"
  | "mauler"
  | "wilder"
  | "hypogean"
  | "celestial"
  | "dimensional";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  crit?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  powerMultiplier: number;
  type: "basic" | "ultimate";
  target: "enemy" | "ally";
}

export interface UnitTemplate {
  id: string;
  name: string;
  role: Role;
  faction: Faction;
  rarity: Rarity;
  position: "front" | "back";
  baseStats: Stats;
  abilities: {
    basic: Ability;
    ultimate: Ability;
  };
}

export interface EnemyTemplate extends UnitTemplate {
  kind: "normal" | "elite" | "boss";
  rewardMultiplier: number;
}

export interface StageDefinition {
  id: string;
  name: string;
  level: number;
  enemyLineup: string[];
  reward: {
    gold: number;
    xp: number;
  };
}

export interface Item {
  id: string;
  name: string;
  rarity: Rarity;
  stats: Partial<Stats>;
}

export interface UnitRuntimeState {
  id: string;
  templateId: string;
  side: "player" | "enemy";
  name: string;
  role: Role;
  rarity: Rarity;
  position: "front" | "back";
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  energy: number;
  attackCooldown: number;
  alive: boolean;
}

export interface CombatLogEntry {
  tick: number;
  actor: string;
  action: "attack" | "ultimate" | "defeat";
  target?: string;
  value?: number;
}

export interface CombatState {
  stage: number;
  inProgress: boolean;
  tick: number;
  playerTeam: UnitRuntimeState[];
  enemyTeam: UnitRuntimeState[];
  log: CombatLogEntry[];
}

export interface GachaConfig {
  pityEpic: number;
  pityLegendary: number;
  rates: Record<Rarity, number>;
}

export interface AfkState {
  bankedGold: number;
  bankedXp: number;
  lastClaimAt: number;
  capHours: number;
}

export interface CampaignState {
  currentStage: number;
  bestStage: number;
}

export interface PlayerState {
  heroes: UnitTemplate[];
  items: Item[];
  resources: {
    gold: number;
    xp: number;
    gems: number;
  };
  campaign: CampaignState;
  afk: AfkState;
  gacha: {
    pityEpic: number;
    pityLegendary: number;
  };
  activeTeam: string[];
}

export interface EngineConfig {
  tickMs: number;
  attackIntervalTicks: number;
  ultimateThreshold: number;
  energyPerTick: number;
  energyPerAttack: number;
  ultimateMultiplier: number;
  damageVariance: number;
  afkGoldPerTick: number;
  afkXpPerTick: number;
  afkCapHours: number;
  gacha: GachaConfig;
}

export interface TimelineState {
  lastTickAt: number;
}

export interface EngineState {
  version: string;
  seed: number;
  rngState: number;
  config: EngineConfig;
  player: PlayerState;
  combat: CombatState;
  timeline: TimelineState;
}
