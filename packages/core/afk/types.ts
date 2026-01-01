export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface Hero {
  id: string;
  name: string;
  level: number;
  power: number;
  role: string;
  rarity: Rarity;
  equipmentScore?: number;
  skills?: string[];
}

export interface Reward {
  gold: number;
  essence: number;
  items?: string[];
  shards?: number;
  multiplier?: number;
}

export interface Stage {
  id: string;
  index: number;
  enemyPower: number;
  reward: Reward;
  progress: number; // 0..1
  milestone?: boolean;
}

export interface UpgradeCost {
  gold: number;
  essence?: number;
}

export interface UpgradeEffect {
  resourceRate?: number;
  combatPower?: number;
  offlineCapHours?: number;
  stageSpeed?: number;
  rewardBoost?: number;
}

export interface Upgrade {
  id: string;
  name: string;
  level: number;
  cost: UpgradeCost;
  effect: UpgradeEffect;
  cap?: number;
  unlocked: boolean;
}

export interface PlayerState {
  resources: {
    gold: number;
    essence: number;
  };
  heroes: Hero[];
  activeHeroIds: string[];
  stage: Stage;
  unlocks: Record<string, boolean>;
  upgrades: Upgrade[];
  lastTickAt: number;
  afkBank: Reward;
}

export interface CombatSummary {
  result: "win" | "loss" | "timeout";
  turns: number;
  damageDealt: number;
  damageTaken: number;
}

export interface TickContext {
  now: number;
  tickMs: number;
  offlineCapHours: number;
  progressPerTick: number;
}

export interface IdleTickResult {
  state: PlayerState;
  rewards: Reward;
  ticks: number;
  stageCleared?: boolean;
  combat?: CombatSummary;
}

export interface CombatConfig {
  turnLimit?: number;
  timeoutResult?: CombatSummary["result"];
}

export type RngSource = () => number;
