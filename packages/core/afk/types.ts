export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Role = "tank" | "fighter" | "ranger" | "support" | "mage";

export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
}

export interface Hero {
  id: string;
  name: string;
  level: number;
  rarity: Rarity;
  role: Role;
  power: number;
  stats: HeroStats;
  visualSeed: string;
}

export interface HeroVisual {
  body: string;
  accent: string;
  secondary: string;
  detail: string;
  pattern: "stripes" | "bars" | "rings" | "none";
}

export interface BattleUnit {
  heroId: string;
  name: string;
  role: Role;
  rarity: Rarity;
  lane: "front" | "back";
  team: "ally" | "enemy";
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  energy: number;
  speed: number;
  alive: boolean;
}

export interface Reward {
  gold: number;
  exp: number;
  materials: number;
}

export interface Stage {
  id: string; // e.g. "1-1"
  chapter: number;
  index: number;
  recommendedPower: number;
  enemyPower: number;
  reward: Reward;
  unlocked: boolean;
}

export interface Upgrade {
  id: string;
  name: string;
  level: number;
  cost: Reward;
  effect: {
    idleBoost?: number;
    powerBoost?: number;
    rewardBoost?: number;
  };
  unlocked: boolean;
  cap?: number;
}

export interface CampaignState {
  chapter: number;
  currentStageId: string;
  unlockedStageIds: string[];
  completedStageIds: string[];
}

export interface PlayerState {
  resources: Reward;
  heroes: Hero[];
  activeHeroIds: string[];
  campaign: CampaignState;
  upgrades: Upgrade[];
  idle: {
    bank: Reward;
    lastSeenAt: number;
    lastClaimAt: number;
    ratePerMinute: Reward;
  };
}

export interface CombatSummary {
  result: "win" | "loss" | "timeout";
  turns: number;
  damageDealt: number;
  damageTaken: number;
  events: CombatEvent[];
  allies?: BattleUnit[];
  enemies?: BattleUnit[];
  durationMs?: number;
}

export interface CombatEvent {
  kind: "attack" | "heal" | "ultimate" | "death";
  sourceId: string;
  targetId?: string;
  amount: number;
  crit?: boolean;
  timestamp: number;
  team: "ally" | "enemy";
}

export interface TickContext {
  now: number;
  tickMs: number;
  offlineCapHours: number;
}

export interface IdleTickResult {
  state: PlayerState;
  rewards: Reward;
  ticks: number;
}

export interface CombatConfig {
  turnLimit?: number;
  tickMs?: number;
  timeoutResult?: CombatSummary["result"];
}

export type RngSource = () => number;
